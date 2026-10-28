import { Link } from 'react-router-dom'
import { ShieldAlert, LayoutDashboard, User } from 'lucide-react'

interface AccessDeniedProps {
  requiredPermission?: string
  title?: string
  message?: string
}

export default function AccessDenied({
  requiredPermission,
  title = 'دسترسی غیرمجاز (Access Denied)',
  message = 'شما مجوز دسترسی لازم برای مشاهده یا ویرایش این بخش را ندارید.',
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="card-surface max-w-md w-full p-8 text-center space-y-6 shadow-xl border-error/20">
        <div className="size-20 mx-auto rounded-3xl bg-error/10 text-error flex items-center justify-center border border-error/20">
          <ShieldAlert className="size-10" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-error/10 text-error border border-error/20">
            خطای ۴۰۳ • عدم دسترسی
          </div>
          <h1 className="text-xl font-bold text-base-content">{title}</h1>
          <p className="text-xs text-base-content/70 leading-relaxed">{message}</p>
          {requiredPermission && (
            <p className="text-[11px] font-mono text-base-content/60 bg-base-200 py-1 px-3 rounded-lg inline-block mt-1">
              مجوز الزامی: <span className="font-bold text-error">{requiredPermission}</span>
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="btn btn-primary btn-sm w-full sm:w-auto gap-2">
            <LayoutDashboard className="size-4" />
            بازگشت به پیشخوان
          </Link>
          <Link to="/settings/profile" className="btn btn-ghost btn-sm w-full sm:w-auto gap-2">
            <User className="size-4" />
            پروفایل من
          </Link>
        </div>
      </div>
    </div>
  )
}
