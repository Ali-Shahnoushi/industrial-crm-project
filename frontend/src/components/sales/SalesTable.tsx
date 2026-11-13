import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FilePlus2,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react'
import { SearchInput } from '../ui/SearchInput'
import { Pagination } from '../ui/Pagination'
import { ConfirmDialog } from '../ui/Modal'
import { EmptyState, TableSkeleton } from '../ui/Field'
import { Can } from '../common/Can'
import { invoiceApi, salesApi } from '../../services/sales'
import {
  customerDisplayName,
  cx,
  dateShort,
  digits,
  num,
  toEnDigits,
  toman,
} from '../../utils/format'
import { paymentStatusMeta, saleStatusMeta } from '../../utils/meta'
import type { Sale, SellerOption } from '../../types/sales'

interface SortIconProps {
  col: string
  sortBy: string
  sortDir: 'asc' | 'desc'
}

function SortIcon({ col, sortBy, sortDir }: SortIconProps) {
  if (sortBy !== col) return <ArrowUpDown className="size-3.5 opacity-40" />
  return sortDir === 'asc' ? (
    <ArrowUp className="size-3.5 text-primary" />
  ) : (
    <ArrowDown className="size-3.5 text-primary" />
  )
}

interface Props {
  sales: Sale[]
  total: number
  page: number
  perPage: number
  loading?: boolean
  q: string
  status: string
  paymentStatus: string
  sellerId: string
  sortBy: string
  sortDir: 'asc' | 'desc'
  sellers: SellerOption[]
  onSearchChange: (q: string) => void
  onStatusChange: (s: string) => void
  onPaymentStatusChange: (p: string) => void
  onSellerChange: (id: string) => void
  onSort: (col: string) => void
  onPageChange: (p: number) => void
  onEdit: (sale: Sale) => void
}

