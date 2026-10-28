import { useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarClock, Filter, Percent, Plus, Target, Trophy, UserCheck, Wallet } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { DatePicker } from '../components/ui/DatePicker'
import { Field } from '../components/ui/Field'
import { useCreate, useList, useLookup } from '../hooks/useData'
import { createOne, patchOne } from '../services/api'
import { leadStages, SOURCES, stageProbability } from '../utils/meta'
import { toLatinDigits } from '../utils/csv'
import { compactToman, cx, dateFa, num, toman } from '../utils/format'
import type { Lead, LeadStage } from '../types'

export default function Pipeline() {
  const qc = useQueryClient()
  const { data: leads, isLoading } = useList('leads')
  const { map: users } = useLookup('users')
  const [open, setOpen] = useState(false)
  const [defaultStage, setDefaultStage] = useState<LeadStage>('new')

  const columns = useMemo(() => {
    const m = new Map<LeadStage, Lead[]>()
    leadStages.forEach((s) => m.set(s.id, []))
    leads.forEach((l) => m.get(l.stage)?.push(l))
    m.forEach((arr) => arr.sort((a, b) => a.order - b.order))
    return m
  }, [leads])

  const stats = useMemo(() => {
    const openLeads = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost')
    const won = leads.filter((l) => l.stage === 'won')
    const lost = leads.filter((l) => l.stage === 'lost')
    return {
      openCount: openLeads.length,
      openValue: openLeads.reduce((t, l) => t + l.value, 0),
      weighted: openLeads.reduce((t, l) => t + (l.value * l.probability) / 100, 0),
      wonValue: won.reduce((t, l) => t + l.value, 0),
      winRate: won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
    }
  }, [leads])

  const onDragEnd = async (r: DropResult) => {
    const { destination, source, draggableId } = r
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return
    const stage = destination.droppableId as LeadStage
    const dest = (columns.get(stage) ?? []).filter((l) => l.id !== draggableId)
    const prev = dest[destination.index - 1]?.order
    const next = dest[destination.index]?.order
    const order = prev === undefined && next === undefined ? 1 : prev === undefined ? next! - 1 : next === undefined ? prev + 1 : (prev + next) / 2
    const probability = stageProbability[stage]

    // optimistic update, then persist
    qc.setQueryData<Lead[]>(['leads'], (old) => old?.map((l) => (l.id === draggableId ? { ...l, stage, order, probability } : l)))
    try {
      await patchOne('leads', draggableId, { stage, order, probability })
      if (stage !== (source.droppableId as LeadStage)) {
        const label = leadStages.find((s) => s.id === stage)!.label
        toast.success(stage === 'won' ? '🎉 تبریک! فرصت فروش موفق شد' : `به مرحله «${label}» منتقل شد`)
      }
    } catch {
      toast.error('خطا در ذخیره تغییر')
      qc.invalidateQueries({ queryKey: ['leads'] })
    }
  }

  const convert = async (l: Lead) => {
    const [firstName, ...rest] = l.contactName.split(' ')
    const now = new Date().toISOString()
    try {
      await createOne('customers', {
        firstName, lastName: rest.join(' ') || '—', type: 'company', company: l.company, email: '', phone: l.phone,
        city: 'تهران', address: '', status: 'new', source: l.source, tags: [], assignedTo: l.assignedTo, notes: `تبدیل‌شده از فرصت فروش: ${l.title}`,
        createdAt: now, lastContact: now, totalSpent: 0, ordersCount: 0,
      })
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(`«${l.contactName}» به مشتریان افزوده شد`)
    } catch { toast.error('تبدیل ناموفق بود') }
  }

  return (
    <>
      <PageHeader
        title="کاریز فروش"
        subtitle="فرصت‌های فروش را بکشید و بین مراحل جابه‌جا کنید"
        actions={<button className="btn btn-sm btn-primary" onClick={() => { setDefaultStage('new'); setOpen(true) }}><Plus className="size-4" /> فرصت جدید</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="فرصت‌های باز" value={num(stats.openCount)} icon={Filter} tone="primary" loading={isLoading} />
        <StatCard title="ارزش کل کاریز" value={compactToman(stats.openValue)} icon={Wallet} tone="secondary" loading={isLoading} />
        <StatCard title="ارزش وزنی (پیش‌بینی)" value={compactToman(stats.weighted)} icon={Target} tone="warning" hint="بر اساس احتمال موفقیت" loading={isLoading} />
        <StatCard title="نرخ موفقیت" value={`${num(Math.round(stats.winRate))}٪`} icon={Trophy} tone="success" hint={`فروش موفق: ${compactToman(stats.wonValue)}`} loading={isLoading} />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="-mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {leadStages.map((stage) => {
            const items = columns.get(stage.id) ?? []
            const total = items.reduce((t, l) => t + l.value, 0)
            return (
              <section key={stage.id} className="flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-base-100/70 ring-1 ring-base-300/60 sm:w-80">
                <header className="flex items-center gap-2 px-4 pt-4">
                  <span className={cx('size-2.5 rounded-full', stage.color)} />
                  <h2 className="font-bold">{stage.label}</h2>
                  <span className="badge badge-sm badge-ghost">{num(items.length)}</span>
                  <button className="btn btn-ghost btn-xs btn-circle ms-auto" aria-label={`افزودن به ${stage.label}`} onClick={() => { setDefaultStage(stage.id); setOpen(true) }}>
                    <Plus className="size-4" />
                  </button>
                </header>
                <p className="px-4 pb-3 text-xs text-base-content/50">{compactToman(total)}</p>

                <Droppable droppableId={stage.id}>
                  {(drop, snap) => (
                    <div
                      ref={drop.innerRef}
                      {...drop.droppableProps}
                      className={cx('min-h-32 flex-1 space-y-3 rounded-b-2xl px-3 pb-3 transition-colors', snap.isDraggingOver && 'bg-primary/5')}
                    >
                      {items.map((l, i) => {
                        const owner = users.get(l.assignedTo)
                        return (
                          <Draggable key={l.id} draggableId={l.id} index={i}>
                            {(drag, ds) => (
                              <article
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                className={cx(
                                  'cursor-grab rounded-xl border border-base-300/70 bg-base-100 p-3.5 shadow-sm transition-shadow active:cursor-grabbing',
                                  ds.isDragging && 'rotate-1 shadow-xl ring-2 ring-primary/40',
                                )}
                              >
                                <p className="font-semibold leading-6">{l.title}</p>
                                <p className="mt-0.5 truncate text-xs text-base-content/60">{l.company} · {l.contactName}</p>
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="text-sm font-extrabold text-primary" title={toman(l.value)}>{compactToman(l.value)}</span>
                                  <span className="inline-flex items-center gap-0.5 text-xs text-base-content/60"><Percent className="size-3" />{num(l.probability)}</span>
                                </div>
                                <progress className="progress progress-primary mt-2 h-1" value={l.probability} max={100} />
                                <div className="mt-3 flex items-center justify-between text-xs text-base-content/50">
                                  <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{dateFa(l.expectedClose)}</span>
                                  {owner && <Avatar name={owner.name} size="xs" />}
                                </div>
                                {l.stage === 'won' && (
                                  <button
                                    className="btn btn-success btn-soft btn-xs mt-3 w-full"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => convert(l)}
                                  >
                                    <UserCheck className="size-3.5" /> تبدیل به مشتری
                                  </button>
                                )}
                              </article>
                            )}
                          </Draggable>
                        )
                      })}
                      {drop.placeholder}
                      {!items.length && !snap.isDraggingOver && <p className="py-6 text-center text-xs text-base-content/40">فرصتی در این مرحله نیست</p>}
                    </div>
                  )}
                </Droppable>
              </section>
            )
          })}
        </div>
      </DragDropContext>

      <LeadModal open={open} onClose={() => setOpen(false)} stage={defaultStage} leads={leads} />
    </>
  )
}

