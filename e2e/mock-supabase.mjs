#!/usr/bin/env node
/**
 * MARKIPIE e2e mock · Supabase + Google Drive + face search contract
 * -------------------------------------------------------------------------
 * Mocks everything the app talks to, on http://localhost:54321:
 *
 *   GoTrue      /auth/v1/token (password + refresh), /auth/v1/user, /auth/v1/logout
 *   PostgREST   /rest/v1/:table with eq/in filters, order, limit, counts,
 *               single-object Accept, inserts, updates, deletes and the
 *               public RLS rules (published blogs, active services).
 *   RPC         lookup_event_by_code, get_event_folders,
 *               get_event_subfolders, get_event_media, set_reaction,
 *               admin_media_overview, admin_event_media_stats,
 *               search_event_faces (Phase 7),
 *               admin_event_media_list, admin_store_face_embeddings,
 *               admin_clear_face_index, admin_face_index_stats (Phase 7)
 *   Drive       /functions/v1/drive/... OAuth redirect chain, connection
 *               status, folder verification, import + sync jobs with
 *               phases, job polling and media streaming (PNG images with
 *               composited faces, WebM video with Range support).
 *   Face data   face_embeddings rows (128-number arrays) and an exact
 *               Euclidean distance search mirroring the pgvector RPC.
 *   Gate        events carry instagram_gate_enabled (event-1 ON, event-2
 *               OFF, event-3 ON); lookup_event_by_code returns it and the
 *               events table supports real admin PATCH updates (Phase 8).
 *   Phase 9     events carry payment_status (event-1 unpaid, event-2 paid,
 *               event-3 partial) + audit fields; media carries
 *               album_selected; RPCs admin_set_payment_status,
 *               admin_set_album_selection, admin_reaction_summary and an
 *               extended admin_event_media_list (album_selected,
 *               client_reaction).
 *
 * Test identities:
 *   admin   studio@markipie.test / markipie-test-admin
 *   event-1 Rahul and Priya Wedding · code MP-4K7RQP · token weddingtoken1234567890abcdef1234
 *           flags all true · wedding Drive tree (156 photos / 9 videos / 13 folders)
 *   event-2 Arjun and Meera Birthday · code MP-9HXT2M · flags all false
 *           birthday Drive tree (29 photos / 2 videos / 5 folders)
 *   event-3 Naina and Vikram Sangeet · code MP-3QB8VN · empty gallery
 *
 * Faces: wedding photos at deterministic positions contain face A or B
 * (raw RGB patches in ./assets). The browser face engine detects them when
 * indexing; the e2e fake camera streams the same faces as Y4M files.
 *
 *   POST /__reset  re-seeds everything and clears the Drive connection,
 *                  jobs and the face index.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'

const PORT = 54321
const HERE = path.dirname(new URL(import.meta.url).pathname)
const ASSETS = path.join(HERE, 'assets')

const ADMIN_EMAIL = 'studio@markipie.test'
const ADMIN_PASSWORD = 'markipie-test-admin'
const ADMIN_USER_ID = 'admin-user-0000-0000-0000-000000000001'
const ACCESS_TOKEN = 'mock-access-token-markipie-admin'
const REFRESH_TOKEN = 'mock-refresh-token-markipie-admin'

// A second, ordinary authenticated user. Signed in, but NOT in public.admins:
// used to prove that logging into Supabase alone does not open the admin
// panel (Phase 10 admin authorization checks).
const NONADMIN_EMAIL = 'client@markipie.test'
const NONADMIN_PASSWORD = 'markipie-test-client'
const NONADMIN_USER_ID = 'client-user-0000-0000-0000-000000000002'
const NONADMIN_TOKEN = 'mock-access-token-markipie-client'
const NONADMIN_REFRESH = 'mock-refresh-token-markipie-client'

// ------------------------------------------------------------------ state
let db
let drive
let jobs
let driveStates

function seed() {
  db = {
    clients: [
      { id: 'client-1', name: 'Rahul and Priya Sharma', phone: '9811100001', email: null, created_at: '2025-08-01T10:00:00Z' },
      { id: 'client-2', name: 'Arjun and Meera', phone: '9811100002', email: null, created_at: '2025-08-02T10:00:00Z' },
    ],
    events: [
      {
        id: 'event-1',
        client_id: 'client-1',
        client_name: 'Rahul and Priya Sharma',
        name: 'Rahul and Priya Wedding',
        event_type: 'Wedding',
        event_date: '2025-11-20',
        status: 'active',
        access_code: 'MP-4K7RQP',
        qr_token: 'weddingtoken1234567890abcdef1234',
        watermark_enabled: true,
        download_enabled: true,
        reaction_enabled: true,
        face_scan_enabled: true,
        instagram_gate_enabled: true,
        payment_status: 'unpaid',
        payment_updated_at: null,
        payment_updated_by: null,
        permissions_updated_at: null,
        permissions_updated_by: null,
        drive_folder_id: null,
        drive_folder_url: null,
        drive_folder_name: null,
        drive_synced_at: null,
        created_at: '2025-09-01T10:00:00Z',
      },
      {
        id: 'event-2',
        client_id: 'client-2',
        client_name: 'Arjun and Meera',
        name: 'Arjun and Meera Birthday',
        event_type: 'Birthday',
        event_date: '2025-12-05',
        status: 'active',
        access_code: 'MP-9HXT2M',
        qr_token: 'birthdaytoken1234567890abcdef1234',
        watermark_enabled: false,
        download_enabled: false,
        reaction_enabled: false,
        face_scan_enabled: false,
        instagram_gate_enabled: false,
        payment_status: 'paid',
        payment_updated_at: null,
        payment_updated_by: null,
        permissions_updated_at: null,
        permissions_updated_by: null,
        drive_folder_id: null,
        drive_folder_url: null,
        drive_folder_name: null,
        drive_synced_at: null,
        created_at: '2025-09-02T10:00:00Z',
      },
      {
        id: 'event-3',
        client_id: 'client-1',
        client_name: 'Naina and Vikram',
        name: 'Naina and Vikram Sangeet',
        event_type: 'Sangeet',
        event_date: '2026-01-17',
        status: 'active',
        access_code: 'MP-3QB8VN',
        qr_token: 'sangeettoken1234567890abcdef1234',
        watermark_enabled: false,
        download_enabled: false,
        reaction_enabled: false,
        face_scan_enabled: false,
        instagram_gate_enabled: true,
        payment_status: 'partial',
        payment_updated_at: null,
        payment_updated_by: null,
        permissions_updated_at: null,
        permissions_updated_by: null,
        drive_folder_id: null,
        drive_folder_url: null,
        drive_folder_name: null,
        drive_synced_at: null,
        created_at: '2025-09-03T10:00:00Z',
      },
    ],
    event_folders: [],
    media: [],
    reactions: [],
    face_embeddings: [],
    face_index_state: [],
    blogs: [
      {
        id: 'blog-1',
        title: 'Behind the Markipie Lens',
        slug: 'behind-the-markipie-lens',
        excerpt: 'A short note on how the studio approaches a wedding morning.',
        content:
          'Every wedding morning starts quietly.\n\nThe team arrives before the hustle, cameras packed, timeline in hand.\n\nThis journal collects those small behind-the-scenes moments.',
        cover_image: null,
        category: 'Journal',
        published: true,
        published_at: '2025-10-01T09:00:00Z',
        created_at: '2025-09-20T09:00:00Z',
      },
      {
        id: 'blog-2',
        title: 'Studio Notes: Monsoon Shoots',
        slug: 'studio-notes-monsoon-shoots',
        excerpt: 'Draft notes on rain covers and light.',
        content: 'Draft body.',
        cover_image: null,
        category: 'Journal',
        published: false,
        published_at: null,
        created_at: '2025-10-10T09:00:00Z',
      },
    ],
    // Mirrors src/data/services.js so the DB-driven services page shows the
    // full production catalogue. Two rows are left inactive to exercise the
    // active filter end to end.
    services: [
      { id: 'service-1', slug: 'wedding-photography', title: 'Wedding Photography', description: 'Complete wedding-day coverage from the morning rituals to the last dance, documented candid-first with a quiet editorial eye.', image: '/assets/placeholders/portrait-blush.jpg', active: true, sort_order: 1 },
      { id: 'service-2', slug: 'wedding-cinematography', title: 'Wedding Cinematography', description: 'Cinematic wedding films: highlight reels, full-length edits and teaser cuts, colour graded in house.', image: '/assets/placeholders/landscape-sky.jpg', active: true, sort_order: 2 },
      { id: 'service-3', slug: 'candid-photography', title: 'Candid Photography', description: 'Unposed, unobtrusive coverage of real moments as they happen, led by our dedicated candid team.', image: null, active: true, sort_order: 3 },
      { id: 'service-4', slug: 'engagement-photography', title: 'Engagement Photography', description: 'A relaxed session for the couple before the wedding week begins.', image: null, active: true, sort_order: 4 },
      { id: 'service-5', slug: 'haldi', title: 'Haldi Coverage', description: 'The golden hour of every wedding week, covered with bright, joyful frames.', image: null, active: true, sort_order: 5 },
      { id: 'service-6', slug: 'mehendi', title: 'Mehendi Coverage', description: 'Detail-rich coverage of mehendi artistry, family and celebration.', image: null, active: true, sort_order: 6 },
      { id: 'service-7', slug: 'reception', title: 'Reception Coverage', description: 'Evening-formal photography and film for the reception night.', image: null, active: true, sort_order: 7 },
      { id: 'service-8', slug: 'pre-wedding', title: 'Pre-Wedding Shoots', description: 'Story-led couple shoots at locations of your choosing.', image: null, active: true, sort_order: 8 },
      { id: 'service-9', slug: 'drone-coverage', title: 'Drone Coverage', description: 'Aerial cinematography for venues and outdoor celebrations, included where venue rules permit.', image: null, active: true, sort_order: 9 },
      { id: 'service-10', slug: 'album-design', title: 'Album Design', description: 'Hand-designed wedding albums, laid out spread by spread and printed in house.', image: null, active: true, sort_order: 10 },
      { id: 'service-11', slug: 'colour-lab-printing', title: 'Colour Lab & Printing', description: 'In-house colour lab with 12 printing machines for calibrated prints and albums.', image: null, active: true, sort_order: 11 },
      { id: 'service-12', slug: 'event-photography', title: 'Event Photography', description: 'Coverage for birthdays, corporate events and family occasions.', image: null, active: true, sort_order: 12 },
      { id: 'service-13', slug: 'video-editing', title: 'Video Editing', description: 'Professional editing for footage shot by you or another team.', image: null, active: false, sort_order: 13 },
      { id: 'service-14', slug: 'graphic-design', title: 'Graphic Design', description: 'Invitations, save-the-dates and brand collateral designed by the studio.', image: null, active: false, sort_order: 14 },
      { id: 'service-15', slug: 'social-media-management', title: 'Social Media Management', description: 'End-to-end management of the studio-grade social presence for brands.', image: null, active: true, sort_order: 15 },
    ],
    marketing_services: [
      { id: 'marketing-1', title: 'Social Media Management', starting_price: 15000, currency: 'INR', period: 'month', inclusions: 'Video Shoot, Video Editing, Social Media Management', active: true, sort_order: 1 },
      { id: 'marketing-2', title: 'Video Editing', starting_price: 1500, currency: 'INR', period: 'project', inclusions: null, active: true, sort_order: 2 },
      { id: 'marketing-3', title: 'Graphic Design', starting_price: 700, currency: 'INR', period: 'project', inclusions: null, active: true, sort_order: 3 },
    ],
  }
  drive = { connected: false, email: null }
  // OAuth states for the drive connect flow, mirroring the production
  // drive_oauth_states table: hash → { returnTo, expiresAt, usedAt }.
  driveStates = new Map()
  jobs = new Map()
}

// ---------------------------------------------------------------- helpers
function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  res.end(payload)
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, accept, x-client-info, x-supabase-api-version, range, profile, if-match, accept-profile, content-profile',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Disposition, Accept-Ranges',
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (part) => {
      raw += part
    })
    req.on('end', () => {
      if (!raw) {
        resolve(null)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(null)
      }
    })
  })
}

function isAdminRequest(req) {
  const header = req.headers.authorization ?? ''
  return header === `Bearer ${ACCESS_TOKEN}`
}

function eventByCode(code) {
  const value = String(code ?? '').trim()
  if (!value) {
    return null
  }
  return db.events.find((event) => event.access_code === value || event.qr_token === value) ?? null
}

function publicEvent(event) {
  return {
    id: event.id,
    name: event.name,
    event_type: event.event_type,
    event_date: event.event_date,
    client_name: event.client_name,
    watermark_enabled: event.watermark_enabled,
    download_enabled: event.download_enabled,
    reaction_enabled: event.reaction_enabled,
    face_scan_enabled: event.face_scan_enabled,
    instagram_gate_enabled: event.instagram_gate_enabled !== false,
  }
}

function foldersOf(eventId) {
  return db.event_folders.filter((folder) => folder.event_id === eventId)
}

function availableMediaCount(eventId, folderId, fileType) {
  return db.media.filter(
    (item) =>
      item.event_id === eventId &&
      item.folder_id === folderId &&
      item.status === 'available' &&
      (!fileType || item.file_type === fileType)
  ).length
}

// Descendant folder ids of a folder (one level in this data model, but walk
// anyway so arbitrary structures stay supported).
function descendantIds(folderId) {
  const out = []
  const walk = (id) => {
    for (const child of db.event_folders) {
      if (child.parent_id === id) {
        out.push(child.id)
        walk(child.id)
      }
    }
  }
  walk(folderId)
  return out
}

function folderCounts(eventId, folderId) {
  const ids = [folderId, ...descendantIds(folderId)]
  let photos = 0
  let videos = 0
  for (const id of ids) {
    photos += availableMediaCount(eventId, id, 'image')
    videos += availableMediaCount(eventId, id, 'video')
  }
  return { photos, videos }
}

/** Latest reaction for a media item across all visitor sessions. */
function latestReaction(mediaId) {
  const rows = db.reactions
    .filter((row) => row.media_id === mediaId)
    .sort((a, b) => (a.updated_at ?? a.created_at ?? '').localeCompare(b.updated_at ?? b.created_at ?? ''))
  return rows.length ? rows[rows.length - 1].reaction : null
}

