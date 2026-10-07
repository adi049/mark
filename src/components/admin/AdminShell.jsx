import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  CalendarDays,
  Images,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { AdminLoading } from '@/components/admin/StatePanels'
import { ROUTES, SITE } from '@/lib/constants'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/blogs', label: 'Blogs', icon: Newspaper },
  { to: '/admin/services', label: 'Services', icon: Briefcase },
  { to: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  events: 'Events',
  gallery: 'Gallery',
  blogs: 'Blogs',
  services: 'Services',
  marketing: 'Marketing',
  settings: 'Settings',
}

function SidebarContent({ onNavigate, onLogout }) {
  const { user } = useAdminAuth()
  return (
    <>
      <div className="mp-adm-side__brand">
        <img className="mp-adm-side__logo" src={SITE.logoUrl} alt="Markipie" width="118" height="42" />
        <span className="mp-adm-side__badge">Admin</span>
      </div>

      <nav className="mp-adm-side__nav" aria-label="Admin">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => cn('mp-adm-side__link', isActive && 'is-active')}
              >
                <item.icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mp-adm-side__foot">
        {user?.email ? <p className="mp-adm-side__user">{user.email}</p> : null}
        <Link className="mp-adm-side__public" to={ROUTES.HOME.path}>
          View public website
        </Link>
        <button type="button" className="mp-adm-side__logout" onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" />
          Logout
        </button>
      </div>
    </>
  )
}

/**
 * Authenticated admin frame: sidebar on desktop, drawer on mobile, topbar
 * with the section name. The public site navbar and footer never render
 * here.
 */
export function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { logout } = useAdminAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) {
      return undefined
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen])

  const sectionKey = pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard'
  const title = SECTION_TITLES[sectionKey] ?? 'Admin'

  const handleLogout = async () => {
    setDrawerOpen(false)
    await logout()
    navigate(ROUTES.ADMIN.path, { replace: true })
  }

  return (
    <div className="mp-adm-shell">
      <aside className="mp-adm-side" aria-label="Admin sidebar">
        <SidebarContent onNavigate={() => undefined} onLogout={handleLogout} />
      </aside>

      {drawerOpen ? (
        <div className="mp-adm-drawer__backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      ) : null}
      <div className={cn('mp-adm-drawer', drawerOpen && 'is-open')} aria-hidden={!drawerOpen}>
        <div className="mp-adm-drawer__head">
          <span className="mp-adm-drawer__title">Menu</span>
          <button
            type="button"
            className="mp-adm-drawer__close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
      </div>

      <div className="mp-adm-main">
        <header className="mp-adm-topbar">
          <button
            type="button"
            className="mp-adm-topbar__burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={drawerOpen}
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <p className="mp-adm-topbar__title">{title}</p>
        </header>
        <main className="mp-adm-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Guard: while auth loads a quiet loader shows; without a verified admin
 *  session every protected admin route redirects to the login screen at
 *  /admin. A signed-in user who is not a Markipie admin (checked through
 *  admin_check() in the auth context) never gets past this point. */
export function AdminProtected() {
  const { status, session, isAdmin } = useAdminAuth()

  if (status === 'loading') {
    return (
      <div className="mp-adm-page">
        <AdminLoading label="Checking your session" />
      </div>
    )
  }

  if (!session || !isAdmin) {
    return <Navigate to={ROUTES.ADMIN.path} replace />
  }

  return <AdminShell />
}
