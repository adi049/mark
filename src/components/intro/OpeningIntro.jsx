import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { LOGO_FULL_SRC } from './logoPieces'

/**
 * Markipie opening experience.
 *
 * Uses the actual supplied Markipie wordmark for the intro instead of
 * assembling placeholder letter pieces. This keeps the logo identical to the
 * brand asset used throughout the site and avoids spacing/gap issues.
 */

const TIMING = {
  logoDelay: 0.35,
  logoDuration: 0.7,
  shineDelay: 1.45,
  shineDuration: 0.55,
  exitDelay: 2.35,
  exitDuration: 0.6,
  safetyCapMs: 4200,
}

const REDUCED_TIMING = {
  logoDelay: 0.15,
  logoDuration: 0.4,
  exitDelay: 1.25,
  exitDuration: 0.45,
  safetyCapMs: 3000,
}

export function OpeningIntro({ onComplete }) {
  const reduceMotion = useReducedMotion()
  const finishedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    onCompleteRef.current?.()
  }

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
      transition={{
        delay: timing.exitDelay,
        duration: timing.exitDuration,
        ease: 'easeInOut',
      }}
      onAnimationComplete={finish}
    >
      <motion.div
        className="mp-intro__logo"
        initial={{ opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          delay: timing.logoDelay,
          duration: timing.logoDuration,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <img
          className="mp-intro__full-logo"
          src={LOGO_FULL_SRC}
          alt=""
          decoding="async"
          fetchPriority="high"
        />

        {!reduceMotion ? (
          <div className="mp-intro__shine-clip">
            <motion.div
              className="mp-intro__shine"
              initial={{ x: '-120%' }}
              animate={{ x: '340%' }}
              transition={{
                delay: TIMING.shineDelay,
                duration: TIMING.shineDuration,
                ease: [0.45, 0, 0.2, 1],
              }}
            />
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}
