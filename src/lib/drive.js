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
  return `${base}/media/${mediaId}?t=${encodeURIComponent(code)}&v=${variant}`
}

/** Same stream, but with a download disposition. */
export function mediaDownloadSrc(mediaId, code) {
  const base = driveBase()
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
