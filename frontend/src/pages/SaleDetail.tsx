import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  CalendarDays,
  Cpu,
  FilePlus2,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  User,
} from 'lucide-react'
import { EmptyState, PageSkeleton } from '../components/ui/Field'
import { ConfirmDialog } from '../components/ui/Modal'
import { Can } from '../components/common/Can'
import { SaleFormModal } from '../components/sales/SaleFormModal'
import { invoiceApi, salesApi } from '../services/sales'
import { customerDisplayName, cx, dateFa, digits, num, toman } from '../utils/format'
import { invoiceStatusMeta, paymentStatusMeta, saleStatusMeta } from '../utils/meta'

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => salesApi.get(id!),
    enabled: Boolean(id),
  })

  const generateInvoiceMutation = useMutation({
    mutationFn: () => invoiceApi.generate(sale!.id),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['sale', id] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-summary'] })
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در صدور فاکتور')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => salesApi.cancel(sale!.id),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sales-summary'] })
      qc.invalidateQueries({ queryKey: ['sales-charts'] })
      nav('/sales')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'خطا در لغو فروش')
    },
  })

  if (isLoading) return <PageSkeleton />
  if (error || !sale) {
    return (
      <EmptyState
        title="سند فروش یافت نشد"
        subtitle="ممکن است این رکورد حذف شده یا خارج از محدوده دسترسی شما باشد."
        action={
          <Link to="/sales" className="btn btn-primary btn-sm">
            بازگشت به فهرست فروش‌ها
          </Link>
        }
      />
    )
  }

  const sMeta = saleStatusMeta[sale.status]
  const pMeta = paymentStatusMeta[sale.payment_status]
  const remaining = Math.max(0, sale.total - sale.paid_amount)
  const isCancelled = sale.status === 'cancelled'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/sales"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/60 hover:text-primary"
        >
          <ArrowRight className="size-4" /> بازگشت به گزارش و لیست فروش‌ها
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {sale.active_invoice ? (
            <Link
              to={`/invoices/${sale.active_invoice.id}/print`}
              className="btn btn-sm btn-primary gap-1.5"
            >
              <Printer className="size-4" />
              مشاهده و چاپ فاکتور ({digits(sale.active_invoice.number)})
            </Link>
          ) : (
            !isCancelled && (
              <Can permission="sales.create">
                <button
                  type="button"
                  className="btn btn-sm btn-primary gap-1.5"
                  onClick={() => generateInvoiceMutation.mutate()}
                  disabled={generateInvoiceMutation.isPending}
                >
                  <FilePlus2 className="size-4" />
                  صدور فاکتور رسمی
                </button>
              </Can>
            )
          )}

          {!isCancelled && (
            <Can permission="sales.create">
              <button
                type="button"
                className="btn btn-sm btn-outline gap-1.5"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                ویرایش فروش
              </button>
            </Can>
          )}

          {!isCancelled && (
            <Can permission="sales.manage">
              <button
                type="button"
                className="btn btn-sm btn-ghost text-error gap-1.5"
                onClick={() => setCancelOpen(true)}
              >
                <Trash2 className="size-4" />
                لغو فروش
              </button>
            </Can>
          )}
        </div>
      </div>

      {/* Header Summary Card */}
      <div className="rounded-2xl border border-base-200 bg-base-100 p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold">سفارش فروش #{num(sale.id)}</h1>
              <span className={cx('badge badge-sm font-bold', sMeta.badgeClass)}>{sMeta.label}</span>
              <span className={cx('badge badge-sm font-bold', pMeta.badgeClass)}>{pMeta.label}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-base-content/70">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-primary" />
                تاریخ فروش: {dateFa(sale.sale_date)}
              </span>
              {sale.seller && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  کارشناس فروش: {sale.seller.name}
                </span>
              )}
            </div>
          </div>

          <div className="text-start sm:text-end">
            <p className="text-xs text-base-content/60">مبلغ کل فروش</p>
            <p className="text-2xl font-extrabold text-primary">{toman(sale.total)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Items & Totals */}
        <div className="lg:col-span-8 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
            <div className="border-b border-base-200 px-5 py-3.5 flex items-center gap-2 font-bold text-sm">
              <Cpu className="size-4 text-primary" /> اقلام و دستگاه‌های فروخته‌شده
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="bg-base-200/50 text-xs">
                    <th>دستگاه</th>
                    <th>سریال / کد</th>
                    <th>تعداد</th>
                    <th>قیمت واحد</th>
                    <th>تخفیف</th>
                    <th>جمع</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items ?? []).map((item) => (
                    <tr key={item.id} className="text-xs">
                      <td className="font-bold">{item.part?.name || '—'}</td>
                      <td className="font-mono ltr-text">
                        {item.customer_part?.serial_number || item.part?.code || '—'}
                      </td>
                      <td className="font-bold">{num(item.quantity)}</td>
                      <td>{toman(item.unit_price)}</td>
                      <td>{item.discount_amount > 0 ? toman(item.discount_amount) : '—'}</td>
                      <td className="font-extrabold">{toman(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-base-200 bg-base-200/30 p-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-base-content/70">جمع جزء اقلام:</span>
                <span className="font-bold">{toman(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">تخفیف کل فروش:</span>
                <span className="font-bold text-emerald-600">− {toman(sale.discount_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">مالیات بر ارزش افزوده ({num(sale.tax_percent)}٪):</span>
                <span className="font-bold">{toman(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-base-300 pt-2 text-sm font-extrabold">
                <span>مبلغ نهایی:</span>
                <span>{toman(sale.total)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                <span>مبلغ پرداخت‌شده:</span>
                <span>{toman(sale.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                <span>مانده قابل وصول:</span>
                <span>{toman(remaining)}</span>
              </div>
            </div>
          </div>

          {sale.notes && (
            <div className="rounded-2xl border border-base-200 bg-base-100 p-5 text-xs">
              <p className="font-bold mb-1.5 text-base-content/80">توضیحات و شرایط فروش</p>
              <p className="text-base-content/70 leading-relaxed whitespace-pre-line">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* Customer & Invoice Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-sm border-b border-base-200 pb-2.5">اطلاعات مشتری</h3>
            {sale.customer ? (
              <>
                <p className="font-extrabold text-sm text-primary">
                  <Link to={`/customers/${sale.customer.id}`} className="hover:underline">
                    {customerDisplayName(sale.customer)}
                  </Link>
                </p>
                {sale.customer.mobile && (
                  <p className="text-base-content/70">
                    موبایل: <span className="font-mono ltr-text">{sale.customer.mobile}</span>
                  </p>
                )}
                {(sale.customer.province || sale.customer.city) && (
                  <p className="text-base-content/70">
                    موقعیت: {[sale.customer.province, sale.customer.city].filter(Boolean).join('، ')}
                  </p>
                )}
                <Link
                  to={`/customers/${sale.customer.id}`}
                  className="btn btn-xs btn-outline w-full mt-2"
                >
                  مشاهده پرونده کامل مشتری
                </Link>
              </>
            ) : (
              <p className="text-base-content/50">اطلاعات مشتری در دسترس نیست.</p>
            )}
          </div>

          <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-sm border-b border-base-200 pb-2.5 flex items-center gap-1.5">
              <Receipt className="size-4 text-primary" /> تاریخچه فاکتورهای این فروش
            </h3>

            {!sale.invoices?.length ? (
              <p className="text-base-content/60 py-2">هنوز فاکتوری برای این فروش صادر نشده است.</p>
            ) : (
              <div className="space-y-2">
                {sale.invoices.map((inv) => {
                  const invMeta = invoiceStatusMeta[inv.status]
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl border border-base-200 p-3"
                    >
                      <div>
                        <p className="font-mono font-bold text-xs">{digits(inv.number)}</p>
                        <p className="text-[11px] text-base-content/60">صدور: {dateFa(inv.issued_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cx('badge badge-xs font-bold', invMeta.badgeClass)}>
                          {invMeta.label}
                        </span>
                        <Link
                          to={`/invoices/${inv.id}/print`}
                          className="btn btn-ghost btn-xs btn-square"
                          title="چاپ فاکتور"
                        >
                          <Printer className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <SaleFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editingSale={sale}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['sale', id] })}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        loading={cancelMutation.isPending}
        title="لغو سفارش فروش"
        message={`آیا از لغو سفارش فروش #${num(sale.id)} اطمینان دارید؟`}
        confirmText="لغو فروش"
        danger
      />
    </div>
  )
}
