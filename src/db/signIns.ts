import { getDb } from './client'
import { ValidationError } from './errors'
import type {
  AttendanceEntry,
  LeaderboardEntry,
  LeaderboardPeriod,
  Profile,
  Role,
  SignIn,
  SignInOutcome,
} from './types'
import { isUniqueConstraintError } from './validation'

interface LeaderboardRow {
  profile_id: number
  full_name: string
  course: string
  role: Role
  sign_in_count: number
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toLocalDateTimeString(date: Date = new Date()): string {
  const datePart = toLocalDateString(date)
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${datePart} ${timePart}`
}

function startOfWeek(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export interface LeaderboardRange {
  start: string
  end: string
}

export function getLeaderboardRange(
  period: LeaderboardPeriod,
  now: Date = new Date(),
): LeaderboardRange | null {
  if (period === 'all') {
    return null
  }

  if (period === 'today') {
    const today = toLocalDateString(now)
    return { start: today, end: today }
  }

  if (period === 'week') {
    const monday = startOfWeek(now)
    return { start: toLocalDateString(monday), end: toLocalDateString(addDays(monday, 6)) }
  }

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return { start: toLocalDateString(firstOfMonth), end: toLocalDateString(lastOfMonth) }
}

export async function signInStudent(
  studentNumber: string,
  now: Date = new Date(),
): Promise<SignInOutcome> {
  const trimmedStudentNumber = (studentNumber ?? '').trim()

  if (trimmedStudentNumber.length === 0) {
    throw new ValidationError('Student number is required.')
  }

  const db = await getDb()
  const profileRows = await db.select<Profile[]>(
    'SELECT * FROM profiles WHERE student_number = ? LIMIT 1',
    [trimmedStudentNumber],
  )

  const profile = profileRows[0]

  if (!profile) {
    return { status: 'not_found', studentNumber: trimmedStudentNumber }
  }

  const signInDate = toLocalDateString(now)
  const existingRows = await db.select<{ signed_in_at: string }[]>(
    'SELECT signed_in_at FROM sign_ins WHERE profile_id = ? AND sign_in_date = ? LIMIT 1',
    [profile.id, signInDate],
  )

  if (existingRows.length > 0) {
    return { status: 'duplicate', profile, signedInAt: existingRows[0].signed_in_at }
  }

  const signedInAt = toLocalDateTimeString(now)

  try {
    await db.execute(
      'INSERT INTO sign_ins (profile_id, sign_in_date, signed_in_at) VALUES (?, ?, ?)',
      [profile.id, signInDate, signedInAt],
    )

    return { status: 'signed_in', profile, signedInAt }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedRows = await db.select<{ signed_in_at: string }[]>(
        'SELECT signed_in_at FROM sign_ins WHERE profile_id = ? AND sign_in_date = ? LIMIT 1',
        [profile.id, signInDate],
      )

      if (racedRows.length > 0) {
        return { status: 'duplicate', profile, signedInAt: racedRows[0].signed_in_at }
      }
    }

    throw error
  }
}

export async function getLeaderboard(
  period: LeaderboardPeriod = 'all',
  now: Date = new Date(),
): Promise<LeaderboardEntry[]> {
  const db = await getDb()
  const selectedColumns = `
    p.id AS profile_id,
    p.full_name,
    p.course,
    p.role,
    COUNT(s.id) AS sign_in_count
  `

  const range = getLeaderboardRange(period, now)

  const rows = range
    ? await db.select<LeaderboardRow[]>(
        `SELECT ${selectedColumns}
         FROM profiles p
         JOIN sign_ins s ON s.profile_id = p.id
           AND s.sign_in_date >= ?
           AND s.sign_in_date <= ?
         GROUP BY p.id
         ORDER BY sign_in_count DESC, p.full_name COLLATE NOCASE ASC`,
        [range.start, range.end],
      )
    : await db.select<LeaderboardRow[]>(
        `SELECT ${selectedColumns}
         FROM profiles p
         JOIN sign_ins s ON s.profile_id = p.id
         GROUP BY p.id
         ORDER BY sign_in_count DESC, p.full_name COLLATE NOCASE ASC`,
      )

  return rows.map((row, index) => ({
    rank: index + 1,
    profile_id: row.profile_id,
    full_name: row.full_name,
    course: row.course,
    role: row.role,
    sign_in_count: row.sign_in_count,
  }))
}

export async function getAttendanceForDate(date: string): Promise<AttendanceEntry[]> {
  const db = await getDb()

  return db.select<AttendanceEntry[]>(
    `SELECT
       s.id,
       s.profile_id,
       s.sign_in_date,
       s.signed_in_at,
       p.full_name,
       p.student_number,
       p.role,
       p.course
     FROM sign_ins s
     JOIN profiles p ON p.id = s.profile_id
     WHERE s.sign_in_date = ?
     ORDER BY s.signed_in_at ASC, s.id ASC`,
    [date],
  )
}

export async function getRecentSignIns(profileId: number, limit = 20): Promise<SignIn[]> {
  const db = await getDb()

  return db.select<SignIn[]>(
    'SELECT * FROM sign_ins WHERE profile_id = ? ORDER BY signed_in_at DESC, id DESC LIMIT ?',
    [profileId, limit],
  )
}

export async function countSignInsForProfile(profileId: number): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ total: number }[]>(
    'SELECT COUNT(*) AS total FROM sign_ins WHERE profile_id = ?',
    [profileId],
  )

  return Number(rows[0]?.total ?? 0)
}

export async function countSignInsForDate(date: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ total: number }[]>(
    'SELECT COUNT(*) AS total FROM sign_ins WHERE sign_in_date = ?',
    [date],
  )

  return Number(rows[0]?.total ?? 0)
}
