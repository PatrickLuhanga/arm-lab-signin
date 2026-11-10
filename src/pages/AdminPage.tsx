import { Database, Download, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import RoleBadge from '../components/RoleBadge'
import StatusBanner, { type BannerTone } from '../components/StatusBanner'
import {
  buildDailyAttendanceCsv,
  buildFullAttendanceSummaryCsv,
  getDatabasePath,
  saveCsvFile,
  saveDatabaseBackup,
} from '../db/exports'
import { createProfile, deleteProfile, listProfiles } from '../db/profiles'
import { getAttendanceForDate, toLocalDateString } from '../db/signIns'
import type { AttendanceEntry, ProfileWithStats, Role } from '../db/types'
import { errorMessage } from '../lib/errors'
import { formatTimeFromTimestamp, roleLabel } from '../lib/format'

type AdminTab = 'profiles' | 'logs' | 'backup'

interface Notice {
  tone: BannerTone
  message: string
}

interface CreateFormState {
  role: Role
  fullName: string
  studentNumber: string
  course: string
  organization: string
  projectTitle: string
  projectDescription: string
}

const emptyCreateForm: CreateFormState = {
  role: 'arm_member',
  fullName: '',
  studentNumber: '',
  course: '',
  organization: '',
  projectTitle: '',
  projectDescription: '',
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'profiles', label: 'Create & Manage Profiles' },
  { id: 'logs', label: 'Daily Attendance Logs' },
  { id: 'backup', label: 'Database Backup' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('profiles')
  const [notice, setNotice] = useState<Notice | null>(null)

  const [profiles, setProfiles] = useState<ProfileWithStats[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profileSearch, setProfileSearch] = useState('')
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<ProfileWithStats | null>(null)

  const [attendanceDate, setAttendanceDate] = useState(() => toLocalDateString(new Date()))
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [exportingLogs, setExportingLogs] = useState(false)
  const [exportingSummary, setExportingSummary] = useState(false)

  const [databasePath, setDatabasePath] = useState<string | null>(null)
  const [backingUp, setBackingUp] = useState(false)

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true)

    try {
      setProfiles(await listProfiles())
    } catch (loadError) {
      setNotice({ tone: 'error', message: errorMessage(loadError) })
    } finally {
      setProfilesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (tab !== 'logs') {
      return
    }

    let active = true
    setAttendanceLoading(true)

    getAttendanceForDate(attendanceDate)
      .then((rows) => {
        if (active) {
          setAttendance(rows)
        }
      })
      .catch((loadError) => {
        if (active) {
          setNotice({ tone: 'error', message: errorMessage(loadError) })
        }
      })
      .finally(() => {
        if (active) {
          setAttendanceLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [tab, attendanceDate])

  useEffect(() => {
    if (tab !== 'backup' || databasePath !== null) {
      return
    }

    getDatabasePath()
      .then(setDatabasePath)
      .catch(() => setDatabasePath(null))
  }, [tab, databasePath])

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fullName = createForm.fullName.trim()
    const studentNumber = createForm.studentNumber.trim()
    const course = createForm.course.trim()

    if (fullName.length === 0) {
      setCreateError('Full name is required.')
      return
    }

    if (studentNumber.length === 0) {
      setCreateError('Student number is required.')
      return
    }

    if (course.length === 0) {
      setCreateError('Course is required.')
      return
    }

    if (createForm.role === 'arm_member' && createForm.projectTitle.trim().length === 0) {
      setCreateError('Project title is required for Arm Members.')
      return
    }

    if (createForm.role === 'intern' && createForm.organization.trim().length === 0) {
      setCreateError('Organization is required for Interns.')
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      if (createForm.role === 'arm_member') {
        await createProfile({
          role: 'arm_member',
          fullName,
          studentNumber,
          course,
          initialProject: {
            title: createForm.projectTitle,
            description: createForm.projectDescription,
          },
        })
      } else {
        await createProfile({
          role: 'intern',
          fullName,
          studentNumber,
          course,
          organization: createForm.organization,
        })
      }

      setCreateForm({ ...emptyCreateForm })
      setNotice({ tone: 'success', message: 'Profile created.' })
      await loadProfiles()
    } catch (createFailure) {
      setCreateError(errorMessage(createFailure))
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteProfile() {
    if (!confirmDeleteProfile) {
      return
    }

    try {
      await deleteProfile(confirmDeleteProfile.id)
      setConfirmDeleteProfile(null)
      setNotice({ tone: 'success', message: 'Profile deleted.' })
      await loadProfiles()
    } catch (deleteFailure) {
      setConfirmDeleteProfile(null)
      setNotice({ tone: 'error', message: errorMessage(deleteFailure) })
    }
  }

  async function handleExportDay() {
    setExportingLogs(true)

    try {
      const path = await saveCsvFile(
        `attendance-${attendanceDate}.csv`,
        buildDailyAttendanceCsv(attendance),
      )
      setNotice(
        path
          ? { tone: 'success', message: `Daily attendance exported to ${path}` }
          : { tone: 'info', message: 'Export cancelled.' },
      )
    } catch (exportFailure) {
      setNotice({ tone: 'error', message: errorMessage(exportFailure) })
    } finally {
      setExportingLogs(false)
    }
  }

  async function handleExportSummary() {
    setExportingSummary(true)

    try {
      const rows = await listProfiles()
      const path = await saveCsvFile(
        'armlab-attendance-summary.csv',
        buildFullAttendanceSummaryCsv(rows),
      )
      setNotice(
        path
          ? { tone: 'success', message: `Attendance summary exported to ${path}` }
          : { tone: 'info', message: 'Export cancelled.' },
      )
    } catch (exportFailure) {
      setNotice({ tone: 'error', message: errorMessage(exportFailure) })
    } finally {
      setExportingSummary(false)
    }
  }

  async function handleBackup() {
    setBackingUp(true)

    try {
      const path = await saveDatabaseBackup()
      setNotice(
        path
          ? { tone: 'success', message: `Database backup saved to ${path}` }
          : { tone: 'info', message: 'Backup cancelled.' },
      )
    } catch (backupFailure) {
      setNotice({ tone: 'error', message: errorMessage(backupFailure) })
    } finally {
      setBackingUp(false)
    }
  }

  const profileQuery = profileSearch.trim().toLowerCase()
  const filteredProfiles = profiles.filter(
    (profile) =>
      profileQuery.length === 0 ||
      profile.full_name.toLowerCase().includes(profileQuery) ||
      profile.student_number.toLowerCase().includes(profileQuery),
  )

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Arm Lab</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Admin</h1>
        <p className="mt-2 text-sm text-muted">
          Create profiles, review attendance, export CSV reports, and back up the local database.
        </p>
      </div>

      <div role="tablist" aria-label="Admin sections" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id)
              setNotice(null)
            }}
            className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition ${
              tab === item.id
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="mb-4">
          <StatusBanner tone={notice.tone} message={notice.message} />
        </div>
      ) : null}

      {tab === 'profiles' ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Create Profile</h2>
            <p className="mt-1 text-sm text-muted">
              Arm Members need an initial project. Interns need an organization.
            </p>

            <form onSubmit={handleCreateProfile} noValidate className="mt-4 space-y-4">
              {createError ? <StatusBanner tone="error" message={createError} /> : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role" htmlFor="admin-role">
                  <select
                    id="admin-role"
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, role: event.target.value as Role })
                    }
                    className={inputClass}
                  >
                    <option value="arm_member">Arm Member</option>
                    <option value="intern">Intern</option>
                  </select>
                </Field>
                <Field label="Full Name" htmlFor="admin-full-name">
                  <input
                    id="admin-full-name"
                    value={createForm.fullName}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, fullName: event.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Student Number" htmlFor="admin-student-number">
                  <input
                    id="admin-student-number"
                    value={createForm.studentNumber}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, studentNumber: event.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Course" htmlFor="admin-course">
                  <input
                    id="admin-course"
                    value={createForm.course}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, course: event.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </Field>
              </div>

              {createForm.role === 'arm_member' ? (
                <div className="rounded-xl border border-border bg-app p-4">
                  <p className="text-sm font-semibold text-ink">Mandatory Initial Project</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Project Title" htmlFor="admin-project-title">
                      <input
                        id="admin-project-title"
                        value={createForm.projectTitle}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, projectTitle: event.target.value })
                        }
                        className={inputClass}
                        required
                      />
                    </Field>
                    <Field label="Description" htmlFor="admin-project-description">
                      <input
                        id="admin-project-description"
                        value={createForm.projectDescription}
                        onChange={(event) =>
                          setCreateForm({
                            ...createForm,
                            projectDescription: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <Field label="Organization" htmlFor="admin-organization">
                  <input
                    id="admin-organization"
                    value={createForm.organization}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, organization: event.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </Field>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={creating} className={primaryButtonClass}>
                  {creating ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-border bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Manage Profiles</h2>
              <label className="relative block w-full sm:w-72">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  placeholder="Search profiles..."
                  aria-label="Search profiles"
                  className="h-11 w-full rounded-full border border-border bg-app pl-9 pr-4 text-sm text-ink placeholder:text-muted focus:border-accent"
                />
              </label>
            </div>

            {profilesLoading ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Loading profiles...</p>
            ) : filteredProfiles.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No profiles found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                      <th scope="col" className="px-5 py-3">Name</th>
                      <th scope="col" className="px-5 py-3">Student #</th>
                      <th scope="col" className="px-5 py-3">Role</th>
                      <th scope="col" className="px-5 py-3">Qualification</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile) => (
                      <tr key={profile.id} className="border-b border-border last:border-b-0">
                        <td className="px-5 py-4 text-sm font-semibold text-ink">{profile.full_name}</td>
                        <td className="px-5 py-4 text-sm text-muted">{profile.student_number}</td>
                        <td className="px-5 py-4">
                          <RoleBadge role={profile.role} />
                        </td>
                        <td className="px-5 py-4 text-sm text-muted">
                          {profile.organization ?? profile.course}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProfile(profile)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-danger transition hover:border-danger"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'logs' ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Daily Attendance Logs</h2>
              <p className="mt-1 text-sm text-muted">Review who signed in on a selected day.</p>
            </div>
            <Field label="Attendance date" htmlFor="attendance-date">
              <input
                id="attendance-date"
                type="date"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportDay}
              disabled={exportingLogs}
              className={secondaryButtonClass}
            >
              <Download size={16} aria-hidden="true" />
              {exportingLogs ? 'Exporting...' : 'Export Selected Day CSV'}
            </button>
            <button
              type="button"
              onClick={handleExportSummary}
              disabled={exportingSummary}
              className={secondaryButtonClass}
            >
              <Download size={16} aria-hidden="true" />
              {exportingSummary ? 'Exporting...' : 'Export Full Attendance Summary CSV'}
            </button>
          </div>

          {attendanceLoading ? (
            <p className="py-8 text-center text-sm text-muted">Loading attendance...</p>
          ) : attendance.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-app px-4 py-6 text-center text-sm text-muted">
              No sign-ins recorded for {attendanceDate}.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Student #</th>
                    <th scope="col" className="px-4 py-3">Role</th>
                    <th scope="col" className="px-4 py-3">Course</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-4 text-sm text-muted">
                        {formatTimeFromTimestamp(row.signed_in_at)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-ink">{row.full_name}</td>
                      <td className="px-4 py-4 text-sm text-muted">{row.student_number}</td>
                      <td className="px-4 py-4 text-sm text-muted">{roleLabel(row.role)}</td>
                      <td className="px-4 py-4 text-sm text-muted">{row.course}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'backup' ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-app text-accent">
              <Database size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Database Backup</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                The local SQLite database is stored in the application config directory. Backing it
                up copies the complete armlab.db file to a folder or USB drive you choose.
              </p>
              <p className="mt-2 break-all rounded-lg bg-app px-3 py-2 font-mono text-xs text-muted">
                {databasePath ?? 'Resolving database location...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBackup}
            disabled={backingUp}
            className={`${primaryButtonClass} mt-5`}
          >
            <Download size={16} aria-hidden="true" />
            {backingUp ? 'Backing up...' : 'Download Database Backup (.db)'}
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDeleteProfile !== null}
        title="Delete profile?"
        description={
          confirmDeleteProfile
            ? `${confirmDeleteProfile.full_name} will be removed permanently. All projects and sign-in history for this profile will also be deleted.`
            : undefined
        }
        confirmLabel="Delete Profile"
        destructive
        onConfirm={handleDeleteProfile}
        onCancel={() => setConfirmDeleteProfile(null)}
      />
    </section>
  )
}

const inputClass =
  'h-12 w-full rounded-xl border border-border bg-app px-3 text-sm text-ink focus:border-accent'

const primaryButtonClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60'

const secondaryButtonClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-60'

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
