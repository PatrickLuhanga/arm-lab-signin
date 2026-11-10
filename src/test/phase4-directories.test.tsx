import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const mockedListProfiles = vi.mocked(listProfiles)
const mockedListProjects = vi.mocked(listProjects)
const mockedUpdateProfile = vi.mocked(updateProfile)
const mockedAddProject = vi.mocked(addProject)
const mockedUpdateProject = vi.mocked(updateProject)
const mockedDeleteProject = vi.mocked(deleteProject)
const mockedGetRecentSignIns = vi.mocked(getRecentSignIns)

function renderWithRouter(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

function findProfile(id: number) {
  return state.profiles.find((profile) => profile.id === id)
}

beforeEach(() => {
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
})
