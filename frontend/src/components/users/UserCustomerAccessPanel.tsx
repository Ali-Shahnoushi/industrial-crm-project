import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Crown,
  KeyRound,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { customerApi, usersApi } from '../../services/api'
import { cx, digits, num, toEnDigits } from '../../utils/format'
import { customerScopeMeta, userTypeMeta } from '../../utils/meta'
import type {
  CustomerLookupItem,
  CustomerScope,
  RoleOption,
  SystemPermission,
  User,
  UserType,
} from '../../types'

const FALLBACK_ROLES: RoleOption[] = [
  {
    key: 'salesperson',
    label: 'کارمند فروش (Salesperson)',
    description:
      'ثبت مشتری جدید و فروش/تخصیص دستگاه؛ به صورت پیش‌فرض فقط مشتریان ثبت‌شده توسط خودش را می‌بیند.',
    default_customer_scope: 'own',
    default_permissions: [
      'customers.view',
      'customers.create',
      'customers.edit',
      'parts.view',
      'parts.assign',
      'sms.send',
      'sms.logs',
    ],
  },
  {
    key: 'installer',
    label: 'نصاب (Installer)',
    description:
      'مشاهده دستگاه‌های مشتریان، ثبت تحویل/نصب و ثبت سوابق سرویس و تعمیرات فنی.',
    default_customer_scope: 'all',
    default_permissions: ['customers.view', 'parts.view', 'parts.assign', 'parts.history'],
  },
  {
    key: 'manager',
    label: 'مدیر / سرپرست (Manager)',
    description:
      'کاربر مدیریتی و عملیاتی با دسترسی گسترده به مشتریان، انبار دستگاه‌ها و گزارش‌ها.',
    default_customer_scope: 'all',
    default_permissions: [
      'customers.view',
      'customers.create',
      'customers.edit',
      'customers.delete',
      'customers.import',
      'customers.export',
      'parts.view',
      'parts.manage',
      'parts.assign',
      'parts.history',
      'sms.send',
      'sms.logs',
    ],
  },
  {
    key: 'administrator',
    label: 'مدیر ارشد (Administrator)',
    description:
      'دسترسی کامل به کل سامانه، مدیریت کارمندان، تنظیمات برندینگ و ارتقای سیستم.',
    default_customer_scope: 'all',
    default_permissions: [
      'customers.view',
      'customers.create',
      'customers.edit',
      'customers.delete',
      'customers.import',
      'customers.export',
      'parts.view',
      'parts.manage',
      'parts.assign',
      'parts.history',
      'sms.send',
      'sms.logs',
      'users.manage',
      'settings.manage',
    ],
  },
]

interface Props {
  editingUserId?: string
  isPrimaryAdminAccount?: boolean
  canAssignAdministrator: boolean
  userType: UserType
  onChangeUserType: (
    nextType: UserType,
    defaultScope: CustomerScope,
    defaultPermissions: string[],
  ) => void
  customerScope: CustomerScope
  onChangeCustomerScope: (scope: CustomerScope) => void
  grantedStaffIds: number[]
  onChangeGrantedStaffIds: (ids: number[]) => void
  grantedCustomerIds: number[]
  onChangeGrantedCustomerIds: (ids: number[]) => void
  initialGrantedCustomers?: Array<{ id: number; display_name: string }>
  availablePermissions: SystemPermission[]
  selectedPerms: string[]
  onChangeSelectedPerms: (perms: string[]) => void
}

