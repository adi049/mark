# Brand assets

Official Markipie brand assets, served from stable URLs.

- `logo.png`: original logo file as supplied (564 x 201, brand blue on white)
- `logo-transparent.png`: the same artwork with the white background removed, for use on light backgrounds
- `logo-mark.png`: 512 x 512 transparent square crop of the M glyph, reserved for future use
- `apple-touch-icon.png`: 180 x 180 home screen icon
- `og-image.png`: 1200 x 630 social sharing image

## intro/

Transparent logo elements used by the opening experience:

- `piece-01.png` to `piece-06.png`: an automatic, pixel perfect partition of
  `logo-transparent.png`, cut only along fully blank columns. Left to right
  the pieces read "Ma", "r", "k", "i", "p", "ie". Connected script letters
  stay joined rather than being cut mid stroke.

The manifest that positions these pieces lives in
`src/components/intro/logoPieces.js`. When a higher resolution or vector logo
becomes available, regenerate the variants from `logo.png` (see the project
README) or drop in hand crafted per character assets and update the manifest.
