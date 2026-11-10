import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAuthProvider, useAdminAuth } from '../context/AdminAuthContext'
import {
  changeAdminPassword,
  isAdminPasswordConfigured,
  setAdminPassword,
  verifyAdminPassword,
} from '../db/adminAuth'
import {
  addProject,
  deleteProject,
  listProfiles,
  listProjects,
  updateProfile,
  updateProject,
} from '../db/profiles'
import { getRecentSignIns } from '../db/signIns'
import type {
  NewProjectInput,
  Profile,
  ProfileWithStats,
  Project,
  SignIn,
  UpdateProfileInput,
} from '../db/types'
import InternsPage from '../pages/InternsPage'
import MembersPage from '../pages/MembersPage'

const state = vi.hoisted(() => ({
  profiles: [] as any[],
  projects: {} as Record<number, any[]>,
  recent: {} as Record<number, any[]>,
}))

vi.mock('../db/profiles', () => ({
  listProfiles: vi.fn(),
  listProjects: vi.fn(),
  updateProfile: vi.fn(),
  addProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}))

vi.mock('../db/signIns', () => ({
  getRecentSignIns: vi.fn(),
}))

vi.mock('../db/adminAuth', () => ({
  ADMIN_PASSWORD_HASH_KEY: 'admin_password_hash',
  ADMIN_PASSWORD_SALT_KEY: 'admin_password_salt',
  MIN_ADMIN_PASSWORD_LENGTH: 4,
  isAdminPasswordConfigured: vi.fn(),
  setAdminPassword: vi.fn(),
  verifyAdminPassword: vi.fn(),
  changeAdminPassword: vi.fn(),
}))

const mockedListProfiles = vi.mocked(listProfiles)
const mockedListProjects = vi.mocked(listProjects)
const mockedUpdateProfile = vi.mocked(updateProfile)
const mockedAddProject = vi.mocked(addProject)
const mockedUpdateProject = vi.mocked(updateProject)
const mockedDeleteProject = vi.mocked(deleteProject)
const mockedGetRecentSignIns = vi.mocked(getRecentSignIns)
const mockedVerifyAdminPassword = vi.mocked(verifyAdminPassword)
const mockedIsAdminPasswordConfigured = vi.mocked(isAdminPasswordConfigured)
const mockedSetAdminPassword = vi.mocked(setAdminPassword)
const mockedChangeAdminPassword = vi.mocked(changeAdminPassword)

function renderWithRouter(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

function findProfile(id: number) {
  return state.profiles.find((profile) => profile.id === id)
}

async function passAdminPassword(password = 'adminpass') {
  const input = await screen.findByLabelText('Admin Password')
  fireEvent.change(input, { target: { value: password } })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  })
}

function cancelPasswordModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
}

function seedSecondProject() {
  const list = state.projects[1] ?? (state.projects[1] = [])

  if (!list.some((project) => project.id === 12)) {
    list.push({
      id: 12,
      profile_id: 1,
      title: 'Second Project',
      description: null,
      created_at: '2026-11-02 09:00:00',
    })
  }

  const profile = findProfile(1)
  if (profile) {
    profile.project_count = list.length
  }
}

function DirectoryAuthProbe() {
  const { isAdminUnlocked } = useAdminAuth()
  return <div>{isAdminUnlocked ? 'admin-unlocked' : 'admin-locked'}</div>
}

