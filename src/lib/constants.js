/**
 * Shared site configuration, contact details and route registry.
 *
 * Routes are declared once here and referenced by the router, the navbar,
 * the mobile menu and the footer, so a path change only happens in one
 * place.
 */

export const SITE = {
  name: 'MARKIPIE',
  shortName: 'Markipie',
  tagline: 'Photography, cinematography and creative studio',
  description:
    'Markipie is a premium photography, cinematography, wedding, event and creative digital services studio with an in-house color lab, editing suite and print setup.',
  // Set to the production domain when it is final, for example 'https://markipie.com'.
  url: '',
  themeColor: '#FAFAF8',
  locale: 'en_IN',
  // Official logo, served from public/assets/brand.
  logoUrl: '/assets/brand/logo-transparent.png',
  // Text fallback if the logo image is ever unavailable.
  wordmark: 'MARKIPIE',
}

/**
 * Official contact channels. Only confirmed details belong here.
 * Email is intentionally empty: set it once available and the footer and
 * contact page pick it up automatically. Do not invent an address.
 */
export const CONTACT = {
  phone: '8586000345',
  telUrl: 'tel:8586000345',
  whatsappUrl: 'https://wa.me/918586000345',
  instagramUrl: 'https://www.instagram.com/markipieofficial/',
  instagramHandle: '@markipieofficial',
  email: '',
}

/** Every route in the application. */
export const ROUTES = {
  HOME: { path: '/', label: 'Home' },
  ABOUT: { path: '/about', label: 'About' },
  SERVICES: { path: '/services', label: 'Services' },
  CLIENT_ACCESS: { path: '/client-access', label: 'Client Access' },
  GALLERY: { path: '/gallery', label: 'Gallery' },
  MARKETING: { path: '/marketing', label: 'Marketing' },
  BLOGS: { path: '/blogs', label: 'Blogs' },
  CONTACT: { path: '/contact', label: 'Contact' },
  PRIVACY_POLICY: { path: '/privacy-policy', label: 'Privacy Policy' },
  TERMS_AND_CONDITIONS: { path: '/terms-and-conditions', label: 'Terms & Conditions' },
  ADMIN: { path: '/admin', label: 'Admin' },
}

/** Primary navigation, in display order. Admin stays hidden from the navbar. */
export const NAV_LINKS = [
  ROUTES.HOME,
  ROUTES.ABOUT,
  ROUTES.SERVICES,
  ROUTES.CLIENT_ACCESS,
  ROUTES.GALLERY,
  ROUTES.MARKETING,
  ROUTES.BLOGS,
  ROUTES.CONTACT,
]

/** Footer link columns. Service entries deep link to the services grid. */
export const FOOTER_COLUMNS = [
  {
    title: 'Explore',
    links: [
      ROUTES.HOME,
      ROUTES.ABOUT,
      ROUTES.GALLERY,
      ROUTES.MARKETING,
      ROUTES.BLOGS,
      ROUTES.CONTACT,
    ],
  },
  {
    title: 'Services',
    links: [
      ROUTES.SERVICES,
      { path: '/services#service-wedding-photography', label: 'Wedding photography' },
      { path: '/services#service-wedding-cinematography', label: 'Wedding cinematography' },
      { path: '/services#service-candid-photography', label: 'Candid photography' },
      { path: '/services#service-event-photography', label: 'Event photography' },
    ],
  },
  {
    title: 'Studio',
    links: [ROUTES.CLIENT_ACCESS, ROUTES.PRIVACY_POLICY, ROUTES.TERMS_AND_CONDITIONS],
  },
]

/**
 * Breakpoint reference for any JavaScript that needs it. Mirrors the values
 * documented in src/styles/variables.css.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

/** Event types used across the studio system. */
export const EVENT_TYPES = [
  'Wedding',
  'Engagement',
  'Haldi',
  'Mehendi',
  'Reception',
  'Pre-Wedding',
  'Event',
  'Other',
]

/** Statuses shared by clients and events. */
export const RECORD_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
]
