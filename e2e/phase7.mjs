/**
 * Phase 7 end-to-end suite: AI live face scan + face matching.
 *
 * Real browser face recognition with @vladmandic/face-api (TensorFlow.js)
 * against the local mock. Headless Chromium gets a fake camera backed by
 * Y4M files of real public-domain faces, and the mock's Drive photos have
 * those same faces composited in, so the whole chain (camera -> detection
 * -> descriptor -> vector search -> gallery results) is exercised for
 * real. No paid APIs, no mocks of the AI itself.
 *
 * Requires: mock on :54321, dev servers :5175 (mock env) and :5173 (no
 * env), playwright in /home/user/node_modules, Y4M files in /tmp/e2e-media
 * (run prepare_assets.py).
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const APP = 'http://localhost:5175'
const PUB = 'http://localhost:5173'
const API = 'http://localhost:54321'
const MEDIA = '/tmp/e2e-media'
const SHOTS = '/home/user/markipie/docs/phase-7'
fs.mkdirSync(SHOTS, { recursive: true })

const WEDDING_TOKEN = 'weddingtoken1234567890abcdef1234'
const WEDDING_URL = 'https://drive.google.com/drive/folders/MOCKWEDDINGFOLDER1'

let passed = 0
let failed = 0
const failures = []
function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1
    console.log(`    PASS ${name}`)
  } else {
    failed += 1
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`    FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function attach(page, bucket) {
  page.on('pageerror', (e) => bucket.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') bucket.push(`console: ${m.text()}`)
  })
}

function unexpectedErrors(errors) {
  return errors.filter((e) => !/GroupMarkerNotSet|software WebGL|GPU stall/.test(e))
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function introDone(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const shell = document.querySelector('.mp-app-shell')
      return !shell || !shell.hasAttribute('inert')
    },
    null,
    { timeout }
  )
  await page.waitForTimeout(250)
}

async function loginAdmin(page) {
  await page.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', 'studio@markipie.test')
  await page.fill('input[name="password"]', 'markipie-test-admin')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
}

/** Waits until the face stats grid has real values (not the loading dots). */
async function waitStatsReady(page, timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const grid = await faceStats(page)
    if (grid['Images scanned'] && grid['Images scanned'] !== '··') {
      return grid
    }
    await page.waitForTimeout(500)
  }
  return faceStats(page)
}

/** Reads the face index stats grid into a label -> value map. */
async function faceStats(page) {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('.mp-adm-stats--face .mp-adm-stat')]
    const out = {}
    for (const cell of cells) {
      const value = cell.querySelector('.mp-adm-stat__value')?.textContent?.trim() ?? ''
      const label = cell.querySelector('.mp-adm-stat__label')?.textContent?.trim() ?? ''
      out[label] = value
    }
    return out
  })
}

async function noHScroll(page) {
  return page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1)
}

/** Waits for the Instagram gate (Phase 8) when it appears and continues. */
async function passGate(page) {
  const gateOrGallery = await Promise.race([
    page.waitForSelector('.mp-ig', { timeout: 20000 }).then(() => 'gate'),
    page.waitForSelector('.mp-cg', { timeout: 20000 }).then(() => 'gallery'),
  ])
  if (gateOrGallery === 'gate') {
    await page.waitForSelector('.mp-ig__continue', { timeout: 20000 })
    await page.click('button:has-text("Continue to gallery")')
    await page.waitForSelector('.mp-cg', { timeout: 20000 })
  }
}

async function openGallery(page, code = 'MP-4K7RQP') {
  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]', { timeout: 30000 })
  await introDone(page)
  await page.fill('input[name="event-code"]', code)
  await page.click('button[type="submit"]')
  await passGate(page)
  await page.waitForSelector('.mp-cg', { timeout: 30000 })
}

async function runScan(page, { button = 'Find my photos', timeout = 45000 } = {}) {
  await page.click(`button:has-text("${button}")`)
  await page.waitForSelector('.mp-fs')
  await page.click('button:has-text("Start Camera")')
  await page.waitForSelector('.mp-fs__video', { timeout: 20000 })
}

