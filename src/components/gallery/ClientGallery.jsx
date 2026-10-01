import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Images, Loader2, ScanFace } from 'lucide-react'
import { FaceMatches } from '@/components/facescan/FaceMatches'
import { eventPermissions } from '@/lib/eventPermissions'
import { FaceScanDialog } from '@/components/facescan/FaceScanDialog'
import { MediaGrid } from '@/components/gallery/MediaGrid'
import { MediaViewer } from '@/components/gallery/MediaViewer'
import { useEventFolders, useEventSubfolders, useFolderMedia } from '@/hooks/useEventGallery'
import { getClientVisitorId } from '@/lib/clientSession'
import { formatDate } from '@/lib/format'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/**
 * The client's event gallery: folders from the imported Drive structure,
 * paged media, the in-site viewer and, when the event has it enabled, the
 * AI face scan that filters this event's photos down to the client's own
 * face. Everything is fetched with the event code; no Drive or database
 * internals surface here.
 */
export function ClientGallery({ code, event, onExit, onInvalid, initialDescriptor = null }) {
  const [eventInfo, setEventInfo] = useState(event)
  const foldersQuery = useEventFolders(code)
  const [openFolder, setOpenFolder] = useState(null)
  const [leafId, setLeafId] = useState(null)
  const [leafName, setLeafName] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [invalid, setInvalid] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [faceDescriptor, setFaceDescriptor] = useState(null)
  const permissions = eventPermissions(eventInfo)

  const subfoldersQuery = useEventSubfolders(code, openFolder?.id)
  const visitorId = useMemo(() => getClientVisitorId(), [])
  const mediaQuery = useFolderMedia(code, leafId, visitorId)

  const folders = Array.isArray(foldersQuery.data) ? foldersQuery.data : []
  const subfolders = Array.isArray(subfoldersQuery.data) ? subfoldersQuery.data : []

  // Revalidate the code once so a deactivated or changed event does not
  // keep serving a stale gallery.
  useEffect(() => {
    if (!supabase) {
      return undefined
    }
    let alive = true
    supabase
      .rpc('lookup_event_by_code', { p_code: code })
      .then((response) => {
        if (!alive) {
          return
        }
        const payload =
          response && typeof response === 'object' && 'data' in response ? response : { data: response, error: null }
        const record = Array.isArray(payload.data) ? payload.data[0] : payload.data
        if (!record) {
          setInvalid(true)
          onInvalid?.()
        } else {
          setEventInfo(record)
        }
      })
      .catch(() => {
        // Network hiccup: the folder data below still gates everything.
      })
    return () => {
      alive = false
    }
    // Runs once when the gallery opens for this code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // A descriptor captured outside the gallery (Home page or the access
  // entry card) opens straight into the face results for this event.
  useEffect(() => {
    if (initialDescriptor && event?.face_scan_enabled) {
      setFaceDescriptor(initialDescriptor)
    }
    // Runs once when the gallery opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDescriptor])

  // When a section opens, default to its first subfolder if the Drive
  // structure has one, otherwise to the section itself.
  useEffect(() => {
    if (!openFolder) {
      return undefined
    }
    if (subfoldersQuery.status === 'success') {
      if (!leafId) {
        const first = subfolders[0]
        setLeafId(first ? first.id : openFolder.id)
        setLeafName(first ? first.name : null)
      }
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFolder, subfoldersQuery.status])

  const openSection = (folder) => {
    setOpenFolder(folder)
    setLeafId(null)
    setLeafName(null)
    setViewerIndex(null)
  }

  const backToFolders = () => {
    setOpenFolder(null)
    setLeafId(null)
    setLeafName(null)
    setViewerIndex(null)
  }

  const chooseLeaf = (subfolder) => {
    setLeafId(subfolder.id)
    setLeafName(subfolder.name)
    setViewerIndex(null)
  }

  if (invalid) {
    return (
      <div className="mp-cg-invalid" role="alert">
        <p>Invalid or expired access code.</p>
      </div>
    )
  }

  const leaf = leafName ?? openFolder?.name

  return (
    <div className="mp-cg">
      <header className="mp-cg__head">
        <div className="mp-cg__titles">
          <p className="mp-cg__eyebrow">{eventInfo?.client_name ?? 'Client gallery'}</p>
          <h2 className="mp-cg__title">{eventInfo?.name ?? 'Your event gallery'}</h2>
          <p className="mp-cg__meta">
            {[
              eventInfo?.event_type,
              eventInfo?.event_date ? formatDate(eventInfo.event_date) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="mp-cg__actions">
          {permissions.faceScan && !faceDescriptor ? (
            <button
              type="button"
              className="mp-cg__face-btn"
              onClick={() => {
                setViewerIndex(null)
                setScanOpen(true)
              }}
            >
              <ScanFace size={15} aria-hidden="true" />
              Find my photos
            </button>
          ) : null}
          <button type="button" className="mp-cg__exit" onClick={onExit}>
            Exit gallery
          </button>
        </div>
      </header>

      {faceDescriptor ? (
        <FaceMatches
          code={code}
          event={eventInfo}
          sessionId={visitorId}
          descriptor={faceDescriptor}
          onExit={() => setFaceDescriptor(null)}
          onScanAgain={() => setScanOpen(true)}
        />
      ) : !openFolder ? (
        <>
          {foldersQuery.status === 'loading' ? (
            <div className="mp-cg__state" aria-live="polite" aria-busy="true">
              <Loader2 size={20} className="mp-cg__spin" aria-hidden="true" />
              <p>Opening your gallery</p>
            </div>
          ) : foldersQuery.status === 'error' ? (
            <div className="mp-cg__state mp-cg__state--error" role="alert">
              <p>{foldersQuery.error}</p>
            </div>
          ) : folders.length === 0 ? (
            <div className="mp-cg__state mp-cg__state--empty">
              <Images size={22} aria-hidden="true" />
              <p className="mp-cg__state-title">Your gallery is being prepared.</p>
              <p className="mp-cg__state-note">
                Your event code is valid. Photos appear here as soon as the studio publishes them.
              </p>
            </div>
          ) : (
            <div className="mp-cg-folders">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="mp-cg-folder"
                  onClick={() => openSection(folder)}
                >
                  <span className="mp-cg-folder__name">{folder.name}</span>
                  <span className="mp-cg-folder__meta">
                    {[
                      folder.photos ? `${folder.photos} photo${folder.photos === 1 ? '' : 's'}` : null,
                      folder.videos ? `${folder.videos} video${folder.videos === 1 ? '' : 's'}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No media yet'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <section className="mp-cg-section">
          <div className="mp-cg-section__bar">
            <button type="button" className="mp-cg-section__back" onClick={backToFolders}>
              <ChevronLeft size={15} aria-hidden="true" />
              All folders
            </button>
            <p className="mp-cg-section__crumb">
              {eventInfo?.name} <span aria-hidden="true">/</span> {openFolder.name}
              {leafName ? (
                <>
                  {' '}
                  <span aria-hidden="true">/</span> {leafName}
                </>
              ) : null}
            </p>
          </div>

          {subfolders.length > 0 ? (
            <div className="mp-cg-subfolder-row" role="tablist" aria-label="Gallery sections">
              {subfolders.map((subfolder) => (
                <button
                  key={subfolder.id}
                  type="button"
                  role="tab"
                  aria-selected={leafId === subfolder.id}
                  className={`mp-cg-subfolder${leafId === subfolder.id ? ' is-active' : ''}`}
                  onClick={() => chooseLeaf(subfolder)}
                >
                  {subfolder.name}
                </button>
              ))}
            </div>
          ) : null}

          {mediaQuery.status === 'loading' ? (
            <div className="mp-cg__state" aria-live="polite" aria-busy="true">
              <Loader2 size={20} className="mp-cg__spin" aria-hidden="true" />
              <p>Loading media</p>
            </div>
          ) : mediaQuery.status === 'error' ? (
            <div className="mp-cg__state mp-cg__state--error" role="alert">
              <p>{mediaQuery.error}</p>
            </div>
          ) : mediaQuery.items.length === 0 ? (
            <div className="mp-cg__state mp-cg__state--empty">
              <p className="mp-cg__state-title">No media in this section yet.</p>
            </div>
          ) : (
            <>
              {mediaQuery.total > 0 ? (
                <p className="mp-cg-count">
                  Showing {mediaQuery.items.length} of {mediaQuery.total}
                </p>
              ) : null}
              <MediaGrid
                media={mediaQuery.items}
                code={code}
                watermark={permissions.watermark}
                onOpen={(item, index) => setViewerIndex(index)}
              />
              {mediaQuery.items.length < mediaQuery.total ? (
                <div className="mp-cg-more">
                  <button
                    type="button"
                    className="mp-cg-more__btn"
                    onClick={mediaQuery.loadMore}
                    disabled={mediaQuery.loadingMore}
                  >
                    {mediaQuery.loadingMore ? 'Loading' : 'Load more'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      <FaceScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCaptured={(captured) => {
          setFaceDescriptor(captured)
          setScanOpen(false)
        }}
        title="Find My Photos"
      />

      {viewerIndex !== null && mediaQuery.items[viewerIndex] ? (
        <MediaViewer
          items={mediaQuery.items}
          index={viewerIndex}
          total={mediaQuery.total}
          code={code}
          event={eventInfo}
          sessionId={visitorId}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
          onNearEnd={mediaQuery.loadMore}
          onReaction={mediaQuery.updateReaction}
        />
      ) : null}
    </div>
  )
}
