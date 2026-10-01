/**
 * Logo element manifest for the opening intro.
 *
 * The six pieces are an automatic, pixel perfect partition of the official
 * logo (public/assets/brand/logo-transparent.png, 564 x 201). Cuts were made
 * only along fully blank columns, so the pieces reassemble the original
 * artwork exactly. Left to right the pieces read: "Ma", "r", "k", "i", "p",
 * "ie". Connected script letters stay joined rather than being cut mid
 * stroke.
 *
 * To swap in hand crafted per character assets later, replace the entries
 * below with your own transparent PNGs and their x, y, width and height
 * within LOGO_VIEWBOX. To use a single image, keep one entry covering the
 * full box. Coordinates are in logo pixels; the component maps them to
 * percentages of the responsive logo frame.
 */

export const LOGO_VIEWBOX = { width: 564, height: 201 }

/** Full wordmark, used by the reduced motion version of the intro. */
export const LOGO_FULL_SRC = '/assets/brand/logo-transparent.png'

export const LOGO_PIECES = [
  { src: '/assets/brand/intro/piece-01.png', x: 13, y: 18, width: 199, height: 143 },
  { src: '/assets/brand/intro/piece-02.png', x: 233, y: 90, width: 34, height: 71 },
  { src: '/assets/brand/intro/piece-03.png', x: 269, y: 75, width: 60, height: 86 },
  { src: '/assets/brand/intro/piece-04.png', x: 342, y: 75, width: 15, height: 86 },
  { src: '/assets/brand/intro/piece-05.png', x: 377, y: 91, width: 64, height: 96 },
  { src: '/assets/brand/intro/piece-06.png', x: 444, y: 48, width: 113, height: 113 },
]
