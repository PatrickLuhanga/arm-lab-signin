import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import AdminActionPasswordModal from '../components/AdminActionPasswordModal'
import Breadcrumbs from '../components/Breadcrumbs'
import ConfirmModal from '../components/ConfirmModal'
import Modal from '../components/Modal'
import RoleBadge from '../components/RoleBadge'
import StatusBanner, { type BannerTone } from '../components/StatusBanner'
import { addProject, deleteProject, listProfiles, listProjects, updateProfile, updateProject } from '../db/profiles'
import type { ProfileWithStats, Project } from '../db/types'
import { errorMessage } from '../lib/errors'
import { pluralize } from '../lib/format'

interface Notice {
  tone: BannerTone
  message: string
}

interface ProfileFormState {
  fullName: string
  studentNumber: string
  course: string
}

interface ProjectFormState {
  title: string
  description: string
}

type PendingAdminAction =
  | { type: 'edit-profile' }
  | { type: 'edit-project'; project: Project }
  | { type: 'delete-project'; project: Project }

const emptyProfileForm: ProfileFormState = { fullName: '', studentNumber: '', course: '' }
const emptyProjectForm: ProjectFormState = { title: '', description: '' }

export default function MembersPage() {
  const [profiles, setProfiles] = useState<ProfileWithStats[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [projectRefresh, setProjectRefresh] = useState(0)

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm)
  const [profileFormError, setProfileFormError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [addingProject, setAddingProject] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm)
  const [projectFormError, setProjectFormError] = useState<string | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const [confirmProjectDelete, setConfirmProjectDelete] = useState<Project | null>(null)
  const [pendingAdminAction, setPendingAdminAction] = useState<PendingAdminAction | null>(null)

  const loadProfiles = useCallback(async (preferredId?: number | null) => {
    setError(null)

    try {
      const rows = await listProfiles('arm_member')
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
      setProjects([])
      return
    }

    let active = true

    listProjects(selectedId)
      .then((rows) => {
        if (active) {
          setProjects(rows)
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
  }, [selectedId, projectRefresh])

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? null
  const query = search.trim().toLowerCase()
  const filteredProfiles = profiles.filter(
    (profile) =>
      query.length === 0 ||
      profile.full_name.toLowerCase().includes(query) ||
      profile.student_number.toLowerCase().includes(query),
  )

  function requestEditProfile() {
    if (!selectedProfile) {
      return
    }

    setPendingAdminAction({ type: 'edit-profile' })
  }

  function beginEditProfile() {
    if (!selectedProfile) {
      return
    }

    setProfileForm({
      fullName: selectedProfile.full_name,
      studentNumber: selectedProfile.student_number,
      course: selectedProfile.course,
    })
    setProfileFormError(null)
    setEditingProfile(true)
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProfile) {
      return
    }

    setSavingProfile(true)
    setProfileFormError(null)

    try {
      await updateProfile(selectedProfile.id, profileForm)
      setEditingProfile(false)
      setNotice({ tone: 'success', message: 'Member details updated.' })
      await loadProfiles(selectedProfile.id)
    } catch (saveError) {
      setProfileFormError(errorMessage(saveError))
    } finally {
      setSavingProfile(false)
    }
  }

  function openAddProject() {
    setEditingProject(null)
    setProjectForm({ ...emptyProjectForm })
    setProjectFormError(null)
    setAddingProject(true)
  }

  function requestEditProject(project: Project) {
    setPendingAdminAction({ type: 'edit-project', project })
  }

  function beginEditProject(project: Project) {
    setAddingProject(false)
    setEditingProject(project)
    setProjectForm({ title: project.title, description: project.description ?? '' })
    setProjectFormError(null)
  }

  function closeProjectForm() {
    setAddingProject(false)
    setEditingProject(null)
    setProjectFormError(null)
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProfile) {
      return
    }

    setSavingProject(true)
    setProjectFormError(null)

    try {
      if (editingProject) {
        await updateProject(selectedProfile.id, editingProject.id, projectForm)
        setNotice({ tone: 'success', message: 'Project updated.' })
      } else {
        await addProject(selectedProfile.id, projectForm)
        setNotice({ tone: 'success', message: 'Project added.' })
      }

      closeProjectForm()
      setProjectRefresh((value) => value + 1)
      await loadProfiles(selectedProfile.id)
    } catch (saveError) {
      setProjectFormError(errorMessage(saveError))
    } finally {
      setSavingProject(false)
    }
  }

  function handleConfirmDeleteProject() {
    if (!confirmProjectDelete) {
      return
    }

    const project = confirmProjectDelete
    setConfirmProjectDelete(null)
    setPendingAdminAction({ type: 'delete-project', project })
  }

  async function performDeleteProject(project: Project) {
    if (!selectedProfile) {
      return
    }

    try {
      await deleteProject(selectedProfile.id, project.id)
      setNotice({ tone: 'success', message: 'Project deleted.' })
      setProjectRefresh((value) => value + 1)
      await loadProfiles(selectedProfile.id)
    } catch (deleteError) {
      setNotice({ tone: 'error', message: errorMessage(deleteError) })
    }
  }

  function handleAdminVerified() {
    const action = pendingAdminAction
    setPendingAdminAction(null)

    if (!action) {
      return
    }

    if (action.type === 'edit-profile') {
      beginEditProfile()
      return
    }

    if (action.type === 'edit-project') {
      beginEditProject(action.project)
      return
    }

    void performDeleteProject(action.project)
  }

  const projectFormOpen = addingProject || editingProject !== null

  return (
    <section className="w-full">
      <Breadcrumbs items={[{ label: 'More', to: '/sections' }, { label: 'Arm Members' }]} />

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Arm Members</h1>
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
                  placeholder="Search members..."
                  aria-label="Search members"
                  className="h-10 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none"
                />
              </label>
            </div>

            <div data-testid="member-list" className="max-h-[70vh] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Loading members...</p>
              ) : filteredProfiles.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No members match your search.
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
                          {pluralize(profile.project_count, 'project')} |{' '}
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
                      <RoleBadge role="arm_member" />
                    </div>
                    <p className="mt-1 text-sm text-muted">{selectedProfile.course}</p>
                  </div>
                  <button
                    type="button"
                    onClick={requestEditProfile}
                    className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-subtle"
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Edit Details
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
                    <dt className="text-xs font-medium text-muted">Total Sign-Ins</dt>
                    <dd className="text-sm font-medium text-ink">
                      {selectedProfile.sign_in_count}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-ink">Projects</h3>
                      <p className="text-xs text-muted">Minimum 1 required</p>
                    </div>
                    <button
                      type="button"
                      onClick={openAddProject}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add New Project
                    </button>
                  </div>

                  {projects.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">
                      No projects yet. Add the first project to keep this member compliant.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-border border-t border-border">
                      {projects.map((project) => {
                        const isLastProject = projects.length <= 1

                        return (
                          <div key={project.id} className="py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink">{project.title}</p>
                                {project.description ? (
                                  <p className="mt-1 text-sm leading-6 text-muted">
                                    {project.description}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => requestEditProject(project)}
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded border border-border bg-surface px-3 text-xs font-semibold text-ink transition hover:bg-surface-subtle"
                                >
                                  <Pencil size={14} aria-hidden="true" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmProjectDelete(project)}
                                  disabled={isLastProject}
                                  title={
                                    isLastProject
                                      ? 'At least 1 project required'
                                      : 'Delete project'
                                  }
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded border border-border bg-surface px-3 text-xs font-semibold text-danger transition hover:bg-danger-fill disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  Delete
                                </button>
                              </div>
                            </div>
                            {isLastProject ? (
                              <p className="mt-2 text-xs text-muted">At least 1 project required</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-ink">No member selected</p>
                <p className="mt-2 text-sm text-muted">
                  Select a member from the list to view their projects.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Modal
        open={editingProfile}
        title="Edit Member Details"
        onClose={() => setEditingProfile(false)}
      >
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {profileFormError ? <StatusBanner tone="error" message={profileFormError} /> : null}
          <Field label="Full Name" htmlFor="member-full-name">
            <input
              id="member-full-name"
              value={profileForm.fullName}
              onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Student Number" htmlFor="member-student-number">
            <input
              id="member-student-number"
              value={profileForm.studentNumber}
              onChange={(event) =>
                setProfileForm({ ...profileForm, studentNumber: event.target.value })
              }
              className={inputClass}
              required
            />
          </Field>
          <Field label="Course" htmlFor="member-course">
            <input
              id="member-course"
              value={profileForm.course}
              onChange={(event) => setProfileForm({ ...profileForm, course: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button type="submit" disabled={savingProfile} className={primaryButtonClass}>
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={projectFormOpen}
        title={editingProject ? 'Edit Project' : 'Add New Project'}
        onClose={closeProjectForm}
      >
        <form onSubmit={handleProjectSubmit} className="space-y-4">
          {projectFormError ? <StatusBanner tone="error" message={projectFormError} /> : null}
          <Field label="Project Title" htmlFor="project-title">
            <input
              id="project-title"
              value={projectForm.title}
              onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Description" htmlFor="project-description">
            <textarea
              id="project-description"
              value={projectForm.description}
              onChange={(event) =>
                setProjectForm({ ...projectForm, description: event.target.value })
              }
              rows={4}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeProjectForm} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={savingProject} className={primaryButtonClass}>
              {savingProject ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>
      </Modal>

      <AdminActionPasswordModal
        open={pendingAdminAction !== null}
        actionLabel={
          pendingAdminAction?.type === 'edit-profile'
            ? 'edit member details'
            : pendingAdminAction?.type === 'edit-project'
              ? 'edit project details'
              : 'delete this project'
        }
        onVerified={handleAdminVerified}
        onCancel={() => setPendingAdminAction(null)}
      />

      <ConfirmModal
        open={confirmProjectDelete !== null}
        title="Delete project?"
        description={
          confirmProjectDelete
            ? `"${confirmProjectDelete.title}" will be removed permanently.`
            : undefined
        }
        confirmLabel="Delete Project"
        destructive
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setConfirmProjectDelete(null)}
      />
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
