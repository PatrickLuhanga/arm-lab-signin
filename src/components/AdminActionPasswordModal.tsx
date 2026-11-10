import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { verifyAdminPassword } from '../db/adminAuth'
import Modal from './Modal'

interface AdminActionPasswordModalProps {
  open: boolean
  actionLabel: string
  onVerified: () => void
  onCancel: () => void
}

export default function AdminActionPasswordModal({
  open,
  actionLabel,
  onVerified,
  onCancel,
}: AdminActionPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setShowPassword(false)
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const isValid = await verifyAdminPassword(password)

      if (isValid) {
        onVerified()
      } else {
        setError('Incorrect password.')
        setPassword('')
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'Could not verify the Admin password.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title="Admin Password Required" onClose={onCancel}>
      <p className="text-sm leading-6 text-muted">Enter the Admin password to {actionLabel}.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-danger-fill px-3 py-2 text-sm font-medium text-danger"
          >
            {error}
          </p>
        ) : null}

        <div>
          <label
            htmlFor="admin-action-password"
            className="mb-2 block text-sm font-medium text-ink"
          >
            Admin Password
          </label>
          <div className="relative">
            <input
              id="admin-action-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              className="h-12 w-full rounded-md border border-border bg-surface px-3 pr-12 text-sm text-ink focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/25 dark:focus:border-slate-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-ink"
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-subtle"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? 'Verifying...' : 'Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
