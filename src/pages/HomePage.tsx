import { useEffect, useRef, useState, type FormEvent } from 'react'
import Numpad from '../components/Numpad'
import StatusBanner, { type BannerTone } from '../components/StatusBanner'
import { signInStudent } from '../db/signIns'
import { formatHeaderDate, formatTimeFromTimestamp, roleLabel } from '../lib/format'

interface Feedback {
  tone: BannerTone
  message: string
}

function cleanStudentNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 20)
}

export default function HomePage() {
  const [studentNumber, setStudentNumber] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (clearTimer.current) {
        clearTimeout(clearTimer.current)
      }
    }
  }, [])

  function cancelAutoClear() {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current)
      clearTimer.current = null
    }
  }

  function scheduleAutoClear() {
    cancelAutoClear()
    clearTimer.current = setTimeout(() => {
      setStudentNumber('')
      setFeedback(null)
      clearTimer.current = null
      inputRef.current?.focus()
    }, 4000)
  }

  function updateStudentNumber(nextValue: string) {
    cancelAutoClear()
    setFeedback(null)
    setStudentNumber(cleanStudentNumber(nextValue))
  }

  function handleDigit(digit: string) {
    if (studentNumber.length >= 20) {
      return
    }

    updateStudentNumber(`${studentNumber}${digit}`)
    inputRef.current?.focus()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = studentNumber.trim()

    if (value.length === 0 || busy) {
      return
    }

    setBusy(true)

    try {
      const outcome = await signInStudent(value)

      if (outcome.status === 'signed_in') {
        setFeedback({
          tone: 'success',
          message: `Welcome, ${outcome.profile.full_name} -- Signed in at ${formatTimeFromTimestamp(
            outcome.signedInAt,
          )} (${roleLabel(outcome.profile.role)})`,
        })
      } else if (outcome.status === 'duplicate') {
        setFeedback({
          tone: 'warning',
          message: `Already signed in today at ${formatTimeFromTimestamp(
            outcome.signedInAt,
          )}. Have a productive session, ${outcome.profile.full_name}.`,
        })
      } else {
        setFeedback({
          tone: 'error',
          message: `Profile not found for "${outcome.studentNumber}". Please contact an Admin to create your profile.`,
        })
      }

      scheduleAutoClear()
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Sign-in failed. Please try again.',
      })
      scheduleAutoClear()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center">
      <div className="mb-6 w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Daily Sign-In Register</h1>
        <p className="mt-2 text-sm text-muted" aria-live="off">
          {formatHeaderDate(now)}
        </p>
      </div>

      <div className="w-full rounded-lg border border-border bg-surface p-5 sm:p-6">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input
            id="student-number"
            ref={inputRef}
            aria-label="Student Number"
            value={studentNumber}
            onChange={(event) => updateStudentNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                formRef.current?.requestSubmit()
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Enter student number"
            disabled={busy}
            className="h-16 w-full rounded-md border border-border bg-surface px-4 text-center text-2xl font-semibold tracking-[0.3em] text-ink placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60"
          />

          <Numpad
            onDigit={handleDigit}
            onClear={() => updateStudentNumber('')}
            onBackspace={() => updateStudentNumber(studentNumber.slice(0, -1))}
            disabled={busy}
          />

          <button
            type="submit"
            disabled={busy || studentNumber.trim().length === 0}
            className="flex min-h-14 w-full items-center justify-center rounded-md bg-accent px-5 text-base font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'SIGNING IN...' : 'SIGN IN NOW'}
          </button>
        </form>

        <div className="mt-4 min-h-0">
          {feedback ? <StatusBanner tone={feedback.tone} message={feedback.message} /> : null}
        </div>
      </div>
    </section>
  )
}
