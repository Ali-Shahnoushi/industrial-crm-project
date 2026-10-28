import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCheck, LifeBuoy, ListChecks, Receipt, Sparkles, UserPlus } from 'lucide-react'
import { useList, useUpdate } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { cx, num, relativeFa } from '../utils/format'
import type { AppNotification } from '../types'

const icons: Record<AppNotification['type'], { icon: typeof Bell; tone: string }> = {
  lead: { icon: UserPlus, tone: 'bg-primary/10 text-primary' },
  stock: { icon: AlertTriangle, tone: 'bg-warning/20 text-warning' },
  invoice: { icon: Receipt, tone: 'bg-error/10 text-error' },
  ticket: { icon: LifeBuoy, tone: 'bg-info/15 text-info' },
  task: { icon: ListChecks, tone: 'bg-success/15 text-success' },
  system: { icon: Sparkles, tone: 'bg-secondary/15 text-secondary' },
}

const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur()

export function NotificationsMenu() {
  const user = useAuthStore((s) => s.user)
  const nav = useNavigate()
  const { data } = useList('notifications')
  const update = useUpdate('notifications')
  const mine = data.filter((n) => n.userId === user?.id).sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const unread = mine.filter((n) => !n.read)

  const open = (n: AppNotification) => {
    if (!n.read) update.mutate({ id: n.id, read: true })
    closeDropdown()
    nav(n.link)
  }

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-circle relative" aria-label="اعلان‌ها">
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
            {num(unread.length)}
          </span>
        )}
      </div>
      <div tabIndex={0} className="dropdown-content z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-base-300 bg-base-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-base-300/60 px-4 py-3">
          <p className="font-bold">اعلان‌ها</p>
          {unread.length > 0 && (
            <button className="btn btn-ghost btn-xs gap-1 text-primary" onClick={() => unread.forEach((n) => update.mutate({ id: n.id, read: true }))}>
              <CheckCheck className="size-3.5" /> خواندن همه
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto p-2">
          {mine.length === 0 && <li className="p-6 text-center text-sm text-base-content/60">اعلان جدیدی ندارید</li>}
          {mine.map((n) => {
            const { icon: Icon, tone } = icons[n.type]
            return (
              <li key={n.id}>
                <button
                  onClick={() => open(n)}
                  className={cx('flex w-full items-start gap-3 rounded-xl p-2.5 text-start transition-colors hover:bg-base-200', !n.read && 'bg-primary/5')}
                >
                  <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {n.title}
                      {!n.read && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    <span className="block truncate text-xs text-base-content/60">{n.description}</span>
                    <span className="mt-0.5 block text-[11px] text-base-content/40">{relativeFa(n.date)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
