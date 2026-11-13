import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  Printer,
  Receipt,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { SearchInput } from '../components/ui/SearchInput'
import { DatePicker } from '../components/ui/DatePicker'
import { Pagination } from '../components/ui/Pagination'
import { ConfirmDialog } from '../components/ui/Modal'
import { EmptyState, TableSkeleton } from '../components/ui/Field'
import { Can } from '../components/common/Can'
import { invoiceApi, salesApi } from '../services/sales'
import {
  compactToman,
  customerDisplayName,
  cx,
  dateShort,
  digits,
  num,
  toEnDigits,
  toman,
} from '../utils/format'
import { invoiceStatusMeta, paymentStatusMeta } from '../utils/meta'
import type { Invoice } from '../types/sales'

export default function Finance() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'invoices'>('pending')

  // Issued Invoices filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState<string | null>(null)
  const [toDate, setToDate] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pendingPage, setPendingPage] = useState(1)
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null)

  const { data: invSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['invoice-summary'],
    queryFn: invoiceApi.summary,
  })

  const { data: uninvoicedSales, isLoading: pendingLoading } = useQuery({
    queryKey: ['uninvoiced-sales', pendingPage],
    queryFn: () =>
      salesApi.list({
        uninvoiced_only: true,
        status: 'confirmed',
        page: pendingPage,
        per_page: 15,
      }),
  })

  const { data: invoicesPage, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', q, statusFilter, fromDate, toDate, page],
    queryFn: () =>
      invoiceApi.list({
        q: q.trim() || undefined,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        per_page: 15,
      }),
  })

  const generateMutation = useMutation({
    mutationFn: (saleId: number) => invoiceApi.generate(saleId),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['invoice-summary'] })
      qc.invalidateQueries({ queryKey: ['uninvoiced-sales'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در صدور خودکار فاکتور')
    },
  })

  const voidMutation = useMutation({
    mutationFn: (id: number) => invoiceApi.void(id),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['invoice-summary'] })
      qc.invalidateQueries({ queryKey: ['uninvoiced-sales'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      setVoidTarget(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'خطا در ابطال فاکتور')
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="امور مالی و صدور فاکتورها"
        subtitle="صدور خودکار فاکتور با شماره‌گذاری یکتای سالانه، مشاهده وضعیت تسویه و چاپ یا ذخیره PDF فاکتور"
        actions={
          <Link to="/sales" className="btn btn-sm btn-outline">
            مشاهده داشبورد فروش
          </Link>
        }
      />

      {/* Finance KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="فروش‌های در انتظار فاکتور"
          value={`${num(invSummary?.uninvoiced_sales_count ?? 0)} مورد`}
          icon={Clock}
          tone={(invSummary?.uninvoiced_sales_count ?? 0) > 0 ? 'warning' : 'success'}
          hint={
            invSummary
              ? `جمع مبالغ: ${compactToman(invSummary.uninvoiced_sales_total)}`
              : undefined
          }
          loading={summaryLoading}
        />
        <StatCard
          title="فاکتورهای صادرشده (در انتظار تسویه)"
          value={`${num(invSummary?.issued_count ?? 0)} فاکتور`}
          icon={Receipt}
          tone="info"
          loading={summaryLoading}
        />
        <StatCard
          title="فاکتورهای تسویه‌شده"
          value={`${num(invSummary?.paid_count ?? 0)} فاکتور`}
          icon={CheckCircle2}
          tone="success"
          loading={summaryLoading}
        />
        <StatCard
          title="کل مبلغ فاکتورشده"
          value={compactToman(invSummary?.total_invoiced_amount ?? 0)}
          icon={Wallet}
          tone="primary"
          hint={invSummary ? `${num(invSummary.void_count)} فاکتور باطل‌شده` : undefined}
          loading={summaryLoading}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-base-200">
        <div role="tablist" className="tabs tabs-border">
          <button
            type="button"
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', tab === 'pending' && 'tab-active')}
            onClick={() => setTab('pending')}
          >
            <FilePlus2 className="size-4" />
            صدور خودکار فاکتور ({num(invSummary?.uninvoiced_sales_count ?? 0)})
          </button>
          <button
            type="button"
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', tab === 'invoices' && 'tab-active')}
            onClick={() => setTab('invoices')}
          >
            <Receipt className="size-4" />
            فهرست فاکتورهای صادرشده ({num(invoicesPage?.total ?? 0)})
          </button>
        </div>
      </div>

      {tab === 'pending' ? (
        <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
          {pendingLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : !(uninvoicedSales?.data?.length ?? 0) ? (
            <EmptyState
              title="همه فروش‌های تاییدشده دارای فاکتور هستند"
              subtitle="هر فروش جدیدی که بدون شماره فاکتور ثبت شود در اینجا برای صدور خودکار نمایش داده می‌شود."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table table-hover">
                  <thead>
                    <tr className="border-b border-base-200 bg-slate-50 text-xs font-bold dark:bg-slate-900/60">
                      <th>شناسه فروش</th>
                      <th>تاریخ فروش</th>
                      <th>مشتری</th>
                      <th>اقلام</th>
                      <th>مبلغ نهایی</th>
                      <th>وضعیت پرداخت</th>
                      <th className="text-end">صدور فاکتور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uninvoicedSales!.data.map((sale) => {
                      const pMeta = paymentStatusMeta[sale.payment_status]
                      return (
                        <tr key={sale.id} className="text-xs">
                          <td className="font-mono font-bold">
                            <Link to={`/sales/${sale.id}`} className="text-primary hover:underline">
                              #{num(sale.id)}
                            </Link>
                          </td>
                          <td>{dateShort(sale.sale_date)}</td>
                          <td className="font-bold">
                            {sale.customer ? customerDisplayName(sale.customer) : '—'}
                          </td>
                          <td>
                            {sale.items?.[0]?.part?.name || '—'} (×
                            {num(sale.items?.reduce((s, i) => s + i.quantity, 0) ?? 0)})
                          </td>
                          <td className="font-extrabold">{toman(sale.total)}</td>
                          <td>
                            <span className={cx('badge badge-xs font-bold', pMeta.badgeClass)}>
                              {pMeta.label}
                            </span>
                          </td>
                          <td className="text-end">
                            <Can permission="sales.create">
                              <button
                                type="button"
                                className="btn btn-xs btn-primary gap-1.5"
                                onClick={() => generateMutation.mutate(sale.id)}
                                disabled={generateMutation.isPending}
                              >
                                <FilePlus2 className="size-3.5" />
                                ایجاد خودکار فاکتور
                              </button>
                            </Can>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={uninvoicedSales!.current_page}
                pageSize={uninvoicedSales!.per_page}
                total={uninvoicedSales!.total}
                onPage={setPendingPage}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-base-200 bg-base-100 p-3.5 shadow-xs">
            <div className="w-full sm:w-64">
              <SearchInput
                value={q}
                onChange={(val) => {
                  setQ(toEnDigits(val))
                  setPage(1)
                }}
                placeholder="شماره فاکتور یا نام مشتری..."
              />
            </div>

            <select
              className="select select-bordered select-sm text-xs"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="issued">صادر شده</option>
              <option value="paid">تسویه‌شده</option>
              <option value="void">باطل‌شده</option>
            </select>

            <div className="w-44">
              <DatePicker
                value={fromDate}
                placeholder="از تاریخ صدور..."
                onChange={(v) => {
                  setFromDate(v)
                  setPage(1)
                }}
              />
            </div>
            <div className="w-44">
              <DatePicker
                value={toDate}
                placeholder="تا تاریخ صدور..."
                onChange={(v) => {
                  setToDate(v)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
            {invoicesLoading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : !(invoicesPage?.data?.length ?? 0) ? (
              <EmptyState
                title="فاکتوری یافت نشد"
                subtitle="می‌توانید از تب «صدور خودکار فاکتور» برای فروش‌های تاییدشده فاکتور صادر کنید."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-hover">
                    <thead>
                      <tr className="border-b border-base-200 bg-slate-50 text-xs font-bold dark:bg-slate-900/60">
                        <th>شماره فاکتور</th>
                        <th>تاریخ صدور</th>
                        <th>مشتری</th>
                        <th>مبلغ کل</th>
                        <th>وضعیت فاکتور</th>
                        <th>صادرکننده</th>
                        <th className="text-end">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesPage!.data.map((inv) => {
                        const meta = invoiceStatusMeta[inv.status]
                        return (
                          <tr key={inv.id} className="text-xs">
                            <td className="font-mono font-extrabold text-primary">
                              {digits(inv.number)}
                            </td>
                            <td>{dateShort(inv.issued_at)}</td>
                            <td className="font-bold">
                              {inv.sale?.customer ? customerDisplayName(inv.sale.customer) : '—'}
                            </td>
                            <td className="font-extrabold">
                              {inv.sale ? toman(inv.sale.total) : '—'}
                            </td>
                            <td>
                              <span className={cx('badge badge-xs font-bold', meta.badgeClass)}>
                                {meta.label}
                              </span>
                            </td>
                            <td className="text-base-content/75">{inv.creator?.name || 'سیستم'}</td>
                            <td>
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  to={`/invoices/${inv.id}/print`}
                                  className="btn btn-ghost btn-xs gap-1 text-primary"
                                >
                                  <Printer className="size-3.5" />
                                  چاپ / PDF
                                </Link>
                                {inv.sale_id && (
                                  <Link
                                    to={`/sales/${inv.sale_id}`}
                                    className="btn btn-ghost btn-xs btn-square"
                                    title="مشاهده سفارش فروش"
                                  >
                                    <Eye className="size-3.5" />
                                  </Link>
                                )}
                                {inv.status !== 'void' && (
                                  <Can permission="sales.manage">
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs btn-square text-error"
                                      title="ابطال فاکتور"
                                      onClick={() => setVoidTarget(inv)}
                                    >
                                      <Ban className="size-3.5" />
                                    </button>
                                  </Can>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={invoicesPage!.current_page}
                  pageSize={invoicesPage!.per_page}
                  total={invoicesPage!.total}
                  onPage={setPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => voidTarget && voidMutation.mutate(voidTarget.id)}
        loading={voidMutation.isPending}
        title="ابطال فاکتور"
        message={
          voidTarget
            ? `آیا از ابطال فاکتور شماره ${digits(voidTarget.number)} اطمینان دارید؟ پس از ابطال می‌توانید مجدداً برای این فروش فاکتور جدید صادر کنید.`
            : ''
        }
        confirmText="ابطال فاکتور"
        danger
      />
    </div>
  )
}
