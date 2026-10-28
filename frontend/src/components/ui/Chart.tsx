import type { ReactNode } from 'react'
import { num } from '../../utils/format'

interface Item {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

interface TooltipProps {
  active?: boolean
  payload?: readonly Item[]
  label?: string | number
  /** Format a series value; default uses Persian digits. */
  format?: (value: number, name: string) => string
}

/** Theme-aware tooltip shared by every chart. Used as `<Tooltip content={<ChartTooltip />} />`. */
export function ChartTooltip({ active, payload, label, format }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg" dir="rtl">
      {label !== undefined && label !== '' && <p className="mb-1 font-bold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-full" style={{ background: p.color ?? (p.payload?.fill as string) }} />
          <span className="text-base-content/70">{p.name}</span>
          <span className="ms-auto ps-3 font-bold">
            {format ? format(Number(p.value), String(p.name)) : num(Number(p.value))}
          </span>
        </p>
      ))}
    </div>
  )
}

export function ChartCard({ title, subtitle, actions, children, className }: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card-surface p-5 ${className ?? ''}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-base-content/60">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

/** Axis/grid colours that work in both themes. */
export const axisStyle = {
  tick: { fontSize: 11, fill: 'currentColor', opacity: 0.6 },
  grid: 'currentColor',
} as const
