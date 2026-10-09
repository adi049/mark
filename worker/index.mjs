import '@tensorflow/tfjs-node'
import * as faceapi from '@vladmandic/face-api'
import { createClient } from '@supabase/supabase-js'
import { Canvas, Image, ImageData, loadImage } from 'canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

faceapi.env.monkeyPatch({ Canvas, Image, ImageData })

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modelPath = path.join(root, 'public', 'models')
const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const eventIdFilter = process.env.EVENT_ID || ''
const threshold = Number(process.env.FACE_SCORE_THRESHOLD || '0.35')

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath)
}

async function fetchThumb(event, mediaId) {
  const url =
    `${supabaseUrl}/functions/v1/drive/media/${mediaId}?t=${encodeURIComponent(
      event.access_code,
    )}&v=thumb`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`thumbnail HTTP ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function indexMedia(event, media) {
  const bytes = await fetchThumb(event, media.id)
  const image = await loadImage(bytes)

  const results = await faceapi
    .detectAllFaces(
      image,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: threshold,
      }),
    )
    .withFaceLandmarks(true)
    .withFaceDescriptors()

  const { error: stateError } = await db
    .from('face_index_state')
    .upsert(
      {
        media_id: media.id,
        event_id: event.id,
        indexed_at: new Date().toISOString(),
      },
      { onConflict: 'media_id' },
    )

  if (stateError) {
    throw stateError
  }

  const { error: deleteError } = await db
    .from('face_embeddings')
    .delete()
    .eq('media_id', media.id)
    .eq('event_id', event.id)

  if (deleteError) {
    throw deleteError
  }

  if (results.length > 0) {
    const rows = results.map((face, index) => ({
      event_id: event.id,
      media_id: media.id,
      face_index: index,
      embedding: `[${Array.from(face.descriptor)
        .map((value) => Number(value.toFixed(6)))
        .join(',')}]`,
    }))

    const { error } = await db.from('face_embeddings').insert(rows)
    if (error) {
      throw error
    }
  }

  return results.length
}

async function processEvent(event) {
  const [{ data: media, error: mediaError }, { data: indexed, error: indexedError }] =
    await Promise.all([
      db
        .from('media')
        .select('id,event_id,file_name,file_type,status,sort_order')
        .eq('event_id', event.id)
        .eq('file_type', 'image')
        .eq('status', 'available')
        .order('sort_order'),
      db.from('face_index_state').select('media_id').eq('event_id', event.id),
    ])

  if (mediaError) throw mediaError
  if (indexedError) throw indexedError

  const done = new Set((indexed ?? []).map((row) => row.media_id))
  const queue = (media ?? []).filter((item) => !done.has(item.id))

  console.log(`[event ${event.id}] ${queue.length} photos pending`)

  let processed = 0
  let faces = 0
  let failed = 0

  for (const item of queue) {
    try {
      const found = await indexMedia(event, item)
      processed += 1
      faces += found

      if (processed % 10 === 0 || processed === queue.length) {
        console.log(
          `[event ${event.id}] ${processed}/${queue.length} processed, ${faces} faces, ${failed} failed`,
        )
      }
    } catch (error) {
      failed += 1
      console.warn(
        `[event ${event.id}] failed ${item.file_name}: ${error?.message ?? error}`,
      )
    }
  }

  return {
    processed,
    faces,
    failed,
    remaining: queue.length - processed,
  }
}

await loadModels()
console.log('Face models loaded with TensorFlow.js Node backend')

let query = db
  .from('events')
  .select('id,access_code,face_scan_enabled,status')
  .eq('status', 'active')
  .eq('face_scan_enabled', true)

if (eventIdFilter) {
  query = query.eq('id', eventIdFilter)
}

const { data: events, error } = await query
if (error) throw error

for (const event of events ?? []) {
  const result = await processEvent(event)
  console.log(`[event ${event.id}] complete`, result)
}
