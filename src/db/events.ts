import { getDb } from './client'
import { NotFoundError, ValidationError } from './errors'
import type {
  CreateEventInput,
  EventGuest,
  EventGuestWithEvent,
  EventRecord,
  EventWithGuestCount,
  GuestInput,
  UpdateEventInput,
} from './types'
import { optionalText, requireText } from './validation'

const EVENT_WITH_COUNT_SELECT = `
  SELECT
    e.*,
    (SELECT COUNT(*) FROM event_guests g WHERE g.event_id = e.id) AS guest_count
  FROM events e
`

export async function createEvent(input: CreateEventInput): Promise<EventWithGuestCount> {
  const title = requireText(input.title, 'Event name')
  const coordinators = optionalText(input.coordinators)
  const description = optionalText(input.description)
  const status = input.status

  if (status !== 'active' && status !== 'scheduled') {
    throw new ValidationError('New events must be active or scheduled.')
  }

  const db = await getDb()
  const result = await db.execute(
    'INSERT INTO events (title, description, coordinators, status) VALUES (?, ?, ?, ?)',
    [title, description, coordinators, status],
  )

  const eventId = result.lastInsertId

  if (!eventId) {
    throw new Error('The event could not be created.')
  }

  const event = await getEvent(eventId)

  if (!event) {
    throw new Error('The event could not be loaded after creation.')
  }

  return event
}

export async function updateEvent(
  eventId: number,
  input: UpdateEventInput,
): Promise<EventWithGuestCount> {
  const title = requireText(input.title, 'Event name')
  const coordinators = optionalText(input.coordinators)
  const description = optionalText(input.description)
  const db = await getDb()
  const result = await db.execute(
    'UPDATE events SET title = ?, coordinators = ?, description = ? WHERE id = ?',
    [title, coordinators, description, eventId],
  )

  if (result.rowsAffected === 0) {
    throw new NotFoundError('Event not found.')
  }

  const event = await getEvent(eventId)

  if (!event) {
    throw new NotFoundError('Event not found.')
  }

  return event
}

export async function getEvent(eventId: number): Promise<EventWithGuestCount | null> {
  const db = await getDb()
  const rows = await db.select<EventWithGuestCount[]>(
    `${EVENT_WITH_COUNT_SELECT} WHERE e.id = ? LIMIT 1`,
    [eventId],
  )

  return rows[0] ?? null
}

export async function listEvents(): Promise<EventWithGuestCount[]> {
  const db = await getDb()

  return db.select<EventWithGuestCount[]>(
    `${EVENT_WITH_COUNT_SELECT}
     ORDER BY
       CASE e.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
       e.created_at DESC,
       e.id DESC`,
  )
}

export async function activateEvent(eventId: number): Promise<EventWithGuestCount> {
  const existing = await getEvent(eventId)

  if (!existing) {
    throw new NotFoundError('Event not found.')
  }

  if (existing.status === 'ended') {
    throw new ValidationError('Ended events cannot be activated again.')
  }

  const db = await getDb()
  await db.execute("UPDATE events SET status = 'active' WHERE id = ?", [eventId])

  const event = await getEvent(eventId)

  if (!event) {
    throw new NotFoundError('Event not found.')
  }

  return event
}

export async function endEvent(eventId: number): Promise<EventWithGuestCount> {
  const existing = await getEvent(eventId)

  if (!existing) {
    throw new NotFoundError('Event not found.')
  }

  const db = await getDb()
  await db.execute("UPDATE events SET status = 'ended' WHERE id = ?", [eventId])

  const event = await getEvent(eventId)

  if (!event) {
    throw new NotFoundError('Event not found.')
  }

  return event
}

export async function deleteEvent(eventId: number): Promise<void> {
  const db = await getDb()
  const result = await db.execute('DELETE FROM events WHERE id = ?', [eventId])

  if (result.rowsAffected === 0) {
    throw new NotFoundError('Event not found.')
  }
}

