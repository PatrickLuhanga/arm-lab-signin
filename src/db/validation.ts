import { ValidationError } from './errors'

export function requireText(value: string | null | undefined, label: string): string {
  const trimmed = (value ?? '').trim()

  if (trimmed.length === 0) {
    throw new ValidationError(`${label} is required.`)
  }

  return trimmed
}

export function optionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message)
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return error instanceof Error && /foreign key constraint/i.test(error.message)
}

export function countValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
