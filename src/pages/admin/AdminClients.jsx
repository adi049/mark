import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Copy, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { AdminModal, AdminModalHost } from '@/components/admin/AdminModal'
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
import { generateUniqueCode } from '@/lib/accessCodes'
import { friendlyDbError } from '@/lib/dbErrors'
import { formatDate, statusLabel } from '@/lib/format'

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  event_name: '',
  event_type: '',
  event_date: '',
  status: 'active',
}

/**
 * Client management: list with live search, add and edit forms with
 * automatically generated unique access codes, a detail view with the
 * client's events, and delete with an explicit warning.
 */
export default function AdminClients() {
  const { status, data, error, refetch, configured } = useSupabaseQuery(
    (client) => client.from('clients').select('*'),
    []
  )
  const eventsQuery = useSupabaseQuery((client) => client.from('events').select('*'), [])

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(null)

  const clients = Array.isArray(data) ? data : []
  const events = Array.isArray(eventsQuery.data) ? eventsQuery.data : []

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) {
      return clients
    }
    return clients.filter((client) =>
      [client.name, client.event_name, client.client_code, client.phone, client.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    )
  }, [clients, search])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setModal({ type: 'add' })
  }

  const openEdit = (client) => {
    setForm({
      name: client.name ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      event_name: client.event_name ?? '',
      event_type: client.event_type ?? '',
      event_date: client.event_date ?? '',
      status: client.status ?? 'active',
    })
    setFormError(null)
    setModal({ type: 'edit', client })
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
    if (!form.name.trim()) {
      setFormError('Client name is required.')
      return
    }

    setBusy(true)
    setFormError(null)
    try {
      if (modal.type === 'add') {
        const code = await generateUniqueCode('clients', 'client_code', supabase)
        if (!code) {
          throw new Error('Could not generate a unique access code. Please try again.')
        }
        const { error: insertError } = await supabase.from('clients').insert({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          client_code: code,
          event_name: form.event_name.trim() || null,
          event_type: form.event_type || null,
          event_date: form.event_date || null,
          status: form.status,
        })
        if (insertError) {
          throw insertError
        }
      } else {
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            event_name: form.event_name.trim() || null,
            event_type: form.event_type || null,
            event_date: form.event_date || null,
            status: form.status,
          })
          .eq('id', modal.client.id)
        if (updateError) {
          throw updateError
        }
      }
      setModal(null)
      refetch()
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
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', modal.client.id)
      if (deleteError) {
        throw deleteError
      }
      setModal(null)
      refetch()
      eventsQuery.refetch()
    } catch (deleteError) {
      setFormError(friendlyDbError(deleteError))
    } finally {
      setBusy(false)
    }
  }

  const clientEvents = (clientId) => events.filter((event) => event.client_id === clientId)

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Clients</h1>
          <p className="mp-adm-page__sub">
            {configured ? `${clients.length} client${clients.length === 1 ? '' : 's'} in the studio` : 'Studio client records'}
          </p>
        </div>
        {configured && status === 'success' ? (
          <Button onClick={openAdd}>
            <Plus size={16} aria-hidden="true" />
            Add Client
          </Button>
        ) : null}
      </header>

      {!configured ? (
        <AdminNotConfigured />
      ) : status === 'loading' ? (
        <AdminLoading label="Loading clients" />
      ) : status === 'error' ? (
        <AdminError message={error} onRetry={refetch} />
      ) : clients.length === 0 ? (
        <AdminEmpty
          title="No clients yet"
          note="Add the first client to generate their MP access code."
          action={
            <Button onClick={openAdd}>
              <Plus size={16} aria-hidden="true" />
              Add Client
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
              placeholder="Search name, event, code or phone"
              aria-label="Search clients"
            />
          </div>

          {filtered.length === 0 ? (
            <AdminEmpty title="No clients match that search" note="Try a different name or code." />
          ) : (
            <div className="mp-adm-tablewrap">
              <table className="mp-adm-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Event</th>
                    <th>Event Date</th>
                    <th>Access Code</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr key={client.id}>
                      <td data-label="Client">
                        <span className="mp-adm-table__strong">{client.name}</span>
                        {client.phone ? <span className="mp-adm-table__sub">{client.phone}</span> : null}
                      </td>
                      <td data-label="Event">
                        <span>{client.event_name || 'Not set'}</span>
                        {client.event_type ? (
                          <span className="mp-adm-table__sub">{client.event_type}</span>
                        ) : null}
                      </td>
                      <td data-label="Event Date">{formatDate(client.event_date)}</td>
                      <td data-label="Access Code">
                        <span className="mp-adm-code">
                          {client.client_code}
                          <button
                            type="button"
                            className="mp-adm-code__copy"
                            onClick={() => copyCode(client.client_code)}
                            aria-label={`Copy access code ${client.client_code}`}
                          >
                            <Copy size={13} aria-hidden="true" />
                          </button>
                          {copied === client.client_code ? (
                            <span className="mp-adm-code__done" role="status">
                              Copied
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`mp-adm-badge mp-adm-badge--${client.status}`}>
                          {statusLabel(client.status)}
                        </span>
                      </td>
                      <td data-label="Actions" className="mp-adm-table__actions">
                        <button type="button" className="mp-adm-iconbtn" onClick={() => setModal({ type: 'view', client })} aria-label={`View ${client.name}`}>
                          <Eye size={15} aria-hidden="true" />
                        </button>
                        <button type="button" className="mp-adm-iconbtn" onClick={() => openEdit(client)} aria-label={`Edit ${client.name}`}>
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button type="button" className="mp-adm-iconbtn mp-adm-iconbtn--danger" onClick={() => { setFormError(null); setModal({ type: 'delete', client }) }} aria-label={`Delete ${client.name}`}>
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
            title={modal.type === 'add' ? 'Add Client' : `Edit ${modal.client.name}`}
            onClose={() => setModal(null)}
          >
            <form className="mp-adm-form" onSubmit={handleSubmit} noValidate>
              <label className="mp-field">
                <span className="mp-field__label">Client Name</span>
                <input
                  className="mp-field__input"
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="For example Rahul and Priya"
                  required
                />
              </label>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Phone</span>
                  <input
                    className="mp-field__input"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="10 digit mobile number"
                  />
                </label>
                <label className="mp-field">
                  <span className="mp-field__label">Email</span>
                  <input
                    className="mp-field__input"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="client@email.com"
                  />
                </label>
              </div>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Event Name</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    value={form.event_name}
                    onChange={(event) => setForm({ ...form, event_name: event.target.value })}
                    placeholder="For example Rahul and Priya Wedding"
                  />
                </label>
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
              </div>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Event Date</span>
                  <input
                    className="mp-field__input"
                    type="date"
                    value={form.event_date ?? ''}
                    onChange={(event) => setForm({ ...form, event_date: event.target.value })}
                  />
                </label>
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
                </label>
              </div>

              {modal.type === 'add' ? (
                <p className="mp-adm-form__note">
                  An access code in the format MP-XXXXXX is generated automatically and checked
                  for uniqueness.
                </p>
              ) : (
                <p className="mp-adm-form__note">
                  Access code {modal.client.client_code} stays with the client and cannot be edited here.
                </p>
              )}

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
                  {busy ? 'Saving' : modal.type === 'add' ? 'Add Client' : 'Save changes'}
                </button>
              </div>
            </form>
          </AdminModal>
        ) : null}

        {modal?.type === 'view' ? (
          <AdminModal title={modal.client.name} onClose={() => setModal(null)}>
            <dl className="mp-adm-detail">
              <div>
                <dt>Phone</dt>
                <dd>{modal.client.phone || 'Not set'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{modal.client.email || 'Not set'}</dd>
              </div>
              <div>
                <dt>Access code</dt>
                <dd className="mp-adm-code mp-adm-code--plain">{modal.client.client_code}</dd>
              </div>
              <div>
                <dt>Event</dt>
                <dd>
                  {[modal.client.event_name, modal.client.event_type, formatDate(modal.client.event_date)]
                    .filter(Boolean)
                    .join(' · ') || 'Not set'}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`mp-adm-badge mp-adm-badge--${modal.client.status}`}>
                    {statusLabel(modal.client.status)}
                  </span>
                </dd>
              </div>
            </dl>

            <h3 className="mp-adm-subhead">Events ({clientEvents(modal.client.id).length})</h3>
            {clientEvents(modal.client.id).length === 0 ? (
              <p className="mp-adm-form__note">
                No events for this client yet. Events are created independently in the Events
                section.
              </p>
            ) : (
              <ul className="mp-adm-minilist">
                {clientEvents(modal.client.id).map((event) => (
                  <li key={event.id}>
                    <CalendarDays size={14} aria-hidden="true" />
                    <span className="mp-adm-minilist__name">{event.name}</span>
                    <span className="mp-adm-minilist__meta">
                      {[event.event_type, formatDate(event.event_date)].filter(Boolean).join(' · ') || 'No date'}
                    </span>
                    <span className={`mp-adm-badge mp-adm-badge--${event.status}`}>
                      {statusLabel(event.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mp-adm-form__actions">
              <Link className="mp-adm-btn mp-adm-btn--secondary" to="/admin/events">
                Manage events
              </Link>
            </div>
          </AdminModal>
        ) : null}

        {modal?.type === 'delete' ? (
          <AdminModal title={`Delete ${modal.client.name}?`} onClose={() => setModal(null)}>
            <p className="mp-adm-confirm__text">
              This permanently removes the client record and every event, folder and media
              entry linked to them. This cannot be undone.
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
                {busy ? 'Deleting' : 'Delete client'}
              </button>
            </div>
          </AdminModal>
        ) : null}
      </AdminModalHost>
    </div>
  )
}
