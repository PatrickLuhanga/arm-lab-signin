import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeaderboardEntry, Profile } from '../db/types'
import { getLeaderboard, signInStudent } from '../db/signIns'
import HomePage from '../pages/HomePage'
import LeaderboardPage from '../pages/LeaderboardPage'

vi.mock('../db/signIns', () => ({
  signInStudent: vi.fn(),
  getLeaderboard: vi.fn(),
}))

const mockedSignInStudent = vi.mocked(signInStudent)
const mockedGetLeaderboard = vi.mocked(getLeaderboard)

const memberProfile: Profile = {
  id: 1,
  student_number: '22000001',
  full_name: 'Anele Mokoena',
  role: 'arm_member',
  course: 'Electronic Engineering',
  organization: null,
  created_at: '2026-11-01 08:00:00',
}

const internProfile: Profile = {
  id: 2,
  student_number: '22000002',
  full_name: 'Thandi Mahlangu',
  role: 'intern',
  course: 'Computer Systems Engineering',
  organization: 'DUT Arm Lab',
  created_at: '2026-11-01 08:00:00',
}

function enterStudentNumber(value: string) {
  for (const digit of value) {
    fireEvent.click(screen.getByRole('button', { name: digit }))
  }
}

describe('Phase 3 Home daily register', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedSignInStudent.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('supports numpad entry, DEL, CLR, SIGN IN NOW, and the four-second reset', async () => {
    mockedSignInStudent.mockResolvedValue({
      status: 'signed_in',
      profile: memberProfile,
      signedInAt: '2026-11-10 09:15:00',
    })

    render(<HomePage />)

    const input = screen.getByLabelText('Student Number') as HTMLInputElement

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'DEL' }))
    expect(input.value).toBe('22')

    fireEvent.click(screen.getByRole('button', { name: 'CLR' }))
    expect(input.value).toBe('')

    enterStudentNumber('22000001')
    expect(input.value).toBe('22000001')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SIGN IN NOW' }))
    })

    expect(mockedSignInStudent).toHaveBeenCalledWith('22000001')
    expect(
      screen.getByText('Welcome, Anele Mokoena -- Signed in at 09:15 (Arm Member)'),
    ).toBeInTheDocument()
    expect(input.value).toBe('22000001')

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(input.value).toBe('')
    expect(screen.queryByText(/Welcome, Anele Mokoena/)).not.toBeInTheDocument()
  })

  it('submits with the physical keyboard Enter key', async () => {
    mockedSignInStudent.mockResolvedValue({
      status: 'signed_in',
      profile: internProfile,
      signedInAt: '2026-11-10 09:30:00',
    })

    render(<HomePage />)

    const input = screen.getByLabelText('Student Number')
    fireEvent.change(input, { target: { value: '22000002' } })

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(mockedSignInStudent).toHaveBeenCalledWith('22000002')
    expect(
      screen.getByText('Welcome, Thandi Mahlangu -- Signed in at 09:30 (Intern)'),
    ).toBeInTheDocument()
  })

  it('shows the amber duplicate banner for a second same-day sign-in', async () => {
    mockedSignInStudent.mockResolvedValue({
      status: 'duplicate',
      profile: memberProfile,
      signedInAt: '2026-11-10 08:05:00',
    })

    render(<HomePage />)
    enterStudentNumber('22000001')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SIGN IN NOW' }))
    })

    expect(
      screen.getByText(
        'Already signed in today at 08:05. Have a productive session, Anele Mokoena.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the red not-found banner for an unregistered student number', async () => {
    mockedSignInStudent.mockResolvedValue({ status: 'not_found', studentNumber: '99999999' })

    render(<HomePage />)
    enterStudentNumber('99999999')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SIGN IN NOW' }))
    })

    expect(
      screen.getByText(
        'Profile not found for "99999999". Please contact an Admin to create your profile.',
      ),
    ).toBeInTheDocument()
  })
})

describe('Phase 3 combined leaderboard', () => {
  const allTimeEntries: LeaderboardEntry[] = [
    {
      rank: 1,
      profile_id: 1,
      full_name: 'Anele Mokoena',
      course: 'Electronic Engineering',
      role: 'arm_member',
      sign_in_count: 2,
    },
    {
      rank: 2,
      profile_id: 2,
      full_name: 'Thandi Mahlangu',
      course: 'Computer Systems Engineering',
      role: 'intern',
      sign_in_count: 1,
    },
  ]

  beforeEach(() => {
    vi.useRealTimers()
    mockedGetLeaderboard.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders all four periods in order and filters out zero-count profiles', async () => {
    const entriesByPeriod: Record<string, LeaderboardEntry[]> = {
      today: [{ ...allTimeEntries[0], rank: 1, sign_in_count: 1 }],
      week: [
        { ...allTimeEntries[0], rank: 1, sign_in_count: 2 },
        { ...allTimeEntries[1], rank: 2, sign_in_count: 1 },
      ],
      month: [
        { ...allTimeEntries[1], rank: 1, sign_in_count: 1 },
        { ...allTimeEntries[0], rank: 2, sign_in_count: 0 },
      ],
      all: allTimeEntries,
    }

    mockedGetLeaderboard.mockImplementation(
      async (period = 'all') => entriesByPeriod[period] ?? [],
    )

    render(<LeaderboardPage />)

    expect(await screen.findByText('Anele Mokoena')).toBeInTheDocument()
    expect(screen.getByText('Thandi Mahlangu')).toBeInTheDocument()
    expect(screen.getByText('Arm Member')).toBeInTheDocument()
    expect(screen.getByText('Intern')).toBeInTheDocument()
    expect(screen.getByText('2 days')).toBeInTheDocument()
    expect(screen.getByText('1 day')).toBeInTheDocument()
    expect(mockedGetLeaderboard).toHaveBeenCalledWith('all')

    const periodGroup = screen.getByRole('group', { name: 'Leaderboard period' })
    const periodButtons = within(periodGroup).getAllByRole('button')
    expect(periodButtons.map((button) => button.textContent)).toEqual([
      'Today',
      'This Week',
      'This Month',
      'All Time',
    ])

    fireEvent.click(within(periodGroup).getByRole('button', { name: 'Today' }))
    await waitFor(() => {
      expect(mockedGetLeaderboard).toHaveBeenCalledWith('today')
    })
    await waitFor(() => {
      expect(screen.getByText('1 day')).toBeInTheDocument()
    })

    fireEvent.click(within(periodGroup).getByRole('button', { name: 'This Week' }))
    await waitFor(() => {
      expect(mockedGetLeaderboard).toHaveBeenCalledWith('week')
    })

    fireEvent.click(within(periodGroup).getByRole('button', { name: 'This Month' }))
    await waitFor(() => {
      expect(mockedGetLeaderboard).toHaveBeenCalledWith('month')
    })
    await waitFor(() => {
      expect(screen.queryByText('Anele Mokoena')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Thandi Mahlangu')).toBeInTheDocument()

    fireEvent.click(within(periodGroup).getByRole('button', { name: 'All Time' }))
    await waitFor(() => {
      expect(mockedGetLeaderboard).toHaveBeenCalledWith('all')
    })
    expect(await screen.findByText('Anele Mokoena')).toBeInTheDocument()
  })

  it('shows a period-specific empty state when no sign-ins match', async () => {
    mockedGetLeaderboard.mockResolvedValue([])

    render(<LeaderboardPage />)

    expect(await screen.findByText('No sign-ins recorded yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))

    expect(await screen.findByText('No sign-ins recorded today.')).toBeInTheDocument()
  })
})
