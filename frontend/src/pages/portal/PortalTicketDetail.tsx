import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Cpu,
  Download,
  Paperclip,
  Send,
  UserCheck,
} from 'lucide-react'
import { PageSkeleton } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { portalApi } from '../../services/api'
import { ticketPriorityMeta, ticketStatusMeta, ticketTypeMeta } from '../../utils/meta'
import { cx, dateTimeFa } from '../../utils/format'

export default function PortalTicketDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()

  const [replyBody, setReplyBody] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['portal-ticket', id],
    queryFn: () => portalApi.getTicket(id!),
    enabled: Boolean(id),
  })

  const replyMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('body', replyBody.trim())
      if (attachment) fd.append('attachment', attachment)
      return portalApi.replyTicket(id!, fd)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      setReplyBody('')
      setAttachment(null)
      qc.invalidateQueries({ queryKey: ['portal-ticket', id] })
      qc.invalidateQueries({ queryKey: ['portal-tickets'] })
      qc.invalidateQueries({ queryKey: ['portal-overview'] })
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ارسال پیام')
    },
  })

  if (isLoading) {
    return <PageSkeleton />
  }

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-base-200 bg-base-100 p-10 text-center space-y-3">
        <p className="font-bold">تیکت مورد نظر یافت نشد.</p>
        <button className="btn btn-sm btn-primary" onClick={() => nav('/portal/tickets')}>
          بازگشت به لیست تیکت‌ها
        </button>
      </div>
    )
  }

  const st = ticketStatusMeta[ticket.status] ?? ticketStatusMeta.open
  const pr = ticketPriorityMeta[ticket.priority] ?? ticketPriorityMeta.medium
  const ty = ticketTypeMeta[ticket.ticket_type] ?? ticketTypeMeta.general
  const messages = ticket.messages ?? []

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim()) {
      toast.error('متن پاسخ خود را بنویسید')
      return
    }
    replyMutation.mutate()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn btn-sm btn-ghost gap-1.5"
          onClick={() => nav('/portal/tickets')}
        >
          <ArrowRight className="size-4" /> بازگشت به لیست درخواست‌های من
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-sm font-mono ltr-text bg-base-100 border border-base-300 font-bold">
            {ticket.tracking_code}
          </span>
          <span className={cx('badge badge-sm font-bold', ty.badgeClass)}>{ty.label}</span>
          <span className={cx('badge badge-sm', pr.badgeClass)}>اولویت: {pr.label}</span>
          <span className={cx('badge badge-sm font-bold', st.badgeClass)}>{st.label}</span>
        </div>
      </div>

      {/* Ticket Summary Header */}
      <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-3">
        <h1 className="text-lg font-extrabold text-base-content">{ticket.subject}</h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-base-content/65">
          <span>واحد رسیدگی: <b>{ticket.department?.name || 'پشتیبانی'}</b></span>
          {ticket.assignee && (
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="size-4 text-primary" />
              کارشناس پاسخگوی شما: <b>{ticket.assignee.name}</b>
            </span>
          )}
          {ticket.customer_part && (
            <span className="inline-flex items-center gap-1.5 text-primary font-bold">
              <Cpu className="size-4" />
              دستگاه: {ticket.customer_part.part?.name} (سریال: {ticket.customer_part.serial_number || 'بدون سریال'})
            </span>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_type === 'customer'
          return (
            <div
              key={msg.id}
              className={cx(
                'rounded-2xl border p-4 shadow-2xs space-y-2',
                isMe
                  ? 'border-primary/25 bg-primary/5'
                  : 'border-emerald-500/30 bg-emerald-500/5',
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-base-200/70 pb-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={msg.user?.name || (isMe ? 'شما' : 'کارشناس پشتیبانی')}
                    src={msg.user?.avatar_url ?? undefined}
                    size="sm"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-base-content">
                      {isMe ? 'پیام ارسالی شما' : msg.user?.name || 'کارشناس پشتیبانی'}
                    </span>
                    {!isMe && (
                      <span className="ms-2 badge badge-xs badge-success badge-soft font-bold">
                        پاسخ رسمی کارشناس
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-base-content/55">{dateTimeFa(msg.created_at)}</span>
              </div>

              <p className="whitespace-pre-wrap text-xs leading-7 text-base-content">{msg.body}</p>

              {msg.attachment_url && (
                <div className="pt-1">
                  <a
                    href={msg.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-base-300 bg-base-100 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-base-200"
                  >
                    <Download className="size-3.5" />
                    مشاهده فایل پیوست ({msg.attachment_name || 'دانلود'})
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Customer Follow-up Reply Box */}
      {ticket.status === 'closed' ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-center text-xs text-base-content/65">
          این تیکت بسته شده است. در صورت بروز مشکل جدید یا نیاز به راهنمایی، از صفحه تیکت‌ها درخواست جدیدی ثبت فرمایید.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4"
        >
          <p className="text-xs font-extrabold text-base-content">ارسال پاسخ یا توضیحات تکمیلی</p>
          <textarea
            rows={4}
            className="textarea textarea-bordered w-full text-xs leading-relaxed"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="پیام یا توضیحات تکمیلی خود را بنویسید..."
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <label className="btn btn-xs btn-outline gap-1.5 cursor-pointer">
              <Paperclip className="size-3.5" />
              <span className="max-w-[200px] truncate">
                {attachment ? attachment.name : 'پیوست تصویر / PDF (اختیاری)'}
              </span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="submit"
              className="btn btn-sm btn-primary gap-1.5"
              disabled={replyMutation.isPending}
            >
              {replyMutation.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Send className="size-4" />
              )}
              ارسال پیام
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
