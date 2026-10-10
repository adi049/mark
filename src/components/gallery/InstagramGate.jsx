import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, AtSign } from 'lucide-react'

/** The official Markipie Instagram profile. */
export const INSTAGRAM_URL = 'https://www.instagram.com/markipieofficial/'

const COUNTDOWN_SECONDS = 5

/**
 * Instagram engagement gate (Phase 8).
 *
 * Shown once between a successful event code (or QR) validation and the
 * gallery. It counts down from five, then tries to open the Markipie
 * Instagram profile, and always leaves a clear way into the gallery.
 *
 * This is an engagement step. A website cannot verify whether a visitor
 * really followed the profile, so nothing here claims that, and no
 * Instagram login, password or permission is ever requested.
 *
 * @param {object} props
 * @param {object} props.event public event record from the lookup
 * @param {() => void} props.onCountdownEnd fired once when the countdown
 *   finishes, so the parent can persist the completed step immediately
 *   (a visitor who leaves and returns never counts down again)
 * @param {() => void} props.onContinue fired when the visitor continues
 *   to the gallery
 */
export function InstagramGate({ event, onCountdownEnd, onContinue }) {
  const reduceMotion = useReducedMotion()
  const [count, setCount] = useState(COUNTDOWN_SECONDS)
  const [autoBlocked, setAutoBlocked] = useState(null) // null = not tried yet
  const finishedRef = useRef(false)

  useEffect(() => {
    // Counts down once. The ref guards against React StrictMode's double
    // effect pass in development restarting the countdown.
    if (finishedRef.current) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          if (!finishedRef.current) {
            finishedRef.current = true
            finish()
          }
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
    // The countdown depends on nothing but mounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = () => {
    // Tell the parent the step is done so it is persisted right away,
    // before Instagram takes the visitor away.
    onCountdownEnd?.()

    // Try to open Instagram automatically. This runs outside a click, so
    // popup blocking is expected in many browsers; the manual button
    // below is the reliable path. The window reference is null both when
    // blocked and when noopener is used, so noopener is applied manually.
    let opened = false
    try {
      const win = window.open(INSTAGRAM_URL, '_blank')
      if (win) {
        win.opener = null
        opened = true
      }
    } catch {
      opened = false
    }
    setAutoBlocked(!opened)
    // If the browser blocks a delayed new tab, navigate this tab to Instagram.
    // The gate completion is already saved, so browser Back returns to the gallery.
    if (!opened) {
      window.location.assign(INSTAGRAM_URL)
    }
  }

  const counting = count > 0

  return (
    <AnimatePresence>
      <motion.div
        className="mp-ig"
        role="dialog"
        aria-modal="true"
        aria-label="Follow Markipie on Instagram"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
      >
        <div className="mp-ig__card">
          <p className="mp-ig__brand" aria-hidden="true">
            MARKIPIE
          </p>

          <p className="mp-ig__eyebrow">Follow us on Instagram</p>
          <h2 className="mp-ig__title">Follow Markipie to continue to your gallery.</h2>
          {event?.name ? <p className="mp-ig__event">{event.name}</p> : null}

          <a
            className="mp-ig__cta"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-counting={counting ? 'true' : 'false'}
          >
            <AtSign size={17} aria-hidden="true" />
            {counting ? 'Follow on Instagram' : 'Open Instagram'}
          </a>

          <div className="mp-ig__countdown" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {counting ? (
                <motion.div
                  key={count}
                  className="mp-ig__count"
                  initial={reduceMotion ? { opacity: 0.4 } : { opacity: 0, scale: 0.9 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0.4 } : { opacity: 0, scale: 1.08 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: 'easeOut' }}
                >
                  {count}
                </motion.div>
              ) : (
                <motion.p
                  key="done"
                  className="mp-ig__post-count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  {autoBlocked
                    ? "We couldn't open Instagram automatically."
                    : 'Instagram should now be open in a new tab.'}
                </motion.p>
              )}
            </AnimatePresence>
            {counting ? (
              <p className="mp-ig__caption">Instagram opens shortly...</p>
            ) : (
              <p className="mp-ig__caption">
                {autoBlocked
                  ? 'You can open Instagram manually, or continue straight to your gallery.'
                  : 'Come back here whenever you are ready to view your gallery.'}
              </p>
            )}
          </div>

          {!counting ? (
            <button type="button" className="mp-ig__continue" onClick={onContinue}>
              Continue to gallery
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <p className="mp-ig__note">Your gallery will continue after this step.</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
