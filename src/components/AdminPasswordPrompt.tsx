import { Eye, EyeOff, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'

interface AdminPasswordPromptProps {
  onUnlock: (password: string) => Promise<boolean>
  onCancel: () => void
}

export default function AdminPasswordPrompt({ onUnlock, onCancel }: AdminPasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const isValid = await onUnlock(password)

      if (!isValid) {
        setError('Incorrect password.')
        setPassword('')
      }
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not unlock Admin.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center">
      <div className="w-full rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center text-slate-500 dark:text-slate-400">
            <Lock size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Admin Password Required</h1>
            <p className="text-sm text-muted">Only the Admin section is protected.</p>
          </div>
        </div>

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
            <label htmlFor="admin-unlock-password" className="mb-2 block text-sm font-medium text-ink">
              Admin Password
            </label>
            <div className="relative">
              <input
                id="admin-unlock-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                className="h-12 w-full rounded-md border border-border bg-surface px-3 pr-12 text-sm text-ink focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              {submitting ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
