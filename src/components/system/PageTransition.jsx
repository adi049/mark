import { motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

/**
 * Subtle fade between routes. Full page transition choreography arrives with
 * the design phases; this keeps navigation feeling considered in the
 * foundation and respects reduced motion preferences.
 */
export function PageTransition({ children }) {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      key={pathname}
      className="mp-page-transition"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
