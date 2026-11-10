import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type BannerTone = 'success' | 'warning' | 'error' | 'info'

interface StatusBannerProps {
  tone: BannerTone
  message: string
}

const TONE_CONFIG: Record<
  BannerTone,
  { color: string; background: string; icon: LucideIcon; role: 'status' | 'alert' }
> = {
  success: {
    color: 'var(--success)',
    background: 'var(--success-fill)',
    icon: CheckCircle2,
    role: 'status',
  },
  warning: {
    color: 'var(--warning)',
    background: 'var(--warning-fill)',
    icon: AlertTriangle,
    role: 'status',
  },
  error: {
    color: 'var(--danger)',
    background: 'var(--danger-fill)',
    icon: XCircle,
    role: 'alert',
  },
  info: {
    color: 'var(--accent)',
    background: 'var(--surface-subtle)',
    icon: Info,
    role: 'status',
  },
}

export default function StatusBanner({ tone, message }: StatusBannerProps) {
  const config = TONE_CONFIG[tone]
  const Icon = config.icon

  return (
    <div
      role={config.role}
      aria-live="polite"
      className="flex items-start gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium"
      style={{
        color: config.color,
        backgroundColor: config.background,
      }}
    >
      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span className="leading-6">{message}</span>
    </div>
  )
}
