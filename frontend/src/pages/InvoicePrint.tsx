import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Printer } from 'lucide-react'
import { EmptyState, PageSkeleton } from '../components/ui/Field'
import { invoiceApi } from '../services/sales'
import { customerDisplayName, dateFa, digits, num, toman } from '../utils/format'
import { invoiceStatusMeta } from '../utils/meta'

export default function InvoicePrint() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceApi.get(id!),
    enabled: Boolean(id),
  })

  if (isLoading) return <PageSkeleton />
  if (error || !data?.invoice) {
    return (
      <EmptyState
        title="فاکتور یافت نشد"
        subtitle="شماره فاکتور نامعتبر است یا خارج از محدوده دسترسی شماست."
        action={
          <Link to="/finance" className="btn btn-primary btn-sm">
            بازگشت به امور مالی
          </Link>
        }
      />
    )
  }

  const { invoice, company } = data
  const sale = invoice.sale
  const customer = sale?.customer
  const meta = invoiceStatusMeta[invoice.status]
  const remaining = sale ? Math.max(0, sale.total - sale.paid_amount) : 0

  return (
    <div className="space-y-4">
      {/* Toolbar hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/finance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/60 hover:text-primary"
        >
          <ArrowRight className="size-4" /> بازگشت به فهرست فاکتورها
        </Link>

        <div className="flex items-center gap-2">
          {sale && (
            <Link to={`/sales/${sale.id}`} className="btn btn-sm btn-ghost border border-base-300">
              مشاهده سفارش #{num(sale.id)}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            چاپ / ذخیره PDF
          </button>
        </div>
      </div>

      {/* Printable A4 Sheet */}
      <div
        dir="rtl"
        className="mx-auto max-w-4xl rounded-2xl border border-base-300 bg-white p-8 text-slate-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-4 print:shadow-none"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-200 pb-6">
          <div className="flex items-center gap-4">
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name || 'لوگو'}
                className="size-16 rounded-xl border border-slate-200 object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {company.name || 'سامانه مدیریت مشتریان و تجهیزات صنعتی'}
              </h1>
              <p className="mt-1 text-sm font-bold text-indigo-700">صورتحساب فروش کالا و تجهیزات</p>
            </div>
          </div>

          <div className="space-y-1 text-xs sm:text-end">
            <p>
              <span className="text-slate-500">شماره فاکتور:</span>{' '}
              <span className="font-mono font-extrabold text-sm">{digits(invoice.number)}</span>
            </p>
            <p>
              <span className="text-slate-500">تاریخ صدور:</span>{' '}
              <span className="font-bold">{dateFa(invoice.issued_at)}</span>
            </p>
            <p>
              <span className="text-slate-500">وضعیت:</span>{' '}
              <span className="font-bold">{meta.label}</span>
            </p>
          </div>
        </div>

        {/* Buyer & Seller Info */}
        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-extrabold text-slate-700">مشخصات خریدار</p>
            <p className="font-bold text-sm">{customer ? customerDisplayName(customer) : '—'}</p>
            {customer?.national_code && (
              <p className="text-slate-600">کد ملی / شناسه ملی: {digits(customer.national_code)}</p>
            )}
            {customer?.mobile && (
              <p className="text-slate-600">تلفن همراه: {digits(customer.mobile)}</p>
            )}
            {(customer?.province || customer?.city || customer?.address) && (
              <p className="text-slate-600">
                نشانی: {[customer?.province, customer?.city, customer?.address].filter(Boolean).join('، ')}
              </p>
            )}
          </div>

          <div className="space-y-1 sm:text-end">
            <p className="font-extrabold text-slate-700">مشخصات فروشنده / کارشناس</p>
            <p className="font-bold">{company.name || 'واحد فروش صنعتی'}</p>
            {sale?.seller && <p className="text-slate-600">کارشناس مسئول: {sale.seller.name}</p>}
            {sale && <p className="text-slate-600">تاریخ ثبت سفارش: {dateFa(sale.sale_date)}</p>}
          </div>
        </div>

        {/* Items Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y-2 border-slate-300 bg-slate-100 text-slate-700">
                <th className="p-3 text-start">ردیف</th>
                <th className="p-3 text-start">شرح کالا / مدل دستگاه</th>
                <th className="p-3 text-start">کد فنی / سریال</th>
                <th className="p-3 text-center">تعداد</th>
                <th className="p-3 text-end">مبلغ واحد (تومان)</th>
                <th className="p-3 text-end">تخفیف</th>
                <th className="p-3 text-end">جمع کل (تومان)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(sale?.items ?? []).map((item, idx) => (
                <tr key={item.id}>
                  <td className="p-3 font-bold">{num(idx + 1)}</td>
                  <td className="p-3 font-bold">{item.part?.name || '—'}</td>
                  <td className="p-3 font-mono text-[11px]">
                    {item.customer_part?.serial_number || item.part?.code || '—'}
                  </td>
                  <td className="p-3 text-center font-bold">
                    {num(item.quantity)} {item.part?.unit || 'دستگاه'}
                  </td>
                  <td className="p-3 text-end font-mono">{num(item.unit_price)}</td>
                  <td className="p-3 text-end font-mono">
                    {item.discount_amount > 0 ? num(item.discount_amount) : '۰'}
                  </td>
                  <td className="p-3 text-end font-mono font-bold">{num(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        {sale && (
          <div className="mt-6 flex flex-col items-end">
            <div className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">جمع کل اقلام:</span>
                <span className="font-bold">{toman(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>تخفیف فاکتور:</span>
                  <span className="font-bold">− {toman(sale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">مالیات بر ارزش افزوده ({num(sale.tax_percent)}٪):</span>
                <span className="font-bold">{toman(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-slate-900">
                <span>مبلغ قابل پرداخت:</span>
                <span>{toman(sale.total)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>پرداخت‌شده:</span>
                <span className="font-bold">{toman(sale.paid_amount)}</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>مانده حساب:</span>
                  <span>{toman(remaining)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {sale?.notes && (
          <div className="mt-6 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
            <span className="font-bold">توضیحات: </span>
            {sale.notes}
          </div>
        )}

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-600">
          <div>
            <p className="font-bold">مهر و امضای فروشنده</p>
            <div className="mt-12 border-b border-dashed border-slate-300 mx-8" />
          </div>
          <div>
            <p className="font-bold">مهر و امضای خریدار</p>
            <div className="mt-12 border-b border-dashed border-slate-300 mx-8" />
          </div>
        </div>
      </div>
    </div>
  )
}
