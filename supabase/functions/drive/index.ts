// ============================================================================
// MARKIPIE · Drive edge function (Deno, Supabase Edge Functions)
//
// The only server boundary the frontend needs. It keeps every Google secret
// and refresh token server side and exposes a small, validated API:
//
//   POST /auth/begin   { returnTo } (admin JWT)    → { url } Google consent
//   GET  /auth/callback?code&state                 → token exchange + redirect
//
// The OAuth state is a cryptographically random, single-use value bound to
// the admin who called /auth/begin (see the drive_oauth_states table).
// /auth/callback validates the hash, expiry and one-time use before the
// code is exchanged, and redirects to the site origin captured at begin
// time — never to a URL taken from the request.
//   GET  /status                                   → { connected, email }
//   POST /disconnect                               → forget the connection
//   POST /verify-folder  { urlOrId }               → folder check + counts
//   POST /import        { eventId, urlOrId }       → starts an import job
//   POST /sync          { eventId }                → starts a sync job
//   GET  /jobs/:id                                 → job phase and result
//   GET  /media/:id?t=CODE&v=thumb|full[&download] → streams media bytes
//
// Required function secrets (never VITE_ variables):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   SUPABASE_SERVICE_ROLE_KEY  (supabase secrets set)
//
// Deploy:
//   supabase functions deploy drive --no-verify-jwt
//   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
//
// --no-verify-jwt is used because /auth/* and /media/* are called by
// browsers without a Supabase session; every admin endpoint below verifies
// the caller's JWT itself before touching anything.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
])
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm'])

const env = (name) => Deno.env.get(name) ?? ''
const functionUrl = (request) => {
  const url = new URL(request.url)
  return `${url.origin}/functions/v1/drive`
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function corsPreflight(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') ??
        'authorization, content-type, apikey',
    },
  })
}

// ---------------------------------------------------------------- Supabase --
function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  
  // Supabase now provisions the newer named secret-key map in hosted
  // Edge Functions. Keep the legacy service-role variable as a fallback
  // for existing projects.
  let secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!secretKey) {
    try {
      const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
      secretKey = secretKeys.default ?? ''
    } catch {
      secretKey = ''
    }
  }

  if (!supabaseUrl || !secretKey) {
    throw new Error('Supabase server key is not available in the Edge Function runtime.')
  }

  return createClient(
    supabaseUrl,
    secretKey,
    { auth: { persistSession: false } }
  )
}

async function requireAdmin(request) {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    throw new HttpError(401, 'Sign in as an admin first.')
  }
  const db = adminClient()
  const { data, error } = await db.auth.getUser(auth.slice(7))
  if (error || !data?.user) {
    throw new HttpError(401, 'Your session expired. Sign in again.')
  }
  const { data: admin } = await db
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (!admin) {
    throw new HttpError(403, 'Admin access required.')
  }
  return { db, user: data.user }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ------------------------------------------------------------ OAuth state --
// Random state: 32 bytes from the platform CSPRNG, base64url. Only its
// SHA-256 hash is stored server side.
function randomState() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Base64(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  let binary = ''
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// The site origin that started the flow, taken from the authenticated
// /auth/begin request headers. Must be a plain http(s) origin.
function siteOriginFrom(request) {
  for (const header of ['origin', 'referer']) {
    const value = request.headers.get(header)
    if (!value) {
      continue
    }
    try {
      const parsed = new URL(value)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin
      }
    } catch {
      // Ignore malformed headers.
    }
  }
  return null
}

async function beginOauthState(request, returnTo) {
  const { db, user: admin } = await requireAdmin(request)
  const siteOrigin = siteOriginFrom(request)
  if (!siteOrigin) {
    throw new HttpError(400, 'The site origin could not be determined. Open the admin panel in the browser and try again.')
  }
  const state = randomState()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  // Opportunistic cleanup: states older than their expiry are dead rows.
  await db.from('drive_oauth_states').delete().lt('expires_at', new Date().toISOString())
  const { error } = await db.from('drive_oauth_states').insert({
    state_hash: await sha256Base64(state),
    admin_user_id: admin.id,
    site_origin: siteOrigin,
    return_to: returnTo,
    expires_at: expiresAt,
  })
  if (error) {
    throw new HttpError(500, 'The Drive connection could not be started. Please try again.')
  }
  return { state, clientId: env('GOOGLE_CLIENT_ID') }
}

