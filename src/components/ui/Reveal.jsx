import { motion, useReducedMotion } from 'framer-motion'

/**
 * Subtle section reveal: a quiet fade with a small rise as content scrolls
 * into view, once per element. Reduced motion renders content immediately
 * with no movement. Used sparingly on section blocks, never everywhere.
 */
export function Reveal({ children, delay = 0, y = 18, className }) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-56px' }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
