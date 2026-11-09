import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  ArrowDownCircle,
  ArrowUpCircle,
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
import { Pagination } from '../components/ui/Pagination'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, TableSkeleton, EmptyState } from '../components/ui/Field'
import { Can } from '../components/common/Can'
import { partApi } from '../services/api'
import {
  customerDisplayName,
  cx,
  dateTimeFa,
  num,
  toEnDigits,
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
  stock_quantity: z.string().optional(),
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

  // Manual Stock In / Out Modal
  const [stockTarget, setStockTarget] = useState<Part | null>(null)
  const [stockActionType, setStockActionType] = useState<'in' | 'out_manual'>('in')
  const [stockQtyInput, setStockQtyInput] = useState('1')
  const [stockDesc, setStockDesc] = useState('')

  // Inventory Audit Logs Filters
  const [logPage, setLogPage] = useState(1)
  const [logTypeFilter, setLogTypeFilter] = useState<InventoryOperationType | ''>('')
  const [logPartFilter, setLogPartFilter] = useState<string>('')
  const [logSearch, setLogSearch] = useState('')

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['parts-catalog', q],
    queryFn: () => partApi.list({ q: toEnDigits(q).trim() || undefined }),
  })

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
    formState: { errors, isSubmitting },
  } = useForm<PartFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      periodic_service_months: '12',
      stock_quantity: '0',
      description: '',
      is_active: true,
    },
  })

  const openCreate = () => {
    setEditingPart(null)
    reset({
      name: '',
      code: '',
      periodic_service_months: '12',
      stock_quantity: '0',
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
      stock_quantity: String(p.stock_quantity ?? 0),
      description: p.description ?? '',
      is_active: p.is_active,
    })
    setModalOpen(true)
  }

  const openStockModal = (p: Part, type: 'in' | 'out_manual') => {
    setStockTarget(p)
    setStockActionType(type)
    setStockQtyInput('1')
    setStockDesc('')
  }

  const deleteMutation = useMutation({
    mutationFn: partApi.delete,
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setDeletingPart(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف دستگاه')
    },
  })

  const adjustStockMutation = useMutation({
    mutationFn: () =>
      partApi.adjustStock(stockTarget!.id, {
        type: stockActionType,
        quantity: Number(toEnDigits(stockQtyInput)) || 0,
        description: stockDesc.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['inventory-logs'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setStockTarget(null)
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err.response?.data?.message || 'خطا در ثبت گردش انبار')
    },
  })

  const onSubmit = async (values: PartFormValues) => {
    const payload: Partial<Part> = {
      name: values.name.trim(),
      code: toEnDigits(values.code).trim(),
      periodic_service_months: Number(toEnDigits(values.periodic_service_months)) || 12,
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
    const qty = Number(toEnDigits(stockQtyInput)) || 0
    if (qty < 1) {
      toast.error('تعداد باید حداقل ۱ عدد باشد')
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
        subtitle="تعریف مدل‌های دستگاه‌ها، مدیریت موجودی انبار، ثبت ورود/خروج کالا و گزارش جامع گردش انبار"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-bold text-primary">
              <Boxes className="size-4" />
              موجودی کل انبار: {num(totalWarehouseStock)} دستگاه
            </span>
            <Can permission="parts.manage">
              <button className="btn btn-sm btn-primary gap-1.5" onClick={openCreate}>
                <Plus className="size-4" /> تعریف دستگاه جدید
              </button>
            </Can>
          </div>
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
                      <th>نام و مشخصات دستگاه</th>
                      <th>کد فنی (SKU)</th>
                      <th>موجودی انبار</th>
                      <th>دوره پوشش گارانتی</th>
                      <th>تعداد تحویل‌شده به مشتریان</th>
                      <th>وضعیت</th>
                      <th className="text-end">عملیات انبار و ویرایش</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200/80">
                    {parts.map((p) => {
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
                              {num(stock)} عدد
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
                              {num(assignedSum)} دستگاه
                            </span>
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

            <select
              className="select select-bordered select-sm h-9 w-full bg-base-100 text-xs"
              value={logPartFilter}
              onChange={(e) => {
                setLogPartFilter(e.target.value)
                setLogPage(1)
              }}
            >
              <option value="">همه دستگاه‌ها</option>
              {parts.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>

            <select
              className="select select-bordered select-sm h-9 w-full bg-base-100 text-xs"
              value={logTypeFilter}
              onChange={(e) => {
                setLogTypeFilter(e.target.value as InventoryOperationType | '')
                setLogPage(1)
              }}
            >
              <option value="">همه انواع تراکنش انبار</option>
              <option value="in">ورود به انبار (+)</option>
              <option value="out_assign">خروج بابت تخصیص به مشتری (-)</option>
              <option value="out_manual">خروج دستی از انبار (-)</option>
              <option value="return">بازگشت به انبار (+)</option>
            </select>
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
                        <th>تاریخ و ساعت</th>
                        <th>دستگاه</th>
                        <th>نوع عملیات</th>
                        <th>تعداد</th>
                        <th>موجودی پس از عملیات</th>
                        <th>مشتری مرتبط</th>
                        <th>کارمند ثبت‌کننده</th>
                        <th>شرح تراکنش</th>
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
                            <td className="font-bold">{num(log.balance_after)} عدد</td>
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
              {stockActionType === 'in' ? 'ثبت ورود به انبار' : 'ثبت خروج از انبار'}
            </button>
          </>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleStockSubmit} className="space-y-4">
          <div className="rounded-xl bg-base-200 p-3 text-xs flex items-center justify-between">
            <span>موجودی فعلی در انبار:</span>
            <b className="font-mono">{num(stockTarget?.stock_quantity ?? 0)} عدد</b>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-base-200 p-1.5">
            <button
              type="button"
              onClick={() => setStockActionType('in')}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer',
                stockActionType === 'in'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-base-content/65 hover:text-base-content',
              )}
            >
              <ArrowDownCircle className="size-4" />
              ورود به انبار (+)
            </button>
            <button
              type="button"
              onClick={() => setStockActionType('out_manual')}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer',
                stockActionType === 'out_manual'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-base-content/65 hover:text-base-content',
              )}
            >
              <ArrowUpCircle className="size-4" />
              خروج دستی (-)
            </button>
          </div>

          <Field
            label={
              stockActionType === 'in'
                ? 'تعداد ورودی به انبار (عدد)'
                : 'تعداد خروجی از انبار (عدد)'
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
