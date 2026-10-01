import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Resets scroll on route change and honors hash links (for example
 * /services#service-wedding-photography): the target scrolls smoothly into
 * view once the lazy page has mounted, with a plain jump under reduced
 * motion. Route changes without a hash return to the very top.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1)
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // Give the lazy route a moment to mount before looking for the target.
      const timer = window.setTimeout(() => {
        const target = document.getElementById(id)
        if (target) {
          target.scrollIntoView({
            behavior: prefersReduced ? 'auto' : 'smooth',
            block: 'start',
          })
        } else {
          window.scrollTo(0, 0)
        }
      }, 80)
      return () => window.clearTimeout(timer)
    }

    window.scrollTo(0, 0)
    return undefined
  }, [pathname, hash])

  return null
}
