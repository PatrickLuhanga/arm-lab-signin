import { ValidationError } from './errors'
import { getSetting, setSetting } from './settings'

export const ADMIN_PASSWORD_HASH_KEY = 'admin_password_hash'
export const ADMIN_PASSWORD_SALT_KEY = 'admin_password_salt'
export const MIN_ADMIN_PASSWORD_LENGTH = 4

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return toHex(new Uint8Array(digest))
}

export function validateAdminPassword(password: string): void {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `Admin password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    )
  }
}

export async function hashAdminPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`)
}

export async function isAdminPasswordConfigured(): Promise<boolean> {
  const [hash, salt] = await Promise.all([
    getSetting(ADMIN_PASSWORD_HASH_KEY),
    getSetting(ADMIN_PASSWORD_SALT_KEY),
  ])

  return Boolean(hash && salt)
}

export async function setAdminPassword(password: string): Promise<void> {
  validateAdminPassword(password)

  const salt = randomSaltHex()
  const hash = await hashAdminPassword(password, salt)

  await setSetting(ADMIN_PASSWORD_SALT_KEY, salt)
  await setSetting(ADMIN_PASSWORD_HASH_KEY, hash)
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const [storedHash, salt] = await Promise.all([
    getSetting(ADMIN_PASSWORD_HASH_KEY),
    getSetting(ADMIN_PASSWORD_SALT_KEY),
  ])

  if (!storedHash || !salt) {
    return false
  }

  const candidateHash = await hashAdminPassword(password, salt)
  return candidateHash === storedHash
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  validateAdminPassword(newPassword)

  const isValid = await verifyAdminPassword(currentPassword)

  if (!isValid) {
    throw new ValidationError('Current password is incorrect.')
  }

  await setAdminPassword(newPassword)
}
