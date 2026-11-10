import { Pencil, Search } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import AdminActionPasswordModal from '../components/AdminActionPasswordModal'
import Breadcrumbs from '../components/Breadcrumbs'
import Modal from '../components/Modal'
import RoleBadge from '../components/RoleBadge'
import StatusBanner, { type BannerTone } from '../components/StatusBanner'
import { listProfiles, updateProfile } from '../db/profiles'
import { getRecentSignIns } from '../db/signIns'
import type { ProfileWithStats, SignIn } from '../db/types'
import { errorMessage } from '../lib/errors'
import { formatTimeFromTimestamp, pluralize } from '../lib/format'

interface Notice {
  tone: BannerTone
  message: string
}

interface InternFormState {
  fullName: string
  studentNumber: string
  course: string
  organization: string
}

const emptyForm: InternFormState = {
  fullName: '',
  studentNumber: '',
  course: '',
  organization: '',
}

export default function InternsPage() {
  const [profiles, setProfiles] = useState<ProfileWithStats[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [recentSignIns, setRecentSignIns] = useState<SignIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<InternFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const loadProfiles = useCallback(async (preferredId?: number | null) => {
    setError(null)

    try {
      const rows = await listProfiles('intern')
      setProfiles(rows)
      setSelectedId((current) => {
        const target = preferredId ?? current

        if (target && rows.some((row) => row.id === target)) {
          return target
        }

        return rows[0]?.id ?? null
      })
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (selectedId === null) {
      setRecentSignIns([])
      return
    }

    let active = true

    getRecentSignIns(selectedId, 20)
      .then((rows) => {
        if (active) {
          setRecentSignIns(rows)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(errorMessage(loadError))
        }
      })

    return () => {
      active = false
    }
  }, [selectedId])

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? null
  const query = search.trim().toLowerCase()
  const filteredProfiles = profiles.filter(
    (profile) =>
      query.length === 0 ||
      profile.full_name.toLowerCase().includes(query) ||
      profile.student_number.toLowerCase().includes(query) ||
      (profile.organization ?? '').toLowerCase().includes(query),
  )

  function requestEdit() {
    if (!selectedProfile) {
      return
    }

    setPasswordOpen(true)
  }

  function beginEdit() {
    if (!selectedProfile) {
      return
    }

    setForm({
      fullName: selectedProfile.full_name,
      studentNumber: selectedProfile.student_number,
      course: selectedProfile.course,
      organization: selectedProfile.organization ?? '',
    })
    setFormError(null)
    setEditing(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProfile) {
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await updateProfile(selectedProfile.id, form)
      setEditing(false)
      setNotice({ tone: 'success', message: 'Intern details updated.' })
      await loadProfiles(selectedProfile.id)
    } catch (saveError) {
      setFormError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="w-full">
      <Breadcrumbs items={[{ label: 'More', to: '/sections' }, { label: 'Interns' }]} />

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Interns</h1>
      </div>

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="error" message={error} />
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4">
          <StatusBanner tone={notice.tone} message={notice.message} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="grid lg:grid-cols-[320px_1fr]">
          <div className="border-b border-border lg:border-b-0 lg:border-r">
            <div className="border-b border-border p-3">
              <label className="relative block">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search interns..."
                  aria-label="Search interns"
                  className="h-10 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none"
                />
              </label>
            </div>

            <div data-testid="intern-list" className="max-h-[70vh] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Loading interns...</p>
              ) : filteredProfiles.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No interns match your search.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredProfiles.map((profile) => (
                    <li key={profile.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(profile.id)}
                        aria-pressed={profile.id === selectedId}
                        className={`flex min-h-16 w-full flex-col items-start gap-1 px-4 py-3 text-left transition ${
                          profile.id === selectedId
                            ? 'bg-surface-subtle'
                            : 'hover:bg-surface-subtle'
                        }`}
                      >
                        <span className="text-sm font-semibold text-ink">{profile.full_name}</span>
                        <span className="text-xs text-muted">{profile.student_number}</span>
                        <span className="text-xs text-muted">
                          {profile.organization ?? 'No organization'} |{' '}
                          {pluralize(profile.sign_in_count, 'sign-in')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="p-6">
            {selectedProfile ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight text-ink">
                        {selectedProfile.full_name}
                      </h2>
                      <RoleBadge role="intern" />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {selectedProfile.organization ?? 'No organization recorded'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={requestEdit}
                    className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-subtle"
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Edit
                  </button>
                </div>

                <dl className="mt-5 divide-y divide-border border-y border-border">
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-xs font-medium text-muted">Student #</dt>
                    <dd className="text-sm font-medium text-ink">
                      {selectedProfile.student_number}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-xs font-medium text-muted">Course</dt>
                    <dd className="text-sm font-medium text-ink">{selectedProfile.course}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-xs font-medium text-muted">Organization</dt>
                    <dd className="text-sm font-medium text-ink">
                      {selectedProfile.organization ?? '�'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-xs font-medium text-muted">Total Sign-Ins</dt>
                    <dd className="text-sm font-medium text-ink">
                      {selectedProfile.sign_in_count}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6">
                  <h3 className="text-base font-semibold text-ink">Recent Sign-Ins</h3>
                  {recentSignIns.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">No sign-ins recorded yet.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border border-t border-border">
                      {recentSignIns.map((signIn) => (
                        <li
                          key={signIn.id}
                          className="flex items-center justify-between gap-3 py-2.5 text-sm"
                        >
                          <span className="text-ink">{signIn.sign_in_date}</span>
                          <span className="text-muted">
                            {formatTimeFromTimestamp(signIn.signed_in_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-ink">No intern selected</p>
                <p className="mt-2 text-sm text-muted">
                  Select an intern from the list to view their details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <AdminActionPasswordModal
        open={passwordOpen}
        actionLabel="edit intern details"
        onVerified={() => {
          setPasswordOpen(false)
          beginEdit()
        }}
        onCancel={() => setPasswordOpen(false)}
      />

      <Modal open={editing} title="Edit Intern Details" onClose={() => setEditing(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? <StatusBanner tone="error" message={formError} /> : null}
          <Field label="Full Name" htmlFor="intern-full-name">
            <input
              id="intern-full-name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Student Number" htmlFor="intern-student-number">
            <input
              id="intern-student-number"
              value={form.studentNumber}
              onChange={(event) => setForm({ ...form, studentNumber: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Course" htmlFor="intern-course">
            <input
              id="intern-course"
              value={form.course}
              onChange={(event) => setForm({ ...form, course: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Organization" htmlFor="intern-organization">
            <input
              id="intern-organization"
              value={form.organization}
              onChange={(event) => setForm({ ...form, organization: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}

const inputClass =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none'

const primaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60'

const secondaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-subtle'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  )
}
