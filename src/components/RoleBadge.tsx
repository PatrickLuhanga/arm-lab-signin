import type { Role } from '../db/types'
import { roleLabel } from '../lib/format'

interface RoleBadgeProps {
  role: Role
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {roleLabel(role)}
    </span>
  )
}
