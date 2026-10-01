import { CalendarDays, Images, Newspaper, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import {
  AdminError,
  AdminLoading,
  AdminNotConfigured,
} from '@/components/admin/StatePanels'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'

const CARDS = [
  { key: 'clients', label: 'Clients', icon: Users, to: '/admin/clients' },
  { key: 'events', label: 'Events', icon: CalendarDays, to: '/admin/events' },
  { key: 'activeEvents', label: 'Active Events', icon: CalendarDays, to: '/admin/events' },
  { key: 'blogs', label: 'Published Blogs', icon: Newspaper, to: '/admin/blogs' },
  { key: 'media', label: 'Media Items', icon: Images, to: '/admin/gallery' },
]

/**
 * Dashboard overview. Every number is a live database count; an empty
 * database honestly shows zeros. No invented metrics. Recent events come
 * straight from the events table with their client names.
 */
export default function AdminDashboard() {
  const { configured } = useAdminAuth()
  const { status, data, error, refetch } = useSupabaseQuery(async (client) => {
    const [clients, events, activeEvents, blogs, media, recentEvents, clientRows] =
      await Promise.all([
        client.from('clients').select('id', { count: 'exact', head: true }),
        client.from('events').select('id', { count: 'exact', head: true }),
        client.from('events').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        client.from('blogs').select('id', { count: 'exact', head: true }).eq('published', true),
        client.from('media').select('id', { count: 'exact', head: true }),
        client.from('events').select('*').order('created_at', { ascending: false }).limit(5),
        client.from('clients').select('id, name'),
      ])
    const firstError =
      clients.error || events.error || activeEvents.error || blogs.error || media.error || recentEvents.error || clientRows.error
    if (firstError) {
      throw firstError
    }
    return {
      clients: clients.count ?? 0,
      events: events.count ?? 0,
      activeEvents: activeEvents.count ?? 0,
      blogs: blogs.count ?? 0,
      media: media.count ?? 0,
      recentEvents: (recentEvents.data ?? []).map((event) => ({
        id: event.id,
        name: event.name,
        eventDate: event.event_date ?? null,
        status: event.status ?? 'active',
        clientName:
          (clientRows.data ?? []).find((client) => client.id === event.client_id)?.name ?? null,
      })),
    }
  }, [])

  const isLoading = !configured || status === 'loading'

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Dashboard</h1>
          <p className="mp-adm-page__sub">Live counts and the latest events from the studio database.</p>
        </div>
      </header>

      {!configured ? (
        <AdminNotConfigured />
      ) : isLoading ? (
        <AdminLoading label="Loading studio counts" />
      ) : status === 'error' ? (
        <AdminError message={error} onRetry={refetch} />
      ) : (
        <>
          <div className="mp-adm-stats">
            {CARDS.map((card) => (
              <div key={card.key} className="mp-adm-stat">
                <span className="mp-adm-stat__icon">
                  <card.icon size={19} aria-hidden="true" />
                </span>
                <p className="mp-adm-stat__value">{data?.[card.key] ?? 0}</p>
                <p className="mp-adm-stat__label">{card.label}</p>
              </div>
            ))}
          </div>

          {data && data.clients === 0 && data.events === 0 && data.blogs === 0 && data.media === 0 ? (
            <div className="mp-adm-hint">
              <p className="mp-adm-hint__title">The studio database is empty</p>
              <p className="mp-adm-hint__text">
                These are real counts, not placeholders. Add the first client and their events
                to begin building the client platform.
              </p>
              <div className="mp-adm-hint__actions">
                <Button to="/admin/clients">Add the first client</Button>
              </div>
            </div>
          ) : (
            <div className="mp-adm-recent">
              <div className="mp-adm-recent__head">
                <h2 className="mp-adm-recent__title">Recent events</h2>
                <Link className="mp-adm-recent__all" to="/admin/events">
                  View all events
                </Link>
              </div>
              {data && data.recentEvents.length > 0 ? (
                <ul className="mp-adm-recent__list">
                  {data.recentEvents.map((event) => (
                    <li key={event.id} className="mp-adm-recent__row">
                      <div className="mp-adm-recent__info">
                        <p className="mp-adm-recent__name">{event.name}</p>
                        <p className="mp-adm-recent__meta">
                          {event.clientName ?? 'Unassigned client'}
                          {event.eventDate ? ` · ${formatDate(event.eventDate)}` : ''}
                        </p>
                      </div>
                      <span
                        className={`mp-adm-badge mp-adm-badge--${event.status === 'active' ? 'active' : 'inactive'}`}
                      >
                        {event.status === 'active' ? 'Active' : 'Archived'}
                      </span>
                      <Link
                        className="mp-adm-btn mp-adm-btn--secondary mp-adm-btn--sm"
                        to={`/admin/gallery/${event.id}`}
                      >
                        Open gallery
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mp-adm-recent__empty">
                  No events yet. Create the first event from the events page to see it here.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
