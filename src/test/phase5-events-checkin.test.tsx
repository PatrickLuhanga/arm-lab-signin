import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateEvent,
  addGuest,
  createEvent,
  deleteEvent,
  deleteGuest,
  endEvent,
  getEvent,
  listAllGuestsWithEvents,
  listEvents,
  listGuests,
  updateEvent,
  updateGuest,
} from '../db/events'
import { buildAllGuestsCsv, buildEventGuestsCsv, saveCsvFile } from '../db/exports'
import type { EventGuest, EventWithGuestCount, GuestInput } from '../db/types'
import EventCheckInPage from '../pages/EventCheckInPage'
import EventsPage from '../pages/EventsPage'

const state = vi.hoisted(() => ({
  events: [] as any[],
  guests: {} as Record<number, any[]>,
  nextGuestId: 500,
}))

vi.mock('../db/events', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  getEvent: vi.fn(),
  listEvents: vi.fn(),
  activateEvent: vi.fn(),
  endEvent: vi.fn(),
  deleteEvent: vi.fn(),
  addGuest: vi.fn(),
  updateGuest: vi.fn(),
  deleteGuest: vi.fn(),
  listGuests: vi.fn(),
  listAllGuestsWithEvents: vi.fn(),
}))

vi.mock('../db/exports', () => ({
  buildEventGuestsCsv: vi.fn(),
  buildAllGuestsCsv: vi.fn(),
  saveCsvFile: vi.fn(),
}))

const mockedCreateEvent = vi.mocked(createEvent)
const mockedUpdateEvent = vi.mocked(updateEvent)
const mockedGetEvent = vi.mocked(getEvent)
const mockedListEvents = vi.mocked(listEvents)
const mockedActivateEvent = vi.mocked(activateEvent)
const mockedEndEvent = vi.mocked(endEvent)
const mockedDeleteEvent = vi.mocked(deleteEvent)
const mockedAddGuest = vi.mocked(addGuest)
const mockedUpdateGuest = vi.mocked(updateGuest)
const mockedDeleteGuest = vi.mocked(deleteGuest)
const mockedListGuests = vi.mocked(listGuests)
const mockedListAllGuestsWithEvents = vi.mocked(listAllGuestsWithEvents)
const mockedBuildEventGuestsCsv = vi.mocked(buildEventGuestsCsv)
const mockedBuildAllGuestsCsv = vi.mocked(buildAllGuestsCsv)
const mockedSaveCsvFile = vi.mocked(saveCsvFile)

function eventWithCount(event: Record<string, unknown>): EventWithGuestCount {
  return {
    ...event,
    guest_count: (state.guests[event.id as number] ?? []).length,
  } as EventWithGuestCount
}

function renderEvents() {
  return render(
    <MemoryRouter>
      <EventsPage />
    </MemoryRouter>,
  )
}

