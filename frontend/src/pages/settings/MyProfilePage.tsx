import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Check,
  KeyRound,
  Save,
  User as UserIcon,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field, PageSkeleton } from '../../components/ui/Field'
import { FilePondAvatar } from '../../components/ui/FilePondAvatar'
import { PasswordRulesTooltip } from '../../components/ui/PasswordRulesTooltip'
import { Avatar } from '../../components/ui/Avatar'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'
import { customerScopeMeta, roleLabel, userTypeMeta } from '../../utils/meta'
import { cx, num, toEnDigits } from '../../utils/format'

const PERMISSION_LABELS_FA: Record<string, string> = {
  'customers.view': 'مشاهده مشتریان',
  'customers.create': 'ایجاد مشتری',
  'customers.edit': 'ویرایش مشتری',
  'customers.delete': 'حذف مشتری',
  'customers.import': 'ورود گروهی مشتریان با اکسل',
  'customers.export': 'خروجی اکسل مشتریان و دستگاه‌ها',
  'parts.view': 'مشاهده کاتالوگ دستگاه‌ها و موجودی انبار',
  'parts.manage': 'تعریف دستگاه و ثبت ورود/خروج انبار',
  'parts.assign': 'تخصیص، ویرایش و حذف دستگاه مشتری',
  'parts.history': 'ثبت سوابق نصب، سرویس و تعمیرات دستگاه‌ها',
  'sms.send': 'ارسال پیامک الگو',
  'sms.logs': 'مشاهده سوابق پیامک',
  'users.manage': 'مدیریت کارمندان، نقش‌ها و دسترسی‌ها',
  'settings.manage': 'مدیریت تنظیمات سیستم',
}

const schema = z.object({
  name: z.string().trim().min(2, 'نام و نام خانوادگی را حداقل در ۲ کاراکتر وارد کنید'),
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
})

type ProfileFormValues = z.infer<typeof schema>

export default function MyProfilePage() {
  const qc = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  const { data: profileUser, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: authApi.me,
    staleTime: 0,
  })

  const currentUser = profileUser || authUser

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentUser?.name || '',
      phone: currentUser?.phone || '',
      password: '',
    },
  })

  useEffect(() => {
    if (profileUser) {
      setUser(profileUser)
      reset({
        name: profileUser.name,
        phone: profileUser.phone || '',
        password: '',
      })
    }
  }, [profileUser, reset, setUser])

  const updateProfileMutation = useMutation({
    mutationFn: (formData: FormData) => authApi.updateProfile(formData),
    onSuccess: async (res) => {
      toast.success(res.message || 'مشخصات حساب شما با موفقیت بروزرسانی شد.')
      setUser(res.user)
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      qc.invalidateQueries({ queryKey: ['system-users'] })
      setAvatarFile(null)
      setRemoveAvatar(false)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'خطا در ویرایش اطلاعات حساب'
      toast.error(msg)
    },
  })

  const onSubmit = (values: ProfileFormValues) => {
    const formData = new FormData()
    formData.append('name', values.name.trim())
    const cleanedPhone = values.phone ? toEnDigits(values.phone.trim()) : ''
    formData.append('phone', cleanedPhone)
    if (values.password && values.password.trim()) {
      formData.append('password', toEnDigits(values.password.trim()))
    }

    if (avatarFile) {
      formData.append('avatar', avatarFile)
    }

    if (removeAvatar) {
      formData.append('remove_avatar', '1')
    }

    updateProfileMutation.mutate(formData)
  }

  if (isLoading && !currentUser) {
    return <PageSkeleton />
  }

  if (!currentUser) return null

  const uType = currentUser.user_type || 'manager'
  const rMeta = userTypeMeta[uType]
  const scopeKey = currentUser.customer_scope || (uType === 'administrator' ? 'all' : 'own')
  const sMeta = customerScopeMeta[scopeKey]

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="حساب کاربری من"
        subtitle="ویرایش مشخصات فردی، تصویر آواتار و مشاهده نقش و مجوزهای فعال اختصاص داده‌شده به شما"
      />

      {/* Profile Overview Card */}
      <div className="card-surface p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-base-200">
          <Avatar name={currentUser.name} src={currentUser.avatar_url} size="xl" />
          <div className="text-center sm:text-start space-y-1">
            <h2 className="text-xl font-bold text-base-content">{currentUser.name}</h2>
            <p className="text-xs text-base-content/60 font-mono ltr-text">{currentUser.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
              <span className={cx('badge badge-sm font-bold', rMeta?.badgeClass)}>
                {currentUser.role_label || rMeta?.label || roleLabel[currentUser.role || 'admin']}
              </span>
              <span className="badge badge-sm bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                دامنه مشتریان: {sMeta.label}
              </span>
              <span className="badge badge-sm bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                حساب فعال
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <UserIcon className="size-4 text-primary" />
              ویرایش اطلاعات حساب
            </h3>

            <FilePondAvatar
              label="آپلود یا تغییر تصویر آواتار"
              currentAvatarUrl={removeAvatar ? null : currentUser.avatar_url}
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

              <Field label="پست الکترونیکی (نام کاربری ورود)" hint="تغییر ایمیل توسط مدیر سیستم انجام می‌شود">
                <input
                  type="email"
                  dir="ltr"
                  disabled
                  className="input input-bordered w-full text-start font-mono text-sm opacity-70 cursor-not-allowed bg-base-200"
                  value={currentUser.email}
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
                label="تغییر رمز عبور (در صورت نیاز به تغییر)"
                error={errors.password?.message}
                hint="در صورت خالی بودن، رمز قبلی حفظ خواهد شد"
              >
                <PasswordRulesTooltip
                  value={watch('password') || ''}
                  onChange={(val) => setValue('password', toEnDigits(val), { shouldValidate: true })}
                  placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                  error={errors.password?.message}
                />
              </Field>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={isSubmitting || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Save className="size-4" />
              )}
              ذخیره تغییرات پروفایل
            </button>
          </div>
        </form>
      </div>

      {/* Permissions Badges Section */}
      <div className="card-surface p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-base-200">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h3 className="font-bold text-sm text-base-content">مجوزهای فعال اختصاص‌یافته به حساب شما</h3>
          </div>
          <span className="badge badge-sm bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
            {uType === 'administrator'
              ? 'دسترسی کامل'
              : `${num(currentUser.permissions?.length ?? 0)} دسترسی`}
          </span>
        </div>

        <p className="text-xs text-base-content/60 leading-relaxed">
          دسترسی‌های زیر تعیین‌کننده بخش‌های مجاز برای حساب کاربری شما در سامانه مدیریت مشتریان و دستگاه‌ها است:
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {uType === 'administrator' ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Check className="size-3.5" /> دسترسی کامل مدیر ارشد به تمامی بخش‌های سامانه
            </span>
          ) : currentUser.permissions && currentUser.permissions.length > 0 ? (
            currentUser.permissions.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
              >
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                {PERMISSION_LABELS_FA[p] || p}
              </span>
            ))
          ) : (
            <p className="text-xs text-base-content/50">مجوزی برای حساب شما تعریف نشده است.</p>
          )}
        </div>
      </div>
    </div>
  )
}