function reactionFor(mediaId, sessionId) {
  if (!sessionId) {
    return null
  }
  const row = db.reactions.find((r) => r.media_id === mediaId && r.session_id === sessionId)
  return row ? row.reaction : null
}

// ------------------------------------------------------------------ faces
const FACE_A_POSITIONS = new Set([3, 17, 29, 41, 55, 68, 73, 89, 101, 118, 132, 149])
const FACE_B_POSITIONS = new Set([7, 23, 37, 60, 79, 95, 110, 140])

function euclidean(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

function parseEmbedding(value) {
  if (Array.isArray(value)) {
    return value.map(Number)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/^\[/, '').replace(/\]$/, '')
    const parts = trimmed.split(',').map((part) => Number(part.trim()))
    if (parts.length === 128 && parts.every((n) => Number.isFinite(n))) {
      return parts
    }
  }
  return null
}

// ----------------------------------------------------------- PNG factory
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ -1) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const PALETTES = [
  { base: [241, 247, 251], bands: [[220, 236, 245], [192, 220, 235]], accent: [156, 196, 218] },
  { base: [242, 247, 243], bands: [[226, 239, 229], [200, 224, 206]], accent: [165, 203, 176] },
  { base: [250, 244, 245], bands: [[245, 230, 233], [235, 213, 218]], accent: [214, 178, 186] },
  { base: [244, 244, 241], bands: [[232, 233, 227], [213, 215, 207]], accent: [168, 176, 182] },
]

