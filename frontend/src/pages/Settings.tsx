import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquare,
  Palette,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuthStore } from '../store/useAuthStore'
import { Can } from '../components/common/Can'

export default function Settings() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAdministrator = useAuthStore((s) => s.isAdministrator)()

  const cards = [
    {
      to: '/settings/sms',
      permission: 'settings.manage',
      title: 'سامانه ملی‌پیامک',
      desc: 'پیکربندی نام کاربری، رمز عبور، شماره خط خدماتی و حالت Sandbox',
      icon: MessageSquare,
      badge: 'پیام‌رسانی',
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    },
    {
      to: '/settings/users',
      permission: 'users.manage',
      title: 'کاربران و دسترسی‌ها (ACL)',
      desc: 'مدیریت کاربران، افزودن کاربر جدید با آواتار و اعطای مستقیم دسترسی‌ها',
      icon: ShieldCheck,
      badge: 'امنیت و دسترسی',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    },
    {
      to: '/settings/profile',
      title: 'حساب کاربری من',
      desc: 'ویرایش مشخصات شخصی، آپلود تصویر پروفایل و مشاهده مجوزهای فعال',
      icon: UserIcon,
      badge: 'پروفایل',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    },
    {
      to: '/settings/system',
      title: isAdministrator ? 'تنظیمات برندینگ، ظاهر و رنگ' : 'تنظیمات پوسته نمایشی (روز/شب)',
      desc: isAdministrator
        ? 'تغییر نام و لوگوی شرکت در سایدبار، انتخاب پالت رنگی و پوسته شب/روز'
        : 'انتخاب پوسته دیداری تاریک یا روشن سامانه متناسب با نور محیط',
      icon: Palette,
      badge: 'شخصی‌سازی',
      color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="مرکز تنظیمات و پیکربندی"
        subtitle="مدیریت درگاه‌های ارتباطی، کاربران و سطوح دسترسی و تنظیمات ظاهری سامانه"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cards.map((c) => {
          if (c.permission && !hasPermission(c.permission)) return null

          const Icon = c.icon
          return (
            <Link
              key={c.to}
              to={c.to}
              className="card-surface p-6 transition-all hover:shadow-md hover:border-primary/40 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${c.color}`}>
                    <Icon className="size-6" />
                  </span>
                  <span className="badge badge-sm bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                    {c.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-base-content group-hover:text-primary transition-colors">
                  {c.title}
                </h3>
                <p className="text-xs text-base-content/60 mt-1.5 leading-relaxed">
                  {c.desc}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-base-200 flex items-center justify-between text-xs font-semibold text-primary">
                <span>ورود به بخش</span>
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
