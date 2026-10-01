import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea'

/**
 * Admin dialog: backdrop, panel, Escape to close, body scroll lock, a
 * simple focus trap and focus restore. Title doubles as the aria label.
 */
export function AdminModal({ title, onClose, children, wide = false }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
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
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
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
  }, [onClose])

  return (
    <motion.div
      className="mp-adm-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        className={`mp-adm-modal__panel${wide ? ' mp-adm-modal__panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mp-adm-modal__head">
          <h2 className="mp-adm-modal__title">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="mp-adm-modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="mp-adm-modal__body">{children}</div>
      </motion.div>
    </motion.div>
  )
}

/** Wrap conditionally rendered modals so exit animations can play. */
export function AdminModalHost({ children }) {
  return <AnimatePresence>{children}</AnimatePresence>
}
