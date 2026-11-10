import { Download, Eye, Pencil, Play, Plus, Square, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import ConfirmModal from '../components/ConfirmModal'
import Modal from '../components/Modal'
import StatusBanner, { type BannerTone } from '../components/StatusBanner'
import {
  activateEvent,
  createEvent,
  deleteEvent,
  endEvent,
  listAllGuestsWithEvents,
  listEvents,
  listGuests,
  updateEvent,
} from '../db/events'
import { buildAllGuestsCsv, buildEventGuestsCsv, saveCsvFile } from '../db/exports'
import type { EventGuest, EventStatus, EventWithGuestCount } from '../db/types'
import { errorMessage } from '../lib/errors'
import { formatTimeFromTimestamp, pluralize } from '../lib/format'

interface Notice {
  tone: BannerTone
  message: string
}

interface EventFormState {
  title: string
  coordinators: string
  description: string
  status: EventStatus
}

const emptyForm: EventFormState = {
  title: '',
  coordinators: '',
  description: '',
  status: 'active',
}

function guestCountLabel(count: number): string {
  return pluralize(count, 'guest')
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithGuestCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<EventFormState>(emptyForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [editingEvent, setEditingEvent] = useState<EventWithGuestCount | null>(null)
  const [editForm, setEditForm] = useState<EventFormState>(emptyForm)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [confirmEnd, setConfirmEnd] = useState<EventWithGuestCount | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EventWithGuestCount | null>(null)

  const [rosterEvent, setRosterEvent] = useState<EventWithGuestCount | null>(null)
  const [rosterGuests, setRosterGuests] = useState<EventGuest[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)

  const loadEvents = useCallback(async () => {
    setError(null)

    try {
      setEvents(await listEvents())
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const activeEvents = events.filter((event) => event.status === 'active')
  const scheduledEvents = events.filter((event) => event.status === 'scheduled')
  const endedEvents = events.filter((event) => event.status === 'ended')

  function openCreate() {
    setCreateForm({ ...emptyForm })
    setCreateError(null)
    setCreateOpen(true)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      await createEvent({
        title: createForm.title,
        coordinators: createForm.coordinators,
        description: createForm.description,
        status: createForm.status === 'scheduled' ? 'scheduled' : 'active',
      })
      setCreateOpen(false)
      setNotice({ tone: 'success', message: 'Event created.' })
      await loadEvents()
    } catch (createFailure) {
      setCreateError(errorMessage(createFailure))
    } finally {
      setCreating(false)
    }
  }

  function openEdit(event: EventWithGuestCount) {
    setEditingEvent(event)
    setEditForm({
      title: event.title,
      coordinators: event.coordinators ?? '',
      description: event.description ?? '',
      status: event.status,
    })
    setEditError(null)
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingEvent) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateEvent(editingEvent.id, {
        title: editForm.title,
        coordinators: editForm.coordinators,
        description: editForm.description,
      })
      setEditingEvent(null)
      setNotice({ tone: 'success', message: 'Event updated.' })
      await loadEvents()
    } catch (saveFailure) {
      setEditError(errorMessage(saveFailure))
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(event: EventWithGuestCount) {
    try {
      await activateEvent(event.id)
      setNotice({ tone: 'success', message: `${event.title} is now live.` })
      await loadEvents()
    } catch (activateFailure) {
      setNotice({ tone: 'error', message: errorMessage(activateFailure) })
    }
  }

  async function handleEnd() {
    if (!confirmEnd) {
      return
    }

    try {
      await endEvent(confirmEnd.id)
      setConfirmEnd(null)
      setNotice({ tone: 'success', message: 'Event ended. Guest sign-in is now closed.' })
      await loadEvents()
    } catch (endFailure) {
      setConfirmEnd(null)
      setNotice({ tone: 'error', message: errorMessage(endFailure) })
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      return
    }

    try {
      await deleteEvent(confirmDelete.id)
      setConfirmDelete(null)
      setNotice({ tone: 'success', message: 'Event deleted.' })
      await loadEvents()
    } catch (deleteFailure) {
      setConfirmDelete(null)
      setNotice({ tone: 'error', message: errorMessage(deleteFailure) })
    }
  }

  async function openRoster(event: EventWithGuestCount) {
    setRosterEvent(event)
    setRosterLoading(true)
    setRosterGuests([])

    try {
      setRosterGuests(await listGuests(event.id))
    } catch (loadFailure) {
      setNotice({ tone: 'error', message: errorMessage(loadFailure) })
    } finally {
      setRosterLoading(false)
    }
  }

  async function handleExportRoster() {
    if (!rosterEvent) {
      return
    }

    try {
      const slug = rosterEvent.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const path = await saveCsvFile(
        `${slug || 'event'}-guests.csv`,
        buildEventGuestsCsv(rosterEvent.title, rosterGuests),
      )
      setNotice(
        path
          ? { tone: 'success', message: `Roster exported to ${path}` }
          : { tone: 'info', message: 'Roster export cancelled.' },
      )
    } catch (exportFailure) {
      setNotice({ tone: 'error', message: errorMessage(exportFailure) })
    }
  }

  async function handleExportAll() {
    setExportingAll(true)

    try {
      const rows = await listAllGuestsWithEvents()
      const path = await saveCsvFile('armlab-all-guests.csv', buildAllGuestsCsv(rows))
      setNotice(
        path
          ? { tone: 'success', message: `All guests exported to ${path}` }
          : { tone: 'info', message: 'Guest export cancelled.' },
      )
    } catch (exportFailure) {
      setNotice({ tone: 'error', message: errorMessage(exportFailure) })
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <section className="w-full">
      <Breadcrumbs items={[{ label: 'More', to: '/sections' }, { label: 'Events' }]} />

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Events</h1>
      </div>

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="error" message={error} />
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4">
          <StatusBanner tone={notice.tone} message={notice.message} />
        </div>
      ) : null}

      <div
        data-testid="events-action-bar"
        className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-4"
      >
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          <Plus size={18} aria-hidden="true" />
          Create / Schedule Event
        </button>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={exportingAll}
          className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-subtle disabled:opacity-60"
        >
          <Download size={18} aria-hidden="true" />
          {exportingAll ? 'Exporting...' : 'Export All Guests CSV'}
        </button>
      </div>

      <div data-testid="events-active-scheduled" className="space-y-8">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Active Events</h2>
            <span className="text-xs font-medium text-muted">
              {pluralize(activeEvents.length, 'live event')}
            </span>
          </div>

          {loading ? (
            <p className="rounded-lg border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
              Loading events...
            </p>
          ) : activeEvents.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface px-5 py-6 text-sm text-muted">
              No active events. Schedule one above, then activate it when the doors open.
            </p>
          ) : (
            <div className="space-y-3">
              {activeEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-lg border border-border bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-success-fill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                          LIVE
                        </span>
                        <h3 className="text-base font-semibold text-ink">{event.title}</h3>
                      </div>
                      {event.coordinators ? (
                        <p className="mt-2 text-sm text-muted">Coordinators: {event.coordinators}</p>
                      ) : null}
                      {event.description ? (
                        <p className="mt-1 text-sm leading-6 text-muted">{event.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Users size={16} aria-hidden="true" />
                      {guestCountLabel(event.guest_count)}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/events/${event.id}/checkin`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover"
                    >
                      Open Check-In Screen
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmEnd(event)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-danger transition hover:bg-danger-fill"
                    >
                      <Square size={16} aria-hidden="true" />
                      End Event
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Scheduled Events</h2>
            <span className="text-xs font-medium text-muted">
              {pluralize(scheduledEvents.length, 'scheduled event')}
            </span>
          </div>

          {!loading && scheduledEvents.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface px-5 py-6 text-sm text-muted">
              No scheduled events.
            </p>
          ) : (
            <div className="space-y-3">
              {scheduledEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-lg border border-border bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          SCHEDULED
                        </span>
                        <h3 className="text-base font-semibold text-ink">{event.title}</h3>
                      </div>
                      {event.coordinators ? (
                        <p className="mt-2 text-sm text-muted">Coordinators: {event.coordinators}</p>
                      ) : null}
                      {event.description ? (
                        <p className="mt-1 text-sm leading-6 text-muted">{event.description}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleActivate(event)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover"
                    >
                      <Play size={16} aria-hidden="true" />
                      Activate Now
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(event)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-subtle"
                    >
                      <Pencil size={16} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(event)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-danger transition hover:bg-danger-fill"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div data-testid="events-previous" className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Previous Events</h2>
          <span className="text-xs font-medium text-muted">
            {pluralize(endedEvents.length, 'ended event')}
          </span>
        </div>

        {!loading && endedEvents.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-6 text-sm text-muted">
            No previous events yet.
          </p>
        ) : (
          <div className="space-y-3">
            {endedEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-muted">
                      ENDED
                    </span>
                    <h3 className="text-base font-semibold text-ink">{event.title}</h3>
                    <span className="text-sm text-muted">{guestCountLabel(event.guest_count)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openRoster(event)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-subtle"
                  >
                    <Eye size={16} aria-hidden="true" />
                    View Roster
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} title="Create / Schedule Event" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          {createError ? <StatusBanner tone="error" message={createError} /> : null}
          <Field label="Event Name" htmlFor="event-title">
            <input
              id="event-title"
              value={createForm.title}
              onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Coordinators" htmlFor="event-coordinators">
            <input
              id="event-coordinators"
              value={createForm.coordinators}
              onChange={(event) =>
                setCreateForm({ ...createForm, coordinators: event.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Description" htmlFor="event-description">
            <textarea
              id="event-description"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm({ ...createForm, description: event.target.value })
              }
              rows={3}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Initial Status</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, status: 'active' })}
                aria-pressed={createForm.status === 'active'}
                className={`min-h-12 rounded-md border px-4 text-sm font-semibold transition ${
                  createForm.status === 'active'
                    ? 'bg-accent text-white'
                    : 'border-border bg-surface text-muted hover:text-ink'
                }`}
              >
                Active Now
              </button>
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, status: 'scheduled' })}
                aria-pressed={createForm.status === 'scheduled'}
                className={`min-h-12 rounded-md border px-4 text-sm font-semibold transition ${
                  createForm.status === 'scheduled'
                    ? 'bg-accent text-white'
                    : 'border-border bg-surface text-muted hover:text-ink'
                }`}
              >
                Schedule for Later
              </button>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setCreateOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={creating} className={primaryButtonClass}>
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editingEvent !== null}
        title="Edit Event"
        onClose={() => setEditingEvent(null)}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          {editError ? <StatusBanner tone="error" message={editError} /> : null}
          <Field label="Event Name" htmlFor="edit-event-title">
            <input
              id="edit-event-title"
              value={editForm.title}
              onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Coordinators" htmlFor="edit-event-coordinators">
            <input
              id="edit-event-coordinators"
              value={editForm.coordinators}
              onChange={(event) => setEditForm({ ...editForm, coordinators: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Description" htmlFor="edit-event-description">
            <textarea
              id="edit-event-description"
              value={editForm.description}
              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              rows={3}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditingEvent(null)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmEnd !== null}
        title="End event?"
        description={
          confirmEnd
            ? `${confirmEnd.title} will move to Previous Events and guest sign-in will be blocked.`
            : undefined
        }
        confirmLabel="End Event"
        destructive
        onConfirm={handleEnd}
        onCancel={() => setConfirmEnd(null)}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete event?"
        description={
          confirmDelete
            ? `${confirmDelete.title} and all of its guest records will be removed permanently.`
            : undefined
        }
        confirmLabel="Delete Event"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <Modal
        open={rosterEvent !== null}
        title={rosterEvent ? `${rosterEvent.title} Roster` : 'Event Roster'}
        onClose={() => setRosterEvent(null)}
        wide
        footer={
          <>
            <button type="button" onClick={() => setRosterEvent(null)} className={secondaryButtonClass}>
              Close
            </button>
            <button type="button" onClick={handleExportRoster} className={primaryButtonClass}>
              <Download size={16} aria-hidden="true" />
              Export Roster CSV
            </button>
          </>
        }
      >
        {rosterLoading ? (
          <p className="py-6 text-center text-sm text-muted">Loading roster...</p>
        ) : rosterGuests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No guests checked in for this event.</p>
        ) : (
          <div className="divide-y divide-border">
            {rosterGuests.map((guest) => (
              <div key={guest.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{guest.full_name}</p>
                  <p className="text-xs text-muted">
                    {guest.organization ?? '—'} | {guest.contact ?? '—'}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {formatTimeFromTimestamp(guest.checked_in_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </section>
  )
}

const inputClass =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-accent/25 focus:outline-none'

const primaryButtonClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60'

const secondaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-subtle'

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
