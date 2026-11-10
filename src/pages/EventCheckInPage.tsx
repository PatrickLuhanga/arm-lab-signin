import {
  ChevronDown,
  ChevronUp,
  Download,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import ConfirmModal from '../components/ConfirmModal'
import Modal from '../components/Modal'
import StatusBanner from '../components/StatusBanner'
import { addGuest, deleteGuest, getEvent, listGuests, updateGuest } from '../db/events'
import { buildEventGuestsCsv, saveCsvFile } from '../db/exports'
import type { EventGuest, EventWithGuestCount } from '../db/types'
import { errorMessage } from '../lib/errors'
import {
  avatarColor,
  formatTime12h,
  initials,
  pluralize,
} from '../lib/format'

interface GuestFormState {
  fullName: string
  organization: string
  contact: string
}

type SortKey = 'name' | 'organization' | 'contact' | 'signedIn'

const emptyGuestForm: GuestFormState = { fullName: '', organization: '', contact: '' }

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function EventCheckInPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = Number(id)

  const [event, setEvent] = useState<EventWithGuestCount | null>(null)
  const [guests, setGuests] = useState<EventGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<GuestFormState>(emptyGuestForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('signedIn')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [editingGuest, setEditingGuest] = useState<EventGuest | null>(null)
  const [editForm, setEditForm] = useState<GuestFormState>(emptyGuestForm)
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<EventGuest | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadEvent = useCallback(async () => {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      setEvent(null)
      setGuests([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [loadedEvent, loadedGuests] = await Promise.all([
        getEvent(eventId),
        listGuests(eventId),
      ])
      setEvent(loadedEvent)
      setGuests(loadedGuests)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadEvent()
  }, [loadEvent])

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current)
      }
    }
  }, [])

  function showNotice(message: string) {
    setNotice(message)

    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current)
    }

    noticeTimer.current = setTimeout(() => {
      setNotice(null)
      noticeTimer.current = null
    }, 3000)
  }

  async function handleCheckIn(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()

    if (!event) {
      return
    }

    const fullName = form.fullName.trim()

    if (fullName.length === 0) {
      setFormError('Guest name is required.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const guest = await addGuest(event.id, {
        fullName,
        organization: form.organization,
        contact: form.contact,
      })

      setForm({ ...emptyGuestForm })
      setGuests((current) => [guest, ...current])
      showNotice('Guest checked in.')
      nameInputRef.current?.focus()
    } catch (checkInError) {
      setFormError(errorMessage(checkInError))
    } finally {
      setSubmitting(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection(key === 'signedIn' ? 'desc' : 'asc')
  }

  const query = search.trim().toLowerCase()
  const visibleGuests = guests
    .filter(
      (guest) =>
        query.length === 0 ||
        guest.full_name.toLowerCase().includes(query) ||
        (guest.organization ?? '').toLowerCase().includes(query) ||
        (guest.contact ?? '').toLowerCase().includes(query),
    )
    .sort((first, second) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      switch (sortKey) {
        case 'name':
          return first.full_name.localeCompare(second.full_name) * direction
        case 'organization':
          return (first.organization ?? '').localeCompare(second.organization ?? '') * direction
        case 'contact':
          return (first.contact ?? '').localeCompare(second.contact ?? '') * direction
        case 'signedIn':
        default:
          return first.checked_in_at.localeCompare(second.checked_in_at) * direction
      }
    })

  async function handleExport() {
    if (!event) {
      return
    }

    try {
      const path = await saveCsvFile(
        `${slugify(event.title) || 'event'}-guests.csv`,
        buildEventGuestsCsv(event.title, guests),
      )
      showNotice(path ? `Guest list exported to ${path}` : 'Export cancelled.')
    } catch (exportError) {
      setError(errorMessage(exportError))
    }
  }

  function openEditGuest(guest: EventGuest) {
    setEditingGuest(guest)
    setEditForm({
      fullName: guest.full_name,
      organization: guest.organization ?? '',
      contact: guest.contact ?? '',
    })
    setEditError(null)
    setMenuOpenId(null)
  }

  async function handleEditSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()

    if (!editingGuest) {
      return
    }

    setSavingEdit(true)
    setEditError(null)

    try {
      const updated = await updateGuest(editingGuest.id, editForm)
      setGuests((current) => current.map((guest) => (guest.id === updated.id ? updated : guest)))
      setEditingGuest(null)
      showNotice('Guest updated.')
    } catch (saveError) {
      setEditError(errorMessage(saveError))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleRemoveGuest() {
    if (!confirmRemove) {
      return
    }

    try {
      await deleteGuest(confirmRemove.id)
      setGuests((current) => current.filter((guest) => guest.id !== confirmRemove.id))
      setConfirmRemove(null)
      showNotice('Guest removed.')
    } catch (removeError) {
      setConfirmRemove(null)
      setError(errorMessage(removeError))
    }
  }

  const breadcrumbs = [
    { label: 'More', to: '/sections' },
    { label: 'Events', to: '/events' },
    { label: event?.title ?? 'Event Check-In' },
  ]

  if (loading) {
    return (
      <section className="w-full">
        <Breadcrumbs items={breadcrumbs} />
        <p className="rounded-md border border-border bg-surface px-6 py-10 text-center text-sm text-muted">
          Loading event...
        </p>
      </section>
    )
  }

  if (!event || event.status === 'ended') {
    return (
      <section className="w-full">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mx-auto flex max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-surface text-danger">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            This event has ended — guest sign-in is closed
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Guest check-in is only available while an event is active. Return to the events hub to
            review the roster or start another event.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Back to Events
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full">
      <Breadcrumbs items={breadcrumbs} />
      <div className="rounded-md border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-success-fill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                LIVE
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{event.title}</h1>
            </div>
            {event.coordinators ? (
              <p className="mt-2 text-sm text-muted">Coordinators: {event.coordinators}</p>
            ) : null}
            {event.description ? (
              <p className="mt-1 text-sm leading-6 text-muted">{event.description}</p>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-ink">{pluralize(guests.length, 'Guest')}</p>
        </div>

        {error ? (
          <div className="mt-4">
            <StatusBanner tone="error" message={error} />
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4">
            <StatusBanner tone="success" message={notice} />
          </div>
        ) : null}

        <form onSubmit={handleCheckIn} className="mt-5 space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
            <input
              ref={nameInputRef}
              value={form.fullName}
              onChange={(changeEvent) => setForm({ ...form, fullName: changeEvent.target.value })}
              aria-label="Full Name"
              placeholder="Full name"
              className={inputClass}
              required
            />
            <input
              value={form.organization}
              onChange={(changeEvent) =>
                setForm({ ...form, organization: changeEvent.target.value })
              }
              aria-label="Organization / Affiliation"
              placeholder="Organization / Affiliation"
              className={inputClass}
            />
            <input
              value={form.contact}
              onChange={(changeEvent) => setForm({ ...form, contact: changeEvent.target.value })}
              aria-label="Contact (Email or Phone)"
              placeholder="Contact (Email or Phone)"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? 'CHECKING IN...' : 'CHECK IN AS GUEST'}
            </button>
          </div>
          {formError ? <StatusBanner tone="error" message={formError} /> : null}
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <p className="text-lg font-semibold text-ink">{pluralize(guests.length, 'Guest')}</p>
          <label className="relative block w-full sm:w-72">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={search}
              onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              placeholder="Search guests..."
              aria-label="Search guests"
              className="h-11 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-sm text-ink placeholder:text-muted focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-subtle"
          >
            <Download size={16} aria-hidden="true" />
            Export
          </button>
        </div>

        {visibleGuests.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            {guests.length === 0 ? 'No guests checked in yet.' : 'No guests match your search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-surface-subtle">
                <tr className="border-b border-border text-xs font-medium text-muted">
                  <SortHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortHeader label="Organization" sortKey="organization" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortHeader label="Contact" sortKey="contact" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortHeader label="Signed in" sortKey="signedIn" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <th scope="col" className="w-12 px-4 py-3">
                    <span className="sr-only">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    data-testid="guest-row"
                    className="border-t border-border align-middle"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          data-testid="guest-initials"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: avatarColor(guest.full_name) }}
                        >
                          {initials(guest.full_name)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{guest.full_name}</p>
                          <p className="text-xs text-muted">Checked in</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted">{guest.organization ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-muted">{guest.contact ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-muted">
                      {formatTime12h(guest.checked_in_at)}
                    </td>
                    <td className="relative px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === guest.id ? null : guest.id)}
                        aria-label={`Actions for ${guest.full_name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface-subtle hover:text-ink"
                      >
                        <MoreHorizontal size={18} aria-hidden="true" />
                      </button>
                      {menuOpenId === guest.id ? (
                        <div className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-institutional">
                          <button
                            type="button"
                            onClick={() => openEditGuest(guest)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-subtle"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit Guest
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmRemove(guest)
                              setMenuOpenId(null)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface-subtle"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Remove Entry
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={editingGuest !== null}
        title="Edit Guest"
        onClose={() => setEditingGuest(null)}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError ? <StatusBanner tone="error" message={editError} /> : null}
          <Field label="Full Name" htmlFor="guest-edit-name">
            <input
              id="guest-edit-name"
              value={editForm.fullName}
              onChange={(changeEvent) => setEditForm({ ...editForm, fullName: changeEvent.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Organization" htmlFor="guest-edit-organization">
            <input
              id="guest-edit-organization"
              value={editForm.organization}
              onChange={(changeEvent) =>
                setEditForm({ ...editForm, organization: changeEvent.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Contact" htmlFor="guest-edit-contact">
            <input
              id="guest-edit-contact"
              value={editForm.contact}
              onChange={(changeEvent) => setEditForm({ ...editForm, contact: changeEvent.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditingGuest(null)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button type="submit" disabled={savingEdit} className={primaryButtonClass}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemove !== null}
        title="Remove guest?"
        description={
          confirmRemove
            ? `${confirmRemove.full_name} will be removed from this event roster.`
            : undefined
        }
        confirmLabel="Remove Guest"
        destructive
        onConfirm={handleRemoveGuest}
        onCancel={() => setConfirmRemove(null)}
      />
    </section>
  )
}

const inputClass =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none'

const primaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60'

const secondaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-subtle'

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const isActive = sortKey === activeKey

  return (
    <th scope="col" className="px-5 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition ${
          isActive ? 'text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ChevronUp size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )
        ) : null}
      </button>
    </th>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  )
}
