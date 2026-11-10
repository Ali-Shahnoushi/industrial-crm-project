import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bell, CheckCheck, Cog, History, Sparkles, UserCheck, UserPlus, Wrench } from 'lucide-react'
import { dashboardApi } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { customerDisplayName, cx, num, relativeFa } from '../utils/format'
import type { CustomerHistory } from '../types'

const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur()

function readSeenIds(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set()
  } catch {
    return new Set()
  }
}

function saveSeenIds(storageKey: string, ids: Set<string>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(ids).slice(-200)))
  } catch {
    // Ignore storage quota errors
  }
}

function activityVisual(action: string) {
  switch (action) {
    case 'created':
      return { icon: UserPlus, tone: 'bg-primary/10 text-primary', title: 'ثبت پرونده مشتری' }
    case 'part_assigned':
    case 'part_updated':
    case 'part_deleted':
      return { icon: Cog, tone: 'bg-info/15 text-info', title: 'تخصیص / تغییر دستگاه' }
    case 'service_performed':
      return { icon: Wrench, tone: 'bg-success/15 text-success', title: 'ثبت سرویس فنی' }
    case 'type_converted':
      return { icon: Sparkles, tone: 'bg-warning/20 text-warning', title: 'ارتقا به مشتری بالفعل' }
    case 'owner_changed':
      return { icon: UserCheck, tone: 'bg-indigo-500/15 text-indigo-600', title: 'انتقال کارشناس مسئول' }
    default:
      return { icon: History, tone: 'bg-secondary/15 text-secondary', title: 'بروزرسانی پرونده' }
  }
}

export function NotificationsMenu() {
  const user = useAuthStore((s) => s.user)
  const nav = useNavigate()
  const storageKey = `crm_seen_activities_${user?.id ?? 'guest'}`

  const [seenIds, setSeenIds] = useState<Set<string>>(() => readSeenIds(storageKey))

  const { data } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  const activities: CustomerHistory[] = useMemo(
    () => data?.recent_activities ?? [],
    [data?.recent_activities],
  )

  const lowStockParts = useMemo(
    () => data?.low_stock_parts ?? [],
    [data?.low_stock_parts],
  )

  const unread = useMemo(
    () => activities.filter((a) => !seenIds.has(String(a.id))),
    [activities, seenIds],
  )

  const badgeCount = unread.length + lowStockParts.length

  const markRead = (id: string) => {
    setSeenIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveSeenIds(storageKey, next)
      return next
    })
  }

  const markAllRead = () => {
    setSeenIds((prev) => {
      const next = new Set(prev)
      activities.forEach((a) => next.add(String(a.id)))
      saveSeenIds(storageKey, next)
      return next
    })
  }

  const openActivity = (act: CustomerHistory) => {
    markRead(String(act.id))
    closeDropdown()
    if (act.customer_id) {
      nav(`/customers/${act.customer_id}`)
    }
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle relative"
        aria-label="اعلان‌ها و رویدادهای اخیر"
      >
        <Bell className="size-5" />
        {badgeCount > 0 && (
          <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
            {num(badgeCount)}
          </span>
        )}
      </div>
      <div
        tabIndex={0}
        className="dropdown-content z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-base-300 bg-base-100 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-base-300/60 px-4 py-3">
          <p className="font-bold text-sm">اعلان‌ها و رویدادهای سامانه</p>
          {unread.length > 0 && (
            <button className="btn btn-ghost btn-xs gap-1 text-primary" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> خواندن همه
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto p-2">
          {lowStockParts.length > 0 && (
            <li className="mb-1">
              <button
                onClick={() => {
                  closeDropdown()
                  nav('/inventory?low=1')
                }}
                className="flex w-full items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-start transition-colors hover:bg-warning/20"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/25 text-warning">
                  <AlertTriangle className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-base-content">
                    هشدار کمبود موجودی انبار ({num(lowStockParts.length)} مدل)
                  </span>
                  <span className="block line-clamp-2 text-[11px] text-base-content/70 mt-0.5">
                    {lowStockParts
                      .slice(0, 2)
                      .map((p) => `${p.name}: ${num(p.stock_quantity ?? 0)} ${p.unit || 'دستگاه'}`)
                      .join(' • ')}
                  </span>
                </span>
              </button>
            </li>
          )}
          {activities.length === 0 && lowStockParts.length === 0 && (
            <li className="p-6 text-center text-xs text-base-content/60">رویداد جدیدی ثبت نشده است</li>
          )}
          {activities.map((act) => {
            const isRead = seenIds.has(String(act.id))
            const { icon: Icon, tone, title } = activityVisual(act.action)
            const customerTitle = act.customer ? customerDisplayName(act.customer) : title

            return (
              <li key={act.id}>
                <button
                  onClick={() => openActivity(act)}
                  className={cx(
                    'flex w-full items-start gap-3 rounded-xl p-2.5 text-start transition-colors hover:bg-base-200',
                    !isRead && 'bg-primary/5',
                  )}
                >
                  <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs font-bold">
                      <span className="truncate">{customerTitle}</span>
                      {!isRead && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="block line-clamp-2 text-[11px] text-base-content/65 mt-0.5">
                      {act.description}
                    </span>
                    <span className="mt-1 block text-[10px] text-base-content/45">
                      {relativeFa(act.created_at)}
                    </span>
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
