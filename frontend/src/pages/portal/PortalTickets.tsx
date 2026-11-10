import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Cpu, LifeBuoy, Plus } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { EmptyState, TableSkeleton } from '../../components/ui/Field'
import { Pagination } from '../../components/ui/Pagination'
import { PortalCreateTicketModal } from '../../components/portal/PortalCreateTicketModal'
import { portalApi } from '../../services/api'
import { ticketPriorityMeta, ticketStatusMeta, ticketTypeMeta } from '../../utils/meta'
import { cx, relativeFa } from '../../utils/format'
import type { TicketType } from '../../types'

export default function PortalTickets() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: overviewData } = useQuery({
    queryKey: ['portal-overview'],
    queryFn: portalApi.overview,
  })

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['portal-tickets', q, statusFilter, typeFilter, page],
    queryFn: () =>
      portalApi.tickets({
        q: q.trim() || undefined,
        status: statusFilter || undefined,
        ticket_type: typeFilter || undefined,
        page,
      }),
  })

  const tickets = ticketsData?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="تیکت‌ها و درخواست‌های تعمیر من"
        subtitle="پیگیری لحظه‌ای وضعیت درخواست‌های تعمیر، پاسخ‌های واحد فنی و مکاتبات با واحد فروش"
        actions={
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" /> ثبت درخواست جدید
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-base-200 bg-base-100 p-4 shadow-xs sm:grid-cols-3">
        <SearchInput
          value={q}
          onChange={(val) => {
            setQ(val)
            setPage(1)
          }}
          placeholder="جستجو با کد رهگیری یا عنوان درخواست..."
        />

        <select
          className="select select-bordered select-sm h-10 w-full text-xs"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as TicketType | '')
            setPage(1)
          }}
        >
          <option value="">همه انواع درخواست</option>
          <option value="repair_request">اعلام خرابی و درخواست تعمیر</option>
          <option value="technical_support">پشتیبانی فنی</option>
          <option value="sales_inquiry">ارتباط با واحد فروش</option>
          <option value="general">سوال عمومی</option>
        </select>

        <select
          className="select select-bordered select-sm h-10 w-full text-xs"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="active_all">در جریان (باز)</option>
          <option value="answered">پاسخ داده شده توسط کارشناس</option>
          <option value="resolved">انجام‌شده / تکمیل سرویس</option>
          <option value="closed">بسته شده</option>
        </select>
      </div>

      {/* Tickets List */}
      <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="درخواستی یافت نشد"
            subtitle="می‌توانید از دکمه «ثبت درخواست جدید» در بالای صفحه جهت اعلام خرابی دستگاه یا ارسال پیام به واحد فروش استفاده نمایید."
          />
        ) : (
          <>
            <div className="divide-y divide-base-200">
              {tickets.map((t) => {
                const st = ticketStatusMeta[t.status] ?? ticketStatusMeta.open
                const pr = ticketPriorityMeta[t.priority] ?? ticketPriorityMeta.medium
                const ty = ticketTypeMeta[t.ticket_type] ?? ticketTypeMeta.general

                return (
                  <Link
                    key={t.id}
                    to={`/portal/tickets/${t.id}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-base-200/40 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-extrabold text-primary ltr-text">
                          {t.tracking_code}
                        </span>
                        <span className={cx('badge badge-xs font-semibold', ty.badgeClass)}>
                          {ty.label}
                        </span>
                        <span className={cx('badge badge-xs', pr.badgeClass)}>
                          اولویت: {pr.label}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-base-content truncate">
                        {t.subject}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-base-content/60">
                        <span>واحد رسیدگی: {t.department?.name || 'پشتیبانی'}</span>
                        {t.assignee && <span>• کارشناس پاسخگو: {t.assignee.name}</span>}
                        {t.customer_part && (
                          <span className="inline-flex items-center gap-1 text-primary font-semibold">
                            <Cpu className="size-3" /> {t.customer_part.part?.name} (
                            {t.customer_part.serial_number || 'بدون سریال'})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <span className={cx('badge badge-sm font-bold', st.badgeClass)}>
                        {st.label}
                      </span>
                      <span className="text-[11px] text-base-content/50">
                        {relativeFa(t.last_reply_at || t.created_at)}
                      </span>
                    </div>
                  </Link>
                )
              })}
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

      <PortalCreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        devices={overviewData?.devices ?? []}
        departments={overviewData?.departments ?? []}
        onCreated={(id) => nav(`/portal/tickets/${id}`)}
      />
    </div>
  )
}
