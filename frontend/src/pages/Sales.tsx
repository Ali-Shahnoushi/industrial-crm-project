import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, BadgeCheck, Clock, Download, Plus, Receipt, Trash2, Wallet } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { SearchInput } from '../components/ui/SearchInput'
import { Pagination } from '../components/ui/Pagination'
import { Avatar } from '../components/ui/Avatar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { DatePicker } from '../components/ui/DatePicker'
import { EmptyState, Field, TableSkeleton } from '../components/ui/Field'
import { useList, useLookup, useUpdate } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { createOne, patchOne } from '../services/api'
import { downloadCsv } from '../utils/csv'
import { inWindow, paid, sum } from '../utils/analytics'
import { PAYMENT_METHODS, invoiceStatus } from '../utils/meta'
import { compactToman, cx, dateFa, dateShort, fullName, num, toman } from '../utils/format'
import type { InvoiceStatus, Sale } from '../types'

const PAGE_SIZE = 10
const STATUS_TABS: { id: InvoiceStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'paid', label: 'پرداخت‌شده' },
  { id: 'pending', label: 'در انتظار' },
  { id: 'overdue', label: 'سررسید گذشته' },
  { id: 'cancelled', label: 'لغو شده' },
]

export default function Sales() {
  const [params, setParams] = useSearchParams()
  const { data: sales, isLoading } = useList('sales')
  const { map: customers } = useLookup('customers')
  const { map: users } = useLookup('users')
  const update = useUpdate('sales')

  const [q, setQ] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [method, setMethod] = useState('all')
  const [page, setPage] = useState(1)
  const [openNew, setOpenNew] = useState(false)
  const [selected, setSelected] = useState<Sale | null>(null)

  useEffect(() => {
    if (params.get('new')) { setOpenNew(true); setParams({}, { replace: true }) }
  }, [params, setParams])

  const stats = useMemo(() => {
    const cur = paid(inWindow(sales, 30))
    return {
      revenue: sum(cur),
      count: cur.length,
      pending: sum(sales.filter((s) => s.status === 'pending')),
      overdue: sum(sales.filter((s) => s.status === 'overdue')),
      overdueCount: sales.filter((s) => s.status === 'overdue').length,
    }
  }, [sales])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return sales
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => method === 'all' || s.paymentMethod === method)
      .filter((s) => {
        if (!t) return true
        const c = customers.get(s.customerId)
        return `${s.number} ${c ? fullName(c) + ' ' + c.company : ''}`.toLowerCase().includes(t)
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  }, [sales, status, method, q, customers])

  const safePage = Math.min(page, Math.ceil(filtered.length / PAGE_SIZE) || 1)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const counts = (id: InvoiceStatus | 'all') => (id === 'all' ? sales.length : sales.filter((s) => s.status === id).length)

  const exportCsv = () =>
    downloadCsv(
      `nikan-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((s) => {
        const c = customers.get(s.customerId)
        return {
          'شماره فاکتور': s.number,
          تاریخ: dateShort(s.date),
          مشتری: c ? fullName(c) : '',
          'مبلغ (تومان)': s.total,
          وضعیت: invoiceStatus[s.status].label,
          'روش پرداخت': s.paymentMethod,
          فروشنده: users.get(s.userId)?.name ?? '',
        }
      }),
    )

  const setInvoiceStatus = (s: Sale, st: InvoiceStatus) =>
    update.mutate({ id: s.id, status: st }, { onSuccess: () => { setSelected({ ...s, status: st }); toast.success(`وضعیت فاکتور به «${invoiceStatus[st].label}» تغییر کرد`) } })

  return (
    <>
      <PageHeader
        title="فروش‌ها"
        subtitle="ثبت و پیگیری فاکتورها و پرداخت‌ها"
        actions={<>
          <button className="btn btn-sm" onClick={exportCsv} disabled={!filtered.length}><Download className="size-4" /> اکسپورت</button>
          <button className="btn btn-sm btn-primary" onClick={() => setOpenNew(true)}><Plus className="size-4" /> فاکتور جدید</button>
        </>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="فروش ۳۰ روز اخیر" value={compactToman(stats.revenue)} icon={Wallet} tone="primary" loading={isLoading} />
        <StatCard title="فاکتورهای پرداخت‌شده" value={num(stats.count)} icon={BadgeCheck} tone="success" hint="۳۰ روز اخیر" loading={isLoading} />
        <StatCard title="در انتظار پرداخت" value={compactToman(stats.pending)} icon={Clock} tone="warning" loading={isLoading} />
        <StatCard title="مطالبات سررسید گذشته" value={compactToman(stats.overdue)} icon={AlertTriangle} tone="error" hint={`${num(stats.overdueCount)} فاکتور`} loading={isLoading} />
      </div>

      <section className="card-surface mt-4 overflow-hidden">
        <div className="space-y-3 p-4">
          <div role="tablist" className="tabs tabs-box w-full overflow-x-auto sm:w-fit">
            {STATUS_TABS.map((t) => (
              <button key={t.id} role="tab" className={cx('tab whitespace-nowrap', status === t.id && 'tab-active')} onClick={() => { setStatus(t.id); setPage(1) }}>
                {t.label}<span className="badge badge-xs badge-ghost ms-1.5">{num(counts(t.id))}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="جستجوی شماره فاکتور یا مشتری..." className="sm:max-w-sm" />
            <select className="select select-sm h-10 w-full sm:w-auto" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} aria-label="روش پرداخت">
              <option value="all">همه روش‌های پرداخت</option>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>شماره</th><th>مشتری</th><th className="hidden md:table-cell">تاریخ</th><th className="hidden lg:table-cell">روش پرداخت</th><th className="hidden xl:table-cell">فروشنده</th><th>مبلغ</th><th>وضعیت</th></tr>
            </thead>
            <tbody>
              {isLoading && <TableSkeleton rows={8} cols={5} />}
              {rows.map((s) => {
                const c = customers.get(s.customerId)
                const seller = users.get(s.userId)
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-base-200/50" onClick={() => setSelected(s)}>
                    <td className="ltr-text font-semibold">{s.number}</td>
                    <td>{c ? <span className="flex items-center gap-2"><Avatar name={fullName(c)} size="xs" /><span className="truncate">{fullName(c)}</span></span> : '—'}</td>
                    <td className="hidden whitespace-nowrap text-sm md:table-cell">{dateFa(s.date)}</td>
                    <td className="hidden text-sm lg:table-cell">{s.paymentMethod}</td>
                    <td className="hidden text-sm xl:table-cell">{seller?.name}</td>
                    <td className="whitespace-nowrap font-semibold">{compactToman(s.total)}</td>
                    <td><StatusBadge meta={invoiceStatus[s.status]} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!isLoading && !rows.length && <EmptyState title="فاکتوری یافت نشد" description="فیلترها را تغییر دهید یا فاکتور جدید ثبت کنید." />}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
      </section>

      <InvoiceModal sale={selected} onClose={() => setSelected(null)} onStatus={setInvoiceStatus} busy={update.isPending} />
      <NewInvoiceModal open={openNew} onClose={() => setOpenNew(false)} sales={sales} />
    </>
  )
}

function InvoiceModal({ sale, onClose, onStatus, busy }: { sale: Sale | null; onClose: () => void; onStatus: (s: Sale, st: InvoiceStatus) => void; busy: boolean }) {
  const { map: customers } = useLookup('customers')
  const { map: users } = useLookup('users')
  const c = sale && customers.get(sale.customerId)
  const subtotal = sale ? sale.items.reduce((t, i) => t + i.quantity * i.price, 0) : 0

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      size="lg"
      title={sale ? `فاکتور ${sale.number}` : ''}
      footer={sale && (
        <>
          {(sale.status === 'pending' || sale.status === 'overdue') && (
            <button className="btn btn-success" disabled={busy} onClick={() => onStatus(sale, 'paid')}><BadgeCheck className="size-4" /> ثبت پرداخت</button>
          )}
          {sale.status !== 'cancelled' && sale.status !== 'paid' && (
            <button className="btn btn-error btn-soft" disabled={busy} onClick={() => onStatus(sale, 'cancelled')}>لغو فاکتور</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>بستن</button>
        </>
      )}
    >
      {sale && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-base-content/50">مشتری</p>{c ? <Link className="font-semibold hover:text-primary" to={`/customers/${c.id}`}>{fullName(c)}</Link> : '—'}</div>
            <div><p className="text-xs text-base-content/50">تاریخ</p><p className="font-semibold">{dateFa(sale.date)}</p></div>
            <div><p className="text-xs text-base-content/50">فروشنده</p><p className="font-semibold">{users.get(sale.userId)?.name}</p></div>
            <div><p className="text-xs text-base-content/50">وضعیت</p><StatusBadge meta={invoiceStatus[sale.status]} /></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-sm">
              <thead className="bg-base-200"><tr><th>کالا</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead>
              <tbody>
                {sale.items.map((i, idx) => (
                  <tr key={idx}><td>{i.name}</td><td>{num(i.quantity)}</td><td className="whitespace-nowrap">{toman(i.price)}</td><td className="whitespace-nowrap font-semibold">{toman(i.quantity * i.price)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ms-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-base-content/60">جمع کل</dt><dd>{toman(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-base-content/60">تخفیف</dt><dd className="text-error">{sale.discount ? `−${toman(sale.discount)}` : '—'}</dd></div>
            <div className="flex justify-between border-t border-base-300 pt-2 text-base font-extrabold"><dt>مبلغ نهایی</dt><dd className="text-primary">{toman(sale.total)}</dd></div>
            <div className="flex justify-between text-xs text-base-content/50"><dt>روش پرداخت</dt><dd>{sale.paymentMethod}</dd></div>
          </dl>
        </div>
      )}
    </Modal>
  )
}

interface Line { productId: string; quantity: number }

function NewInvoiceModal({ open, onClose, sales }: { open: boolean; onClose: () => void; sales: Sale[] }) {
  const me = useAuthStore((s) => s.user)!
  const qc = useQueryClient()
  const { data: customers } = useList('customers')
  const { data: products } = useList('products')
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: 1 }])
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState(PAYMENT_METHODS[0])
  const [status, setStatus] = useState<InvoiceStatus>('paid')
  const [date, setDate] = useState(new Date().toISOString())
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const valid = lines.filter((l) => l.productId && l.quantity > 0)
  const subtotal = valid.reduce((t, l) => t + (byId.get(l.productId)?.price ?? 0) * l.quantity, 0)
  const disc = Math.min(Number(discount.replace(/\D/g, '')) || 0, subtotal)
  const total = subtotal - disc
  const overStock = valid.find((l) => l.quantity > (byId.get(l.productId)?.stock ?? 0))

  const updateLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const submit = async () => {
    setTouched(true)
    if (!customerId || !valid.length) return
    setBusy(true)
    try {
      const maxNo = Math.max(1000, ...sales.map((s) => Number(s.number.replace(/\D/g, '')) || 0))
      const items = valid.map((l) => { const p = byId.get(l.productId)!; return { productId: p.id, name: p.name, quantity: l.quantity, price: p.price } })
      await createOne('sales', { number: `INV-${maxNo + 1}`, date, customerId, userId: me.id, status, paymentMethod: method, items, discount: disc, total })
      // keep inventory in sync: decrement stock and log a movement for each line
      await Promise.all(
        valid.flatMap((l) => {
          const p = byId.get(l.productId)!
          return [
            patchOne('products', p.id, { stock: Math.max(0, p.stock - l.quantity) }),
            createOne('stockMovements', { productId: p.id, type: 'out', quantity: l.quantity, date, userId: me.id, note: `خروج بابت فاکتور INV-${maxNo + 1}` }),
          ]
        }),
      )
      await Promise.all(['sales', 'products', 'stockMovements', 'customers'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
      toast.success(`فاکتور INV-${maxNo + 1} با موفقیت ثبت شد`)
      setCustomerId(''); setLines([{ productId: '', quantity: 1 }]); setDiscount(''); setTouched(false)
      onClose()
    } catch {
      toast.error('خطا در ثبت فاکتور')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title="ثبت فاکتور جدید"
      footer={<><button className="btn btn-ghost" onClick={onClose}>انصراف</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy && <span className="loading loading-spinner loading-xs" />}ثبت فاکتور</button></>}>
      <div className="grid grid-cols-1 gap-x-4 lg:grid-cols-2">
        <Field label="مشتری" required error={touched && !customerId ? 'مشتری را انتخاب کنید' : undefined}>
          <select className="select w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">انتخاب مشتری...</option>
            {[...customers].sort((a, b) => fullName(a).localeCompare(fullName(b), 'fa')).map((c) => <option key={c.id} value={c.id}>{fullName(c)}{c.company ? ` — ${c.company}` : ''}</option>)}
          </select>
        </Field>
        <Field label="تاریخ فاکتور"><DatePicker value={date} onChange={(v) => v && setDate(v)} /></Field>
      </div>

      <div className="mt-2">
        <p className="fieldset-legend mb-1 text-sm font-medium">اقلام فاکتور <span className="text-error">*</span></p>
        <div className="space-y-2">
          {lines.map((l, i) => {
            const p = byId.get(l.productId)
            return (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2 sm:grid-cols-[1fr_6rem_9rem_auto]">
                <select className="select select-sm h-10 w-full" value={l.productId} onChange={(e) => updateLine(i, { productId: e.target.value })} aria-label="کالا">
                  <option value="">انتخاب کالا...</option>
                  {products.map((pr) => <option key={pr.id} value={pr.id} disabled={pr.stock === 0}>{pr.name} {pr.stock === 0 ? '(ناموجود)' : `(${num(pr.stock)} ${pr.unit})`}</option>)}
                </select>
                <input type="number" min={1} className="input input-sm h-10 w-full" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} aria-label="تعداد" />
                <span className="hidden text-end text-sm font-semibold sm:block">{p ? compactToman(p.price * l.quantity) : '—'}</span>
                <button className="btn btn-ghost btn-sm btn-circle text-error" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} aria-label="حذف ردیف"><Trash2 className="size-4" /></button>
              </div>
            )
          })}
        </div>
        <button className="btn btn-ghost btn-sm mt-2 text-primary" onClick={() => setLines((ls) => [...ls, { productId: '', quantity: 1 }])}><Plus className="size-4" /> افزودن ردیف</button>
        {touched && !valid.length && <p className="label text-error">حداقل یک کالا انتخاب کنید</p>}
        {overStock && <p className="mt-1 flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> تعداد «{overStock.productId && byId.get(overStock.productId)?.name}» بیشتر از موجودی انبار است؛ موجودی صفر می‌شود.</p>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-4 sm:grid-cols-3">
        <Field label="تخفیف (تومان)"><input dir="ltr" inputMode="numeric" className="input w-full text-start" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="۰" /></Field>
        <Field label="روش پرداخت"><select className="select w-full" value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="وضعیت"><select className="select w-full" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>{(['paid', 'pending'] as const).map((s) => <option key={s} value={s}>{invoiceStatus[s].label}</option>)}</select></Field>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold"><Receipt className="size-4 text-primary" /> مبلغ نهایی</span>
        <span className="text-lg font-extrabold text-primary">{toman(total)}</span>
      </div>
    </Modal>
  )
}
