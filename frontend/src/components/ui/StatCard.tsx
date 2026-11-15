import type { LucideIcon } from 'lucide-react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cx, digits } from '../../utils/format'

const tones = {
  primary:
    'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  secondary:
    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  success:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  warning:
    'bg-amber-700/10 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  error:
    'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  info:
    'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
} as const

interface Props {
  title: string
  value: string
  icon: LucideIcon
  tone?: keyof typeof tones
  delta?: number
  hint?: string
  loading?: boolean
  to?: string
}

export function StatCard({ title, value, icon: Icon, tone = 'primary', delta, hint, loading, to }: Props) {
  const valueSizeClass =
    value.length > 18
      ? 'text-base sm:text-lg leading-snug'
      : value.length > 10
        ? 'text-lg sm:text-xl leading-snug'
        : 'text-2xl leading-tight'

  const content = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-base-content/70 leading-snug">{title}</p>
          {loading ? (
            <div className="skeleton mt-2 h-8 w-28" />
          ) : (
            <p
              title={value}
              className={cx(
                'mt-1.5 font-extrabold tracking-tight text-base-content break-words',
                valueSizeClass,
              )}
            >
              {value}
            </p>
          )}
        </div>
        <span className={cx('flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-2xl shadow-2xs', tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      {(delta !== undefined || hint) && !loading && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs leading-relaxed">
          {delta !== undefined && (
            <span
              className={cx(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold',
                delta >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
              {digits(Math.abs(delta).toFixed(1))}٪
            </span>
          )}
          {hint && <span className="text-base-content/60 break-words">{hint}</span>}
        </div>
      )}
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="card-surface h-full p-4 sm:p-5 transition-all hover:shadow-md hover:border-primary/40 group block"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="card-surface h-full p-4 sm:p-5 transition-shadow hover:shadow-md">
      {content}
    </div>
  )
}
