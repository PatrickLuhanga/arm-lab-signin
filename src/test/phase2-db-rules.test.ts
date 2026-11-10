import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../db/errors'
import { addGuest, createEvent, deleteGuest, endEvent, listGuests, updateGuest } from '../db/events'
import { buildCsv, buildDailyAttendanceCsv, escapeCsvValue } from '../db/exports'
import {
  addProject,
  createProfile,
  deleteProject,
  listProfiles,
  listProjects,
} from '../db/profiles'
import {
  getAttendanceForDate,
  getLeaderboard,
  signInStudent,
  toLocalDateTimeString,
} from '../db/signIns'

interface TestAdapter {
  select<T>(query: string, params?: unknown[]): Promise<T>
  execute(
    query: string,
    params?: unknown[],
  ): Promise<{ lastInsertId?: number; rowsAffected: number }>
}

const state = vi.hoisted(() => ({
  adapter: null as TestAdapter | null,
}))

vi.mock('../db/client', () => ({
  getDb: async () => {
    if (!state.adapter) {
      throw new Error('Test database is not initialized.')
    }
    return state.adapter
  },
  withTransaction: async (work: (db: TestAdapter) => Promise<unknown>) => {
    if (!state.adapter) {
      throw new Error('Test database is not initialized.')
    }

    await state.adapter.execute('BEGIN')

    try {
      const result = await work(state.adapter)
      await state.adapter.execute('COMMIT')
      return result
    } catch (error) {
      await state.adapter.execute('ROLLBACK')
      throw error
    }
  },
  runExclusiveDatabaseTask: async (work: (db: TestAdapter) => Promise<unknown>) => {
    if (!state.adapter) {
      throw new Error('Test database is not initialized.')
    }

    return work(state.adapter)
  },
}))

function createAdapter(db: SqlJsDatabase): TestAdapter {
  return {
    async select<T>(query: string, params: unknown[] = []): Promise<T> {
      const statement = db.prepare(query)

      try {
        if (params.length > 0) {
          statement.bind(params as never[])
        }

        const rows: Record<string, unknown>[] = []

        while (statement.step()) {
          rows.push(statement.getAsObject() as Record<string, unknown>)
        }

        return rows as T
      } finally {
        statement.free()
      }
    },
    async execute(query: string, params: unknown[] = []) {
      db.run(query, params as never[])
      const rowsAffected = db.getRowsModified()
      const result = db.exec('SELECT last_insert_rowid() AS id')
      const lastInsertId = Number(result[0]?.values[0]?.[0] ?? 0)

      return { lastInsertId, rowsAffected }
    },
  }
}

const schemaSql = readFileSync(
  resolve(process.cwd(), 'src-tauri/migrations/0001_init.sql'),
  'utf8',
)

let SQL: SqlJsStatic
let db: SqlJsDatabase

beforeAll(async () => {
  const wasmBinary = readFileSync(
    resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
  )
  const wasmArrayBuffer = wasmBinary.buffer.slice(
    wasmBinary.byteOffset,
    wasmBinary.byteOffset + wasmBinary.byteLength,
  ) as ArrayBuffer

  SQL = await initSqlJs({ wasmBinary: wasmArrayBuffer })
})

beforeEach(() => {
  db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  db.run(schemaSql)
  state.adapter = createAdapter(db)
})

afterEach(() => {
  state.adapter = null
  db.close()
})

const memberInput = {
  role: 'arm_member' as const,
  fullName: 'Anele Mokoena',
  studentNumber: '22000001',
  course: 'Electronic Engineering',
  initialProject: { title: 'RISC-V Sensor Node', description: 'Low power telemetry board' },
}

const internInput = {
  role: 'intern' as const,
  fullName: 'Thandi Mahlangu',
  studentNumber: '22000002',
  course: 'Computer Systems Engineering',
  organization: 'DUT Arm Lab',
}

