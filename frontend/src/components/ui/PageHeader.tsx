import type { ReactNode } from 'react'

export function PageHeader({ title, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="min-w-0 text-2xl font-extrabold tracking-tight">{title}</h1>
      {actions && (
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
