import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGate from '../components/AdminGate'
import { AdminAuthProvider, useAdminAuth } from '../context/AdminAuthContext'
import {
  ADMIN_PASSWORD_HASH_KEY,
  ADMIN_PASSWORD_SALT_KEY,
  changeAdminPassword,
  setAdminPassword,
  verifyAdminPassword,
} from '../db/adminAuth'
import {
  buildDailyAttendanceCsv,
  buildFullAttendanceSummaryCsv,
  getDatabasePath,
  saveCsvFile,
  saveDatabaseBackup,
} from '../db/exports'
import { createProfile, deleteProfile, listProfiles } from '../db/profiles'
import { getAttendanceForDate, toLocalDateString } from '../db/signIns'
import { getSetting, setSetting } from '../db/settings'
import type { AttendanceEntry, CreateProfileInput, Profile, ProfileWithStats } from '../db/types'
import AdminPage from '../pages/AdminPage'

const state = vi.hoisted(() => ({
  profiles: [] as any[],
  attendance: [] as any[],
  nextProfileId: 300,
}))

const settingsStore = vi.hoisted(() => new Map<string, string>())

vi.mock('../db/settings', () => ({
  THEME_SETTING_KEY: 'theme',
  getSetting: vi.fn(),
  setSetting: vi.fn(),
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
const mockedGetSetting = vi.mocked(getSetting)
const mockedSetSetting = vi.mocked(setSetting)

function renderAdminPage() {
  return render(
    <AdminAuthProvider>
      <AdminPage />
    </AdminAuthProvider>,
  )
}

function AuthStatusProbe() {
  const { isAdminUnlocked } = useAdminAuth()
  return <div>{isAdminUnlocked ? 'admin-unlocked' : 'admin-locked'}</div>
}

function AdminGateHarness() {
  return (
    <AdminAuthProvider>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminGate>
                <div>
                  <p>Admin Content</p>
                  <Link to="/sections">Leave Admin</Link>
                </div>
              </AdminGate>
            }
          />
          <Route
            path="/sections"
            element={
              <div>
                <p>More Route</p>
                <Link to="/admin">Open Admin</Link>
              </div>
            }
          />
          <Route path="/members" element={<div>Members Route</div>} />
        </Routes>
      </MemoryRouter>
    </AdminAuthProvider>
  )
}

beforeEach(async () => {
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

  settingsStore.clear()
  mockedGetSetting.mockImplementation(async (key: string) => settingsStore.get(key) ?? null)
  mockedSetSetting.mockImplementation(async (key: string, value: string) => {
    settingsStore.set(key, value)
  })
  await setAdminPassword('adminpass')
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
    renderAdminPage()

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
    renderAdminPage()

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

describe('Phase 6 admin password protection', () => {
  it('stores a random salt and salted SHA-256 hash instead of plaintext', async () => {
    settingsStore.clear()

    await expect(setAdminPassword('abc')).rejects.toThrow(
      'Admin password must be at least 4 characters.',
    )

    await setAdminPassword('secret1')

    const firstSalt = settingsStore.get(ADMIN_PASSWORD_SALT_KEY)
    const firstHash = settingsStore.get(ADMIN_PASSWORD_HASH_KEY)

    expect(firstSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(firstHash).toMatch(/^[0-9a-f]{64}$/)
    expect(firstHash).not.toContain('secret1')

    await expect(verifyAdminPassword('secret1')).resolves.toBe(true)
    await expect(verifyAdminPassword('wrong-secret')).resolves.toBe(false)

    await setAdminPassword('secret1')

    expect(settingsStore.get(ADMIN_PASSWORD_SALT_KEY)).not.toBe(firstSalt)
    expect(settingsStore.get(ADMIN_PASSWORD_HASH_KEY)).not.toBe(firstHash)
  })

  it('blocks first-time startup until an Admin password is saved and stays locked afterwards', async () => {
    settingsStore.clear()

    render(
      <AdminAuthProvider>
        <AuthStatusProbe />
      </AdminAuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Set Admin Password' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('admin-locked')).not.toBeInTheDocument()

    const passwordInput = screen.getByLabelText('New Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.change(passwordInput, { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Admin Password' }))

    expect(
      await screen.findByText('Password must be at least 4 characters.'),
    ).toBeInTheDocument()

    fireEvent.change(passwordInput, { target: { value: 'setup-pass' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'setup-pass' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Admin Password' }))
    })

    expect(await screen.findByText('admin-locked')).toBeInTheDocument()
    expect(settingsStore.get(ADMIN_PASSWORD_SALT_KEY)).toBeTruthy()
    expect(settingsStore.get(ADMIN_PASSWORD_HASH_KEY)).toBeTruthy()
    await expect(verifyAdminPassword('setup-pass')).resolves.toBe(true)
  })

  it('gates /admin, rejects wrong passwords, unlocks correctly, and re-locks on exit', async () => {
    render(<AdminGateHarness />)

    expect(
      await screen.findByRole('heading', { name: 'Admin Password Required' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByText('More Route')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Open Admin' }))
    expect(
      await screen.findByRole('heading', { name: 'Admin Password Required' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'wrong-password' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    })

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'adminpass' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    })

    expect(await screen.findByText('Admin Content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Leave Admin' }))
    expect(await screen.findByText('More Route')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Open Admin' }))
    expect(
      await screen.findByRole('heading', { name: 'Admin Password Required' }),
    ).toBeInTheDocument()
  })

  it('leaves non-Admin routes open without a password prompt', async () => {
    render(
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/members']}>
          <Routes>
            <Route path="/members" element={<div>Members Route</div>} />
          </Routes>
        </MemoryRouter>
      </AdminAuthProvider>,
    )

    expect(await screen.findByText('Members Route')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Admin Password Required' }),
    ).not.toBeInTheDocument()
  })

  it('changes the Admin password only with the current password', async () => {
    await expect(changeAdminPassword('wrong-password', 'new-pass')).rejects.toThrow(
      'Current password is incorrect.',
    )

    await changeAdminPassword('adminpass', 'new-pass')

    await expect(verifyAdminPassword('adminpass')).resolves.toBe(false)
    await expect(verifyAdminPassword('new-pass')).resolves.toBe(true)
  })

  it('exposes Lock Admin and Change Admin Password controls in AdminPage', async () => {
    renderAdminPage()

    await screen.findByRole('heading', { name: 'Create Profile' })

    expect(screen.getByRole('button', { name: 'Lock Admin' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'adminpass' },
    })
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'new-pass' },
    })
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'new-pass' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    })

    expect(await screen.findByText('Admin password changed.')).toBeInTheDocument()
    await expect(verifyAdminPassword('new-pass')).resolves.toBe(true)
  })
})

describe('Phase 6 repository hygiene', () => {
  it('has zero localStorage, sessionStorage, announcements, and Unicode emojis in src', () => {
    const files = collectSourceFiles(resolve(process.cwd(), 'src'))
    const emojiPattern = /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}]/u

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const content = readFileSync(file, 'utf8')

      expect(content, `Web storage found in ${file}`).not.toMatch(
        /localStorage|sessionStorage/,
      )
      expect(content, `Announcement feature found in ${file}`).not.toMatch(/announcement/i)
      expect(emojiPattern.test(content), `Emoji found in ${file}`).toBe(false)
    }
  })
})
