import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  ClipboardCheck,
  Cpu,
  ExternalLink,
  History,
  PackageX,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { SearchInput } from '../components/ui/SearchInput'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Pagination } from '../components/ui/Pagination'
import { Modal } from '../components/ui/Modal'
import { Field, TableSkeleton, EmptyState } from '../components/ui/Field'
import { Can } from '../components/common/Can'
import { partApi } from '../services/api'
import { customerDisplayName, cx, dateTimeFa, num, toEnDigits } from '../utils/format'
import { inventoryTypeMeta } from '../utils/meta'
import type { InventoryOperationType, Part } from '../types'

type StockModalMode = 'in' | 'out_manual' | 'adjustment'

export default function Inventory() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()

  const q = params.get('q') || ''
  const lowOnly = params.get('low') === '1'

  const [logPage, setLogPage] = useState(1)
  const [logType, setLogType] = useState<InventoryOperationType | ''>('')

  // Stock Modal state
  const [targetPart, setTargetPart] = useState<Part | null>(null)
  const [mode, setMode] = useState<StockModalMode>('in')
  const [qtyInput, setQtyInput] = useState('1')
  const [desc, setDesc] = useState('')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: partApi.inventorySummary,
  })

  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ['parts-catalog', q, lowOnly],
    queryFn: () =>
      partApi.list({
        q: toEnDigits(q).trim() || undefined,
        low_stock_only: lowOnly || undefined,
      }),
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['inventory-logs', logPage, logType],
    queryFn: () =>
      partApi.inventoryLogs({
        page: logPage,
        per_page: 15,
        type: logType || undefined,
      }),
  })

  const stockMutation = useMutation({
    mutationFn: (payload: {
      partId: number | string
      type: StockModalMode
      quantity: number
      description?: string
    }) =>
      partApi.adjustStock(payload.partId, {
        type: payload.type,
        quantity: payload.quantity,
        description: payload.description,
      }),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['inventory-logs'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setTargetPart(null)
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.errors?.quantity?.[0] ||
        err.response?.data?.message ||
        'خطا در ثبت عملیات انبار'
      toast.error(msg)
    },
  })

  const openOperation = (p: Part, opMode: StockModalMode) => {
    setTargetPart(p)
    setMode(opMode)
    setQtyInput(opMode === 'adjustment' ? String(p.stock_quantity ?? 0) : '1')
    setDesc('')
  }

  const handleStockSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!targetPart) return
    const parsed = Number(toEnDigits(qtyInput).replace(/[^\d]/g, ''))
    if (!Number.isInteger(parsed) || (mode === 'adjustment' ? parsed < 0 : parsed < 1)) {
      toast.error(
        mode === 'adjustment'
          ? 'موجودی شمارش‌شده باید عدد صحیح صفر یا بیشتر باشد.'
          : 'تعداد باید حداقل ۱ واحد باشد.',
      )
      return
    }
    stockMutation.mutate({
      partId: targetPart.id,
      type: mode,
      quantity: parsed,
      description: desc.trim() || undefined,
    })
  }

  const toggleLowFilter = () => {
    const next = new URLSearchParams(params)
    if (lowOnly) {
      next.delete('low')
    } else {
      next.set('low', '1')
    }
    setParams(next, { replace: true })
  }

  const lowStockList = summary?.low_stock_parts ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="انبار دستگاه‌ها و کاردکس موجودی"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/parts" className="btn btn-sm btn-outline gap-1.5">
              <Cpu className="size-4" /> کاتالوگ دستگاه‌ها
            </Link>
          </div>
        }
      />

      {/* Warehouse KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="کل مدل‌های دستگاه"
          value={num(summary?.total_models ?? 0)}
          icon={Cpu}
          tone="primary"
          hint={`مدل‌های فعال عرضه: ${num(summary?.active_models ?? 0)}`}
          loading={summaryLoading}
          to="/parts"
        />
        <StatCard
          title="مجموع واحدهای موجود در انبار"
          value={num(summary?.total_units_in_stock ?? 0)}
          icon={Boxes}
          tone="success"
          hint="موجودی کل آماده تخصیص"
          loading={summaryLoading}
        />
        <StatCard
          title="هشدار کمبود موجودی"
          value={num(summary?.low_stock_count ?? 0)}
          icon={AlertTriangle}
          tone="warning"
          hint="رسیده به حد آستانه سفارش (min stock)"
          loading={summaryLoading}
        />
        <StatCard
          title="مدل‌های ناموجود (موجودی صفر)"
          value={num(summary?.out_of_stock_count ?? 0)}
          icon={PackageX}
          tone="error"
          hint="نیازمند شارژ فوری انبار"
          loading={summaryLoading}
        />
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockList.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-base-content">
                {num(lowStockList.length)} مدل دستگاه به حد آستانه کمبود موجودی رسیده‌اند
              </p>
              <p className="text-xs text-base-content/70 mt-0.5">
                {lowStockList
                  .slice(0, 4)
                  .map((p) => `${p.name} (${num(p.stock_quantity ?? 0)} ${p.unit || 'دستگاه'})`)
                  .join(' • ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLowFilter}
            className={cx('btn btn-sm shrink-0', lowOnly ? 'btn-neutral' : 'btn-warning')}
          >
            {lowOnly ? 'نمایش همه دستگاه‌ها' : 'فیلتر کمبود موجودی'}
          </button>
        </div>
      )}

      {/* Live Warehouse Stock Table */}
      <div className="card-surface overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-base-200">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <SearchInput
              value={q}
              onChange={(val) => {
                const next = new URLSearchParams(params)
                if (val) next.set('q', val)
                else next.delete('q')
                setParams(next, { replace: true })
              }}
              placeholder="جستجوی نام یا کد فنی (SKU) دستگاه..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLowFilter}
              className={cx('btn btn-sm gap-1.5', lowOnly ? 'btn-warning' : 'btn-ghost border border-base-300')}
            >
              <AlertTriangle className="size-4" />
              فقط کمبود موجودی
            </button>
          </div>
        </div>

        {partsLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : parts.length === 0 ? (
          <EmptyState
            title="دستگاهی مطابق فیلتر انتخابی یافت نشد"
            subtitle="می‌توانید فیلتر کمبود موجودی یا عبارت جستجو را پاک کنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra align-middle text-xs sm:text-sm">
              <thead>
                <tr className="text-base-content/60">
                  <th>دستگاه / کد</th>
                  <th>موجودی</th>
                  <th>حد هشدار</th>
                  <th>وضعیت</th>
                  <th>تخصیص</th>
                  <th className="text-end">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const stock = p.stock_quantity ?? 0
                  const min = p.min_stock ?? 0
                  const unitLabel = p.unit || 'دستگاه'
                  const isOut = p.is_active && stock <= 0
                  const isLow = Boolean(p.is_low_stock) && !isOut

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-bold text-base-content">{p.name}</div>
                        <div className="font-mono text-[11px] text-base-content/55 ltr-text inline-block">
                          {p.code}
                        </div>
                      </td>
                      <td>
                        <span className="font-extrabold text-base">{num(stock)}</span>{' '}
                        <span className="text-xs text-base-content/60">{unitLabel}</span>
                      </td>
                      <td>
                        <span className="font-semibold">{num(min)}</span>{' '}
                        <span className="text-xs text-base-content/60">{unitLabel}</span>
                      </td>
                      <td>
                        {!p.is_active ? (
                          <span className="badge badge-ghost badge-sm">غیرفعال</span>
                        ) : isOut ? (
                          <span className="badge badge-error badge-soft badge-sm font-bold">ناموجود</span>
                        ) : isLow ? (
                          <span className="badge badge-warning badge-soft badge-sm font-bold">
                            کمبود
                          </span>
                        ) : (
                          <span className="badge badge-success badge-soft badge-sm font-bold">کافی</span>
                        )}
                      </td>
                      <td>
                        <span className="font-semibold">
                          {num(Number(p.assigned_quantity_sum ?? 0))} {unitLabel}
                        </span>
                      </td>
                      <td>
                        <Can
                          permission="parts.manage"
                          fallback={<span className="text-xs text-base-content/40 block text-end">فقط مشاهده</span>}
                        >
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="btn btn-xs btn-success btn-soft gap-1"
                              onClick={() => openOperation(p, 'in')}
                              title="ثبت ورود کالا به انبار"
                            >
                              <ArrowDownCircle className="size-3.5" /> ورود
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-warning btn-soft gap-1"
                              onClick={() => openOperation(p, 'out_manual')}
                              disabled={stock <= 0}
                              title="ثبت خروج دستی از انبار"
                            >
                              <ArrowUpCircle className="size-3.5" /> خروج
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-secondary btn-soft gap-1"
                              onClick={() => openOperation(p, 'adjustment')}
                              title="انبارگردانی و تنظیم عدد دقیق موجودی فیزیکی"
                            >
                              <ClipboardCheck className="size-3.5" /> انبارگردانی
                            </button>
                          </div>
                        </Can>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kardex Movement Audit Logs */}
      <div className="card-surface">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-base-200">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">کاردکس گردش موجودی</h3>
              <p className="text-xs text-base-content/60">
                ثبت غیرقابل‌تغییر تمام ورودها، خروج‌ها، تخصیص‌ها و انبارگردانی‌ها همراه با نام اقدام‌کننده
              </p>
            </div>
          </div>
          <SearchableSelect
            className="w-full sm:w-52"
            value={logType}
            onChange={(val) => {
              setLogType(val as InventoryOperationType | '')
              setLogPage(1)
            }}
            placeholder="همه تراکنش‌ها"
            searchPlaceholder="جستجوی نوع تراکنش..."
            options={[
              { value: 'in', label: 'ورود به انبار' },
              { value: 'out_assign', label: 'خروج تخصیص' },
              { value: 'out_manual', label: 'خروج دستی' },
              { value: 'return', label: 'بازگشت' },
              { value: 'adjustment', label: 'تنظیم موجودی' },
            ]}
          />
        </div>

        {logsLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : !logsData?.data?.length ? (
          <EmptyState title="تراکنش انباری ثبت نشده است" subtitle="هنوز گردشی در کاردکس انبار وجود ندارد." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table align-middle text-xs">
                <thead>
                  <tr className="text-base-content/60">
                    <th>تاریخ</th>
                    <th>دستگاه</th>
                    <th>عملیات</th>
                    <th>تعداد</th>
                    <th>مانده</th>
                    <th>مرتبط</th>
                    <th>شرح</th>
                  </tr>
                </thead>
                <tbody>
                  {logsData.data.map((log) => {
                    const meta = inventoryTypeMeta[log.type] ?? {
                      label: log.type_label || log.type,
                      badgeClass: 'badge-ghost',
                      sign: '±' as const,
                    }
                    return (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap text-base-content/70">
                          {dateTimeFa(log.created_at)}
                        </td>
                        <td>
                          <div className="font-bold">{log.part?.name || '—'}</div>
                          <div className="font-mono text-[10px] text-base-content/50 ltr-text inline-block">
                            {log.part?.code}
                          </div>
                        </td>
                        <td>
                          <span className={cx('badge badge-sm font-bold', meta.badgeClass)}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="font-mono font-bold">
                          {meta.sign}
                          {num(log.quantity)}
                        </td>
                        <td className="font-bold">
                          {log.balance_before !== undefined && (
                            <span className="text-base-content/45 font-normal me-1">
                              {num(log.balance_before)} ←
                            </span>
                          )}
                          {num(log.balance_after)} {log.part?.unit || 'دستگاه'}
                        </td>
                        <td>
                          <div className="font-medium">{log.user?.name || 'سیستم'}</div>
                          {log.customer && (
                            <Link
                              to={`/customers/${log.customer.id}`}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                            >
                              {customerDisplayName(log.customer)} <ExternalLink className="size-3" />
                            </Link>
                          )}
                        </td>
                        <td className="max-w-xs truncate" title={log.description || ''}>
                          {log.description || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={logsData.current_page}
              total={logsData.total}
              pageSize={15}
              onChange={setLogPage}
            />
          </>
        )}
      </div>

      {/* Quick Stock In / Out / Physical Reconciliation Modal */}
      <Modal
        open={Boolean(targetPart)}
        onClose={() => setTargetPart(null)}
        size="md"
        title={
          mode === 'in'
            ? `ورود کالا به انبار — ${targetPart?.name ?? ''}`
            : mode === 'out_manual'
              ? `خروج دستی از انبار — ${targetPart?.name ?? ''}`
              : `انبارگردانی و تنظیم دقیق موجودی — ${targetPart?.name ?? ''}`
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTargetPart(null)}
              disabled={stockMutation.isPending}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="inventory-quick-form"
              className="btn btn-primary"
              disabled={stockMutation.isPending}
            >
              {stockMutation.isPending && <span className="loading loading-spinner loading-xs" />}
              ثبت در کاردکس انبار
            </button>
          </>
        }
      >
        {targetPart && (
          <form id="inventory-quick-form" onSubmit={handleStockSubmit} className="space-y-4">
            <div className="rounded-xl bg-base-200 p-3 text-xs flex items-center justify-between">
              <span className="text-base-content/70">موجودی ثبت‌شده فعلی در سیستم:</span>
              <span className="font-extrabold text-sm">
                {num(targetPart.stock_quantity ?? 0)} {targetPart.unit || 'دستگاه'}
              </span>
            </div>

            <Field
              label={
                mode === 'adjustment'
                  ? `موجودی واقعی شمارش‌شده در انبار (${targetPart.unit || 'دستگاه'} — عدد ۰ نیز مجاز است)`
                  : `تعداد (${targetPart.unit || 'دستگاه'})`
              }
            >
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered w-full text-center font-mono text-base font-bold"
                value={qtyInput}
                onChange={(e) => setQtyInput(toEnDigits(e.target.value).replace(/[^\d]/g, ''))}
                required
                autoFocus
              />
            </Field>

            <Field label="شرح سند / علت عملیات انبار (اختیاری)">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={
                  mode === 'adjustment'
                    ? 'مثلاً: شمارش فیزیکی انبارگردانی پایان ماه'
                    : 'مثلاً: شماره حواله انبار یا توضیح تکمیلی...'
                }
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}
