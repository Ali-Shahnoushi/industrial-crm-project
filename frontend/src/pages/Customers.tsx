import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Building2,
  ChevronDown,
  Cpu,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { Pagination } from '../components/ui/Pagination'
import { ConfirmDialog } from '../components/ui/Modal'
import { EmptyState, TableSkeleton } from '../components/ui/Field'
import { CustomerFormModal } from '../components/customers/CustomerFormModal'
import { ImportModal } from '../components/customers/ImportModal'
import { Can } from '../components/common/Can'
import { customerApi } from '../services/api'
import { customerDisplayName, cx, dateShort, num, toEnDigits } from '../utils/format'
import type { Customer, CustomerType } from '../types'

const PAGE_SIZE = 10

export default function Customers() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()

  const [q, setQ] = useState('')
  const [customerType, setCustomerType] = useState<CustomerType | 'all'>('all')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | undefined>()
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'csv' | null>(null)

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExportingFormat(format)
    try {
      await customerApi.downloadExport(customerType === 'all' ? undefined : customerType, format)
      toast.success(
        format === 'csv'
          ? 'فایل خروجی CSV (استاندارد UTF-8) با موفقیت دانلود شد.'
          : 'فایل خروجی اکسل (.xlsx) با موفقیت دانلود شد.',
      )
    } catch {
      toast.error('خطا در دانلود فایل خروجی مشتریان')
    } finally {
      setExportingFormat(null)
    }
  }

  useEffect(() => {
    const typeParam = params.get('type')
    if (typeParam === 'effective' || typeParam === 'potential') {
      setCustomerType(typeParam)
      setPage(1)
    } else if (typeParam === 'all') {
      setCustomerType('all')
      setPage(1)
    }

    if (params.get('new')) {
      setEditing(undefined)
      setFormOpen(true)
      const nextParams = new URLSearchParams(params)
      nextParams.delete('new')
      setParams(nextParams, { replace: true })
    }
  }, [params, setParams])

  const { data, isLoading } = useQuery({
    queryKey: ['customers', customerType, q, page],
    queryFn: () =>
      customerApi.list({
        customer_type: customerType === 'all' ? undefined : customerType,
        q: toEnDigits(q).trim() || undefined,
        page,
        per_page: PAGE_SIZE,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: customerApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('مشتری با موفقیت حذف شد')
      setDeleting(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف مشتری')
    },
  })

  const customers = data?.data ?? []
  const pageCount = data?.last_page ?? 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت مشتریان"
        subtitle="فهرست مشتریان بالقوه و بالفعل (حقیقی و حقوقی)، دستگاه‌های تخصیص‌یافته و خروجی اکسل / CSV"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Can permission="customers.export">
              <div className="dropdown dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  className={cx(
                    'btn btn-sm gap-1.5',
                    exportingFormat && 'btn-disabled opacity-70',
                  )}
                >
                  {exportingFormat ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Download className="size-4 text-emerald-600" />
                  )}
                  خروجی لیست مشتریان
                  <ChevronDown className="size-3.5 opacity-70" />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu z-40 mt-1.5 w-60 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl text-xs"
                >
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        ;(document.activeElement as HTMLElement | null)?.blur()
                        handleExport('xlsx')
                      }}
                      className="flex items-center gap-2 font-semibold"
                    >
                      <FileSpreadsheet className="size-4 text-emerald-600" />
                      خروجی اکسل استاندارد (.xlsx)
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        ;(document.activeElement as HTMLElement | null)?.blur()
                        handleExport('csv')
                      }}
                      className="flex items-center gap-2 font-semibold"
                    >
                      <FileText className="size-4 text-sky-600" />
                      خروجی CSV (UTF-8 استاندارد فارسی)
                    </button>
                  </li>
                </ul>
              </div>
            </Can>
            <Can permission="customers.import">
              <button className="btn btn-sm" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" /> ورود از اکسل / CSV
              </button>
            </Can>
            <Can permission="customers.create">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" /> مشتری جدید
              </button>
            </Can>
          </div>
        }
      />

      {/* Tabs and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-base-100 p-4 rounded-2xl border border-base-200 shadow-xs">
        <div role="tablist" className="tabs tabs-box w-fit">
          <button
            role="tab"
            className={cx('tab gap-2 text-xs font-bold', customerType === 'all' && 'tab-active')}
            onClick={() => {
              setCustomerType('all')
              setPage(1)
            }}
          >
            <Users className="size-3.5" />
            همه مشتریان
          </button>
          <button
            role="tab"
            className={cx('tab gap-2 text-xs font-bold', customerType === 'effective' && 'tab-active')}
            onClick={() => {
              setCustomerType('effective')
              setPage(1)
            }}
          >
            <UserCheck className="size-3.5 text-emerald-600" />
            مشتریان بالفعل (خریدار دستگاه)
          </button>
          <button
            role="tab"
            className={cx('tab gap-2 text-xs font-bold', customerType === 'potential' && 'tab-active')}
            onClick={() => {
              setCustomerType('potential')
              setPage(1)
            }}
          >
            <UserPlus className="size-3.5 text-amber-600" />
            مشتریان بالقوه (سرنخ)
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-80">
          <SearchInput
            value={q}
            onChange={(val) => {
              setQ(toEnDigits(val))
              setPage(1)
            }}
            placeholder="جستجوی نام، همراه، شرکت، کد ملی..."
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
        {isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : !customers.length ? (
          <EmptyState
            title="مشتری‌ای یافت نشد"
            subtitle={q ? 'با عبارت جستجوی فعلی موردی پیدا نشد.' : 'هنوز مشتری در این بخش ثبت نشده است.'}
            action={
              <Can permission="customers.create">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setEditing(undefined)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="size-4" /> ثبت اولین مشتری
                </button>
              </Can>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr className="bg-base-200/50 text-xs font-bold text-base-content/70">
                  <th>نام و نوع مشتری</th>
                  <th>وضعیت مشتری</th>
                  <th>اطلاعات تماس</th>
                  <th>شهر و استان</th>
                  <th>دستگاه‌های تخصیص‌یافته</th>
                  <th>تاریخ ثبت</th>
                  <th className="text-end">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200/60">
                {customers.map((c) => {
                  const title = customerDisplayName(c)
                  const totalDevices = Number(c.total_devices_qty ?? c.customer_parts_count ?? 0)
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-base-200/50">
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className={cx(
                              'flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs border',
                              c.type === 'company'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
                            )}
                          >
                            {c.type === 'company' ? <Building2 className="size-5" /> : <User className="size-5" />}
                          </div>
                          <div>
                            <Link
                              to={`/customers/${c.id}`}
                              className="font-bold text-sm text-base-content hover:text-primary transition-colors"
                            >
                              {title}
                            </Link>
                            {c.type === 'individual' && c.company_name && (
                              <p className="text-xs text-base-content/50 truncate max-w-[180px]">{c.company_name}</p>
                            )}
                            {c.creator?.name && (
                              <p className="text-[11px] text-base-content/40">ثبت: {c.creator.name}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        {c.customer_type === 'effective' ? (
                          <span className="badge badge-success badge-soft font-bold text-xs gap-1.5">
                            <UserCheck className="size-3" /> مشتری بالفعل
                          </span>
                        ) : (
                          <span className="badge badge-warning badge-soft font-bold text-xs gap-1.5">
                            <UserPlus className="size-3" /> مشتری بالقوه
                          </span>
                        )}
                      </td>

                      <td className="space-y-0.5 text-xs">
                        <p className="font-mono font-medium ltr-text text-start">{c.mobile || '—'}</p>
                        {c.phone && <p className="text-base-content/50 font-mono ltr-text text-start">{c.phone}</p>}
                      </td>

                      <td className="text-xs text-base-content/70">
                        {c.city || c.province ? `${c.province ?? ''} ${c.city ?? ''}`.trim() : '—'}
                      </td>

                      <td>
                        <Link
                          to={`/customers/${c.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                        >
                          <Cpu className="size-3.5" />
                          {num(totalDevices)} دستگاه
                        </Link>
                      </td>

                      <td className="text-xs text-base-content/50">{dateShort(c.created_at ?? '')}</td>

                      <td className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/customers/${c.id}`}
                            className="btn btn-ghost btn-xs btn-square"
                            title="مشاهده پرونده"
                          >
                            <Eye className="size-4" />
                          </Link>
                          <Can permission="customers.edit">
                            <button
                              className="btn btn-ghost btn-xs btn-square"
                              title="ویرایش"
                              onClick={() => {
                                setEditing(c)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </button>
                          </Can>
                          <Can permission="customers.delete">
                            <button
                              className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                              title="حذف"
                              onClick={() => setDeleting(c)}
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

        {/* Pagination Footer */}
        {pageCount > 1 && (
          <div className="border-t border-base-200 p-4">
            <Pagination current={page} total={pageCount} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Modals */}
      <CustomerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers'] })
          qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
          setFormOpen(false)
        }}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers'] })
          qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
          setImportOpen(false)
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="حذف پرونده مشتری"
        message={`آیا از حذف مشتری «${customerDisplayName(deleting)}» اطمینان دارید؟ تمام سوابق و دستگاه‌های تخصیص‌یافته به این مشتری نیز حذف خواهند شد.`}
        confirmText="بله، حذف کن"
        tone="error"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
