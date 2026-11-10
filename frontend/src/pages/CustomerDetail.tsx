import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Building2,
  Cpu,
  ExternalLink,
  Hash,
  History,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Send,
  Trash2,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Wrench,
} from 'lucide-react'
import { Field, PageSkeleton, EmptyState } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { PasswordRulesTooltip } from '../components/ui/PasswordRulesTooltip'
import { CustomerFormModal } from '../components/customers/CustomerFormModal'
import { AssignPartModal } from '../components/parts/AssignPartModal'
import { ServiceHistoryModal } from '../components/parts/ServiceHistoryModal'
import { Can } from '../components/common/Can'
import { customerApi, partApi } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { ticketPriorityMeta, ticketStatusMeta, ticketTypeMeta } from '../utils/meta'
import { customerDisplayName, cx, dateFa, dateShort, num, relativeFa, toEnDigits, toman } from '../utils/format'
import type { CustomerPart } from '../types'

type ActiveTab = 'parts' | 'tickets' | 'audit' | 'sms' | 'profile'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAdministrator = useAuthStore((s) => s.isAdministrator)()

  const canTransferOwner =
    hasPermission('customers.edit') &&
    (isAdministrator ||
      (currentUser?.user_type === 'manager' && currentUser?.customer_scope === 'all'))
  const canViewSmsLogs = hasPermission('sms.logs')
  const canViewTickets = hasPermission('tickets.view')

  const [activeTab, setActiveTab] = useState<ActiveTab>('parts')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [ownerModalOpen, setOwnerModalOpen] = useState(false)
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')
  const [selectedSalesManagerId, setSelectedSalesManagerId] = useState<string>('')

  // Customer Portal Access Modal
  const [portalModalOpen, setPortalModalOpen] = useState(false)
  const [portalEnabled, setPortalEnabled] = useState(true)
  const [portalPassword, setPortalPassword] = useState('')
  const [portalLoginPhone, setPortalLoginPhone] = useState('')
  const [portalSalesMgrId, setPortalSalesMgrId] = useState('')

  const [assignPartOpen, setAssignPartOpen] = useState(false)
  const [editingAssignedPart, setEditingAssignedPart] = useState<CustomerPart | null>(null)
  const [deletingAssignedPart, setDeletingAssignedPart] = useState<CustomerPart | null>(null)
  const [servicePart, setServicePart] = useState<CustomerPart | null>(null)

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
    enabled: Boolean(id),
  })

  const { data: staffOptions = [] } = useQuery({
    queryKey: ['customer-staff-options'],
    queryFn: customerApi.staffOptions,
    enabled: (ownerModalOpen || portalModalOpen) && canTransferOwner,
  })

  const updateOwnerMutation = useMutation({
    mutationFn: () =>
      customerApi.updateOwner(
        id!,
        selectedOwnerId,
        selectedSalesManagerId ? Number(selectedSalesManagerId) : null,
      ),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setOwnerModalOpen(false)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در تغییر کارشناس مسئول پرونده')
    },
  })

  const portalAccessMutation = useMutation({
    mutationFn: () =>
      customerApi.managePortalAccess(id!, {
        portal_enabled: portalEnabled,
        password: portalPassword.trim() ? toEnDigits(portalPassword.trim()) : undefined,
        login_phone: portalLoginPhone.trim() ? toEnDigits(portalLoginPhone.trim()) : undefined,
        sales_manager_user_id: canTransferOwner
          ? portalSalesMgrId
            ? Number(portalSalesMgrId)
            : null
          : undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['customer', id] })
      setPortalPassword('')
      setPortalModalOpen(false)
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ذخیره تنظیمات پنل مشتری')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => customerApi.delete(id!),
    onSuccess: () => {
      toast.success('مشتری با موفقیت حذف شد')
      qc.invalidateQueries({ queryKey: ['customers'] })
      nav('/customers')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف مشتری')
    },
  })

  const deleteAssignedPartMutation = useMutation({
    mutationFn: (customerPartId: number | string) => partApi.deleteAssignedPart(customerPartId),
    onSuccess: (res) => {
      toast.success(res.message || 'دستگاه از پرونده حذف شد و موجودی به انبار بازگردانده شد')
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['inventory-logs'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setDeletingAssignedPart(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف دستگاه اختصاص‌یافته')
    },
  })

  if (isLoading) return <PageSkeleton />
  if (error || !customer) {
    return (
      <EmptyState
        title="پرونده مشتری یافت نشد"
        subtitle="ممکن است این مشتری حذف شده باشد یا خارج از محدوده دسترسی حساب شما باشد."
        action={
          <Link to="/customers" className="btn btn-primary btn-sm">
            بازگشت به فهرست مشتریان
          </Link>
        }
      />
    )
  }

  const displayName = customerDisplayName(customer)
  const customerParts = customer.customer_parts ?? []
  const customerTickets = customer.tickets ?? []
  const histories = customer.histories ?? []
  const smsLogs = customer.sms_logs ?? []

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/60 hover:text-primary transition-colors"
        >
          <ArrowRight className="size-4" /> بازگشت به فهرست مشتریان
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="relative overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cx(
                'flex size-16 shrink-0 items-center justify-center rounded-2xl font-bold text-xl',
                customer.type === 'company' ? 'bg-blue-600/10 text-blue-700' : 'bg-indigo-600/10 text-indigo-700',
              )}
            >
              {customer.type === 'company' ? <Building2 className="size-8" /> : <User className="size-8" />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-base-content">{displayName}</h1>
                {customer.customer_type === 'effective' ? (
                  <span className="badge badge-success badge-soft font-bold text-xs gap-1">
                    <UserCheck className="size-3" /> مشتری بالفعل
                  </span>
                ) : (
                  <span className="badge badge-warning badge-soft font-bold text-xs gap-1">
                    <UserPlus className="size-3" /> مشتری بالقوه
                  </span>
                )}
                <span className="badge badge-sm bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                  {customer.type === 'company' ? 'شخصیت حقوقی' : 'شخصیت حقیقی'}
                </span>
                <span className="badge badge-sm badge-primary badge-soft font-semibold">
                  مسئول فروش: {customer.creator?.name || 'ثبت سیستمی'}
                </span>
                {customer.sales_manager && (
                  <span className="badge badge-sm badge-secondary badge-soft font-semibold">
                    مدیر فروش: {customer.sales_manager.name}
                  </span>
                )}
                <span
                  className={cx(
                    'badge badge-sm font-semibold',
                    customer.portal_enabled ? 'badge-success badge-soft' : 'badge-ghost',
                  )}
                >
                  {customer.portal_enabled ? 'پنل مشتری: فعال' : 'پنل مشتری: غیرفعال'}
                </span>
              </div>

              {customer.type === 'individual' && customer.company_name && (
                <p className="text-xs font-semibold text-base-content/60">{customer.company_name}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-base-content/60 pt-1 font-mono">
                <span className="flex items-center gap-1 ltr-text">
                  <Phone className="size-3.5 text-base-content/40" /> {customer.mobile || 'بدون شماره همراه'}
                </span>
                {(customer.city || customer.province) && (
                  <span className="flex items-center gap-1 font-sans">
                    <MapPin className="size-3.5 text-base-content/40" />{' '}
                    {[customer.province, customer.city].filter(Boolean).join(' - ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Can permission="parts.assign">
              <button
                className="btn btn-sm btn-primary gap-1.5"
                onClick={() => {
                  setEditingAssignedPart(null)
                  setAssignPartOpen(true)
                }}
              >
                <Plus className="size-4" /> تخصیص دستگاه جدید
              </button>
            </Can>

            {customer.mobile && (
              <Can permission="sms.send">
                <Link
                  to={`/sms?mobile=${customer.mobile}&customer_id=${customer.id}`}
                  className="btn btn-sm btn-outline gap-1.5"
                >
                  <Send className="size-4" /> ارسال پیامک
                </Link>
              </Can>
            )}

            <Can permission="customers.edit">
              <button
                type="button"
                className={cx(
                  'btn btn-sm gap-1.5',
                  customer.portal_enabled ? 'btn-outline btn-success' : 'btn-outline',
                )}
                onClick={() => {
                  setPortalEnabled(Boolean(customer.portal_enabled ?? true))
                  setPortalPassword('')
                  setPortalLoginPhone(customer.portal_user?.phone || customer.mobile || '')
                  setPortalSalesMgrId(
                    customer.sales_manager_user_id ? String(customer.sales_manager_user_id) : '',
                  )
                  setPortalModalOpen(true)
                }}
                title="تنظیم دسترسی پنل کاربری اختصاصی مشتری"
              >
                <KeyRound className="size-4" /> پنل مشتری
              </button>
            </Can>

            {canTransferOwner && (
              <button
                type="button"
                className="btn btn-sm btn-outline gap-1.5"
                onClick={() => {
                  setSelectedOwnerId(
                    customer.created_by_user_id ? String(customer.created_by_user_id) : '',
                  )
                  setSelectedSalesManagerId(
                    customer.sales_manager_user_id ? String(customer.sales_manager_user_id) : '',
                  )
                  setOwnerModalOpen(true)
                }}
                title="انتقال مالکیت و کارشناس مسئول پرونده"
              >
                <UserCog className="size-4" /> تغییر کارشناس
              </button>
            )}

            <Can permission="customers.edit">
              <button
                className="btn btn-sm btn-square btn-ghost"
                onClick={() => setEditOpen(true)}
                title="ویرایش پرونده"
              >
                <Pencil className="size-4" />
              </button>
            </Can>

            <Can permission="customers.delete">
              <button
                className="btn btn-sm btn-square btn-ghost text-error"
                onClick={() => setDeleteOpen(true)}
                title="حذف پرونده"
              >
                <Trash2 className="size-4" />
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-base-200">
        <div role="tablist" className="tabs tabs-border">
          <button
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', activeTab === 'parts' && 'tab-active')}
            onClick={() => setActiveTab('parts')}
          >
            <Cpu className="size-4" />
            دستگاه‌ها، فاکتورها و سوابق خدمات ({num(customerParts.length)})
          </button>
          {canViewTickets && (
            <button
              role="tab"
              className={cx('tab gap-2 font-bold text-xs', activeTab === 'tickets' && 'tab-active')}
              onClick={() => setActiveTab('tickets')}
            >
              <LifeBuoy className="size-4" />
              تیکت‌ها و تعمیرات ({num(customerTickets.length)})
            </button>
          )}
          <button
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', activeTab === 'audit' && 'tab-active')}
            onClick={() => setActiveTab('audit')}
          >
            <History className="size-4" />
            تاریخچه اقدامات و رویدادها ({num(histories.length)})
          </button>
          {canViewSmsLogs && (
            <button
              role="tab"
              className={cx('tab gap-2 font-bold text-xs', activeTab === 'sms' && 'tab-active')}
              onClick={() => setActiveTab('sms')}
            >
              <MessageSquare className="size-4" />
              پیامک‌های ارسالی ({num(smsLogs.length)})
            </button>
          )}
          <button
            role="tab"
            className={cx('tab gap-2 font-bold text-xs', activeTab === 'profile' && 'tab-active')}
            onClick={() => setActiveTab('profile')}
          >
            <User className="size-4" />
            مشخصات کامل پرونده
          </button>
        </div>
      </div>

      {/* Tab 1: Customer Devices and Service History */}
      {activeTab === 'parts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-base-content">دستگاه‌های تخصیص‌یافته به مشتری</h2>
            <Can permission="parts.assign">
              <button
                className="btn btn-xs btn-primary gap-1"
                onClick={() => {
                  setEditingAssignedPart(null)
                  setAssignPartOpen(true)
                }}
              >
                <Plus className="size-3.5" /> تخصیص دستگاه دیگر
              </button>
            </Can>
          </div>

          {!customerParts.length ? (
            <div className="rounded-2xl border border-dashed border-base-300 p-8 text-center bg-base-100">
              <Cpu className="mx-auto size-12 text-base-content/30 mb-2" />
              <p className="font-bold text-sm">هیچ دستگاهی برای این مشتری ثبت نشده است</p>
              <p className="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
                با تخصیص اولین دستگاه، تعداد آن از موجودی انبار کسر شده و وضعیت مشتری به طور خودکار به «بالفعل» تغییر خواهد یافت.
              </p>
              <Can permission="parts.assign">
                <button
                  className="btn btn-sm btn-primary mt-4"
                  onClick={() => {
                    setEditingAssignedPart(null)
                    setAssignPartOpen(true)
                  }}
                >
                  <Plus className="size-4" /> تخصیص اولین دستگاه
                </button>
              </Can>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {customerParts.map((cp) => (
                <div key={cp.id} className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200/60">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 font-bold">
                        <Cpu className="size-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm text-base-content">{cp.part?.name ?? 'دستگاه'}</h3>
                          {cp.serial_number ? (
                            <span className="badge badge-primary font-mono text-xs">{cp.serial_number}</span>
                          ) : (
                            <span className="badge badge-ghost text-xs">بدون سریال</span>
                          )}
                          <span className="badge badge-primary badge-soft font-bold text-xs">
                            تعداد: {num(cp.quantity ?? 1)} عدد
                          </span>
                        </div>
                        <p className="text-xs text-base-content/60 mt-0.5">
                          کد کاتالوگ: <span className="font-mono">{cp.part?.code}</span> • دوره گارانتی/سرویس:{' '}
                          {num(cp.part?.periodic_service_months ?? 12)} ماه
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cx(
                          'badge badge-sm font-bold',
                          cp.status === 'active'
                            ? 'badge-success badge-soft'
                            : cp.status === 'under_repair'
                              ? 'badge-warning badge-soft'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
                        )}
                      >
                        {cp.status === 'active'
                          ? 'فعال در محل مشتری'
                          : cp.status === 'under_repair'
                            ? 'در دست تعمیر'
                            : cp.status === 'replaced'
                              ? 'تعویض شده'
                              : 'از رده خارج'}
                      </span>

                      <Can permission="parts.history">
                        <button
                          className="btn btn-xs btn-outline btn-primary gap-1"
                          onClick={() => setServicePart(cp)}
                        >
                          <Wrench className="size-3.5" /> ثبت اقدام / تعمیر
                        </button>
                      </Can>

                      <Can permission="parts.assign">
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost btn-square text-sky-600"
                          title="ویرایش تعداد، مبلغ فاکتور یا سریال دستگاه"
                          onClick={() => {
                            setEditingAssignedPart(cp)
                            setAssignPartOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost btn-square text-error hover:bg-error/10"
                          title="حذف دستگاه از پرونده و بازگشت موجودی به انبار"
                          onClick={() => setDeletingAssignedPart(cp)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </Can>
                    </div>
                  </div>

                  {/* Invoice & Financial Summary */}
                  {((cp.invoice_amount !== null && cp.invoice_amount !== undefined) || cp.invoice_number) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-primary/5 border border-primary/20 p-3.5 rounded-xl">
                      <div>
                        <span className="text-base-content/55 flex items-center gap-1">
                          <Receipt className="size-3.5 text-primary" /> مبلغ فاکتور:
                        </span>
                        <span className="font-extrabold text-sm text-primary block mt-0.5">
                          {cp.invoice_amount !== null && cp.invoice_amount !== undefined
                            ? toman(Number(cp.invoice_amount))
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-base-content/55 flex items-center gap-1">
                          <Hash className="size-3.5 text-primary" /> شماره فاکتور:
                        </span>
                        <span className="font-bold font-mono ltr-text text-start block mt-0.5">
                          {cp.invoice_number || '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dates & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 p-3.5 rounded-xl dark:bg-slate-900/60 dark:border-slate-800">
                    <div>
                      <span className="text-base-content/50 block">تاریخ تحویل یا نصب:</span>
                      <span className="font-medium">
                        {cp.installation_date
                          ? `${dateFa(cp.installation_date)} (${dateShort(cp.installation_date)})`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-base-content/50 block">پوشش گارانتی تا:</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {cp.warranty_expire_date
                          ? `${dateFa(cp.warranty_expire_date)} (${dateShort(cp.warranty_expire_date)})`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-base-content/50 block">توضیحات اختصاصی دستگاه:</span>
                      <span className="font-medium">{cp.notes || 'بدون یادداشت'}</span>
                    </div>
                  </div>

                  {/* Device Service / Repair Histories */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-base-content/70 flex items-center gap-1.5">
                      <Wrench className="size-3.5" /> سوابق خدمات، بررسی و تعمیرات این دستگاه (
                      {num(cp.service_histories?.length ?? 0)})
                    </h4>

                    {!cp.service_histories?.length ? (
                      <p className="text-xs text-base-content/40 italic py-2">
                        تاکنون سابقه تعمیر یا اقدام سرویسی برای این دستگاه ثبت نشده است.
                      </p>
                    ) : (
                      <div className="divide-y divide-base-200/60 rounded-xl border border-base-200/60 bg-base-100 overflow-hidden">
                        {cp.service_histories.map((sh) => (
                          <div
                            key={sh.id}
                            className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cx(
                                    'badge badge-xs font-semibold',
                                    sh.service_type === 'periodic'
                                      ? 'badge-info badge-soft'
                                      : sh.service_type === 'repair'
                                        ? 'badge-warning badge-soft'
                                        : 'badge-error badge-soft',
                                  )}
                                >
                                  {sh.service_type === 'periodic'
                                    ? 'سرویس دوره‌ای'
                                    : sh.service_type === 'repair'
                                      ? 'تعمیر فنی'
                                      : 'اورهال'}
                                </span>
                                <span className="font-medium">{sh.description}</span>
                              </div>
                              <p className="text-[11px] text-base-content/50">
                                تاریخ اقدام:{' '}
                                {sh.service_date
                                  ? `${dateFa(sh.service_date)} (${dateShort(sh.service_date)})`
                                  : '—'}
                                {sh.performed_by && ` • توسط: ${sh.performed_by.name}`}
                              </p>
                            </div>

                            {sh.cost && (
                              <div className="text-end font-semibold text-xs text-base-content/80">
                                {toman(Number(sh.cost))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
          <h2 className="font-bold text-base text-base-content">تاریخچه تغییرات و اقدامات سیستم</h2>
          {!histories.length ? (
            <p className="text-xs text-base-content/50 py-6 text-center">تاریخچه‌ای ثبت نشده است.</p>
          ) : (
            <div className="divide-y divide-base-200/60">
              {histories.map((h) => (
                <div key={h.id} className="py-3 flex items-start gap-3 text-xs">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/70">
                    <History className="size-3.5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-base-content">{h.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-base-content/50 text-[11px]">
                      <span>اقدام‌کننده: {h.user ? h.user.name : 'سیستم'}</span>
                      <span>•</span>
                      <span>{relativeFa(h.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SMS Logs */}
      {activeTab === 'sms' && (
        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-base-content">
              پیامک‌های ارسال شده به این مشتری (ملی‌پیامک)
            </h2>
            {customer.mobile && (
              <Can permission="sms.send">
                <Link
                  to={`/sms?mobile=${customer.mobile}&customer_id=${customer.id}`}
                  className="btn btn-xs btn-primary gap-1"
                >
                  <Send className="size-3" /> ارسال پیامک جدید
                </Link>
              </Can>
            )}
          </div>

          {!smsLogs.length ? (
            <p className="text-xs text-base-content/50 py-8 text-center">
              پیامکی برای این مشتری ثبت نشده است.
            </p>
          ) : (
            <div className="divide-y divide-base-200/60">
              {smsLogs.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-xs bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-mono">
                        الگوی {s.pattern_code}
                      </span>
                      <span className="font-mono text-base-content/70">{s.recipient_mobile}</span>
                    </div>
                    {s.tokens && (
                      <p className="text-base-content/60 font-mono text-[11px]">
                        متغیرها: {JSON.stringify(s.tokens)}
                      </p>
                    )}
                  </div>
                  <div className="text-end space-y-1">
                    <span
                      className={cx(
                        'badge badge-xs font-bold',
                        s.status === 'sent'
                          ? 'badge-success badge-soft'
                          : s.status === 'pending'
                            ? 'badge-warning badge-soft'
                            : 'badge-error badge-soft',
                      )}
                    >
                      {s.status === 'sent' ? 'تحویل شد' : s.status === 'pending' ? 'در صف' : 'ناموفق'}
                    </span>
                    <p className="text-[10px] text-base-content/40">{relativeFa(s.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1.5: Customer Tickets & Repair Requests */}
      {activeTab === 'tickets' && canViewTickets && (
        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-base-200 pb-3">
            <h2 className="font-bold text-base text-base-content">
              تیکت‌ها و درخواست‌های تعمیر ثبت‌شده برای این مشتری
            </h2>
            <Link to="/tickets" className="btn btn-xs btn-outline gap-1">
              کارتابل تیکتینگ <ExternalLink className="size-3" />
            </Link>
          </div>

          {!customerTickets.length ? (
            <EmptyState
              icon={LifeBuoy}
              title="تاکنون تیکتی برای این مشتری ثبت نشده است"
              subtitle="پس از فعال‌سازی پنل مشتری یا ثبت تیکت توسط پرسنل، تمامی درخواست‌های تعمیر و مکاتبات در اینجا فهرست می‌شوند."
            />
          ) : (
            <div className="divide-y divide-base-200">
              {customerTickets.map((t) => {
                const st = ticketStatusMeta[t.status] ?? ticketStatusMeta.open
                const pr = ticketPriorityMeta[t.priority] ?? ticketPriorityMeta.medium
                const ty = ticketTypeMeta[t.ticket_type] ?? ticketTypeMeta.general
                return (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 text-xs hover:bg-base-200/35 px-2 rounded-xl transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-primary ltr-text">
                          {t.tracking_code}
                        </span>
                        <span className={cx('badge badge-xs', ty.badgeClass)}>{ty.label}</span>
                        <span className={cx('badge badge-xs', pr.badgeClass)}>{pr.label}</span>
                      </div>
                      <p className="font-extrabold text-sm text-base-content">{t.subject}</p>
                      <p className="text-[11px] text-base-content/60">
                        دپارتمان: {t.department?.name || 'عمومی'}
                        {t.assignee ? ` • کارشناس پاسخگو: ${t.assignee.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cx('badge badge-xs font-bold py-2', st.badgeClass)}>
                        {st.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Full Profile Info */}
      {activeTab === 'profile' && (
        <div className="rounded-2xl border border-base-200 bg-base-100 p-6 shadow-xs space-y-5 max-w-3xl">
          <h2 className="font-bold text-base text-base-content">اطلاعات شناسنامه‌ای و پرونده</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl">
              <span className="text-base-content/50">نام و نام خانوادگی:</span>
              <p className="font-bold text-sm">
                {[customer.first_name, customer.last_name].filter(Boolean).join(' ') || '—'}
              </p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl">
              <span className="text-base-content/50">شرکت / کارگاه:</span>
              <p className="font-bold text-sm">{customer.company_name || '—'}</p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl">
              <span className="text-base-content/50">کد ملی / شناسه ملی:</span>
              <p className="font-bold text-sm font-mono">{customer.national_code || '—'}</p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl">
              <span className="text-base-content/50">شماره همراه:</span>
              <p className="font-bold text-sm font-mono ltr-text text-start">{customer.mobile || '—'}</p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl">
              <span className="text-base-content/50">تلفن ثابت:</span>
              <p className="font-bold text-sm font-mono ltr-text text-start">{customer.phone || '—'}</p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl">
              <span className="text-base-content/50">ایمیل:</span>
              <p className="font-bold text-sm font-mono ltr-text text-start">{customer.email || '—'}</p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl sm:col-span-2">
              <span className="text-base-content/50">استان و شهر:</span>
              <p className="font-bold text-sm">
                {[customer.province, customer.city].filter(Boolean).join(' - ') || '—'}
              </p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl sm:col-span-2">
              <span className="text-base-content/50">آدرس دقیق پستی:</span>
              <p className="font-medium text-sm leading-relaxed">{customer.address || '—'}</p>
            </div>

            <div className="space-y-1 p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 rounded-xl sm:col-span-2">
              <span className="text-base-content/50">یادداشت‌های پرونده:</span>
              <p className="font-medium text-sm leading-relaxed">{customer.notes || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CustomerFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        customer={customer}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customer', id] })
          qc.invalidateQueries({ queryKey: ['customers'] })
          setEditOpen(false)
        }}
      />

      <AssignPartModal
        open={assignPartOpen}
        onClose={() => {
          setAssignPartOpen(false)
          setEditingAssignedPart(null)
        }}
        customer={customer}
        editingPart={editingAssignedPart}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customer', id] })
          qc.invalidateQueries({ queryKey: ['customers'] })
          qc.invalidateQueries({ queryKey: ['parts-catalog'] })
          qc.invalidateQueries({ queryKey: ['inventory-logs'] })
          qc.invalidateQueries({ queryKey: ['inventory-summary'] })
          qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
          setAssignPartOpen(false)
          setEditingAssignedPart(null)
        }}
      />

      <ServiceHistoryModal
        open={Boolean(servicePart)}
        onClose={() => setServicePart(null)}
        customerPart={servicePart}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customer', id] })
          setServicePart(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingAssignedPart)}
        onClose={() => setDeletingAssignedPart(null)}
        onConfirm={() =>
          deletingAssignedPart && deleteAssignedPartMutation.mutate(deletingAssignedPart.id)
        }
        title="حذف دستگاه از پرونده مشتری و بازگشت به انبار"
        message={
          deletingAssignedPart
            ? `آیا از حذف دستگاه «${deletingAssignedPart.part?.name ?? ''}» (تعداد: ${num(
                deletingAssignedPart.quantity ?? 1,
              )} عدد، سریال: ${deletingAssignedPart.serial_number || 'بدون سریال'}) از پرونده این مشتری اطمینان دارید؟ تعداد ${num(
                deletingAssignedPart.quantity ?? 1,
              )} عدد به صورت خودکار به موجودی انبار بازگردانده شده و در لاگ انبار ثبت می‌گردد.`
            : ''
        }
        confirmText="بله، حذف و بازگشت به انبار"
        tone="error"
        loading={deleteAssignedPartMutation.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="حذف پرونده مشتری"
        message={`آیا از حذف مشتری «${displayName}» اطمینان دارید؟ در صورت نبود سابقه تعمیرات، موجودی دستگاه‌های تخصیص‌یافته به انبار بازگردانده می‌شود.`}
        confirmText="بله، حذف کن"
        tone="error"
        loading={deleteMutation.isPending}
      />

      <Modal
        open={ownerModalOpen}
        onClose={() => setOwnerModalOpen(false)}
        size="sm"
        title="انتقال کارشناس مسئول پرونده"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOwnerModalOpen(false)}
              disabled={updateOwnerMutation.isPending}
            >
              انصراف
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedOwnerId || updateOwnerMutation.isPending}
              onClick={() => updateOwnerMutation.mutate()}
            >
              {updateOwnerMutation.isPending && (
                <span className="loading loading-spinner loading-xs" />
              )}
              ثبت انتقال مالکیت
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-base-content/70 leading-relaxed">
            با تغییر کارشناس مسئول، دسترسی این پرونده مشتری به کارمند انتخابی منتقل شده و رویداد «تغییر کارشناس مسئول» در تاریخچه حسابرسی پرونده ثبت می‌گردد.
          </p>
          <Field label="انتخاب کارشناس و مسئول فروش پرونده" required>
            <select
              className="select select-bordered w-full"
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
            >
              <option value="" disabled>
                یک کارشناس فعال انتخاب کنید...
              </option>
              {staffOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} ({s.role_label})
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="مدیر فروش پروژه (نمایش در پنل کاربری مشتری)"
            hint="اختیاری — در صورت عدم انتخاب، مدیر پیش‌فرض سازمان نمایش داده می‌شود"
          >
            <select
              className="select select-bordered w-full"
              value={selectedSalesManagerId}
              onChange={(e) => setSelectedSalesManagerId(e.target.value)}
            >
              <option value="">انتخاب خودکار مدیر فروش</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} ({s.role_label})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>

      {/* Customer Portal Access Configuration Modal */}
      <Modal
        open={portalModalOpen}
        onClose={() => setPortalModalOpen(false)}
        size="md"
        title="مدیریت پنل کاربری اختصاصی مشتری"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPortalModalOpen(false)}
              disabled={portalAccessMutation.isPending}
            >
              انصراف
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={portalAccessMutation.isPending}
              onClick={() => portalAccessMutation.mutate()}
            >
              {portalAccessMutation.isPending && (
                <span className="loading loading-spinner loading-xs" />
              )}
              ذخیره تنظیمات پنل مشتری
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/8 p-3 text-xs leading-relaxed">
            با فعال‌سازی این بخش، مشتری می‌تواند با شماره همراه و رمز عبور خود وارد <b>پنل ایزوله مشتریان (/portal)</b> شود و بدون هیچ‌گونه دسترسی به سایر بخش‌های سامانه، اطلاعات مدیر و مسئول فروش پروژه، لیست دستگاه‌ها و گارانتی خود را ببیند و درخواست تعمیر ثبت کند.
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-base-300 p-3 cursor-pointer text-xs">
            <input
              type="checkbox"
              className="toggle toggle-success toggle-sm"
              checked={portalEnabled}
              onChange={(e) => setPortalEnabled(e.target.checked)}
            />
            <span className="font-extrabold text-base-content">
              {portalEnabled ? 'دسترسی ورود مشتری به پنل فعال باشد' : 'دسترسی پنل مشتری غیرفعال باشد'}
            </span>
          </label>

          {portalEnabled && (
            <>
              <Field
                label="شماره همراه ورود مشتری به پنل"
                hint="مشتری می‌تواند با این شماره یا ایمیل وارد سامانه شود"
              >
                <input
                  dir="ltr"
                  maxLength={11}
                  className="input input-bordered w-full text-start font-mono text-sm"
                  value={portalLoginPhone}
                  onChange={(e) =>
                    setPortalLoginPhone(toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 11))
                  }
                  placeholder="09121234567"
                />
              </Field>

              <Field
                label={
                  customer.portal_user
                    ? 'تنظیم رمز عبور جدید (در صورت خالی بودن، رمز قبلی مشتری حفظ می‌شود)'
                    : 'تعیین رمز عبور اولیه پنل مشتری (الزامی)'
                }
              >
                <PasswordRulesTooltip
                  value={portalPassword}
                  onChange={(val) => setPortalPassword(toEnDigits(val))}
                  placeholder="حداقل ۸ کاراکتر شامل حرف انگلیسی و عدد"
                />
              </Field>

              {canTransferOwner && (
                <Field label="مدیر فروش اختصاصی پروژه (نمایش در پنل مشتری)">
                  <select
                    className="select select-bordered w-full text-xs"
                    value={portalSalesMgrId}
                    onChange={(e) => setPortalSalesMgrId(e.target.value)}
                  >
                    <option value="">انتخاب خودکار مدیر فروش</option>
                    {staffOptions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} ({s.role_label})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
