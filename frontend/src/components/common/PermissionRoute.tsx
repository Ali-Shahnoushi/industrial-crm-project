import type { ReactElement } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import AccessDenied from '../../pages/AccessDenied'

interface PermissionRouteProps {
  permission: string
  children: ReactElement
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (!hasPermission(permission)) {
    return <AccessDenied requiredPermission={permission} />
  }

  return children
}