describe('Phase 2 profile rules', () => {
  it('rejects an Arm Member with no initial project', async () => {
    await expect(
      createProfile({
        ...memberInput,
        initialProject: { title: '   ' },
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(await listProfiles()).toHaveLength(0)
  })

  it('rejects an Intern without an organization', async () => {
    await expect(
      createProfile({
        ...internInput,
        organization: '   ',
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(await listProfiles()).toHaveLength(0)
  })

  it('creates an Arm Member together with its first project', async () => {
    const member = await createProfile(memberInput)
    const projects = await listProjects(member.id)
    const profiles = await listProfiles()

    expect(member.role).toBe('arm_member')
    expect(member.organization).toBeNull()
    expect(projects).toHaveLength(1)
    expect(projects[0].title).toBe('RISC-V Sensor Node')
    expect(profiles[0]).toMatchObject({ project_count: 1, sign_in_count: 0 })
  })

  it('blocks deleting an Arm Member last remaining project', async () => {
    const member = await createProfile(memberInput)
    const [firstProject] = await listProjects(member.id)

    await expect(deleteProject(member.id, firstProject.id)).rejects.toThrow(
      'At least 1 project required.',
    )
    expect(await listProjects(member.id)).toHaveLength(1)

    const secondProject = await addProject(member.id, { title: 'Second Project' })
    await deleteProject(member.id, firstProject.id)

    expect(await listProjects(member.id)).toHaveLength(1)
    await expect(deleteProject(member.id, secondProject.id)).rejects.toThrow(
      'At least 1 project required.',
    )
  })

  it('rejects duplicate student numbers', async () => {
    await createProfile(memberInput)

    await expect(
      createProfile({
        ...internInput,
        studentNumber: memberInput.studentNumber,
      }),
    ).rejects.toThrow('A profile with this student number already exists.')
  })
})

describe('Phase 2 sign-in rules', () => {
  it('records only one sign-in per profile per local day and returns the existing time', async () => {
    const intern = await createProfile(internInput)
    const firstMoment = new Date(2026, 10, 10, 9, 15, 0)
    const secondMoment = new Date(2026, 10, 10, 16, 40, 0)

    const first = await signInStudent(intern.student_number, firstMoment)
    const duplicate = await signInStudent(intern.student_number, secondMoment)

    expect(first.status).toBe('signed_in')

    if (first.status !== 'signed_in') {
      throw new Error('Expected the first sign-in to be recorded.')
    }

    expect(duplicate.status).toBe('duplicate')

    if (duplicate.status !== 'duplicate') {
      throw new Error('Expected the second sign-in to be a duplicate.')
    }

    expect(duplicate.signedInAt).toBe(toLocalDateTimeString(firstMoment))
    expect(await getAttendanceForDate('2026-11-10')).toHaveLength(1)

    const nextDay = await signInStudent(intern.student_number, new Date(2026, 10, 11, 8, 0, 0))
    expect(nextDay.status).toBe('signed_in')
    expect(await getAttendanceForDate('2026-11-11')).toHaveLength(1)
  })

  it('returns not_found for unknown student numbers', async () => {
    const outcome = await signInStudent('99999999', new Date(2026, 10, 10, 9, 0, 0))

    expect(outcome).toEqual({ status: 'not_found', studentNumber: '99999999' })
  })

  it('ranks combined profiles across today, Monday-start week, month, and all time', async () => {
    const member = await createProfile(memberInput)
    const intern = await createProfile(internInput)
    const now = new Date(2026, 10, 11, 12, 0, 0)

    // Wednesday 11 Nov 2026. The current week is Mon 9 Nov to Sun 15 Nov.
    await signInStudent(member.student_number, new Date(2026, 10, 11, 9, 0, 0))
    await signInStudent(member.student_number, new Date(2026, 10, 9, 9, 0, 0))
    await signInStudent(member.student_number, new Date(2026, 10, 8, 9, 0, 0))
    await signInStudent(member.student_number, new Date(2026, 9, 31, 9, 0, 0))
    await signInStudent(intern.student_number, new Date(2026, 10, 10, 9, 0, 0))
    await signInStudent(intern.student_number, new Date(2026, 8, 15, 9, 0, 0))

    const today = await getLeaderboard('today', now)
    expect(today).toHaveLength(1)
    expect(today[0]).toMatchObject({
      rank: 1,
      full_name: 'Anele Mokoena',
      role: 'arm_member',
      sign_in_count: 1,
    })

    const week = await getLeaderboard('week', now)
    expect(week).toHaveLength(2)
    expect(week[0]).toMatchObject({
      rank: 1,
      full_name: 'Anele Mokoena',
      sign_in_count: 2,
    })
    expect(week[1]).toMatchObject({
      rank: 2,
      full_name: 'Thandi Mahlangu',
      sign_in_count: 1,
    })

    const month = await getLeaderboard('month', now)
    expect(month).toHaveLength(2)
    expect(month[0].sign_in_count).toBe(3)
    expect(month[1].sign_in_count).toBe(1)

    const allTime = await getLeaderboard('all', now)
    expect(allTime).toHaveLength(2)
    expect(allTime[0]).toMatchObject({
      rank: 1,
      full_name: 'Anele Mokoena',
      role: 'arm_member',
      sign_in_count: 4,
    })
    expect(allTime[1]).toMatchObject({
      rank: 2,
      full_name: 'Thandi Mahlangu',
      role: 'intern',
      sign_in_count: 2,
    })

    const emptyToday = await getLeaderboard('today', new Date(2027, 0, 15, 12, 0, 0))
    const emptyWeek = await getLeaderboard('week', new Date(2027, 0, 15, 12, 0, 0))
    const emptyMonth = await getLeaderboard('month', new Date(2027, 0, 15, 12, 0, 0))
    expect(emptyToday).toHaveLength(0)
    expect(emptyWeek).toHaveLength(0)
    expect(emptyMonth).toHaveLength(0)
  })
})

describe('Phase 2 CSV escaping', () => {
  it('applies RFC-4180 escaping to commas, quotes and newlines', () => {
    expect(escapeCsvValue('plain')).toBe('plain')
    expect(escapeCsvValue('Doe, Jane')).toBe('"Doe, Jane"')
    expect(escapeCsvValue('He said "hi"')).toBe('"He said ""hi"""')
    expect(escapeCsvValue('line\nbreak')).toBe('"line\nbreak"')
    expect(escapeCsvValue(null)).toBe('')
  })

  it('builds a valid CSV document with CRLF row endings', () => {
    expect(buildCsv(['Name', 'Note'], [['Doe, Jane', 'He said "hi"\nthen left']])).toBe(
      'Name,Note\r\n"Doe, Jane","He said ""hi""\nthen left"\r\n',
    )
  })

  it('builds the daily attendance CSV with role labels', async () => {
    const intern = await createProfile(internInput)
    await signInStudent(intern.student_number, new Date(2026, 10, 10, 9, 15, 0))

    const csv = buildDailyAttendanceCsv(await getAttendanceForDate('2026-11-10'))
    const [header, row] = csv.split('\r\n')

    expect(header).toBe('Time,Name,Student #,Role,Course')
    expect(row).toBe('09:15,Thandi Mahlangu,22000002,Intern,Computer Systems Engineering')
  })
})

describe('Phase 2 event rules', () => {
  it('checks in guests, edits them, and blocks sign-in once the event ends', async () => {
    const event = await createEvent({ title: 'Robotics Demo', status: 'active' })
    const guest = await addGuest(event.id, {
      fullName: 'Sipho Ndlovu',
      organization: 'DUT',
      contact: 'sipho@example.com',
    })

    expect(guest.organization).toBe('DUT')
    expect(await listGuests(event.id)).toHaveLength(1)

    const updated = await updateGuest(guest.id, {
      fullName: 'Sipho N.',
      organization: 'DUT Arm Lab',
    })
    expect(updated.full_name).toBe('Sipho N.')

    await endEvent(event.id)

    await expect(addGuest(event.id, { fullName: 'Late Guest' })).rejects.toThrow(
      'Guest sign-in is closed for ended events.',
    )

    await deleteGuest(guest.id)
    expect(await listGuests(event.id)).toHaveLength(0)
  })

  it('filters the guest list by name, organization or contact', async () => {
    const event = await createEvent({ title: 'Open Day', status: 'active' })
    await addGuest(event.id, {
      fullName: 'Lerato Dlamini',
      organization: 'DUT',
      contact: 'lerato@example.com',
    })
    await addGuest(event.id, {
      fullName: 'Kyle Naidoo',
      organization: 'UKZN',
      contact: 'kyle@example.com',
    })

    expect(await listGuests(event.id, 'Lerato')).toHaveLength(1)
    expect(await listGuests(event.id, 'UKZN')).toHaveLength(1)
    expect(await listGuests(event.id, 'example.com')).toHaveLength(2)
    expect(await listGuests(event.id, 'nobody')).toHaveLength(0)
  })
})
