import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { AdminModal, AdminModalHost } from '@/components/admin/AdminModal'
import { CheckRow } from '@/components/admin/CheckRow'
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotConfigured,
} from '@/components/admin/StatePanels'
import { Button } from '@/components/ui/Button'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

const EDITABLE_KEYS = ['social-media-marketing', 'video-editing', 'graphic-design']

const formFromItem = (item) => ({
  title: item.title ?? '',
  description: item.description ?? '',
  starting_price: item.starting_price ?? '',
  content: item.content ?? '',
  active: item.active !== false,
})

/**
 * Marketing management: edit the three marketing offerings (social media
 * marketing, video editing, graphic design), their descriptions, starting
 * prices and active state.
 */
export default function AdminMarketing() {
  const query = useSupabaseQuery(
    (client) => client.from('marketing_services').select('*').order('sort_order', { ascending: true }),
    []
  )
  const items = Array.isArray(query.data) ? query.data : []

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const editable = items.filter((item) => EDITABLE_KEYS.includes(item.key))
  const extras = items.filter((item) => !EDITABLE_KEYS.includes(item.key))

  const openEdit = (item) => {
    setForm(formFromItem(item))
    setFormError(null)
    setModal({ type: 'edit', item })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) {
      return
    }
    if (!form.title.trim()) {
      setFormError('Title is required.')
      return
    }

    setBusy(true)
    setFormError(null)
    try {
      const { error: updateError } = await supabase
        .from('marketing_services')
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          starting_price: form.starting_price.trim() || null,
          content: form.content || null,
          active: form.active,
        })
        .eq('id', modal.item.id)
      if (updateError) {
        throw updateError
      }
      setModal(null)
      query.refetch()
    } catch (submitError) {
      setFormError(friendlyDbError(submitError))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (item) => {
    setBusy(true)
    try {
      const { error } = await supabase
        .from('marketing_services')
        .update({ active: !item.active })
        .eq('id', item.id)
      if (error) {
        throw error
      }
      query.refetch()
    } catch (toggleError) {
      setFormError(friendlyDbError(toggleError))
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
        .from('marketing_services')
        .delete()
        .eq('id', modal.item.id)
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

  const row = (item) => (
    <tr key={item.id}>
      <td data-label="Offer">
        <span className="mp-adm-table__strong">{item.title}</span>
        <span className="mp-adm-table__sub">{item.key}</span>
      </td>
      <td data-label="Starting Price">{item.starting_price || 'Not set'}</td>
      <td data-label="State">
        <span className={`mp-adm-badge ${item.active ? 'mp-adm-badge--active' : 'mp-adm-badge--inactive'}`}>
          {item.active ? 'Active' : 'Hidden'}
        </span>
      </td>
      <td data-label="Actions" className="mp-adm-table__actions">
        <button
          type="button"
          className="mp-adm-btn mp-adm-btn--sm mp-adm-btn--secondary"
          onClick={() => toggleActive(item)}
          disabled={busy}
        >
          {item.active ? 'Hide' : 'Show'}
        </button>
        <button type="button" className="mp-adm-iconbtn" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`}>
          <Pencil size={15} aria-hidden="true" />
        </button>
      </td>
    </tr>
  )

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Marketing</h1>
          <p className="mp-adm-page__sub">
            Edit the three marketing offers. The public page consumes these in a later phase.
          </p>
        </div>
      </header>

      {!query.configured ? (
        <AdminNotConfigured />
      ) : query.status === 'loading' ? (
        <AdminLoading label="Loading marketing offers" />
      ) : query.status === 'error' ? (
        <AdminError message={query.error} onRetry={query.refetch} />
      ) : editable.length === 0 ? (
        <AdminEmpty
          title="No marketing offers in the database yet"
          note="Run the seed step from supabase/README.md to create the three marketing offers, or the public page keeps its current built-in content."
        />
      ) : (
        <>
          <div className="mp-adm-tablewrap">
            <table className="mp-adm-table">
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Starting Price</th>
                  <th>State</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {editable.map(row)}
                {extras.map(row)}
              </tbody>
            </table>
          </div>
          <p className="mp-adm-form__note">
            Prices and inclusions shown on the public marketing page remain exactly as set in
            the website build until the page is switched to the database.
          </p>
        </>
      )}

      <AdminModalHost>
        {modal?.type === 'edit' ? (
          <AdminModal title={`Edit ${modal.item.title}`} onClose={() => setModal(null)} wide>
            <form className="mp-adm-form" onSubmit={handleSubmit} noValidate>
              <label className="mp-field">
                <span className="mp-field__label">Title</span>
                <input
                  className="mp-field__input"
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </label>
              <label className="mp-field">
                <span className="mp-field__label">Description</span>
                <textarea
                  className="mp-field__input mp-field__input--area"
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <label className="mp-field">
                <span className="mp-field__label">Starting Price</span>
                <input
                  className="mp-field__input"
                  type="text"
                  value={form.starting_price}
                  onChange={(event) => setForm({ ...form, starting_price: event.target.value })}
                  placeholder="For example ₹1,500"
                />
              </label>
              <label className="mp-field">
                <span className="mp-field__label">Inclusions / content</span>
                <textarea
                  className="mp-field__input mp-field__input--area"
                  rows={4}
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="What the offer includes"
                />
              </label>
              <div className="mp-adm-form__checks">
                <CheckRow
                  label="Active"
                  note="Hidden offers are kept in the database but not served."
                  checked={form.active}
                  onChange={(value) => setForm({ ...form, active: value })}
                />
              </div>

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
                  {busy ? 'Saving' : 'Save changes'}
                </button>
              </div>
            </form>
          </AdminModal>
        ) : null}

        {modal?.type === 'delete' ? (
          <AdminModal title={`Delete ${modal.item.title}?`} onClose={() => setModal(null)}>
            <p className="mp-adm-confirm__text">This permanently removes the marketing offer. This cannot be undone.</p>
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
                {busy ? 'Deleting' : 'Delete offer'}
              </button>
            </div>
          </AdminModal>
        ) : null}
      </AdminModalHost>
    </div>
  )
}
