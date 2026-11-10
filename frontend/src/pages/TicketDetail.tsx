import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Cpu,
  Download,
  ExternalLink,
  Lock,
  MessageSquare,
  Paperclip,
  Phone,
  Send,
  ShieldAlert,
  User,
} from 'lucide-react'
import { Field, PageSkeleton } from '../components/ui/Field'
import { Avatar } from '../components/ui/Avatar'
import { Can } from '../components/common/Can'
import { ticketApi } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { ticketPriorityMeta, ticketStatusMeta, ticketTypeMeta } from '../utils/meta'
import { customerDisplayName, cx, dateFa, dateTimeFa, digits } from '../utils/format'
import type { TicketPriority, TicketStatus } from '../types'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManageTicket = hasPermission('tickets.manage')
  const canReply = hasPermission('tickets.reply')

  // Composer state
  const [composerMode, setComposerMode] = useState<'public' | 'internal'>('public')
  const [replyBody, setReplyBody] = useState('')
  const [nextStatus, setNextStatus] = useState<TicketStatus>('answered')
  const [attachment, setAttachment] = useState<File | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ticket-detail', id],
    queryFn: () => ticketApi.get(id!),
    enabled: Boolean(id),
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['ticket-departments-active'],
    queryFn: ticketApi.activeDepartments,
  })

  const updateMetaMutation = useMutation({
    mutationFn: (payload: {
      status?: TicketStatus
      priority?: TicketPriority
      department_id?: number | null
      assigned_to_user_id?: number | null
      auto_reassign?: boolean
    }) => ticketApi.update(id!, payload),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['ticket-detail', id] })
      qc.invalidateQueries({ queryKey: ['tickets-list'] })
      qc.invalidateQueries({ queryKey: ['tickets-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'خطا در بروزرسانی وضعیت تیکت')
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('body', replyBody.trim())
      fd.append('is_internal_note', composerMode === 'internal' ? '1' : '0')
      if (composerMode === 'public') {
        fd.append('next_status', nextStatus)
      }
      if (attachment) {
        fd.append('attachment', attachment)
      }
      return ticketApi.addMessage(id!, fd)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      setReplyBody('')
      setAttachment(null)
      qc.invalidateQueries({ queryKey: ['ticket-detail', id] })
      qc.invalidateQueries({ queryKey: ['tickets-list'] })
      qc.invalidateQueries({ queryKey: ['tickets-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ثبت پیام')
    },
  })

  if (isLoading) {
    return <PageSkeleton />
  }

  const ticket = data?.ticket
  const staffOptions = data?.staff_options ?? []

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-base-200 bg-base-100 p-10 text-center space-y-3">
        <p className="font-bold text-base">تیکت مورد نظر یافت نشد یا خارج از محدوده دسترسی شماست.</p>
        <button className="btn btn-sm btn-primary" onClick={() => nav('/tickets')}>
          بازگشت به لیست تیکت‌ها
        </button>
      </div>
    )
  }

  const stMeta = ticketStatusMeta[ticket.status] ?? ticketStatusMeta.open
  const prMeta = ticketPriorityMeta[ticket.priority] ?? ticketPriorityMeta.medium
  const tyMeta = ticketTypeMeta[ticket.ticket_type] ?? ticketTypeMeta.general
  const messages = ticket.messages ?? []

  const handleReplySubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim()) {
      toast.error('متن پاسخ یا یادداشت را وارد کنید')
      return
    }
    sendMessageMutation.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn btn-sm btn-ghost gap-1.5"
          onClick={() => nav('/tickets')}
        >
          <ArrowRight className="size-4" /> بازگشت به کارتابل تیکت‌ها
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-sm font-mono ltr-text bg-base-200 border border-base-300 font-bold">
            {ticket.tracking_code}
          </span>
          <span className={cx('badge badge-sm font-bold', tyMeta.badgeClass)}>{tyMeta.label}</span>
          <span className={cx('badge badge-sm font-bold', prMeta.badgeClass)}>
            اولویت: {prMeta.label}
          </span>
          <span className={cx('badge badge-sm font-bold', stMeta.badgeClass)}>{stMeta.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left/Main Column: Conversation Thread + Composer */}
        <div className="lg:col-span-8 space-y-5">
          {/* Subject Banner */}
          <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-2">
            <h1 className="text-lg font-extrabold text-base-content leading-snug">
              {ticket.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60">
              <span>ثبت‌شده در: {dateTimeFa(ticket.created_at)}</span>
              <span>•</span>
              <span>دپارتمان: {ticket.department?.name || 'عمومی'}</span>
              {ticket.assignee && (
                <>
                  <span>•</span>
                  <span>کارشناس مسئول: {ticket.assignee.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Messages Timeline */}
          <div className="space-y-3">
            {messages.map((msg) => {
              if (msg.sender_type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center py-1">
                    <span className="rounded-full border border-base-300 bg-base-200/80 px-3.5 py-1 text-[11px] text-base-content/70">
                      ⚙️ {msg.body} • {dateTimeFa(msg.created_at)}
                    </span>
                  </div>
                )
              }

              const isCustomer = msg.sender_type === 'customer'
              const isInternal = Boolean(msg.is_internal_note)

              return (
                <div
                  key={msg.id}
                  className={cx(
                    'rounded-2xl border p-4 shadow-2xs space-y-2.5',
                    isInternal
                      ? 'border-amber-400/50 bg-amber-50/70 dark:border-amber-700/60 dark:bg-amber-950/30'
                      : isCustomer
                        ? 'border-primary/25 bg-primary/5'
                        : 'border-base-200 bg-base-100',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200/70 pb-2">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={msg.user?.name || (isCustomer ? 'مشتری' : 'کارشناس')}
                        src={msg.user?.avatar_url ?? undefined}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs font-extrabold text-base-content flex items-center gap-1.5">
                          {msg.user?.name || (isCustomer ? 'مشتری' : 'کارشناس پشتیبانی')}
                          {isInternal ? (
                            <span className="badge badge-xs badge-warning gap-1 font-bold">
                              <Lock className="size-2.5" /> یادداشت محرمانه داخلی همکاران
                            </span>
                          ) : isCustomer ? (
                            <span className="badge badge-xs badge-primary badge-soft">مشتری</span>
                          ) : (
                            <span className="badge badge-xs badge-success badge-soft">
                              کارشناس سازمان
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-base-content/55">
                      {dateTimeFa(msg.created_at)}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-xs leading-7 text-base-content">
                    {msg.body}
                  </p>

                  {msg.attachment_url && (
                    <div className="pt-1">
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-base-300 bg-base-100 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-base-200"
                      >
                        <Download className="size-3.5" />
                        دانلود فایل پیوست ({msg.attachment_name || 'مشاهده فایل'})
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Reply / Internal Note Composer */}
          {canReply && (
            <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="join">
                  <button
                    type="button"
                    className={cx(
                      'btn btn-sm join-item gap-1.5',
                      composerMode === 'public' && 'btn-primary',
                    )}
                    onClick={() => setComposerMode('public')}
                  >
                    <MessageSquare className="size-4" /> ارسال پاسخ به مشتری
                  </button>
                  <button
                    type="button"
                    className={cx(
                      'btn btn-sm join-item gap-1.5',
                      composerMode === 'internal' && 'btn-warning',
                    )}
                    onClick={() => setComposerMode('internal')}
                  >
                    <Lock className="size-4" /> ثبت یادداشت محرمانه همکاران
                  </button>
                </div>

                {composerMode === 'internal' && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1">
                    <ShieldAlert className="size-3.5" /> این یادداشت در پنل مشتری نمایش داده نمی‌شود
                  </span>
                )}
              </div>

              <form onSubmit={handleReplySubmit} className="space-y-4">
                <textarea
                  rows={4}
                  className={cx(
                    'textarea textarea-bordered w-full text-xs leading-relaxed',
                    composerMode === 'internal' && 'border-amber-400/70 bg-amber-50/30 dark:bg-amber-950/20',
                  )}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={
                    composerMode === 'internal'
                      ? 'یادداشت فنی یا هماهنگی داخلی برای سایر کارشناسان سازمان (مخفی از دید مشتری)...'
                      : 'پاسخ رسمی خود را جهت نمایش در پنل کاربری مشتری بنویسید...'
                  }
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="btn btn-xs btn-outline gap-1.5 cursor-pointer">
                      <Paperclip className="size-3.5" />
                      <span className="max-w-[180px] truncate">
                        {attachment ? attachment.name : 'پیوست تصویر / PDF'}
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        className="hidden"
                        onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    {composerMode === 'public' && (
                      <select
                        className="select select-bordered select-xs h-8 text-xs"
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value as TicketStatus)}
                      >
                        <option value="answered">وضعیت پس از ارسال: پاسخ داده شده</option>
                        <option value="in_progress">وضعیت پس از ارسال: در دست اقدام فنی</option>
                        <option value="resolved">وضعیت پس از ارسال: رفع‌شده / تکمیل سرویس</option>
                        <option value="closed">وضعیت پس از ارسال: بستن تیکت</option>
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={cx(
                      'btn btn-sm gap-1.5',
                      composerMode === 'internal' ? 'btn-warning' : 'btn-primary',
                    )}
                    disabled={sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {composerMode === 'internal' ? 'ثبت یادداشت محرمانه' : 'ارسال پاسخ به مشتری'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Ticket Controls, Customer Info, Linked Device */}
        <div className="lg:col-span-4 space-y-4">
          {/* Status / Priority / Department / Assignee Management */}
          <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-base-content border-b border-base-200 pb-2.5">
              مدیریت وضعیت و ارجاع تیکت
            </h3>

            <Field label="وضعیت فعلی تیکت">
              <select
                className="select select-bordered select-sm w-full text-xs"
                value={ticket.status}
                disabled={!canReply || updateMetaMutation.isPending}
                onChange={(e) =>
                  updateMetaMutation.mutate({ status: e.target.value as TicketStatus })
                }
              >
                <option value="open">جدید (منتظر بررسی)</option>
                <option value="customer_reply">پاسخ مشتری</option>
                <option value="in_progress">در دست اقدام فنی</option>
                <option value="answered">پاسخ داده شده</option>
                <option value="resolved">رفع‌شده / تکمیل سرویس</option>
                <option value="closed">بسته شده</option>
              </select>
            </Field>

            <Field label="اولویت رسیدگی">
              <select
                className="select select-bordered select-sm w-full text-xs"
                value={ticket.priority}
                disabled={!canReply || updateMetaMutation.isPending}
                onChange={(e) =>
                  updateMetaMutation.mutate({ priority: e.target.value as TicketPriority })
                }
              >
                <option value="low">عادی</option>
                <option value="medium">متوسط</option>
                <option value="high">مهم</option>
                <option value="urgent">فوری (توقف دستگاه)</option>
              </select>
            </Field>

            <Can permission="tickets.manage">
              <Field
                label="انتقال به دپارتمان دیگر"
                hint="با تغییر دپارتمان، کارشناس جدید طبق الگوریتم آن دپارتمان تعیین می‌شود"
              >
                <select
                  className="select select-bordered select-sm w-full text-xs"
                  value={ticket.department_id ? String(ticket.department_id) : ''}
                  disabled={!canManageTicket || updateMetaMutation.isPending}
                  onChange={(e) =>
                    updateMetaMutation.mutate({
                      department_id: e.target.value ? Number(e.target.value) : null,
                      auto_reassign: true,
                    })
                  }
                >
                  <option value="">انتخاب دپارتمان...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="کارشناس پاسخگو (ارجاع دستی)">
                <select
                  className="select select-bordered select-sm w-full text-xs"
                  value={ticket.assigned_to_user_id ? String(ticket.assigned_to_user_id) : ''}
                  disabled={!canManageTicket || updateMetaMutation.isPending}
                  onChange={(e) =>
                    updateMetaMutation.mutate({
                      assigned_to_user_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">بدون کارشناس</option>
                  {staffOptions.map((st) => (
                    <option key={st.id} value={String(st.id)}>
                      {st.name} ({st.role_label})
                    </option>
                  ))}
                </select>
              </Field>
            </Can>
          </div>

          {/* Customer Info Card */}
          {ticket.customer && (
            <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-base-200 pb-2.5">
                <h3 className="font-extrabold text-sm text-base-content flex items-center gap-1.5">
                  <User className="size-4 text-primary" /> پرونده مشتری
                </h3>
                <Link
                  to={`/customers/${ticket.customer.id}`}
                  className="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline"
                >
                  مشاهده پرونده <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-bold text-sm text-base-content">
                  {customerDisplayName(ticket.customer)}
                </p>
                {ticket.customer.mobile && (
                  <p className="flex items-center gap-1.5 text-base-content/70 font-mono ltr-text">
                    <Phone className="size-3.5 text-primary" /> {digits(ticket.customer.mobile)}
                  </p>
                )}
                {ticket.customer.creator && (
                  <p className="text-base-content/65">
                    مسئول فروش پرونده: <b>{ticket.customer.creator.name}</b>
                  </p>
                )}
                {ticket.customer.sales_manager && (
                  <p className="text-base-content/65">
                    مدیر فروش پروژه: <b>{ticket.customer.sales_manager.name}</b>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Linked Device Card */}
          {ticket.customer_part && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/30 space-y-2.5">
              <h3 className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Cpu className="size-4 text-indigo-600 dark:text-indigo-400" />
                دستگاه مرتبط با این درخواست
              </h3>
              <div className="space-y-1 text-xs">
                <p className="font-bold text-base-content">
                  {ticket.customer_part.part?.name ?? 'دستگاه'}
                </p>
                <p className="font-mono text-base-content/70 ltr-text">
                  SN: {ticket.customer_part.serial_number}
                </p>
                {ticket.customer_part.installation_date && (
                  <p className="text-base-content/65">
                    تاریخ نصب: {dateFa(ticket.customer_part.installation_date)}
                  </p>
                )}
                {ticket.customer_part.warranty_expire_date && (
                  <p className="text-base-content/65">
                    پایان گارانتی: {dateFa(ticket.customer_part.warranty_expire_date)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
