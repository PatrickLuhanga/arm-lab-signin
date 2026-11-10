import { Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import RoleBadge from '../components/RoleBadge'
import StatusBanner from '../components/StatusBanner'
import { getLeaderboard } from '../db/signIns'
import type { LeaderboardEntry, LeaderboardPeriod } from '../db/types'
import { pluralize } from '../lib/format'

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

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

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Arm Lab</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <Trophy size={22} aria-hidden="true" />
            Combined Leaderboard
          </h1>
          <p className="mt-2 text-sm text-muted">
            Arm Members and Interns ranked together by verified daily sign-ins.
          </p>
        </div>

        <div className="flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Leaderboard period">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`min-h-12 rounded-lg px-4 text-sm font-semibold transition ${
                period === option.value
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-ink'
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

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-muted">Loading leaderboard...</p>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">No profiles registered yet</p>
            <p className="mt-2 text-sm text-muted">
              Create Arm Member or Intern profiles in Admin to start tracking sign-ins.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                  <th scope="col" className="w-20 px-6 py-3">Rank</th>
                  <th scope="col" className="px-6 py-3">Name &amp; Qualification</th>
                  <th scope="col" className="px-6 py-3 text-right">Sign-Ins</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.profile_id} className="border-b border-border last:border-b-0">
                    <td className="px-6 py-4 text-sm font-semibold text-muted">#{entry.rank}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-ink">{entry.full_name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">{entry.course}</span>
                        <RoleBadge role={entry.role} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-ink">
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