function lcg(seedText) {
  let s = 0
  for (const ch of String(seedText)) {
    s = (s * 31 + ch.charCodeAt(0)) >>> 0
  }
  s = (s || 12345) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function createArtwork(width, height, seedText) {
  const rand = lcg(seedText)
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)]
  const buf = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      const t = (x / width + y / height) / 2
      const band = palette.bands[t > 0.55 ? 1 : 0]
      buf[i] = Math.round(palette.base[0] * 0.55 + band[0] * 0.45)
      buf[i + 1] = Math.round(palette.base[1] * 0.55 + band[1] * 0.45)
      buf[i + 2] = Math.round(palette.base[2] * 0.55 + band[2] * 0.45)
    }
  }
  // Soft horizontal bands
  const bandCount = 2 + Math.floor(rand() * 2)
  for (let b = 0; b < bandCount; b += 1) {
    const by = Math.floor(rand() * height * 0.8)
    const bh = Math.floor(height * (0.06 + rand() * 0.1))
    const color = palette.bands[b % palette.bands.length]
    for (let y = by; y < Math.min(by + bh, height); y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 3
        buf[i] = Math.round(buf[i] * 0.6 + color[0] * 0.4)
        buf[i + 1] = Math.round(buf[i + 1] * 0.6 + color[1] * 0.4)
        buf[i + 2] = Math.round(buf[i + 2] * 0.6 + color[2] * 0.4)
      }
    }
  }
  // A soft circle accent
  const cx = width * (0.2 + rand() * 0.6)
  const cy = height * (0.2 + rand() * 0.6)
  const r = Math.min(width, height) * (0.08 + rand() * 0.08)
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(height, cy + r); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(width, cx + r); x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) {
        const i = (y * width + x) * 3
        buf[i] = Math.round(buf[i] * 0.5 + palette.accent[0] * 0.5)
        buf[i + 1] = Math.round(buf[i + 1] * 0.5 + palette.accent[1] * 0.5)
        buf[i + 2] = Math.round(buf[i + 2] * 0.5 + palette.accent[2] * 0.5)
      }
    }
  }
  return buf
}

const facePatchCache = new Map()
function facePatch(kind) {
  if (!facePatchCache.has(kind)) {
    const file = path.join(ASSETS, `face${kind}.rgb`)
    facePatchCache.set(kind, fs.existsSync(file) ? fs.readFileSync(file) : null)
  }
  return facePatchCache.get(kind)
}

function pastePatch(target, targetWidth, targetHeight, patch, patchSize, left, top, drawSize) {
  const step = patchSize / drawSize
  const maxX = Math.min(drawSize, targetWidth - left)
  const maxY = Math.min(drawSize, targetHeight - top)
  for (let y = 0; y < maxY; y += 1) {
    const sy = Math.min(patchSize - 1, Math.floor(y * step))
    for (let x = 0; x < maxX; x += 1) {
      const sx = Math.min(patchSize - 1, Math.floor(x * step))
      const src = (sy * patchSize + sx) * 3
      const dst = ((top + y) * targetWidth + (left + x)) * 3
      target[dst] = patch[src]
      target[dst + 1] = patch[src + 1]
      target[dst + 2] = patch[src + 2]
    }
  }
}

const pngCache = new Map()
/**
 * Deterministic photo bytes for a media item. The abstract artwork is
 * seeded by the external file id; when the item carries a face tag the
 * matching face patch is composited in at a deterministic position.
 */
function photoBytes(media, width, height) {
  const face = media.__face ?? null
  const key = `${width}x${height}:${media.external_file_id}:${face ?? '-'}`
  if (pngCache.has(key)) {
    return pngCache.get(key)
  }
  const buf = createArtwork(width, height, media.external_file_id)
  if (face) {
    const patch = facePatch(face)
    if (patch && patch.length === 320 * 320 * 3) {
      const pos = media.__position ?? 1
      const left = Math.round((width - 320) * 0.15 + (pos % 3) * (width * 0.12))
      const top = Math.round((height - 320) * 0.2 + (pos % 2) * (height * 0.12))
      if (width >= 320) {
        pastePatch(buf, width, height, patch, 320, Math.min(left, width - 320), Math.min(top, height - 320), 320)
      } else {
        // Thumbnail: paste a scaled-down copy
        const scaled = Math.round(320 * (width / 800))
        pastePatch(
          buf,
          width,
          height,
          patch,
          320,
          Math.round((width - scaled) * 0.4),
          Math.round((height - scaled * 0.75) * 0.5),
          scaled
        )
      }
    }
  }
  const png = encodePng(width, height, buf)
  pngCache.set(key, png)
  return png
}

// ------------------------------------------------------------------ drive
function driveTreeFor(folderId) {
  const isBirthday = String(folderId).toLowerCase().includes('birth')
  if (isBirthday) {
    return {
      id: folderId,
      name: 'Arjun & Meera Birthday',
      children: [
        { id: `${folderId}-birthday`, name: 'Birthday', directImages: 12, directVideos: 1, children: [] },
        { id: `${folderId}-babyshower`, name: 'Baby Shower', directImages: 0, directVideos: 0, children: [
          { id: `${folderId}-babyshower-photos`, name: 'Photos', directImages: 9, directVideos: 0, children: [] },
        ] },
        { id: `${folderId}-cocktail`, name: 'Cocktail', directImages: 0, directVideos: 0, children: [
          { id: `${folderId}-cocktail-media`, name: 'Media', directImages: 8, directVideos: 1, children: [] },
        ] },
      ],
    }
  }
  return {
    id: folderId,
    name: 'Rahul & Priya Wedding',
    children: [
      { id: `${folderId}-engagement`, name: 'Engagement', directImages: 0, directVideos: 0, children: [
        { id: `${folderId}-engagement-photos`, name: 'Photos', directImages: 27, directVideos: 0, children: [] },
        { id: `${folderId}-engagement-videos`, name: 'Videos', directImages: 0, directVideos: 2, children: [] },
      ] },
      { id: `${folderId}-haldi`, name: 'Haldi', directImages: 0, directVideos: 0, children: [
        { id: `${folderId}-haldi-photos`, name: 'Photos', directImages: 28, directVideos: 0, children: [] },
        { id: `${folderId}-haldi-videos`, name: 'Videos', directImages: 0, directVideos: 1, children: [] },
      ] },
      { id: `${folderId}-mehendi`, name: 'Mehendi', directImages: 30, directVideos: 2, children: [] },
      { id: `${folderId}-wedding`, name: 'Wedding', directImages: 0, directVideos: 0, children: [
        { id: `${folderId}-wedding-photos`, name: 'Photos', directImages: 45, directVideos: 0, children: [] },
        { id: `${folderId}-wedding-videos`, name: 'Videos', directImages: 0, directVideos: 3, children: [] },
      ] },
      { id: `${folderId}-reception`, name: 'Reception', directImages: 0, directVideos: 0, children: [
        { id: `${folderId}-reception-photos`, name: 'Photos', directImages: 26, directVideos: 0, children: [] },
        { id: `${folderId}-reception-videos`, name: 'Videos', directImages: 0, directVideos: 1, children: [] },
      ] },
    ],
  }
}

function treeTotals(node) {
  let photos = node.directImages
  let videos = node.directVideos
  let folders = 0
  for (const child of node.children) {
    const childTotals = treeTotals(child)
    photos += childTotals.photos
    videos += childTotals.videos
    folders += 1 + childTotals.folders
  }
  return { photos, videos, folders }
}

function parseFolderInput(input) {
  const value = String(input ?? '').trim()
  if (!value) {
    throw new Error('Paste a Google Drive folder link first.')
  }
  const byUrl = value.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/)
  if (byUrl) {
    return byUrl[1]
  }
  if (/^[A-Za-z0-9_-]{12,}$/.test(value)) {
    return value
  }
  throw new Error('That does not look like a Google Drive folder link.')
}

