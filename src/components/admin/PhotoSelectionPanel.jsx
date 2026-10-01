import { useEffect, useMemo, useState } from 'react'
import {
  BookmarkCheck,
  Bookmark,
  Check,
  CheckSquare,
  Loader2,
  RefreshCw,
  Square,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { mediaSrc } from '@/lib/drive'
import { supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'liked', label: 'Liked' },
  { key: 'disliked', label: 'Disliked' },
  { key: 'unselected', label: 'Unselected' },
]

const PAGE_SIZE = 60

/**
 * Photo selection view for one event: what clients liked and disliked, and
 * the studio's own album selection. Client reactions are aggregated per
 * photo (the latest reaction wins) and every number comes from the
 * database. "Mark for album" is a purely internal studio choice and is
 * completely independent of client reactions.
 */
export function PhotoSelectionPanel({ event }) {
  const [media, setMedia] = useState([])
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [checked, setChecked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const accessCode = event?.access_code

  const load = async () => {
    setStatus('loading')
    setError(null)
    try {
      const [listResult, summaryResult] = await Promise.all([
        supabase.rpc('admin_event_media_list', { p_event_id: event.id }),
        supabase.rpc('admin_reaction_summary', { p_event_id: event.id }),
      ])
      if (listResult.error) {
        throw listResult.error
      }
      if (summaryResult.error) {
        throw summaryResult.error
      }
      const rows = Array.isArray(listResult.data) ? listResult.data : []
      setMedia(rows.filter((row) => row.file_type === 'image'))
      const record =
        summaryResult.data && typeof summaryResult.data === 'object' && !Array.isArray(summaryResult.data)
          ? summaryResult.data
          : {}
      setSummary(record)
      setStatus('ready')
    } catch (loadError) {
      setError(friendlyDbError(loadError))
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
    // Reload when the event changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  const filtered = useMemo(() => {
    if (filter === 'liked') {
      return media.filter((row) => row.client_reaction === 'like')
    }
    if (filter === 'disliked') {
      return media.filter((row) => row.client_reaction === 'dislike')
    }
    if (filter === 'unselected') {
      return media.filter((row) => !row.client_reaction)
    }
    return media
  }, [media, filter])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [filter])

  const applySelection = async (ids, selected) => {
    if (busy || ids.length === 0) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_album_selection', {
        p_event_id: event.id,
        p_media_ids: ids,
        p_selected: selected,
      })
      if (rpcError) {
        throw rpcError
      }
      const idSet = new Set(ids)
      setMedia((rows) =>
        rows.map((row) =>
          idSet.has(row.media_id)
            ? { ...row, album_selected: selected }
            : row
        )
      )
      setSummary((current) =>
        current
          ? {
              ...current,
              album_selected:
                Number(current.album_selected ?? 0) +
                (selected ? 1 : -1) * ids.filter((id) => {
                  const row = media.find((item) => item.media_id === id)
                  return row ? row.album_selected !== selected : false
                }).length,
            }
          : current
      )
      setChecked(new Set())
    } catch (updateError) {
      setError(friendlyDbError(updateError))
    } finally {
      setBusy(false)
    }
  }

  const toggleChecked = (mediaId) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(mediaId)) {
        next.delete(mediaId)
      } else {
        next.add(mediaId)
      }
      return next
    })
  }

  const total = Number(summary?.total_images ?? 0)
  const liked = Number(summary?.liked ?? 0)
  const disliked = Number(summary?.disliked ?? 0)
  const unselected = summary
    ? Number(summary.unselected ?? total - liked - disliked)
    : 0
  const albumCount = Number(summary?.album_selected ?? 0)

  return (
    <div className="mp-adm-sel">
      <div className="mp-adm-face__heading">
        <p className="mp-adm-drive__label">Photo selection</p>
        <button
          type="button"
          className="mp-adm-btn mp-adm-btn--secondary"
          onClick={load}
          disabled={status === 'loading'}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </button>
      </div>
      <p className="mp-adm-drive__note">
        Client like and dislike selections for this event, aggregated per photo. Mark for album is the
        studio's own selection and never changes what clients see.
      </p>

      {status === 'loading' ? (
        <p className="mp-adm-sel__state">
          <Loader2 size={16} className="mp-adm-spinner mp-adm-spinner--xs" aria-hidden="true" />{' '}
          Loading selection data
        </p>
      ) : status === 'error' ? (
        <p className="mp-adm-perm__error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="mp-adm-stats mp-adm-stats--face mp-adm-sel__stats">
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{liked}</p>
              <p className="mp-adm-stat__label">Liked</p>
            </div>
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{disliked}</p>
              <p className="mp-adm-stat__label">Disliked</p>
            </div>
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{unselected}</p>
              <p className="mp-adm-stat__label">Unselected</p>
            </div>
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{albumCount}</p>
              <p className="mp-adm-stat__label">In album</p>
            </div>
          </div>

          <div className="mp-adm-sel__filters" role="group" aria-label="Filter photos">
            {FILTERS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`mp-adm-sel__filter${filter === entry.key ? ' is-active' : ''}`}
                aria-pressed={filter === entry.key}
                onClick={() => setFilter(entry.key)}
              >
                {entry.label}
                {entry.key === 'liked' ? ` (${liked})` : ''}
                {entry.key === 'disliked' ? ` (${disliked})` : ''}
                {entry.key === 'unselected' ? ` (${unselected})` : ''}
                {entry.key === 'all' ? ` (${total})` : ''}
              </button>
            ))}
          </div>

          {checked.size > 0 ? (
            <div className="mp-adm-sel__bulk">
              <span className="mp-adm-sel__bulk-count">{checked.size} selected</span>
              <button
                type="button"
                className="mp-adm-btn mp-adm-btn--primary"
                disabled={busy}
                onClick={() => applySelection([...checked], true)}
              >
                <BookmarkCheck size={14} aria-hidden="true" />
                Mark selected
              </button>
              <button
                type="button"
                className="mp-adm-btn mp-adm-btn--secondary"
                disabled={busy}
                onClick={() => applySelection([...checked], false)}
              >
                <Bookmark size={14} aria-hidden="true" />
                Remove from selection
              </button>
              <button
                type="button"
                className="mp-adm-btn mp-adm-btn--secondary"
                onClick={() => setChecked(new Set())}
              >
                Clear
              </button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="mp-adm-sel__state">No photos match this filter.</p>
          ) : (
            <>
              <div className="mp-adm-sel__grid">
                {filtered.slice(0, visible).map((row) => (
                  <figure key={row.media_id} className="mp-adm-sel__item">
                    <img
                      src={mediaSrc(row.media_id, accessCode, 'thumb')}
                      alt={row.file_name}
                      loading="lazy"
                    />
                    <button
                      type="button"
                      className={`mp-adm-sel__check${checked.has(row.media_id) ? ' is-on' : ''}`}
                      aria-pressed={checked.has(row.media_id)}
                      aria-label={`Select ${row.file_name} for bulk action`}
                      onClick={() => toggleChecked(row.media_id)}
                    >
                      {checked.has(row.media_id) ? (
                        <CheckSquare size={15} aria-hidden="true" />
                      ) : (
                        <Square size={15} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`mp-adm-sel__album${row.album_selected ? ' is-on' : ''}`}
                      aria-pressed={Boolean(row.album_selected)}
                      aria-label={
                        row.album_selected
                          ? `Remove ${row.file_name} from album`
                          : `Mark ${row.file_name} for album`
                      }
                      disabled={busy}
                      onClick={() => applySelection([row.media_id], !row.album_selected)}
                    >
                      {row.album_selected ? (
                        <BookmarkCheck size={15} aria-hidden="true" />
                      ) : (
                        <Bookmark size={15} aria-hidden="true" />
                      )}
                    </button>
                    {row.client_reaction ? (
                      <span
                        className={`mp-adm-sel__reaction${
                          row.client_reaction === 'dislike' ? ' mp-adm-sel__reaction--down' : ''
                        }`}
                        title={row.client_reaction === 'like' ? 'Liked by client' : 'Disliked by client'}
                      >
                        {row.client_reaction === 'like' ? (
                          <ThumbsUp size={12} aria-hidden="true" />
                        ) : (
                          <ThumbsDown size={12} aria-hidden="true" />
                        )}
                      </span>
                    ) : null}
                  </figure>
                ))}
              </div>
              {visible < filtered.length ? (
                <div className="mp-adm-sel__more">
                  <button
                    type="button"
                    className="mp-adm-btn mp-adm-btn--secondary"
                    onClick={() => setVisible((current) => current + PAGE_SIZE)}
                  >
                    Show more ({filtered.length - visible} left)
                  </button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  )
}
