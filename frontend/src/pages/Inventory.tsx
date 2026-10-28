import { useMemo, useState } from 'react'
import { AlertTriangle, Archive, Package, PackagePlus, Plus, Search } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { SearchInput } from '../components/ui/SearchInput'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { EmptyState, Field, TableSkeleton } from '../components/ui/Field'
import { useCreate, useList, useUpdate } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { cx, num, toman } from '../utils/format'
import type { Product, StockMovement } from '../types'

const PAGE_SIZE = 10
const CATEGORIES = ['الکترونیک', 'لوازم جانبی', 'قطعات', 'خدمات', 'نرم‌افزار']
const WAREHOUSES = ['انبار مرکزی', 'انبار غرب', 'انبار قطعات']

export default function Inventory() {
  const { data: products, isLoading } = useList('products')
  
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [page, setPage] = useState(1)
  
  const [adjustModal, setAdjustModal] = useState<Product | null>(null)
  const [createModal, setCreateModal] = useState(false)

  // Filters
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (q) {
        const term = q.toLowerCase()
        return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
      }
      return true
    }).sort((a, b) => b.stock - a.stock)
  }, [products, q, category])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // Stats
  const totalProducts = products.length
  const lowStock = products.filter((p) => p.stock <= p.minStock).length
  const outOfStock = products.filter((p) => p.stock === 0).length
  const totalValue = products.reduce((acc, p) => acc + (p.stock * p.cost), 0)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="انبار و موجودی" 
        subtitle="مدیریت کالاها، قیمت‌گذاری و کنترل موجودی انبارها"
       actions={<button className="btn btn-primary" onClick={() => setCreateModal(true)}><Plus className="size-5" />
          <Plus className="size-5" />
          کالای جدید</button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="کل محصولات"
          value={num(totalProducts)}
          icon={Package}
        />
        <StatCard
          title="ارزش موجودی"
          value={toman(totalValue)}
          icon={Archive}
        />
        <StatCard
          title="نیاز به شارژ (کمتر از حداقل)"
          value={num(lowStock)}
          icon={AlertTriangle}
        />
        <StatCard
          title="ناموجود"
          value={num(outOfStock)}
          icon={PackagePlus}
        />
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="p-4 border-b border-base-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SearchInput 
              placeholder="جستجو در کد یا نام کالا..." 
              value={q} 
              onChange={setQ} 
              className="w-full sm:w-72" 
            />
            <select
              className="select select-bordered"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">همه دسته‌ها</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="text-sm text-base-content/60">
            {num(filtered.length)} کالا یافت شد
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>کد (SKU)</th>
                <th>نام کالا</th>
                <th>دسته‌بندی</th>
                <th>انبار</th>
                <th>موجودی</th>
                <th>قیمت فروش</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={7} rows={5} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="کالایی یافت نشد" 
                      description="کالایی با این مشخصات در انبار وجود ندارد."
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((product) => (
                  <tr key={product.id} className="hover">
                    <td className="font-mono text-sm text-base-content/70">{product.sku}</td>
                    <td>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-base-content/60 mt-0.5">تامین‌کننده: {product.supplier}</div>
                    </td>
                    <td><div className="badge badge-ghost">{product.category}</div></td>
                    <td className="text-sm">{product.warehouse}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={cx(
                          "font-bold text-lg",
                          product.stock === 0 ? "text-error" : 
                          product.stock <= product.minStock ? "text-warning" : "text-success"
                        )}>
                          {num(product.stock)} {product.unit}
                        </span>
                        {product.stock <= product.minStock && product.stock > 0 && (
                          <div className="tooltip" data-tip="نیاز به شارژ">
                            <AlertTriangle className="size-4 text-warning" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{toman(product.price)}</td>
                    <td>
                      <button 
                        onClick={() => setAdjustModal(product)}
                        className="btn btn-sm btn-ghost"
                      >
                        تعدیل / شارژ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-base-200">
            <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        )}
      </div>

      <AdjustStockModal 
        product={adjustModal} 
        onClose={() => setAdjustModal(null)} 
      />

      {createModal && (
        <CreateProductModal onClose={() => setCreateModal(false)} />
      )}
    </div>
  )
}

function AdjustStockModal({ product, onClose }: { product: Product | null, onClose: () => void }) {
  const user = useAuthStore(s => s.user)
  const updateProduct = useUpdate('products')
  const createMovement = useCreate('stockMovements')
  
  const [type, setType] = useState<StockMovement['type']>('in')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !user) return

    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) return

    // Calculate new stock
    let newStock = product.stock
    if (type === 'in') newStock += qty
    else if (type === 'out') newStock -= qty
    else if (type === 'adjust') newStock = qty // Absolute adjustment
    
    if (newStock < 0) newStock = 0

    // Update product
    await updateProduct.mutateAsync({ id: product.id, stock: newStock })
    
    // Log movement
    await createMovement.mutateAsync({
      productId: product.id,
      type,
      quantity: qty,
      date: new Date().toISOString(),
      userId: user.id,
      note
    })

    onClose()
  }

  return (
    <Modal open={!!product} onClose={onClose} title="تعدیل موجودی">
      {product && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-base-200 p-3 rounded-xl mb-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{product.name}</div>
              <div className="text-xs opacity-70">{product.sku}</div>
            </div>
            <div className="text-left">
              <div className="text-xs opacity-70">موجودی فعلی</div>
              <div className="font-bold text-lg">{num(product.stock)} {product.unit}</div>
            </div>
          </div>

          <Field label="نوع تراکنش">
            <select 
              className="select select-bordered w-full" 
              value={type} 
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="in">ورود به انبار (+)</option>
              <option value="out">خروج از انبار (-)</option>
              <option value="adjust">ثبت موجودی دقیق (=)</option>
            </select>
          </Field>

          <Field label="تعداد / مقدار" required>
            <input 
              type="number" 
              className="input input-bordered w-full font-mono text-left" 
              value={quantity} 
              onChange={e => setQuantity(e.target.value)}
              min="1"
              required
            />
          </Field>

          <Field label="یادداشت">
            <textarea 
              className="textarea textarea-bordered w-full" 
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="دلیل ورود/خروج کالا..."
            />
          </Field>

          <div className="flex gap-2 justify-end mt-6">
            <button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button>
            <button type="submit" className="btn btn-primary" disabled={updateProduct.isPending || !quantity}>
              ثبت تغییرات
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function CreateProductModal({ onClose }: { onClose: () => void }) {
  const createProduct = useCreate('products')
  
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    await createProduct.mutateAsync({
      sku: fd.get('sku') as string,
      name: fd.get('name') as string,
      category: fd.get('category') as string,
      price: Number(fd.get('price')),
      cost: Number(fd.get('cost')),
      stock: Number(fd.get('stock')),
      minStock: Number(fd.get('minStock')),
      unit: fd.get('unit') as string,
      warehouse: fd.get('warehouse') as string,
      supplier: fd.get('supplier') as string,
      createdAt: new Date().toISOString()
    })
    
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="افزودن کالای جدید">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="کد کالا (SKU)" required>
            <input name="sku" required className="input input-bordered w-full font-mono text-left" dir="ltr" placeholder="PRD-123" />
          </Field>
          <Field label="نام کالا" required>
            <input name="name" required className="input input-bordered w-full" />
          </Field>
          
          <Field label="دسته‌بندی">
            <select name="category" className="select select-bordered w-full">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="تامین‌کننده">
            <input name="supplier" className="input input-bordered w-full" />
          </Field>
          
          <Field label="قیمت فروش (تومان)" required>
            <input type="number" name="price" required className="input input-bordered w-full font-mono text-left" />
          </Field>
          <Field label="قیمت خرید/بهای تمام شده" required>
            <input type="number" name="cost" required className="input input-bordered w-full font-mono text-left" />
          </Field>

          <Field label="موجودی اولیه" required>
            <input type="number" name="stock" required defaultValue="0" className="input input-bordered w-full font-mono text-left" />
          </Field>
          <Field label="واحد شمارش" required>
            <select name="unit" className="select select-bordered w-full">
              <option value="عدد">عدد</option>
              <option value="بسته">بسته</option>
              <option value="دستگاه">دستگاه</option>
              <option value="کیلوگرم">کیلوگرم</option>
              <option value="متر">متر</option>
            </select>
          </Field>

          <Field label="حداقل موجودی (هشدار)">
            <input type="number" name="minStock" defaultValue="5" className="input input-bordered w-full font-mono text-left" />
          </Field>
          <Field label="انبار">
            <select name="warehouse" className="select select-bordered w-full">
              {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button>
          <button type="submit" className="btn btn-primary" disabled={createProduct.isPending}>
            ذخیره کالا
          </button>
        </div>
      </form>
    </Modal>
  )
}