function importFolder(eventId, urlOrId) {
  const event = db.events.find((row) => row.id === eventId)
  if (!event) {
    throw new Error('That event no longer exists.')
  }
  const folderId = parseFolderInput(urlOrId)
  const tree = driveTreeFor(folderId)

  // Fresh import of a different folder replaces the old structure.
  if (event.drive_folder_id && event.drive_folder_id !== folderId) {
    db.event_folders = db.event_folders.filter((folder) => folder.event_id !== eventId)
    db.media = db.media.filter((item) => item.event_id !== eventId)
    db.reactions = db.reactions.filter((row) => row.event_id !== eventId)
    db.face_embeddings = db.face_embeddings.filter((row) => row.event_id !== eventId)
    db.face_index_state = db.face_index_state.filter((row) => row.event_id !== eventId)
  }

  const counters = {
    sortOrder: 0,
    imagePosition: 0,
    faceOf(position) {
      if (FACE_A_POSITIONS.has(position)) {
        return 'A'
      }
      if (FACE_B_POSITIONS.has(position)) {
        return 'B'
      }
      return null
    },
  }

  const knownFolderKeys = new Set(foldersOf(eventId).map((folder) => `${folder.parent_id ?? '-'}::${folder.external_folder_id}`))
  const knownFileIds = new Set(db.media.filter((item) => item.event_id === eventId).map((item) => item.external_file_id))

  let insertedFolders = 0
  let insertedMedia = 0
  let duplicates = 0

  const walk = (node, parentId) => {
    let folderRow = foldersOf(eventId).find(
      (folder) => folder.parent_id === parentId && folder.external_folder_id === node.id
    )
    if (!folderRow) {
      folderRow = {
        id: crypto.randomUUID(),
        event_id: eventId,
        parent_id: parentId,
        name: node.name,
        folder_type: parentId ? 'subfolder' : 'section',
        external_folder_id: node.id,
        sort_order: (counters.sortOrder += 1),
        status: 'available',
        created_at: new Date().toISOString(),
      }
      db.event_folders.push(folderRow)
      insertedFolders += 1
    }
    for (let i = 1; i <= node.directImages; i += 1) {
      const externalId = `${node.id}-img${i}`
      if (knownFileIds.has(externalId)) {
        duplicates += 1
        continue
      }
      const actualPosition = (counters.imagePosition += 1)
      db.media.push({
        id: crypto.randomUUID(),
        event_id: eventId,
        folder_id: folderRow.id,
        file_name: `${node.name} photo ${i}.jpg`,
        file_type: 'image',
        mime_type: 'image/jpeg',
        file_size: 240000 + actualPosition * 13,
        external_file_id: externalId,
        external_url: null,
        thumbnail_url: null,
        sort_order: i,
        status: 'available',
        album_selected: false,
        album_selected_at: null,
        album_selected_by: null,
        created_at: new Date().toISOString(),
        __face: counters.faceOf(actualPosition),
        __position: actualPosition,
      })
      insertedMedia += 1
    }
    for (let i = 1; i <= node.directVideos; i += 1) {
      const externalId = `${node.id}-vid${i}`
      if (knownFileIds.has(externalId)) {
        duplicates += 1
        continue
      }
      db.media.push({
        id: crypto.randomUUID(),
        event_id: eventId,
        folder_id: folderRow.id,
        file_name: `${node.name} film ${i}.webm`,
        file_type: 'video',
        mime_type: 'video/webm',
        file_size: 2100629,
        external_file_id: externalId,
        external_url: null,
        thumbnail_url: null,
        sort_order: 100 + i,
        status: 'available',
        album_selected: false,
        album_selected_at: null,
        album_selected_by: null,
        created_at: new Date().toISOString(),
        __face: null,
        __position: 0,
      })
      insertedMedia += 1
    }
    for (const child of node.children) {
      walk(child, folderRow.id)
    }
  }
  void knownFolderKeys
  for (const child of tree.children) {
    walk(child, null)
  }

  event.drive_folder_id = folderId
  event.drive_folder_url = `https://drive.google.com/drive/folders/${folderId}`
  event.drive_folder_name = tree.name
  event.drive_synced_at = new Date().toISOString()

  const totals = treeTotals(tree)
  const available = (type) =>
    db.media.filter((item) => item.event_id === eventId && item.file_type === type && item.status === 'available').length
  return {
    folders: foldersOf(eventId).length,
    photos: available('image'),
    videos: available('video'),
    insertedFolders,
    insertedMedia,
    duplicates,
    treeFolders: totals.folders,
  }
}

function runImportJob(job) {
  const steps = [
    ['connecting', 200],
    ['reading-folder', 250],
    ['reading-subfolders', 250],
    ['finding-photos', 250],
    ['finding-videos', 250],
    ['importing-metadata', 300],
  ]
  let delay = 0
  for (const [phase, wait] of steps) {
    delay += wait
    setTimeout(() => {
      job.phase = phase
    }, delay)
  }
  setTimeout(() => {
    try {
      const result = importFolder(job.eventId, job.urlOrId)
      job.phase = 'complete'
      job.done = true
      job.result = {
        folders: result.folders,
        photos: result.photos,
        videos: result.videos,
        insertedFolders: result.insertedFolders,
        insertedMedia: result.insertedMedia,
        duplicates: result.duplicates,
      }
    } catch (error) {
      job.phase = 'complete'
      job.done = true
      job.error = error.message
    }
  }, delay + 150)
}

function runSyncJob(job) {
  const steps = [
    ['connecting', 200],
    ['reading-folder', 250],
    ['reading-subfolders', 250],
    ['finding-photos', 250],
    ['finding-videos', 250],
    ['importing-metadata', 300],
  ]
  let delay = 0
  for (const [phase, wait] of steps) {
    delay += wait
    setTimeout(() => {
      job.phase = phase
    }, delay)
  }
  setTimeout(() => {
    try {
      const event = db.events.find((row) => row.id === job.eventId)
      if (!event?.drive_folder_id) {
        throw new Error('Import a Drive folder before syncing.')
      }
      // Sync semantics: one Haldi photo disappears from Drive, two new
      // Engagement photos arrive (the first carries face A so the e2e can
      // prove incremental face indexing after a sync). Nothing is deleted
      // from the database.
      const sectionOf = (name) =>
        db.event_folders.find((f) => f.event_id === job.eventId && f.name === name && !f.parent_id)
      const mediaFolderOf = (section) => {
        if (!section) {
          return null
        }
        const child = db.event_folders.find(
          (f) => f.event_id === job.eventId && f.parent_id === section.id && f.name === 'Photos'
        )
        return child ?? section
      }
      const haldiPhotos = mediaFolderOf(sectionOf('Haldi'))
      if (haldiPhotos) {
        const victim = db.media.find(
          (m) => m.folder_id === haldiPhotos.id && m.file_type === 'image' && m.status === 'available'
        )
        if (victim) {
          victim.status = 'unavailable'
        }
      }
      const engagement = mediaFolderOf(sectionOf('Engagement'))
      let added = 0
      let nextPosition = 0
      if (engagement) {
        for (const item of db.media.filter((m) => m.event_id === job.eventId)) {
          if (item.__position > nextPosition) {
            nextPosition = item.__position
          }
        }
        for (let i = 1; i <= 2; i += 1) {
          const externalId = `${engagement.external_folder_id}-sync${i}`
          if (db.media.some((m) => m.event_id === job.eventId && m.external_file_id === externalId)) {
            continue
          }
          const position = nextPosition + i
          db.media.push({
            id: crypto.randomUUID(),
            event_id: job.eventId,
            folder_id: engagement.id,
            file_name: `Engagement Photos new photo ${i}.jpg`,
            file_type: 'image',
            mime_type: 'image/jpeg',
            file_size: 210000,
            external_file_id: externalId,
            external_url: null,
            thumbnail_url: null,
            sort_order: 900 + i,
            status: 'available',
            album_selected: false,
            album_selected_at: null,
            album_selected_by: null,
            created_at: new Date().toISOString(),
            __face: i === 1 ? 'A' : null,
            __position: position,
          })
          added += 1
        }
      }
      const unavailable = db.media.filter((m) => m.event_id === job.eventId && m.status === 'unavailable').length
      event.drive_synced_at = new Date().toISOString()
      job.phase = 'complete'
      job.done = true
      job.result = {
        folders: foldersOf(job.eventId).length,
        photos: db.media.filter((m) => m.event_id === job.eventId && m.file_type === 'image' && m.status === 'available').length,
        videos: db.media.filter((m) => m.event_id === job.eventId && m.file_type === 'video' && m.status === 'available').length,
        added,
        updated: 0,
        unavailable,
      }
    } catch (error) {
      job.phase = 'complete'
      job.done = true
      job.error = error.message
    }
  }, delay + 150)
}

