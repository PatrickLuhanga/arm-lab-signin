import { Eye, EyeOff, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MIN_ADMIN_PASSWORD_LENGTH } from '../db/adminAuth'
import { errorMessage } from '../lib/errors'

interface AdminPasswordSetupProps {
  onComplete: (password: string) => Promise<void>
  initialError?: string | null
}

export default function AdminPasswordSetup({
  onComplete,
  initialError = null,
}: AdminPasswordSetupProps) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)

    try {
      await onComplete(password)
    } catch (saveError) {
      setError(errorMessage(saveError))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-institutional">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center text-slate-500 dark:text-slate-400">
            <Lock size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Set Admin Password</h1>
            <p className="text-sm text-muted">Protect the Admin section on this kiosk.</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted">
          This is the first launch on this database. Create the Admin password to continue. It is
          stored only in the local SQLite database.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-border bg-danger-fill px-3 py-2 text-sm font-medium text-danger"
            >
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="setup-password" className="mb-2 block text-sm font-medium text-ink">
              New Password
            </label>
            <div className="relative">
              <input
                id="setup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="h-12 w-full rounded-md border border-border bg-surface px-3 pr-12 text-sm text-ink focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="setup-confirmation"
              className="mb-2 block text-sm font-medium text-ink"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="setup-confirmation"
                type={showConfirmation ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                className="h-12 w-full rounded-md border border-border bg-surface px-3 pr-12 text-sm text-ink focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmation((visible) => !visible)}
                aria-label={showConfirmation ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:text-ink"
              >
                {showConfirmation ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Admin Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
