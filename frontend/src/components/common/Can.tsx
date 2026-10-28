import type { ReactNode } from 'react'
import { useAuthStore } from '../../store/useAuthStore'

interface CanProps {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (!hasPermission(permission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
