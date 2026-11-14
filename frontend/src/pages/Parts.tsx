import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  ArrowUpCircle,
  ArrowUpDown,
  Boxes,
  Cpu,
  ExternalLink,
  History,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Pagination } from '../components/ui/Pagination'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, TableSkeleton, EmptyState } from '../components/ui/Field'
import { Can } from '../components/common/Can'
import { partApi } from '../services/api'
import {
  customerDisplayName,
  cx,
  dateTimeFa,
  formatNumericInput,
  num,
  toEnDigits,
  toman,
} from '../utils/format'
import { inventoryTypeMeta } from '../utils/meta'
import type { InventoryOperationType, Part } from '../types'

const schema = z.object({
  name: z.string().trim().min(2, 'نام مدل دستگاه را وارد کنید'),
  code: z
    .string()
    .trim()
    .min(2, 'کد فنی دستگاه (SKU) را وارد کنید')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'کد SKU فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد'),
  periodic_service_months: z
    .string()
    .min(1, 'دوره سرویس الزامی است')
    .refine((v) => {
      const n = Number(toEnDigits(v))
      return Number.isInteger(n) && n >= 1
    }, 'دوره سرویس باید حداقل ۱ ماه باشد'),
  unit_price: z.string().optional(),
  stock_quantity: z.string().optional(),
  min_stock: z.string().optional(),
  unit: z.string().trim().optional(),
  description: z.string().trim().optional(),
  is_active: z.boolean(),
})

type PartFormValues = z.infer<typeof schema>

