import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Paperclip } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { portalApi } from '../../services/api'
import type { PortalDevice, TicketDepartment, TicketPriority, TicketType } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  devices: PortalDevice[]
  departments: Array<Pick<TicketDepartment, 'id' | 'name' | 'description' | 'is_default_repair'>>
  initialType?: TicketType
  initialDeviceId?: number | null
  initialTargetContact?: 'sales_rep' | 'sales_manager' | null
  targetContactName?: string | null
  onCreated?: (ticketId: number) => void
}

export function PortalCreateTicketModal(props: Props) {
  if (!props.open) return null

  const formKey = `${props.initialType ?? 'repair_request'}-${props.initialDeviceId ?? 'none'}-${props.initialTargetContact ?? 'none'}`
  return <PortalCreateTicketModalInner key={formKey} {...props} />
}

function PortalCreateTicketModalInner({
  open,
  onClose,
  devices,
  departments,
  initialType = 'repair_request',
  initialDeviceId = null,
  initialTargetContact = null,
  targetContactName = null,
  onCreated,
}: Props) {
  const qc = useQueryClient()

  const [ticketType, setTicketType] = useState<TicketType>(initialType)
  const [deviceId, setDeviceId] = useState<string>(initialDeviceId ? String(initialDeviceId) : '')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [priority, setPriority] = useState<TicketPriority>(
    initialType === 'repair_request' ? 'high' : 'medium',
  )
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('ticket_type', ticketType)
      if (deviceId) fd.append('customer_part_id', deviceId)
      if (departmentId) fd.append('department_id', departmentId)
      if (initialTargetContact && ticketType === 'sales_inquiry') {
        fd.append('target_contact', initialTargetContact)
      }
      fd.append('priority', priority)
      fd.append('subject', subject.trim())
      fd.append('body', body.trim())
      if (attachment) fd.append('attachment', attachment)
      return portalApi.createTicket(fd)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['portal-overview'] })
      qc.invalidateQueries({ queryKey: ['portal-devices'] })
      qc.invalidateQueries({ queryKey: ['portal-tickets'] })
      onClose()
      if (onCreated && res.ticket?.id) {
        onCreated(res.ticket.id)
      }
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ثبت درخواست')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) {
      toast.error('لطفاً عنوان و شرح کامل درخواست را بنویسید')
      return
    }
    createMutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        initialTargetContact && targetContactName
          ? `ارسال پیام مستقیم به «${targetContactName}»`
          : ticketType === 'repair_request'
            ? 'ثبت خرابی یا درخواست تعمیر دستگاه'
            : 'ثبت درخواست و تیکت پشتیبانی جدید'
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            انصراف
          </button>
          <button
            type="submit"
            form="portal-new-ticket-form"
            className="btn btn-primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && <span className="loading loading-spinner loading-xs" />}
            ثبت و ارسال درخواست
          </button>
        </>
      }
    >
      <form id="portal-new-ticket-form" onSubmit={handleSubmit} className="space-y-4">
        {initialTargetContact && targetContactName && (
          <div className="rounded-xl border border-primary/30 bg-primary/8 px-3.5 py-2.5 text-xs">
            این پیام مستقیماً برای <b>{targetContactName}</b> ثبت و در پنل شما قابل پیگیری خواهد بود.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="موضوع و نوع درخواست" required>
            <select
              className="select select-bordered w-full text-xs"
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value as TicketType)}
            >
              <option value="repair_request">اعلام خرابی و درخواست تعمیر دستگاه</option>
              <option value="technical_support">پشتیبانی فنی و راه‌اندازی</option>
              <option value="sales_inquiry">ارتباط با واحد فروش پروژه</option>
              <option value="general">سوال و پیگیری عمومی</option>
            </select>
          </Field>

          <Field label="سطح فوریت">
            <select
              className="select select-bordered w-full text-xs"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              <option value="low">عادی</option>
              <option value="medium">متوسط</option>
              <option value="high">مهم</option>
              <option value="urgent">فوری (توقف کامل دستگاه)</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="انتخاب دستگاه مرتبط"
            hint={ticketType === 'repair_request' ? 'دستگاه دچار خرابی را انتخاب کنید' : 'اختیاری'}
          >
            <select
              className="select select-bordered w-full text-xs"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <option value="">بدون انتخاب دستگاه خاص</option>
              {devices.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.part?.name ?? 'دستگاه'} — سریال: {d.serial_number || 'بدون سریال'}{' '}
                  {d.is_under_warranty ? '(تحت گارانتی)' : ''}
                </option>
              ))}
            </select>
          </Field>

          {!initialTargetContact && (
            <Field label="واحد رسیدگی‌کننده">
              <select
                className="select select-bordered w-full text-xs"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">ارجاع هوشمند به واحد تخصصی مربوطه</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="عنوان درخواست یا خلاصه ایراد" required>
          <input
            className="input input-bordered w-full text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              ticketType === 'repair_request'
                ? 'مثال: نمایش کد خطای E-04 و روشن نشدن دستگاه'
                : 'مثال: درخواست پیش‌فاکتور یا هماهنگی بازدید دوره‌ای'
            }
            required
          />
        </Field>

        <Field label="شرح کامل علائم خرابی یا پیام شما" required>
          <textarea
            rows={4}
            className="textarea textarea-bordered w-full text-xs leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="لطفاً جزئیات کامل مشکل، زمان بروز خطا یا پیام خود را بنویسید تا کارشناس مربوطه سریع‌تر راهنمایی کند..."
            required
          />
        </Field>

        <Field label="تصویر خطا یا مستندات پیوست (اختیاری — حداکثر ۵ مگابایت)">
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-base-300 px-3 py-2 text-xs cursor-pointer hover:bg-base-200/50">
            <Paperclip className="size-4 text-primary" />
            <span className="truncate">
              {attachment ? attachment.name : 'انتخاب تصویر از صفحه نمایش دستگاه یا فایل PDF...'}
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
      </form>
    </Modal>
  )
}