export function UserCustomerAccessPanel({
  editingUserId,
  isPrimaryAdminAccount = false,
  canAssignAdministrator,
  userType,
  onChangeUserType,
  customerScope,
  onChangeCustomerScope,
  grantedStaffIds,
  onChangeGrantedStaffIds,
  grantedCustomerIds,
  onChangeGrantedCustomerIds,
  initialGrantedCustomers = [],
  availablePermissions,
  selectedPerms,
  onChangeSelectedPerms,
}: Props) {
  const [staffSearch, setStaffSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerLabelCache, setCustomerLabelCache] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    for (const c of initialGrantedCustomers) {
      map[c.id] = c.display_name
    }
    return map
  })

  const { data: serverRoles } = useQuery({
    queryKey: ['system-roles'],
    queryFn: usersApi.getRoles,
  })

  const { data: allUsers = [] } = useQuery({
    queryKey: ['system-users'],
    queryFn: usersApi.list,
  })

  const { data: customerLookup = [], isFetching: lookupLoading } = useQuery({
    queryKey: ['customers-lookup', customerSearch],
    queryFn: () => customerApi.lookup(customerSearch.trim() || undefined),
    enabled: userType !== 'administrator' && customerScope !== 'all',
  })

  const rolesList = (serverRoles && serverRoles.length > 0 ? serverRoles : FALLBACK_ROLES).filter(
    (r) => canAssignAdministrator || r.key !== 'administrator' || userType === 'administrator',
  )

  const getRoleIcon = (key: UserType) => {
    if (key === 'administrator') return Crown
    if (key === 'manager') return ShieldCheck
    if (key === 'salesperson') return UserCheck
    return Wrench
  }

  const handlePickRole = (role: RoleOption) => {
    if (isPrimaryAdminAccount) return
    if (role.key === 'administrator' && !canAssignAdministrator) return
    const allowedSet = new Set(availablePermissions.map((p) => p.name))
    const presetPerms =
      allowedSet.size > 0
        ? role.default_permissions.filter((p) => allowedSet.has(p))
        : role.default_permissions
    onChangeUserType(role.key, role.default_customer_scope, presetPerms)
  }

  const applyCurrentRolePreset = () => {
    const found =
      rolesList.find((r) => r.key === userType) ||
      FALLBACK_ROLES.find((r) => r.key === userType)
    if (!found) return
    const allowedSet = new Set(availablePermissions.map((p) => p.name))
    const presetPerms =
      allowedSet.size > 0
        ? found.default_permissions.filter((p) => allowedSet.has(p))
        : found.default_permissions
    onChangeSelectedPerms(presetPerms)
  }

  const toggleStaff = (staffId: number) => {
    onChangeGrantedStaffIds(
      grantedStaffIds.includes(staffId)
        ? grantedStaffIds.filter((id) => id !== staffId)
        : [...grantedStaffIds, staffId],
    )
  }

  const toggleCustomer = (item: CustomerLookupItem) => {
    setCustomerLabelCache((prev) => ({ ...prev, [item.id]: item.display_name }))
    onChangeGrantedCustomerIds(
      grantedCustomerIds.includes(item.id)
        ? grantedCustomerIds.filter((id) => id !== item.id)
        : [...grantedCustomerIds, item.id],
    )
  }

  const resolveCustomerName = (cid: number) => {
    if (customerLabelCache[cid]) return customerLabelCache[cid]
    const fromLookup = customerLookup.find((x) => x.id === cid)
    if (fromLookup) return fromLookup.display_name
    const fromInit = initialGrantedCustomers.find((x) => x.id === cid)
    if (fromInit) return fromInit.display_name
    return `مشتری #${cid}`
  }

  const selectableStaff = allUsers.filter(
    (u: User) =>
      String(u.id) !== String(editingUserId || '') &&
      (!staffSearch.trim() ||
        u.name.toLowerCase().includes(staffSearch.trim().toLowerCase()) ||
        u.email.toLowerCase().includes(staffSearch.trim().toLowerCase())),
  )

  const togglePerm = (permName: string) => {
    onChangeSelectedPerms(
      selectedPerms.includes(permName)
        ? selectedPerms.filter((p) => p !== permName)
        : [...selectedPerms, permName],
    )
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Organizational Role Selection */}
      <div className="card-surface p-6 sm:p-8 space-y-4">
        <div>
          <h3 className="text-base font-bold text-base-content flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            نقش سازمانی کارمند (Role)
          </h3>
          <p className="text-xs text-base-content/60 mt-1">
            {isPrimaryAdminAccount
              ? 'این حساب، مدیر ارشد اصلی سامانه است و نقش آن تغییرناپذیر است.'
              : 'با انتخاب نقش کارمند، محدوده دسترسی مشتریان و مجوزهای پیشنهادی آن نقش به طور خودکار تنظیم شده و در بخش پایین قابل سفارشی‌سازی است.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rolesList.map((role) => {
            const Icon = getRoleIcon(role.key)
            const active = userType === role.key
            const disabled =
              isPrimaryAdminAccount || (role.key === 'administrator' && !canAssignAdministrator)

            return (
              <button
                key={role.key}
                type="button"
                disabled={disabled}
                onClick={() => handlePickRole(role)}
                className={cx(
                  'flex items-start gap-3 rounded-2xl border p-4 text-start transition-all',
                  disabled ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer',
                  active
                    ? 'border-primary bg-primary/6 ring-2 ring-primary/20 shadow-xs'
                    : 'border-base-200 bg-base-100 hover:border-base-300',
                )}
              >
                <span
                  className={cx(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/70',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-xs text-base-content">{role.label}</p>
                    {active && <span className="badge badge-primary badge-xs">انتخاب شده</span>}
                  </div>
                  <p className="text-[11px] text-base-content/60 mt-1 leading-relaxed">
                    {role.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 2: Row-Level Customer Access Scope & Sharing */}
      {userType !== 'administrator' && (
        <div className="card-surface p-6 sm:p-8 space-y-5">
          <div>
            <h3 className="text-base font-bold text-base-content flex items-center gap-2">
              <Users className="size-5 text-primary" />
              محدوده دسترسی به پرونده مشتریان (تفکیک مشتریان)
            </h3>
            <p className="text-xs text-base-content/60 mt-1">
              مشخص کنید این کارمند فقط مشتریان ثبت‌شده توسط خودش را ببیند یا به مشتریان سایر همکاران / مشتریان خاص نیز دسترسی داشته باشد.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['own', 'selected', 'all'] as CustomerScope[]).map((scopeKey) => {
              const meta = customerScopeMeta[scopeKey]
              const active = customerScope === scopeKey
              return (
                <button
                  key={scopeKey}
                  type="button"
                  onClick={() => onChangeCustomerScope(scopeKey)}
                  className={cx(
                    'rounded-2xl border p-3.5 text-start transition-all cursor-pointer',
                    active
                      ? 'border-primary bg-primary/6 ring-2 ring-primary/20'
                      : 'border-base-200 bg-base-100 hover:border-base-300',
                  )}
                >
                  <p className="font-bold text-xs text-base-content">{meta.label}</p>
                  <p className="text-[11px] text-base-content/60 mt-1 leading-relaxed">
                    {meta.description}
                  </p>
                </button>
              )
            })}
          </div>

          {customerScope !== 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-3 border-t border-base-200">
              {/* Grant access to another staff member's customers */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-base-content">
                    مشاهده مشتریان سایر کارمندان ({num(grantedStaffIds.length)} همکار)
                  </label>
                  {grantedStaffIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChangeGrantedStaffIds([])}
                      className="text-[11px] text-error hover:underline cursor-pointer"
                    >
                      حذف همه
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-base-content/60">
                  با انتخاب هر کارمند، تمامی مشتریانی که توسط او ثبت شده‌اند نیز برای این کاربر قابل مشاهده خواهند بود.
                </p>

                <label className="input input-bordered input-sm flex items-center gap-2 w-full">
                  <Search className="size-3.5 text-base-content/45" />
                  <input
                    className="grow text-xs"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="جستجوی نام کارمند..."
                  />
                </label>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-base-200 bg-base-200/30 p-2 space-y-1">
                  {selectableStaff.length === 0 ? (
                    <p className="p-3 text-center text-xs text-base-content/50">
                      کارمند دیگری یافت نشد
                    </p>
                  ) : (
                    selectableStaff.map((staff) => {
                      const numId = Number(staff.id)
                      const checked = grantedStaffIds.includes(numId)
                      const rMeta = staff.user_type ? userTypeMeta[staff.user_type] : null
                      return (
                        <label
                          key={staff.id}
                          className={cx(
                            'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors',
                            checked ? 'bg-primary/10 font-bold' : 'hover:bg-base-200',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-xs"
                              checked={checked}
                              onChange={() => toggleStaff(numId)}
                            />
                            <span className="truncate">{staff.name}</span>
                          </div>
                          {rMeta && (
                            <span className={cx('badge badge-xs shrink-0', rMeta.badgeClass)}>
                              {rMeta.label}
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Grant access to specific individual customers */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-base-content">
                    دسترسی مستقیم به مشتریان خاص ({num(grantedCustomerIds.length)} مشتری)
                  </label>
                  {grantedCustomerIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChangeGrantedCustomerIds([])}
                      className="text-[11px] text-error hover:underline cursor-pointer"
                    >
                      حذف همه
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-base-content/60">
                  مشتریان مشخصی که می‌خواهید مستقیماً به فهرست دسترسی این کاربر اضافه شوند (مثلاً جهت نصب یا پیگیری مشترک).
                </p>

                <label className="input input-bordered input-sm flex items-center gap-2 w-full">
                  <Search className="size-3.5 text-base-content/45" />
                  <input
                    className="grow text-xs"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(toEnDigits(e.target.value))}
                    placeholder="جستجوی نام مشتری، نام شرکت یا موبایل..."
                  />
                  {lookupLoading && <span className="loading loading-spinner loading-xs" />}
                </label>

                {grantedCustomerIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {grantedCustomerIds.map((cid) => (
                      <span
                        key={cid}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/25 px-2 py-1 text-[11px] font-bold text-primary"
                      >
                        {resolveCustomerName(cid)}
                        <button
                          type="button"
                          onClick={() =>
                            onChangeGrantedCustomerIds(
                              grantedCustomerIds.filter((x) => x !== cid),
                            )
                          }
                          className="hover:text-error cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="max-h-44 overflow-y-auto rounded-xl border border-base-200 bg-base-200/30 p-2 space-y-1">
                  {customerLookup.length === 0 && !lookupLoading ? (
                    <p className="p-3 text-center text-xs text-base-content/50">
                      مشتری یافت نشد
                    </p>
                  ) : (
                    customerLookup.map((c) => {
                      const checked = grantedCustomerIds.includes(c.id)
                      return (
                        <label
                          key={c.id}
                          className={cx(
                            'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors',
                            checked ? 'bg-primary/10 font-bold' : 'hover:bg-base-200',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-xs"
                              checked={checked}
                              onChange={() => toggleCustomer(c)}
                            />
                            <span className="truncate">{c.display_name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-base-content/50 shrink-0 ltr-text">
                            {c.mobile ? digits(c.mobile) : c.creator_name || ''}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 3: Direct ACL Permissions */}
      <div className="card-surface p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-base-200">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
              <KeyRound className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-base-content">مجوزهای عملیاتی (ACL)</h3>
              <p className="text-xs text-base-content/60">
                {userType === 'administrator'
                  ? 'مدیر ارشد به صورت خودکار به تمام بخش‌های سامانه دسترسی کامل دارد.'
                  : `${num(selectedPerms.length)} دسترسی از ${num(availablePermissions.length)} مجاز انتخاب شده است`}
              </p>
            </div>
          </div>

          {userType !== 'administrator' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyCurrentRolePreset}
                className="btn btn-xs btn-outline btn-primary gap-1"
              >
                <Sparkles className="size-3.5" /> پیش‌فرض نقش {userTypeMeta[userType].label}
              </button>
              <button
                type="button"
                onClick={() => onChangeSelectedPerms(availablePermissions.map((p) => p.name))}
                className="btn btn-xs btn-ghost"
              >
                انتخاب همه
              </button>
              <button
                type="button"
                onClick={() => onChangeSelectedPerms([])}
                className="btn btn-xs btn-ghost text-error"
              >
                لغو همه
              </button>
            </div>
          )}
        </div>

        {userType !== 'administrator' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availablePermissions.map((perm) => {
              const checked = selectedPerms.includes(perm.name)
              return (
                <label
                  key={perm.name}
                  className={cx(
                    'flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all',
                    checked
                      ? 'border-primary bg-primary/5 text-primary shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40',
                  )}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm mt-0.5"
                    checked={checked}
                    onChange={() => togglePerm(perm.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-base-content">{perm.label}</p>
                    <p className="font-mono text-[10px] text-base-content/50 mt-0.5">{perm.name}</p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
