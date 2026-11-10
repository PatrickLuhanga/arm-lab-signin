import { appConfigDir, join } from '@tauri-apps/api/path'
import { save } from '@tauri-apps/plugin-dialog'
import { copyFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { roleLabel } from '../lib/format'
import { runExclusiveDatabaseTask } from './client'
import type {
  AttendanceEntry,
  EventGuest,
  EventGuestWithEvent,
  ProfileWithStats,
} from './types'

export const DATABASE_FILE_NAME = 'armlab.db'

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(','))
  return `${lines.join('\r\n')}\r\n`
}

function timePart(timestamp: string): string {
  const match = timestamp.match(/[T ](\d{2}:\d{2})/)
  return match ? match[1] : timestamp
}

export function buildDailyAttendanceCsv(rows: AttendanceEntry[]): string {
  return buildCsv(
    ['Time', 'Name', 'Student #', 'Role', 'Course'],
    rows.map((row) => [
      timePart(row.signed_in_at),
      row.full_name,
      row.student_number,
      roleLabel(row.role),
      row.course,
    ]),
  )
}

export function buildFullAttendanceSummaryCsv(rows: ProfileWithStats[]): string {
  return buildCsv(
    ['Name', 'Student #', 'Role', 'Course', 'Organization', 'Total Sign-Ins'],
    rows.map((row) => [
      row.full_name,
      row.student_number,
      roleLabel(row.role),
      row.course,
      row.organization,
      row.sign_in_count,
    ]),
  )
}

export function buildEventGuestsCsv(eventTitle: string, guests: EventGuest[]): string {
  return buildCsv(
    ['Event', 'Name', 'Organization', 'Contact', 'Signed in'],
    guests.map((guest) => [
      eventTitle,
      guest.full_name,
      guest.organization,
      guest.contact,
      guest.checked_in_at,
    ]),
  )
}

export function buildAllGuestsCsv(rows: EventGuestWithEvent[]): string {
  return buildCsv(
    ['Event', 'Event Status', 'Name', 'Organization', 'Contact', 'Signed in'],
    rows.map((row) => [
      row.event_title,
      row.event_status,
      row.full_name,
      row.organization,
      row.contact,
      row.checked_in_at,
    ]),
  )
}

export async function saveCsvFile(defaultFileName: string, csv: string): Promise<string | null> {
  const destination = await save({
    defaultPath: defaultFileName,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })

  if (!destination) {
    return null
  }

  await writeTextFile(destination, csv)
  return destination
}

export async function getDatabasePath(): Promise<string> {
  return join(await appConfigDir(), DATABASE_FILE_NAME)
}

export async function saveDatabaseBackup(
  defaultFileName = 'armlab-backup.db',
): Promise<string | null> {
  const destination = await save({
    defaultPath: defaultFileName,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  })

  if (!destination) {
    return null
  }

  // Hold the database queue while checkpointing and copying so the snapshot
  // cannot miss writes that are still sitting in armlab.db-wal.
  await runExclusiveDatabaseTask(async (db) => {
    await db.select<unknown[]>('PRAGMA wal_checkpoint(TRUNCATE)')
    const source = await getDatabasePath()
    await copyFile(source, destination)
  })

  return destination
}
