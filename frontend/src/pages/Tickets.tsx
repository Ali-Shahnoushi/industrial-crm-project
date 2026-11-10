import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Clock,
  Cpu,
  ExternalLink,
  LifeBuoy,
  MessageSquare,
  Paperclip,
  Plus,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { SearchInput } from '../components/ui/SearchInput'
import { EmptyState, Field, TableSkeleton } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { Avatar } from '../components/ui/Avatar'
import { Can } from '../components/common/Can'
import { customerApi, ticketApi } from '../services/api'
import { ticketPriorityMeta, ticketStatusMeta, ticketTypeMeta } from '../utils/meta'
import { customerDisplayName, cx, num, relativeFa } from '../utils/format'
import type { TicketPriority, TicketType } from '../types'

export default function Tickets() {
  const qc = useQueryClient()

  // Filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [scopeTab, setScopeTab] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [page, setPage] = useState(1)

  // Create Ticket Modal State
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedPartId, setSelectedPartId] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [ticketType, setTicketType] = useState<TicketType>('repair_request')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['tickets-summary'],
    queryFn: ticketApi.summary,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['ticket-departments-active'],
    queryFn: ticketApi.activeDepartments,
  })

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: [
      'tickets-list',
      q,
      statusFilter,
      priorityFilter,
      typeFilter,
      deptFilter,
      scopeTab,
      page,
    ],
    queryFn: () =>
      ticketApi.list({
        q: q.trim() || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        ticket_type: typeFilter || undefined,
        department_id: deptFilter || undefined,
        mine_only: scopeTab === 'mine' ? true : undefined,
        unassigned_only: scopeTab === 'unassigned' ? true : undefined,
        page,
        per_page: 15,
      }),
  })

  // Load accessible customers when create modal opens
  const { data: customersForCreate } = useQuery({
    queryKey: ['customers-for-ticket-create'],
    queryFn: () => customerApi.list({ per_page: 200 }),
    enabled: createOpen,
  })

  const { data: selectedCustomerDetail } = useQuery({
    queryKey: ['customer', selectedCustomerId],
    queryFn: () => customerApi.get(selectedCustomerId),
    enabled: createOpen && Boolean(selectedCustomerId),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('customer_id', selectedCustomerId)
      if (selectedPartId) fd.append('customer_part_id', selectedPartId)
      if (selectedDeptId) fd.append('department_id', selectedDeptId)
      fd.append('ticket_type', ticketType)
      fd.append('priority', priority)
      fd.append('subject', subject.trim())
      fd.append('body', body.trim())
      if (attachment) fd.append('attachment', attachment)
      return ticketApi.create(fd)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['tickets-list'] })
      qc.invalidateQueries({ queryKey: ['tickets-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setCreateOpen(false)
      setSelectedCustomerId('')
      setSelectedPartId('')
      setSubject('')
      setBody('')
      setAttachment(null)
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ثبت تیکت')
    },
  })

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedCustomerId) {
      toast.error('لطفاً مشتری را انتخاب کنید')
      return
    }
    if (!subject.trim() || !body.trim()) {
      toast.error('عنوان و شرح پیام تیکت الزامی است')
      return
    }
    createMutation.mutate()
  }

  const tickets = ticketsData?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرکز تیکتینگ و درخواست‌های تعمیر"
        subtitle="مدیریت متمرکز درخواست‌های تعمیر دستگاه‌ها، پشتیبانی فنی و پیام‌های مشتریان با ارجاع هوشمند دپارتمانی"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Can permission="settings.manage">
              <Link to="/settings/ticketing" className="btn btn-sm btn-outline gap-1.5">
                تنظیم دپارتمان‌ها
              </Link>
            </Can>
            <Can permission="tickets.reply">
              <button
                type="button"
                className="btn btn-sm btn-primary gap-1.5"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" /> ثبت تیکت جدید
              </button>
            </Can>
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="تیکت‌های باز و درجریان"
          value={num(summary?.open_active ?? 0)}
          icon={LifeBuoy}
          tone="primary"
          hint={`کل تیکت‌ها: ${num(summary?.total ?? 0)}`}
          loading={summaryLoading}
        />
        <StatCard
          title="منتظر پاسخ کارشناس"
          value={num(summary?.waiting_staff ?? 0)}
          icon={Clock}
          tone={(summary?.waiting_staff ?? 0) > 0 ? 'warning' : 'success'}
          hint="تیکت‌های جدید یا پاسخ مشتری"
          loading={summaryLoading}
        />
        <StatCard
          title="درخواست‌های تعمیر باز"
          value={num(summary?.repair_requests ?? 0)}
          icon={Wrench}
          tone="secondary"
          hint="اعلام خرابی دستگاه‌ها"
          loading={summaryLoading}
        />
        <StatCard
          title="تیکت‌های فوری / مهم"
          value={num(summary?.urgent_high ?? 0)}
          icon={AlertTriangle}
          tone={(summary?.urgent_high ?? 0) > 0 ? 'error' : 'info'}
          hint="اولویت بالا در صف رسیدگی"
          loading={summaryLoading}
        />
        <StatCard
          title="ارجاع‌شده به من"
          value={num(summary?.assigned_to_me ?? 0)}
          icon={UserCheck}
          tone="success"
          hint="تیکت‌های فعال در کارتابل شما"
          loading={summaryLoading}
        />
      </div>

      {/* Scope Tabs + Search & Filters */}
      <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="join">
            <button
              type="button"
              className={cx('btn btn-sm join-item', scopeTab === 'all' && 'btn-primary')}
              onClick={() => {
                setScopeTab('all')
                setPage(1)
              }}
            >
              همه تیکت‌های مجاز
            </button>
            <button
              type="button"
              className={cx('btn btn-sm join-item', scopeTab === 'mine' && 'btn-primary')}
              onClick={() => {
                setScopeTab('mine')
                setPage(1)
              }}
            >
              کارتابل من ({num(summary?.assigned_to_me ?? 0)})
            </button>
            <button
              type="button"
              className={cx('btn btn-sm join-item', scopeTab === 'unassigned' && 'btn-primary')}
              onClick={() => {
                setScopeTab('unassigned')
                setPage(1)
              }}
            >
              بدون کارشناس ({num(summary?.unassigned ?? 0)})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <SearchInput
            value={q}
            onChange={(val) => {
              setQ(val)
              setPage(1)
            }}
            placeholder="جستجوی کد رهگیری، موضوع، مشتری، سریال..."
          />

          <select
            className="select select-bordered select-sm h-10 w-full text-xs"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="active_all">همه تیکت‌های باز (فعال)</option>
            <option value="open">جدید (منتظر بررسی)</option>
            <option value="customer_reply">پاسخ مشتری</option>
            <option value="in_progress">در دست اقدام فنی</option>
            <option value="answered">پاسخ داده شده</option>
            <option value="resolved">رفع‌شده / تکمیل سرویس</option>
            <option value="closed">بسته شده</option>
          </select>

          <select
            className="select select-bordered select-sm h-10 w-full text-xs"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">همه انواع درخواست</option>
            <option value="repair_request">اعلام خرابی و درخواست تعمیر</option>
            <option value="technical_support">پشتیبانی فنی و کالیبراسیون</option>
            <option value="sales_inquiry">ارتباط با واحد فروش پروژه</option>
            <option value="general">سوال عمومی</option>
          </select>

          <select
            className="select select-bordered select-sm h-10 w-full text-xs"
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">همه دپارتمان‌ها</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            className="select select-bordered select-sm h-10 w-full text-xs"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">همه اولویت‌ها</option>
            <option value="urgent">فوری (توقف دستگاه)</option>
            <option value="high">مهم</option>
            <option value="medium">متوسط</option>
            <option value="low">عادی</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
        {ticketsLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="تیکتی با این فیلترها یافت نشد"
            subtitle="تمامی درخواست‌های تعمیر ثبت‌شده توسط مشتریان و تیکت‌های پشتیبانی در این کارتابل نمایش داده می‌شوند."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200/60 text-xs font-bold text-base-content/75">
                    <th>کد رهگیری / موضوع</th>
                    <th>مشتری</th>
                    <th>دستگاه مرتبط</th>
                    <th>دپارتمان / کارشناس پاسخگو</th>
                    <th>اولویت</th>
                    <th>وضعیت</th>
                    <th>آخرین بروزرسانی</th>
                    <th className="text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200 text-xs">
                  {tickets.map((t) => {
                    const stMeta = ticketStatusMeta[t.status] ?? ticketStatusMeta.open
                    const prMeta = ticketPriorityMeta[t.priority] ?? ticketPriorityMeta.medium
                    const tyMeta = ticketTypeMeta[t.ticket_type] ?? ticketTypeMeta.general

                    return (
                      <tr key={t.id} className="hover:bg-base-200/35 transition-colors">
                        <td className="max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-primary ltr-text">
                              {t.tracking_code}
                            </span>
                            <span className={cx('badge badge-xs font-semibold', tyMeta.badgeClass)}>
                              {tyMeta.label}
                            </span>
                          </div>
                          <Link
                            to={`/tickets/${t.id}`}
                            className="mt-1 block font-bold text-base-content hover:text-primary truncate"
                          >
                            {t.subject}
                          </Link>
                        </td>

                        <td>
                          {t.customer ? (
                            <Link
                              to={`/customers/${t.customer.id}`}
                              className="inline-flex items-center gap-1 font-bold text-base-content hover:text-primary"
                            >
                              {customerDisplayName(t.customer)}
                              <ExternalLink className="size-3 opacity-60" />
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td>
                          {t.customer_part ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-base-content flex items-center gap-1">
                                <Cpu className="size-3.5 text-primary shrink-0" />
                                <span className="truncate max-w-[150px]">
                                  {t.customer_part.part?.name ?? 'دستگاه'}
                                </span>
                              </p>
                              <p className="font-mono text-[10px] text-base-content/55 ltr-text">
                                {t.customer_part.serial_number}
                              </p>
                            </div>
                          ) : (
                            <span className="text-base-content/40">عمومی</span>
                          )}
                        </td>

                        <td>
                          <p className="font-semibold text-base-content/80">
                            {t.department?.name || 'بدون دپارتمان'}
                          </p>
                          {t.assignee ? (
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-base-content/65">
                              <Avatar
                                name={t.assignee.name}
                                src={t.assignee.avatar_url ?? undefined}
                                size="xs"
                              />
                              <span>{t.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-warning font-semibold">
                              در انتظار تخصیص کارشناس
                            </span>
                          )}
                        </td>

                        <td>
                          <span className={cx('badge badge-xs py-2', prMeta.badgeClass)}>
                            {prMeta.label}
                          </span>
                        </td>

                        <td>
                          <span className={cx('badge badge-xs font-bold py-2', stMeta.badgeClass)}>
                            {stMeta.label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap text-base-content/60">
                          {relativeFa(t.last_reply_at || t.created_at)}
                        </td>

                        <td className="text-left">
                          <Link to={`/tickets/${t.id}`} className="btn btn-xs btn-primary">
                            مشاهده و پاسخ
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {ticketsData && (
              <Pagination
                page={ticketsData.current_page}
                total={ticketsData.total}
                pageSize={15}
                onChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {/* Create Ticket Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="lg"
        title="ثبت تیکت یا درخواست تعمیر برای مشتری"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="staff-create-ticket-form"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <span className="loading loading-spinner loading-xs" />}
              ثبت و ارجاع هوشمند تیکت
            </button>
          </>
        }
      >
        <form id="staff-create-ticket-form" onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="انتخاب مشتری" required>
              <select
                className="select select-bordered w-full text-xs"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value)
                  setSelectedPartId('')
                }}
                required
              >
                <option value="">یک مشتری انتخاب کنید...</option>
                {(customersForCreate?.data ?? []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {customerDisplayName(c)} {c.mobile ? `(${c.mobile})` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="نوع درخواست">
              <select
                className="select select-bordered w-full text-xs"
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as TicketType)}
              >
                <option value="repair_request">اعلام خرابی و درخواست تعمیر دستگاه</option>
                <option value="technical_support">پشتیبانی فنی و کالیبراسیون</option>
                <option value="sales_inquiry">پیگیری فروش و قرارداد</option>
                <option value="general">سوال عمومی</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="دستگاه مرتبط مشتری (اختیاری)">
              <select
                className="select select-bordered w-full text-xs"
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(e.target.value)}
                disabled={!selectedCustomerId}
              >
                <option value="">بدون انتخاب دستگاه خاص</option>
                {(selectedCustomerDetail?.customer_parts ?? []).map((cp) => (
                  <option key={cp.id} value={String(cp.id)}>
                    {cp.part?.name ?? 'دستگاه'} — سریال: {cp.serial_number}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="دپارتمان رسیدگی‌کننده">
              <select
                className="select select-bordered w-full text-xs"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              >
                <option value="">انتخاب خودکار دپارتمان پیش‌فرض</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="اولویت رسیدگی">
              <select
                className="select select-bordered w-full text-xs"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
              >
                <option value="low">عادی</option>
                <option value="medium">متوسط</option>
                <option value="high">مهم</option>
                <option value="urgent">فوری (توقف خط تولید)</option>
              </select>
            </Field>
          </div>

          <Field label="عنوان تیکت" required>
            <input
              className="input input-bordered w-full text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: خطای سنسور دما روی دستگاه خط ۲"
              required
            />
          </Field>

          <Field label="شرح کامل درخواست / پیام اولیه" required>
            <textarea
              rows={4}
              className="textarea textarea-bordered w-full text-xs leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="جزئیات خرابی، علائم مشاهده‌شده یا درخواست مشتری را بنویسید..."
              required
            />
          </Field>

          <Field label="فایل پیوست تصویر یا PDF (اختیاری — حداکثر ۵ مگابایت)">
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-base-300 px-3 py-2 text-xs cursor-pointer hover:bg-base-200/50">
              <Paperclip className="size-4 text-primary" />
              <span className="truncate">
                {attachment ? attachment.name : 'انتخاب تصویر خطا یا مستندات PDF...'}
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
    </div>
  )
}
