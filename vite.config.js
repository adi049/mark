import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for the Markipie website.
// The "@" alias keeps imports modular as the project grows.

/**
 * SEO outputs for the production build.
 *
 * SITE_URL (a build-time variable, for example https://markipie.com) is the
 * final public domain. When it is set, the build emits sitemap.xml with
 * absolute URLs and appends a Sitemap line to robots.txt. Without it the
 * build ships the plain robots.txt from public/ and notes that the sitemap
 * still needs the domain. SITE_URL is never a secret: it is the public
 * address of the site.
 */
const SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '')

// Indexable public pages. The admin area is disallowed in robots.txt and
// marked noindex at runtime; /client-access is a utility page (a code
// entry) and is deliberately left out of the sitemap.
const SITEMAP_PATHS = [
  '/',
  '/about',
  '/services',
  '/gallery',
  '/marketing',
  '/blogs',
  '/contact',
  '/privacy-policy',
  '/terms-and-conditions',
]

function markipieSeo() {
  let outDir = 'dist'
  return {
    name: 'markipie-seo',
    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },
    closeBundle() {
      if (!SITE_URL) {
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const urls = SITEMAP_PATHS.map(
        (p) =>
          `  <url>\n    <loc>${SITE_URL}${p === '/' ? '/' : p}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
      ).join('\n')
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      fs.writeFileSync(path.resolve(outDir, 'sitemap.xml'), sitemap)

      const robots = [
        '# Markipie website robots',
        '',
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        '',
      ].join('\n')
      fs.writeFileSync(path.resolve(outDir, 'robots.txt'), robots)
    },
  }
}

export default defineConfig({
  plugins: [react(), markipieSeo()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow external preview hosts so the dev server can be viewed outside localhost.
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    // Keep the admin panel, the face recognition engine and the UI vendor
    // libraries in separate chunks so public visitors do not download them
    // with the first page.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@vladmandic/face-api')) {
              return 'face-api'
            }
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            if (id.includes('framer-motion')) {
              return 'motion'
            }
            if (id.includes('lucide-react')) {
              return 'icons'
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor'
            }
          }
          return undefined
        },
      },
    },
  },
})
