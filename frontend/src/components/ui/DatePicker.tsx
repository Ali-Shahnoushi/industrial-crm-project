import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react'
import { toGregorian } from 'jalaali-js'
import { cx, dateFa, dateShort, digits, safeDate } from '../../utils/format'
import { JALALI_MONTHS, WEEKDAYS_SHORT, fromJ, isSameDay, monthGrid, shiftMonth, toJ } from '../../utils/jalali'

interface Props {
  value: string | null | undefined
  onChange: (val: string | null) => void
  placeholder?: string
  clearable?: boolean
  format?: 'date' | 'iso'
  className?: string
}

const START_YEAR = 1380
const END_YEAR = 1420
const JALALI_YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i)
const POPUP_WIDTH = 296
const POPUP_ESTIMATED_HEIGHT = 338

export function DatePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ شمسی...',
  clearable = true,
  format = 'date',
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number }>({
    top: 0,
    left: 0,
  })

  const selectedDate = safeDate(value)
  const today = new Date()
  const todayJ = toJ(today)
  const baseJ = selectedDate ? toJ(selectedDate) : todayJ

  const [view, setView] = useState({ jy: baseJ.jy, jm: baseJ.jm })

  useEffect(() => {
    if (selectedDate) {
      const j = toJ(selectedDate)
      setView({ jy: j.jy, jm: j.jm })
    }
  }, [value])

  const updatePosition = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Align right edge of popup with right edge of RTL input, clamped inside viewport
    let left = rect.right - POPUP_WIDTH
    if (left + POPUP_WIDTH > vw - 8) {
      left = vw - POPUP_WIDTH - 8
    }
    if (left < 8) {
      left = 8
    }

    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow < POPUP_ESTIMATED_HEIGHT && spaceAbove > spaceBelow) {
      setCoords({
        bottom: Math.max(8, vh - rect.top + 6),
        left,
      })
    } else {
      setCoords({
        top: Math.max(8, Math.min(rect.bottom + 6, vh - POPUP_ESTIMATED_HEIGHT - 8)),
        left,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    // Render inside active <dialog> when inside native showModal() (#top-layer) so it sits
    // outside .modal-box overflow containers while remaining interactive inside #top-layer;
    // otherwise portal directly to document.body to escape any table/card overflow clipping.
    const hostDialog = containerRef.current?.closest('dialog')
    setPortalTarget((hostDialog as HTMLElement | null) ?? document.body)
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const cells = monthGrid(view.jy, view.jm)
  const move = (delta: number) => setView((v) => shiftMonth(v.jy, v.jm, delta))

  const handleSelectDay = (jd: number) => {
    const { gy, gm, gd } = toGregorian(view.jy, view.jm, jd)
    if (format === 'iso') {
      const d = new Date(gy, gm - 1, gd, 12, 0, 0)
      onChange(d.toISOString())
    } else {
      const ymd = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
      onChange(ymd)
    }
    setOpen(false)
  }

  const handleSelectToday = () => {
    setView({ jy: todayJ.jy, jm: todayJ.jm })
    handleSelectDay(todayJ.jd)
  }

  const calendarPopup =
    open && portalTarget
      ? createPortal(
          <div
            ref={popupRef}
            dir="rtl"
            style={{
              position: 'fixed',
              width: `${POPUP_WIDTH}px`,
              maxWidth: 'calc(100vw - 1rem)',
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-2xl select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Controls */}
            <div className="mb-2.5 flex items-center justify-between gap-1 pb-2 border-b border-base-200">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => move(-1)}
                title="ماه قبل"
              >
                <ChevronRight className="size-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <select
                  value={view.jm}
                  onChange={(e) => setView((v) => ({ ...v, jm: Number(e.target.value) }))}
                  className="select select-bordered select-xs font-bold text-xs"
                >
                  {JALALI_MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={view.jy}
                  onChange={(e) => setView((v) => ({ ...v, jy: Number(e.target.value) }))}
                  className="select select-bordered select-xs font-bold font-mono text-xs"
                >
                  {JALALI_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {digits(y)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => move(1)}
                title="ماه بعد"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>

            {/* Weekday Names Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAYS_SHORT.map((w) => (
                <span key={w} className="py-0.5 text-[10px] font-bold text-base-content/60">
                  {w}
                </span>
              ))}
            </div>

            {/* Month Grid Cells */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {cells.map((jd, i) => {
                if (!jd) return <span key={`empty-${i}`} className="size-8" />
                const cellDate = fromJ(view.jy, view.jm, jd, 12)
                const isSel = selectedDate && isSameDay(cellDate, selectedDate)
                const isToday = isSameDay(cellDate, today)

                return (
                  <button
                    type="button"
                    key={jd}
                    onClick={() => handleSelectDay(jd)}
                    className={cx(
                      'size-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
                      isSel
                        ? 'bg-primary text-primary-content font-bold shadow-xs'
                        : isToday
                          ? 'border border-primary text-primary font-bold bg-primary/10 hover:bg-primary/20'
                          : 'hover:bg-base-200 text-base-content/80',
                    )}
                  >
                    {digits(jd)}
                  </button>
                )
              })}
            </div>

            {/* Footer Shortcuts */}
            <div className="mt-2.5 pt-2 border-t border-base-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleSelectToday}
                className="btn btn-ghost btn-xs text-primary font-bold gap-1"
              >
                <RotateCcw className="size-3" /> امروز ({digits(`${todayJ.jy}/${todayJ.jm}/${todayJ.jd}`)})
              </button>

              {selectedDate ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  className="btn btn-ghost btn-xs text-error font-medium"
                >
                  پاک کردن
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost btn-xs text-base-content/60"
                >
                  بستن
                </button>
              )}
            </div>
          </div>,
          portalTarget,
        )
      : null

  return (
    <div ref={containerRef} className={cx('relative w-full', className)}>
      <div className="relative">
        <button
          type="button"
          className={cx(
            'input input-bordered w-full flex items-center justify-between text-start cursor-pointer hover:border-primary/50 transition-colors',
            open && 'border-primary ring-2 ring-primary/20',
          )}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            {selectedDate ? (
              <span className="font-semibold text-xs sm:text-sm text-base-content truncate">
                {dateFa(selectedDate)}
                <span className="ms-2 font-mono text-xs text-base-content/60 font-normal">
                  ({dateShort(selectedDate)})
                </span>
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-base-content/40">{placeholder}</span>
            )}
          </div>
        </button>

        {clearable && selectedDate && (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle absolute end-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-error"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            title="پاک کردن تاریخ"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {calendarPopup}
    </div>
  )
}
