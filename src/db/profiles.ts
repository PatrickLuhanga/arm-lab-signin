import { getDb, withTransaction } from './client'
import { NotFoundError, ValidationError } from './errors'
import type {
  CreateProfileInput,
  NewProjectInput,
  Profile,
  ProfileWithStats,
  Project,
  Role,
  UpdateProfileInput,
} from './types'
import {
  countValue,
  isUniqueConstraintError,
  optionalText,
  requireText,
} from './validation'

const PROFILE_STATS_SELECT = `
  SELECT
    p.*,
    (SELECT COUNT(*) FROM projects pr WHERE pr.profile_id = p.id) AS project_count,
    (SELECT COUNT(*) FROM sign_ins s WHERE s.profile_id = p.id) AS sign_in_count
  FROM profiles p
`

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const fullName = requireText(input.fullName, 'Full name')
  const studentNumber = requireText(input.studentNumber, 'Student number')
  const course = requireText(input.course, 'Course')

  let organization: string | null = null
  let initialProject: { title: string; description: string | null } | null = null

  if (input.role === 'arm_member') {
    if (!input.initialProject) {
      throw new ValidationError('At least 1 project is required for an Arm Member.')
    }

    initialProject = {
      title: requireText(input.initialProject.title, 'Project title'),
      description: optionalText(input.initialProject.description),
    }
  } else {
    organization = requireText(input.organization, 'Organization')
  }

  try {
    return await withTransaction(async (db) => {
      const duplicate = await db.select<{ id: number }[]>(
        'SELECT id FROM profiles WHERE student_number = ? LIMIT 1',
        [studentNumber],
      )

      if (duplicate.length > 0) {
        throw new ValidationError('A profile with this student number already exists.')
      }

      const result = await db.execute(
        'INSERT INTO profiles (student_number, full_name, role, course, organization) VALUES (?, ?, ?, ?, ?)',
        [studentNumber, fullName, input.role, course, organization],
      )

      const profileId = result.lastInsertId

      if (!profileId) {
        throw new Error('The profile could not be created.')
      }

      if (initialProject) {
        await db.execute(
          'INSERT INTO projects (profile_id, title, description) VALUES (?, ?, ?)',
          [profileId, initialProject.title, initialProject.description],
        )
      }

      const rows = await db.select<Profile[]>('SELECT * FROM profiles WHERE id = ? LIMIT 1', [
        profileId,
      ])

      const profile = rows[0]

      if (!profile) {
        throw new Error('The profile could not be loaded after creation.')
      }

      return profile
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ValidationError('A profile with this student number already exists.')
    }

    throw error
  }
}

export async function updateProfile(
  profileId: number,
  input: UpdateProfileInput,
): Promise<Profile> {
  const db = await getDb()
  const existingRows = await db.select<Profile[]>('SELECT * FROM profiles WHERE id = ? LIMIT 1', [
    profileId,
  ])
  const existing = existingRows[0]

  if (!existing) {
    throw new NotFoundError('Profile not found.')
  }

  const fullName = requireText(input.fullName, 'Full name')
  const studentNumber = requireText(input.studentNumber, 'Student number')
  const course = requireText(input.course, 'Course')
  const organization =
    existing.role === 'intern' ? requireText(input.organization, 'Organization') : null

  try {
    const duplicate = await db.select<{ id: number }[]>(
      'SELECT id FROM profiles WHERE student_number = ? AND id <> ? LIMIT 1',
      [studentNumber, profileId],
    )

    if (duplicate.length > 0) {
      throw new ValidationError('A profile with this student number already exists.')
    }

    await db.execute(
      'UPDATE profiles SET full_name = ?, student_number = ?, course = ?, organization = ? WHERE id = ?',
      [fullName, studentNumber, course, organization, profileId],
    )

    const updatedRows = await db.select<Profile[]>(
      'SELECT * FROM profiles WHERE id = ? LIMIT 1',
      [profileId],
    )

    const updated = updatedRows[0]

    if (!updated) {
      throw new NotFoundError('Profile not found.')
    }

    return updated
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ValidationError('A profile with this student number already exists.')
    }

    throw error
  }
}

export async function deleteProfile(profileId: number): Promise<void> {
  const db = await getDb()
  const result = await db.execute('DELETE FROM profiles WHERE id = ?', [profileId])

  if (result.rowsAffected === 0) {
    throw new NotFoundError('Profile not found.')
  }
}

export async function getProfile(profileId: number): Promise<Profile | null> {
  const db = await getDb()
  const rows = await db.select<Profile[]>('SELECT * FROM profiles WHERE id = ? LIMIT 1', [
    profileId,
  ])

  return rows[0] ?? null
}