// ---------------------------------------------------------- media stream
let videoBytesCache = null
function videoFile() {
  if (!videoBytesCache) {
    const webm = path.join(ASSETS, 'sample.webm')
    const mp4 = path.join(ASSETS, 'sample.mp4')
    videoBytesCache = fs.existsSync(webm)
      ? { bytes: fs.readFileSync(webm), mime: 'video/webm' }
      : { bytes: fs.readFileSync(mp4), mime: 'video/mp4' }
  }
  return videoBytesCache
}

function serveMedia(req, res, mediaId, searchParams) {
  const code = searchParams.get('t') ?? ''
  const variant = searchParams.get('v') === 'thumb' ? 'thumb' : 'full'
  const download = searchParams.get('download') === '1'
  const event = eventByCode(code)
  if (!event) {
    json(res, 401, { message: 'This gallery link is no longer valid.' }, corsHeaders())
    return
  }
  if (download && event.download_enabled === false) {
    // Same server-side gate as the edge function: the URL is refused even
    // when called directly, not just hidden in the UI.
    json(res, 403, { message: 'Downloads are turned off for this event.' }, corsHeaders())
    return
  }
  const media = db.media.find((item) => item.id === mediaId)
  if (!media || media.event_id !== event.id || media.status !== 'available') {
    json(res, 404, { message: 'This media is not available.' }, corsHeaders())
    return
  }

  if (media.file_type === 'video') {
    const { bytes, mime } = videoFile()
    const headers = {
      ...corsHeaders(),
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    }
    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${(media.file_name ?? 'markipie-video').replace(/"/g, '')}"`
    }
    const range = req.headers.range
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      const start = match && match[1] ? Number(match[1]) : 0
      const end = match && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1
      if (start >= bytes.length || start > end) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${bytes.length}` })
        res.end()
        return
      }
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
        'Content-Length': end - start + 1,
      })
      res.end(bytes.subarray(start, end + 1))
      return
    }
    res.writeHead(200, { ...headers, 'Content-Length': bytes.length })
    res.end(bytes)
    return
  }

  const png = variant === 'thumb' ? photoBytes(media, 320, 240) : photoBytes(media, 800, 600)
  const headers = {
    ...corsHeaders(),
    'Content-Type': 'image/png',
    'Content-Length': png.length,
    'Cache-Control': 'private, max-age=3600',
  }
  if (download) {
    headers['Content-Disposition'] = `attachment; filename="${(media.file_name ?? 'markipie-photo').replace(/"/g, '')}"`
  }
  res.writeHead(200, headers)
  res.end(png)
}

