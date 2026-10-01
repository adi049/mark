/**
 * Phase 8 end-to-end suite: Instagram engagement gate.
 *
 * Real browser flows against the local mock: event code and QR access now
 * pass through the Instagram gate (countdown, external open attempt,
 * continue), the gate is per-event, sessions expire, the admin toggle
 * works, and the face scan path stays gate-free.
 *
 * Requires: mock on :54321, dev servers :5175 (mock env) and :5173 (no
 * env), playwright in /home/user/node_modules, Y4M files in /tmp/e2e-media.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const APP = 'http://localhost:5175'
const PUB = 'http://localhost:5173'
const API = 'http://localhost:54321'
const MEDIA = '/tmp/e2e-media'
const SHOTS = '/home/user/markipie/docs/phase-8'
fs.mkdirSync(SHOTS, { recursive: true })

const INSTAGRAM_URL = 'https://www.instagram.com/markipieofficial/'
const WEDDING_TOKEN = 'weddingtoken1234567890abcdef1234'

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

/** Admin API helper: login token. */
async function adminToken() {
  const login = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'studio@markipie.test', password: 'markipie-test-admin' }),
  }).then((r) => r.json())
  return login.access_token
}

/** Import a Drive folder into an event through the mock API directly. */
async function importEventViaApi(eventId, folderId) {
  const token = await adminToken()
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
  for (let i = 0; i < 80; i += 1) {
    const status = await fetch(`${API}/functions/v1/drive/jobs/${job.jobId}`, { headers }).then((r) => r.json())
    if (status.done) {
      return status.result
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('import job timed out')
}

/** Opens the client gallery with an event code, passing the gate if shown. */
async function openGallery(page, code = 'MP-4K7RQP') {
  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]', { timeout: 30000 })
  await introDone(page)
  await page.fill('input[name="event-code"]', code)
  await page.click('button[type="submit"]')
  await passGate(page)
  await page.waitForSelector('.mp-cg', { timeout: 30000 })
}

/** Waits for the Instagram gate (if it appears) and continues through it. */
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

// ---------------------------------------------------------------- sections

async function sectionCodeGate() {
  console.log('\n[A] Event code: gate, countdown, continue, gallery')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  const popups = []
  page.on('popup', (p) => popups.push(p.url()))

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]')
  await introDone(page)
  await page.fill('input[name="event-code"]', 'MP-4K7RQP')
  await page.click('button[type="submit"]')

  await page.waitForSelector('.mp-ig', { timeout: 15000 })
  ok('gate appears before the gallery', true)
  ok('gallery not open behind gate', (await page.locator('.mp-cg').count()) === 0)
  ok('brand wordmark shown', (await page.locator('.mp-ig__brand').innerText()) === 'MARKIPIE')
  ok('eyebrow copy', /follow us on instagram/i.test(await page.locator('.mp-ig__eyebrow').innerText()))
  ok('title copy', (await page.locator('.mp-ig__title').innerText()) === 'Follow Markipie to continue to your gallery.')
  ok('event name shown', (await page.locator('.mp-ig__event').innerText()) === 'Rahul and Priya Wedding')
  const note = await page.locator('.mp-ig__note').innerText()
  ok('continue note during countdown', note === 'Your gallery will continue after this step.')

  const href = await page.locator('.mp-ig__cta').getAttribute('href')
  const target = await page.locator('.mp-ig__cta').getAttribute('target')
  const rel = await page.locator('.mp-ig__cta').getAttribute('rel')
  ok('CTA points at the official profile', href === INSTAGRAM_URL, href)
  ok('CTA opens a new tab safely', target === '_blank' && /noopener/.test(rel ?? ''), `${target} ${rel}`)
  ok('CTA label while counting', (await page.locator('.mp-ig__cta').innerText()) === 'Follow on Instagram')

  // Countdown runs 5 -> 1 with each number visible
  const seen = []
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const value = await page.locator('.mp-ig__count').innerText().catch(() => null)
    if (value && seen[seen.length - 1] !== value) {
      seen.push(value)
    }
    if (await page.locator('.mp-ig__continue').count()) {
      break
    }
    await page.waitForTimeout(350)
  }
  ok('countdown counts 5 to 1', seen.join(',') === '5,4,3,2,1', seen.join(','))
  await shot(page, '01-gate-countdown')

  // Countdown finished: a way forward always exists
  await page.waitForSelector('.mp-ig__continue', { timeout: 10000 })
  ok('continue button appears after countdown', true)
  ok('CTA relabels to Open Instagram', (await page.locator('.mp-ig__cta').innerText()) === 'Open Instagram')
  const caption = await page.locator('.mp-ig__caption').innerText()
  ok('post-countdown guidance', /gallery/.test(caption), caption)
  // Either the automatic popup happened or the blocked message shows; both
  // keep the visitor moving.
  const blockedMessage = await page.locator('.mp-ig__post-count').innerText()
  ok(
    'auto open attempted (popup or honest fallback message)',
    popups.some((url) => url.includes('instagram.com')) || /couldn't open Instagram automatically/i.test(blockedMessage),
    `popups: ${popups.join(',') || 'none'} · message: ${blockedMessage}`
  )
  console.log(`        auto open: ${popups.length ? 'popup fired' : 'blocked fallback shown'}`)

  await page.click('button:has-text("Continue to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  ok('gallery opens after continue', (await page.locator('.mp-cg-folder').count()) === 5)
  ok('gate closed', (await page.locator('.mp-ig').count()) === 0)

  // Navigating the gallery never re-runs the gate
  await page.locator('.mp-cg-folder').first().click()
  await page.waitForTimeout(1000)
  ok('no gate on folder navigation', (await page.locator('.mp-ig').count()) === 0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await introDone(page)
  await page.waitForSelector('.mp-cg-folder', { timeout: 20000 })
  ok('no gate after reload', (await page.locator('.mp-ig').count()) === 0)
  ok('gallery restored after reload', (await page.locator('.mp-cg-folder').count()) === 5)

  // Exiting ends the session: the next code entry gates again
  await page.click('button:has-text("Exit gallery")')
  await page.waitForSelector('input[name="event-code"]', { timeout: 10000 })
  await page.fill('input[name="event-code"]', 'MP-4K7RQP')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.mp-ig', { timeout: 15000 })
  ok('fresh session gates again after exit', true)
  await shot(page, '02-gate-second-entry')
  await context.close()
  await browser.close()
  ok('code gate flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionBlockedPopup() {
  console.log('\n[B] Blocked popup: honest message and manual buttons')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.addInitScript(() => {
    // Simulate a popup blocker: window.open returns null.
    window.open = () => null
  })

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]')
  await introDone(page)
  await page.fill('input[name="event-code"]', 'MP-4K7RQP')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.mp-ig', { timeout: 15000 })
  await page.waitForSelector('.mp-ig__continue', { timeout: 20000 })
  const message = await page.locator('.mp-ig__post-count').innerText()
  ok('blocked message shown', message === "We couldn't open Instagram automatically.", message)
  ok('manual open button present', (await page.locator('.mp-ig__cta').count()) === 1)
  ok('continue button present', (await page.locator('button:has-text("Continue to gallery")').count()) === 1)
  await shot(page, '03-gate-blocked-fallback')
  await page.click('button:has-text("Continue to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  ok('gallery still reachable when blocked', (await page.locator('.mp-cg-folder').count()) === 5)
  await context.close()
  await browser.close()
  ok('blocked flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionGateOff() {
  console.log('\n[C] Event with the gate off opens the gallery directly')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]')
  await introDone(page)
  await page.fill('input[name="event-code"]', 'MP-9HXT2M')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  await page.waitForTimeout(800)
  ok('gate never shown for this event', (await page.locator('.mp-ig').count()) === 0)
  ok('gallery opens directly', (await page.locator('.mp-cg-folder').count()) === 3)
  await context.close()
  await browser.close()
  ok('gate-off flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionQrFlow() {
  console.log('\n[D] QR link: gate then gallery')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(`${APP}/client-access?event=${WEDDING_TOKEN}`, { waitUntil: 'networkidle' })
  await introDone(page)
  await page.waitForSelector('.mp-ig', { timeout: 20000 })
  ok('QR access shows the gate', true)
  await page.waitForSelector('.mp-ig__continue', { timeout: 20000 })
  await page.click('button:has-text("Continue to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  ok('gallery opens after QR gate', (await page.locator('.mp-cg-folder').count()) === 5)
  await context.close()
  await browser.close()
  ok('QR flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionMidCountdownReload() {
  console.log('\n[E] Reloading mid-countdown shows the gate again (step not completed)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]')
  await introDone(page)
  await page.fill('input[name="event-code"]', 'MP-4K7RQP')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.mp-ig', { timeout: 15000 })
  await page.waitForSelector('.mp-ig__count', { timeout: 5000 })
  const stored = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('markipie:client-session')
    const parsed = raw ? JSON.parse(raw) : null
    return { hasSession: Boolean(parsed?.code), gateAt: parsed?.gateAt ?? null }
  })
  ok('session exists before the gate completes', stored.hasSession)
  ok('gate step not yet marked complete', stored.gateAt === null)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await introDone(page)
  await page.waitForSelector('.mp-ig', { timeout: 15000 })
  ok('gate shows again after mid-countdown reload', true)
  await page.waitForSelector('.mp-ig__continue', { timeout: 20000 })
  await page.click('button:has-text("Continue to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  ok('gallery opens after completing the step', (await page.locator('.mp-cg-folder').count()) === 5)
  await context.close()
  await browser.close()
  ok('mid-countdown flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionSessionExpiry() {
  console.log('\n[F] Expired session: back to the entry page')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'markipie:client-session',
      JSON.stringify({
        code: 'MP-4K7RQP',
        event: { id: 'event-1', name: 'Rahul and Priya Wedding', instagram_gate_enabled: true },
        createdAt: Date.now() - 7 * 60 * 60 * 1000,
        expiresAt: Date.now() - 60 * 1000,
        gateAt: Date.now() - 60 * 1000,
      })
    )
  })

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await introDone(page)
  await page.waitForSelector('input[name="event-code"]', { timeout: 10000 })
  ok('expired session falls back to the entry page', true)
  ok('gallery not open', (await page.locator('.mp-cg').count()) === 0)
  const raw = await page.evaluate(() => window.sessionStorage.getItem('markipie:client-session'))
  ok('expired session discarded', raw === null, String(raw).slice(0, 80))
  await context.close()
  await browser.close()
  ok('expiry flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionAdminToggle() {
  console.log('\n[G] Admin: Instagram gate toggle per event')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await loginAdmin(page)
  await page.goto(`${APP}/admin/events`, { waitUntil: 'networkidle' })
  await page.waitForSelector('table')
  await page.click('button[aria-label="Edit Arjun and Meera Birthday"]')
  await page.waitForSelector('.mp-adm-modal')

  const gateCheck = page.locator('.mp-adm-modal label.mp-check', { hasText: 'Instagram gate' }).locator('input')
  ok('toggle starts off for this event', !(await gateCheck.isChecked()))
  await gateCheck.check()
  await shot(page, '04-admin-gate-toggle')
  await page.click('button:has-text("Save changes")')
  await page.waitForSelector('.mp-adm-modal', { state: 'detached', timeout: 15000 })
  ok('event saved with the gate on', true)

  // The client flow for event-2 now gates
  const cpage = await context.newPage()
  attach(cpage, errors)
  await cpage.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await cpage.waitForSelector('input[name="event-code"]')
  await introDone(cpage)
  await cpage.fill('input[name="event-code"]', 'MP-9HXT2M')
  await cpage.click('button[type="submit"]')
  await cpage.waitForSelector('.mp-ig', { timeout: 15000 })
  ok('event-2 now shows the gate after enabling it', true)
  await cpage.waitForSelector('.mp-ig__continue', { timeout: 20000 })
  await cpage.click('button:has-text("Continue to gallery")')
  await cpage.waitForSelector('.mp-cg-folder', { timeout: 15000 })
  ok('event-2 gallery opens after its gate', (await cpage.locator('.mp-cg-folder').count()) === 3)

  // Restore the flag off for later sections
  const token = await adminToken()
  await fetch(`${API}/rest/v1/events?id=eq.event-2`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ instagram_gate_enabled: false }),
  })
  await context.close()
  await browser.close()
  ok('admin toggle flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionInvalidAndInactive() {
  console.log('\n[H] Invalid code and inactive event stay out')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  // Invalid code
  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]')
  await introDone(page)
  await page.fill('input[name="event-code"]', 'MP-WRONG')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Invalid or expired access code.', { timeout: 10000 })
  ok('invalid code rejected', true)
  ok('no gate for an invalid code', (await page.locator('.mp-ig').count()) === 0)

  // Inactive event (event-3 flipped through the admin API)
  const token = await adminToken()
  await fetch(`${API}/rest/v1/events?id=eq.event-3`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'inactive' }),
  })
  await page.fill('input[name="event-code"]', 'MP-3QB8VN')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Invalid or expired access code.', { timeout: 10000 })
  ok('inactive event rejected like an invalid code', true)
  ok('no gate for an inactive event', (await page.locator('.mp-ig').count()) === 0)
  await context.close()
  await browser.close()
  ok('invalid/inactive flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionFaceScanUnaffected() {
  console.log('\n[I] Face scan path stays gate-free (spec: face scan keeps its own workflow)')
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]')
  await introDone(page)
  await page.click('#face-scan button:has-text("Start Face Scan")')
  await page.waitForSelector('.mp-fs')
  await page.click('button:has-text("Start Camera")')
  await page.waitForSelector('text=Your Event Code', { timeout: 60000 })
  ok('scan captures and asks for the code', true)
  await page.fill('.mp-fs__form input', 'MP-4K7RQP')
  await page.click('button:has-text("Find My Photos")')
  await page.waitForSelector('.mp-cg', { timeout: 30000 })
  await page.waitForTimeout(1500)
  ok('gallery opens with no Instagram gate on the scan path', (await page.locator('.mp-ig').count()) === 0)
  ok('face results view rendered', (await page.locator('.mp-fm').count()) === 1)
  await shot(page, '05-face-scan-no-gate')
  await context.close()
  await browser.close()
  ok('face scan flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionDirectAccess() {
  console.log('\n[J] No session: the gallery cannot be reached without access')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(`${APP}/gallery`, { waitUntil: 'networkidle' })
  await introDone(page)
  ok('/gallery is the public portfolio, not a client gallery', (await page.locator('.mp-gallery, main h1').count()) > 0)
  ok('no client gallery leaked onto the public page', (await page.locator('.mp-cg').count()) === 0)
  ok('no gate on the public gallery page', (await page.locator('.mp-ig').count()) === 0)

  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await introDone(page)
  await page.waitForSelector('input[name="event-code"]', { timeout: 10000 })
  ok('client access without a session shows the entry page', true)
  await context.close()
  await browser.close()
  ok('direct access flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionMobile() {
  console.log('\n[K] Mobile: gate fits 390px and never traps the visitor')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(`${APP}/client-access?event=${WEDDING_TOKEN}`, { waitUntil: 'networkidle' })
  await introDone(page)
  await page.waitForSelector('.mp-ig', { timeout: 20000 })
  const fits = await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1)
  ok('gate fits 390px without horizontal overflow', fits)
  const ctaBox = await page.locator('.mp-ig__cta').boundingBox()
  ok('CTA is fully visible on mobile', ctaBox && ctaBox.x >= 0 && ctaBox.x + ctaBox.width <= 390 + 1)
  await shot(page, '06-mobile-gate')
  await page.waitForSelector('.mp-ig__continue', { timeout: 20000 })
  const continueBox = await page.locator('.mp-ig__continue').boundingBox()
  ok('continue button fully visible on mobile', continueBox && continueBox.x >= 0 && continueBox.x + continueBox.width <= 390 + 1)
  await page.click('button:has-text("Continue to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 20000 })
  ok('mobile gallery opens after the gate', (await page.locator('.mp-cg-folder').count()) === 5)
  await context.close()

  // Reduced motion: the countdown still completes, just without movement
  const rcontext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const rpage = await rcontext.newPage()
  attach(rpage, errors)
  await rpage.emulateMedia({ reducedMotion: 'reduce' })
  await rpage.goto(`${APP}/client-access?event=${WEDDING_TOKEN}`, { waitUntil: 'networkidle' })
  await introDone(rpage)
  await rpage.waitForSelector('.mp-ig', { timeout: 20000 })
  await rpage.waitForSelector('.mp-ig__continue', { timeout: 20000 })
  await rpage.click('button:has-text("Continue to gallery")')
  await rpage.waitForSelector('.mp-cg-folder', { timeout: 20000 })
  ok('reduced motion still counts down and continues', (await rpage.locator('.mp-cg-folder').count()) === 5)
  await rcontext.close()
  await browser.close()
  ok('mobile/reduced-motion no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionPublic() {
  console.log('\n[L] Public site without env (port 5173)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.goto(`${PUB}/client-access`, { waitUntil: 'networkidle' })
  await introDone(page)
  ok('entry page renders', (await page.locator('input[name="event-code"]').count()) === 1)
  await page.fill('input[name="event-code"]', 'MP-4K7RQP')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=The studio gallery service is not connected yet', { timeout: 10000 })
  ok('unconfigured backend shows a friendly message, no gate', (await page.locator('.mp-ig').count()) === 0)
  await context.close()
  await browser.close()
  ok('public flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

// ---------------------------------------------------------------- main

async function main() {
  // Fresh mock state, then seed both events with media.
  await fetch(`${API}/__reset`, { method: 'POST' })
  await importEventViaApi('event-1', 'MOCKWEDDINGFOLDER1')
  await importEventViaApi('event-2', 'MOCKBIRTHDAYFOLDER01')
  console.log('mock seeded')

  const sections = [
    ['code gate', sectionCodeGate],
    ['blocked popup', sectionBlockedPopup],
    ['gate off', sectionGateOff],
    ['QR flow', sectionQrFlow],
    ['mid-countdown reload', sectionMidCountdownReload],
    ['session expiry', sectionSessionExpiry],
    ['admin toggle', sectionAdminToggle],
    ['invalid + inactive', sectionInvalidAndInactive],
    ['face scan unaffected', sectionFaceScanUnaffected],
    ['direct access', sectionDirectAccess],
    ['mobile + reduced motion', sectionMobile],
    ['public site', sectionPublic],
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

  console.log('\n==================================================')
  console.log(`PHASE 8 E2E: ${passed} passed, ${failed} failed`)
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
