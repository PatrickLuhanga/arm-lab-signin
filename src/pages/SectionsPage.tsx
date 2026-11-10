import { Calendar, Cpu, GraduationCap, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBanner from '../components/StatusBanner'
import { countActiveEvents } from '../db/events'
import { countProfiles } from '../db/profiles'
import { pluralize } from '../lib/format'

interface HubCard {
  to: string
  title: string
  description: string
  meta: string
  icon: LucideIcon
}

export default function SectionsPage() {
  const [memberCount, setMemberCount] = useState(0)
  const [internCount, setInternCount] = useState(0)
  const [activeEventCount, setActiveEventCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([countProfiles('arm_member'), countProfiles('intern'), countActiveEvents()])
      .then(([members, interns, events]) => {
        if (!active) {
          return
        }

        setMemberCount(members)
        setInternCount(interns)
        setActiveEventCount(events)
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load section counts.')
        }
      })

    return () => {
      active = false
    }
  }, [])

  const cards: HubCard[] = [
    {
      to: '/members',
      title: 'Arm Members',
      description: 'Registered Arm Members with their projects and sign-in totals.',
      meta: `${pluralize(memberCount, 'member')} registered`,
      icon: Cpu,
    },
    {
      to: '/interns',
      title: 'Interns',
      description: 'Registered Interns with their organisations and sign-in history.',
      meta: `${pluralize(internCount, 'intern')} registered`,
      icon: GraduationCap,
    },
    {
      to: '/events',
      title: 'Events',
      description: 'Active guest events with live check-in rosters and CSV exports.',
      meta: pluralize(activeEventCount, 'active event'),
      icon: Calendar,
    },
    {
      to: '/admin',
      title: 'Admin',
      description: 'Profiles, logs and database backups.',
      meta: 'Admin only',
      icon: SlidersHorizontal,
    },
  ]

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">More</h1>
        <p className="mt-2 text-sm text-muted">
          Jump into the directories, event check-in, or administration tools.
        </p>
      </div>

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="error" message={error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <Link
              key={card.to}
              to={card.to}
              className="flex min-h-40 flex-col justify-between rounded-lg border border-border bg-surface p-5 transition hover:bg-surface-subtle"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Icon
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-slate-500 dark:text-slate-400"
                  />
                  <h2 className="text-base font-semibold tracking-tight text-ink">{card.title}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{card.description}</p>
              </div>
              <p className="mt-4 text-xs text-muted">{card.meta}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
