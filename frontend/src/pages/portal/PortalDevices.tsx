import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  ChevronDown,
  Cpu,
  History,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, PageSkeleton } from '../../components/ui/Field'
import { PortalCreateTicketModal } from '../../components/portal/PortalCreateTicketModal'
import { portalApi } from '../../services/api'
import { cx, dateFa, num, toman } from '../../utils/format'

const STATUS_FA: Record<string, { label: string; cls: string }> = {
  active: { label: 'فعال و در مدار', cls: 'badge-success badge-soft' },
  under_repair: { label: 'در حال تعمیر', cls: 'badge-warning badge-soft' },
  replaced: { label: 'تعویض شده', cls: 'badge-info badge-soft' },
  retired: { label: 'خارج از رده', cls: 'badge-ghost' },
}

const SERVICE_TYPE_FA: Record<string, string> = {
  periodic: 'سرویس دوره‌ای',
  repair: 'تعمیر تخصصی',
  overhaul: 'اورهال کامل',
}

export default function PortalDevices() {
  const nav = useNavigate()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [repairDeviceId, setRepairDeviceId] = useState<number | null>(null)

  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['portal-overview'],
    queryFn: portalApi.overview,
  })

  if (isLoading || !overviewData) {
    return <PageSkeleton />
  }

  const devices = overviewData.devices ?? []
  const departments = overviewData.departments ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="دستگاه‌های مستقر و پوشش گارانتی"
        subtitle="فهرست کامل دستگاه‌های تحویل‌شده به مجموعه شما، وضعیت اعتبار گارانتی، سوابق سرویس فنی و ثبت آنلاین درخواست تعمیر"
      />

      {devices.length === 0 ? (
        <div className="rounded-2xl border border-base-200 bg-base-100 p-6">
          <EmptyState
            icon={Cpu}
            title="دستگاهی در پرونده شما ثبت نشده است"
            subtitle="در صورت خرید دستگاه جدید، اطلاعات سریال و ضمانت‌نامه توسط واحد فروش در این بخش ثبت خواهد شد."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((dev) => {
            const st = STATUS_FA[dev.status] ?? STATUS_FA.active
            const expanded = expandedId === dev.id

            return (
              <div
                key={dev.id}
                className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Cpu className="size-5" />
                      </span>
                      <h3 className="text-base font-extrabold text-base-content">
                        {dev.part?.name ?? 'دستگاه صنعتی'}
                      </h3>
                      <span className={cx('badge badge-xs font-bold py-2', st.cls)}>
                        {st.label}
                      </span>
                      <span
                        className={cx(
                          'badge badge-xs font-bold py-2 gap-1',
                          dev.is_under_warranty ? 'badge-success' : 'badge-ghost',
                        )}
                      >
                        <ShieldCheck className="size-3" />
                        {dev.is_under_warranty ? 'تحت پوشش گارانتی فعال' : 'خارج از دوره گارانتی'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/70 pt-1">
                      <span>
                        کد فنی: <b className="font-mono ltr-text">{dev.part?.code ?? '—'}</b>
                      </span>
                      <span>•</span>
                      <span>
                        شماره سریال: <b className="font-mono ltr-text">{dev.serial_number || 'بدون سریال'}</b>
                      </span>
                      <span>•</span>
                      <span>
                        تعداد: <b>{num(dev.quantity)} {dev.part?.unit || 'دستگاه'}</b>
                      </span>
                      {dev.installation_date && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3.5 text-primary" />
                            تاریخ نصب: <b>{dateFa(dev.installation_date)}</b>
                          </span>
                        </>
                      )}
                      {dev.warranty_expire_date && (
                        <>
                          <span>•</span>
                          <span>
                            انقضای گارانتی: <b>{dateFa(dev.warranty_expire_date)}</b>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost border border-base-300 gap-1.5 text-xs"
                      onClick={() => setExpandedId(expanded ? null : dev.id)}
                    >
                      <History className="size-4" />
                      سوابق سرویس ({num(dev.service_histories.length)})
                      <ChevronDown
                        className={cx('size-4 transition-transform', expanded && 'rotate-180')}
                      />
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-warning gap-1.5 text-xs font-extrabold"
                      onClick={() => setRepairDeviceId(dev.id)}
                    >
                      <Wrench className="size-4" /> ثبت خرابی / درخواست تعمیر
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="rounded-2xl border border-base-200 bg-base-200/40 p-4 space-y-2.5">
                    <p className="text-xs font-extrabold text-base-content">
                      تاریخچه سرویس‌های دوره‌ای و تعمیرات انجام‌شده روی این دستگاه:
                    </p>
                    {dev.service_histories.length === 0 ? (
                      <p className="text-xs text-base-content/55 py-2">
                        تاکنون سابقه سرویس یا تعمیری برای این شماره سریال ثبت نشده است.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dev.service_histories.map((h) => (
                          <div
                            key={h.id}
                            className="rounded-xl border border-base-200 bg-base-100 p-3 text-xs space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="badge badge-xs badge-primary badge-soft font-bold">
                                  {SERVICE_TYPE_FA[h.service_type] || h.service_type}
                                </span>
                                <span className="font-bold">{dateFa(h.service_date)}</span>
                                <span className="text-base-content/55">
                                  • کارشناس فنی: {h.performed_by_name}
                                </span>
                              </div>
                              {Number(h.cost || 0) > 0 && (
                                <span className="font-bold text-base-content/75">
                                  هزینه: {toman(Number(h.cost))}
                                </span>
                              )}
                            </div>
                            <p className="text-base-content/80 leading-relaxed">{h.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <PortalCreateTicketModal
        open={repairDeviceId !== null}
        onClose={() => setRepairDeviceId(null)}
        devices={devices}
        departments={departments}
        initialType="repair_request"
        initialDeviceId={repairDeviceId}
        onCreated={(id) => nav(`/portal/tickets/${id}`)}
      />
    </div>
  )
}
