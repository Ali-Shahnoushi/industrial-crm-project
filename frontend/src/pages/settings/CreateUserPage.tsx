import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowRight, Save, UserPlus } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field } from '../../components/ui/Field'
import { FilePondAvatar } from '../../components/ui/FilePondAvatar'
import { PasswordRulesTooltip } from '../../components/ui/PasswordRulesTooltip'
import { UserCustomerAccessPanel } from '../../components/users/UserCustomerAccessPanel'
import AccessDenied from '../AccessDenied'
import { usersApi } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'
import { toEnDigits } from '../../utils/format'
import type { CustomerScope, UserType } from '../../types'

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
    .min(8, 'کلمه عبور باید حداقل ۸ کاراکتر باشد')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'کلمه عبور باید شامل حروف انگلیسی و اعداد باشد'),
  is_active: z.boolean(),
})

type CreateUserFormValues = z.infer<typeof schema>

const INITIAL_SALESPERSON_PERMS = [
  'customers.view',
  'customers.create',
  'customers.edit',
  'parts.view',
  'parts.assign',
  'sms.send',
  'sms.logs',
]

export default function CreateUserPage() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAdministrator = useAuthStore((s) => s.isAdministrator)()

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [userType, setUserType] = useState<UserType>('salesperson')
  const [customerScope, setCustomerScope] = useState<CustomerScope>('own')
  const [grantedStaffIds, setGrantedStaffIds] = useState<number[]>([])
  const [grantedCustomerIds, setGrantedCustomerIds] = useState<number[]>([])
  const [selectedPerms, setSelectedPerms] = useState<string[]>(INITIAL_SALESPERSON_PERMS)

  const { data: availablePermissions = [] } = useQuery({
    queryKey: ['available-permissions'],
    queryFn: usersApi.getAvailablePermissions,
    enabled: hasPermission('users.manage'),
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      is_active: true,
    },
  })

  const phoneVal = useWatch({ control, name: 'phone' })
  const passwordVal = useWatch({ control, name: 'password' })

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => usersApi.create(formData),
    onSuccess: (res) => {
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['system-users'] })
      nav('/settings/users')
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      const msg = firstErr?.[0] || err.response?.data?.message || 'خطا در ایجاد کارمند'
      toast.error(msg)
    },
  })

  const onSubmit = (values: CreateUserFormValues) => {
    const formData = new FormData()
    formData.append('name', values.name.trim())
    formData.append('email', toEnDigits(values.email.trim()))
    if (values.phone && values.phone.trim()) {
      formData.append('phone', toEnDigits(values.phone.trim()))
    }
    formData.append('password', toEnDigits(values.password))
    formData.append('is_active', values.is_active ? '1' : '0')
    formData.append('user_type', userType)
    formData.append('customer_scope', userType === 'administrator' ? 'all' : customerScope)

    if (avatarFile) {
      formData.append('avatar', avatarFile)
    }

    selectedPerms.forEach((p) => {
      formData.append('permissions[]', p)
    })

    if (userType !== 'administrator' && customerScope !== 'all') {
      grantedStaffIds.forEach((sid) => {
        formData.append('granted_staff_ids[]', String(sid))
      })
      grantedCustomerIds.forEach((cid) => {
        formData.append('granted_customer_ids[]', String(cid))
      })
    }

    createMutation.mutate(formData)
  }

  if (!hasPermission('users.manage')) {
    return <AccessDenied requiredPermission="users.manage" />
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-base-content/60">
        <Link to="/settings/users" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowRight className="size-3.5" /> بازگشت به لیست کارمندان
        </Link>
        <span>/</span>
        <span className="text-base-content font-bold">تعریف کارمند جدید</span>
      </div>

      <PageHeader
        title="تعریف کارمند جدید"
        subtitle="ایجاد حساب کاربری با تعیین نقش سازمانی، محدوده دسترسی به مشتریان و مجوزهای عملیاتی"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: User Profile & Photo */}
        <div className="card-surface p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-base-200">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              <UserPlus className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-base-content">اطلاعات هویتی و حساب</h3>
              <p className="text-xs text-base-content/60">نام، مشخصات تماس و تصویر نمایه کارمند را وارد نمایید.</p>
            </div>
          </div>

          <FilePondAvatar
            label="تصویر پروفایل کارمند"
            onFileChange={(file) => setAvatarFile(file)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <Field label="نام و نام خانوادگی" required error={errors.name?.message}>
              <input
                className="input input-bordered w-full text-sm"
                placeholder="مثال: علی احمدی"
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
                value={phoneVal || ''}
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

            <Field label="کلمه عبور ورود به سامانه" required error={errors.password?.message}>
              <PasswordRulesTooltip
                value={passwordVal}
                onChange={(val) => setValue('password', toEnDigits(val), { shouldValidate: true })}
                placeholder="حداقل ۸ کاراکتر شامل حروف و اعداد"
                error={errors.password?.message}
                required
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold text-xs text-base-content">فعال بودن حساب کاربری</p>
                <p className="text-[11px] text-base-content/60 mt-0.5">
                  در صورت غیرفعال بودن، کارمند امکان ورود به سامانه را نخواهد داشت.
                </p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                {...register('is_active')}
              />
            </label>
          </div>
        </div>

        {/* Step 2 & 3: Role, Customer Scope, Sharing & ACL Permissions */}
        <UserCustomerAccessPanel
          canAssignAdministrator={isAdministrator}
          userType={userType}
          onChangeUserType={(nextType, defaultScope, defaultPerms) => {
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
          availablePermissions={availablePermissions}
          selectedPerms={selectedPerms}
          onChangeSelectedPerms={setSelectedPerms}
        />

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link to="/settings/users" className="btn btn-ghost">
            انصراف
          </Link>
          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={isSubmitting || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save className="size-4" />
            )}
            ثبت و ایجاد کارمند
          </button>
        </div>
      </form>
    </div>
  )
}