// Validates and consumes a callback state. Returns the stored row or null.
async function consumeOauthState(db, state) {
  if (!state || state.length < 20 || state.length > 200) {
    return null
  }
  const hash = await sha256Base64(state)
  const { data: row } = await db
    .from('drive_oauth_states')
    .select('id, site_origin, return_to, expires_at, used_at')
    .eq('state_hash', hash)
    .maybeSingle()
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return null
  }
  // Mark used immediately: a state value can never be replayed, even if
  // the token exchange that follows fails.
  await db.from('drive_oauth_states').update({ used_at: new Date().toISOString() }).eq('id', row.id)
  return row
}

// ---------------------------------------------------------------- Google ----
async function googleToken(db, { code } = {}) {
  const clientId = env('GOOGLE_CLIENT_ID')
  const clientSecret = env('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new HttpError(503, 'Google Drive is not configured on the server yet.')
  }

  if (code) {
    // Initial exchange from the OAuth callback.
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: `${functionUrlBase()}/auth/callback`,
    })
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const tokens = await response.json()
    if (!response.ok) {
      throw new HttpError(502, 'Google rejected the sign in. Please try again.')
    }
    const infoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = infoResponse.ok ? await infoResponse.json() : {}
    await db.from('drive_connections').delete()
    await db.from('drive_connections').insert({
      email: info.email ?? 'Google account',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      scope: tokens.scope ?? DRIVE_SCOPE,
    })
    return tokens.access_token
  }

  // Refresh from the stored refresh token.
  const { data: connection } = await db
    .from('drive_connections')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (!connection) {
    throw new HttpError(409, 'Connect Google Drive first.')
  }
  if (
    connection.access_token &&
    connection.access_token_expires_at &&
    new Date(connection.access_token_expires_at).getTime() > Date.now() + 60000
  ) {
    return connection.access_token
  }
  const body = new URLSearchParams({
    refresh_token: connection.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokens = await response.json()
  if (!response.ok) {
    throw new HttpError(401, 'The Google Drive connection expired. Connect again.')
  }
  await db
    .from('drive_connections')
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    })
    .eq('id', connection.id)
  return tokens.access_token
}

// Filled per request; see handler.
let baseForRedirects = ''

function functionUrlBase() {
  return baseForRedirects
}