// ------------------------------------------------------------------- RPC
function handleRpc(req, res, name, body) {
  const admin = isAdminRequest(req)

  if (name === 'lookup_event_by_code') {
    const event = eventByCode(body?.p_code)
    if (!event || event.status !== 'active') {
      json(res, 200, [], corsHeaders())
      return
    }
    json(res, 200, [publicEvent(event)], corsHeaders())
    return
  }

  if (name === 'get_event_folders') {
    const event = eventByCode(body?.p_code)
    if (!event || event.status !== 'active') {
      json(res, 200, [], corsHeaders())
      return
    }
    const rows = foldersOf(event.id)
      .filter((folder) => !folder.parent_id && folder.status === 'available')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((folder) => {
        const counts = folderCounts(event.id, folder.id)
        return {
          id: folder.id,
          name: folder.name,
          folder_type: folder.folder_type,
          sort_order: folder.sort_order,
          photos: counts.photos,
          videos: counts.videos,
        }
      })
    json(res, 200, rows, corsHeaders())
    return
  }

  if (name === 'get_event_subfolders') {
    const event = eventByCode(body?.p_code)
    if (!event || event.status !== 'active') {
      json(res, 200, [], corsHeaders())
      return
    }
    const rows = foldersOf(event.id)
      .filter((folder) => folder.parent_id === body?.p_folder_id && folder.status === 'available')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((folder) => {
        const counts = folderCounts(event.id, folder.id)
        return {
          id: folder.id,
          name: folder.name,
          folder_type: folder.folder_type,
          sort_order: folder.sort_order,
          photos: counts.photos,
          videos: counts.videos,
        }
      })
    json(res, 200, rows, corsHeaders())
    return
  }

  if (name === 'get_event_media') {
    const event = eventByCode(body?.p_code)
    if (!event || event.status !== 'active') {
      json(res, 200, [], corsHeaders())
      return
    }
    const folderId = body?.p_folder_id
    const limit = Math.max(1, Math.min(Number(body?.p_limit ?? 24) || 24, 100))
    const offset = Math.max(0, Number(body?.p_offset ?? 0) || 0)
    const sessionId = body?.p_session_id ?? null
    const rows = db.media
      .filter((item) => item.event_id === event.id && item.folder_id === folderId && item.status === 'available')
      .sort((a, b) => (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at))
    const total = rows.length
    const page = rows.slice(offset, offset + limit).map((item) => ({
      id: item.id,
      file_name: item.file_name,
      file_type: item.file_type,
      sort_order: item.sort_order,
      my_reaction: reactionFor(item.id, sessionId),
      total,
    }))
    json(res, 200, page, corsHeaders())
    return
  }

  if (name === 'set_reaction') {
    const event = eventByCode(body?.p_code)
    if (!event || event.status !== 'active') {
      json(res, 400, { message: 'Invalid or expired access code.' }, corsHeaders())
      return
    }
    if (!body?.p_session_id) {
      json(res, 400, { message: 'invalid session' }, corsHeaders())
      return
    }
    const reaction = body?.p_reaction
    if (reaction !== null && reaction !== 'like' && reaction !== 'dislike') {
      json(res, 400, { message: 'invalid reaction' }, corsHeaders())
      return
    }
    const media = db.media.find((item) => item.id === body?.p_media_id && item.event_id === event.id)
    if (!media) {
      json(res, 404, { message: 'Media not found.' }, corsHeaders())
      return
    }
    const now = new Date().toISOString()
    const existing = db.reactions.find(
      (row) => row.media_id === media.id && row.session_id === body.p_session_id
    )
    if (reaction) {
      if (existing) {
        existing.reaction = reaction
        existing.updated_at = now
      } else {
        db.reactions.push({
          id: crypto.randomUUID(),
          media_id: media.id,
          event_id: event.id,
          session_id: body.p_session_id,
          reaction,
          created_at: now,
          updated_at: now,
        })
      }
      json(res, 200, `"${reaction}"`, corsHeaders())
      return
    }
    db.reactions = db.reactions.filter(
      (row) => !(row.media_id === media.id && row.session_id === body.p_session_id)
    )
    json(res, 200, '"none"', corsHeaders())
    return
  }

  // ---- Phase 7: face search ----
  if (name === 'search_event_faces') {
    const event = eventByCode(body?.p_code)
    if (!event || event.status !== 'active') {
      json(res, 400, { message: 'Invalid or expired access code.' }, corsHeaders())
      return
    }
    if (!event.face_scan_enabled) {
      json(res, 400, { message: 'Face scan is not enabled for this event.' }, corsHeaders())
      return
    }
    const embedding = parseEmbedding(body?.p_embedding)
    if (!embedding) {
      json(res, 400, { message: 'A face scan is required before searching.' }, corsHeaders())
      return
    }
    let threshold = Number(body?.p_threshold)
    if (!Number.isFinite(threshold) || threshold < 0.2 || threshold > 0.9) {
      threshold = 0.5
    }
    const sessionId = body?.p_session_id ?? null
    const best = new Map()
    for (const row of db.face_embeddings) {
      if (row.event_id !== event.id) {
        continue
      }
      const distance = euclidean(row.embedding, embedding)
      if (distance >= threshold) {
        continue
      }
      const current = best.get(row.media_id)
      if (!current || distance < current) {
        best.set(row.media_id, distance)
      }
    }
    const rows = [...best.entries()]
      .map(([mediaId, distance]) => {
        const media = db.media.find(
          (item) => item.id === mediaId && item.event_id === event.id && item.status === 'available'
        )
        if (!media) {
          return null
        }
        return {
          id: media.id,
          file_name: media.file_name,
          file_type: media.file_type,
          my_reaction: reactionFor(media.id, sessionId),
          distance: Math.round(distance * 10000) / 10000,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 240)
    json(res, 200, rows, corsHeaders())
    return
  }

  // ---- Phase 10: admin authorization ----
  if (name === 'admin_check') {
    json(res, 200, admin === true, corsHeaders())
    return
  }

  // ---- Phase 7: admin face index ----
  if (name === 'admin_event_media_list') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const rows = db.media
      .filter(
        (item) =>
          item.event_id === body?.p_event_id &&
          item.file_type === 'image' &&
          item.status === 'available'
      )
      .sort((a, b) => (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at))
      .map((item) => ({
        media_id: item.id,
        file_name: item.file_name,
        file_type: item.file_type,
        sort_order: item.sort_order,
        indexed: db.face_index_state.some((row) => row.media_id === item.id),
        album_selected: Boolean(item.album_selected),
        client_reaction: latestReaction(item.id),
      }))
    json(res, 200, rows, corsHeaders())
    return
  }

  if (name === 'admin_store_face_embeddings') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const eventId = body?.p_event_id
    const rows = Array.isArray(body?.p_rows) ? body.p_rows : []
    const now = new Date().toISOString()
    const mediaIds = new Set()
    const withFaces = []
    for (const row of rows) {
      const media = db.media.find(
        (item) => item.id === row?.media_id && item.event_id === eventId && item.file_type === 'image'
      )
      if (!media) {
        continue
      }
      mediaIds.add(media.id)
      const embedding = parseEmbedding(row?.embedding)
      if (embedding) {
        withFaces.push({ row, media, embedding })
      }
    }
    // Mark every valid media as processed (embedding may be null when no
    // face was found; it still counts as indexed).
    for (const mediaId of mediaIds) {
      const existing = db.face_index_state.find(
        (row) => row.event_id === eventId && row.media_id === mediaId
      )
      if (existing) {
        existing.indexed_at = now
      } else {
        db.face_index_state.push({ media_id: mediaId, event_id: eventId, indexed_at: now })
      }
    }
    // Replace semantics for media that produced faces this round.
    db.face_embeddings = db.face_embeddings.filter(
      (row) => !(row.event_id === eventId && withFaces.some((entry) => entry.media.id === row.media_id))
    )
    for (const entry of withFaces) {
      db.face_embeddings.push({
        id: crypto.randomUUID(),
        event_id: eventId,
        media_id: entry.media.id,
        face_index: Number(entry.row.face_index ?? 0) || 0,
        embedding: entry.embedding,
        created_at: now,
        updated_at: now,
      })
    }
    json(res, 200, withFaces.length, corsHeaders())
    return
  }

  if (name === 'admin_clear_face_index') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const before = db.face_embeddings.length
    db.face_embeddings = db.face_embeddings.filter((row) => row.event_id !== body?.p_event_id)
    db.face_index_state = db.face_index_state.filter((row) => row.event_id !== body?.p_event_id)
    json(res, 200, before - db.face_embeddings.length, corsHeaders())
    return
  }

  if (name === 'admin_set_payment_status') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const status = body?.p_status
    if (!['unpaid', 'partial', 'paid'].includes(status)) {
      json(res, 400, { message: 'Invalid payment status.' }, corsHeaders())
      return
    }
    const event = db.events.find((item) => item.id === body?.p_event_id)
    if (!event) {
      json(res, 404, { message: 'Event not found.' }, corsHeaders())
      return
    }
    event.payment_status = status
    event.payment_updated_at = new Date().toISOString()
    event.payment_updated_by = ADMIN_EMAIL
    json(res, 200, {
      payment_status: event.payment_status,
      payment_updated_at: event.payment_updated_at,
      payment_updated_by: event.payment_updated_by,
    }, corsHeaders())
    return
  }

  if (name === 'admin_set_album_selection') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const ids = Array.isArray(body?.p_media_ids) ? body.p_media_ids : []
    const selected = Boolean(body?.p_selected)
    let count = 0
    for (const id of ids) {
      const media = db.media.find((item) => item.id === id && item.event_id === body?.p_event_id)
      if (!media) {
        continue
      }
      media.album_selected = selected
      media.album_selected_at = new Date().toISOString()
      media.album_selected_by = ADMIN_EMAIL
      count += 1
    }
    json(res, 200, count, corsHeaders())
    return
  }

  if (name === 'admin_reaction_summary') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const eventId = body?.p_event_id
    const images = db.media.filter(
      (item) => item.event_id === eventId && item.file_type === 'image' && item.status === 'available'
    )
    let liked = 0
    let disliked = 0
    for (const image of images) {
      const reaction = latestReaction(image.id)
      if (reaction === 'like') liked += 1
      else if (reaction === 'dislike') disliked += 1
    }
    json(res, 200, {
      total_images: images.length,
      liked,
      disliked,
      unselected: images.length - liked - disliked,
      album_selected: images.filter((item) => item.album_selected).length,
    }, corsHeaders())
    return
  }

  if (name === 'admin_face_index_stats') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const eventId = body?.p_event_id
    const faceRows = db.face_embeddings.filter((row) => row.event_id === eventId)
    const stateRows = db.face_index_state.filter((row) => row.event_id === eventId)
    const availableIds = new Set(
      db.media
        .filter((item) => item.event_id === eventId && item.status === 'available')
        .map((item) => item.id)
    )
    const lastIndexed = stateRows.reduce(
      (latest, row) => (row.indexed_at > latest ? row.indexed_at : latest),
      ''
    )
    json(
      res,
      200,
      {
        images_total: db.media.filter(
          (item) => item.event_id === eventId && item.file_type === 'image' && item.status === 'available'
        ).length,
        images_indexed: stateRows.filter((row) => availableIds.has(row.media_id)).length,
        faces_detected: faceRows.length,
        last_indexed_at: lastIndexed || null,
      },
      corsHeaders()
    )
    return
  }

  // ---- Phase 6 admin overviews ----
  if (name === 'admin_media_overview') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const rows = db.events
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((event) => ({
        event_id: event.id,
        event_name: event.name,
        client_name: event.client_name,
        status: event.status,
        drive_folder_name: event.drive_folder_name,
        drive_synced_at: event.drive_synced_at,
        folders: foldersOf(event.id).length,
        photos: db.media.filter((m) => m.event_id === event.id && m.file_type === 'image' && m.status === 'available').length,
        videos: db.media.filter((m) => m.event_id === event.id && m.file_type === 'video' && m.status === 'available').length,
      }))
    json(res, 200, rows, corsHeaders())
    return
  }

  if (name === 'admin_event_media_stats') {
    if (!admin) {
      json(res, 403, { message: 'Admin access required.' }, corsHeaders())
      return
    }
    const eventId = body?.p_event_id
    const rows = foldersOf(eventId)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((folder) => {
        const counts = folderCounts(eventId, folder.id)
        return {
          id: folder.id,
          parent_id: folder.parent_id,
          name: folder.name,
          folder_type: folder.folder_type,
          sort_order: folder.sort_order,
          status: folder.status,
          photos: counts.photos,
          videos: counts.videos,
        }
      })
    json(res, 200, rows, corsHeaders())
    return
  }

  json(res, 404, { message: `function ${name} not found` }, corsHeaders())
}

