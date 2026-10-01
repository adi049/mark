import { useCallback, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { DrivePanel } from '@/components/admin/DrivePanel'
import { EventPermissionsPanel } from '@/components/admin/EventPermissionsPanel'
import { FaceIndexPanel } from '@/components/admin/FaceIndexPanel'
import { PhotoSelectionPanel } from '@/components/admin/PhotoSelectionPanel'
import {
  AdminError,
  AdminLoading,
  AdminNotConfigured,
} from '@/components/admin/StatePanels'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { formatDate, statusLabel } from '@/lib/format'

/**
 * One event's gallery management: Drive connection, folder import and
 * sync, real folder/media counts from the database, and a preview link
 * into the client gallery.
 */
export default function AdminEventGallery() {
  const { eventId } = useParams()
  const { configured } = useAdminAuth()

  const query = useSupabaseQuery(async (client) => {
    const [eventResult, statsResult] = await Promise.all([
      client.from('events').select('*').eq('id', eventId).limit(1),
      client.rpc('admin_event_media_stats', { p_event_id: eventId }),
    ])
    if (eventResult.error) {
      throw eventResult.error
    }
    if (statsResult.error) {
      throw statsResult.error
    }
    const event = Array.isArray(eventResult.data) ? eventResult.data[0] : null
    if (!event) {
      throw new Error('That event no longer exists.')
    }
    const folders = Array.isArray(statsResult.data) ? statsResult.data : []
    // Section rows already roll up the media inside their subfolders, so
    // totals are computed from top-level rows only to avoid double counts.
    const sections = folders.filter((folder) => !folder.parent_id)
    const photos = sections.reduce((sum, folder) => sum + (Number(folder.photos) || 0), 0)
    const videos = sections.reduce((sum, folder) => sum + (Number(folder.videos) || 0), 0)
    return { event, folders, photos, videos }
  }, [eventId])

  const refetch = useCallback(() => query.refetch(), [query])

  useEffect(() => {
    document.title = 'Gallery · MARKIPIE Admin'
    return undefined
  }, [])

  const data = query.data

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <p className="mp-adm-page__crumb">
            <Link to="/admin/gallery" className="mp-adm-page__crumb-link">
              <ArrowLeft size={13} aria-hidden="true" />
              All events
            </Link>
          </p>
          <h1 className="mp-adm-page__title">{data ? data.event.name : 'Event gallery'}</h1>
          {data ? (
            <p className="mp-adm-page__sub">
              {data.event.event_type ? data.event.event_type + ' · ' : ''}
              <span className={`mp-adm-badge mp-adm-badge--${data.event.status}`}>
                {statusLabel(data.event.status)}
              </span>
            </p>
          ) : null}
        </div>
        {data ? (
          <a
            className="mp-adm-btn mp-adm-btn--secondary"
            href={`/client-access?event=${data.event.qr_token ?? data.event.access_code}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} aria-hidden="true" />
            Open gallery
          </a>
        ) : null}
      </header>

      {!configured ? (
        <AdminNotConfigured />
      ) : query.status === 'loading' && !data ? (
        <AdminLoading label="Loading event gallery" />
      ) : query.status === 'error' ? (
        <AdminError message={query.error} onRetry={refetch} />
      ) : data ? (
        <>
          <section className="mp-adm-card">
            <DrivePanel event={data.event} onChanged={refetch} />
          </section>

          <section className="mp-adm-card">
            <EventPermissionsPanel event={data.event} onChanged={refetch} />
          </section>

          <section className="mp-adm-card">
            <FaceIndexPanel
              event={data.event}
              refreshKey={`${data.photos}-${data.videos}-${data.folders.length}`}
            />
          </section>

          <section className="mp-adm-card">
            <PhotoSelectionPanel event={data.event} />
          </section>

          <div className="mp-adm-stats">
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{data.folders.filter((f) => !f.parent_id).length}</p>
              <p className="mp-adm-stat__label">Gallery folders</p>
            </div>
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{data.photos}</p>
              <p className="mp-adm-stat__label">Photos</p>
            </div>
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value">{data.videos}</p>
              <p className="mp-adm-stat__label">Videos</p>
            </div>
            <div className="mp-adm-stat">
              <p className="mp-adm-stat__value mp-adm-stat__value--date">
                {data.event.drive_synced_at ? formatDate(data.event.drive_synced_at) : 'Not yet'}
              </p>
              <p className="mp-adm-stat__label">Last synced</p>
            </div>
          </div>

          {data.folders.length === 0 ? (
            <div className="mp-adm-hint">
              <p className="mp-adm-hint__title">No media imported yet</p>
              <p className="mp-adm-hint__text">
                Connect Google Drive above, paste the event folder link and import. The folder
                structure in Drive becomes the gallery structure for this event.
              </p>
            </div>
          ) : (
            <div className="mp-adm-tablewrap">
              <table className="mp-adm-table">
                <thead>
                  <tr>
                    <th>Folder</th>
                    <th>Photos</th>
                    <th>Videos</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {data.folders.map((folder) => (
                    <tr key={folder.id} className={folder.parent_id ? 'mp-adm-table__subrow' : undefined}>
                      <td data-label="Folder">
                        <span className="mp-adm-table__strong">
                          {folder.parent_id ? '· ' : ''}
                          {folder.name}
                        </span>
                      </td>
                      <td data-label="Photos">{folder.photos}</td>
                      <td data-label="Videos">{folder.videos}</td>
                      <td data-label="State">
                        <span
                          className={`mp-adm-badge ${
                            folder.status === 'available' ? 'mp-adm-badge--active' : 'mp-adm-badge--inactive'
                          }`}
                        >
                          {folder.status === 'available' ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