async function driveFetch(db, path, options = {}) {
  const token = await googleToken(db)
  const response = await fetch(`https://www.googleapis.com/${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(403, 'Google did not allow access to that folder. Reconnect Drive or check the folder sharing.')
  }
  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.clone().json()
      detail = payload?.error?.message ?? payload?.error_description ?? ''
    } catch {
      try {
        detail = (await response.clone().text()).slice(0, 300)
      } catch {
        detail = ''
      }
    }
    const suffix = detail ? ` (${detail})` : ''
    throw new HttpError(502, `Google Drive request failed with HTTP ${response.status}${suffix}.`)
  }
  return response
}

// --------------------------------------------------------------- helpers ----
function parseFolderInput(input) {
  const value = String(input ?? '').trim()
  if (!value) {
    throw new HttpError(400, 'Paste a Google Drive folder link first.')
  }
  const patterns = [
    /drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]{10,})/,
    /drive\.google\.com\/\?folders=([A-Za-z0-9_-]{10,})/,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(value)
    if (match) {
      return match[1]
    }
  }
  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) {
    return value
  }
  throw new HttpError(400, 'That does not look like a Google Drive folder link.')
}

function fileKind(file) {
  if (IMAGE_MIMES.has(file.mimeType)) {
    return 'image'
  }
  if (VIDEO_MIMES.has(file.mimeType)) {
    return 'video'
  }
  if (file.fileExtension) {
    const ext = file.fileExtension.toLowerCase()
    if (IMAGE_EXTS.has(ext)) {
      return 'image'
    }
    if (VIDEO_EXTS.has(ext)) {
      return 'video'
    }
  }
  return null
}

async function listChildren(db, folderId, pageToken) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      'nextPageToken, files(id, name, mimeType, fileExtension, size, modifiedTime, thumbnailLink)',
    pageSize: '200',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  if (pageToken) {
    params.set('pageToken', pageToken)
  }
  const response = await driveFetch(db, `drive/v3/files?${params}`)
  const payload = await response.json()
  return { files: payload.files ?? [], nextPageToken: payload.nextPageToken }
}

async function listAllChildren(db, folderId) {
  const files = []
  let pageToken = null
  do {
    const page = await listChildren(db, folderId, pageToken)
    files.push(...page.files)
    pageToken = page.nextPageToken
  } while (pageToken)
  return files
}

// ---------------------------------------------------------------- jobs ------
async function createJob(db, kind, eventId, userId) {
  const { data, error } = await db
    .from('drive_jobs')
    .insert({ kind, event_id: eventId, created_by: userId, phase: 'connecting' })
    .select('id')
    .single()
  if (error) {
    throw new HttpError(500, 'The import could not be started. Please try again.')
  }
  return data.id
}

async function setPhase(db, jobId, phase, message = null) {
  await db.from('drive_jobs').update({ phase, message, updated_at: new Date().toISOString() }).eq('id', jobId)
}

async function finishJob(db, jobId, result) {
  await db
    .from('drive_jobs')
    .update({ done: true, phase: 'complete', result, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

async function failJob(db, jobId, message) {
  await db
    .from('drive_jobs')
    .update({ done: true, error: message, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

const PHASE_LABELS = {
  connecting: 'Connecting',
  'reading-folder': 'Reading folder',
  'reading-subfolders': 'Reading subfolders',
  'finding-photos': 'Finding photos',
  'finding-videos': 'Finding videos',
  'importing-metadata': 'Importing metadata',
  complete: 'Complete',
}

async function runImport(db, jobId, eventId, urlOrId, userId) {
  try {
    const folderId = parseFolderInput(urlOrId)
    await setPhase(db, jobId, 'connecting')

    // Walk Drive with correct parent tracking.
    const token = await googleToken(db)
    const rootResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!rootResponse.ok) {
      throw new HttpError(404, 'That folder could not be reached. Check the link and sharing.')
    }
    const root = await rootResponse.json()
    if (root.mimeType !== 'application/vnd.google-apps.folder') {
      throw new HttpError(400, 'That link is a file, not a folder.')
    }

    await setPhase(db, jobId, 'reading-folder')

    // (externalId → row placeholder), inserted top down so parents exist.
    const folderRows = [{ externalId: root.id, name: root.name, parentExternalId: null }]
    const mediaRows = []
    let sortCounter = 0
    const seenPhase = { photos: false, videos: false }

    let level = [root.id]
    let guard = 0
    while (level.length > 0 && guard < 50) {
      guard += 1
      const levelFiles = await Promise.all(level.map((id) => listAllChildren(db, id)))
      const nextLevel = []
      for (let i = 0; i < level.length; i += 1) {
        for (const child of levelFiles[i]) {
          if (child.mimeType === 'application/vnd.google-apps.folder') {
            folderRows.push({ externalId: child.id, name: child.name, parentExternalId: level[i] })
            nextLevel.push(child.id)
          } else {
            const kind = fileKind(child)
            if (kind === 'image' && !seenPhase.photos) {
              seenPhase.photos = true
              await setPhase(db, jobId, 'finding-photos')
            }
            if (kind === 'video' && !seenPhase.videos) {
              seenPhase.videos = true
              await setPhase(db, jobId, 'finding-videos')
            }
            if (kind) {
              sortCounter += 1
              mediaRows.push({
                externalId: child.id,
                folderExternalId: level[i],
                file_name: child.name,
                file_type: kind,
                mime_type: child.mimeType,
                file_size: child.size ? Number(child.size) : null,
                sort_order: sortCounter,
              })
            }
          }
        }
      }
      if (nextLevel.length > 0) {
        await setPhase(db, jobId, 'reading-subfolders')
      }
      level = nextLevel
    }

    await setPhase(db, jobId, 'importing-metadata')

    // Insert folders top down, resolving parents to internal ids.
    const idByExternal = new Map()
    let depth = 0
    let insertedFolders = 0
    while (idByExternal.size < folderRows.length && depth < 60) {
      for (const row of folderRows) {
        if (idByExternal.has(row.externalId)) {
          continue
        }
        const parentOk = !row.parentExternalId || idByExternal.has(row.parentExternalId)
        if (!parentOk) {
          continue
        }
        const { data: inserted } = await db
          .from('event_folders')
          .upsert(
            {
              event_id: eventId,
              name: row.name,
              folder_type: row.parentExternalId ? 'subfolder' : 'section',
              external_folder_id: row.externalId,
              parent_id: row.parentExternalId ? idByExternal.get(row.parentExternalId) : null,
              status: 'available',
            },
            { onConflict: 'event_id,external_folder_id' }
          )
          .select('id')
          .single()
        idByExternal.set(row.externalId, inserted.id)
        insertedFolders += 1
      }
      depth += 1
    }

    // Insert media with duplicate protection on (event_id, external_file_id).
    let duplicates = 0
    let insertedMedia = 0
    for (const row of mediaRows) {
      const { data: existing } = await db
        .from('media')
        .select('id')
        .eq('event_id', eventId)
        .eq('external_file_id', row.externalId)
        .maybeSingle()
      if (existing) {
        duplicates += 1
        continue
      }
      await db.from('media').insert({
        event_id: eventId,
        folder_id: row.folderExternalId ? idByExternal.get(row.folderExternalId) : null,
        file_name: row.file_name,
        file_type: row.file_type,
        mime_type: row.mime_type,
        file_size: row.file_size,
        external_file_id: row.externalId,
        sort_order: row.sort_order,
        status: 'available',
      })
      insertedMedia += 1
    }

    await db
      .from('events')
      .update({
        drive_folder_id: root.id,
        drive_folder_name: root.name,
        drive_folder_url: `https://drive.google.com/drive/folders/${root.id}`,
        drive_synced_at: new Date().toISOString(),
      })
      .eq('id', eventId)

    const photos = mediaRows.filter((m) => m.file_type === 'image').length
    const videos = mediaRows.filter((m) => m.file_type === 'video').length
    await finishJob(db, jobId, {
      folders: folderRows.length,
      photos,
      videos,
      insertedFolders,
      insertedMedia,
      duplicates,
    })
  } catch (error) {
    await failJob(db, jobId, error instanceof HttpError ? error.message : 'The import failed. Please try again.')
  }
}