beforeEach(() => {
  mockedVerifyAdminPassword.mockReset()
  mockedVerifyAdminPassword.mockResolvedValue(true)
  mockedIsAdminPasswordConfigured.mockReset()
  mockedIsAdminPasswordConfigured.mockResolvedValue(true)
  mockedSetAdminPassword.mockReset()
  mockedSetAdminPassword.mockResolvedValue(undefined)
  mockedChangeAdminPassword.mockReset()
  mockedChangeAdminPassword.mockResolvedValue(undefined)

  state.profiles.length = 0
  for (const key of Object.keys(state.projects)) {
    delete state.projects[Number(key)]
  }
  for (const key of Object.keys(state.recent)) {
    delete state.recent[Number(key)]
  }

  state.profiles.push(
    {
      id: 1,
      student_number: '22000001',
      full_name: 'Anele Mokoena',
      role: 'arm_member',
      course: 'Electronic Engineering',
      organization: null,
      created_at: '2026-11-01 08:00:00',
      project_count: 1,
      sign_in_count: 3,
    },
    {
      id: 2,
      student_number: '22000002',
      full_name: 'Thandi Mahlangu',
      role: 'intern',
      course: 'Computer Systems Engineering',
      organization: 'DUT Arm Lab',
      created_at: '2026-11-01 08:00:00',
      project_count: 0,
      sign_in_count: 2,
    },
  )

  state.projects[1] = [
    {
      id: 11,
      profile_id: 1,
      title: 'RISC-V Sensor Node',
      description: 'Low power telemetry board',
      created_at: '2026-11-01 09:00:00',
    },
  ]

  state.recent[2] = [
    {
      id: 21,
      profile_id: 2,
      sign_in_date: '2026-11-10',
      signed_in_at: '2026-11-10 09:15:00',
    },
  ]

  mockedListProfiles.mockImplementation(async (role?: string) => {
    const rows: ProfileWithStats[] = state.profiles
      .filter((profile) => !role || profile.role === role)
      .map((profile) => ({ ...profile }))

    return rows
  })

  mockedListProjects.mockImplementation(async (profileId: number) => {
    const rows: Project[] = (state.projects[profileId] ?? []).map((project) => ({ ...project }))
    return rows
  })

  mockedUpdateProfile.mockImplementation(async (profileId: number, input: UpdateProfileInput) => {
    const profile = findProfile(profileId)
    if (!profile) {
      throw new Error('Profile not found.')
    }

    profile.full_name = input.fullName
    profile.student_number = input.studentNumber
    profile.course = input.course

    if (profile.role === 'intern') {
      profile.organization = input.organization
    }

    return { ...profile } as Profile
  })

  mockedAddProject.mockImplementation(async (profileId: number, input: NewProjectInput) => {
    const list = state.projects[profileId] ?? (state.projects[profileId] = [])
    const project: Project = {
      id: 100 + list.length,
      profile_id: profileId,
      title: input.title,
      description: input.description ?? null,
      created_at: '2026-11-10 10:00:00',
    }

    list.push(project)
    const profile = findProfile(profileId)
    if (profile) {
      profile.project_count = list.length
    }

    return { ...project }
  })

  mockedUpdateProject.mockImplementation(
    async (profileId: number, projectId: number, input: NewProjectInput) => {
      const list = state.projects[profileId] ?? []
      const index = list.findIndex((project) => project.id === projectId)

      if (index < 0) {
        throw new Error('Project not found.')
      }

      list[index] = {
        ...list[index],
        title: input.title,
        description: input.description ?? null,
      }

      return { ...list[index] } as Project
    },
  )

  mockedDeleteProject.mockImplementation(async (profileId: number, projectId: number) => {
    state.projects[profileId] = (state.projects[profileId] ?? []).filter(
      (project) => project.id !== projectId,
    )
    const profile = findProfile(profileId)
    if (profile) {
      profile.project_count = state.projects[profileId].length
    }
  })

  mockedGetRecentSignIns.mockImplementation(async (profileId: number) => {
    const rows: SignIn[] = (state.recent[profileId] ?? []).map((signIn) => ({ ...signIn }))
    return rows
  })
})

