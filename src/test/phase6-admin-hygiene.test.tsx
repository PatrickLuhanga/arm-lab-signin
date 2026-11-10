import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDailyAttendanceCsv,
  buildFullAttendanceSummaryCsv,
  getDatabasePath,
  saveCsvFile,
  saveDatabaseBackup,
} from '../db/exports'
import { createProfile, deleteProfile, listProfiles } from '../db/profiles'
import { getAttendanceForDate, toLocalDateString } from '../db/signIns'
import type { AttendanceEntry, CreateProfileInput, Profile, ProfileWithStats } from '../db/types'
import AdminPage from '../pages/AdminPage'

const state = vi.hoisted(() => ({
  profiles: [] as any[],
  attendance: [] as any[],
  nextProfileId: 300,
}))

vi.mock('../db/profiles', () => ({
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  listProfiles: vi.fn(),
}))

vi.mock('../db/signIns', () => ({
  getAttendanceForDate: vi.fn(),
  toLocalDateString: vi.fn(),
}))

vi.mock('../db/exports', () => ({
  buildDailyAttendanceCsv: vi.fn(),
  buildFullAttendanceSummaryCsv: vi.fn(),
  getDatabasePath: vi.fn(),
  saveCsvFile: vi.fn(),
  saveDatabaseBackup: vi.fn(),
}))

const mockedCreateProfile = vi.mocked(createProfile)
const mockedDeleteProfile = vi.mocked(deleteProfile)
const mockedListProfiles = vi.mocked(listProfiles)
const mockedGetAttendanceForDate = vi.mocked(getAttendanceForDate)
const mockedToLocalDateString = vi.mocked(toLocalDateString)
const mockedBuildDailyAttendanceCsv = vi.mocked(buildDailyAttendanceCsv)
const mockedBuildFullAttendanceSummaryCsv = vi.mocked(buildFullAttendanceSummaryCsv)
const mockedGetDatabasePath = vi.mocked(getDatabasePath)
const mockedSaveCsvFile = vi.mocked(saveCsvFile)
const mockedSaveDatabaseBackup = vi.mocked(saveDatabaseBackup)

beforeEach(() => {
  state.profiles.length = 0
  state.attendance.length = 0
  state.nextProfileId = 300

  const existingProfile: ProfileWithStats = {
    id: 1,
    student_number: '22000001',
    full_name: 'Anele Mokoena',
    role: 'arm_member',
    course: 'Electronic Engineering',
    organization: null,
    created_at: '2026-11-01 08:00:00',
    project_count: 1,
    sign_in_count: 4,
  }

  state.profiles.push(existingProfile)

  const attendanceRow: AttendanceEntry = {
    id: 11,
    profile_id: 1,
    sign_in_date: '2026-11-10',
    signed_in_at: '2026-11-10 09:15:00',
    full_name: 'Anele Mokoena',
    student_number: '22000001',
    role: 'arm_member',
    course: 'Electronic Engineering',
  }

  state.attendance.push(attendanceRow)

  mockedToLocalDateString.mockReturnValue('2026-11-10')

  mockedListProfiles.mockImplementation(async () =>
    state.profiles.map((profile) => ({ ...profile })) as ProfileWithStats[],
  )

  mockedCreateProfile.mockImplementation(async (input: CreateProfileInput) => {
    const profile: Profile = {
      id: state.nextProfileId++,
      student_number: input.studentNumber,
      full_name: input.fullName,
      role: input.role,
      course: input.course,
      organization: input.role === 'intern' ? input.organization : null,
      created_at: '2026-11-10 08:00:00',
    }

    state.profiles.push({
      ...profile,
      project_count: input.role === 'arm_member' ? 1 : 0,
      sign_in_count: 0,
    })

    return profile
  })

  mockedDeleteProfile.mockImplementation(async (profileId: number) => {
    const index = state.profiles.findIndex((profile) => profile.id === profileId)

    if (index >= 0) {
      state.profiles.splice(index, 1)
    }
  })

  mockedGetAttendanceForDate.mockImplementation(
    async () => state.attendance.map((row) => ({ ...row })) as AttendanceEntry[],
  )

  mockedBuildDailyAttendanceCsv.mockReturnValue('daily-csv')
  mockedBuildFullAttendanceSummaryCsv.mockReturnValue('summary-csv')
  mockedGetDatabasePath.mockResolvedValue('C:/arm-lab/armlab.db')
  mockedSaveCsvFile.mockResolvedValue('C:/tmp/export.csv')
  mockedSaveDatabaseBackup.mockResolvedValue('C:/tmp/armlab-backup.db')
})

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : collectSourceFiles(fullPath)
    }

    return /\.(ts|tsx|css)$/.test(entry.name) ? [fullPath] : []
  })
}

