import { useEffect, useState } from 'react'
import type { Presence } from '../../types'
import { cx, hueFrom } from '../../utils/format'

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

export function normalizeAvatarUrl(url?: string | null): string | null {
  if (!url) return null
  const storageIdx = url.indexOf('/storage/')
  if (storageIdx !== -1) {
    return url.slice(storageIdx)
  }
  return url
}

export function Avatar({ name, src, size = 'md', presence, className }: Props) {
  const [hasError, setHasError] = useState(false)
  const normalizedSrc = normalizeAvatarUrl(src)

  useEffect(() => {
    setHasError(false)
  }, [src])

  const parts = name.trim().split(/\s+/)
  const initials = parts.length > 1 ? `${parts[0][0]}‌${parts[1][0]}` : parts[0].slice(0, 2)
  const hue = hueFrom(name)
  const showImage = Boolean(normalizedSrc && !hasError)

  return (
    <span className={cx('relative inline-flex shrink-0', className)}>
      {showImage ? (
        <img
          src={normalizedSrc!}
          alt={name}
          className={cx('rounded-full object-cover', sizes[size])}
          onError={() => setHasError(true)}
        />
      ) : (
        <span
          className={cx('inline-flex items-center justify-center rounded-full font-bold text-white select-none', sizes[size])}
          style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 42%))` }}
          aria-hidden
        >
          {initials}
        </span>
      )}
      {presence && (
        <span
          className={cx('absolute bottom-0 end-0 size-2.5 rounded-full ring-2 ring-base-100', dot[presence])}
          title={presence === 'online' ? 'آنلاین' : presence === 'away' ? 'دور از دسترس' : 'آفلاین'}
        />
      )}
    </span>
  )
}