// ------------------------------------------------------------- PostgREST
const PUBLIC_TABLES = {
  blogs: {
    anon: (row) => row.published === true,
    orderBy: 'created_at',
    orderDir: 'desc',
  },
  services: {
    anon: (row) => row.active === true,
    orderBy: 'sort_order',
    orderDir: 'asc',
  },
  marketing_services: {
    anon: (row) => row.active === true,
    orderBy: 'sort_order',
    orderDir: 'asc',
  },
}

function parseFilters(searchParams) {
  const filters = []
  for (const [key, value] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) {
      continue
    }
    const eq = value.match(/^eq\.(.*)$/)
    if (eq) {
      filters.push({ column: key, op: 'eq', value: eq[1] })
      continue
    }
    const inMatch = value.match(/^in\.\((.*)\)$/)
    if (inMatch) {
      filters.push({
        column: key,
        op: 'in',
        values: inMatch[1].split(',').map((v) => v.trim().replace(/^"|"$/g, '')),
      })
    }
  }
  return filters
}

function matchesFilters(row, filters) {
  return filters.every((filter) => {
    if (filter.op === 'eq') {
      return String(row[filter.column]) === filter.value
    }
    return filter.values.includes(String(row[filter.column]))
  })
}

function stripInternal(row) {
  const clone = { ...row }
  for (const key of Object.keys(clone)) {
    if (key.startsWith('__')) {
      delete clone[key]
    }
  }
  return clone
}

function handleRest(req, res, pathname, searchParams, method) {
  const table = pathname.replace(/^\/rest\/v1\//, '').split('/')[0]
  const admin = isAdminRequest(req)

  const rows = db[table]
  if (!rows) {
    json(res, 404, { message: `relation ${table} not found` }, corsHeaders())
    return
  }

  const filters = parseFilters(searchParams)
  const isObjectAccept = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const wantsCount = (req.headers.prefer ?? '').includes('count=exact')

  if (method === 'GET' || method === 'HEAD') {
    let result = rows.filter((row) => matchesFilters(row, filters))
    const publicRule = !admin && PUBLIC_TABLES[table]
    if (publicRule) {
      result = result.filter(publicRule.anon)
    } else if (!admin && !['blogs', 'services', 'marketing_services'].includes(table)) {
      // RLS: anonymous visitors cannot read private tables at all.
      result = []
    }
    const orderParam = searchParams.get('order')
    if (orderParam) {
      const [column, direction] = orderParam.split('.')
      result = result.slice().sort((a, b) => {
        const av = a[column] ?? ''
        const bv = b[column] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return direction === 'desc' ? -cmp : cmp
      })
    }
    const limitParam = Number(searchParams.get('limit'))
    const offsetParam = Number(searchParams.get('offset'))
    let total = result.length
    if (Number.isFinite(offsetParam) && offsetParam > 0) {
      result = result.slice(offsetParam)
    }
    if (Number.isFinite(limitParam) && limitParam > 0) {
      result = result.slice(0, limitParam)
    }
    const payload = result.map(stripInternal)
    const headers = corsHeaders()
    if (wantsCount) {
      headers['Content-Range'] = `0-${Math.max(payload.length - 1, 0)}/${total}`
    }
    if (isObjectAccept) {
      if (payload.length === 0) {
        json(res, 406, { message: 'JSON object requested, multiple (or no) rows returned' }, headers)
        return
      }
      json(res, 200, payload[0], headers)
      return
    }
    if (method === 'HEAD') {
      res.writeHead(200, headers)
      res.end()
      return
    }
    json(res, 200, payload, headers)
    return
  }

  if (method === 'POST') {
    if (!admin && !PUBLIC_TABLES[table]) {
      json(res, 401, { message: 'permission denied' }, corsHeaders())
      return
    }
    // Real inserts: the admin panel creates clients, events and content
    // through these. A fresh id and created_at are added when missing so
    // the e2e CRUD flows behave like production.
    return (async () => {
      const body = await readBody(req)
      if (Array.isArray(body)) {
        const created = body.map((entry, index) => {
          const row = { ...(entry ?? {}) }
          if (!row.id) {
            row.id = `${table}-${crypto.randomUUID().slice(0, 8)}-${index}`
          }
          if (row.created_at === undefined) {
            row.created_at = new Date().toISOString()
          }
          rows.push(row)
          return stripInternal(row)
        })
        json(res, 201, created, corsHeaders())
        return
      }
      const row = { ...(body ?? {}) }
      if (!row.id) {
        row.id = `${table}-${crypto.randomUUID().slice(0, 8)}`
      }
      if (row.created_at === undefined) {
        row.created_at = new Date().toISOString()
      }
      rows.push(row)
      json(res, 201, [stripInternal(row)], corsHeaders())
    })()
  }

  if (method === 'PATCH' || method === 'DELETE') {
    if (!admin) {
      json(res, 401, { message: 'permission denied' }, corsHeaders())
      return
    }
    if (method === 'PATCH') {
      // Apply the update to every row matching the filters. Only keys that
      // already exist on the row are written, so internal fields and ids
      // cannot be invented by the request.
      return (async () => {
        const body = await readBody(req)
        const targets = rows.filter((row) => matchesFilters(row, filters))
        for (const row of targets) {
          for (const [key, value] of Object.entries(body ?? {})) {
            if (key === 'id' || key.startsWith('__') || !(key in row)) {
              continue
            }
            if (row.updated_at !== undefined) {
              row.updated_at = new Date().toISOString()
            }
            row[key] = value
          }
        }
        json(res, 204, null, corsHeaders())
      })()
    }
    // DELETE removes every row matching the filters, in place.
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (matchesFilters(rows[i], filters)) {
        rows.splice(i, 1)
      }
    }
    json(res, 204, null, corsHeaders())
    return
  }

  json(res, 405, { message: 'method not allowed' }, corsHeaders())
}

