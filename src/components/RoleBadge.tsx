import type { Role } from '../db/types'
import { roleLabel } from '../lib/format'

interface RoleBadgeProps {
  role: Role
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const color = role === 'arm_member' ? 'var(--role-member)' : 'var(--role-intern)'

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {roleLabel(role)}
    </span>
  )
}
