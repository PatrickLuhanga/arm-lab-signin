import type { Role } from '../db/types'

export const AVATAR_COLORS = ['#0091BD', '#7AB4B6', '#5370A3', '#812575', '#1C8441', '#D11F2D']

export function roleLabel(role: Role): string {
  return role === 'arm_member' ? 'Arm Member' : 'Intern'
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatClockTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatHeaderDate(date: Date): string {
  const datePart = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return `${datePart} | ${formatClockTime(date)}`
}

export function formatTimeFromTimestamp(timestamp: string): string {
  const match = timestamp.match(/[T ](\d{2}:\d{2})/)
  return match ? match[1] : timestamp
}

export function formatTime12h(timestamp: string): string {
  const match = timestamp.match(/[T ]?(\d{2}):(\d{2})/)
  if (!match) {
    return timestamp
  }

  let hours = Number(match[1])
  const minutes = match[2]
  const suffix = hours >= 12 ? 'pm' : 'am'
  hours %= 12

  if (hours === 0) {
    hours = 12
  }

  return `${hours}:${minutes} ${suffix}`
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return '?'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function avatarColor(fullName: string): string {
  let hash = 0

  for (let index = 0; index < fullName.length; index += 1) {
    hash = (hash * 31 + fullName.charCodeAt(index)) >>> 0
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
