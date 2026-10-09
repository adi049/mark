import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Fingerprint, Loader2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { AdminModal } from '@/components/admin/AdminModal'
import { startFaceIndex } from '@/lib/drive'
import { formatDate } from '@/lib/format'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const SAVE_BATCH = 32
const SCAN_CONCURRENCY = 6
const INDEX_PHASES = [
  { key: 'preparing', label: 'Preparing' },
  { key: 'scanning', label: 'Scanning images' },
  { key: 'detecting', label: 'Detecting faces' },
  { key: 'embedding', label: 'Generating embeddings' },
  { key: 'saving', label: 'Saving index' },
  { key: 'complete', label: 'Complete' },
]

/**
 * Face index management for one event. Indexing runs in the studio's own
 * browser with the open source face nets: images already imported from
 * Google Drive are read through the media proxy, faces are detected and
 * embedded locally, and only the 128-number embeddings are stored. Media
 * that already has embeddings is skipped, so reindexing after a Drive sync
 * only processes new photos.
 */
export function FaceIndexPanel({ event, refreshKey }) {
  const [stats, setStats] = useState(null)
  const [statsStatus, setStatsStatus] = useState('loading') // loading | ready | error
  const [run, setRun] = useState(null) // { phase, scanned, total, faces, skipped }
  const [runError, setRunError] = useState(null)
  const [confirmRebuild, setConfirmRebuild] = useState(false)
  const aliveRef = useRef(true)

  const refreshStats = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setStatsStatus('error')
      return
    }
    setStatsStatus('loading')
    const { data, error } = await supabase.rpc('admin_face_index_stats', {
      p_event_id: event.id,
    })
    if (!aliveRef.current) {
      return
    }
    if (error) {
      setStatsStatus('error')
      return
    }
    const record = Array.isArray(data) ? data[0] : data
    setStats(record)
    setStatsStatus('ready')
    }, [event.id, refreshKey])

  useEffect(() => {
    aliveRef.current = true
    refreshStats()
    return () => {
      aliveRef.current = false
    }
  }, [refreshStats])

  const runIndex = async () => {
    if (run && run.phase !== 'complete') return
    setRunError(null)
    setRun({ phase: 'preparing', scanned: imagesIndexed, total: imagesTotal, faces: facesDetected, skipped: 0 })

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Admin session expired. Sign in again.')

      await startFaceIndex(token, event.id)

      let lastIndexed = -1
      let lastProgressAt = Date.now()
      const startedAt = Date.now()
      const maxWaitMs = 45 * 60 * 1000
      const idleTimeoutMs = 8 * 60 * 1000

      while (Date.now() - startedAt < maxWaitMs) {
        if (!aliveRef.current) return
        await new Promise((resolve) => setTimeout(resolve, 5000))

        const { data, error } = await supabase.rpc('admin_face_index_stats', {
          p_event_id: event.id,
        })
        if (error) throw error
        const record = Array.isArray(data) ? data[0] : data
        const total = Number(record?.images_total ?? 0)
        const indexed = Number(record?.images_indexed ?? 0)
        const faceCount = Number(record?.faces_detected ?? 0)

        setStats(record)
        setStatsStatus('ready')
        setRun({
          phase: indexed >= total && total > 0 ? 'complete' : 'scanning',
          scanned: indexed,
          total,
          faces: faceCount,
          skipped: 0,
        })

        if (total > 0 && indexed >= total) {
          refreshStats()
          return
        }

        if (indexed > lastIndexed) {
          lastIndexed = indexed
          lastProgressAt = Date.now()
        } else if (Date.now() - lastProgressAt > idleTimeoutMs) {
          throw new Error(
            'Background worker has not updated the index for 8 minutes. Check GitHub Actions secrets and the Drive Edge Function GITHUB_FACE_INDEX_TOKEN.',
          )
        }
      }

      throw new Error('Background indexing is still running but exceeded the 45-minute UI wait. Check GitHub Actions for the worker result.')
    } catch (error) {
      if (aliveRef.current) {
        setRunError(error?.message ?? 'Background face indexing could not be started.')
        setRun(null)
        refreshStats()
      }
    }
  }

  const rebuild = async () => {
    setConfirmRebuild(false)
    const { error } = await supabase.rpc('admin_clear_face_index', { p_event_id: event.id })
    if (error) {
      setRunError(error?.message ?? 'The face index could not be cleared.')
      return
    }
    await refreshStats()
    runIndex('all')
  }

  const imagesTotal = Number(stats?.images_total ?? 0)
  const imagesIndexed = Number(stats?.images_indexed ?? 0)
  const facesDetected = Number(stats?.faces_detected ?? 0)
  const running = Boolean(run && run.phase !== 'complete')

  let statusLabel = 'Not started'
  let statusTone = 'muted'
  if (running) {
    statusLabel = 'Processing'
    statusTone = 'busy'
  } else if (runError) {
    statusLabel = 'Error'
    statusTone = 'error'
  } else if (run?.phase === 'complete') {
    statusLabel = run.skipped > 0 ? `Complete · ${run.skipped} skipped` : 'Complete'
    statusTone = 'ok'
  } else if (imagesTotal === 0) {
    statusLabel = 'No media'
  } else if (imagesIndexed >= imagesTotal) {
    statusLabel = 'Complete'
    statusTone = 'ok'
  } else if (imagesIndexed > 0) {
    statusLabel = 'Partial'
    statusTone = 'busy'
  }

  const activeIndex = run ? INDEX_PHASES.findIndex((p) => p.key === run.phase) : -1

  return (
    <div className="mp-adm-face">
      <div className="mp-adm-face__row">
        <div className="mp-adm-face__heading">
          <p className="mp-adm-drive__label">Face Index</p>
          <p className={`mp-adm-face__status mp-adm-face__status--${statusTone}`}>
            {statusTone === 'busy' ? (
              <Loader2 size={13} className="mp-adm-spinner mp-adm-spinner--xs" aria-hidden="true" />
            ) : statusTone === 'ok' ? (
              <Check size={13} aria-hidden="true" />
            ) : statusTone === 'error' ? (
              <AlertTriangle size={13} aria-hidden="true" />
            ) : (
              <Fingerprint size={13} aria-hidden="true" />
            )}
            {statusLabel}
          </p>
        </div>
        <div className="mp-adm-face__actions">
          {imagesIndexed === 0 && imagesTotal > 0 ? (
            <button
              type="button"
              className="mp-adm-btn mp-adm-btn--primary"
              onClick={() => runIndex('all')}
              disabled={running}
            >
              <Sparkles size={14} aria-hidden="true" />
              Start Face Index
            </button>
          ) : null}
          {imagesIndexed > 0 ? (
            <button
              type="button"
              className="mp-adm-btn mp-adm-btn--secondary"
              onClick={() => runIndex('new')}
              disabled={running}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Reindex New Media
            </button>
          ) : null}
          {imagesTotal > 0 ? (
            <button
              type="button"
              className="mp-adm-btn mp-adm-btn--secondary"
              onClick={() => setConfirmRebuild(true)}
              disabled={running}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Rebuild Index
            </button>
          ) : null}
        </div>
      </div>

      <p className="mp-adm-drive__note">
        Faces are detected and embedded in this browser with the open source Markipie face
        engine; only the numeric embeddings are stored. Indexing after a Drive sync only
        processes photos that are not indexed yet.
      </p>

      <div className="mp-adm-stats mp-adm-stats--face">
        <div className="mp-adm-stat">
          <p className="mp-adm-stat__value">{statsStatus === 'ready' ? `${imagesIndexed} / ${imagesTotal}` : '··'}</p>
          <p className="mp-adm-stat__label">Images scanned</p>
        </div>
        <div className="mp-adm-stat">
          <p className="mp-adm-stat__value">{statsStatus === 'ready' ? facesDetected : '··'}</p>
          <p className="mp-adm-stat__label">Faces detected</p>
        </div>
        <div className="mp-adm-stat">
          <p className="mp-adm-stat__value">{statsStatus === 'ready' ? imagesIndexed : '··'}</p>
          <p className="mp-adm-stat__label">Images indexed</p>
        </div>
        <div className="mp-adm-stat">
          <p className="mp-adm-stat__value mp-adm-stat__value--date">
            {stats?.last_indexed_at ? formatDate(stats.last_indexed_at) : 'Not yet'}
          </p>
          <p className="mp-adm-stat__label">Last indexed</p>
        </div>
      </div>

      {statsStatus === 'error' ? (
        <p className="mp-adm-form__error" role="alert">
          <AlertTriangle size={13} aria-hidden="true" /> Face index stats could not be loaded.
        </p>
      ) : null}
      {runError ? (
        <p className="mp-adm-form__error" role="alert">
          <AlertTriangle size={13} aria-hidden="true" /> {runError}
        </p>
      ) : null}

      {run ? (
        <div className="mp-adm-face__progress" role="status" aria-live="polite">
          <ol className="mp-adm-drive__phases">
            {INDEX_PHASES.map((phase, index) => {
              // Scanning, detecting and embedding all happen inside the
              // image loop, so they light up together while it runs.
              const inGroup = run.phase === 'scanning' && index >= 1 && index <= 3
              const isDone =
                run.phase === 'complete' || (activeIndex > index && !inGroup)
              const isCurrent = !isDone && (index === activeIndex || inGroup)
              return (
                <li
                  key={phase.key}
                  className={isDone ? 'is-done' : isCurrent ? 'is-current' : 'is-pending'}
                >
                  <span className="mp-adm-drive__phase-icon" aria-hidden="true">
                    {isDone ? (
                      <Check size={12} />
                    ) : isCurrent && index === activeIndex ? (
                      <span className="mp-adm-spinner mp-adm-spinner--xs" />
                    ) : (
                      <span className="mp-adm-drive__phase-dot" />
                    )}
                  </span>
                  {phase.label}
                  {phase.key === 'scanning' && run.phase !== 'preparing' ? (
                    <span className="mp-adm-drive__phase-result">
                      {run.scanned} / {run.total} images · {run.faces} face
                      {run.faces === 1 ? '' : 's'}
                      {run.skipped ? ` · ${run.skipped} skipped` : ''}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
          {run.phase === 'complete' ? (
            <div className="mp-adm-drive__actions">
              <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={() => setRun(null)}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {confirmRebuild ? (
        <AdminModal title="Rebuild face index" onClose={() => setConfirmRebuild(false)}>
          <p className="mp-adm-face__confirm-text">
            This clears every stored face embedding for {event.name} and indexes all photos
            again. Your media is not touched.
          </p>
          <div className="mp-adm-face__confirm-actions">
            <button
              type="button"
              className="mp-adm-btn mp-adm-btn--secondary"
              onClick={() => setConfirmRebuild(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mp-adm-btn mp-adm-btn--primary"
              onClick={rebuild}
            >
              Rebuild index
            </button>
          </div>
        </AdminModal>
      ) : null}
    </div>
  )
}

/**
 * Loads an image with CORS enabled so the face engine can read its pixels.
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = src
  })
}
