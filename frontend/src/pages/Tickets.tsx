import { useMemo, useState } from 'react'
import { CheckCircle, Circle, Clock, MessageSquare, Plus, Search, Tag, User } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { SearchInput } from '../components/ui/SearchInput'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { EmptyState, Field, TableSkeleton } from '../components/ui/Field'
import { useCreate, useList, useLookup, useUpdate } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { cx, dateFa, dateTimeFa, dateShort, fullName, num } from '../utils/format'
import type { Ticket, TicketStatus, Priority, TicketMessage } from '../types'

const PAGE_SIZE = 10

const STATUS_MAP: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'باز', color: 'badge-primary' },
  pending: { label: 'در انتظار', color: 'badge-warning' },
  resolved: { label: 'حل شده', color: 'badge-success' },
  closed: { label: 'بسته', color: 'badge-ghost' },
}

const PRIORITY_MAP: Record<Priority, { label: string; color: string }> = {
  low: { label: 'کم', color: 'text-info' },
  medium: { label: 'متوسط', color: 'text-warning' },
  high: { label: 'زیاد', color: 'text-error' },
}

export default function Tickets() {
  const { data: tickets, isLoading } = useList('tickets')
  const { map: users } = useLookup('users')
  const { map: customers } = useLookup('customers')
  
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TicketStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [createModal, setCreateModal] = useState(false)

  // Filters
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (status !== 'all' && t.status !== status) return false
      if (q) {
        const term = q.toLowerCase()
        return t.subject.toLowerCase().includes(term) || t.number.toLowerCase().includes(term)
      }
      return true
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [tickets, q, status])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // Stats
  const openTickets = tickets.filter(t => t.status === 'open').length
  const pendingTickets = tickets.filter(t => t.status === 'pending').length
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length

  return (
    <div className="space-y-6">
      <PageHeader 
        title="پشتیبانی و تیکت‌ها" 
        subtitle="مدیریت درخواست‌های پشتیبانی و پاسخگویی به مشتریان"
       actions={<button className="btn btn-primary" onClick={() => setCreateModal(true)}><Plus className="size-5" />
          <Plus className="size-5" />
          تیکت جدید</button>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="تیکت‌های باز"
          value={num(openTickets)}
          icon={Circle}
        />
        <StatCard
          title="در انتظار پاسخ"
          value={num(pendingTickets)}
          icon={Clock}
        />
        <StatCard
          title="حل شده"
          value={num(resolvedTickets)}
          icon={CheckCircle}
        />
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200 flex lg:flex-row flex-col overflow-hidden min-h-[600px]">
        {/* Ticket List */}
        <div className={cx(
          "flex-1 border-e border-base-200 flex flex-col",
          activeTicket ? "hidden lg:flex lg:max-w-md" : "flex"
        )}>
          <div className="p-4 border-b border-base-200 space-y-3">
            <SearchInput 
              placeholder="جستجو در موضوع یا شماره..." 
              value={q} 
              onChange={setQ} 
              className="w-full" 
            />
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button 
                className={cx("btn btn-sm rounded-full", status === 'all' ? "btn-neutral" : "btn-ghost")} 
                onClick={() => setStatus('all')}
              >همه</button>
              <button 
                className={cx("btn btn-sm rounded-full", status === 'open' ? "btn-primary" : "btn-ghost")} 
                onClick={() => setStatus('open')}
              >باز</button>
              <button 
                className={cx("btn btn-sm rounded-full", status === 'pending' ? "btn-warning" : "btn-ghost")} 
                onClick={() => setStatus('pending')}
              >در انتظار</button>
              <button 
                className={cx("btn btn-sm rounded-full", status === 'resolved' ? "btn-success" : "btn-ghost")} 
                onClick={() => setStatus('resolved')}
              >حل شده</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="p-4 flex justify-center"><span className="loading loading-spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-base-content/50">
                تیکتی یافت نشد
              </div>
            ) : (
              filtered.map(t => {
                const customer = customers.get(t.customerId)
                return (
                  <button
                    key={t.id}
                    className={cx(
                      "w-full text-right p-3 rounded-xl transition-colors hover:bg-base-200/50",
                      activeTicket?.id === t.id ? "bg-base-200" : ""
                    )}
                    onClick={() => setActiveTicket(t)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium truncate pe-2">{t.subject}</div>
                      <div className={cx("badge badge-sm", STATUS_MAP[t.status].color)}>
                        {STATUS_MAP[t.status].label}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-base-content/60">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px]">{t.number}</span>
                        <span>•</span>
                        <span>{customer ? fullName(customer) : 'ناشناس'}</span>
                      </div>
                      <div>{dateShort(t.createdAt)}</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Ticket Detail / Conversation */}
        <div className={cx(
          "flex-[2] flex flex-col bg-base-50/30",
          !activeTicket ? "hidden lg:flex items-center justify-center" : "flex"
        )}>
          {!activeTicket ? (
            <EmptyState title="تیکتی انتخاب نشده" 
              description="برای مشاهده گفتگوها، یک تیکت از لیست انتخاب کنید."
            />
          ) : (
            <TicketConversation 
              ticket={activeTicket} 
              onBack={() => setActiveTicket(null)} 
              users={users}
              customers={customers}
            />
          )}
        </div>
      </div>

      {createModal && (
        <CreateTicketModal onClose={() => setCreateModal(false)} customers={customers} />
      )}
    </div>
  )
}

function TicketConversation({ 
  ticket, 
  onBack,
  users,
  customers
}: { 
  ticket: Ticket, 
  onBack: () => void,
  users: Map<string, any>,
  customers: Map<string, any>
}) {
  const me = useAuthStore(s => s.user)
  const updateTicket = useUpdate('tickets')
  const [reply, setReply] = useState('')

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || !me) return

    const newMessage: TicketMessage = {
      from: 'agent',
      text: reply,
      date: new Date().toISOString()
    }

    await updateTicket.mutateAsync({
      id: ticket.id,
      messages: [...ticket.messages, newMessage],
      status: ticket.status === 'open' ? 'pending' : ticket.status
    })

    setReply('')
  }

  const handleStatusChange = async (status: TicketStatus) => {
    await updateTicket.mutateAsync({ id: ticket.id, status })
  }

  const customer = customers.get(ticket.customerId)
  const assignee = users.get(ticket.assignedTo)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-base-200 bg-base-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn btn-circle btn-sm btn-ghost lg:hidden" onClick={onBack}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div>
            <div className="font-bold flex items-center gap-2">
              {ticket.subject}
              <span className={cx("badge badge-sm", STATUS_MAP[ticket.status].color)}>
                {STATUS_MAP[ticket.status].label}
              </span>
            </div>
            <div className="text-xs text-base-content/60 flex items-center gap-2 mt-1">
              <span>{ticket.number}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><User className="size-3"/> {customer ? fullName(customer) : 'ناشناس'}</span>
              <span>•</span>
              <span>دسته: {ticket.category}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="select select-sm select-bordered" 
            value={ticket.status}
            onChange={e => handleStatusChange(e.target.value as TicketStatus)}
          >
            <option value="open">باز</option>
            <option value="pending">در انتظار</option>
            <option value="resolved">حل شده</option>
            <option value="closed">بسته</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-base-200/30">
        {ticket.messages.map((m, i) => {
          const isAgent = m.from === 'agent'
          return (
            <div key={i} className={cx("chat", isAgent ? "chat-start" : "chat-end")}>
              <div className="chat-image avatar">
                <div className="w-10 rounded-full bg-base-300 flex items-center justify-center">
                  {isAgent ? (
                    <span className="text-xs">{assignee?.name.substring(0, 2) || 'AG'}</span>
                  ) : (
                    <span className="text-xs">{customer?.firstName.substring(0, 2) || 'CU'}</span>
                  )}
                </div>
              </div>
              <div className="chat-header text-xs mb-1">
                {isAgent ? (assignee?.name || 'پشتیبان') : (customer ? fullName(customer) : 'مشتری')}
                <time className="text-xs opacity-50 ms-2">{dateTimeFa(m.date)}</time>
              </div>
              <div className={cx("chat-bubble", isAgent ? "chat-bubble-primary" : "chat-bubble-neutral")}>
                {m.text}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply Box */}
      {ticket.status !== 'closed' ? (
        <div className="p-4 border-t border-base-200 bg-base-100">
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <textarea 
              className="textarea textarea-bordered flex-1" 
              placeholder="پاسخ خود را بنویسید..." 
              rows={2}
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!reply.trim() || updateTicket.isPending}>
              ارسال پاسخ
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 border-t border-base-200 bg-base-200 text-center text-sm text-base-content/60">
          این تیکت بسته شده است و امکان ارسال پیام وجود ندارد.
        </div>
      )}
    </div>
  )
}

function CreateTicketModal({ onClose, customers }: { onClose: () => void, customers: Map<string, any> }) {
  const me = useAuthStore(s => s.user)
  const createTicket = useCreate('tickets')
  
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    await createTicket.mutateAsync({
      number: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: fd.get('subject') as string,
      category: fd.get('category') as string,
      customerId: fd.get('customerId') as string,
      priority: fd.get('priority') as Priority,
      status: 'open',
      assignedTo: me?.id || '1',
      createdAt: new Date().toISOString(),
      messages: [
        {
          from: 'customer',
          text: fd.get('message') as string,
          date: new Date().toISOString()
        }
      ]
    })
    
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="ثبت تیکت جدید">
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="مشتری" required>
          <select name="customerId" className="select select-bordered w-full" required>
            <option value="">انتخاب مشتری...</option>
            {Array.from(customers.values()).map(c => (
              <option key={c.id} value={c.id}>{fullName(c)} - {c.company}</option>
            ))}
          </select>
        </Field>

        <Field label="موضوع تیکت" required>
          <input name="subject" required className="input input-bordered w-full" placeholder="مثلا: مشکل در ورود به سیستم" />
        </Field>
        
        <div className="grid grid-cols-2 gap-4">
          <Field label="دسته‌بندی" required>
            <select name="category" className="select select-bordered w-full">
              <option value="فنی">فنی</option>
              <option value="مالی">مالی</option>
              <option value="فروش">فروش</option>
              <option value="سایر">سایر</option>
            </select>
          </Field>
          <Field label="اولویت" required>
            <select name="priority" className="select select-bordered w-full">
              <option value="low">کم</option>
              <option value="medium">متوسط</option>
              <option value="high">زیاد</option>
            </select>
          </Field>
        </div>

        <Field label="متن پیام (از طرف مشتری)" required>
          <textarea name="message" required className="textarea textarea-bordered w-full" rows={4} placeholder="شرح درخواست..." />
        </Field>

        <div className="flex gap-2 justify-end mt-6">
          <button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button>
          <button type="submit" className="btn btn-primary" disabled={createTicket.isPending}>
            ثبت تیکت
          </button>
        </div>
      </form>
    </Modal>
  )
}
