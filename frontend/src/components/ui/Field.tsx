import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function Field({ label, error, hint, required, children, className }: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className={`fieldset ${className ?? ''}`}>
      <legend className="fieldset-legend text-sm font-medium">
        {label}
        {required && <span className="text-error">*</span>}
      </legend>
      {children}
      {error ? <p className="label text-error">{error}</p> : hint ? <p className="label">{hint}</p> : null}
    </fieldset>
  )
}

export function EmptyState({ title = 'موردی یافت نشد', description, subtitle, action }: { title?: string; description?: string; subtitle?: string; action?: ReactNode }) {
  const desc = description || subtitle
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-base-200 text-base-content/40">
        <Inbox className="size-7" />
      </span>
      <p className="font-semibold">{title}</p>
      {desc && <p className="max-w-sm text-sm text-base-content/60">{desc}</p>}
      {action}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}><div className="skeleton h-5 w-full max-w-40" /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-9 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="skeleton h-72" />
    </div>
  )
}
