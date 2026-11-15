import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes,
  Building2,
  Calendar,
  Cpu,
  ExternalLink,
  Hash,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { EmptyState, TableSkeleton } from '../ui/Field'
import { partApi } from '../../services/api'
import {
  customerDisplayName,
  cx,
  dateFa,
  num,
  phoneFa,
  toEnDigits,
} from '../../utils/format'
import { customerPartStatusMeta } from '../../utils/meta'
import type { CustomerPart, Part } from '../../types'

interface AssignedCustomersModalProps {
  part: Part | null
  onClose: () => void
}

export function AssignedCustomersModal({ part, onClose }: AssignedCustomersModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const partId = part?.id

  const { data, isLoading } = useQuery({
    queryKey: ['part-assigned-customers', partId],
    queryFn: () => (partId ? partApi.assignedCustomers(partId) : null),
    enabled: Boolean(partId),
  })

  const unitLabel = part?.unit || 'دستگاه'

  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments])

  const filteredAssignments = useMemo(() => {
    const term = toEnDigits(searchTerm.trim().toLowerCase())
    if (!term) return assignments

    return assignments.filter((cp: CustomerPart) => {
      const c = cp.customer
      const name = customerDisplayName(c).toLowerCase()
      const mobile = toEnDigits(c?.mobile || '').toLowerCase()
      const phone = toEnDigits(c?.phone || '').toLowerCase()
      const serial = toEnDigits(cp.serial_number || '').toLowerCase()
      const invoice = toEnDigits(cp.invoice_number || '').toLowerCase()
      const city = (c?.city || '').toLowerCase()
      const province = (c?.province || '').toLowerCase()

      return (
        name.includes(term) ||
        mobile.includes(term) ||
        phone.includes(term) ||
        serial.includes(term) ||
        invoice.includes(term) ||
        city.includes(term) ||
        province.includes(term)
      )
    })
  }, [assignments, searchTerm])

  const totalAssignedQty = data?.total_assigned_quantity ?? Number(part?.assigned_quantity_sum ?? 0)
  const uniqueCustomersCount = useMemo(() => {
    const ids = new Set(assignments.map((a) => a.customer_id))
    return ids.size
  }, [assignments])

  return (
    <Modal
      open={Boolean(part)}
      onClose={onClose}
      size="xl"
      title={`مشتریان و افراد تحویل‌گیرنده «${part?.name || ''}»`}
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          بستن
        </button>
      }
    >
      <div className="space-y-4">
        {/* Device header banner */}
        <div className="flex flex-col gap-3 rounded-2xl border border-base-200 bg-base-200/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              <Cpu className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-base-content">{part?.name}</span>
                <span className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {part?.code}
                </span>
              </div>
              <p className="text-xs text-base-content/60 mt-0.5">
                فهرست تمامی مشتریان، شرکت‌ها و افرادی که این دستگاه به آن‌ها تخصیص یا تحویل داده شده است.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="badge badge-info badge-soft gap-1.5 py-3 font-bold text-xs">
              <Boxes className="size-3.5" />
              مجموع تحویل‌شده: {num(totalAssignedQty)} {unitLabel}
            </div>
            <div className="badge badge-neutral badge-soft gap-1.5 py-3 font-bold text-xs">
              <Users className="size-3.5" />
              {num(uniqueCustomersCount)} مشتری
            </div>
          </div>
        </div>

        {/* Filter / Search input */}
        {assignments.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در نام مشتری، شرکت، شماره تماس، شماره سریال یا فاکتور..."
              className="input input-bordered w-full pr-10 text-xs sm:text-sm"
            />
          </div>
        )}

        {/* Content list */}
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : assignments.length === 0 ? (
          <EmptyState
            title="هیچ تخصیصی برای این دستگاه ثبت نشده است"
            subtitle="تاکنون این مدل دستگاه به هیچ مشتری یا پرونده‌ای تحویل داده نشده است. می‌توانید از بخش پرونده مشتری نسبت به تخصیص آن اقدام نمایید."
          />
        ) : filteredAssignments.length === 0 ? (
          <div className="py-8 text-center text-sm text-base-content/60">
            هیچ مشتری‌ای مطابق با عبارت «{searchTerm}» یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
            <table className="table table-sm">
              <thead className="bg-base-200/50 text-xs">
                <tr>
                  <th>مشتری / شرکت</th>
                  <th>تعداد تخصیص</th>
                  <th>شماره سریال</th>
                  <th>وضعیت دستگاه</th>
                  <th>تاریخ تحویل</th>
                  <th>گارانتی</th>
                  <th className="text-end">پرونده مشتری</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200/70 text-xs">
                {filteredAssignments.map((cp) => {
                  const customer = cp.customer
                  const isLegal = customer?.type === 'company' || (customer as any)?.type === 'legal'
                  const statusMeta =
                    customerPartStatusMeta[cp.status] || {
                      label: cp.status,
                      badgeClass: 'badge-ghost',
                    }

                  return (
                    <tr key={cp.id} className="transition-colors hover:bg-base-200/40">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/70">
                            {isLegal ? (
                              <Building2 className="size-4 text-primary" />
                            ) : (
                              <User className="size-4 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <Link
                              to={`/customers/${cp.customer_id}`}
                              onClick={onClose}
                              className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors flex items-center gap-1"
                              title="مشاهده پرونده کامل مشتری"
                            >
                              <span>{customerDisplayName(customer)}</span>
                            </Link>

                            <div className="flex items-center gap-2 text-[11px] text-base-content/50 mt-0.5">
                              <span
                                className={cx(
                                  'badge badge-xs font-semibold',
                                  isLegal ? 'badge-primary badge-soft' : 'badge-ghost',
                                )}
                              >
                                {isLegal ? 'حقوقی' : 'حقیقی'}
                              </span>

                              {(customer?.mobile || customer?.phone) && (
                                <span className="inline-flex items-center gap-1 ltr-text">
                                  <Phone className="size-3 text-base-content/40" />
                                  {phoneFa(customer.mobile || customer.phone)}
                                </span>
                              )}

                              {(customer?.province || customer?.city) && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3 text-base-content/40" />
                                  {[customer.province, customer.city].filter(Boolean).join(' - ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-sm badge-info badge-soft font-bold">
                          {num(cp.quantity ?? 1)} {unitLabel}
                        </span>
                      </td>

                      <td>
                        {cp.serial_number ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <Hash className="size-3 text-base-content/40" />
                            {cp.serial_number}
                          </span>
                        ) : (
                          <span className="text-base-content/40">—</span>
                        )}
                      </td>

                      <td>
                        <span className={cx('badge badge-xs font-semibold', statusMeta.badgeClass)}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td>
                        {cp.installation_date ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-base-content/80">
                            <Calendar className="size-3 text-base-content/40" />
                            {dateFa(cp.installation_date)}
                          </span>
                        ) : (
                          <span className="text-base-content/40">—</span>
                        )}
                      </td>

                      <td>
                        {cp.warranty_expire_date ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-base-content/80">
                            <ShieldAlert className="size-3 text-base-content/40" />
                            {dateFa(cp.warranty_expire_date)}
                          </span>
                        ) : (
                          <span className="text-base-content/40">—</span>
                        )}
                      </td>

                      <td className="text-end">
                        <Link
                          to={`/customers/${cp.customer_id}`}
                          onClick={onClose}
                          className="btn btn-xs btn-primary btn-soft gap-1 font-bold hover:btn-primary"
                          title="مشاهده پرونده کامل مشتری"
                        >
                          <ExternalLink className="size-3" />
                          مشاهده پرونده
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
