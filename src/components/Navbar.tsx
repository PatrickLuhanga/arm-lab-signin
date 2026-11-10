import { ArrowLeft, LayoutGrid, Lightbulb, Moon, Trophy } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import ArmLabLogo from './ArmLabLogo'

interface BackConfig {
  to: string
  label: string
}

function getBackConfig(pathname: string): BackConfig | null {
  if (pathname.startsWith('/events/') && pathname.endsWith('/checkin')) {
    return { to: '/events', label: 'Back to Events' }
  }

  if (['/members', '/interns', '/events', '/admin'].some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return { to: '/sections', label: 'More' }
  }

  return null
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base =
    'inline-flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition sm:px-4'
  const active = 'border-accent bg-accent/5 text-accent'
  const inactive = 'border-border bg-surface text-ink hover:border-accent hover:text-accent'

  return `${base} ${isActive ? active : inactive}`
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const backConfig = getBackConfig(location.pathname)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <ArmLabLogo />
          {backConfig ? (
            <button
              type="button"
              onClick={() => navigate(backConfig.to)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-ink transition hover:border-accent hover:text-accent sm:px-4"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{backConfig.label}</span>
            </button>
          ) : null}
        </div>

        <nav aria-label="Global navigation" className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-ink transition hover:border-accent hover:text-accent"
          >
            {isDark ? (
              <Lightbulb size={20} aria-hidden="true" />
            ) : (
              <Moon size={20} aria-hidden="true" />
            )}
          </button>

          <NavLink to="/leaderboard" className={navLinkClass} aria-label="Leaderboard">
            <Trophy size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Leaderboard</span>
          </NavLink>

          <NavLink to="/sections" className={navLinkClass} aria-label="More">
            <LayoutGrid size={18} aria-hidden="true" />
            <span className="hidden sm:inline">More</span>
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
