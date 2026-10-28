import { useEffect, useState } from 'react'
import { Calendar, Clock } from 'lucide-react'

export function RealtimeClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Format Persian Date (compact for clean layout)
  const fullDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Format Persian Time
  const timeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-base-200 bg-base-100/90 text-xs shadow-2xs whitespace-nowrap shrink-0">
      <div className="hidden xl:flex items-center gap-1.5 text-base-content/75 font-medium font-sans whitespace-nowrap">
        <Calendar className="size-3.5 text-primary shrink-0" />
        <span className="font-sans whitespace-nowrap">{fullDateFormatter.format(now)}</span>
      </div>

      <span className="hidden xl:block w-px h-3.5 bg-base-300 shrink-0" />

      <div className="flex items-center gap-1.5 text-base-content font-bold font-sans whitespace-nowrap shrink-0">
        <Clock className="size-3.5 text-secondary shrink-0" />
        <span className="ltr-text font-sans font-bold text-xs" style={{ fontFamily: 'var(--font-sans)' }}>
          {timeFormatter.format(now)}
        </span>
      </div>
    </div>
  )
}

