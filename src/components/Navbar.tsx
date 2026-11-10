import { LayoutGrid, Lightbulb, Moon, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import ArmLabLogo from './ArmLabLogo'

function NavControl({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string
  label: string
  icon: LucideIcon
  active: boolean
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`relative inline-flex min-h-12 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
        active ? 'text-accent' : 'text-muted hover:bg-surface-subtle hover:text-ink'
      }`}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      {active ? (
        <span
          className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  )
}

export default function Navbar() {
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const moreActive =
    location.pathname === '/sections' ||
    location.pathname.startsWith('/members') ||
    location.pathname.startsWith('/interns') ||
    location.pathname.startsWith('/events') ||
    location.pathname.startsWith('/admin')

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-2">
        <ArmLabLogo />

        <nav aria-label="Global navigation" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-ink"
          >
            {isDark ? (
              <Lightbulb size={20} aria-hidden="true" />
            ) : (
              <Moon size={20} aria-hidden="true" />
            )}
          </button>

          <NavControl
            to="/leaderboard"
            label="Leaderboard"
            icon={Trophy}
            active={location.pathname === '/leaderboard'}
          />
          <NavControl to="/sections" label="More" icon={LayoutGrid} active={moreActive} />
        </nav>
      </div>
    </header>
  )
}
