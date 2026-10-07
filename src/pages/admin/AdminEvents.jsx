import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Images, Pencil, Plus, QrCode, Search, Trash2 } from 'lucide-react'
import { AdminModal, AdminModalHost } from '@/components/admin/AdminModal'
import { CheckRow } from '@/components/admin/CheckRow'
import { QrPanel } from '@/components/admin/QrPanel'
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotConfigured,
} from '@/components/admin/StatePanels'
import { Button } from '@/components/ui/Button'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { EVENT_TYPES, RECORD_STATUSES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { generateEventToken, generateUniqueCode } from '@/lib/accessCodes'
import { friendlyDbError } from '@/lib/dbErrors'
import { formatDate, statusLabel } from '@/lib/format'

const PERMISSIONS = [
  { key: 'watermark_enabled', label: 'Watermark' },
  { key: 'download_enabled', label: 'Download permission' },
  { key: 'face_scan_enabled', label: 'Face scan' },
  { key: 'reaction_enabled', label: 'Like/Dislike' },
  { key: 'instagram_gate_enabled', label: 'Instagram gate' },
]

const EMPTY_FORM = {
  client_id: '',
  name: '',
  event_type: '',
  event_date: '',
  access_code: '',
  watermark_enabled: true,
  download_enabled: true,
  face_scan_enabled: false,
  reaction_enabled: true,
  instagram_gate_enabled: true,
  status: 'active',
}

/**
 * Event management: one or more events per client, each with its own
 * access code, QR token, permission flags and status. Only active events
 * resolve through the public client access lookup.
 */
export default function AdminEvents() {
  const query = useSupabaseQuery(async (client) => {
    const [clientsResult, eventsResult] = await Promise.all([
      client.from('clients').select('*').order('name', { ascending: true }),
      client.from('events').select('*').order('created_at', { ascending: false }),
    ])
    if (clientsResult.error) {
      throw clientsResult.error
    }
    if (eventsResult.error) {
      throw eventsResult.error
    }
    return { clients: clientsResult.data, events: eventsResult.data }
  }, [])

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [qrEvent, setQrEvent] = useState(null)
  const [copied, setCopied] = useState(null)

  const clients = Array.isArray(query.data?.clients) ? query.data.clients : []
  const events = Array.isArray(query.data?.events) ? query.data.events : []
  const clientName = useMemo(() => {
    const map = new Map(clients.map((client) => [client.id, client.name]))
    return (id) => map.get(id) ?? 'Unknown client'
  }, [clients])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) {
      return events
    }
    return events.filter((event) =>
      [event.name, event.event_type, event.access_code, clientName(event.client_id)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    )
  }, [events, search, clientName])

  const openAdd = () => {
    setForm({ ...EMPTY_FORM })
    setFormError(null)
    setModal({ type: 'add' })
  }

  const openEdit = (event) => {
    setForm({
      client_id: event.client_id ?? '',
      name: event.name ?? '',
      event_type: event.event_type ?? '',
      event_date: event.event_date ?? '',
      access_code: event.access_code ?? '',
      watermark_enabled: event.watermark_enabled ?? true,
      download_enabled: event.download_enabled ?? true,
      face_scan_enabled: event.face_scan_enabled ?? false,
      reaction_enabled: event.reaction_enabled ?? true,
      instagram_gate_enabled: event.instagram_gate_enabled ?? true,
      status: event.status ?? 'active',
    })
    setFormError(null)
    setModal({ type: 'edit', event })
  }

  const regenerateCode = async () => {
    const code = await generateUniqueCode('events', 'access_code', supabase)
    if (code) {
      setForm((previous) => ({ ...previous, access_code: code }))
    }
  }

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) {
      return
    }
    if (!form.client_id) {
      setFormError('Choose the client this event belongs to.')
      return
    }
    if (!form.name.trim()) {
      setFormError('Event name is required.')
      return
    }

    setBusy(true)
    setFormError(null)
    try {
      const payload = {
        client_id: form.client_id,
        name: form.name.trim(),
        event_type: form.event_type || null,
        event_date: form.event_date || null,
        access_code: form.access_code.trim(),
        watermark_enabled: form.watermark_enabled,
        download_enabled: form.download_enabled,
        face_scan_enabled: form.face_scan_enabled,
        reaction_enabled: form.reaction_enabled,
        instagram_gate_enabled: form.instagram_gate_enabled,
        status: form.status,
      }

      if (modal.type === 'add') {
        if (!payload.access_code) {
          const code = await generateUniqueCode('events', 'access_code', supabase)
          if (!code) {
            throw new Error('Could not generate a unique access code. Please try again.')
          }
          payload.access_code = code
        }
        // Every new event gets a QR token immediately, so the QR panel is
        // usable as soon as the event is created without a second setup step.
        payload.qr_token = generateEventToken()
        const { error: insertError } = await supabase.from('events').insert(payload)
        if (insertError) {
          throw insertError
        }
      } else {
        const { error: updateError } = await supabase
          .from('events')
          .update(payload)
          .eq('id', modal.event.id)
        if (updateError) {
          throw updateError
        }
      }
      setModal(null)
      query.refetch()
    } catch (submitError) {
      setFormError(friendlyDbError(submitError))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      const { error: deleteError } = await supabase.from('events').delete().eq('id', modal.event.id)
      if (deleteError) {
        throw deleteError
      }
      setModal(null)
      query.refetch()
    } catch (deleteError) {
      setFormError(friendlyDbError(deleteError))
    } finally {
      setBusy(false)
    }
  }

  const handleTokenChange = async (token) => {
    if (!qrEvent) {
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ qr_token: token })
        .eq('id', qrEvent.id)
      if (updateError) {
        throw updateError
      }
      setQrEvent({ ...qrEvent, qr_token: token })
      query.refetch()
    } catch (updateError) {
      setFormError(friendlyDbError(updateError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Events</h1>
          <p className="mp-adm-page__sub">
            {query.configured && query.status === 'success'
              ? `${events.length} event${events.length === 1 ? '' : 's'} across ${clients.length} client${clients.length === 1 ? '' : 's'}`
              : 'One or more events per client'}
          </p>
        </div>
        {query.configured && query.status === 'success' && clients.length > 0 ? (
          <Button onClick={openAdd}>
            <Plus size={16} aria-hidden="true" />
            Add Event
          </Button>
        ) : null}
      </header>

      {!query.configured ? (
        <AdminNotConfigured />
      ) : query.status === 'loading' ? (
        <AdminLoading label="Loading events" />
      ) : query.status === 'error' ? (
        <AdminError message={query.error} onRetry={query.refetch} />
      ) : clients.length === 0 ? (
        <AdminEmpty
          title="Add a client first"
          note="Events belong to clients. Create a client, then add their engagement, haldi, mehendi, wedding or reception events."
          action={<Button to="/admin/clients">Go to clients</Button>}
        />
      ) : events.length === 0 ? (
        <AdminEmpty
          title="No events yet"
          note="Create the first event for a client. Each event gets its own access code and QR."
          action={
            <Button onClick={openAdd}>
              <Plus size={16} aria-hidden="true" />
              Add Event
            </Button>
          }
        />
      ) : (
        <>
          <div className="mp-adm-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event, client, type or code"
              aria-label="Search events"
            />
          </div>

          {filtered.length === 0 ? (
            <AdminEmpty title="No events match that search" />
          ) : (
            <div className="mp-adm-tablewrap">
              <table className="mp-adm-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Access Code</th>
                    <th>Settings</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => (
                    <tr key={event.id}>
                      <td data-label="Event">
                        <span className="mp-adm-table__strong">{event.name}</span>
                        {event.event_type ? (
                          <span className="mp-adm-table__sub">{event.event_type}</span>
                        ) : null}
                      </td>
                      <td data-label="Client">{clientName(event.client_id)}</td>
                      <td data-label="Date">{formatDate(event.event_date)}</td>
                      <td data-label="Access Code">
                        <span className="mp-adm-code">
                          {event.access_code}
                          <button
                            type="button"
                            className="mp-adm-code__copy"
                            onClick={() => copyCode(event.access_code)}
                            aria-label={`Copy access code ${event.access_code}`}
                          >
                            <Copy size={13} aria-hidden="true" />
                          </button>
                          {copied === event.access_code ? (
                            <span className="mp-adm-code__done" role="status">
                              Copied
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td data-label="Settings">
                        <span className="mp-adm-flags">
                          {PERMISSIONS.map((permission) => (
                            <span
                              key={permission.key}
                              className={`mp-adm-flag${event[permission.key] ? ' is-on' : ''}`}
                              title={`${permission.label}: ${event[permission.key] ? 'ON' : 'OFF'}`}
                            >
                              {permission.label.split(' ')[0]}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`mp-adm-badge mp-adm-badge--${event.status}`}>
                          {statusLabel(event.status)}
                        </span>
                      </td>
                      <td data-label="Actions" className="mp-adm-table__actions">
                        <button
                          type="button"
                          className="mp-adm-iconbtn"
                          onClick={() => { setQrEvent(event); setFormError(null) }}
                          aria-label={`QR code for ${event.name}`}
                        >
                          <QrCode size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="mp-adm-iconbtn"
                          onClick={() => openEdit(event)}
                          aria-label={`Edit ${event.name}`}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="mp-adm-iconbtn mp-adm-iconbtn--danger"
                          onClick={() => { setFormError(null); setModal({ type: 'delete', event }) }}
                          aria-label={`Delete ${event.name}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AdminModalHost>
        {modal?.type === 'add' || modal?.type === 'edit' ? (
          <AdminModal
            title={modal.type === 'add' ? 'Add Event' : `Edit ${modal.event.name}`}
            onClose={() => setModal(null)}
            wide
          >
            <form className="mp-adm-form" onSubmit={handleSubmit} noValidate>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Client</span>
                  <select
                    className="mp-field__input"
                    value={form.client_id}
                    onChange={(event) => setForm({ ...form, client_id: event.target.value })}
                    required
                  >
                    <option value="">Choose client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mp-field">
                  <span className="mp-field__label">Event Name</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="For example Rahul and Priya Wedding"
                    required
                  />
                </label>
              </div>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Event Type</span>
                  <select
                    className="mp-field__input"
                    value={form.event_type}
                    onChange={(event) => setForm({ ...form, event_type: event.target.value })}
                  >
                    <option value="">Select type</option>
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mp-field">
                  <span className="mp-field__label">Event Date</span>
                  <input
                    className="mp-field__input"
                    type="date"
                    value={form.event_date ?? ''}
                    onChange={(event) => setForm({ ...form, event_date: event.target.value })}
                  />
                </label>
              </div>
              <label className="mp-field">
                <span className="mp-field__label">Access Code</span>
                <span className="mp-adm-form__inline">
                  <input
                    className="mp-field__input mp-adm-code--input"
                    type="text"
                    value={form.access_code}
                    onChange={(event) => setForm({ ...form, access_code: event.target.value.toUpperCase() })}
                    placeholder="MP-XXXXXX"
                  />
                  <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={regenerateCode}>
                    Generate
                  </button>
                </span>
              </label>

              <fieldset className="mp-adm-form__group">
                <legend>Event permissions</legend>
                <div className="mp-adm-form__checks">
                  {PERMISSIONS.map((permission) => (
                    <CheckRow
                      key={permission.key}
                      label={permission.label}
                      checked={form[permission.key]}
                      onChange={(value) => setForm({ ...form, [permission.key]: value })}
                    />
                  ))}
                </div>
                <p className="mp-adm-form__note">
                  These settings are stored now and will control the client gallery when it
                  launches.
                </p>
              </fieldset>

              <label className="mp-field">
                <span className="mp-field__label">Status</span>
                <select
                  className="mp-field__input"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  {RECORD_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <span className="mp-adm-form__help">Only active events open through Client Access.</span>
              </label>

              {formError ? (
                <p className="mp-adm-form__error" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="mp-adm-form__actions">
                <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="mp-adm-btn mp-adm-btn--primary" disabled={busy}>
                  {busy ? 'Saving' : modal.type === 'add' ? 'Add Event' : 'Save changes'}
                </button>
              </div>
            </form>
          </AdminModal>
        ) : null}

        {modal?.type === 'delete' ? (
          <AdminModal title={`Delete ${modal.event.name}?`} onClose={() => setModal(null)}>
            <p className="mp-adm-confirm__text">
              This permanently removes the event, its folders and media entries, and retires
              its access code and QR. This cannot be undone.
            </p>
            {formError ? (
              <p className="mp-adm-form__error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="mp-adm-form__actions">
              <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button" className="mp-adm-btn mp-adm-btn--danger" onClick={handleDelete} disabled={busy}>
                {busy ? 'Deleting' : 'Delete event'}
              </button>
            </div>
          </AdminModal>
        ) : null}

        {qrEvent ? (
          <AdminModal title={`QR code · ${qrEvent.name}`} onClose={() => setQrEvent(null)}>
            {formError ? (
              <p className="mp-adm-form__error" role="alert">
                {formError}
              </p>
            ) : null}
            <QrPanel event={qrEvent} onTokenChange={handleTokenChange} />
          </AdminModal>
        ) : null}
      </AdminModalHost>
    </div>
  )
}
