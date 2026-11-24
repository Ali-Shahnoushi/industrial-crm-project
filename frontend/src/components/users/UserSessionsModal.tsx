import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Clock,
  Globe,
  Laptop,
  LogOut,
  MonitorSmartphone,
  ShieldAlert,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react'
import { Modal, ConfirmDialog } from '../ui/Modal'
import { authApi, usersApi } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'
import { cx, dateFa, digits, num, relativeFa } from '../../utils/format'
import type { User, UserSession } from '../../types'

interface UserSessionsModalProps {
  open: boolean
  onClose: () => void
  /** When provided, manages the specified user's sessions via `/users/{id}/sessions`. */
  targetUser?: Pick<User, 'id' | 'name' | 'email' | 'role_label'> | null
  /** When true, manages the currently logged-in user's own sessions via `/auth/sessions`. */
  selfMode?: boolean
}

function SessionDeviceIcon({ platform }: { platform?: string }) {
  const p = (platform || '').toLowerCase()
  if (p.includes('iphone') || p.includes('android')) {
    return <Smartphone className="size-5" />
  }
  if (p.includes('ipad')) {
    return <Tablet className="size-5" />
  }
  if (p.includes('windows') || p.includes('mac') || p.includes('linux')) {
    return <Laptop className="size-5" />
  }
  return <Globe className="size-5" />
}

export function UserSessionsModal({
  open,
  onClose,
  targetUser,
  selfMode = false,
}: UserSessionsModalProps) {
  const qc = useQueryClient()
  const nav = useNavigate()
  const forceClearSession = useAuthStore((s) => s.forceClearSession)

  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)

  const queryKey = selfMode
    ? ['my-sessions']
    : ['user-sessions', targetUser ? String(targetUser.id) : 'none']

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (selfMode) {
        return authApi.mySessions()
      }
      if (!targetUser) {
        return { max_sessions: 3, sessions: [] as UserSession[] }
      }
      return usersApi.getSessions(targetUser.id)
    },
    enabled: open && (selfMode || Boolean(targetUser)),
    staleTime: 0,
  })

  const sessions = data?.sessions ?? []
  const maxSessions = data?.max_sessions ?? 3

  const revokeOneMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      setRevokingId(tokenId)
      if (selfMode) {
        return authApi.revokeMySession(tokenId)
      }
      return usersApi.revokeSession(targetUser!.id, tokenId)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      setRevokingId(null)
      if (res.revoked_current) {
        onClose()
        forceClearSession()
        nav('/login', { replace: true })
        return
      }
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['system-users'] })
    },
    onError: (err: any) => {
      setRevokingId(null)
      toast.error(err?.response?.data?.message || 'خطا در خاتمه دادن به نشست')
    },
  })

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      return usersApi.revokeAllSessions(targetUser!.id)
    },
    onSuccess: (res) => {
      toast.success(res.message)
      setConfirmRevokeAll(false)
      if (res.revoked_current) {
        onClose()
        forceClearSession()
        nav('/login', { replace: true })
        return
      }
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['system-users'] })
    },
    onError: (err: any) => {
      setConfirmRevokeAll(false)
      toast.error(err?.response?.data?.message || 'خطا در خروج اجباری از همه دستگاه‌ها')
    },
  })

  const title = selfMode
    ? 'نشست‌ها و دستگاه‌های فعال من'
    : `نشست‌های فعال کاربر «${targetUser?.name ?? ''}»`

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={title}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {!selfMode && targetUser && sessions.length > 0 ? (
              <button
                type="button"
                className="btn btn-sm btn-error btn-outline gap-1.5"
                disabled={revokeAllMutation.isPending}
                onClick={() => setConfirmRevokeAll(true)}
              >
                <LogOut className="size-4" />
                خروج اجباری از همه دستگاه‌ها ({num(sessions.length)})
              </button>
            ) : (
              <span />
            )}

            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
              بستن
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-200 bg-base-200/40 px-4 py-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MonitorSmartphone className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-base-content truncate">
                  {selfMode ? 'دستگاه‌های متصل به حساب شما' : targetUser?.name}
                </p>
                {!selfMode && targetUser?.email && (
                  <p className="text-[11px] font-mono text-base-content/55 ltr-text text-start truncate">
                    {targetUser.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'badge badge-sm font-bold',
                  sessions.length >= maxSessions
                    ? 'badge-warning badge-soft'
                    : 'badge-primary badge-soft',
                )}
              >
                {num(sessions.length)} از {num(maxSessions)} دستگاه فعال
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-base-content/60">
              <span className="loading loading-spinner loading-sm text-primary" />
              در حال دریافت فهرست نشست‌های فعال...
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-center text-xs text-error space-y-2">
              <p className="font-bold">خطا در دریافت اطلاعات نشست‌ها</p>
              <button type="button" className="btn btn-xs btn-error btn-outline" onClick={() => refetch()}>
                تلاش مجدد
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 p-8 text-center space-y-1.5">
              <MonitorSmartphone className="size-8 mx-auto text-base-content/30" />
              <p className="text-sm font-bold text-base-content/75">هیچ نشست فعالی ثبت نشده است</p>
              <p className="text-xs text-base-content/50">
                این کاربر در حال حاضر روی هیچ دستگاهی وارد سامانه نشده است.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((session) => {
                const isBusy = revokeOneMutation.isPending && revokingId === session.id
                return (
                  <div
                    key={session.id}
                    className={cx(
                      'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors',
                      session.is_current
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-base-200 bg-base-100 hover:border-base-300',
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={cx(
                          'flex size-10 shrink-0 items-center justify-center rounded-xl',
                          session.is_current
                            ? 'bg-primary text-primary-content'
                            : 'bg-base-200 text-base-content/70',
                        )}
                      >
                        <SessionDeviceIcon platform={session.platform} />
                      </span>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-bold text-xs sm:text-sm text-base-content truncate">
                            {session.device_name}
                          </p>
                          {session.is_current && (
                            <span className="badge badge-xs badge-primary font-bold">
                              دستگاه فعلی
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-base-content/60">
                          {session.ip_address && (
                            <span className="font-mono ltr-text">IP: {digits(session.ip_address)}</span>
                          )}
                          {session.created_at && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" />
                              ورود: {dateFa(session.created_at)}
                            </span>
                          )}
                          {session.last_used_at && (
                            <span>آخرین فعالیت: {relativeFa(session.last_used_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy || revokeAllMutation.isPending}
                      onClick={() => revokeOneMutation.mutate(session.id)}
                      className="btn btn-xs sm:btn-sm btn-error btn-soft gap-1.5 shrink-0"
                      title="خاتمه دادن به این نشست (خروج اجباری)"
                    >
                      {isBusy ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      خروج اجباری
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {sessions.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-[11px] text-amber-800 dark:text-amber-300">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                با حذف هر نشست، توکن دسترسی آن دستگاه فوراً باطل شده و کاربر در همان لحظه از سامانه خارج خواهد شد.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRevokeAll}
        title="خروج اجباری از همه دستگاه‌ها"
        message={`آیا مطمئن هستید که می‌خواهید تمامی نشست‌های فعال «${targetUser?.name}» (${num(sessions.length)} دستگاه) را خاتمه دهید؟`}
        confirmText="خروج اجباری همه نشست‌ها"
        danger
        loading={revokeAllMutation.isPending}
        onConfirm={() => revokeAllMutation.mutate()}
        onClose={() => setConfirmRevokeAll(false)}
      />
    </>
  )
}