// ---------------------------------------------------------------- sections

const BASE_ARGS = [
  '--no-sandbox',
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-video-capture=${MEDIA}/faceA.y4m`,
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required',
]

/** Fresh browser per section: long-lived browsers degrade after heavy
 *  WebGL face work, which froze late sections in earlier runs. */
async function launchApp() {
  return chromium.launch({ args: BASE_ARGS })
}

/** Import a Drive folder into an event through the mock API directly. */
async function importEventViaApi(eventId, folderId) {
  const login = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'studio@markipie.test', password: 'markipie-test-admin' }),
  }).then((r) => r.json())
  const token = login.access_token
  const headers = { 'content-type': 'application/json', Authorization: `Bearer ${token}` }
  // Connect Drive through the real contract: begin creates a single-use
  // OAuth state for this admin, the callback URL completes the connection.
  const begin = await fetch(`${API}/functions/v1/drive/auth/begin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ returnTo: '/admin/gallery' }),
  }).then((r) => r.json())
  if (begin?.url) {
    await fetch(begin.url, { headers }).catch(() => {})
  }
  const job = await fetch(`${API}/functions/v1/drive/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventId, urlOrId: folderId }),
  }).then((r) => r.json())
  for (let i = 0; i < 60; i += 1) {
    const status = await fetch(`${API}/functions/v1/drive/jobs/${job.jobId}`, { headers }).then((r) => r.json())
    if (status.done) {
      return status.result
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('import job timed out')
}

async function sectionAdminImport() {
  const browser = await launchApp()
  console.log('\n[A] Admin: Drive import for event-1 (regression)')
  const errors = []
  const page = await browser.newPage()
  attach(page, errors)
  await loginAdmin(page)
  await page.goto(`${APP}/admin/gallery/event-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mp-adm-drive')

  await page.click('button:has-text("Connect Google Drive")')
  await page.waitForSelector('text=Connected as studio.drive@markipie.test', { timeout: 15000 })
  await page.fill('.mp-adm-drive__field input', WEDDING_URL)
  await page.click('button:has-text("Fetch folder")')
  await page.waitForSelector('.mp-adm-drive__verify')
  await page.click('button:has-text("Import Drive folder")')
  await page.waitForSelector('.mp-adm-drive__phase-result', { timeout: 30000 })
  const result = (await page.locator('.mp-adm-drive__phase-result').innerText()).trim()
  ok('import result 13/156/9', result === '13 folders · 156 photos · 9 videos', result)
  await shot(page, '01-admin-after-import')
  await page.close()
  await browser.close()
  ok('admin import no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionFaceIndex() {
  const browser = await launchApp()
  console.log('\n[B] Admin: face index runs in the browser on real photos')
  const errors = []
  const page = await browser.newPage()
  attach(page, errors)
  await loginAdmin(page)
  await page.goto(`${APP}/admin/gallery/event-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mp-adm-face')

  // Initial status
  let stats = await page.locator('.mp-adm-face').innerText()
  ok('face index shows Not started', /Not started/.test(stats), stats.replace(/\n/g, ' | '))
  ok('face index shows 0 / 156 images', /0 \/ 156/.test(stats), stats.replace(/\n/g, ' | '))
  ok('face index shows Not yet', /Not yet/.test(stats))

  // Start indexing
  await page.click('button:has-text("Start Face Index")')
  await page.waitForSelector('.mp-adm-face__progress', { timeout: 20000 })
  let lastProgress = ''
  const deadline = Date.now() + 420000
  let done = false
  while (Date.now() < deadline) {
    const status = (await page.locator('.mp-adm-face__status').innerText()).trim()
    if (status.startsWith('Complete')) {
      done = true
      break
    }
    if (status === 'Error') {
      break
    }
    const progress = await page.locator('.mp-adm-face__progress').innerText().catch(() => '')
    const match = progress.match(/(\d+) \/ (\d+) images · (\d+) face/)
    if (match) {
      lastProgress = `${match[1]}/${match[2]} faces ${match[3]}`
    }
    await page.waitForTimeout(2500)
  }
  ok('face index completes', done, `last progress: ${lastProgress}`)
  console.log(`        progress reached: ${lastProgress}`)

  const grid = await waitStatsReady(page)
  ok('156 / 156 images scanned', grid['Images scanned'] === '156 / 156', JSON.stringify(grid))
  ok('20 faces detected', grid['Faces detected'] === '20', JSON.stringify(grid))
  ok('156 images indexed', grid['Images indexed'] === '156', JSON.stringify(grid))
  ok('last indexed set', Boolean(grid['Last indexed']) && grid['Last indexed'] !== 'Not yet', JSON.stringify(grid))
  await shot(page, '02-admin-face-index-complete')

  // Reindex new media with nothing new: processes 0
  await page.click('button:has-text("Done")').catch(() => {})
  await page.click('button:has-text("Reindex New Media")')
  await page.waitForFunction(
    () => {
      const status = document.querySelector('.mp-adm-face__status')
      if (!status) return false
      const text = status.textContent.trim()
      return text.startsWith('Complete') || text === 'Error'
    },
    null,
    { timeout: 30000 }
  )
  const reindexBody = await page.locator('.mp-adm-face__progress').innerText()
  ok('reindex processes 0 new images', /0 \/ 0 images/.test(reindexBody), reindexBody.replace(/\n/g, ' '))
  await page.click('button:has-text("Done")').catch(() => {})
  await page.close()
  await browser.close()
  ok('face index no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionClientScan() {
  const browser = await launchApp()
  console.log('\n[C] Client: live camera scan finds the right photos (event-1)')
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await openGallery(page)
  await page.waitForSelector('.mp-cg-folder')

  ok('Find my photos button present', (await page.locator('button:has-text("Find my photos")').count()) === 1)
  await runScan(page)

  // Camera preview and guide render, then the capture closes the dialog
  ok('privacy notice shown', (await page.locator('.mp-fs__privacy').first().innerText()).includes('not uploaded as a gallery photo'))
  await page.waitForSelector('.mp-fm', { timeout: 60000 })
  ok('dialog closed after capture', (await page.locator('.mp-fs').count()) === 0)
  ok('video element removed (camera stopped)', (await page.locator('.mp-fs__video').count()) === 0)

  // Results
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  await page.waitForTimeout(1500)
  const title = (await page.locator('.mp-fm__title').innerText()).trim()
  ok('results title Your Moments', /Your Moments/i.test(title), title)
  const countLine = await page.locator('.mp-fm__count').innerText()
  ok('12 matching photos', countLine.includes('12 matching photos'), countLine)
  const tiles = await page.locator('.mp-cg-tile').count()
  ok('12 tiles rendered', tiles === 12, `got ${tiles}`)
  const thumbs = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.mp-cg-tile img')]
    return { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length }
  })
  ok('match thumbnails decode', thumbs.total === 12 && thumbs.loaded === 12, JSON.stringify(thumbs))
  await shot(page, '03-client-face-matches')

  // Viewer inherits watermark, download and reactions (event-1 flags on)
  await page.locator('.mp-cg-tile').first().click()
  await page.waitForSelector('.mp-viewer')
  await page.waitForTimeout(1200)
  ok('watermark in match viewer', (await page.locator('.mp-viewer .mp-wm').count()) === 1)
  ok('download in match viewer', (await page.locator('.mp-viewer__btn:has-text("Download")').count()) === 1)
  await page.click('button[aria-label="Like this photo"]')
  await page.waitForTimeout(600)
  ok('like works in match viewer', (await page.locator('button[aria-label="Like this photo"]').getAttribute('class')).includes('is-active'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('.mp-cg-tile').first().click()
  await page.waitForSelector('.mp-viewer')
  await page.waitForTimeout(600)
  ok('like persists in match viewer', (await page.locator('button[aria-label="Like this photo"]').getAttribute('class')).includes('is-active'))
  await page.keyboard.press('Escape')
  await shot(page, '04-client-match-viewer')

  // Back to gallery
  await page.click('button:has-text("Back to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  ok('back to gallery shows folders', (await page.locator('.mp-cg-folder').count()) === 5)
  await context.close()
  await browser.close()
  ok('client scan no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionScanStates() {
  console.log('\n[D] Client: scan guidance states (no match, two faces, no face)')

  // No match: a real, different face (faceC) that is not in any photo
  {
    const errors = []
    const browserC = await chromium.launch({
      args: [
        '--no-sandbox',
        '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${MEDIA}/faceC.y4m`,
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
    })
    const context = await browserC.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    attach(page, errors)
    await openGallery(page)
    await runScan(page)
    await page.waitForSelector('text=No matching photos found.', { timeout: 60000 })
    ok('no match message shown', true)
    const guidance = await page.locator('.mp-fm__guide').innerText()
    ok('no match guidance given', /lighting/i.test(guidance) && /camera/i.test(guidance), guidance)
    ok('try again button offered', (await page.locator('button:has-text("Try the scan again")').count()) === 1)
    ok('no fake results', (await page.locator('.mp-cg-tile').count()) === 0)
    await shot(page, '05-no-match')
    await context.close()
    await browserC.close()
    ok('no-match flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
  }

  // Two faces
  {
    const errors = []
    const browserB = await chromium.launch({
      args: [
        '--no-sandbox',
        '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${MEDIA}/twoFaces.y4m`,
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
    })
    const context = await browserB.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    attach(page, errors)
    await openGallery(page)
    await runScan(page)
    await page.waitForSelector('text=Please make sure only one face is visible.', { timeout: 30000 })
    ok('two-faces message shown', true)
    ok('no results from multi-face frame', (await page.locator('.mp-fm').count()) === 0)
    await page.click('button:has-text("Stop Camera")')
    await page.waitForTimeout(400)
    ok('stop camera closes dialog', (await page.locator('.mp-fs').count()) === 0)
    await shot(page, '06-two-faces')
    await context.close()
    await browserB.close()
    ok('two-faces flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
  }

  // No face
  {
    const errors = []
    const browserD = await chromium.launch({
      args: [
        '--no-sandbox',
        '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${MEDIA}/noFace.y4m`,
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
    })
    const context = await browserD.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    attach(page, errors)
    await openGallery(page)
    await runScan(page)
    await page.waitForSelector('text=Move your face into the frame.', { timeout: 30000 })
    ok('no-face message shown', true)
    await page.click('button:has-text("Stop Camera")')
    await context.close()
    await browserD.close()
    ok('no-face flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
  }
}

async function sectionCameraDenied() {
  const browser = await launchApp()
  console.log('\n[E] Client: camera permission denied shows a clean message')
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.addInitScript(() => {
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    })
    void original
  })
  await openGallery(page)
  await page.click('button:has-text("Find my photos")')
  await page.waitForSelector('.mp-fs')
  await page.click('button:has-text("Start Camera")')
  await page.waitForSelector('.mp-fs__error', { timeout: 20000 })
  const message = await page.locator('.mp-fs__error').innerText()
  ok('permission denied message', /Camera permission was denied/.test(message), message)
  ok('no camera preview on denial', (await page.locator('.mp-fs__video').count()) === 0)
  await shot(page, '07-camera-denied')
  await context.close()
  await browser.close()
  ok('camera denied no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionHomeAndEntryFlows() {
  const browser = await launchApp()
  console.log('\n[F] Home page and Client Access card: scan then event code')
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  // Home
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
  await introDone(page)
  ok('home shows Find your photos block', (await page.locator('.mp-cta__face-title').count()) === 1)
  const homeText = await page.locator('.mp-cta__face').innerText()
  ok('home copy matches requirement', /Scan your face and discover your Markipie moments/.test(homeText), homeText.replace(/\n/g, ' '))
  await shot(page, '08-home-face-block')

  await page.click('.mp-cta__face-btn')
  await page.waitForSelector('.mp-fs')
  await page.click('button:has-text("Start Camera")')
  await page.waitForSelector('text=Your Event Code', { timeout: 60000 })
  ok('code step appears after scan', true)

  // Wrong code first
  await page.fill('.mp-fs__form input', 'MP-WRONG')
  await page.click('button:has-text("Find My Photos")')
  await page.waitForSelector('text=Invalid or expired access code.', { timeout: 10000 })
  ok('invalid code rejected in scan flow', true)

  // Right code
  await page.fill('.mp-fs__form input', 'MP-4K7RQP')
  await page.click('button:has-text("Find My Photos")')
  await page.waitForSelector('.mp-fm', { timeout: 60000 })
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  const countLine = await page.locator('.mp-fm__count').innerText()
  ok('home flow reaches 12 matches', countLine.includes('12 matching photos'), countLine)
  ok('gallery opened with session', (await page.locator('.mp-cg__title').count()) === 1)
  await shot(page, '09-home-flow-result')
  await context.close()

  // Client Access entry card
  {
    const cerrors = []
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page2 = await context2.newPage()
    attach(page2, cerrors)
    await page2.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
    await page2.waitForSelector('input[name="event-code"]', { timeout: 30000 })
    await introDone(page2)
    ok('entry card offers Start Face Scan', (await page2.locator('#face-scan button:has-text("Start Face Scan")').count()) === 1)
    await page2.click('#face-scan button:has-text("Start Face Scan")')
    await page2.waitForSelector('.mp-fs')
    await page2.click('button:has-text("Start Camera")')
    await page2.waitForSelector('text=Your Event Code', { timeout: 60000 })
    await page2.fill('.mp-fs__form input', 'MP-4K7RQP')
    await page2.click('button:has-text("Find My Photos")')
    await page2.waitForSelector('.mp-fm', { timeout: 60000 })
    await page2.waitForSelector('.mp-cg-tile', { timeout: 30000 })
    const countLine2 = await page2.locator('.mp-fm__count').innerText()
    ok('entry card flow reaches 12 matches', countLine2.includes('12 matching photos'), countLine2)
    await context2.close()
    ok('entry flow no unexpected console errors', unexpectedErrors(cerrors).length === 0, unexpectedErrors(cerrors).join(' | '))
  }
  await browser.close()
  ok('home flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionDisabledEvent() {
  const browser = await launchApp()
  console.log('\n[G] Event with face scan disabled hides the entry point')
  const errors = []
  const result = await importEventViaApi('event-2', 'MOCKBIRTHDAYFOLDER01')
  ok('event-2 has media for the check', Number(result?.photos) > 0, JSON.stringify(result))
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await openGallery(page, 'MP-9HXT2M')
  await page.waitForSelector('.mp-cg-folder')
  ok('event-2 gallery shows folders', (await page.locator('.mp-cg-folder').count()) === 3)
  ok('no Find my photos button', (await page.locator('button:has-text("Find my photos")').count()) === 0)
  await page.click('.mp-cg-folder >> nth=0')
  await page.waitForSelector('.mp-cg-grid img')
  // Downloads are off for this event: the server must refuse the download
  // URL even when it is called directly, not just hide the UI button. The
  // browser logs this deliberate 403 to the console, so it is captured here
  // and excluded from the unexpected-error check below.
  const errorsBeforeProbe = errors.length
  const downloadStatus = await page.evaluate(async () => {
    const src = document.querySelector('.mp-cg-grid img')?.src
    if (!src) {
      return 'no-media'
    }
    const response = await fetch(`${src.split('&v=')[0]}&v=full&download=1`)
    return response.status
  })
  ok('server refuses download when the event disables it', downloadStatus === 403, `status=${downloadStatus}`)
  const probeErrors = errors.slice(errorsBeforeProbe)
  const unexpectedProbeErrors = probeErrors.filter(
    (e) => !/403 \(Forbidden\)|Downloads are turned off/.test(e)
  )
  ok('no other errors from the download probe', unexpectedProbeErrors.length === 0, unexpectedProbeErrors.join(' | '))
  errors.length = errorsBeforeProbe
  await context.close()
  await browser.close()
  ok('disabled event no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionSyncAndIncrementalIndex() {
  const browser = await launchApp()
  console.log('\n[H] Drive sync then incremental face index picks up new photos')
  const errors = []
  const page = await browser.newPage()
  attach(page, errors)
  await loginAdmin(page)
  await page.goto(`${APP}/admin/gallery/event-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mp-adm-drive__imported')

  await page.click('button:has-text("Sync Drive")')
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.mp-adm-drive__phase-result')
      return el && /new/.test(el.textContent)
    },
    null,
    { timeout: 30000 }
  )
  const syncResult = await page.locator('.mp-adm-drive__phase-result').innerText()
  ok('sync reports 2 new', syncResult.includes('2 new'), syncResult)
  await page.click('button:has-text("Done")').catch(() => {})

  // Reindex: only the 2 new images
  await page.click('button:has-text("Reindex New Media")')
  const deadline = Date.now() + 120000
  let done = false
  let sawTwo = false
  while (Date.now() < deadline) {
    const status = (await page.locator('.mp-adm-face__status').innerText()).trim()
    const progress = await page.locator('.mp-adm-face__progress').innerText().catch(() => '')
    if (/2 \/ 2 images/.test(progress)) {
      sawTwo = true
    }
    if (status.startsWith('Complete')) {
      done = true
      break
    }
    if (status === 'Error') {
      break
    }
    await page.waitForTimeout(1000)
  }
  ok('reindex processes exactly the 2 new images', done && sawTwo)
  const grid = await waitStatsReady(page)
  ok('totals after sync: 157 / 157 scanned (one photo unavailable)', grid['Images scanned'] === '157 / 157', JSON.stringify(grid))
  ok('21 faces after sync', grid['Faces detected'] === '21', JSON.stringify(grid))
  await page.click('button:has-text("Done")').catch(() => {})
  await shot(page, '10-admin-after-sync-reindex')
  await page.close()

  // Client: one more match now (13)
  {
    const cerrors = []
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const cpage = await context.newPage()
    attach(cpage, cerrors)
    await openGallery(cpage)
    await runScan(cpage)
    await cpage.waitForSelector('.mp-cg-tile', { timeout: 60000 })
    const countLine = await cpage.locator('.mp-fm__count').innerText()
    ok('client finds 13 matching photos after sync', countLine.includes('13 matching photos'), countLine)
    await context.close()
    ok('post-sync scan no unexpected console errors', unexpectedErrors(cerrors).length === 0, unexpectedErrors(cerrors).join(' | '))
  }
  await browser.close()
  ok('sync reindex no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionRebuild() {
  const browser = await launchApp()
  console.log('\n[I] Rebuild index with confirmation')
  const errors = []
  const page = await browser.newPage()
  attach(page, errors)
  await loginAdmin(page)
  await page.goto(`${APP}/admin/gallery/event-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mp-adm-face')
  await page.click('button:has-text("Rebuild Index")')
  await page.waitForSelector('.mp-adm-modal')
  ok('confirmation dialog shown', (await page.locator('.mp-adm-modal').innerText()).includes('clears every stored face embedding'))
  await shot(page, '11-rebuild-confirm')
  await page.click('.mp-adm-modal button:has-text("Rebuild index")')
  // The status pill can show a stale "Complete" for a moment while the
  // index is being cleared, so the real signal is the run progress first
  // appearing and then reaching the full image count.
  await page.waitForSelector('.mp-adm-face__progress', { timeout: 30000 })
  await page.waitForFunction(
    () => /Scanning images|Detecting faces|Generating embeddings|Saving index/.test(
      document.querySelector('.mp-adm-face__progress')?.textContent ?? ''
    ),
    null,
    { timeout: 30000 }
  )
  const deadline = Date.now() + 420000
  let done = false
  while (Date.now() < deadline) {
    const progress = await page.locator('.mp-adm-face__progress').innerText().catch(() => '')
    if (/157 \/ 157 images/.test(progress)) {
      done = true
      break
    }
    const status = (await page.locator('.mp-adm-face__status').innerText()).trim()
    if (status === 'Error') {
      break
    }
    await page.waitForTimeout(2500)
  }
  ok('rebuild completes', done)
  const grid = await waitStatsReady(page)
  ok('rebuild ends at 157 / 157', grid['Images scanned'] === '157 / 157', JSON.stringify(grid))
  ok('rebuild finds 21 faces again', grid['Faces detected'] === '21', JSON.stringify(grid))
  await page.close()
  await browser.close()
  ok('rebuild no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionMobile() {
  console.log('\n[J] Mobile: camera scan and results at 390px')
  const errors = []
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${MEDIA}/faceA.y4m`,
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  attach(page, errors)
  await page.goto(`${APP}/client-access?event=${WEDDING_TOKEN}`, { waitUntil: 'networkidle' })
  await introDone(page)
  await passGate(page)
  await page.waitForSelector('.mp-cg-folder', { timeout: 30000 })
  ok('gallery fits 390px', await noHScroll(page))
  await runScan(page)
  await page.waitForSelector('.mp-fm', { timeout: 60000 })
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  const countLine = await page.locator('.mp-fm__count').innerText()
  ok('mobile finds 13 matches (post-sync index)', countLine.includes('13 matching photos'), countLine)
  ok('results fit 390px', await noHScroll(page))
  await shot(page, '12-mobile-face-scan-results')
  await context.close()
  await browser.close()
  ok('mobile no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionPublic() {
  console.log('\n[K] Public site without env (port 5173)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.goto(`${PUB}/`, { waitUntil: 'networkidle' })
  await introDone(page)
  ok('home renders brand', (await page.locator('.mp-brand, .mp-navbar').count()) > 0)
  ok('home shows face scan block', (await page.locator('.mp-cta__face-title').count()) === 1)
  await page.goto(`${PUB}/client-access`, { waitUntil: 'networkidle' })
  await introDone(page)
  ok('client-access entry renders', (await page.locator('input[name="event-code"]').count()) === 1)
  // Regression: with no backend the services page must still render the
  // built-in list (it once white-screened on a missing points field).
  await page.goto(`${PUB}/services`, { waitUntil: 'networkidle' })
  await introDone(page)
  const rootText = await page.locator('#root').innerText()
  ok('services renders without a backend', rootText.trim().length > 100, `root=${rootText.trim().length}`)
  ok(
    'services shows the built-in list without a backend',
    (await page.locator('.mp-service-detail, .mp-services__grid .mp-service-card, .mp-service-wide').count()) === 15,
    String(await page.locator('.mp-service-detail, .mp-services__grid .mp-service-card, .mp-service-wide').count())
  )
  await context.close()
  await browser.close()
  ok('public site no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

// ---------------------------------------------------------------- main

async function main() {
  // Fresh mock state: the suite builds up import -> index -> scan -> sync
  // sequentially, so it must start from a clean database.
  await fetch(`${API}/__reset`, { method: 'POST' })
  const sections = [
    ['admin import', sectionAdminImport],
    ['face index', sectionFaceIndex],
    ['client scan', sectionClientScan],
    ['scan states', sectionScanStates],
    ['camera denied', sectionCameraDenied],
    ['home + entry flows', sectionHomeAndEntryFlows],
    ['disabled event', sectionDisabledEvent],
    ['sync + incremental', sectionSyncAndIncrementalIndex],
    ['rebuild', sectionRebuild],
  ]
  for (const [name, fn] of sections) {
    try {
      await fn()
    } catch (err) {
      failed += 1
      failures.push(`section ${name} crashed — ${err.message}`)
      console.log(`    CRASH in ${name}: ${err.message}`)
    }
  }

  // Standalone sections with their own browsers
  for (const [name, fn] of [['mobile', sectionMobile], ['public', sectionPublic]]) {
    try {
      await fn()
    } catch (err) {
      failed += 1
      failures.push(`section ${name} crashed — ${err.message}`)
      console.log(`    CRASH in ${name}: ${err.message}`)
    }
  }

  console.log('\n==================================================')
  console.log(`PHASE 7 E2E: ${passed} passed, ${failed} failed`)
  if (failures.length) {
    console.log('Failures:')
    for (const f of failures) console.log(`  - ${f}`)
  }
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('SUITE CRASH:', err)
  process.exit(1)
})
