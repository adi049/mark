import { useEffect } from 'react'

import { SITE } from '@/lib/constants'

/**
 * Creates or updates a meta tag in the document head.
 */
function upsertMeta(attribute, key, content) {
  if (!content) {
    return
  }

  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`)

  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }

  tag.setAttribute('content', content)
}

/**
 * Creates or updates a link tag (canonical URLs) in the document head.
 */
function upsertLink(rel, href) {
  if (!href) {
    return
  }

  let tag = document.head.querySelector(`link[rel="${rel}"]`)

  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }

  tag.setAttribute('href', href)
}

/**
 * Per page SEO. Sets the document title, meta description, canonical URL
 * and Open Graph tags. Call once from the page component:
 *
 *   useSEO({ title: 'About', description: '...', path: '/about' })
 *
 * noindex marks a page out of search results, used for the admin area.
 * Canonical and og:url tags need SITE.url (the production domain) to be
 * configured in src/lib/constants.js; without a real domain none is
 * invented.
 */
export function useSEO({ title, description, type = 'website', path, noindex = false } = {}) {
  useEffect(() => {
    // A title that already carries the brand (the home page) is used
    // verbatim; every other page becomes "Page · MARKIPIE".
    const fullTitle = !title
      ? `${SITE.name} · ${SITE.tagline}`
      : title.includes(SITE.name)
        ? title
        : `${title} · ${SITE.name}`

    const resolvedDescription = description || SITE.description

    document.title = fullTitle
    upsertMeta('name', 'description', resolvedDescription)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', resolvedDescription)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:site_name', SITE.name)
    upsertMeta('property', 'og:image', `${SITE.url || ''}/assets/brand/og-image.png`)

    if (SITE.url && path) {
      upsertMeta('property', 'og:url', `${SITE.url}${path}`)
      upsertLink('canonical', `${SITE.url}${path}`)
    }
  }, [title, description, type, path, noindex])
}
