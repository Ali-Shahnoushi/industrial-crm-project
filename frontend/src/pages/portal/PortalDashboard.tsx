import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Cpu,
  LifeBuoy,
  Mail,
  MessageSquarePlus,
  Phone,
  ShieldCheck,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { PageSkeleton } from '../../components/ui/Field'
import { StatCard } from '../../components/ui/StatCard'
import { Avatar } from '../../components/ui/Avatar'
import { PortalCreateTicketModal } from '../../components/portal/PortalCreateTicketModal'
import { portalApi } from '../../services/api'
import { ticketStatusMeta, ticketTypeMeta } from '../../utils/meta'
import { cx, dateFa, digits, num, relativeFa } from '../../utils/format'
import type { PortalSalesContact, TicketType } from '../../types'

export default function PortalDashboard() {
  const nav = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<TicketType>('repair_request')
  const [modalDeviceId, setModalDeviceId] = useState<number | null>(null)
  const [targetContact, setTargetContact] = useState<'sales_rep' | 'sales_manager' | null>(null)
  const [targetContactName, setTargetContactName] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-overview'],
    queryFn: portalApi.overview,
  })

  if (isLoading || !data) {
    return <PageSkeleton />
  }

  const { customer, sales_team, stats, devices, departments, recent_tickets } = data

  const openRepairModal = (devId?: number) => {
    setModalType('repair_request')
    setModalDeviceId(devId ?? null)
    setTargetContact(null)
    setTargetContactName(null)
    setModalOpen(true)
  }

  const openDirectSalesMessage = (
    role: 'sales_rep' | 'sales_manager',
    contact: PortalSalesContact,
  ) => {
    setModalType('sales_inquiry')
    setModalDeviceId(null)
    setTargetContact(role)
    setTargetContactName(contact.name)
    setModalOpen(true)
  }

  const renderContactCard = (
    contact: PortalSalesContact | null,
    roleKey: 'sales_manager' | 'sales_rep',
    emptyTitle: string,
  ) => {
    if (!contact) {
      return (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-4 text-xs text-base-content/55 flex items-center justify-center">
          {emptyTitle} هنوز تعیین نشده است.
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-2xs flex flex-col justify-between gap-4">
        <div className="flex items-start gap-3">
          <Avatar name={contact.name} src={contact.avatar_url ?? undefined} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <span className="badge badge-xs badge-primary badge-soft font-bold">
              {contact.title}
            </span>
            <h3 className="text-sm font-extrabold text-base-content truncate">{contact.name}</h3>
            <p className="text-[11px] text-base-content/60">{contact.role_label}</p>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl bg-base-200/65 p-3 text-xs">
          {contact.phone ? (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center justify-between hover:text-primary transition-colors"
            >
              <span className="text-base-content/65 flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" /> تلفن مستقیم:
              </span>
              <b className="font-mono ltr-text">{digits(contact.phone)}</b>
            </a>
          ) : (
            <p className="text-base-content/50">شماره تماس مستقیم ثبت نشده است</p>
          )}

          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center justify-between hover:text-primary transition-colors"
            >
              <span className="text-base-content/65 flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" /> پست الکترونیک:
              </span>
              <span className="font-mono text-[11px] ltr-text truncate max-w-[180px]">
                {contact.email}
              </span>
            </a>
          )}
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline btn-primary w-full gap-1.5"
          onClick={() => openDirectSalesMessage(roleKey, contact)}
        >
          <MessageSquarePlus className="size-4" /> ارسال پیام مستقیم در سامانه
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/12 via-base-100 to-base-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-primary">خوش آمدید به پرتال خدمات مشتریان</p>
          <h1 className="text-xl font-black text-base-content">{customer.display_name}</h1>
          <p className="text-xs text-base-content/65">
            از این پنل می‌توانید مشخصات مدیر و مسئول فروش پروژه خود را مشاهده کرده، وضعیت گارانتی دستگاه‌های خود را بررسی کنید و درخواست تعمیر یا تیکت ثبت نمایید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1.5"
            onClick={() => openRepairModal()}
          >
            <Wrench className="size-4" /> ثبت خرابی / درخواست تعمیر دستگاه
          </button>
          <Link to="/portal/devices" className="btn btn-outline btn-sm gap-1.5">
            <Cpu className="size-4" /> مشاهده دستگاه‌های من
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="دستگاه‌های مستقر شما"
          value={num(stats.total_devices_qty)}
          icon={Cpu}
          tone="primary"
          hint={`${num(stats.devices_count)} ردیف سریال ثبت‌شده`}
          to="/portal/devices"
        />
        <StatCard
          title="تحت پوشش گارانتی فعال"
          value={num(stats.active_warranty_count)}
          icon={ShieldCheck}
          tone="success"
          hint="گارانتی معتبر شرکت"
          to="/portal/devices"
        />
        <StatCard
          title="درخواست‌های در جریان"
          value={num(stats.open_tickets_count)}
          icon={LifeBuoy}
          tone={stats.open_tickets_count > 0 ? 'warning' : 'info'}
          hint="تیکت‌های باز پشتیبانی و تعمیر"
          to="/portal/tickets"
        />
        <StatCard
          title="پاسخ‌های آماده مشاهده"
          value={num(stats.answered_tickets_count)}
          icon={CheckCircle2}
          tone="secondary"
          hint="پاسخ کارشناسان به شما"
          to="/portal/tickets"
        />
      </div>

      {/* Dedicated Project Sales Team Section */}
      <section className="rounded-2xl border border-base-200 bg-base-100/70 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-base-200 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-base-content flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              مدیر فروش و مسئول فروش اختصاصی پروژه شما
            </h2>
            <p className="text-xs text-base-content/60 mt-0.5">
              جهت پیگیری قرارداد، سفارش دستگاه جدید یا هماهنگی‌های تجاری می‌توانید مستقیماً با تیم فروش پرونده خود در ارتباط باشید
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderContactCard(sales_team.sales_manager, 'sales_manager', 'مدیر فروش پروژه')}
          {renderContactCard(sales_team.sales_rep, 'sales_rep', 'مسئول فروش پرونده')}
        </div>
      </section>

      {/* Two-Column Bottom: Devices Quick List + Recent Tickets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Devices Quick List */}
        <div className="lg:col-span-6 rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-base-200 pb-3">
            <h3 className="font-extrabold text-sm text-base-content">دستگاه‌های مرتبط با پروژه شما</h3>
            <Link to="/portal/devices" className="text-xs font-bold text-primary hover:underline">
              جزئیات کامل و سوابق سرویس
            </Link>
          </div>

          {devices.length === 0 ? (
            <p className="py-8 text-center text-xs text-base-content/50">
              هنوز دستگاهی برای پرونده شما ثبت نشده است.
            </p>
          ) : (
            <div className="space-y-3">
              {devices.slice(0, 4).map((dev) => (
                <div
                  key={dev.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-base-200 bg-base-200/35 p-3.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-base-content">
                        {dev.part?.name ?? 'دستگاه صنعتی'}
                      </span>
                      <span
                        className={cx(
                          'badge badge-xs font-bold',
                          dev.is_under_warranty ? 'badge-success badge-soft' : 'badge-ghost',
                        )}
                      >
                        {dev.is_under_warranty ? 'تحت گارانتی' : 'خارج از گارانتی'}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-base-content/60 ltr-text">
                      SN: {dev.serial_number}
                      {dev.warranty_expire_date ? ` • گارانتی تا ${dateFa(dev.warranty_expire_date)}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-xs btn-warning shrink-0 gap-1"
                    onClick={() => openRepairModal(dev.id)}
                  >
                    <Wrench className="size-3.5" /> درخواست تعمیر
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Tickets */}
        <div className="lg:col-span-6 rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-base-200 pb-3">
            <h3 className="font-extrabold text-sm text-base-content">آخرین تیکت‌ها و درخواست‌های شما</h3>
            <Link to="/portal/tickets" className="text-xs font-bold text-primary hover:underline">
              همه تیکت‌ها
            </Link>
          </div>

          {recent_tickets.length === 0 ? (
            <p className="py-8 text-center text-xs text-base-content/50">
              تاکنون درخواستی ثبت نکرده‌اید.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recent_tickets.map((t) => {
                const st = ticketStatusMeta[t.status] ?? ticketStatusMeta.open
                const ty = ticketTypeMeta[t.ticket_type] ?? ticketTypeMeta.general
                return (
                  <Link
                    key={t.id}
                    to={`/portal/tickets/${t.id}`}
                    className="block rounded-xl border border-base-200 p-3.5 text-xs hover:border-primary/40 hover:bg-base-200/35 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary ltr-text">
                          {t.tracking_code}
                        </span>
                        <span className={cx('badge badge-xs', ty.badgeClass)}>{ty.label}</span>
                      </div>
                      <span className={cx('badge badge-xs font-bold py-2', st.badgeClass)}>
                        {st.label}
                      </span>
                    </div>
                    <p className="font-bold text-base-content truncate">{t.subject}</p>
                    <div className="flex items-center justify-between text-[11px] text-base-content/55">
                      <span>پاسخگو: {t.assignee?.name || t.department?.name || 'واحد پشتیبانی'}</span>
                      <span>{relativeFa(t.last_reply_at || t.created_at)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <PortalCreateTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        devices={devices}
        departments={departments}
        initialType={modalType}
        initialDeviceId={modalDeviceId}
        initialTargetContact={targetContact}
        targetContactName={targetContactName}
        onCreated={(id) => nav(`/portal/tickets/${id}`)}
      />
    </div>
  )
}
