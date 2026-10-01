import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { LOGO_FULL_SRC, LOGO_PIECES, LOGO_VIEWBOX } from './logoPieces'

/**
 * Markipie opening experience.
 *
 * Pure white screen, the logo assembles from its elements with gentle spring
 * motion, a light sweep passes across the wordmark, then the overlay fades
 * and the site beneath is revealed. The site renders underneath the whole
 * time, so there is no second loading screen and no reload.
 *
 * Sequence (seconds):
 *   0.0 to 0.4    pure white
 *   0.4 to 1.2    elements appear from different directions
 *   1.0 to 2.0    elements travel into position
 *   2.0           logo complete
 *   2.0 to 2.4    settle
 *   2.3 to 2.8    shine sweep
 *   2.7 to 3.3    overlay fades, site revealed
 *
 * Reduced motion: a simplified version, the full logo fades in and out with
 * no movement.
 *
 * Session behavior lives in src/lib/intro.js and is controlled by the app
 * state that mounts this component.
 */

const TIMING = {
  firstPieceDelay: 0.38,
  pieceStagger: 0.1,
  pieceFade: 0.3,
  shineDelay: 2.3,
  shineDuration: 0.5,
  exitDelay: 2.7,
  exitDuration: 0.6,
  safetyCapMs: 5200,
}

const REDUCED_TIMING = {
  logoDelay: 0.2,
  logoDuration: 0.45,
  exitDelay: 1.4,
  exitDuration: 0.5,
  safetyCapMs: 4000,
}

/**
 * Entry motion for each logo element, left to right. Offsets are in pixels,
 * rotation is capped at four degrees, springs are softly underdamped for a
 * subtle settle. Index order matches LOGO_PIECES.
 */
const PIECE_ENTRY = [
  { x: -110, y: 18, rotate: -4, scale: 0.96, stiffness: 105, damping: 15 },
  { x: -36, y: 66, rotate: 3, scale: 0.92, stiffness: 100, damping: 14 },
  { x: 14, y: -86, rotate: 4, scale: 0.92, stiffness: 108, damping: 14.5 },
  { x: 50, y: -54, rotate: -4, scale: 0.9, stiffness: 115, damping: 15.5 },
  { x: -20, y: 78, rotate: 3, scale: 0.92, stiffness: 100, damping: 14 },
  { x: 106, y: -24, rotate: 4, scale: 0.96, stiffness: 95, damping: 13.5 },
]

const pctX = (value) => `${(value / LOGO_VIEWBOX.width) * 100}%`
const pctY = (value) => `${(value / LOGO_VIEWBOX.height) * 100}%`

export function OpeningIntro({ onComplete }) {
  const reduceMotion = useReducedMotion()
  const finishedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const finish = () => {
    if (finishedRef.current) {
      return
    }
    finishedRef.current = true
    onCompleteRef.current?.()
  }

  // Lock page scroll while the intro is on screen, and keep an absolute
  // safety cap so the site can never stay stuck behind the overlay, even if
  // an animation event is missed or the tab was backgrounded.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const safety = setTimeout(
      finish,
      reduceMotion ? REDUCED_TIMING.safetyCapMs : TIMING.safetyCapMs,
    )

    return () => {
      document.body.style.overflow = previousOverflow
      clearTimeout(safety)
    }
  }, [reduceMotion])

  const timing = reduceMotion ? REDUCED_TIMING : TIMING

  return (
    <motion.div
      className="mp-intro"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: timing.exitDelay, duration: timing.exitDuration, ease: 'easeInOut' }}
      onAnimationComplete={finish}
    >
      {reduceMotion ? (
        <motion.img
          className="mp-intro__full-logo"
          src={LOGO_FULL_SRC}
          alt=""
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: REDUCED_TIMING.logoDelay, duration: REDUCED_TIMING.logoDuration, ease: 'easeOut' }}
        />
      ) : (
        <motion.div
          className="mp-intro__logo"
          style={{ aspectRatio: `${LOGO_VIEWBOX.width} / ${LOGO_VIEWBOX.height}` }}
          initial={{ scale: 1, y: 0, opacity: 1 }}
          animate={{ scale: 1.03, y: -6, opacity: 0 }}
          transition={{ delay: TIMING.exitDelay, duration: TIMING.exitDuration, ease: [0.4, 0, 0.2, 1] }}
        >
          {LOGO_PIECES.map((piece, index) => {
            const entry = PIECE_ENTRY[index % PIECE_ENTRY.length]
            const delay = TIMING.firstPieceDelay + index * TIMING.pieceStagger
            // Note: a per property transition fully replaces the shared
            // transition, so the delay must be repeated inside each one.
            const spring = {
              type: 'spring',
              stiffness: entry.stiffness,
              damping: entry.damping,
              delay,
            }

            return (
              <motion.img
                key={piece.src}
                src={piece.src}
                alt=""
                decoding="async"
                className="mp-intro__piece"
                style={{
                  left: pctX(piece.x),
                  top: pctY(piece.y),
                  width: pctX(piece.width),
                }}
                initial={{
                  x: entry.x,
                  y: entry.y,
                  rotate: entry.rotate,
                  scale: entry.scale,
                  opacity: 0,
                }}
                animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
                transition={{
                  x: spring,
                  y: spring,
                  rotate: spring,
                  scale: spring,
                  opacity: { delay, duration: TIMING.pieceFade, ease: 'easeOut' },
                }}
              />
            )
          })}

          {/* Light sweep, clipped to the wordmark box. The white band is
              invisible on the white background and only lightens the logo
              strokes as it passes. */}
          <div className="mp-intro__shine-clip">
            <motion.div
              className="mp-intro__shine"
              initial={{ x: '-120%' }}
              animate={{ x: '340%' }}
              transition={{ delay: TIMING.shineDelay, duration: TIMING.shineDuration, ease: [0.45, 0, 0.2, 1] }}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