export async function getProfileByStudentNumber(studentNumber: string): Promise<Profile | null> {
  const db = await getDb()
  const trimmed = studentNumber.trim()
  const rows = await db.select<Profile[]>(
    'SELECT * FROM profiles WHERE student_number = ? LIMIT 1',
    [trimmed],
  )

  return rows[0] ?? null
}

export async function getProfileWithStats(profileId: number): Promise<ProfileWithStats | null> {
  const db = await getDb()
  const rows = await db.select<ProfileWithStats[]>(
    `${PROFILE_STATS_SELECT} WHERE p.id = ? LIMIT 1`,
    [profileId],
  )

  return rows[0] ?? null
}

export async function listProfiles(role?: Role): Promise<ProfileWithStats[]> {
  const db = await getDb()
  const whereClause = role ? ' WHERE p.role = ?' : ''
  const params = role ? [role] : []

  return db.select<ProfileWithStats[]>(
    `${PROFILE_STATS_SELECT}${whereClause} ORDER BY p.full_name COLLATE NOCASE ASC`,
    params,
  )
}

export async function countProfiles(role: Role): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ total: unknown }[]>(
    'SELECT COUNT(*) AS total FROM profiles WHERE role = ?',
    [role],
  )

  return countValue(rows[0]?.total)
}

export async function listProjects(profileId: number): Promise<Project[]> {
  const db = await getDb()

  return db.select<Project[]>(
    'SELECT * FROM projects WHERE profile_id = ? ORDER BY created_at ASC, id ASC',
    [profileId],
  )
}

export async function getProject(profileId: number, projectId: number): Promise<Project | null> {
  const db = await getDb()
  const rows = await db.select<Project[]>(
    'SELECT * FROM projects WHERE id = ? AND profile_id = ? LIMIT 1',
    [projectId, profileId],
  )

  return rows[0] ?? null
}

export async function addProject(profileId: number, input: NewProjectInput): Promise<Project> {
  const title = requireText(input.title, 'Project title')
  const description = optionalText(input.description)
  const db = await getDb()
  const profileRows = await db.select<Profile[]>('SELECT * FROM profiles WHERE id = ? LIMIT 1', [
    profileId,
  ])
  const profile = profileRows[0]

  if (!profile) {
    throw new NotFoundError('Profile not found.')
  }

  if (profile.role !== 'arm_member') {
    throw new ValidationError('Projects can only be added to Arm Members.')
  }

  const result = await db.execute(
    'INSERT INTO projects (profile_id, title, description) VALUES (?, ?, ?)',
    [profileId, title, description],
  )

  const projectId = result.lastInsertId

  if (!projectId) {
    throw new Error('The project could not be created.')
  }

  const rows = await db.select<Project[]>('SELECT * FROM projects WHERE id = ? LIMIT 1', [
    projectId,
  ])

  const project = rows[0]

  if (!project) {
    throw new Error('The project could not be loaded after creation.')
  }

  return project
}

export async function updateProject(
  profileId: number,
  projectId: number,
  input: NewProjectInput,
): Promise<Project> {
  const title = requireText(input.title, 'Project title')
  const description = optionalText(input.description)
  const db = await getDb()
  const result = await db.execute(
    'UPDATE projects SET title = ?, description = ? WHERE id = ? AND profile_id = ?',
    [title, description, projectId, profileId],
  )

  if (result.rowsAffected === 0) {
    throw new NotFoundError('Project not found.')
  }

  const rows = await db.select<Project[]>('SELECT * FROM projects WHERE id = ? LIMIT 1', [
    projectId,
  ])

  const project = rows[0]

  if (!project) {
    throw new NotFoundError('Project not found.')
  }

  return project
}

export async function deleteProject(profileId: number, projectId: number): Promise<void> {
  await withTransaction(async (db) => {
    const projectRows = await db.select<Project[]>(
      'SELECT * FROM projects WHERE id = ? AND profile_id = ? LIMIT 1',
      [projectId, profileId],
    )

    if (projectRows.length === 0) {
      throw new NotFoundError('Project not found.')
    }

    const countRows = await db.select<{ total: unknown }[]>(
      'SELECT COUNT(*) AS total FROM projects WHERE profile_id = ?',
      [profileId],
    )

    if (countValue(countRows[0]?.total) <= 1) {
      throw new ValidationError('At least 1 project required.')
    }

    await db.execute('DELETE FROM projects WHERE id = ? AND profile_id = ?', [
      projectId,
      profileId,
    ])
  })
}

export async function countProjects(profileId: number): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ total: unknown }[]>(
    'SELECT COUNT(*) AS total FROM projects WHERE profile_id = ?',
    [profileId],
  )

  return countValue(rows[0]?.total)
}