export function SalesTable({
  sales,
  total,
  page,
  perPage,
  loading,
  q,
  status,
  paymentStatus,
  sellerId,
  sortBy,
  sortDir,
  sellers,
  onSearchChange,
  onStatusChange,
  onPaymentStatusChange,
  onSellerChange,
  onSort,
  onPageChange,
  onEdit,
}: Props) {
  const qc = useQueryClient()
  const [cancelling, setCancelling] = useState<Sale | null>(null)

  const cancelMutation = useMutation({
    mutationFn: (id: number) => salesApi.cancel(id),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sales-summary'] })
      qc.invalidateQueries({ queryKey: ['sales-charts'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setCancelling(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'خطا در لغو فروش')
    },
  })

  const generateInvoiceMutation = useMutation({
    mutationFn: (saleId: number) => invoiceApi.generate(saleId),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-summary'] })
      qc.invalidateQueries({ queryKey: ['uninvoiced-sales'] })
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در صدور فاکتور')
    },
  })

  return (
    <div className="space-y-4">
      {/* Table Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-base-200 bg-base-100 p-3.5 shadow-xs">
        <div className="w-full sm:w-72">
          <SearchInput
            value={q}
            onChange={(val) => onSearchChange(toEnDigits(val))}
            placeholder="جستجوی مشتری، دستگاه، شماره فاکتور..."
          />
        </div>

        <select
          className="select select-bordered select-sm text-xs"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">همه وضعیت‌های سفارش</option>
          <option value="confirmed">تایید شده</option>
          <option value="draft">پیش‌نویس</option>
          <option value="cancelled">لغو شده</option>
        </select>

        <select
          className="select select-bordered select-sm text-xs"
          value={paymentStatus}
          onChange={(e) => onPaymentStatusChange(e.target.value)}
        >
          <option value="">همه وضعیت‌های پرداخت</option>
          <option value="paid">پرداخت کامل</option>
          <option value="partial">پرداخت جزئی</option>
          <option value="unpaid">پرداخت‌نشده</option>
        </select>

        {sellers.length > 0 && (
          <select
            className="select select-bordered select-sm text-xs"
            value={sellerId}
            onChange={(e) => onSellerChange(e.target.value)}
          >
            <option value="">همه کارشناسان فروش</option>
            {sellers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        <div className="ms-auto text-xs font-medium text-base-content/60">
          {num(total)} رکورد یافت شد
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : !sales.length ? (
          <EmptyState
            title="فروشی یافت نشد"
            subtitle="با فیلترهای انتخاب‌شده یا در این بازه زمانی فروشی ثبت نشده است."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr className="border-b border-base-200 bg-slate-50 text-xs font-bold text-base-content/75 dark:bg-slate-900/60">
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => onSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      <span>#</span>
                      <SortIcon col="id" sortBy={sortBy} sortDir={sortDir} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => onSort('sale_date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>تاریخ فروش</span>
                      <SortIcon col="sale_date" sortBy={sortBy} sortDir={sortDir} />
                    </div>
                  </th>
                  <th>مشتری</th>
                  <th>اقلام / دستگاه</th>
                  <th>کارشناس</th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => onSort('total')}
                  >
                    <div className="flex items-center gap-1">
                      <span>مبلغ نهایی</span>
                      <SortIcon col="total" sortBy={sortBy} sortDir={sortDir} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => onSort('payment_status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>پرداخت</span>
                      <SortIcon col="payment_status" sortBy={sortBy} sortDir={sortDir} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => onSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>وضعیت</span>
                      <SortIcon col="status" sortBy={sortBy} sortDir={sortDir} />
                    </div>
                  </th>
                  <th>فاکتور</th>
                  <th className="text-end">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const sMeta = saleStatusMeta[sale.status]
                  const pMeta = paymentStatusMeta[sale.payment_status]
                  const firstItem = sale.items?.[0]
                  const totalQty = sale.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0
                  const isCancelled = sale.status === 'cancelled'

                  return (
                    <tr key={sale.id} className="text-xs transition-colors hover:bg-base-200/40">
                      <td className="font-mono font-bold text-base-content/70">
                        <Link to={`/sales/${sale.id}`} className="hover:text-primary">
                          #{num(sale.id)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap font-medium">{dateShort(sale.sale_date)}</td>
                      <td>
                        {sale.customer ? (
                          <Link
                            to={`/customers/${sale.customer.id}`}
                            className="font-bold text-primary hover:underline"
                          >
                            {customerDisplayName(sale.customer)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <p className="font-bold text-base-content truncate max-w-[200px]">
                          {firstItem?.part?.name || '—'}
                        </p>
                        <p className="text-[11px] text-base-content/60">
                          تعداد کل: {num(totalQty)} عدد
                          {firstItem?.customer_part?.serial_number && (
                            <span className="ms-1.5 font-mono ltr-text">
                              ({firstItem.customer_part.serial_number})
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="text-base-content/80">{sale.seller?.name || '—'}</td>
                      <td>
                        <p className="font-extrabold text-base-content whitespace-nowrap">
                          {toman(sale.total)}
                        </p>
                        {sale.discount_amount > 0 && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            تخفیف: {toman(sale.discount_amount)}
                          </p>
                        )}
                      </td>
                      <td>
                        <span className={cx('badge badge-xs font-bold', pMeta.badgeClass)}>
                          {pMeta.label}
                        </span>
                      </td>
                      <td>
                        <span className={cx('badge badge-xs font-bold', sMeta.badgeClass)}>
                          {sMeta.label}
                        </span>
                      </td>
                      <td>
                        {sale.active_invoice ? (
                          <Link
                            to={`/invoices/${sale.active_invoice.id}/print`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary hover:bg-primary/20"
                          >
                            <Printer className="size-3" />
                            {digits(sale.active_invoice.number)}
                          </Link>
                        ) : !isCancelled ? (
                          <Can permission="sales.create">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-primary gap-1"
                              onClick={() => generateInvoiceMutation.mutate(sale.id)}
                              disabled={generateInvoiceMutation.isPending}
                            >
                              <FilePlus2 className="size-3.5" />
                              صدور فاکتور
                            </button>
                          </Can>
                        ) : (
                          <span className="text-base-content/40">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/sales/${sale.id}`}
                            className="btn btn-ghost btn-xs btn-square"
                            title="مشاهده جزئیات"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                          {!isCancelled && (
                            <Can permission="sales.create">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                title="ویرایش قیمت، تخفیف، مالیات و وضعیت"
                                onClick={() => onEdit(sale)}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            </Can>
                          )}
                          {!isCancelled && (
                            <Can permission="sales.manage">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square text-error"
                                title="لغو فروش"
                                onClick={() => setCancelling(sale)}
                              >
                                <Trash2 className="size-3.5" />
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
        )}

        <Pagination
          page={page}
          pageSize={perPage}
          total={total}
          onPage={onPageChange}
        />
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
        loading={cancelMutation.isPending}
        title="لغو رکورد فروش"
        message={
          cancelling
            ? `آیا از لغو فروش شماره #${num(cancelling.id)} اطمینان دارید؟ این رکورد از KPIها و نمودارهای فروش حذف می‌شود (موجودی انبار از بخش انبار مدیریت می‌شود).`
            : ''
        }
        confirmText="لغو فروش"
        danger
      />
    </div>
  )
}
