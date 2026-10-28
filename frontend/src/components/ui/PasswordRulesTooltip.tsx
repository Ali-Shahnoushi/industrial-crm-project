import { useEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import tippy, { type Instance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { Check, X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { cx } from '../../utils/format'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
  error?: string
  disabled?: boolean
  autoComplete?: string
  className?: string
  name?: string
  id?: string
}

export function PasswordRulesTooltip({
  value = '',
  onChange,
  placeholder = 'کلمه عبور جدید...',
  required = false,
  error,
  disabled = false,
  autoComplete = 'new-password',
  className = '',
  name,
  id,
}: Props) {
  const autoId = useId()
  const inputId = id || autoId
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const tippyRef = useRef<Instance | null>(null)
  const [container] = useState(() => {
    const el = document.createElement('div')
    el.className = 'tippy-password-container'
    return el
  })

  const hasMinLength = (value || '').length >= 8
  const hasLetter = /[a-zA-Z]/.test(value || '')
  const hasNumber = /[0-9]/.test(value || '')

  useEffect(() => {
    if (!inputRef.current) return

    tippyRef.current = tippy(inputRef.current, {
      content: container,
      trigger: 'focus',
      interactive: true,
      placement: 'bottom-start',
      animation: 'fade',
      arrow: false,
      theme: 'crm-password-tooltip',
      allowHTML: true,
      zIndex: 99999,
      offset: [0, 8],
    })

    return () => {
      tippyRef.current?.destroy()
      tippyRef.current = null
    }
  }, [container])

  const tooltipContent = (
    <div
      dir="rtl"
      className="p-3 text-xs space-y-2.5 font-sans bg-base-100 text-base-content rounded-2xl border border-base-300 shadow-2xl min-w-[240px]"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div className="flex items-center gap-1.5 pb-2 border-b border-base-200 font-bold text-xs">
        <KeyRound className="size-4 text-primary shrink-0" />
        <span className="text-base-content">شرایط الزامی رمز عبور:</span>
      </div>

      <div className="space-y-2">
        <div
          className={cx(
            'flex items-center gap-2 text-[11px] transition-colors',
            hasMinLength ? 'text-success font-bold' : 'text-error font-medium',
          )}
        >
          {hasMinLength ? (
            <Check className="size-3.5 text-success shrink-0" />
          ) : (
            <X className="size-3.5 text-error shrink-0" />
          )}
          <span>حداقل ۸ کاراکتر</span>
        </div>

        <div
          className={cx(
            'flex items-center gap-2 text-[11px] transition-colors',
            hasLetter ? 'text-success font-bold' : 'text-error font-medium',
          )}
        >
          {hasLetter ? (
            <Check className="size-3.5 text-success shrink-0" />
          ) : (
            <X className="size-3.5 text-error shrink-0" />
          )}
          <span>حداقل یک حرف انگلیسی (A-Z)</span>
        </div>

        <div
          className={cx(
            'flex items-center gap-2 text-[11px] transition-colors',
            hasNumber ? 'text-success font-bold' : 'text-error font-medium',
          )}
        >
          {hasNumber ? (
            <Check className="size-3.5 text-success shrink-0" />
          ) : (
            <X className="size-3.5 text-error shrink-0" />
          )}
          <span>حداقل یک عدد (0-9)</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className={cx('w-full relative', className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type={showPassword ? 'text' : 'password'}
          dir="ltr"
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cx(
            'input input-bordered w-full text-start font-mono text-sm pl-10 pr-3 transition-all',
            error && 'input-error',
          )}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          className="absolute left-3 text-base-content/50 hover:text-base-content transition-colors focus:outline-hidden"
          title={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {createPortal(tooltipContent, container)}
    </div>
  )
}
