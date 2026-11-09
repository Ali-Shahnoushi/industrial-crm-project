import { useState } from 'react'
import type { Presence } from '../../types'
import { cx, hueFrom, normalizeAvatarUrl } from '../../utils/format'

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
} as const

const dot = { online: 'bg-success', away: 'bg-warning', offline: 'bg-base-content/30' } as const

interface Props {
  name: string
  src?: string | null
  size?: keyof typeof sizes
  presence?: Presence
  className?: string
}

export function Avatar({ name, src, size = 'md', presence, className }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const normalizedSrc = normalizeAvatarUrl(src)

  const parts = name.trim().split(/\s+/)
  const initials = parts.length > 1 ? `${parts[0][0]}‌${parts[1][0]}` : parts[0].slice(0, 2)
  const hue = hueFrom(name)
  const showImage = Boolean(normalizedSrc && failedSrc !== normalizedSrc)

  return (
    <span className={cx('relative inline-flex shrink-0', className)}>
      {showImage ? (
        <img
          src={normalizedSrc!}
          alt={name}
          className={cx('rounded-full object-cover', sizes[size])}
          onError={() => setFailedSrc(normalizedSrc)}
        />
      ) : (
        <span
          className={cx(
            'inline-flex items-center justify-center rounded-full font-bold text-white select-none',
            sizes[size],
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 42%))`,
          }}
          aria-hidden
        >
          {initials}
        </span>
      )}
      {presence && (
        <span
          className={cx(
            'absolute end-0 bottom-0 size-2.5 rounded-full ring-2 ring-base-100',
            dot[presence],
          )}
          aria-label={presence}
        />
      )}
    </span>
  )
}
