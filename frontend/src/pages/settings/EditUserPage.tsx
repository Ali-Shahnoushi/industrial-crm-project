import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowRight, Pencil, Save, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field, PageSkeleton } from '../../components/ui/Field'
import { FilePondAvatar } from '../../components/ui/FilePondAvatar'
import { ConfirmDialog } from '../../components/ui/Modal'
import { PasswordRulesTooltip } from '../../components/ui/PasswordRulesTooltip'
import { UserCustomerAccessPanel } from '../../components/users/UserCustomerAccessPanel'
import AccessDenied from '../AccessDenied'
import { usersApi } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'
import { toEnDigits } from '../../utils/format'
import type { CustomerScope, User, UserType } from '../../types'

const schema = z.object({
  name: z.string().trim().min(2, 'نام و نام خانوادگی را حداقل در ۲ کاراکتر وارد کنید'),
  email: z.string().trim().email('فرمت آدرس ایمیل معتبر نیست'),
  phone: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      if (!val || val.trim() === '') return
      const cleaned = toEnDigits(val.trim())
      if (!/^09\d{9}$/.test(cleaned)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود (مثال: 09121234567)',
        })
      }
    }),
  password: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      if (!val || val.trim() === '') return
      const trimmed = val.trim()
      if (trimmed.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'کلمه عبور جدید باید حداقل ۸ کاراکتر باشد',
        })
      }
      if (!/[a-zA-Z]/.test(trimmed) || !/[0-9]/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'کلمه عبور باید شامل حروف انگلیسی و اعداد باشد',
        })
      }
    }),
  is_active: z.boolean(),
})

type EditUserFormValues = z.infer<typeof schema>

