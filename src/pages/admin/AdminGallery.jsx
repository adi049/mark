import { Link } from 'react-router-dom'
import { Images, ArrowRight } from 'lucide-react'
import {
  AdminError,
  AdminLoading,
  AdminNotConfigured,
} from '@/components/admin/StatePanels'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { formatDate, statusLabel } from '@/lib/format'

/**
 * Gallery home: pick the event to manage. Each event page holds the Drive
 * connection, folder import, sync and the real media counts.
 */
export default function AdminGallery() {
  const { configured } = useAdminAuth()
  const query = useSupabaseQuery((client) => client.rpc('admin_media_overview'), [])
  const events = Array.isArray(query.data) ? query.data : []

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Gallery</h1>
          <p className="mp-adm-page__sub">Event media from Google Drive, managed per event.</p>
        </div>
      </header>

      {!configured ? (
        <AdminNotConfigured />
      ) : query.status === 'loading' ? (
        <AdminLoading label="Loading event media" />
      ) : query.status === 'error' ? (
        <AdminError message={query.error} onRetry={query.refetch} />
      ) : events.length === 0 ? (
        <div className="mp-adm-hint">
          <p className="mp-adm-hint__title">No events yet</p>
          <p className="mp-adm-hint__text">
            Create clients and events first; each event gets its own gallery fed from Google Drive.
          </p>
        </div>
      ) : (
        <div className="mp-adm-tablewrap">
          <table className="mp-adm-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Client</th>
                <th>Drive Folder</th>
                <th>Photos</th>
                <th>Videos</th>
                <th>Last Synced</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.event_id}>
                  <td data-label="Event">
                    <span className="mp-adm-table__strong">{event.event_name}</span>
                    <span className={`mp-adm-badge mp-adm-badge--${event.status}`}>{statusLabel(event.status)}</span>
                  </td>
                  <td data-label="Client">{event.client_name}</td>
                  <td data-label="Drive Folder">
                    {event.drive_folder_name ? (
                      <span className="mp-adm-table__strong">{event.drive_folder_name}</span>
                    ) : (
                      <span className="mp-adm-table__sub">Not imported</span>
                    )}
                  </td>
                  <td data-label="Photos">{event.photos}</td>
                  <td data-label="Videos">{event.videos}</td>
                  <td data-label="Last Synced">
                    {event.drive_synced_at ? formatDate(event.drive_synced_at) : 'Not yet'}
                  </td>
                  <td data-label="Actions" className="mp-adm-table__actions">
                    <Link
                      className="mp-adm-btn mp-adm-btn--sm mp-adm-btn--secondary"
                      to={`/admin/gallery/${event.event_id}`}
                      aria-label={`Manage gallery for ${event.event_name}`}
                    >
                      <Images size={14} aria-hidden="true" />
                      Manage
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
