import { useMemo, useState } from 'react'
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Clock, MapPin, Phone, Target, Video, Bell } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { useCreate, useList, useLookup } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { cx, dateShort, fullName, num } from '../utils/format'
import { fromJ, isSameDay, JALALI_MONTHS, monthGrid, shiftMonth, toJ, WEEKDAYS_SHORT } from '../utils/jalali'
import type { CalendarEvent, EventType } from '../types'

const EVENT_ICONS: Record<EventType, any> = {
  meeting: Video,
  call: Phone,
  deadline: Target,
  reminder: Bell,
}

const EVENT_COLORS: Record<EventType, string> = {
  meeting: 'bg-primary/20 text-primary-focus border-primary/30',
  call: 'bg-success/20 text-success-focus border-success/30',
  deadline: 'bg-error/20 text-error-focus border-error/30',
  reminder: 'bg-warning/20 text-warning-focus border-warning/30',
}

const EVENT_LABELS: Record<EventType, string> = {
  meeting: 'جلسه',
  call: 'تماس',
  deadline: 'سررسید',
  reminder: 'یادآور',
}

export default function Calendar() {
  const { data: events, isLoading } = useList('events')
  const { map: customers } = useLookup('customers')
  
  const [curr, setCurr] = useState(() => toJ(new Date())) // { jy, jm, jd }
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  
  const grid = useMemo(() => monthGrid(curr.jy, curr.jm), [curr])

  const nextMonth = () => setCurr({ ...shiftMonth(curr.jy, curr.jm, 1), jd: 1 })
  const prevMonth = () => setCurr({ ...shiftMonth(curr.jy, curr.jm, -1), jd: 1 })

  // Map events to their JDate start date string 'YYYY/MM/DD' to group them easily
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach(e => {
      const d = new Date(e.start)
      const { jy, jm, jd } = toJ(d)
      const key = `${jy}/${jm}/${jd}`
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    })
    return map
  }, [events])

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader 
        title="تقویم" 
        subtitle="برنامه‌ریزی جلسات، تماس‌ها و رویدادها"
       actions={<button className="btn btn-primary" onClick={() => setSelectedDay(new Date())}>
          افزودن رویداد</button>} />

      <div className="card bg-base-100 shadow-sm border border-base-200 flex-1 flex flex-col overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="font-bold text-xl flex items-center gap-2">
            <CalIcon className="size-6 text-primary" />
            {JALALI_MONTHS[curr.jm - 1]} {curr.jy}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-ghost btn-circle" onClick={prevMonth}>
              <ChevronRight className="size-5" />
            </button>
            <button className="btn btn-sm" onClick={() => setCurr(toJ(new Date()))}>امروز</button>
            <button className="btn btn-sm btn-ghost btn-circle" onClick={nextMonth}>
              <ChevronLeft className="size-5" />
            </button>
          </div>
        </div>

        {/* Grid Header (Weekdays) */}
        <div className="grid grid-cols-7 border-b border-base-200 bg-base-50">
          {WEEKDAYS_SHORT.map(w => (
            <div key={w} className="py-2 text-center font-bold text-sm text-base-content/60 border-e border-base-200 last:border-e-0">
              {w}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 min-h-full auto-rows-[minmax(120px,1fr)]">
            {grid.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="bg-base-200/20 border-e border-b border-base-200" />
              }

              const isToday = isSameDay(fromJ(curr.jy, curr.jm, day), new Date())
              const key = `${curr.jy}/${curr.jm}/${day}`
              const dayEvents = eventsByDay.get(key) || []

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDay(fromJ(curr.jy, curr.jm, day))}
                  className={cx(
                    "border-e border-b border-base-200 p-2 transition-colors cursor-pointer hover:bg-base-200/30",
                    isToday ? "bg-primary/5" : ""
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cx(
                      "flex items-center justify-center size-7 rounded-full text-sm font-medium",
                      isToday ? "bg-primary text-primary-content" : "text-base-content/70"
                    )}>
                      {num(day)}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="badge badge-sm badge-ghost">{num(dayEvents.length)}</span>
                    )}
                  </div>
                  
                  <div className="space-y-1 overflow-y-auto max-h-[80px] hide-scrollbar">
                    {dayEvents.slice(0, 3).map(e => {
                      const Icon = EVENT_ICONS[e.type]
                      return (
                        <div 
                          key={e.id} 
                          className={cx("text-[10px] p-1 px-1.5 rounded flex items-center gap-1 border", EVENT_COLORS[e.type])}
                          title={e.title}
                        >
                          <Icon className="size-3 shrink-0" />
                          <span className="truncate">{e.title}</span>
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-center text-base-content/50">
                        + {num(dayEvents.length - 3)} رویداد دیگر
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <DayModal 
          date={selectedDay} 
          onClose={() => setSelectedDay(null)} 
          events={events}
          customers={customers}
        />
      )}
    </div>
  )
}

function DayModal({ 
  date, 
  onClose,
  events,
  customers
}: { 
  date: Date, 
  onClose: () => void,
  events: CalendarEvent[],
  customers: Map<string, any>
}) {
  const [showAdd, setShowAdd] = useState(false)
  
  const dayEvents = events.filter(e => isSameDay(new Date(e.start), date))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return (
    <Modal open onClose={onClose} title={`رویدادهای ${dateShort(date.toISOString())}`}>
      {!showAdd ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-base-200 p-3 rounded-xl">
            <div className="font-medium">{num(dayEvents.length)} رویداد ثبت شده</div>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
              ثبت رویداد جدید
            </button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pe-2">
            {dayEvents.length === 0 ? (
              <div className="p-8 text-center text-base-content/50 border border-dashed rounded-xl">
                هیچ رویدادی برای این روز ثبت نشده است.
              </div>
            ) : (
              dayEvents.map(e => {
                const Icon = EVENT_ICONS[e.type]
                const customer = e.customerId ? customers.get(e.customerId) : null
                const start = new Date(e.start)
                
                return (
                  <div key={e.id} className={cx("p-3 rounded-xl border", EVENT_COLORS[e.type])}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold">
                        <Icon className="size-4" />
                        {e.title}
                      </div>
                      <div className="badge badge-sm bg-base-100/50 border-0">{EVENT_LABELS[e.type]}</div>
                    </div>
                    
                    <div className="text-xs space-y-1.5 opacity-80">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0')
                      </div>
                      {customer && (
                        <div className="flex items-center gap-1.5">
                          <Target className="size-3" />
                          مشتری: {fullName(customer)}
                        </div>
                      )}
                      {e.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3" />
                          {e.location}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        <AddEventForm date={date} onCancel={() => setShowAdd(false)} onSaved={onClose} customers={customers} />
      )}
    </Modal>
  )
}

function AddEventForm({ 
  date, 
  onCancel, 
  onSaved,
  customers
}: { 
  date: Date, 
  onCancel: () => void, 
  onSaved: () => void,
  customers: Map<string, any>
}) {
  const me = useAuthStore(s => s.user)
  const createEvent = useCreate('events')

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    // Parse time
    const timeStr = fd.get('time') as string || '12:00'
    const [h, m] = timeStr.split(':')
    const start = new Date(date)
    start.setHours(Number(h), Number(m), 0, 0)
    
    // Add 1 hour for end
    const end = new Date(start)
    end.setHours(start.getHours() + 1)
    
    await createEvent.mutateAsync({
      title: fd.get('title') as string,
      type: fd.get('type') as EventType,
      start: start.toISOString(),
      end: end.toISOString(),
      customerId: fd.get('customerId') as string || null,
      userId: me?.id || '1',
      location: fd.get('location') as string
    })
    
    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Field label="عنوان رویداد" required>
        <input name="title" required className="input input-bordered w-full" autoFocus placeholder="مثلا: جلسه معرفی با مشتری" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="نوع رویداد" required>
          <select name="type" className="select select-bordered w-full">
            {Object.entries(EVENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="ساعت شروع" required>
          <input name="time" type="time" defaultValue="10:00" className="input input-bordered w-full" />
        </Field>
      </div>

      <Field label="مشتری مرتبط (اختیاری)">
        <select name="customerId" className="select select-bordered w-full">
          <option value="">بدون مشتری</option>
          {Array.from(customers.values()).map(c => (
            <option key={c.id} value={c.id}>{fullName(c)} - {c.company}</option>
          ))}
        </select>
      </Field>

      <Field label="مکان / لینک جلسه (اختیاری)">
        <input name="location" className="input input-bordered w-full text-left" dir="auto" placeholder="Google Meet / اتاق کنفرانس 1" />
      </Field>

      <div className="flex gap-2 justify-end mt-6">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>بازگشت</button>
        <button type="submit" className="btn btn-primary" disabled={createEvent.isPending}>
          ذخیره رویداد
        </button>
      </div>
    </form>
  )
}
