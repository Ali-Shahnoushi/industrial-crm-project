import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { PowerOff, Settings } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useSystemConfig } from '../../hooks/useSystemConfig'
import AccessDenied from '../../pages/AccessDenied'
import type { SystemFeatureKey } from '../../types'

interface PermissionRouteProps {
  permission?: string | string[]
  feature?: SystemFeatureKey
  children: ReactElement
}

function FeatureDisabledNotice() {
  const isAdministrator = useAuthStore((s) => s.isAdministrator)()

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="card-surface p-8 text-center space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <PowerOff className="size-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-extrabold text-base-content">این ماژول غیرفعال شده است</h2>
          <p className="text-xs leading-relaxed text-base-content/65">
            دسترسی به این بخش توسط مدیر ارشد در تنظیمات سیستم غیرفعال شده است. تا زمان فعال‌سازی مجدد، امکان استفاده از این ماژول وجود ندارد.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Link to="/" className="btn btn-sm btn-ghost">
            بازگشت به داشبورد
          </Link>
          {isAdministrator && (
            <Link to="/settings/system" className="btn btn-sm btn-primary gap-1.5">
              <Settings className="size-4" />
              مدیریت امکانات سیستم
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export function PermissionRoute({ permission, feature, children }: PermissionRouteProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { isFeatureEnabled } = useSystemConfig()

  if (feature && !isFeatureEnabled(feature)) {
    return <FeatureDisabledNotice />
  }

  if (permission) {
    const required = Array.isArray(permission) ? permission : [permission]
    const allowed = required.some((perm) => hasPermission(perm))

    if (!allowed) {
      return <AccessDenied requiredPermission={required.join(' / ')} />
    }
  }

  return children
}
