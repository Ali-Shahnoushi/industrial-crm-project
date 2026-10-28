import { cx } from '../../utils/format'

interface Meta { label: string; badge: string }

export function StatusBadge({ meta, className }: { meta: Meta; className?: string }) {
  return <span className={cx('badge badge-soft badge-sm whitespace-nowrap', meta.badge, className)}>{meta.label}</span>
}
