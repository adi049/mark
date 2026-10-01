import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import { formatDate } from '@/lib/format'
import { slugify } from '@/lib/utils'

const EMPTY_FORM = {
  title: '',
  slug: '',
  slugTouched: false,
  excerpt: '',
  content: '',
  cover_image: '',
  category: '',
  published: false,
}

/**
 * Blog management: create, edit, delete, publish and unpublish. The
 * public journal reads exactly what is published here.
 */
export default function AdminBlogs() {
  const query = useSupabaseQuery(
    (client) => client.from('blogs').select('*').order('created_at', { ascending: false }),
    []
  )
  const posts = Array.isArray(query.data) ? query.data : []

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const filtered = posts.filter((post) => {
    const needle = search.trim().toLowerCase()
    if (!needle) {
      return true
    }
    return [post.title, post.category, post.slug]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle))
  })

  const openAdd = () => {
    setForm({ ...EMPTY_FORM })
    setFormError(null)
    setModal({ type: 'add' })
  }

  const openEdit = (post) => {
    setForm({
      title: post.title ?? '',
      slug: post.slug ?? '',
      slugTouched: true,
      excerpt: post.excerpt ?? '',
      content: post.content ?? '',
      cover_image: post.cover_image ?? '',
      category: post.category ?? '',
      published: Boolean(post.published),
    })
    setFormError(null)
    setModal({ type: 'edit', post })
  }

  const handleTitle = (title) => {
    setForm((previous) => ({
      ...previous,
      title,
      slug: previous.slugTouched ? previous.slug : slugify(title),
    }))
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

    const slug = (form.slugTouched ? form.slug : slugify(form.title)).trim() || slugify(form.title)

    setBusy(true)
    setFormError(null)
    try {
      const base = {
        title: form.title.trim(),
        slug,
        excerpt: form.excerpt.trim() || null,
        content: form.content || null,
        cover_image: form.cover_image.trim() || null,
        category: form.category.trim() || null,
        published: form.published,
      }

      if (modal.type === 'add') {
        const { error: insertError } = await supabase.from('blogs').insert({
          ...base,
          published_at: form.published ? new Date().toISOString() : null,
        })
        if (insertError) {
          throw insertError
        }
      } else {
        const previous = modal.post
        const { error: updateError } = await supabase
          .from('blogs')
          .update({
            ...base,
            published_at: base.published
              ? previous.published_at || new Date().toISOString()
              : previous.published_at || null,
          })
          .eq('id', previous.id)
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

  const togglePublish = async (post) => {
    setBusy(true)
    try {
      const { error } = await supabase
        .from('blogs')
        .update({
          published: !post.published,
          published_at: !post.published ? post.published_at || new Date().toISOString() : post.published_at || null,
        })
        .eq('id', post.id)
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
      const { error: deleteError } = await supabase.from('blogs').delete().eq('id', modal.post.id)
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

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Blogs</h1>
          <p className="mp-adm-page__sub">
            {query.configured && query.status === 'success'
              ? `${posts.filter((p) => p.published).length} published · ${posts.filter((p) => !p.published).length} draft`
              : 'Journal posts for the public website'}
          </p>
        </div>
        {query.configured && query.status === 'success' ? (
          <Button onClick={openAdd}>
            <Plus size={16} aria-hidden="true" />
            Add Blog
          </Button>
        ) : null}
      </header>

      {!query.configured ? (
        <AdminNotConfigured />
      ) : query.status === 'loading' ? (
        <AdminLoading label="Loading posts" />
      ) : query.status === 'error' ? (
        <AdminError message={query.error} onRetry={query.refetch} />
      ) : posts.length === 0 ? (
        <AdminEmpty
          title="No posts yet"
          note="Write the first journal post. It appears on the public website once published."
          action={
            <Button onClick={openAdd}>
              <Plus size={16} aria-hidden="true" />
              Add Blog
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
              placeholder="Search title, category or slug"
              aria-label="Search posts"
            />
          </div>
          <div className="mp-adm-tablewrap">
            <table className="mp-adm-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((post) => (
                  <tr key={post.id}>
                    <td data-label="Title">
                      <span className="mp-adm-table__strong">{post.title}</span>
                      <span className="mp-adm-table__sub">/{post.slug}</span>
                    </td>
                    <td data-label="Category">{post.category || 'Uncategorised'}</td>
                    <td data-label="Status">
                      <span className={`mp-adm-badge ${post.published ? 'mp-adm-badge--active' : 'mp-adm-badge--inactive'}`}>
                        {post.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td data-label="Date">
                      {formatDate(post.published ? post.published_at || post.created_at : post.created_at)}
                    </td>
                    <td data-label="Actions" className="mp-adm-table__actions">
                      {post.published ? (
                        <a
                          className="mp-adm-iconbtn"
                          href={`/blogs/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${post.title} on the website`}
                        >
                          <ExternalLink size={15} aria-hidden="true" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="mp-adm-btn mp-adm-btn--sm mp-adm-btn--secondary"
                        onClick={() => togglePublish(post)}
                        disabled={busy}
                      >
                        {post.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="mp-adm-iconbtn" onClick={() => openEdit(post)} aria-label={`Edit ${post.title}`}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="mp-adm-iconbtn mp-adm-iconbtn--danger"
                        onClick={() => { setFormError(null); setModal({ type: 'delete', post }) }}
                        aria-label={`Delete ${post.title}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AdminModalHost>
        {modal?.type === 'add' || modal?.type === 'edit' ? (
          <AdminModal
            title={modal.type === 'add' ? 'Add Blog' : `Edit ${modal.post.title}`}
            onClose={() => setModal(null)}
            wide
          >
            <form className="mp-adm-form" onSubmit={handleSubmit} noValidate>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Title</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    value={form.title}
                    onChange={(event) => handleTitle(event.target.value)}
                    placeholder="Post title"
                    required
                  />
                </label>
                <label className="mp-field">
                  <span className="mp-field__label">Slug</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    value={form.slug}
                    onChange={(event) => setForm({ ...form, slug: slugify(event.target.value), slugTouched: true })}
                    placeholder="url-friendly-slug"
                  />
                </label>
              </div>
              <div className="mp-adm-form__row">
                <label className="mp-field">
                  <span className="mp-field__label">Category</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    placeholder="For example Weddings"
                  />
                </label>
                <label className="mp-field">
                  <span className="mp-field__label">Cover Image URL</span>
                  <input
                    className="mp-field__input"
                    type="url"
                    value={form.cover_image}
                    onChange={(event) => setForm({ ...form, cover_image: event.target.value })}
                    placeholder="https://"
                  />
                </label>
              </div>
              <label className="mp-field">
                <span className="mp-field__label">Excerpt</span>
                <textarea
                  className="mp-field__input mp-field__input--area"
                  rows={2}
                  value={form.excerpt}
                  onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                  placeholder="One or two sentences shown on the journal card"
                />
              </label>
              <label className="mp-field">
                <span className="mp-field__label">Content</span>
                <textarea
                  className="mp-field__input mp-field__input--area mp-field__input--tall"
                  rows={10}
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="The full post. Separate paragraphs with a blank line."
                />
              </label>
              <div className="mp-adm-form__checks">
                <CheckRow
                  label="Published"
                  note="Published posts appear on the public journal immediately."
                  checked={form.published}
                  onChange={(value) => setForm({ ...form, published: value })}
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
                  {busy ? 'Saving' : modal.type === 'add' ? 'Add Blog' : 'Save changes'}
                </button>
              </div>
            </form>
          </AdminModal>
        ) : null}

        {modal?.type === 'delete' ? (
          <AdminModal title={`Delete ${modal.post.title}?`} onClose={() => setModal(null)}>
            <p className="mp-adm-confirm__text">
              This permanently removes the post from the journal. This cannot be undone.
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
                {busy ? 'Deleting' : 'Delete post'}
              </button>
            </div>
          </AdminModal>
        ) : null}
      </AdminModalHost>
    </div>
  )
}
