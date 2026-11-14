import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Check,
  LifeBuoy,
  Pencil,
  Plus,
  Shuffle,
  Sliders,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, Field, PageSkeleton } from '../../components/ui/Field'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Avatar } from '../../components/ui/Avatar'
import { ticketDepartmentAdminApi } from '../../services/api'
import { assignmentStrategyMeta } from '../../utils/meta'
import { cx, num } from '../../utils/format'
import type { AssignmentStrategy, TicketDepartment } from '../../types'

export default function TicketingSettingsPage() {
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<TicketDepartment | null>(null)
  const [deletingDept, setDeletingDept] = useState<TicketDepartment | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [strategy, setStrategy] = useState<AssignmentStrategy>('round_robin')
  const [isDefaultRepair, setIsDefaultRepair] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([])
  const [staffFilter, setStaffFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ticket-departments'],
    queryFn: ticketDepartmentAdminApi.list,
  })

  const departments = data?.departments ?? []
  const staffCandidates = data?.staff_candidates ?? []

  const openCreate = () => {
    setEditingDept(null)
    setName('')
    setDescription('')
    setStrategy('round_robin')
    setIsDefaultRepair(departments.length === 0)
    setIsActive(true)
    setSelectedAgentIds([])
    setStaffFilter('')
    setModalOpen(true)
  }

  const openEdit = (dept: TicketDepartment) => {
    setEditingDept(dept)
    setName(dept.name)
    setDescription(dept.description ?? '')
    setStrategy(dept.assignment_strategy || 'round_robin')
    setIsDefaultRepair(Boolean(dept.is_default_repair))
    setIsActive(Boolean(dept.is_active))
    setSelectedAgentIds(dept.agent_ids ?? dept.agents?.map((a) => a.id) ?? [])
    setStaffFilter('')
    setModalOpen(true)
  }

  const toggleAgent = (id: number) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        assignment_strategy: strategy,
        is_default_repair: isDefaultRepair,
        is_active: isActive,
        agent_ids: selectedAgentIds,
      }
      if (editingDept) {
        return ticketDepartmentAdminApi.update(editingDept.id, payload)
      }
      return ticketDepartmentAdminApi.create(payload)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['admin-ticket-departments'] })
      qc.invalidateQueries({ queryKey: ['ticket-departments-active'] })
      setModalOpen(false)
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ذخیره دپارتمان')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ticketDepartmentAdminApi.delete(id),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['admin-ticket-departments'] })
      qc.invalidateQueries({ queryKey: ['ticket-departments-active'] })
      setDeletingDept(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'خطا در حذف دپارتمان')
      setDeletingDept(null)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('نام دپارتمان را وارد کنید')
      return
    }
    saveMutation.mutate()
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  const filteredCandidates = staffCandidates.filter((s) => {
    if (!staffFilter.trim()) return true
    const q = staffFilter.trim().toLowerCase()
    return s.name.toLowerCase().includes(q) || s.role_label.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="تنظیمات تیکتینگ و دپارتمان‌های پاسخگویی"
        actions={
          <button className="btn btn-sm btn-primary gap-1.5" onClick={openCreate}>
            <Plus className="size-4" /> تعریف دپارتمان جدید
          </button>
        }
      />

      {/* Routing Strategy Guide Banner */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(['round_robin', 'least_loaded', 'random'] as AssignmentStrategy[]).map((key) => {
          const meta = assignmentStrategyMeta[key]
          return (
            <div
              key={key}
              className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-2xs space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {key === 'random' ? <Shuffle className="size-4" /> : <Sliders className="size-4" />}
                </span>
                <p className="text-xs font-extrabold text-base-content">{meta.label}</p>
              </div>
              <p className="text-[11px] text-base-content/65 leading-relaxed">{meta.description}</p>
            </div>
          )
        })}
      </div>

      {/* Departments List */}
      {departments.length === 0 ? (
        <div className="rounded-2xl border border-base-200 bg-base-100 p-6">
          <EmptyState
            icon={LifeBuoy}
            title="هنوز دپارتمانی تعریف نشده است"
            subtitle="برای دریافت درخواست‌های تعمیر دستگاه و پیام‌های مشتریان، حداقل یک دپارتمان تعریف کنید و نیروهای پاسخگو را به آن اختصاص دهید."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {departments.map((dept) => {
            const strat = assignmentStrategyMeta[dept.assignment_strategy] ?? assignmentStrategyMeta.round_robin
            const agents = dept.agents ?? []

            return (
              <div
                key={dept.id}
                className={cx(
                  'rounded-2xl border bg-base-100 p-5 shadow-xs flex flex-col justify-between gap-4 transition-all',
                  dept.is_active ? 'border-base-200' : 'border-base-300/70 opacity-75',
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-base text-base-content">{dept.name}</h3>
                        {dept.is_default_repair && (
                          <span className="badge badge-xs badge-warning gap-1 font-bold py-2">
                            <Wrench className="size-3" /> پیش‌فرض تعمیرات دستگاه
                          </span>
                        )}
                        <span
                          className={cx(
                            'badge badge-xs font-bold',
                            dept.is_active ? 'badge-success badge-soft' : 'badge-ghost',
                          )}
                        >
                          {dept.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </div>
                      {dept.description && (
                        <p className="text-xs text-base-content/65 leading-relaxed">{dept.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost gap-1"
                        onClick={() => openEdit(dept)}
                      >
                        <Pencil className="size-3.5" /> ویرایش
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => setDeletingDept(dept)}
                        title="حذف دپارتمان"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Strategy & Stats Pill Bar */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-base-200/70 px-3 py-2 text-xs">
                    <span className="font-bold text-primary">الگوریتم ارجاع: {strat.shortLabel}</span>
                    <span className="text-base-content/30">•</span>
                    <span>تیکت فعال: <b>{num(dept.open_tickets_count ?? 0)}</b></span>
                    <span className="text-base-content/30">•</span>
                    <span>کل سوابق: <b>{num(dept.tickets_count ?? 0)}</b></span>
                  </div>

                  {/* Assigned Agents */}
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-bold text-base-content/75 flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" />
                      نیروهای پاسخگو در این دپارتمان ({num(agents.length)} نفر):
                    </p>
                    {agents.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-warning/50 bg-warning/8 px-3 py-2 text-xs text-warning-content dark:text-amber-200">
                        هیچ کارشناسی به این دپارتمان اختصاص نیافته است (تیکت‌های ورودی بدون کارشناس ثبت می‌شوند).
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {agents.map((ag) => (
                          <div
                            key={ag.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-2.5 py-1.5 text-xs"
                          >
                            <Avatar name={ag.name} src={ag.avatar_url ?? undefined} size="xs" />
                            <div>
                              <span className="font-bold text-base-content">{ag.name}</span>
                              <span className="ms-1.5 text-[10px] text-base-content/55">
                                ({ag.role_label})
                              </span>
                            </div>
                            <span className="badge badge-xs badge-primary badge-soft font-mono">
                              باز: {num(ag.open_tickets_count ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Department Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title={editingDept ? `ویرایش دپارتمان «${editingDept.name}»` : 'تعریف دپارتمان جدید تیکتینگ'}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={saveMutation.isPending}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="dept-config-form"
              className="btn btn-primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <span className="loading loading-spinner loading-xs" />}
              {editingDept ? 'ذخیره تغییرات دپارتمان' : 'ایجاد دپارتمان'}
            </button>
          </>
        }
      >
        <form id="dept-config-form" onSubmit={handleSubmit} className="space-y-5">
          <Field label="عنوان دپارتمان" required>
            <input
              className="input input-bordered w-full text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: پشتیبانی فنی و تعمیرات دستگاه‌ها"
              required
            />
          </Field>

          <Field label="توضیح کوتاه برای راهنمایی مشتری (اختیاری)">
            <textarea
              rows={2}
              className="textarea textarea-bordered w-full text-xs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: اعلام خرابی دستگاه، اعزام کارشناس تعمیر و سرویس دوره‌ای"
            />
          </Field>

          <Field
            label="استراتژی تخصیص خودکار تیکت بین کارشناسان دپارتمان"
            hint="در صورتی که بیش از یک کارشناس فعال عضو این دپارتمان باشد، سیستم بر اساس این روش کارشناس پاسخگو را تعیین می‌کند"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['round_robin', 'least_loaded', 'random'] as AssignmentStrategy[]).map((key) => {
                const meta = assignmentStrategyMeta[key]
                const active = strategy === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStrategy(key)}
                    className={cx(
                      'rounded-xl border p-3 text-start transition-all cursor-pointer space-y-1',
                      active
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-base-300 hover:bg-base-200/60',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-base-content">{meta.shortLabel}</span>
                      {active && <Check className="size-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-base-content/65 leading-snug">{meta.description}</p>
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Staff Multi-Select */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="text-xs font-extrabold text-base-content">
                انتخاب نیروهای پاسخگو در این دپارتمان ({num(selectedAgentIds.length)} نفر انتخاب شده)
              </label>
              <input
                className="input input-bordered input-xs w-full sm:w-56"
                placeholder="جستجوی نام یا سمت کارمند..."
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-2xl border border-base-300 bg-base-200/35 p-2 space-y-1">
              {filteredCandidates.length === 0 ? (
                <p className="py-6 text-center text-xs text-base-content/50">کارمندی با این مشخصات یافت نشد.</p>
              ) : (
                filteredCandidates.map((staff) => {
                  const checked = selectedAgentIds.includes(staff.id)
                  return (
                    <label
                      key={staff.id}
                      className={cx(
                        'flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer transition-colors text-xs',
                        checked ? 'bg-primary/12 border border-primary/30' : 'hover:bg-base-200',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={checked}
                          onChange={() => toggleAgent(staff.id)}
                        />
                        <Avatar name={staff.name} src={staff.avatar_url ?? undefined} size="xs" />
                        <div className="truncate">
                          <p className="font-bold text-base-content truncate">{staff.name}</p>
                          <p className="text-[10px] text-base-content/55">{staff.role_label}</p>
                        </div>
                      </div>
                      <span className="badge badge-xs bg-base-100 border border-base-300 shrink-0">
                        تیکت فعال فعلی: {num(staff.open_tickets_count ?? 0)}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
            <label className="flex items-center gap-2.5 rounded-xl border border-base-300 p-3 cursor-pointer text-xs">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-warning"
                checked={isDefaultRepair}
                onChange={(e) => setIsDefaultRepair(e.target.checked)}
              />
              <span>
                <b className="block text-base-content">دپارتمان پیش‌فرض ثبت خرابی و تعمیرات</b>
                <span className="text-[11px] text-base-content/60">
                  درخواست‌های تعمیر دستگاه از پنل مشتری به صورت خودکار به این واحد هدایت شوند
                </span>
              </span>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-base-300 p-3 cursor-pointer text-xs">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-success"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>
                <b className="block text-base-content">دپارتمان فعال و قابل انتخاب باشد</b>
                <span className="text-[11px] text-base-content/60">
                  نمایش در لیست دپارتمان‌های پنل مشتریان و پرسنل
                </span>
              </span>
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingDept)}
        onClose={() => setDeletingDept(null)}
        onConfirm={() => deletingDept && deleteMutation.mutate(deletingDept.id)}
        title="حذف دپارتمان تیکتینگ"
        message={`آیا از حذف دپارتمان «${deletingDept?.name ?? ''}» اطمینان دارید؟`}
        confirmText="بله، حذف شود"
        tone="error"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