describe('Phase 4 Arm Members directory', () => {
  it('disables Delete for the last project and confirms before deleting once a second project exists', async () => {
    renderWithRouter(<MembersPage />)

    await screen.findAllByText('Anele Mokoena')
    await screen.findByText('RISC-V Sensor Node')

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'More' })).toHaveAttribute(
      'href',
      '/sections',
    )
    expect(within(breadcrumb).getByText('Arm Members')).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    expect(deleteButton).toBeDisabled()
    expect(screen.getByText('At least 1 project required')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add new project/i }))
    fireEvent.change(screen.getByLabelText('Project Title'), {
      target: { value: 'Second Project' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
    })

    const enabledDelete = screen.getAllByRole('button', { name: 'Delete' })[0]
    expect(enabledDelete).toBeEnabled()

    fireEvent.click(enabledDelete)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete project?')).toBeInTheDocument()
    expect(mockedDeleteProject).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }))

    expect(
      await screen.findByRole('heading', { name: 'Admin Password Required' }),
    ).toBeInTheDocument()
    expect(mockedDeleteProject).not.toHaveBeenCalled()

    await passAdminPassword()

    await waitFor(() => {
      expect(mockedDeleteProject).toHaveBeenCalledWith(1, 11)
    })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
    })
  })

  it('filters members by name or student number', async () => {
    renderWithRouter(<MembersPage />)

    await screen.findAllByText('Anele Mokoena')
    const list = screen.getByTestId('member-list')

    fireEvent.change(screen.getByLabelText('Search members'), {
      target: { value: 'not-a-member' },
    })
    expect(within(list).queryByText('Anele Mokoena')).not.toBeInTheDocument()
    expect(within(list).getByText('No members match your search.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search members'), {
      target: { value: '22000001' },
    })
    expect(within(list).getByText('Anele Mokoena')).toBeInTheDocument()
  })

  it('submits the Edit Details and Edit Project modal forms', async () => {
    renderWithRouter(<MembersPage />)

    await screen.findAllByText('Anele Mokoena')
    await screen.findByText('RISC-V Sensor Node')

    fireEvent.click(screen.getByRole('button', { name: /edit details/i }))
    await passAdminPassword()
    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Anele M. Mokoena' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockedUpdateProfile).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ fullName: 'Anele M. Mokoena' }),
      )
    })
    expect((await screen.findAllByText('Anele M. Mokoena')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await passAdminPassword()
    fireEvent.change(screen.getByLabelText('Project Title'), {
      target: { value: 'Updated Project' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(mockedUpdateProject).toHaveBeenCalledWith(
        1,
        11,
        expect.objectContaining({ title: 'Updated Project' }),
      )
    })
    expect(await screen.findByText('Updated Project')).toBeInTheDocument()
  })

  it('blocks member and project edits when the admin password is wrong or canceled', async () => {
    mockedVerifyAdminPassword.mockResolvedValue(false)
    renderWithRouter(<MembersPage />)

    await screen.findAllByText('Anele Mokoena')
    await screen.findByText('RISC-V Sensor Node')

    fireEvent.click(screen.getByRole('button', { name: /edit details/i }))
    await passAdminPassword('wrong-password')
    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Edit Member Details' })).not.toBeInTheDocument()

    cancelPasswordModal()
    expect(
      screen.queryByRole('heading', { name: 'Admin Password Required' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await passAdminPassword('wrong-password')
    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Edit Project' })).not.toBeInTheDocument()

    cancelPasswordModal()
    expect(
      screen.queryByRole('heading', { name: 'Admin Password Required' }),
    ).not.toBeInTheDocument()
  })

  it('requires confirmation and the admin password before deleting a project', async () => {
    seedSecondProject()
    renderWithRouter(<MembersPage />)

    await screen.findAllByText('Anele Mokoena')
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    expect(await screen.findByText('Delete project?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockedDeleteProject).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Project' }))
    expect(
      await screen.findByRole('heading', { name: 'Admin Password Required' }),
    ).toBeInTheDocument()

    cancelPasswordModal()
    expect(mockedDeleteProject).not.toHaveBeenCalled()

    mockedVerifyAdminPassword.mockResolvedValue(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Project' }))
    await passAdminPassword('wrong-password')
    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
    expect(mockedDeleteProject).not.toHaveBeenCalled()
  })

  it('verifies each directory action independently without unlocking /admin', async () => {
    render(
      <AdminAuthProvider>
        <MemoryRouter>
          <DirectoryAuthProbe />
          <MembersPage />
        </MemoryRouter>
      </AdminAuthProvider>,
    )

    expect(await screen.findByText('admin-locked')).toBeInTheDocument()
    await screen.findAllByText('Anele Mokoena')
    await screen.findByText('RISC-V Sensor Node')

    fireEvent.click(screen.getByRole('button', { name: /edit details/i }))
    await passAdminPassword()
    expect(
      await screen.findByRole('heading', { name: 'Edit Member Details' }),
    ).toBeInTheDocument()
    expect(screen.getByText('admin-locked')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByRole('heading', { name: 'Edit Member Details' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(
      await screen.findByRole('heading', { name: 'Admin Password Required' }),
    ).toBeInTheDocument()
    expect(screen.getByText('admin-locked')).toBeInTheDocument()
  })
})

describe('Phase 4 Interns directory', () => {
  it('searches by organization and submits the Edit modal with recent sign-ins', async () => {
    renderWithRouter(<InternsPage />)

    await screen.findAllByText('Thandi Mahlangu')

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'More' })).toHaveAttribute(
      'href',
      '/sections',
    )
    expect(within(breadcrumb).getByText('Interns')).toBeInTheDocument()

    expect(screen.getAllByText('DUT Arm Lab').length).toBeGreaterThan(0)
    expect(screen.getByText('09:15')).toBeInTheDocument()

    const list = screen.getByTestId('intern-list')

    fireEvent.change(screen.getByLabelText('Search interns'), {
      target: { value: 'DUT' },
    })
    expect(within(list).getByText('Thandi Mahlangu')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search interns'), {
      target: { value: 'UKZN' },
    })
    expect(within(list).queryByText('Thandi Mahlangu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await passAdminPassword()
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'DUT Arm Lab, Durban' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockedUpdateProfile).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ organization: 'DUT Arm Lab, Durban' }),
      )
    })
    expect((await screen.findAllByText('DUT Arm Lab, Durban')).length).toBeGreaterThan(0)
  })

  it('blocks intern edits when the admin password is wrong or canceled', async () => {
    mockedVerifyAdminPassword.mockResolvedValue(false)
    renderWithRouter(<InternsPage />)

    await screen.findAllByText('Thandi Mahlangu')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await passAdminPassword('wrong-password')
    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Edit Intern Details' })).not.toBeInTheDocument()

    cancelPasswordModal()
    expect(
      screen.queryByRole('heading', { name: 'Admin Password Required' }),
    ).not.toBeInTheDocument()
  })
})
