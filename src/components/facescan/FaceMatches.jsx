import { useEffect, useMemo, useState } from 'react'
import { Camera, ChevronLeft, Loader2, SearchX } from 'lucide-react'
import { MediaGrid } from '@/components/gallery/MediaGrid'
import { MediaViewer } from '@/components/gallery/MediaViewer'
import { descriptorToText, FACE_MATCH_THRESHOLD } from '@/lib/faceEngine'
import { eventPermissions } from '@/lib/eventPermissions'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

const PAGE_SIZE = 24

/**
 * "Your moments": the photos whose indexed faces match the live scan.
 * Runs the event-scoped vector search once with the captured descriptor
 * and shows the results through the same grid, viewer, watermark,
 * download and reaction system as the rest of the gallery.
 */
export function FaceMatches({ code, event, sessionId, descriptor, onExit, onScanAgain }) {
  const [status, setStatus] = useState('searching') // searching | done | empty | error
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [viewerIndex, setViewerIndex] = useState(null)

  useEffect(() => {
    if (!descriptor || !isSupabaseConfigured) {
      return undefined
    }
    let alive = true
    setStatus('searching')
    supabase
      .rpc('search_event_faces', {
        p_code: code,
        p_embedding: descriptorToText(descriptor),
        p_threshold: FACE_MATCH_THRESHOLD,
        p_session_id: sessionId,
      })
      .then((response) => {
        if (!alive) {
          return
        }
        const payload =
          response && typeof response === 'object' && 'data' in response
            ? response
            : { data: response, error: null }
        if (payload.error) {
          throw payload.error
        }
        const rows = Array.isArray(payload.data) ? payload.data : []
        setItems(rows)
        setVisible(PAGE_SIZE)
        setStatus(rows.length === 0 ? 'empty' : 'done')
      })
      .catch((searchError) => {
        if (alive) {
          setError(friendlyDbError(searchError))
          setStatus('error')
        }
      })
    return () => {
      alive = false
    }
    // One search per descriptor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor, code])

  const updateReaction = (mediaId, reaction) => {
    setItems((previous) =>
      previous.map((item) => (item.id === mediaId ? { ...item, my_reaction: reaction } : item))
    )
  }

  const shown = useMemo(() => items.slice(0, visible), [items, visible])

  return (
    <section className="mp-cg-section mp-fm">
      <div className="mp-cg-section__bar">
        <button type="button" className="mp-cg-section__back" onClick={onExit}>
          <ChevronLeft size={15} aria-hidden="true" />
          Back to gallery
        </button>
        <p className="mp-cg-section__crumb">{event?.name}</p>
      </div>

      <header className="mp-fm__head">
        <p className="mp-fm__eyebrow">Matched by your face</p>
        <h3 className="mp-fm__title">Your Moments</h3>
        {status === 'done' ? (
          <p className="mp-fm__count">
            {items.length} matching photo{items.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </header>

      {status === 'searching' ? (
        <div className="mp-cg__state" aria-live="polite" aria-busy="true">
          <Loader2 size={20} className="mp-cg__spin" aria-hidden="true" />
          <p>Finding your photos</p>
        </div>
      ) : status === 'error' ? (
        <div className="mp-cg__state mp-cg__state--error" role="alert">
          <p>{error}</p>
          <button type="button" className="mp-fm__retry" onClick={onScanAgain}>
            Try again
          </button>
        </div>
      ) : status === 'empty' ? (
        <div className="mp-cg__state mp-cg__state--empty">
          <SearchX size={22} aria-hidden="true" />
          <p className="mp-cg__state-title">No matching photos found.</p>
          <p className="mp-fm__guide">
            Face the camera directly, improve your lighting and try again. Photos of you may
            also not be indexed yet.
          </p>
          <button type="button" className="mp-fm__retry" onClick={onScanAgain}>
            <Camera size={15} aria-hidden="true" />
            Try the scan again
          </button>
        </div>
      ) : (
        <>
          <p className="mp-cg-count">
            Showing {shown.length} of {items.length}
          </p>
          <MediaGrid
            media={shown}
            code={code}
            watermark={eventPermissions(event).watermark}
            onOpen={(item, index) => setViewerIndex(index)}
          />
          {shown.length < items.length ? (
            <div className="mp-cg-more">
              <button
                type="button"
                className="mp-cg-more__btn"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}

      {viewerIndex !== null && items[viewerIndex] ? (
        <MediaViewer
          items={items}
          index={viewerIndex}
          total={items.length}
          code={code}
          event={event}
          sessionId={sessionId}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
          onReaction={updateReaction}
        />
      ) : null}
    </section>
  )
}
