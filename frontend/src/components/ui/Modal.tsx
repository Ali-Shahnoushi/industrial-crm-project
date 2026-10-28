import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from '../../utils/format'

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: keyof typeof sizes
}

/** Native <dialog> (focus trap + Esc for free) styled with daisyUI. Children mount only while open. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className={cx('modal-box flex max-h-[90dvh] w-full flex-col p-0', sizes[size])}>
        <div className="flex items-center justify-between border-b border-base-300/70 px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{open && children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-base-300/70 px-5 py-3">{footer}</div>}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="بستن">close</button>
      </form>
    </dialog>
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmText?: string
  danger?: boolean
  tone?: 'error' | 'warning' | 'primary' | string
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, confirmText, danger, tone, loading }: ConfirmProps) {
  const label = confirmText || confirmLabel || 'تأیید'
  const isDanger = danger || tone === 'error'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>انصراف</button>
          <button className={cx('btn', isDanger ? 'btn-error' : 'btn-primary')} onClick={onConfirm} disabled={loading}>
            {loading && <span className="loading loading-spinner loading-xs" />}
            {label}
          </button>
        </>
      }
    >
      <p className="leading-7 text-base-content/80">{message}</p>
    </Modal>
  )
}
