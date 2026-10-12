/**
 * Google Drive integration client (frontend side).
 *
 * All Drive traffic goes through the server boundary at
 * VITE_DRIVE_API_URL (default: the Supabase edge function), so Google
 * secrets, refresh tokens and Drive URLs never appear in the browser.
 * The endpoints, request and response shapes mirror
 * supabase/functions/drive/index.ts exactly.
 */

const trim = (value) => String(value ?? '').replace(/\/+$/, '')

function driveBase() {
  const override = import.meta.env.VITE_DRIVE_API_URL
  if (override) {
    return trim(override)
  }
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://ftnmeccyphwsyleqgmkd.supabase.co'
  return `${trim(supabaseUrl)}/functions/v1/drive`
}

/** True when a Drive backend is reachable (Supabase configured or override). */
export function isDriveConfigured() {
  return Boolean(driveBase())
}

/**
 * Starts the Google consent flow server side. The edge function binds a
 * cryptographically random, single-use OAuth state to this admin session
 * (validated at the callback) and returns the consent URL to open.
 */
export function beginDriveConnect(token, returnTo) {
  return driveFetch(token, '/auth/begin', {
    method: 'POST',
    body: JSON.stringify({ returnTo: returnTo || '/admin/gallery' }),
  })
}

async function driveFetch(token, path, options = {}) {
  const base = driveBase()
  if (!base) {
    throw new Error('Google Drive is not configured yet.')
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(import.meta.env.VITE_SUPABASE_ANON_KEY ? { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(payload?.message || 'Google Drive could not complete the request.')
  }
  return payload
}

/** Whether the studio Google account is connected, and as whom. */
export function getDriveStatus(token) {
  return driveFetch(token, '/status')
}

/** Forget the connected Google account. */
export function disconnectDrive(token) {
  return driveFetch(token, '/disconnect', { method: 'POST' })
}

/** Validate a pasted Drive folder link and read its immediate stats. */
export function verifyDriveFolder(token, urlOrId) {
  return driveFetch(token, '/verify-folder', {
    method: 'POST',
    body: JSON.stringify({ urlOrId }),
  })
}

/** Start an import job; poll with getDriveJob. */
export function startDriveImport(token, eventId, urlOrId) {
  return driveFetch(token, '/import', {
    method: 'POST',
    body: JSON.stringify({ eventId, urlOrId }),
  })
}

/** Start a sync job for an already imported event. */
export function startDriveSync(token, eventId) {
  return driveFetch(token, '/sync', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  })
}

/** Queue server-side face indexing for an event. */
export function startFaceIndex(token, eventId) {
  return driveFetch(token, '/index-faces', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  })
}

/** Current state of an import or sync job. */
export function getDriveJob(token, jobId) {
  return driveFetch(token, `/jobs/${jobId}`)
}

/**
 * Media source URL for the client gallery. Only the internal media id and
 * the event access code travel in the URL; the Drive file stays hidden
 * behind the server.
 */
export function mediaSrc(mediaId, code, variant = 'full') {
  const base = driveBase()
  if (String(code ?? '').startsWith('face:')) {
    const token = String(code).slice(5)
    return `${base}/media/${mediaId}?ft=${encodeURIComponent(token)}&v=${variant}`
  }
  return `${base}/media/${mediaId}?t=${encodeURIComponent(code)}&v=${variant}`
}

/** Same stream, but with a download disposition. */
export function mediaDownloadSrc(mediaId, code) {
  const base = driveBase()
  if (String(code ?? '').startsWith('face:')) {
    const token = String(code).slice(5)
    return `${base}/media/${mediaId}?ft=${encodeURIComponent(token)}&v=full&download=1`
  }
  return `${base}/media/${mediaId}?t=${encodeURIComponent(code)}&v=full&download=1`
}

/** Import phases in display order, matching the edge function. */
export const IMPORT_PHASES = [
  { key: 'connecting', label: 'Connecting' },
  { key: 'reading-folder', label: 'Reading folder' },
  { key: 'reading-subfolders', label: 'Reading subfolders' },
  { key: 'finding-photos', label: 'Finding photos' },
  { key: 'finding-videos', label: 'Finding videos' },
  { key: 'importing-metadata', label: 'Importing metadata' },
  { key: 'complete', label: 'Complete' },
]


/**
 * Downloads an image through the protected media endpoint. When watermarking
 * is enabled, the browser burns the same MARKIPIE pattern into the downloaded
 * file instead of downloading the unwatermarked source.
 */
export async function downloadMedia(id, code, fileName, watermark = false) {
  const url = mediaDownloadSrc(id, code)
  const response = await fetch(url)
  if (!response.ok) throw new Error('This photo could not be downloaded right now.')
  const blob = await response.blob()

  if (!watermark || !blob.type.startsWith('image/')) {
    triggerBrowserDownload(blob, fileName)
    return
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not prepare the watermarked download.')

  ctx.drawImage(bitmap, 0, 0)
  const fontSize = Math.max(22, Math.round(Math.min(bitmap.width, bitmap.height) * 0.045))
  const stepX = Math.max(260, Math.round(bitmap.width * 0.32))
  const stepY = Math.max(180, Math.round(bitmap.height * 0.22))
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${fontSize}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(bitmap.width / 2, bitmap.height / 2)
  ctx.rotate(-Math.PI / 8)
  for (let y = -bitmap.height * 1.5; y <= bitmap.height * 1.5; y += stepY) {
    for (let x = -bitmap.width * 1.5; x <= bitmap.width * 1.5; x += stepX) {
      ctx.fillText('MARKIPIE', x, y)
    }
  }
  ctx.restore()
  bitmap.close()

  const output = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the watermarked download.')), 'image/jpeg', 0.94)
  })
  triggerBrowserDownload(output, fileName)
}

function triggerBrowserDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName || 'markipie-photo'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
