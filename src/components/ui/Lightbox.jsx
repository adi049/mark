import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'

/**
 * Accessible image preview dialog. Escape and backdrop click close it,
 * arrow keys and buttons move between images, the background stops
 * scrolling, focus moves to the close button on open and returns to the
 * invoking element on close.
 */
export function Lightbox({ src, alt, caption, onClose, onPrev, onNext }) {
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
      if (event.key === 'ArrowLeft' && onPrev) {
        event.preventDefault()
        onPrev()
      }
      if (event.key === 'ArrowRight' && onNext) {
        event.preventDefault()
        onNext()
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
  }, [onClose, onPrev, onNext])

  return (
    <motion.div
      className="mp-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <button ref={closeRef} type="button" className="mp-lightbox__close" onClick={onClose} aria-label="Close preview">
        <X size={20} aria-hidden="true" />
      </button>

      {onPrev ? (
        <button type="button" className="mp-lightbox__nav mp-lightbox__nav--prev" onClick={onPrev} aria-label="Previous image">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
      ) : null}
      {onNext ? (
        <button type="button" className="mp-lightbox__nav mp-lightbox__nav--next" onClick={onNext} aria-label="Next image">
          <ArrowRight size={22} aria-hidden="true" />
        </button>
      ) : null}

      <motion.figure
        className="mp-lightbox__figure"
        key={src}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
      >
        <img src={src} alt={alt} />
        {caption ? <figcaption className="mp-lightbox__caption">{caption}</figcaption> : null}
      </motion.figure>
    </motion.div>
  )
}