describe('Phase 6 admin validation', () => {
  it('blocks an Arm Member without a project and an Intern without an organization', async () => {
    render(<AdminPage />)

    await screen.findByRole('heading', { name: 'Create Profile' })

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Lerato Dlamini' },
    })
    fireEvent.change(screen.getByLabelText('Student Number'), {
      target: { value: '22000010' },
    })
    fireEvent.change(screen.getByLabelText('Course'), {
      target: { value: 'Mechatronics' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }))

    expect(mockedCreateProfile).not.toHaveBeenCalled()
    expect(
      screen.getByText('Project title is required for Arm Members.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'intern' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }))

    expect(mockedCreateProfile).not.toHaveBeenCalled()
    expect(screen.getByText('Organization is required for Interns.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'DUT Arm Lab' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }))
    })

    await waitFor(() => {
      expect(mockedCreateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'intern',
          organization: 'DUT Arm Lab',
        }),
      )
    })

    expect(await screen.findByText('Profile created.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Sipho Ndlovu' },
    })
    fireEvent.change(screen.getByLabelText('Student Number'), {
      target: { value: '22000011' },
    })
    fireEvent.change(screen.getByLabelText('Course'), {
      target: { value: 'Electrical Engineering' },
    })
    fireEvent.change(screen.getByLabelText('Project Title'), {
      target: { value: 'Line Following Robot' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }))
    })

    await waitFor(() => {
      expect(mockedCreateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'arm_member',
          initialProject: expect.objectContaining({ title: 'Line Following Robot' }),
        }),
      )
    })
  })
})

describe('Phase 6 exports and backup', () => {
  it('triggers daily CSV, summary CSV, and database backup handlers', async () => {
    render(<AdminPage />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Daily Attendance Logs' }))

    await waitFor(() => {
      expect(mockedGetAttendanceForDate).toHaveBeenCalledWith('2026-11-10')
    })

    expect(await screen.findByText('Anele Mokoena')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Export Selected Day CSV' }))

    await waitFor(() => {
      expect(mockedBuildDailyAttendanceCsv).toHaveBeenCalled()
      expect(mockedSaveCsvFile).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export Full Attendance Summary CSV' }))

    await waitFor(() => {
      expect(mockedBuildFullAttendanceSummaryCsv).toHaveBeenCalled()
      expect(mockedSaveCsvFile).toHaveBeenCalledTimes(2)
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Database Backup' }))

    await waitFor(() => {
      expect(mockedGetDatabasePath).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: /Download Database Backup/i }))

    await waitFor(() => {
      expect(mockedSaveDatabaseBackup).toHaveBeenCalled()
    })

    expect(mockedDeleteProfile).not.toHaveBeenCalled()
  })
})

describe('Phase 6 repository hygiene', () => {
  it('has zero localStorage, sessionStorage, passwords, and Unicode emojis in src', () => {
    const files = collectSourceFiles(resolve(process.cwd(), 'src'))
    const emojiPattern = /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}]/u

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const content = readFileSync(file, 'utf8')

      expect(content, `Web storage found in ${file}`).not.toMatch(
        /localStorage|sessionStorage/,
      )
      expect(content, `Password gate found in ${file}`).not.toMatch(/password/i)
      expect(content, `Announcement feature found in ${file}`).not.toMatch(/announcement/i)
      expect(emojiPattern.test(content), `Emoji found in ${file}`).toBe(false)
    }
  })
})
