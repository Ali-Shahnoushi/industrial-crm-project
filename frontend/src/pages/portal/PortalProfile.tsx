import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Lock, Save } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field } from '../../components/ui/Field'
import { PasswordRulesTooltip } from '../../components/ui/PasswordRulesTooltip'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'
import { digits, toEnDigits } from '../../utils/format'

export default function PortalProfile() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('current_password', toEnDigits(currentPassword.trim()))
      fd.append('password', toEnDigits(newPassword.trim()))
      return authApi.updateProfile(fd)
    },
    onSuccess: (res) => {
      toast.success('رمز عبور پنل کاربری شما با موفقیت تغییر یافت.')
      setUser(res.user)
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: (err: any) => {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در تغییر رمز عبور')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!currentPassword.trim()) {
      toast.error('رمز عبور فعلی را وارد کنید')
      return
    }
    if (newPassword.trim().length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('رمز عبور جدید باید حداقل ۸ کاراکتر و شامل حروف انگلیسی و عدد باشد')
      return
    }
    mutation.mutate()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="اطلاعات حساب و تغییر رمز عبور"
      />

      <div className="rounded-2xl border border-base-200 bg-base-100 p-6 shadow-xs space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs border-b border-base-200 pb-5">
          <div>
            <p className="text-base-content/55">عنوان حساب مشتری</p>
            <p className="mt-1 font-extrabold text-sm text-base-content">{user.name}</p>
          </div>
          <div>
            <p className="text-base-content/55">شماره همراه ورود</p>
            <p className="mt-1 font-mono font-bold text-sm ltr-text">
              {user.phone ? digits(user.phone) : '—'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-base-content/55">پست الکترونیک / شناسه کاربری</p>
            <p className="mt-1 font-mono text-xs ltr-text">{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-base-content">
            <Lock className="size-4 text-primary" /> تغییر رمز عبور پنل کاربری
          </h3>

          <Field label="رمز عبور فعلی" required>
            <input
              type="password"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="رمز عبور فعلی خود را وارد کنید"
              required
            />
          </Field>

          <Field label="رمز عبور جدید (حداقل ۸ کاراکتر شامل حرف انگلیسی و عدد)" required>
            <PasswordRulesTooltip
              value={newPassword}
              onChange={(val) => setNewPassword(toEnDigits(val))}
              placeholder="رمز عبور جدید"
            />
          </Field>

          <button
            type="submit"
            className="btn btn-primary btn-sm gap-1.5"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save className="size-4" />
            )}
            ثبت رمز عبور جدید
          </button>
        </form>
      </div>
    </div>
  )
}
