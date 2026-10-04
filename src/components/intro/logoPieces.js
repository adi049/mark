/**
 * Markipie intro logo manifest. The project ships a vector fallback wordmark
 * so the intro never breaks when the final supplied logo assets are absent.
 * Replace these SVG assets with the final Markipie logo pieces later without
 * changing the animation component.
 */
export const LOGO_VIEWBOX = { width: 564, height: 201 }
export const LOGO_FULL_SRC = '/assets/brand/logo-transparent.png'
export const LOGO_PIECES = [
  { src: '/assets/brand/intro/piece-01.svg', x: 13, y: 18, width: 199, height: 143 },
  { src: '/assets/brand/intro/piece-02.svg', x: 233, y: 55, width: 34, height: 106 },
  { src: '/assets/brand/intro/piece-03.svg', x: 269, y: 55, width: 60, height: 106 },
  { src: '/assets/brand/intro/piece-04.svg', x: 342, y: 55, width: 15, height: 106 },
  { src: '/assets/brand/intro/piece-05.svg', x: 377, y: 55, width: 64, height: 106 },
  { src: '/assets/brand/intro/piece-06.svg', x: 444, y: 55, width: 113, height: 106 },
]
