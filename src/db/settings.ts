import { getDb } from './client'

export const THEME_SETTING_KEY = 'theme'

interface SettingRow {
  value: string
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.select<SettingRow[]>(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [key],
  )

  return rows.length > 0 ? rows[0].value : null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}
