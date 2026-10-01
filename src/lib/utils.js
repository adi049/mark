import { CONTACT } from './constants'

/**
 * Joins class names, ignoring falsy values.
 * A deliberate, dependency free stand in for a classnames library.
 *
 * cn('mp-card', isActive && 'is-active') => 'mp-card is-active'
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Builds a wa.me deep link with an optional prefilled message.
 */
export function buildWhatsAppLink(message) {
  if (!message) {
    return CONTACT.whatsappUrl
  }
  return `${CONTACT.whatsappUrl}?text=${encodeURIComponent(message)}`
}

/**
 * Turns a title into a URL slug: lowercase, letters and numbers kept,
 * everything else collapsed to single hyphens.
 */
export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