// ---------------------------------------------------------------- server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = url.pathname
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  try {
    // ------------------------------------------------------------- reset
    if (pathname === '/__reset' && method === 'POST') {
      seed()
      pngCache.clear()
      json(res, 200, { ok: true }, corsHeaders())
      return
    }

    // ------------------------------------------------------------- auth
    if (pathname === '/auth/v1/token' && method === 'POST') {
      const body = await readBody(req)
      const grant = url.searchParams.get('grant_type') ?? 'password'
      if (grant === 'password') {
        const accounts = [
          { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, id: ADMIN_USER_ID, token: ACCESS_TOKEN, refresh: REFRESH_TOKEN },
          { email: NONADMIN_EMAIL, password: NONADMIN_PASSWORD, id: NONADMIN_USER_ID, token: NONADMIN_TOKEN, refresh: NONADMIN_REFRESH },
        ]
        const account = accounts.find((a) => body?.email === a.email && body?.password === a.password)
        if (account) {
          json(
            res,
            200,
            {
              access_token: account.token,
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              refresh_token: account.refresh,
              user: { id: account.id, email: account.email, aud: 'authenticated', role: 'authenticated' },
            },
            corsHeaders()
          )
          return
        }
        json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, corsHeaders())
        return
      }
      if (grant === 'refresh_token') {
        const accounts = [
          { refresh: REFRESH_TOKEN, id: ADMIN_USER_ID, email: ADMIN_EMAIL, token: ACCESS_TOKEN },
          { refresh: NONADMIN_REFRESH, id: NONADMIN_USER_ID, email: NONADMIN_EMAIL, token: NONADMIN_TOKEN },
        ]
        const account = accounts.find((a) => body?.refresh_token === a.refresh)
        if (account) {
          json(
            res,
            200,
            {
              access_token: account.token,
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              refresh_token: account.refresh,
              user: { id: account.id, email: account.email, aud: 'authenticated', role: 'authenticated' },
            },
            corsHeaders()
          )
          return
        }
      }
      json(res, 400, { error: 'invalid_grant', error_description: 'Invalid refresh token' }, corsHeaders())
      return
    }

    if (pathname === '/auth/v1/user' && method === 'GET') {
      if (isAdminRequest(req)) {
        json(res, 200, { id: ADMIN_USER_ID, email: ADMIN_EMAIL, aud: 'authenticated', role: 'authenticated' }, corsHeaders())
        return
      }
      const header = req.headers.authorization ?? ''
      if (header === `Bearer ${NONADMIN_TOKEN}`) {
        json(res, 200, { id: NONADMIN_USER_ID, email: NONADMIN_EMAIL, aud: 'authenticated', role: 'authenticated' }, corsHeaders())
        return
      }
      json(res, 401, { message: 'invalid claim: missing sub claim' }, corsHeaders())
      return
    }

    if (pathname === '/auth/v1/logout' && method === 'POST') {
      res.writeHead(204, corsHeaders())
      res.end()
      return
    }

    // ------------------------------------------------------------- RPC
    if (pathname.startsWith('/rest/v1/rpc/') && method === 'POST') {
      const name = pathname.replace(/^\/rest\/v1\/rpc\//, '')
      const body = await readBody(req)
      handleRpc(req, res, name, body)
      return
    }

    // ------------------------------------------------------------- rest
    if (pathname.startsWith('/rest/v1/') && !pathname.startsWith('/rest/v1/rpc/')) {
      handleRest(req, res, pathname, url.searchParams, method)
      return
    }

    // ------------------------------------------------------------- drive
    if (pathname.startsWith('/functions/v1/drive/')) {
      const drivePath = pathname.replace(/^\/functions\/v1\/drive\/?/, '').replace(/\/$/, '')

      if (drivePath === 'auth/begin' && method === 'POST') {
        if (!isAdminRequest(req)) {
          json(res, 401, { message: 'Sign in as an admin first.' }, corsHeaders())
          return
        }
        const body = await readBody(req)
        const returnToRaw = body?.returnTo ?? '/admin/gallery'
        const returnTo =
          typeof returnToRaw === 'string' && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//')
            ? returnToRaw
            : '/admin/gallery'
        // Same contract as the edge function: random state bound to this
        // admin, ten minute expiry, single use.
        const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        driveStates.set(state, {
          returnTo,
          expiresAt: Date.now() + 10 * 60 * 1000,
          usedAt: null,
        })
        // Expired states are pruned like the migration does.
        for (const [key, value] of driveStates) {
          if (value.expiresAt < Date.now()) {
            driveStates.delete(key)
          }
        }
        json(res, 200, {
          url: `http://localhost:${PORT}/functions/v1/drive/auth/callback?code=mock-auth-code&state=${state}`,
        }, corsHeaders())
        return
      }

      if (drivePath === 'auth/callback' && method === 'GET') {
        const state = url.searchParams.get('state') ?? ''
        const row = driveStates.get(state)
        if (!row || row.usedAt || row.expiresAt < Date.now()) {
          res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<!doctype html><html><body><h1>This Drive connection link is no longer valid</h1></body></html>')
          return
        }
        row.usedAt = Date.now()
        if (!url.searchParams.get('code')) {
          const referer = req.headers.referer ? new URL(req.headers.referer) : null
          const origin = referer ? `${referer.protocol}//${referer.host}` : `http://localhost:5175`
          res.writeHead(302, { Location: `${origin}${row.returnTo}?drive=denied` })
          res.end()
          return
        }
        drive.connected = true
        drive.email = 'studio.drive@markipie.test'
        const referer = req.headers.referer ? new URL(req.headers.referer) : null
        const origin = referer ? `${referer.protocol}//${referer.host}` : `http://localhost:5175`
        res.writeHead(302, { Location: `${origin}${row.returnTo}?drive=connected` })
        res.end()
        return
      }

      if (drivePath === 'status' && method === 'GET') {
        if (!isAdminRequest(req)) {
          json(res, 401, { message: 'not authorized' }, corsHeaders())
          return
        }
        json(res, 200, { connected: drive.connected, email: drive.connected ? drive.email : null }, corsHeaders())
        return
      }

      if (drivePath === 'disconnect' && method === 'POST') {
        if (!isAdminRequest(req)) {
          json(res, 401, { message: 'not authorized' }, corsHeaders())
          return
        }
        drive.connected = false
        drive.email = null
        json(res, 200, { connected: false }, corsHeaders())
        return
      }

      if (drivePath === 'verify-folder' && method === 'POST') {
        if (!isAdminRequest(req)) {
          json(res, 401, { message: 'not authorized' }, corsHeaders())
          return
        }
        const body = await readBody(req)
        try {
          const folderId = parseFolderInput(body?.urlOrId)
          const tree = driveTreeFor(folderId)
          json(
            res,
            200,
            {
              folderId,
              name: tree.name,
              childFolders: tree.children.length,
              mediaFiles:
                tree.children.reduce(
                  (sum, child) => sum + (child.directImages ?? 0) + (child.directVideos ?? 0),
                  0
                ) +
                (tree.directImages ?? 0) +
                (tree.directVideos ?? 0),
            },
            corsHeaders()
          )
        } catch (error) {
          json(res, 400, { message: error.message }, corsHeaders())
        }
        return
      }

      if ((drivePath === 'import' || drivePath === 'sync') && method === 'POST') {
        if (!isAdminRequest(req)) {
          json(res, 401, { message: 'not authorized' }, corsHeaders())
          return
        }
        const body = await readBody(req)
        if (drivePath === 'import' && !drive.connected) {
          json(res, 409, { message: 'Connect Google Drive first.' }, corsHeaders())
          return
        }
        if (drivePath === 'sync') {
          const event = db.events.find((row) => row.id === body?.eventId)
          if (!event?.drive_folder_id) {
            json(res, 409, { message: 'Import a Drive folder before syncing.' }, corsHeaders())
            return
          }
        }
        const job = {
          id: crypto.randomUUID(),
          kind: drivePath,
          eventId: body?.eventId,
          urlOrId: body?.urlOrId,
          phase: 'connecting',
          label: 'Connecting',
          message: null,
          done: false,
          error: null,
          result: null,
        }
        jobs.set(job.id, job)
        if (drivePath === 'import') {
          runImportJob(job)
        } else {
          runSyncJob(job)
        }
        json(res, 202, { jobId: job.id }, corsHeaders())
        return
      }

      const jobMatch = drivePath.match(/^jobs\/([A-Za-z0-9-]+)$/)
      if (jobMatch && method === 'GET') {
        if (!isAdminRequest(req)) {
          json(res, 401, { message: 'not authorized' }, corsHeaders())
          return
        }
        const job = jobs.get(jobMatch[1])
        if (!job) {
          json(res, 404, { message: 'Not found' }, corsHeaders())
          return
        }
        const labels = {
          connecting: 'Connecting',
          'reading-folder': 'Reading folder',
          'reading-subfolders': 'Reading subfolders',
          'finding-photos': 'Finding photos',
          'finding-videos': 'Finding videos',
          'importing-metadata': 'Importing metadata',
          complete: 'Complete',
        }
        json(res, 200, { ...job, label: labels[job.phase] ?? job.phase }, corsHeaders())
        return
      }

      const mediaMatch = drivePath.match(/^media\/([A-Za-z0-9-]+)$/)
      if (mediaMatch && method === 'GET') {
        serveMedia(req, res, mediaMatch[1], url.searchParams)
        return
      }

      json(res, 404, { message: 'Not found' }, corsHeaders())
      return
    }

    json(res, 404, { message: 'Not found' }, corsHeaders())
  } catch (error) {
    json(res, 500, { message: error.message }, corsHeaders())
  }
})

seed()
server.listen(PORT, () => {
  console.log(`mock-supabase + mock drive + face search listening on http://localhost:${PORT}`)
})
