import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { AdminModal, AdminModalHost } from '@/components/admin/AdminModal'
import { CheckRow } from '@/components/admin/CheckRow'
import { AdminEmpty, AdminError, AdminLoading, AdminNotConfigured } from '@/components/admin/StatePanels'
import { Button } from '@/components/ui/Button'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'
import { slugify } from '@/lib/utils'
import { SERVICES } from '@/data/services'

const EMPTY_FORM = { title: '', slug: '', slugTouched: false, description: '', image: '', price: '', sort_order: 0, active: true }

export default function AdminServices() {
  const query = useSupabaseQuery((client) => client.from('services').select('*').order('sort_order', { ascending: true }), [])
  const services = Array.isArray(query.data) ? query.data : []
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const filtered = services.filter((service) => {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return [service.title, service.slug].some((value) => (value || '').toLowerCase().includes(needle))
  })

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, sort_order: services.length + 1 })
    setFormError(null)
    setModal({ type: 'add' })
  }

  const openEdit = (service) => {
    setForm({
      title: service.title ?? '',
      slug: service.slug ?? '',
      slugTouched: true,
      description: service.description ?? '',
      image: service.image ?? '',
      price: service.price ?? '',
      sort_order: service.sort_order ?? 0,
      active: service.active !== false,
    })
    setFormError(null)
    setModal({ type: 'edit', service })
  }

  const handleTitle = (title) => setForm((previous) => ({ ...previous, title, slug: previous.slugTouched ? previous.slug : slugify(title) }))

  const syncMarkipieCatalog = async () => {
    if (busy || !supabase) return
    setBusy(true)
    setFormError(null)
    try {
      const rows = SERVICES.map((service, index) => ({
        title: service.title, slug: service.slug, description: service.text || null,
        image: service.image || null, price: null, sort_order: index + 1, active: true,
      }))
      const { error } = await supabase.from('services').upsert(rows, { onConflict: 'slug' })
      if (error) throw error
      await query.refetch()
    } catch (syncError) {
      setFormError(friendlyDbError(syncError))
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (!form.title.trim()) { setFormError('Title is required.'); return }
    const slug = (form.slugTouched ? form.slug : slugify(form.title)).trim() || slugify(form.title)
    setBusy(true); setFormError(null)
    try {
      const payload = {
        title: form.title.trim(), slug, description: form.description.trim() || null,
        image: form.image.trim() || null, price: form.price.trim() || null,
        sort_order: Number(form.sort_order) || 0, active: form.active,
      }
      const result = modal.type === 'add'
        ? await supabase.from('services').insert(payload)
        : await supabase.from('services').update(payload).eq('id', modal.service.id)
      if (result.error) throw result.error
      setModal(null)
      await query.refetch()
    } catch (submitError) {
      setFormError(friendlyDbError(submitError))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (service) => {
    setBusy(true); setFormError(null)
    try {
      const { error } = await supabase.from('services').update({ active: !service.active }).eq('id', service.id)
      if (error) throw error
      await query.refetch()
    } catch (toggleError) {
      setFormError(friendlyDbError(toggleError))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (busy) return
    setBusy(true); setFormError(null)
    try {
      const { error } = await supabase.from('services').delete().eq('id', modal.service.id)
      if (error) throw error
      setModal(null)
      await query.refetch()
    } catch (deleteError) {
      setFormError(friendlyDbError(deleteError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Services</h1>
          <p className="mp-adm-page__sub">Studio service records. Load the full Markipie catalog or add custom services here.</p>
        </div>
        {query.configured ? (
          <div className="mp-adm-page__actions">
            <Button variant="secondary" onClick={syncMarkipieCatalog} disabled={busy}>{busy ? 'Syncing' : 'Load Markipie Catalog'}</Button>
            <Button onClick={openAdd} disabled={busy}><Plus size={16} aria-hidden="true" /> Add Service</Button>
          </div>
        ) : null}
      </header>

      {!query.configured ? <AdminNotConfigured /> : query.status === 'loading' ? <AdminLoading label="Loading services" /> : query.status === 'error' ? (
        <>
          <AdminError message={query.error} onRetry={query.refetch} />
          <div className="mp-adm-page__actions" style={{ marginTop: '1rem' }}>
            <Button variant="secondary" onClick={syncMarkipieCatalog} disabled={busy}>{busy ? 'Syncing' : 'Load Markipie Catalog'}</Button>
            <Button onClick={openAdd} disabled={busy}><Plus size={16} aria-hidden="true" /> Add Service</Button>
          </div>
        </>
      ) : services.length === 0 ? (
        <AdminEmpty title="No services in the database yet" note="Load the complete Markipie service catalog first, or add a custom service manually."
          action={<div className="mp-adm-page__actions"><Button onClick={syncMarkipieCatalog} disabled={busy}>Load Markipie Catalog</Button><Button variant="secondary" onClick={openAdd} disabled={busy}><Plus size={16} aria-hidden="true" /> Add Service</Button></div>} />
      ) : (
        <>
          <div className="mp-adm-search"><Search size={15} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services" aria-label="Search services" /></div>
          <div className="mp-adm-tablewrap">
            <table className="mp-adm-table"><thead><tr><th>Service</th><th>Price</th><th>Sort</th><th>State</th><th aria-label="Actions" /></tr></thead>
              <tbody>{filtered.map((service) => (
                <tr key={service.id}>
                  <td data-label="Service"><span className="mp-adm-table__strong">{service.title}</span><span className="mp-adm-table__sub">/{service.slug}</span></td>
                  <td data-label="Price">{service.price || 'Not set'}</td><td data-label="Sort">{service.sort_order}</td>
                  <td data-label="State"><span className={`mp-adm-badge ${service.active ? 'mp-adm-badge--active' : 'mp-adm-badge--inactive'}`}>{service.active ? 'Enabled' : 'Disabled'}</span></td>
                  <td data-label="Actions" className="mp-adm-table__actions">
                    <button type="button" className="mp-adm-btn mp-adm-btn--sm mp-adm-btn--secondary" onClick={() => toggleActive(service)} disabled={busy}>{service.active ? 'Disable' : 'Enable'}</button>
                    <button type="button" className="mp-adm-iconbtn" onClick={() => openEdit(service)} aria-label={`Edit ${service.title}`}><Pencil size={15} aria-hidden="true" /></button>
                    <button type="button" className="mp-adm-iconbtn mp-adm-iconbtn--danger" onClick={() => { setFormError(null); setModal({ type: 'delete', service }) }} aria-label={`Delete ${service.title}`}><Trash2 size={15} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      <AdminModalHost>
        {modal?.type === 'add' || modal?.type === 'edit' ? (
          <AdminModal title={modal.type === 'add' ? 'Add Service' : `Edit ${modal.service.title}`} onClose={() => setModal(null)}>
            <form className="mp-adm-form" onSubmit={handleSubmit} noValidate>
              <label className="mp-field"><span className="mp-field__label">Title</span><input className="mp-field__input" type="text" value={form.title} onChange={(event) => handleTitle(event.target.value)} placeholder="For example Wedding Photography" required /></label>
              <div className="mp-adm-form__row">
                <label className="mp-field"><span className="mp-field__label">Slug</span><input className="mp-field__input" type="text" value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value), slugTouched: true })} placeholder="auto-from-title" /></label>
                <label className="mp-field"><span className="mp-field__label">Price</span><input className="mp-field__input" type="text" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="For example On request" /></label>
              </div>
              <label className="mp-field"><span className="mp-field__label">Image URL</span><input className="mp-field__input" type="url" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://" /></label>
              <label className="mp-field"><span className="mp-field__label">Description</span><textarea className="mp-field__input mp-field__input--area" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Short description" /></label>
              <div className="mp-adm-form__row">
                <label className="mp-field"><span className="mp-field__label">Sort order</span><input className="mp-field__input" type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
                <div className="mp-adm-form__checks mp-adm-form__checks--solo"><CheckRow label="Active" checked={form.active} onChange={(value) => setForm({ ...form, active: value })} /></div>
              </div>
              {formError ? <p className="mp-adm-form__error" role="alert">{formError}</p> : null}
              <div className="mp-adm-form__actions">
                <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="mp-adm-btn mp-adm-btn--primary" disabled={busy}>{busy ? 'Saving' : modal.type === 'add' ? 'Add Service' : 'Save changes'}</button>
              </div>
            </form>
          </AdminModal>
        ) : null}
        {modal?.type === 'delete' ? (
          <AdminModal title={`Delete ${modal.service.title}?`} onClose={() => setModal(null)}>
            <p className="mp-adm-confirm__text">This permanently removes the service record. This cannot be undone.</p>
            {formError ? <p className="mp-adm-form__error" role="alert">{formError}</p> : null}
            <div className="mp-adm-form__actions">
              <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="mp-adm-btn mp-adm-btn--danger" onClick={handleDelete} disabled={busy}>{busy ? 'Deleting' : 'Delete service'}</button>
            </div>
          </AdminModal>
        ) : null}
      </AdminModalHost>
    </div>
  )
}
