import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { MobileMenu } from '@/components/navigation/MobileMenu'
import { Container } from '@/components/ui/Container'
import { NAV_LINKS, ROUTES, SITE } from '@/lib/constants'
import { cn } from '@/lib/utils'

/** Three logo clicks inside this window open the admin area. */
const ADMIN_TRIGGER_WINDOW_MS = 1200
const ADMIN_TRIGGER_CLICKS = 3

/**
 * Desktop: sticky header, transparent over the page at the very top, then a
 * soft blur, hairline border and shadow once the page scrolls. The official
 * logo links home. Mobile: a hamburger that opens the full screen menu.
 */
export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const adminClicksRef = useRef([])

  /**
   * Hidden studio entrance: three clicks on the logo within a short window
   * open /admin. One or two clicks behave exactly like normal logo clicks,
   * and the counter quietly resets once the window expires.
   */
  const handleLogoClick = (event) => {
    setIsMenuOpen(false)
    const now = Date.now()
    const recent = adminClicksRef.current.filter((time) => now - time < ADMIN_TRIGGER_WINDOW_MS)
    recent.push(now)
    adminClicksRef.current = recent

    if (recent.length >= ADMIN_TRIGGER_CLICKS) {
      event.preventDefault()
      adminClicksRef.current = []
      navigate(ROUTES.ADMIN.path)
    }
  }

  // The menu always closes after navigation, whatever triggered the change.
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkClass = ({ isActive }) => cn('mp-navbar__link', isActive && 'is-active')

  return (
    <>
      <header className={cn('mp-navbar', isScrolled && 'is-scrolled')}>
        <Container className="mp-navbar__inner">
          <Link
            to={ROUTES.HOME.path}
            className="mp-brand"
            aria-label="Markipie, home"
            onClick={handleLogoClick}
          >
            <img
              className="mp-brand__logo"
              src={SITE.logoUrl}
              alt="Markipie"
              width="132"
              height="47"
            />
          </Link>

          <nav className="mp-navbar__nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={linkClass}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="mp-navbar__toggle"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </Container>
      </header>

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  )
}