async function runSync(db, jobId, eventId) {
  try {
    const { data: event } = await db.from('events').select('drive_folder_id').eq('id', eventId).maybeSingle()
    if (!event?.drive_folder_id) {
      throw new HttpError(400, 'Import a Drive folder before syncing.')
    }
    // Re-run the walk; upserts keep existing rows, missing files are marked
    // unavailable rather than deleted.
    const url = `https://drive.google.com/drive/folders/${event.drive_folder_id}`
    const result = await syncWalk(db, jobId, eventId, event.drive_folder_id)
    await db.from('events').update({ drive_synced_at: new Date().toISOString() }).eq('id', eventId)
    await finishJob(db, jobId, result)
  } catch (error) {
    await failJob(db, jobId, error instanceof HttpError ? error.message : 'The sync failed. Please try again.')
  }
}

async function syncWalk(db, jobId, eventId, rootId) {
  await setPhase(db, jobId, 'connecting')
  const token = await googleToken(db)
  const rootResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${rootId}?fields=id,name&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!rootResponse.ok) {
    throw new HttpError(404, 'The connected Drive folder is no longer reachable.')
  }
  await setPhase(db, jobId, 'reading-folder')

  // Same walk as import but with upsert semantics and availability marking.
  const folderRows = [{ externalId: rootId, name: (await rootResponse.json()).name, parentExternalId: null }]
  const mediaRows = []
  let sortCounter = 0
  let level = [rootId]
  let guard = 0
  while (level.length > 0 && guard < 50) {
    guard += 1
    const levelFiles = await Promise.all(level.map((id) => listAllChildren(db, id)))
    const nextLevel = []
    for (let i = 0; i < level.length; i += 1) {
      for (const child of levelFiles[i]) {
        if (child.mimeType === 'application/vnd.google-apps.folder') {
          folderRows.push({ externalId: child.id, name: child.name, parentExternalId: level[i] })
          nextLevel.push(child.id)
        } else {
          const kind = fileKind(child)
          if (kind) {
            sortCounter += 1
            mediaRows.push({
              externalId: child.id,
              folderExternalId: level[i],
              file_name: child.name,
              file_type: kind,
              mime_type: child.mimeType,
              file_size: child.size ? Number(child.size) : null,
              sort_order: sortCounter,
            })
          }
        }
      }
    }
    await setPhase(db, jobId, 'reading-subfolders')
    level = nextLevel
  }
  await setPhase(db, jobId, 'finding-photos')
  await setPhase(db, jobId, 'finding-videos')
  await setPhase(db, jobId, 'importing-metadata')

  const idByExternal = new Map()
  let depth = 0
  while (idByExternal.size < folderRows.length && depth < 60) {
    for (const row of folderRows) {
      if (idByExternal.has(row.externalId)) {
        continue
      }
      const parentOk = !row.parentExternalId || idByExternal.has(row.parentExternalId)
      if (!parentOk) {
        continue
      }
      const { data: inserted } = await db
        .from('event_folders')
        .upsert(
          {
            event_id: eventId,
            name: row.name,
            folder_type: row.parentExternalId ? 'subfolder' : 'section',
            external_folder_id: row.externalId,
            parent_id: row.parentExternalId ? idByExternal.get(row.parentExternalId) : null,
            status: 'available',
          },
          { onConflict: 'event_id,external_folder_id' }
        )
        .select('id')
        .single()
      idByExternal.set(row.externalId, inserted.id)
    }
    depth += 1
  }

  const externalIds = new Set(mediaRows.map((m) => m.externalId))
  const { data: existingMedia } = await db
    .from('media')
    .select('id, external_file_id, file_name, status')
    .eq('event_id', eventId)

  let added = 0
  let updated = 0
  let unavailable = 0
  const byExternal = new Map((existingMedia ?? []).map((m) => [m.external_file_id, m]))
  for (const row of mediaRows) {
    const existing = byExternal.get(row.externalId)
    if (!existing) {
      await db.from('media').insert({
        event_id: eventId,
        folder_id: row.folderExternalId ? idByExternal.get(row.folderExternalId) : null,
        file_name: row.file_name,
        file_type: row.file_type,
        mime_type: row.mime_type,
        file_size: row.file_size,
        external_file_id: row.externalId,
        sort_order: row.sort_order,
        status: 'available',
      })
      added += 1
    } else {
      if (existing.file_name !== row.file_name || existing.status !== 'available') {
        await db
          .from('media')
          .update({ file_name: row.file_name, status: 'available' })
          .eq('id', existing.id)
        updated += 1
      }
    }
  }
  for (const row of existingMedia ?? []) {
    if (!externalIds.has(row.external_file_id)) {
      await db.from('media').update({ status: 'unavailable' }).eq('id', row.id)
      unavailable += 1
    }
  }

  return {
    folders: folderRows.length,
    photos: mediaRows.filter((m) => m.file_type === 'image').length,
    videos: mediaRows.filter((m) => m.file_type === 'video').length,
    added,
    updated,
    unavailable,
  }
}