export async function addGuest(eventId: number, input: GuestInput): Promise<EventGuest> {
  const fullName = requireText(input.fullName, 'Guest name')
  const organization = optionalText(input.organization)
  const contact = optionalText(input.contact)
  const event = await getEvent(eventId)

  if (!event) {
    throw new NotFoundError('Event not found.')
  }

  if (event.status === 'ended') {
    throw new ValidationError('Guest sign-in is closed for ended events.')
  }

  const db = await getDb()
  const result = await db.execute(
    'INSERT INTO event_guests (event_id, full_name, organization, contact) VALUES (?, ?, ?, ?)',
    [eventId, fullName, organization, contact],
  )

  const guestId = result.lastInsertId

  if (!guestId) {
    throw new Error('The guest could not be checked in.')
  }

  const rows = await db.select<EventGuest[]>('SELECT * FROM event_guests WHERE id = ? LIMIT 1', [
    guestId,
  ])

  const guest = rows[0]

  if (!guest) {
    throw new Error('The guest could not be loaded after check-in.')
  }

  return guest
}

export async function updateGuest(guestId: number, input: GuestInput): Promise<EventGuest> {
  const fullName = requireText(input.fullName, 'Guest name')
  const organization = optionalText(input.organization)
  const contact = optionalText(input.contact)
  const db = await getDb()
  const result = await db.execute(
    'UPDATE event_guests SET full_name = ?, organization = ?, contact = ? WHERE id = ?',
    [fullName, organization, contact, guestId],
  )

  if (result.rowsAffected === 0) {
    throw new NotFoundError('Guest not found.')
  }

  const rows = await db.select<EventGuest[]>('SELECT * FROM event_guests WHERE id = ? LIMIT 1', [
    guestId,
  ])

  const guest = rows[0]

  if (!guest) {
    throw new NotFoundError('Guest not found.')
  }

  return guest
}

export async function deleteGuest(guestId: number): Promise<void> {
  const db = await getDb()
  const result = await db.execute('DELETE FROM event_guests WHERE id = ?', [guestId])

  if (result.rowsAffected === 0) {
    throw new NotFoundError('Guest not found.')
  }
}

export async function listGuests(eventId: number, search = ''): Promise<EventGuest[]> {
  const db = await getDb()
  const term = search.trim()

  if (term.length === 0) {
    return db.select<EventGuest[]>(
      'SELECT * FROM event_guests WHERE event_id = ? ORDER BY checked_in_at DESC, id DESC',
      [eventId],
    )
  }

  const likeTerm = `%${term}%`

  return db.select<EventGuest[]>(
    `SELECT * FROM event_guests
     WHERE event_id = ?
       AND (full_name LIKE ? OR organization LIKE ? OR contact LIKE ?)
     ORDER BY checked_in_at DESC, id DESC`,
    [eventId, likeTerm, likeTerm, likeTerm],
  )
}

export async function countGuests(eventId: number): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ total: number }[]>(
    'SELECT COUNT(*) AS total FROM event_guests WHERE event_id = ?',
    [eventId],
  )

  return Number(rows[0]?.total ?? 0)
}

export async function countActiveEvents(): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ total: number }[]>(
    "SELECT COUNT(*) AS total FROM events WHERE status = 'active'",
  )

  return Number(rows[0]?.total ?? 0)
}

export async function listAllGuestsWithEvents(): Promise<EventGuestWithEvent[]> {
  const db = await getDb()

  return db.select<EventGuestWithEvent[]>(
    `SELECT
       g.*,
       e.title AS event_title,
       e.status AS event_status
     FROM event_guests g
     JOIN events e ON e.id = g.event_id
     ORDER BY g.checked_in_at DESC, g.id DESC`,
  )
}

export async function getEventRecord(eventId: number): Promise<EventRecord | null> {
  const db = await getDb()
  const rows = await db.select<EventRecord[]>('SELECT * FROM events WHERE id = ? LIMIT 1', [
    eventId,
  ])

  return rows[0] ?? null
}