export default function Parts() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState<'catalog' | 'logs'>('catalog')
  const q = params.get('q') || ''

  // Create / Edit Catalog Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<Part | null>(null)
  const [deletingPart, setDeletingPart] = useState<Part | null>(null)

  // Manual Stock In / Out / Adjustment Modal
  const [stockTarget, setStockTarget] = useState<Part | null>(null)
  const [stockActionType, setStockActionType] = useState<'in' | 'out_manual' | 'adjustment'>('in')
  const [stockQtyInput, setStockQtyInput] = useState('1')
  const [stockDesc, setStockDesc] = useState('')

  // Inventory Audit Logs Filters
  const [logPage, setLogPage] = useState(1)
  const [logTypeFilter, setLogTypeFilter] = useState<InventoryOperationType | ''>('')
  const [logPartFilter, setLogPartFilter] = useState<string>('')
  const [logSearch, setLogSearch] = useState('')

  // Catalog Sorting
  type PartSortField = 'name' | 'code' | 'stock' | 'warranty' | 'assigned' | 'status'
  const [sortField, setSortField] = useState<PartSortField>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: PartSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['parts-catalog', q],
    queryFn: () => partApi.list({ q: toEnDigits(q).trim() || undefined }),
  })

  const sortedParts = useMemo(() => {
    return [...parts].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', 'fa')
          break
        case 'code':
          comparison = (a.code || '').localeCompare(b.code || '')
          break
        case 'stock':
          comparison = (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0)
          break
        case 'warranty':
          comparison = (Number(a.periodic_service_months) || 0) - (Number(b.periodic_service_months) || 0)
          break
        case 'assigned': {
          const aAssigned = Number(a.assigned_quantity_sum ?? a.customer_parts_count ?? 0)
          const bAssigned = Number(b.assigned_quantity_sum ?? b.customer_parts_count ?? 0)
          comparison = aAssigned - bAssigned
          break
        }
        case 'status':
          comparison = a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [parts, sortField, sortOrder])

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['inventory-logs', logPage, logTypeFilter, logPartFilter, logSearch],
    queryFn: () =>
      partApi.inventoryLogs({
        page: logPage,
        per_page: 20,
        type: logTypeFilter || undefined,
        part_id: logPartFilter || undefined,
        q: toEnDigits(logSearch).trim() || undefined,
      }),
    enabled: activeTab === 'logs',
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PartFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      periodic_service_months: '12',
      unit_price: '0',
      stock_quantity: '0',
      min_stock: '0',
      unit: 'دستگاه',
      description: '',
      is_active: true,
    },
  })

  const unitPriceVal = useWatch({ control, name: 'unit_price' })

  const openCreate = () => {
    setEditingPart(null)
    reset({
      name: '',
      code: '',
      periodic_service_months: '12',
      unit_price: '0',
      stock_quantity: '0',
      min_stock: '0',
      unit: 'دستگاه',
      description: '',
      is_active: true,
    })
    setModalOpen(true)
  }

  const openEdit = (p: Part) => {
    setEditingPart(p)
    reset({
      name: p.name,
      code: p.code,
      periodic_service_months: String(p.periodic_service_months),
      unit_price: formatNumericInput(String(Math.round(Number(p.unit_price ?? 0)))),
      stock_quantity: String(p.stock_quantity ?? 0),
      min_stock: String(p.min_stock ?? 0),
      unit: p.unit || 'دستگاه',
      description: p.description ?? '',
      is_active: p.is_active,
    })
    setModalOpen(true)
  }

  const openStockModal = (p: Part, type: 'in' | 'out_manual' | 'adjustment') => {
    setStockTarget(p)
    setStockActionType(type)
    setStockQtyInput(type === 'adjustment' ? String(p.stock_quantity ?? 0) : '1')
    setStockDesc('')
  }

  const deleteMutation = useMutation({
    mutationFn: partApi.delete,
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['inventory-logs'] })
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setDeletingPart(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف دستگاه')
    },
  })

  const adjustStockMutation = useMutation({
    mutationFn: () => {
      const qty = Number(toEnDigits(stockQtyInput))
      return partApi.adjustStock(stockTarget!.id, {
        type: stockActionType,
        quantity: qty,
        description:
          stockDesc.trim() ||
          (stockActionType === 'in'
            ? 'ورود دستی به انبار'
            : stockActionType === 'out_manual'
              ? 'خروج دستی از انبار'
              : 'انبارگردانی و تنظیم دقیق موجودی فیزیکی'),
      })
    },
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['inventory-logs'] })
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setStockTarget(null)
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err.response?.data?.message || 'خطا در ثبت گردش انبار')
    },
  })

  const onSubmit = async (values: PartFormValues) => {
    const parsedUnitPrice = Number(toEnDigits(values.unit_price || '0').replace(/,/g, '')) || 0
    const payload: Partial<Part> = {
      name: values.name.trim(),
      code: toEnDigits(values.code).trim(),
      periodic_service_months: Number(toEnDigits(values.periodic_service_months)) || 12,
      unit_price: Math.max(0, parsedUnitPrice),
      min_stock: Number(toEnDigits(values.min_stock || '0')) || 0,
      unit: values.unit?.trim() || 'دستگاه',
      description: values.description?.trim() || null,
      is_active: values.is_active,
    }

    if (!editingPart) {
      payload.stock_quantity = Number(toEnDigits(values.stock_quantity || '0')) || 0
    }

    try {
      if (editingPart) {
        const res = await partApi.update(editingPart.id, payload)
        toast.success(res.message)
      } else {
        const res = await partApi.create(payload)
        toast.success(res.message)
      }
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['inventory-logs'] })
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setModalOpen(false)
    } catch (err: any) {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err.response?.data?.message || 'خطا در ذخیره دستگاه')
    }
  }

  const handleStockSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!stockTarget) return
    const raw = toEnDigits(stockQtyInput).trim()
    const qty = raw === '' ? -1 : Number(raw)
    if (!Number.isInteger(qty) || (stockActionType === 'adjustment' ? qty < 0 : qty < 1)) {
      toast.error(
        stockActionType === 'adjustment'
          ? 'موجودی شمارش‌شده باید عدد صحیح صفر یا بیشتر باشد'
          : 'تعداد باید حداقل ۱ عدد باشد',
      )
      return
    }
    if (stockActionType === 'out_manual' && qty > (stockTarget.stock_quantity ?? 0)) {
      toast.error(
        `موجودی فعلی انبار (${num(stockTarget.stock_quantity ?? 0)} عدد) کمتر از تعداد خروجی درخواستی است`,
      )
      return
    }
    adjustStockMutation.mutate()
  }

  const totalWarehouseStock = parts.reduce((acc, p) => acc + (p.stock_quantity ?? 0), 0)
  const logs = logsData?.data ?? []
  const logsPageCount = logsData?.last_page ?? 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="کاتالوگ و انبار دستگاه‌ها"
        actions={
          <>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-bold text-primary">
              <Boxes className="size-4" />
              موجودی کل: {num(totalWarehouseStock)}
            </span>
            <Can permission="parts.manage">
              <button type="button" className="btn btn-sm btn-primary gap-1.5" onClick={openCreate}>
                <Plus className="size-4" /> دستگاه جدید
              </button>
            </Can>
          </>
        }
      />

      {/* Tabs Switcher */}
      <div className="border-b border-base-200">
        <div role="tablist" className="tabs tabs-border">
          <button
            type="button"
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', activeTab === 'catalog' && 'tab-active')}
            onClick={() => setActiveTab('catalog')}
          >
            <Cpu className="size-4" />
            لیست دستگاه‌ها و موجودی انبار ({num(parts.length)})
          </button>
          <button
            type="button"
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', activeTab === 'logs' && 'tab-active')}
            onClick={() => setActiveTab('logs')}
          >
            <History className="size-4" />
            گزارش گردش و لاگ ورود و خروج انبار
          </button>
        </div>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Info Alert on Periodic Service & Stock */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950 flex items-start gap-3 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            <Wrench className="size-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">راهنمای مدیریت انبار و گارانتی دستگاه‌ها</p>
              <p className="opacity-90 leading-relaxed">
                هنگام تخصیص هر دستگاه به پرونده مشتری، تعداد تحویلی به‌صورت خودکار از موجودی انبار کسر و در گزارش گردش انبار ثبت می‌شود.
                همچنین در صورت حذف یا کاهش دستگاه از پرونده مشتری، موجودی به انبار بازگردانده خواهد شد.
              </p>
            </div>
          </div>

          {/* Search and Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <SearchInput
                value={q}
                onChange={(val) => {
                  const normalized = toEnDigits(val)
                  const next = new URLSearchParams(params)
                  if (normalized) next.set('q', normalized)
                  else next.delete('q')
                  setParams(next, { replace: true })
                }}
                placeholder="جستجوی نام دستگاه، کد فنی SKU یا توضیحات..."
              />
            </div>
            <p className="text-xs text-base-content/60 self-end sm:self-center">
              {num(parts.length)} مدل دستگاه در کاتالوگ
            </p>
          </div>

          {/* Devices Catalog Table */}
          <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : !parts.length ? (
              <EmptyState
                title="دستگاهی یافت نشد"
                subtitle={
                  q
                    ? `هیچ موردی مطابق با جستجوی «${q}» پیدا نشد.`
                    : 'مدل‌های دستگاه‌های خود را تعریف کنید تا بتوانید موجودی انبار را مدیریت کرده و آن‌ها را به مشتریان تخصیص دهید.'
                }
                action={
                  <Can permission="parts.manage">
                    <button className="btn btn-sm btn-primary" onClick={openCreate}>
                      <Plus className="size-4" /> تعریف اولین دستگاه
                    </button>
                  </Can>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-hover">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-base-content/75 border-b border-base-200">
                      <th
                        onClick={() => handleSort('name')}
                        className="cursor-pointer select-none group hover:bg-base-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>دستگاه</span>
                          {sortField === 'name' ? (
                            sortOrder === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('code')}
                        className="cursor-pointer select-none group hover:bg-base-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>کد (SKU)</span>
                          {sortField === 'code' ? (
                            sortOrder === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('stock')}
                        className="cursor-pointer select-none group hover:bg-base-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>موجودی</span>
                          {sortField === 'stock' ? (
                            sortOrder === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('warranty')}
                        className="cursor-pointer select-none group hover:bg-base-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>دوره گارانتی</span>
                          {sortField === 'warranty' ? (
                            sortOrder === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('assigned')}
                        className="cursor-pointer select-none group hover:bg-base-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>تحویل‌شده</span>
                          {sortField === 'assigned' ? (
                            sortOrder === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                          )}
                        </div>
                      </th>
                      <th>قیمت واحد</th>
                      <th
                        onClick={() => handleSort('status')}
                        className="cursor-pointer select-none group hover:bg-base-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>وضعیت</span>
                          {sortField === 'status' ? (
                            sortOrder === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                          )}
                        </div>
                      </th>
                      <th className="text-end">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200/80">
                    {sortedParts.map((p) => {
                      const stock = p.stock_quantity ?? 0
                      const assignedSum = Number(p.assigned_quantity_sum ?? p.customer_parts_count ?? 0)
                      return (
                        <tr key={p.id} className="transition-colors hover:bg-base-200/50">
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-bold">
                                <Cpu className="size-5" />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-base-content">{p.name}</p>
                                {p.description && (
                                  <p className="text-xs text-base-content/50 truncate max-w-[260px]">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {p.code}
                            </span>
                          </td>

                          <td>
                            <span
                              className={cx(
                                'badge badge-sm font-bold',
                                stock <= 0
                                  ? 'badge-error badge-soft'
                                  : stock <= 2
                                    ? 'badge-warning badge-soft'
                                    : 'badge-success badge-soft',
                              )}
                            >
                              {num(stock)}
                            </span>
                          </td>

                          <td>
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {num(p.periodic_service_months)} ماه
                            </span>
                          </td>

                          <td>
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600">
                              <Boxes className="size-3.5" />
                              {num(assignedSum)}
                            </span>
                          </td>

                          <td className="font-mono text-xs font-bold text-base-content">
                            {Number(p.unit_price ?? 0) > 0 ? toman(p.unit_price ?? 0) : <span className="text-base-content/40">—</span>}
                          </td>

                          <td>
                            <span
                              className={cx(
                                'badge badge-xs font-bold',
                                p.is_active ? 'badge-success badge-soft' : 'badge-error badge-soft',
                              )}
                            >
                              {p.is_active ? 'فعال' : 'غیرفعال'}
                            </span>
                          </td>

                          <td className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Can permission="parts.manage">
                                <button
                                  type="button"
                                  className="btn btn-outline btn-success btn-xs gap-1 font-bold"
                                  title="افزودن موجودی به انبار"
                                  onClick={() => openStockModal(p, 'in')}
                                >
                                  <ArrowDownCircle className="size-3.5" /> ورود
                                </button>
                                <button
                                  type="button"
                                  disabled={stock <= 0}
                                  className="btn btn-outline btn-warning btn-xs gap-1 font-bold"
                                  title="ثبت خروج دستی از انبار"
                                  onClick={() => openStockModal(p, 'out_manual')}
                                >
                                  <ArrowUpCircle className="size-3.5" /> خروج
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs btn-square"
                                  title="ویرایش مشخصات دستگاه"
                                  onClick={() => openEdit(p)}
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                                  title="حذف دستگاه"
                                  onClick={() => setDeletingPart(p)}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </Can>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Warehouse Inventory Audit Logs Section */
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 bg-base-100 p-4 rounded-2xl border border-base-200 shadow-xs">
            <SearchInput
              value={logSearch}
              onChange={(val) => {
                setLogSearch(toEnDigits(val))
                setLogPage(1)
              }}
              placeholder="جستجوی دستگاه، مشتری، کارمند یا شرح..."
            />

            <SearchableSelect
              placeholder="همه دستگاه‌ها"
              searchPlaceholder="جستجوی دستگاه..."
              value={logPartFilter}
              options={parts.map((p) => ({
                value: String(p.id),
                label: p.name,
                hint: p.code,
              }))}
              onChange={(val) => {
                setLogPartFilter(val)
                setLogPage(1)
              }}
            />

            <SearchableSelect
              placeholder="همه عملیات"
              searchPlaceholder="جستجو..."
              value={logTypeFilter}
              options={[
                { value: 'in', label: 'ورود (+)' },
                { value: 'out_assign', label: 'تخصیص (-)' },
                { value: 'out_manual', label: 'خروج دستی (-)' },
                { value: 'return', label: 'بازگشت (+)' },
                { value: 'adjustment', label: 'انبارگردانی (=)' },
              ]}
              onChange={(val) => {
                setLogTypeFilter(val as InventoryOperationType | '')
                setLogPage(1)
              }}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
            {logsLoading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : !logs.length ? (
              <EmptyState
                title="سابقه گردش انباری یافت نشد"
                subtitle="کلیه عملیات ورود به انبار، خروج دستی، تخصیص دستگاه به مشتری و بازگشت به انبار با تاریخ و ساعت دقیق در این جدول ثبت می‌شوند."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-base-content/75 border-b border-base-200">
                        <th>تاریخ</th>
                        <th>دستگاه</th>
                        <th>نوع</th>
                        <th>تعداد</th>
                        <th>مانده</th>
                        <th>مشتری</th>
                        <th>کارشناس</th>
                        <th>شرح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200/80">
                      {logs.map((log) => {
                        const meta = inventoryTypeMeta[log.type]
                        const isIncrease = meta.sign === '+'
                        return (
                          <tr key={log.id} className="transition-colors hover:bg-base-200/40 text-xs">
                            <td className="whitespace-nowrap text-base-content/70 font-medium">
                              {dateTimeFa(log.created_at)}
                            </td>
                            <td>
                              <p className="font-bold text-base-content">{log.part?.name || '—'}</p>
                              <p className="font-mono text-[10px] text-base-content/50">
                                {log.part?.code || ''}
                              </p>
                            </td>
                            <td>
                              <span className={cx('badge badge-xs font-bold', meta.badgeClass)}>
                                {meta.label}
                              </span>
                            </td>
                            <td>
                              <span
                                className={cx(
                                  'font-extrabold font-mono ltr-text inline-block',
                                  isIncrease ? 'text-emerald-600' : 'text-error',
                                )}
                              >
                                {meta.sign}
                                {num(log.quantity)}
                              </span>
                            </td>
                            <td className="font-bold">{num(log.balance_after)}</td>
                            <td>
                              {log.customer ? (
                                <Link
                                  to={`/customers/${log.customer.id}`}
                                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                                  title="مشاهده پرونده مشتری"
                                >
                                  {customerDisplayName(log.customer)}
                                  <ExternalLink className="size-3 shrink-0" />
                                </Link>
                              ) : (
                                <span className="text-base-content/40">—</span>
                              )}
                            </td>
                            <td className="text-base-content/75">{log.user?.name || 'سیستم'}</td>
                            <td
                              className="text-base-content/70 max-w-xs truncate"
                              title={log.description || ''}
                            >
                              {log.description || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {logsPageCount > 1 && (
                  <div className="border-t border-base-200 p-4">
                    <Pagination current={logPage} total={logsPageCount} onChange={setLogPage} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Device */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={editingPart ? 'ویرایش مشخصات مدل دستگاه' : 'تعریف مدل جدید در کاتالوگ و انبار دستگاه‌ها'}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="part-modal-form"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="loading loading-spinner loading-xs" />}
              {editingPart ? 'ذخیره تغییرات' : 'ثبت در کاتالوگ و انبار'}
            </button>
          </>
        }
      >
        <form id="part-modal-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="نام مدل دستگاه" required error={errors.name?.message}>
            <input
              className="input input-bordered w-full"
              placeholder="مثال: پمپ پیستونی هیدرولیک فشار قوی"
              {...register('name')}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="کد فنی یکتا (SKU)" required error={errors.code?.message}>
              <input
                dir="ltr"
                className="input input-bordered w-full text-start font-mono"
                placeholder="مثال: DEV-500"
                {...register('code', {
                  onChange: (e) => {
                    e.target.value = toEnDigits(e.target.value).replace(/[^a-zA-Z0-9\-_]/g, '')
                  },
                })}
              />
            </Field>

            <Field
              label="دوره پوشش گارانتی / سرویس (ماه)"
              required
              error={errors.periodic_service_months?.message}
            >
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered w-full text-start font-mono"
                placeholder="مثال: 12"
                {...register('periodic_service_months', {
                  onChange: (e) => {
                    e.target.value = toEnDigits(e.target.value).replace(/\D/g, '')
                  },
                })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="حد آستانه هشدار کمبود موجودی" hint="هشدار خودکار در داشبورد و انبار">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered w-full text-start font-mono"
                placeholder="مثال: 3"
                {...register('min_stock', {
                  onChange: (e) => {
                    e.target.value = toEnDigits(e.target.value).replace(/\D/g, '')
                  },
                })}
              />
            </Field>

            <Field label="واحد شمارش در انبار">
              <input
                className="input input-bordered w-full"
                placeholder="دستگاه / عدد / ست"
                {...register('unit')}
              />
            </Field>
          </div>

          <Field label="قیمت پایه فروش (تومان)" hint="هنگام تخصیص یا ثبت فروش به‌صورت خودکار پیشنهاد می‌شود">
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono font-bold"
              placeholder="مثال: 25,000,000"
              value={unitPriceVal || ''}
              onChange={(e) => setValue('unit_price', formatNumericInput(e.target.value))}
            />
          </Field>

          {!editingPart && (
            <Field
              label="موجودی اولیه در انبار (عدد)"
              hint="در صورت بیشتر از صفر بودن، به‌صورت خودکار لاگ ورود اولیه در انبار ثبت می‌گردد"
            >
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered w-full text-start font-mono font-bold"
                placeholder="0"
                {...register('stock_quantity', {
                  onChange: (e) => {
                    e.target.value = toEnDigits(e.target.value).replace(/\D/g, '')
                  },
                })}
              />
            </Field>
          )}

          <Field label="توضیحات و مشخصات فنی دستگاه">
            <textarea
              rows={3}
              className="textarea textarea-bordered w-full"
              placeholder="مشخصات عملکردی، توان، ابعاد و ملاحظات فنی دستگاه..."
              {...register('description')}
            />
          </Field>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" className="toggle toggle-primary toggle-sm" {...register('is_active')} />
              <span className="label-text font-bold text-xs">دستگاه فعال و قابل تخصیص به مشتریان است</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Modal: Manual Stock In / Out */}
      <Modal
        open={Boolean(stockTarget)}
        onClose={() => setStockTarget(null)}
        size="sm"
        title={`ثبت گردش انبار: ${stockTarget?.name || ''}`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setStockTarget(null)}>
              انصراف
            </button>
            <button
              type="submit"
              form="adjust-stock-form"
              disabled={adjustStockMutation.isPending}
              className={cx(
                'btn gap-1.5 font-bold',
                stockActionType === 'in' ? 'btn-success text-white' : 'btn-warning',
              )}
            >
              {adjustStockMutation.isPending && <span className="loading loading-spinner loading-xs" />}
              <PackagePlus className="size-4" />
              {stockActionType === 'in'
                ? 'ثبت ورود به انبار'
                : stockActionType === 'out_manual'
                  ? 'ثبت خروج از انبار'
                  : 'ثبت نتیجه انبارگردانی'}
            </button>
          </>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleStockSubmit} className="space-y-4">
          <div className="rounded-xl bg-base-200 p-3 text-xs flex items-center justify-between">
            <span>موجودی فعلی در انبار:</span>
            <b className="font-mono">{num(stockTarget?.stock_quantity ?? 0)} {stockTarget?.unit || 'عدد'}</b>
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-base-200 p-1.5">
            <button
              type="button"
              onClick={() => {
                setStockActionType('in')
                setStockQtyInput('1')
              }}
              className={cx(
                'flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition-all cursor-pointer',
                stockActionType === 'in'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-base-content/65 hover:text-base-content',
              )}
            >
              <ArrowDownCircle className="size-3.5" />
              ورود (+)
            </button>
            <button
              type="button"
              onClick={() => {
                setStockActionType('out_manual')
                setStockQtyInput('1')
              }}
              className={cx(
                'flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition-all cursor-pointer',
                stockActionType === 'out_manual'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-base-content/65 hover:text-base-content',
              )}
            >
              <ArrowUpCircle className="size-3.5" />
              خروج (-)
            </button>
            <button
              type="button"
              onClick={() => {
                setStockActionType('adjustment')
                setStockQtyInput(String(stockTarget?.stock_quantity ?? 0))
              }}
              className={cx(
                'flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition-all cursor-pointer',
                stockActionType === 'adjustment'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-base-content/65 hover:text-base-content',
              )}
            >
              <Boxes className="size-3.5" />
              انبارگردانی
            </button>
          </div>

          <Field
            label={
              stockActionType === 'in'
                ? 'تعداد ورودی به انبار (عدد)'
                : stockActionType === 'out_manual'
                  ? 'تعداد خروجی از انبار (عدد)'
                  : 'موجودی دقیق شمارش‌شده در انبار (عدد ۰ نیز مجاز است)'
            }
            required
          >
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono font-bold text-base"
              value={stockQtyInput}
              onChange={(e) => setStockQtyInput(toEnDigits(e.target.value).replace(/\D/g, ''))}
              placeholder="1"
              autoFocus
              required
            />
          </Field>

          <Field label="شرح یا شماره حواله انبار (اختیاری)">
            <textarea
              rows={2}
              className="textarea textarea-bordered w-full text-xs"
              value={stockDesc}
              onChange={(e) => setStockDesc(e.target.value)}
              placeholder={
                stockActionType === 'in'
                  ? 'مثال: خرید پارت جدید، رسید تولید کارخانه...'
                  : 'مثال: ارسال نمونه نمایشگاهی، کسری انبارگردانی...'
              }
            />
          </Field>
        </form>
      </Modal>

      {/* Confirm Delete Device Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPart)}
        onClose={() => setDeletingPart(null)}
        onConfirm={() => deletingPart && deleteMutation.mutate(deletingPart.id)}
        title="حذف دستگاه از کاتالوگ"
        message={`آیا از حذف مدل دستگاه «${deletingPart?.name}» اطمینان دارید؟`}
        confirmText="بله، حذف کن"
        tone="error"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
