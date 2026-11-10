import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type BannerTone = 'success' | 'warning' | 'error' | 'info'

interface StatusBannerProps {
  tone: BannerTone
  message: string
}

const TONE_CONFIG: Record<BannerTone, { color: string; icon: LucideIcon; role: 'status' | 'alert' }> = {
  success: { color: 'var(--success)', icon: CheckCircle2, role: 'status' },
  warning: { color: 'var(--warning)', icon: AlertTriangle, role: 'status' },
  error: { color: 'var(--danger)', icon: XCircle, role: 'alert' },
  info: { color: 'var(--accent)', icon: Info, role: 'status' },
}

export default function StatusBanner({ tone, message }: StatusBannerProps) {
  const config = TONE_CONFIG[tone]
  const Icon = config.icon

  return (
    <div
      role={config.role}
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium"
      style={{
        color: config.color,
        borderColor: config.color,
        backgroundColor: `color-mix(in srgb, ${config.color} 10%, transparent)`,
      }}
    >
      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span className="leading-6">{message}</span>
    </div>
  )
}