function LeadModal({ open, onClose, stage, leads }: { open: boolean; onClose: () => void; stage: LeadStage; leads: Lead[] }) {
  const create = useCreate('leads', { success: 'فرصت فروش جدید ثبت شد' })
  const { data: users } = useList('users')
  const [f, setF] = useState({ title: '', contactName: '', company: '', phone: '', value: '', source: SOURCES[0], assignedTo: 'u-3', expectedClose: new Date(Date.now() + 14 * 86_400_000).toISOString() })
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  const value = Number(toLatinDigits(f.value).replace(/[^\d]/g, ''))
  const errs = {
    title: f.title.trim().length < 3 && 'عنوان را وارد کنید',
    contactName: !f.contactName.trim() && 'نام مخاطب را وارد کنید',
    value: !value && 'ارزش را به تومان وارد کنید',
  }
  const submit = () => {
    setTouched(true)
    if (errs.title || errs.contactName || errs.value) return
    const order = Math.max(0, ...leads.filter((l) => l.stage === stage).map((l) => l.order)) + 1
    create.mutate(
      { ...f, title: f.title.trim(), contactName: f.contactName.trim(), phone: toLatinDigits(f.phone), value, stage, probability: stageProbability[stage], order, createdAt: new Date().toISOString() },
      { onSuccess: () => { setF((s) => ({ ...s, title: '', contactName: '', company: '', phone: '', value: '' })); setTouched(false); onClose() } },
    )
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`فرصت فروش جدید — ${leadStages.find((s) => s.id === stage)!.label}`}
      footer={<><button className="btn btn-ghost" onClick={onClose}>انصراف</button><button className="btn btn-primary" onClick={submit} disabled={create.isPending}>ثبت فرصت</button></>}>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="عنوان فرصت" required className="sm:col-span-2" error={touched ? errs.title || undefined : undefined}>
          <input className="input w-full" value={f.title} onChange={(e) => set('title')(e.target.value)} placeholder="مثلاً: تجهیز دفتر جدید" />
        </Field>
        <Field label="نام مخاطب" required error={touched ? errs.contactName || undefined : undefined}>
          <input className="input w-full" value={f.contactName} onChange={(e) => set('contactName')(e.target.value)} />
        </Field>
        <Field label="شرکت"><input className="input w-full" value={f.company} onChange={(e) => set('company')(e.target.value)} /></Field>
        <Field label="موبایل"><input dir="ltr" className="input w-full text-start" value={f.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
        <Field label="ارزش (تومان)" required error={touched ? errs.value || undefined : undefined} hint={value ? toman(value) : undefined}>
          <input dir="ltr" inputMode="numeric" className="input w-full text-start" value={f.value} onChange={(e) => set('value')(e.target.value)} />
        </Field>
        <Field label="منبع">
          <select className="select w-full" value={f.source} onChange={(e) => set('source')(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="کارشناس مسئول">
          <select className="select w-full" value={f.assignedTo} onChange={(e) => set('assignedTo')(e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </Field>
        <Field label="تاریخ پیش‌بینی بسته‌شدن" className="sm:col-span-2">
          <DatePicker value={f.expectedClose} onChange={(v) => v && set('expectedClose')(v)} />
        </Field>
      </div>
    </Modal>
  )
}
