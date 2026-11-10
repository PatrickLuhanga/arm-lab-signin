import Database from '@tauri-apps/plugin-sql'

const DATABASE_URL = 'sqlite:armlab.db'

export interface ExecuteResult {
  lastInsertId?: number
  rowsAffected: number
}

export interface SqlDatabase {
  select<T>(query: string, params?: unknown[]): Promise<T>
  execute(query: string, params?: unknown[]): Promise<ExecuteResult>
}

let rawDatabasePromise: Promise<Database> | null = null
let serializedDatabasePromise: Promise<SqlDatabase> | null = null
let operationQueue: Promise<void> = Promise.resolve()

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation)
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function rawAdapter(db: Database): SqlDatabase {
  return {
    select: <T>(query: string, params: unknown[] = []) => db.select<T>(query, params),
    execute: (query: string, params: unknown[] = []) => db.execute(query, params),
  }
}

function serializedAdapter(db: SqlDatabase): SqlDatabase {
  return {
    select: <T>(query: string, params: unknown[] = []) =>
      enqueue(() => db.select<T>(query, params)),
    execute: (query: string, params: unknown[] = []) =>
      enqueue(() => db.execute(query, params)),
  }
}

function loadRawDatabase(): Promise<Database> {
  if (!rawDatabasePromise) {
    rawDatabasePromise = Database.load(DATABASE_URL).then(async (db) => {
      await db.execute('PRAGMA foreign_keys = ON')
      return db
    })
  }

  return rawDatabasePromise
}

export function getDb(): Promise<SqlDatabase> {
  if (!serializedDatabasePromise) {
    serializedDatabasePromise = loadRawDatabase().then((db) => serializedAdapter(rawAdapter(db)))
  }

  return serializedDatabasePromise
}

export function runExclusiveDatabaseTask<T>(
  work: (db: SqlDatabase) => Promise<T>,
): Promise<T> {
  return enqueue(async () => {
    const db = await loadRawDatabase()
    return work(rawAdapter(db))
  })
}

export async function withTransaction<T>(work: (db: SqlDatabase) => Promise<T>): Promise<T> {
  return runExclusiveDatabaseTask(async (db) => {
    await db.execute('BEGIN')

    try {
      const result = await work(db)
      await db.execute('COMMIT')
      return result
    } catch (error) {
      try {
        await db.execute('ROLLBACK')
      } catch {
        // Preserve the original failure if the rollback itself fails.
      }
      throw error
    }
  })
}

export function resetDbForTests(): void {
  rawDatabasePromise = null
  serializedDatabasePromise = null
  operationQueue = Promise.resolve()
}