function renderCheckIn(eventId: number) {
  return render(
    <MemoryRouter initialEntries={[`/events/${eventId}/checkin`]}>
      <Routes>
        <Route path="/events/:id/checkin" element={<EventCheckInPage />} />
        <Route path="/events" element={<div>Events Route</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.events.length = 0
  state.nextGuestId = 500
  for (const key of Object.keys(state.guests)) {
    delete state.guests[Number(key)]
  }

  state.events.push(
    {
      id: 1,
      title: 'Robotics Demo',
      description: 'Live robotics showcase',
      coordinators: 'Dr Naidoo',
      status: 'active',
      created_at: '2026-11-01 08:00:00',
    },
    {
      id: 2,
      title: 'Open Day',
      description: 'Campus open day',
      coordinators: 'Sipho Dlamini',
      status: 'scheduled',
      created_at: '2026-11-02 08:00:00',
    },
    {
      id: 3,
      title: 'Past Workshop',
      description: null,
      coordinators: null,
      status: 'ended',
      created_at: '2026-10-01 08:00:00',
    },
  )

  state.guests[1] = [
    {
      id: 101,
      event_id: 1,
      full_name: 'Sipho Ndlovu',
      organization: 'DUT',
      contact: 'sipho@example.com',
      checked_in_at: '2026-11-10 09:00:00',
    },
  ]

  mockedListEvents.mockImplementation(async () => state.events.map(eventWithCount))

  mockedGetEvent.mockImplementation(async (eventId: number) => {
    const event = state.events.find((row) => row.id === eventId)
    return event ? eventWithCount(event) : null
  })

  mockedListGuests.mockImplementation(async (eventId: number, search = '') => {
    const query = search.trim().toLowerCase()
    const rows: EventGuest[] = (state.guests[eventId] ?? [])
      .filter(
        (guest) =>
          query.length === 0 ||
          guest.full_name.toLowerCase().includes(query) ||
          (guest.organization ?? '').toLowerCase().includes(query) ||
          (guest.contact ?? '').toLowerCase().includes(query),
      )
      .map((guest) => ({ ...guest }))

    return rows.sort((first, second) =>
      second.checked_in_at.localeCompare(first.checked_in_at),
    )
  })

  mockedAddGuest.mockImplementation(async (eventId: number, input: GuestInput) => {
    const guest: EventGuest = {
      id: state.nextGuestId++,
      event_id: eventId,
      full_name: input.fullName,
      organization: input.organization ?? null,
      contact: input.contact ?? null,
      checked_in_at: '2026-11-10 10:00:00',
    }

    ;(state.guests[eventId] ??= []).unshift(guest)
    return { ...guest }
  })

  mockedUpdateGuest.mockImplementation(async (guestId: number, input: GuestInput) => {
    for (const rows of Object.values(state.guests)) {
      const index = rows.findIndex((guest) => guest.id === guestId)

      if (index >= 0) {
        rows[index] = {
          ...rows[index],
          full_name: input.fullName,
          organization: input.organization ?? null,
          contact: input.contact ?? null,
        }

        return { ...rows[index] } as EventGuest
      }
    }

    throw new Error('Guest not found.')
  })

  mockedDeleteGuest.mockImplementation(async (guestId: number) => {
    for (const [eventId, rows] of Object.entries(state.guests)) {
      state.guests[Number(eventId)] = rows.filter((guest) => guest.id !== guestId)
    }
  })

  mockedListAllGuestsWithEvents.mockImplementation(async () =>
    Object.values(state.guests)
      .flat()
      .map((guest) => ({
        ...guest,
        event_title: 'Robotics Demo',
        event_status: 'active',
      })),
  )

  mockedBuildEventGuestsCsv.mockReturnValue('event-guests-csv')
  mockedBuildAllGuestsCsv.mockReturnValue('all-guests-csv')
  mockedSaveCsvFile.mockResolvedValue('C:/tmp/export.csv')

  mockedCreateEvent.mockResolvedValue(eventWithCount(state.events[0]))
  mockedUpdateEvent.mockResolvedValue(eventWithCount(state.events[0]))
  mockedActivateEvent.mockResolvedValue(eventWithCount(state.events[0]))
  mockedEndEvent.mockResolvedValue(eventWithCount(state.events[2]))
  mockedDeleteEvent.mockResolvedValue(undefined)
})

describe('Phase 5 events hub', () => {
  it('orders the action bar, active/scheduled events, then previous events', async () => {
    renderEvents()

    await screen.findByText('Active Events')
    await screen.findByText('Scheduled Events')
    await screen.findByText('Previous Events')

    const actionBar = screen.getByTestId('events-action-bar')
    const middle = screen.getByTestId('events-active-scheduled')
    const previous = screen.getByTestId('events-previous')

    expect(
      actionBar.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      middle.compareDocumentPosition(previous) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(screen.getByText('Create / Schedule Event')).toBeInTheDocument()
    expect(screen.getByText('Export All Guests CSV')).toBeInTheDocument()
    expect(screen.getByText('Past Workshop')).toBeInTheDocument()
    expect(screen.getByText('View Roster')).toBeInTheDocument()
  })

  it('blocks guest sign-in for ended events', async () => {
    renderCheckIn(3)

    expect(
      await screen.findByText('This event has ended — guest sign-in is closed'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument()
  })
})

describe('Phase 5 event check-in', () => {
  it('clears the form, prepends the guest with initials, filters rows, and confirms removal', async () => {
    renderCheckIn(1)

    await screen.findByRole('heading', { name: 'Robotics Demo' })

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'More' })).toHaveAttribute(
      'href',
      '/sections',
    )
    expect(within(breadcrumb).getByRole('link', { name: 'Events' })).toHaveAttribute(
      'href',
      '/events',
    )
    expect(within(breadcrumb).getByText('Robotics Demo')).toBeInTheDocument()

    const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement
    const organizationInput = screen.getByLabelText('Organization / Affiliation') as HTMLInputElement
    const contactInput = screen.getByLabelText('Contact (Email or Phone)') as HTMLInputElement

    fireEvent.change(nameInput, { target: { value: 'Thandi Mahlangu' } })
    fireEvent.change(organizationInput, { target: { value: 'DUT' } })
    fireEvent.change(contactInput, { target: { value: 'thandi@example.com' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'CHECK IN AS GUEST' }))
    })

    expect(mockedAddGuest).toHaveBeenCalledWith(1, {
      fullName: 'Thandi Mahlangu',
      organization: 'DUT',
      contact: 'thandi@example.com',
    })

    expect(nameInput.value).toBe('')
    expect(organizationInput.value).toBe('')
    expect(contactInput.value).toBe('')
    expect(screen.getByRole('heading', { name: 'Robotics Demo' })).toBeInTheDocument()

    const rows = screen.getAllByTestId('guest-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Thandi Mahlangu')).toBeInTheDocument()
    expect(within(rows[0]).getByTestId('guest-initials')).toHaveTextContent('TM')

    const search = screen.getByLabelText('Search guests')
    fireEvent.change(search, { target: { value: 'Sipho' } })
    expect(screen.getAllByTestId('guest-row')).toHaveLength(1)
    expect(screen.getByText('Sipho Ndlovu')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Thandi Mahlangu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Entry' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Remove guest?')).toBeInTheDocument()
    expect(mockedDeleteGuest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Guest' }))

    await waitFor(() => {
      expect(mockedDeleteGuest).toHaveBeenCalledWith(500)
    })

    await waitFor(() => {
      expect(screen.getAllByTestId('guest-row')).toHaveLength(1)
    })
  })

  it('exports the current event roster and clears the three-second confirmation', async () => {
    vi.useFakeTimers()

    try {
      renderCheckIn(1)
      await act(async () => {
        await Promise.resolve()
      })

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Lerato Dlamini' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'CHECK IN AS GUEST' }))
      })

      expect(screen.getByText('Guest checked in.')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.queryByText('Guest checked in.')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Export' }))

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockedBuildEventGuestsCsv).toHaveBeenCalled()
      expect(mockedSaveCsvFile).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
