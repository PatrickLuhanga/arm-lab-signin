import { AlertTriangle, X } from 'lucide-react'
import { useEffect } from 'react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onCancel])

  if (!open) {
    return null
  }

  return (
    <div
      role="presentation"
      onMouseDown={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080225]/60 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby={description ? 'confirm-modal-description' : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {destructive ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle size={20} aria-hidden="true" />
              </span>
            ) : null}
            <h2 id="confirm-modal-title" className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="-mr-2 -mt-2 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-app hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {description ? (
          <p id="confirm-modal-description" className="mt-3 text-sm leading-6 text-muted">
            {description}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition ${
              destructive ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
