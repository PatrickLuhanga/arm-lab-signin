import { useCallback, useEffect, useState } from 'react'
import RoleBadge from '../components/RoleBadge'
import StatusBanner from '../components/StatusBanner'
import { getLeaderboard } from '../db/signIns'
import type { LeaderboardEntry, LeaderboardPeriod } from '../db/types'
import { pluralize } from '../lib/format'

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

const PERIOD_EMPTY_MESSAGES: Record<LeaderboardPeriod, string> = {
  today: 'No sign-ins recorded today.',
  week: 'No sign-ins recorded this week.',
  month: 'No sign-ins recorded this month.',
  all: 'No sign-ins recorded yet.',
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLeaderboard = useCallback(async (selectedPeriod: LeaderboardPeriod) => {
    setLoading(true)
    setError(null)

    try {
      setEntries(await getLeaderboard(selectedPeriod))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLeaderboard(period)
  }, [period, loadLeaderboard])

  const visibleEntries = entries.filter((entry) => entry.sign_in_count > 0)

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Leaderboard</h1>

        <div
          className="inline-flex overflow-hidden rounded border border-border"
          role="group"
          aria-label="Leaderboard period"
        >
          {PERIOD_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`min-h-12 px-4 text-sm font-medium transition ${
                index > 0 ? 'border-l border-border' : ''
              } ${
                period === option.value
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:bg-surface-subtle hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="error" message={error} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-muted">Loading leaderboard...</p>
        ) : visibleEntries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">{PERIOD_EMPTY_MESSAGES[period]}</p>
            <p className="mt-2 text-sm text-muted">
              Try another period or sign in from the Home register.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-surface-subtle">
                <tr className="border-b border-border text-xs font-medium text-muted">
                  <th scope="col" className="w-16 px-4 py-3">
                    #
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Qualification
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr key={entry.profile_id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-sm text-muted tabular-nums">#{entry.rank}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-ink">{entry.full_name}</td>
                    <td className="px-4 py-3 text-sm text-muted">{entry.course}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={entry.role} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-ink tabular-nums">
                      {pluralize(entry.sign_in_count, 'day')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
