/**
 * Single-origin preview server for the Markipie production build.
 *
 * Serves dist/ as static files (with SPA fallback) and proxies the Supabase
 * API paths (/rest/v1, /auth/v1, /functions/v1) to the local mock backend
 * on :54321. One origin for everything means the browser preview needs no
 * cross-origin requests at all.
 *
 * Usage:
 *   node e2e/preview-server.mjs            # dist/ on :4173, mock on :54321
 *
 * Build the bundle with VITE_SUPABASE_URL pointing at THIS server's public
 * preview URL so the client talks to the same origin it was loaded from.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '..', 'dist')
const PORT = Number(process.env.PORT || 4173)
const MOCK_HOST = process.env.MOCK_HOST || '127.0.0.1'
const MOCK_PORT = Number(process.env.MOCK_PORT || 54321)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

const API_PREFIXES = ['/rest/v1/', '/auth/v1/', '/functions/v1/']

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')

  // ---- API paths: forward to the mock backend --------------------------
  if (API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    const headers = { ...req.headers }
    headers.host = `${MOCK_HOST}:${MOCK_PORT}`
    delete headers['accept-encoding'] // keep the proxy simple: no gzip pass-through

    const proxy = http.request(
      { host: MOCK_HOST, port: MOCK_PORT, path: req.url, method: req.method, headers },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
        proxyRes.pipe(res)
      }
    )
    proxy.on('error', () => {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'Mock backend unavailable. Start it with: node e2e/mock-supabase.mjs' }))
    })
    req.pipe(proxy)
    return
  }

  // ---- Static files with SPA fallback -----------------------------------
  let filePath = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (filePath === DIST || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath).toLowerCase()
  const isHashed = /-[A-Za-z0-9_-]{8,}\.(js|css|png|webp|woff2?)$/.test(path.basename(filePath))
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`markipie preview on http://localhost:${PORT} (static: ${DIST}, api proxied to ${MOCK_HOST}:${MOCK_PORT})`)
})