// ---------------------------------------------------------------- media -----
async function serveMedia(request, mediaId) {
  const url = new URL(request.url)
  const code = url.searchParams.get('t') ?? ''
  const variant = url.searchParams.get('v') === 'thumb' ? 'thumb' : 'full'
  const download = url.searchParams.get('download') === '1'
  if (!code) {
    return jsonResponse({ message: 'Missing event access.' }, 401)
  }

  const db = adminClient()
  const normalizedCode = code.trim().toUpperCase()
  let { data: event } = await db
    .from('events')
    .select('id, status, access_code, qr_token, download_enabled')
    .eq('status', 'active')
    .eq('access_code', normalizedCode)
    .maybeSingle()
  if (!event) {
    const qrLookup = await db
      .from('events')
      .select('id, status, access_code, qr_token, download_enabled')
      .eq('status', 'active')
      .eq('qr_token', code.trim())
      .maybeSingle()
    event = qrLookup.data ?? null
  }
  if (!event) {
    return jsonResponse({ message: 'This gallery link is no longer valid.' }, 401)
  }
  if (download && event.download_enabled === false) {
    // The UI hides the button, but the server is the real gate: downloads
    // are refused here even when the URL is called directly.
    return jsonResponse({ message: 'Downloads are turned off for this event.' }, 403)
  }

  const { data: media } = await db
    .from('media')
    .select('id, event_id, external_file_id, file_name, file_type, mime_type, status')
    .eq('id', mediaId)
    .maybeSingle()
  if (!media || media.event_id !== event.id || media.status !== 'available') {
    return jsonResponse({ message: 'This media is not available.' }, 404)
  }

  const token = await googleToken(db)
  const headers = {
    'Cache-Control': 'private, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  }
  if (download) {
    headers['Content-Disposition'] = `attachment; filename="${(media.file_name ?? 'markipie-photo').replace(/"/g, '')}"`
  }

  // Thumbnails prefer Drive's generated thumbnail; full size streams the
  // original. Both stay behind this endpoint so no Drive URL is exposed.
  if (variant === 'thumb' && media.file_type === 'image') {
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${media.external_file_id}?fields=thumbnailLink&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (metaResponse.ok) {
      const meta = await metaResponse.json()
      if (meta.thumbnailLink) {
        const thumbResponse = await fetch(`${meta.thumbnailLink}&sz=w640`)
        if (thumbResponse.ok) {
          return new Response(thumbResponse.body, {
            status: 200,
            headers: { ...headers, 'Content-Type': 'image/jpeg' },
          })
        }
      }
    }
  }

  // Forward browser byte-range requests so HTML5 video can seek and play
  // progressively through the Edge Function instead of downloading the entire file.
  const requestedRange = request.headers.get('range')
  const driveHeaders = { Authorization: `Bearer ${token}` }
  if (requestedRange) {
    driveHeaders.Range = requestedRange
  }

  const fileResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${media.external_file_id}?alt=media&supportsAllDrives=true`,
    { headers: driveHeaders }
  )
  if (!fileResponse.ok && fileResponse.status !== 206) {
    return jsonResponse({ message: 'This media could not be loaded right now.' }, 502)
  }

  const responseHeaders = {
    ...headers,
    'Content-Type':
      media.mime_type ??
      fileResponse.headers.get('content-type') ??
      'application/octet-stream',
    'Accept-Ranges': 'bytes',
  }
  for (const name of ['content-length', 'content-range']) {
    const value = fileResponse.headers.get(name)
    if (value) {
      responseHeaders[name] = value
    }
  }

  return new Response(fileResponse.body, {
    status: fileResponse.status,
    headers: responseHeaders,
  })
}

// ---------------------------------------------------------------- router ----
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return corsPreflight(request)
  }

  const url = new URL(request.url)
  const path = url.pathname
    .replace(/^\/functions\/v1\/drive\/?/, '')
    .replace(/^\/drive\/?/, '')
    .replace(/^\/?/, '')
  baseForRedirects = `https://${url.host}/functions/v1/drive`

  try {
    // ---- OAuth begin (admin authenticated; returns the consent URL) ----
    if (path === 'auth/begin' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const returnTo = sanitizeReturnTo(body?.returnTo)
      const clientId = env('GOOGLE_CLIENT_ID')
      const clientSecret = env('GOOGLE_CLIENT_SECRET')
      if (!clientId || !clientSecret) {
        throw new HttpError(503, 'Google Drive is not configured on the server yet. See supabase/README.md.')
      }
      const { state } = await beginOauthState(request, returnTo)
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${baseForRedirects}/auth/callback`,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: DRIVE_SCOPE,
        state,
        include_granted_scopes: 'true',
      })
      return jsonResponse({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
    }

    // ---- OAuth callback (browser navigation from Google) ----
    if (path === 'auth/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code')
      const db = adminClient()
      const stateRow = await consumeOauthState(db, url.searchParams.get('state'))
      if (!stateRow) {
        return new Response(
          `<!doctype html><html><head><meta charset="utf-8"><title>Drive connection expired</title>` +
            `<style>body{font-family:system-ui,sans-serif;background:#fafaf8;color:#22282b;` +
            `display:grid;place-items:center;min-height:100vh;margin:0}` +
            `.card{max-width:32rem;padding:2rem;text-align:center}` +
            `h1{font-size:1.2rem}p{line-height:1.6;color:#4e565b}</style></head>` +
            `<body><div class="card"><h1>This Drive connection link is no longer valid</h1>` +
            `<p>Connection links are single-use and expire after ten minutes. ` +
            `Open the MARKIPIE admin panel and start the Google Drive connection again.</p></div></body></html>`,
          { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
      const back = `${stateRow.site_origin}${stateRow.return_to}`
      if (!code) {
        return Response.redirect(`${back}?drive=denied`, 302)
      }
      await googleToken(db, { code })
      return Response.redirect(`${back}?drive=connected`, 302)
    }

    // ---- Admin endpoints ----
    if (path === 'status' && request.method === 'GET') {
      const { db } = await requireAdmin(request)
      const { data } = await db.from('drive_connections').select('email, scope, updated_at').limit(1).maybeSingle()
      return jsonResponse({ connected: Boolean(data), email: data?.email ?? null })
    }

    if (path === 'disconnect' && request.method === 'POST') {
      const { db } = await requireAdmin(request)
      await db.from('drive_connections').delete()
      return jsonResponse({ connected: false })
    }

    if (path === 'verify-folder' && request.method === 'POST') {
      const { db } = await requireAdmin(request)
      const body = await request.json()
      const folderId = parseFolderInput(body?.urlOrId)
      const token = await googleToken(db)
      const metaResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!metaResponse.ok) {
        throw new HttpError(404, 'That folder could not be reached. Check the link and sharing.')
      }
      const meta = await metaResponse.json()
      if (meta.mimeType !== 'application/vnd.google-apps.folder') {
        throw new HttpError(400, 'That link is a file, not a folder.')
      }
      const children = await listAllChildren(db, folderId)
      const childFolders = children.filter((c) => c.mimeType === 'application/vnd.google-apps.folder').length
      const mediaFiles = children.filter((c) => fileKind(c)).length
      return jsonResponse({ folderId: meta.id, name: meta.name, childFolders, mediaFiles })
    }

    if (path === 'import' && request.method === 'POST') {
      const { db, user } = await requireAdmin(request)
      const body = await request.json()
      if (!body?.eventId) {
        throw new HttpError(400, 'Choose the event to import into first.')
      }
      parseFolderInput(body?.urlOrId)
      const jobId = await createJob(db, 'import', body.eventId, user.id)
      // Edge functions should return quickly; the walk continues in this
      // invocation's lifetime. For very large folders, split the walk into
      // repeated /sync calls (each pass picks up where the tree left off).
      EdgeRuntime.waitUntil(runImport(db, jobId, body.eventId, body.urlOrId, user.id))
      return jsonResponse({ jobId }, 202)
    }

    if (path === 'sync' && request.method === 'POST') {
      const { db, user } = await requireAdmin(request)
      const body = await request.json()
      if (!body?.eventId) {
        throw new HttpError(400, 'Choose the event to sync first.')
      }
      const jobId = await createJob(db, 'sync', body.eventId, user.id)
      EdgeRuntime.waitUntil(runSync(db, jobId, body.eventId))
      return jsonResponse({ jobId }, 202)
    }

    const jobMatch = /^jobs\/([A-Za-z0-9-]+)$/.exec(path)
    if (jobMatch && request.method === 'GET') {
      const { db, user } = await requireAdmin(request)
      const { data } = await db
        .from('drive_jobs')
        .select('*')
        .eq('id', jobMatch[1])
        .maybeSingle()
      if (!data || data.created_by !== user.id) {
        throw new HttpError(404, 'That job does not exist.')
      }
      return jsonResponse({
        id: data.id,
        kind: data.kind,
        phase: data.phase,
        label: PHASE_LABELS[data.phase] ?? data.phase,
        message: data.message,
        done: data.done,
        error: data.error,
        result: data.result,
      })
    }

    const mediaMatch = /^media\/([A-Za-z0-9-]+)$/.exec(path)
    if (mediaMatch && request.method === 'GET') {
      return serveMedia(request, mediaMatch[1])
    }

    return jsonResponse({ message: 'Not found' }, 404)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message =
      error instanceof HttpError ? error.message : 'Something went wrong. Please try again.'
    return jsonResponse({ message }, status)
  }
})

function sanitizeReturnTo(value) {
  const path = String(value ?? '/admin/gallery')
  if (!path.startsWith('/') || path.startsWith('//')) {
    return '/admin/gallery'
  }
  return path
}
