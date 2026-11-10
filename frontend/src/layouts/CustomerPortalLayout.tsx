import { Suspense, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Cpu,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  User,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Logo } from './Sidebar'
import { Avatar } from '../components/ui/Avatar'
import { PageSkeleton } from '../components/ui/Field'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { cx } from '../utils/format'

const PORTAL_NAV = [
  { to: '/portal', label: 'پیشخوان پروژه من', icon: LayoutDashboard, end: true },
  { to: '/portal/devices', label: 'دستگاه‌ها و گارانتی', icon: Cpu },
  { to: '/portal/tickets', label: 'تیکت‌ها و درخواست تعمیر', icon: LifeBuoy },
  { to: '/portal/profile', label: 'اطلاعات کاربری و رمز عبور', icon: User },
]

export function PortalProtectedRoute() {
  const user = useAuthStore((s) => s.user)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const location = useLocation()

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!user.is_customer_portal && user.user_type !== 'customer') {
    return <Navigate to="/" replace />
  }

  return <CustomerPortalLayout />
}

function CustomerPortalLayout() {
  const user = useAuthStore((s) => s.user)!
  const logout = useAuthStore((s) => s.logout)
  const { theme, toggle } = useThemeStore()
  const nav = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const dark = theme === 'nikan-dark'

  const handleLogout = async () => {
    await logout()
    toast.success('از پنل کاربری مشتریان خارج شدید')
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-base-200/65 text-base-content flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="منوی پنل مشتری"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Logo />
            <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-3.5" /> پنل اختصاصی مشتریان
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {PORTAL_NAV.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors',
                      isActive
                        ? 'bg-primary text-primary-content shadow-xs'
                        : 'text-base-content/75 hover:bg-base-200 hover:text-base-content',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          {/* Right User Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggle}
              className="btn btn-ghost btn-sm btn-circle"
              aria-label={dark ? 'حالت روشن' : 'حالت تاریک'}
              title={dark ? 'حالت روشن' : 'حالت تاریک'}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-base-300 bg-base-200/60 px-2.5 py-1">
              <Avatar name={user.name} src={user.avatar_url} size="xs" />
              <span className="max-w-[140px] truncate text-xs font-bold">{user.name}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-ghost btn-sm text-error gap-1 text-xs"
              title="خروج از سامانه"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div className="border-t border-base-200 bg-base-100 px-4 py-3 space-y-1 lg:hidden">
            {PORTAL_NAV.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold',
                      isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-200',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
