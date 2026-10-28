import { useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarClock, CheckSquare, Clock, Filter, ListTodo, Plus } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { DatePicker } from '../components/ui/DatePicker'
import { Field } from '../components/ui/Field'
import { useCreate, useList, useLookup } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { patchOne } from '../services/api'
import { toLatinDigits } from '../utils/csv'
import { cx, dateFa, dateShort, fullName, num } from '../utils/format'
import type { Task, TaskStatus, Priority } from '../types'

const taskStatuses: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'برای انجام', color: 'bg-base-200' },
  { id: 'in-progress', label: 'در حال انجام', color: 'bg-primary/10' },
  { id: 'done', label: 'انجام شده', color: 'bg-success/10' }
]

const priorityMap: Record<Priority, { label: string; color: string }> = {
  low: { label: 'کم', color: 'text-info bg-info/10' },
  medium: { label: 'متوسط', color: 'text-warning bg-warning/10' },
  high: { label: 'فوری', color: 'text-error bg-error/10' },
}

export default function Tasks() {
  const qc = useQueryClient()
  const { data: tasks, isLoading } = useList('tasks')
  const { map: users } = useLookup('users')
  const { map: customers } = useLookup('customers')
  
  const [open, setOpen] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo')
  const [filterUser, setFilterUser] = useState<string>('all')

  const columns = useMemo(() => {
    const m = new Map<TaskStatus, Task[]>()
    taskStatuses.forEach((s) => m.set(s.id, []))
    
    tasks.forEach((t) => {
      if (filterUser === 'all' || t.assignedTo === filterUser) {
        m.get(t.status)?.push(t)
      }
    })
    
    // Sort by due date (closest first)
    m.forEach((arr) => arr.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()))
    return m
  }, [tasks, filterUser])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const destStatus = destination.droppableId as TaskStatus
    
    // Optimistic UI update
    qc.setQueryData(['tasks'], (old: Task[] | undefined) => {
      if (!old) return old
      return old.map(t => t.id === draggableId ? { ...t, status: destStatus } : t)
    })

    try {
      await patchOne('tasks', draggableId, { status: destStatus })
    } catch {
      toast.error('خطا در ذخیره تغییرات')
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  }

  const openNew = (status: TaskStatus) => {
    setDefaultStatus(status)
    setOpen(true)
  }

  // Stats
  const myTasks = tasks.filter(t => t.assignedTo === filterUser || filterUser === 'all')
  const todoCount = myTasks.filter(t => t.status === 'todo').length
  const progressCount = myTasks.filter(t => t.status === 'in-progress').length
  const doneCount = myTasks.filter(t => t.status === 'done').length

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <PageHeader title="مدیریت وظایف" subtitle="برنامه‌ریزی، تخصیص و پیگیری کارهای تیم" actions={<div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-base-100 border border-base-200 px-3 py-1.5 rounded-xl shadow-sm">
            <Filter className="size-4 opacity-50" />
            <select 
              className="select select-ghost select-sm px-0 font-medium"
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
            >
              <option value="all">همه اعضا</option>
              {Array.from(users.values()).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => openNew('todo')}>
            <Plus className="size-5" />
            وظیفه جدید
          </button>
        </div>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <StatCard
          title="برای انجام"
          value={num(todoCount)}
          icon={ListTodo}
        />
        <StatCard
          title="در حال انجام"
          value={num(progressCount)}
          icon={Clock}
        />
        <StatCard
          title="انجام شده"
          value={num(doneCount)}
          icon={CheckSquare}
        />
      </div>

      <div className="flex-1 overflow-x-auto pb-4 hide-scrollbar">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-w-[900px]">
            {taskStatuses.map((s) => (
              <div key={s.id} className="flex-1 flex flex-col bg-base-200/50 rounded-2xl border border-base-200 overflow-hidden">
                <div className={cx("p-3 font-bold border-b border-base-200/50 flex justify-between items-center", s.color)}>
                  <div className="flex items-center gap-2">
                    {s.label}
                    <span className="badge badge-sm badge-ghost bg-base-100">{num(columns.get(s.id)?.length || 0)}</span>
                  </div>
                  <button onClick={() => openNew(s.id)} className="btn btn-xs btn-ghost btn-circle">
                    <Plus className="size-4" />
                  </button>
                </div>
                
                <Droppable droppableId={s.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cx(
                        "flex-1 p-3 overflow-y-auto space-y-3 transition-colors",
                        snapshot.isDraggingOver ? "bg-base-200/80" : ""
                      )}
                    >
                      {columns.get(s.id)?.map((task, idx) => {
                        const user = users.get(task.assignedTo)
                        const customer = task.customerId ? customers.get(task.customerId) : null
                        const priority = priorityMap[task.priority]
                        const isLate = new Date(task.dueDate) < new Date() && task.status !== 'done'

                        return (
                          <Draggable key={task.id} draggableId={task.id} index={idx}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cx(
                                  "card bg-base-100 shadow-sm border border-base-200 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all",
                                  snapshot.isDragging ? "shadow-xl rotate-2 scale-105" : ""
                                )}
                              >
                                <div className="p-3">
                                  <div className="flex justify-between items-start mb-2 gap-2">
                                    <div className="font-bold text-sm leading-tight">{task.title}</div>
                                    <span className={cx("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", priority.color)}>
                                      {priority.label}
                                    </span>
                                  </div>
                                  
                                  {task.description && (
                                    <p className="text-xs text-base-content/60 line-clamp-2 mb-3">
                                      {task.description}
                                    </p>
                                  )}

                                  {customer && (
                                    <div className="text-[10px] text-base-content/70 mb-3 bg-base-200/50 px-2 py-1 rounded inline-block">
                                      مشتری: {fullName(customer)}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between mt-auto border-t border-base-100 pt-2">
                                    <div className={cx(
                                      "flex items-center gap-1 text-xs",
                                      isLate ? "text-error font-bold" : "text-base-content/50"
                                    )}>
                                      <CalendarClock className="size-3" />
                                      {dateShort(task.dueDate)}
                                    </div>
                                    <div className="tooltip" data-tip={user?.name}>
                                      <Avatar name={user?.name || '?'} size="sm" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {open && <NewTaskModal onClose={() => setOpen(false)} defaultStatus={defaultStatus} customers={customers} users={users} />}
    </div>
  )
}

function NewTaskModal({ 
  onClose, 
  defaultStatus,
  customers,
  users
}: { 
  onClose: () => void, 
  defaultStatus: TaskStatus,
  customers: Map<string, any>,
  users: Map<string, any>
}) {
  const me = useAuthStore(s => s.user)
  const createTask = useCreate('tasks')
  const [dateStr, setDateStr] = useState('')

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    await createTask.mutateAsync({
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      status: defaultStatus,
      priority: fd.get('priority') as Priority,
      dueDate: dateStr ? toLatinDigits(dateStr).replace(/\//g, '-') + 'T12:00:00Z' : new Date().toISOString(),
      assignedTo: fd.get('assignedTo') as string,
      customerId: fd.get('customerId') as string || null,
      createdAt: new Date().toISOString()
    })
    
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="وظیفه جدید">
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="عنوان وظیفه" required>
          <input name="title" required className="input input-bordered w-full" autoFocus />
        </Field>
        
        <Field label="توضیحات">
          <textarea name="description" className="textarea textarea-bordered w-full" rows={3} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="ارجاع به">
            <select name="assignedTo" className="select select-bordered w-full" defaultValue={me?.id}>
              {Array.from(users.values()).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="اولویت">
            <select name="priority" className="select select-bordered w-full" defaultValue="medium">
              <option value="low">کم</option>
              <option value="medium">متوسط</option>
              <option value="high">فوری</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="مهلت انجام (تاریخ)">
            <DatePicker value={dateStr} onChange={(v) => setDateStr(v || "")} placeholder="1403/05/20" />
          </Field>
          <Field label="مشتری مرتبط (اختیاری)">
            <select name="customerId" className="select select-bordered w-full">
              <option value="">بدون مشتری</option>
              {Array.from(customers.values()).map(c => (
                <option key={c.id} value={c.id}>{fullName(c)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button>
          <button type="submit" className="btn btn-primary" disabled={createTask.isPending}>
            ذخیره وظیفه
          </button>
        </div>
      </form>
    </Modal>
  )
}
