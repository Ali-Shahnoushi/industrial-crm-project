import type { ReactElement } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import AccessDenied from '../../pages/AccessDenied'

interface PermissionRouteProps {
  permission: string | string[]
  children: ReactElement
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const required = Array.isArray(permission) ? permission : [permission]
  const allowed = required.some((perm) => hasPermission(perm))

  if (!allowed) {
    return <AccessDenied requiredPermission={required.join(' / ')} />
  }

  return children
}
