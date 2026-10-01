import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Phone, X } from 'lucide-react'
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/BrandIcons'
import { CONTACT, NAV_LINKS, ROUTES, SITE } from '@/lib/constants'
import { cn } from '@/lib/utils'

const FOCUSABLE = 'a[href], button:not([disabled])'

/**
 * Full screen mobile menu. Locks background scrolling, traps focus,
 * closes on Escape, route change and link tap, then returns focus to
 * the element that opened it.
 */
export function MobileMenu({ isOpen, onClose }) {
  const closeRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'Tab' && menuRef.current) {
        const focusables = Array.from(menuRef.current.querySelectorAll(FOCUSABLE))
        if (focusables.length === 0) {
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus()
      }
    }
  }, [isOpen, onClose])

  const linkClass = (link) =>
    cn(
      'mp-mobile-menu__link',
      link.path === ROUTES.CLIENT_ACCESS.path && 'mp-mobile-menu__link--client'
    )

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          ref={menuRef}
          id="mobile-menu"
          className="mp-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="mp-mobile-menu__head">
            <Link to={ROUTES.HOME.path} className="mp-brand" onClick={onClose} aria-label="Markipie, home">
              <img className="mp-brand__logo" src={SITE.logoUrl} alt="Markipie" width="132" height="47" />
            </Link>
            <button
              ref={closeRef}
              type="button"
              className="mp-mobile-menu__close"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <nav className="mp-mobile-menu__nav" aria-label="Primary, mobile">
            <ul className="mp-mobile-menu__list">
              {NAV_LINKS.map((link, index) => (
                <motion.li
                  key={link.path}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + index * 0.04, duration: 0.32, ease: 'easeOut' }}
                >
                  <NavLink
                    to={link.path}
                    end={link.path === '/'}
                    onClick={onClose}
                    className={({ isActive }) => cn(linkClass(link), isActive && 'is-active')}
                  >
                    <span className="mp-mobile-menu__index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="mp-mobile-menu__label">{link.label}</span>
                  </NavLink>
                </motion.li>
              ))}
            </ul>
          </nav>

          <div className="mp-mobile-menu__foot">
            <p className="mp-mobile-menu__foot-label">Talk to the studio</p>
            <div className="mp-mobile-menu__contact">
              <a
                className="mp-mobile-menu__contact-link"
                href={CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={15} />
                <span>WhatsApp</span>
              </a>
              <a className="mp-mobile-menu__contact-link" href={CONTACT.telUrl}>
                <Phone size={15} />
                <span>Call</span>
              </a>
              <a
                className="mp-mobile-menu__contact-link"
                href={CONTACT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon size={15} />
                <span>Instagram</span>
              </a>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