function EditUserLoadedForm({ targetUser }: { targetUser: User }) {
  const qc = useQueryClient()
  const nav = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const isAdministrator = useAuthStore((s) => s.isAdministrator)()

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const initialType: UserType = targetUser.user_type || 'manager'
  const [userType, setUserType] = useState<UserType>(initialType)
  const [customerScope, setCustomerScope] = useState<CustomerScope>(
    targetUser.customer_scope || (initialType === 'administrator' ? 'all' : 'own'),
  )
  const [grantedStaffIds, setGrantedStaffIds] = useState<number[]>(
    targetUser.granted_staff_ids || [],
  )
  const [grantedCustomerIds, setGrantedCustomerIds] = useState<number[]>(
    targetUser.granted_customer_ids || [],
  )
  const [selectedPerms, setSelectedPerms] = useState<string[]>(targetUser.permissions || [])

  const isCurrent = currentUser?.id === String(targetUser.id)
  const isPrimaryAdmin = targetUser.email === 'admin@crm.local'

  const { data: availablePermissions = [] } = useQuery({
    queryKey: ['available-permissions'],
    queryFn: usersApi.getAvailablePermissions,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone || '',
      password: '',
      is_active: targetUser.is_active ?? true,
    },
  })

  useEffect(() => {
    reset({
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone || '',
      password: '',
      is_active: targetUser.is_active ?? true,
    })
  }, [targetUser, reset])

  const updateMutation = useMutation({
    mutationFn: (formData: FormData) => usersApi.update(targetUser.id, formData),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['system-users'] })
      qc.invalidateQueries({ queryKey: ['system-user', String(targetUser.id)] })
      if (isCurrent) {
        useAuthStore.getState().refreshMe()
      }
      nav('/settings/users')
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      const msg = firstErr?.[0] || err.response?.data?.message || 'خطا در ذخیره تغییرات کاربر'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.delete(targetUser.id),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['system-users'] })
      nav('/settings/users')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف کاربر')
    },
  })

  const onSubmit = (values: EditUserFormValues) => {
    const formData = new FormData()
    formData.append('name', values.name.trim())
    formData.append('email', toEnDigits(values.email.trim()))
    const cleanedPhone = values.phone ? toEnDigits(values.phone.trim()) : ''
    formData.append('phone', cleanedPhone)
    if (values.password && values.password.trim()) {
      formData.append('password', toEnDigits(values.password.trim()))
    }
    formData.append('is_active', values.is_active ? '1' : '0')
    formData.append('user_type', userType)
    formData.append('customer_scope', userType === 'administrator' ? 'all' : customerScope)

    if (avatarFile) {
      formData.append('avatar', avatarFile)
    }
    if (removeAvatar) {
      formData.append('remove_avatar', '1')
    }

    selectedPerms.forEach((p) => {
      formData.append('permissions[]', p)
    })
    formData.append('sync_permissions', '1')

    formData.append('sync_customer_grants', '1')
    if (userType !== 'administrator' && customerScope !== 'all') {
      grantedStaffIds.forEach((sid) => {
        formData.append('granted_staff_ids[]', String(sid))
      })
      grantedCustomerIds.forEach((cid) => {
        formData.append('granted_customer_ids[]', String(cid))
      })
    }

    updateMutation.mutate(formData)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-base-content/60">
        <Link to="/settings/users" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowRight className="size-3.5" /> بازگشت به لیست کارمندان
        </Link>
        <span>/</span>
        <span className="text-base-content font-bold">ویرایش «{targetUser.name}»</span>
      </div>

      <PageHeader
        title={`ویرایش مشخصات کارمند: ${targetUser.name}`}
        subtitle="ویرایش اطلاعات هویتی، نقش سازمانی، محدوده دسترسی به مشتریان و مجوزهای عملیاتی"
        actions={
          !isCurrent && !isPrimaryAdmin && (isAdministrator || targetUser.user_type !== 'administrator') ? (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="btn btn-sm btn-ghost text-error hover:bg-error/10 gap-1.5"
            >
              <Trash2 className="size-4" /> حذف این کارمند
            </button>
          ) : undefined
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card-surface p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-base-200">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              <Pencil className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-base-content">مشخصات هویتی و ورود به سامانه</h3>
              <p className="text-xs text-base-content/60">
                اطلاعات فردی و مشخصات کاربری را در صورت نیاز ویرایش نمایید.
              </p>
            </div>
          </div>

          <FilePondAvatar
            label="تصویر پروفایل کارمند"
            currentAvatarUrl={removeAvatar ? null : targetUser.avatar_url}
            onFileChange={(file) => {
              setAvatarFile(file)
              if (file) setRemoveAvatar(false)
            }}
            onRemoveCurrentAvatar={() => {
              setRemoveAvatar(true)
              setAvatarFile(null)
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <Field label="نام و نام خانوادگی" required error={errors.name?.message}>
              <input
                className="input input-bordered w-full text-sm"
                placeholder="نام و نام خانوادگی"
                {...register('name')}
              />
            </Field>

            <Field label="پست الکترونیکی (نام کاربری ورود)" required error={errors.email?.message}>
              <input
                type="email"
                dir="ltr"
                className="input input-bordered w-full text-start font-mono text-sm"
                placeholder="user@example.com"
                {...register('email', {
                  onChange: (e) => {
                    e.target.value = toEnDigits(e.target.value)
                  },
                })}
              />
            </Field>

            <Field label="شماره تلفن همراه (۱۱ رقم با 09)" error={errors.phone?.message}>
              <input
                dir="ltr"
                maxLength={11}
                className="input input-bordered w-full text-start font-mono text-sm"
                placeholder="09121234567"
                value={watch('phone') || ''}
                onChange={(e) => {
                  const cleaned = toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 11)
                  setValue('phone', cleaned, { shouldValidate: true })
                }}
                onKeyDown={(e) => {
                  if (
                    e.ctrlKey ||
                    e.metaKey ||
                    ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)
                  ) {
                    return
                  }
                  if (!/^[0-9۰-۹٠-٩]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </Field>

            <Field
              label="تغییر کلمه عبور (در صورت خالی بودن، رمز قبلی باقی می‌ماند)"
              error={errors.password?.message}
            >
              <PasswordRulesTooltip
                value={watch('password') || ''}
                onChange={(val) => setValue('password', toEnDigits(val), { shouldValidate: true })}
                placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                error={errors.password?.message}
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold text-xs text-base-content">وضعیت فعال بودن حساب کاربری</p>
                <p className="text-[11px] text-base-content/60 mt-0.5">
                  {isCurrent
                    ? 'امکان غیرفعال کردن حساب کاربری خودتان وجود ندارد.'
                    : 'در صورت غیرفعال بودن، ورود کارمند به سیستم مسدود می‌شود.'}
                </p>
              </div>
              <input
                type="checkbox"
                disabled={isCurrent}
                className="toggle toggle-primary toggle-sm"
                {...register('is_active')}
              />
            </label>
          </div>
        </div>

        <UserCustomerAccessPanel
          editingUserId={String(targetUser.id)}
          isPrimaryAdminAccount={isPrimaryAdmin}
          canAssignAdministrator={isAdministrator}
          userType={userType}
          onChangeUserType={(nextType, defaultScope, defaultPerms) => {
            if (isCurrent && targetUser.user_type === 'administrator' && nextType !== 'administrator') {
              toast.error('امکان تنزل نقش مدیر ارشد برای حساب جاری خودتان وجود ندارد.')
              return
            }
            setUserType(nextType)
            setCustomerScope(defaultScope)
            setSelectedPerms(defaultPerms)
          }}
          customerScope={customerScope}
          onChangeCustomerScope={setCustomerScope}
          grantedStaffIds={grantedStaffIds}
          onChangeGrantedStaffIds={setGrantedStaffIds}
          grantedCustomerIds={grantedCustomerIds}
          onChangeGrantedCustomerIds={setGrantedCustomerIds}
          initialGrantedCustomers={targetUser.granted_customers || []}
          availablePermissions={availablePermissions}
          selectedPerms={selectedPerms}
          onChangeSelectedPerms={setSelectedPerms}
        />

        <div className="flex items-center justify-end gap-3">
          <Link to="/settings/users" className="btn btn-ghost">
            انصراف
          </Link>
          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={isSubmitting || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save className="size-4" />
            )}
            ذخیره تغییرات کارمند
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="حذف کارمند"
        message={`آیا از حذف حساب «${targetUser.name}» اطمینان دارید؟ این عملیات قابل بازگشت نیست.`}
        confirmText="حذف کارمند"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAdministrator = useAuthStore((s) => s.isAdministrator)()

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['system-user', id],
    queryFn: () => usersApi.get(id!),
    enabled: Boolean(id) && hasPermission('users.manage'),
  })

  if (!hasPermission('users.manage')) {
    return <AccessDenied requiredPermission="users.manage" />
  }

  if (userLoading) {
    return <PageSkeleton />
  }

  if (!user) {
    return (
      <div className="card-surface p-8 text-center space-y-3">
        <p className="text-error font-bold">کارمند مورد نظر یافت نشد.</p>
        <Link to="/settings/users" className="btn btn-sm btn-ghost">
          بازگشت به فهرست کارمندان
        </Link>
      </div>
    )
  }

  if (user.user_type === 'administrator' && !isAdministrator) {
    return (
      <AccessDenied
        title="عدم دسترسی به حساب مدیر ارشد"
        message="مدیران عادی اجازه دسترسی، ویرایش یا حذف حساب‌های کاربری مدیران ارشد را ندارند."
      />
    )
  }

  return <EditUserLoadedForm key={user.id} targetUser={user} />
}
