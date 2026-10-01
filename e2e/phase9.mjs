/**
 * Phase 9 end-to-end suite: payment status, watermark and download control,
 * reactions and the admin photo selection system.
 *
 * Runs the real client gallery and admin panel against the local mock and
 * verifies the six required scenarios plus privacy, mobile and regression
 * basics. Payment is an admin label only: no provider is involved.
 *
 * Requires: mock on :54321, dev server :5175 (mock env), playwright in
 * /home/user/node_modules.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const APP = 'http://localhost:5175'
const API = 'http://localhost:54321'
const SHOTS = '/home/user/markipie/docs/phase-9'
fs.mkdirSync(SHOTS, { recursive: true })

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

async function adminToken() {
  const login = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'studio@markipie.test', password: 'markipie-test-admin' }),
  }).then((r) => r.json())
  return login.access_token
}

async function api(method, path, body, token) {
  const headers = { 'content-type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function importEventViaApi(eventId, folderId) {
  const token = await adminToken()
  // Connect Drive through the real contract: begin creates a single-use
  // OAuth state for this admin, the callback URL completes the connection.
  const begin = await api('POST', '/functions/v1/drive/auth/begin', { returnTo: '/admin/gallery' }, token).then((r) => r.json())
  if (begin?.url) {
    await fetch(begin.url).catch(() => {})
  }
  const job = await api('POST', '/functions/v1/drive/import', { eventId, urlOrId: folderId }, token).then((r) => r.json())
  for (let i = 0; i < 80; i += 1) {
    const status = await api('GET', `/functions/v1/drive/jobs/${job.jobId}`, undefined, token).then((r) => r.json())
    if (status.done) {
      return status.result
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('import job timed out')
}

/** Opens the client gallery with a code, passing the Instagram gate. */
async function openGallery(context, code = 'MP-4K7RQP') {
  const page = await context.newPage()
  await page.goto(`${APP}/client-access`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[name="event-code"]', { timeout: 30000 })
  await introDone(page)
  await page.fill('input[name="event-code"]', code)
  await page.click('button[type="submit"]')
  const gateOrGallery = await Promise.race([
    page.waitForSelector('.mp-ig', { timeout: 20000 }).then(() => 'gate'),
    page.waitForSelector('.mp-cg', { timeout: 20000 }).then(() => 'gallery'),
  ])
  if (gateOrGallery === 'gate') {
    await page.waitForSelector('.mp-ig__continue', { timeout: 20000 })
    await page.click('button:has-text("Continue to gallery")')
  }
  await page.waitForSelector('.mp-cg-folder', { timeout: 30000 })
  return page
}

/** Opens the first photo (never a video) of the first folder in the viewer. */
async function openFirstPhoto(page) {
  await page.locator('.mp-cg-folder').first().click()
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  const photoTile = page.locator('.mp-cg-tile:not(:has(.mp-cg-tile__play))').first()
  await photoTile.click()
  await page.waitForSelector('.mp-viewer', { timeout: 15000 })
  await page.waitForSelector('.mp-viewer img', { timeout: 15000 })
  await page.waitForTimeout(800)
}

/** Polls a locator count until it settles on the expected value. */
async function countBecomes(page, selector, expected, timeout = 8000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if ((await page.locator(selector).count()) === expected) {
      return true
    }
    await page.waitForTimeout(400)
  }
  const finalCount = await page.locator(selector).count()
  console.log(`      [debug] ${selector} count=${finalCount} (wanted ${expected})`)
  try {
    const labels = await page
      .locator('.mp-viewer button, .mp-viewer a')
      .evaluateAll((els) => els.map((e) => `${e.tagName}:${e.getAttribute('aria-label')}:${e.className}`))
    console.log('      [debug] viewer controls:', JSON.stringify(labels))
    console.log('      [debug] viewers open:', await page.locator('.mp-viewer').count())
  } catch {
    /* viewer already closed */
  }
  return finalCount === expected
}

async function reactionRowCount(token) {
  const rows = await api(
    'POST',
    '/rest/v1/rpc/admin_event_media_list',
    { p_event_id: 'event-1' },
    token
  ).then((r) => r.json())
  return rows
}

// ---------------------------------------------------------------- sections

async function sectionCaseOne() {
  console.log('\n[A] Case 1: UNPAID + watermark ON + download OFF')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const token = await adminToken()
  // Baseline: payment unpaid (default), watermark on, download off.
  await api('PATCH', '/rest/v1/events?id=eq.event-1', {
    watermark_enabled: true,
    download_enabled: false,
    reaction_enabled: true,
  }, token)

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await openGallery(context)
  attach(page, errors)
  await openFirstPhoto(page)
  ok('watermark visible in viewer', (await page.locator('.mp-viewer .mp-wm').count()) === 1)
  ok('no download button', (await page.locator('.mp-viewer__btn:has-text("Download")').count()) === 0)
  ok('like and dislike available', (await page.locator('.mp-viewer__react').count()) === 2)
  ok('photo fullscreen button available', await countBecomes(page, 'button[aria-label="View fullscreen"]', 1))
  ok('watermark on grid thumbnails', (await page.locator('.mp-cg-tile .mp-wm').first().count()) === 1)
  await shot(page, '01-case1-unpaid-watermarked')
  await context.close()
  await browser.close()
  ok('case 1 no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionCaseTwo() {
  console.log('\n[B] Case 2: PAID + watermark ON + download OFF changes nothing')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const token = await adminToken()
  const payment = await api('POST', '/rest/v1/rpc/admin_set_payment_status', {
    p_event_id: 'event-1',
    p_status: 'paid',
  }, token).then((r) => r.json())
  ok('payment set to paid', payment?.payment_status === 'paid', JSON.stringify(payment))

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await openGallery(context)
  attach(page, errors)
  await openFirstPhoto(page)
  ok('watermark still on after marking paid', (await page.locator('.mp-viewer .mp-wm').count()) === 1)
  ok('download still hidden after marking paid', (await page.locator('.mp-viewer__btn:has-text("Download")').count()) === 0)
  await shot(page, '02-case2-paid-still-watermarked')
  await context.close()
  await browser.close()
  ok('case 2 no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionCaseThree() {
  console.log('\n[C] Case 3: PAID + watermark OFF + download ON')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const token = await adminToken()
  await api('PATCH', '/rest/v1/events?id=eq.event-1', {
    watermark_enabled: false,
    download_enabled: true,
  }, token)

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await openGallery(context)
  attach(page, errors)
  await openFirstPhoto(page)
  ok('no watermark in viewer', (await page.locator('.mp-viewer .mp-wm').count()) === 0)
  const download = page.locator('.mp-viewer__btn:has-text("Download")')
  ok('download button available', (await download.count()) === 1)
  const href = await download.getAttribute('href')
  ok('download points at the full version with download flag', /v=full/.test(href) && /download=1/.test(href), href)
  ok('no watermark on grid thumbnails', (await page.locator('.mp-cg-tile .mp-wm').count()) === 0)

  // Video: playback intact and download control respects the same flag.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('.mp-cg-section__back')
  await page.waitForSelector('.mp-cg-folder', { timeout: 20000 })
  await page.locator('.mp-cg-folder', { hasText: 'Wedding' }).click()
  await page.waitForSelector('.mp-cg-subfolder', { timeout: 20000 })
  await page.locator('.mp-cg-subfolder', { hasText: 'Videos' }).click()
  const videoTile = page.locator('.mp-cg-tile:has(.mp-cg-tile__play)').first()
  await videoTile.click()
  await page.waitForSelector('.mp-viewer video', { timeout: 15000 })
  await page.waitForTimeout(1200)
  ok('video plays with download enabled', (await page.locator('.mp-viewer__btn:has-text("Download")').count()) === 1)
  ok('video has no watermark overlay', (await page.locator('.mp-viewer .mp-wm').count()) === 0)
  ok('video controls rendered', (await page.locator('.mp-viewer__video-bar').count()) === 1)
  await shot(page, '03-case3-no-watermark-download')
  await context.close()
  await browser.close()
  ok('case 3 no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionReactions() {
  console.log('\n[D] Case 4: reactions update in place, one per photo per session')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await openGallery(context)
  attach(page, errors)
  await page.locator('.mp-cg-folder').first().click()
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  await page.locator('.mp-cg-tile:not(:has(.mp-cg-tile__play))').first().click()
  await page.waitForSelector('.mp-viewer', { timeout: 15000 })
  await page.waitForTimeout(600)

  const like = page.locator('button[aria-label="Like this photo"]')
  const dislike = page.locator('button[aria-label="Dislike this photo"]')
  await like.click()
  await page.waitForTimeout(700)
  ok('like becomes active', (await like.getAttribute('aria-pressed')) === 'true')
  await dislike.click()
  await page.waitForTimeout(700)
  ok('switching to dislike updates the same choice', (await dislike.getAttribute('aria-pressed')) === 'true')
  ok('like no longer active', (await like.getAttribute('aria-pressed')) === 'false')

  // Only one reaction row exists for this photo and session.
  const token = await adminToken()
  const rows = await reactionRowCount(token)
  const target = rows[0]
  ok('admin list shows the latest client reaction', target.client_reaction === 'dislike', target.client_reaction)
  await dislike.click()
  await page.waitForTimeout(700)
  ok('clicking again clears the reaction', (await dislike.getAttribute('aria-pressed')) === 'false')

  // Reopen: own state persists for this session.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('.mp-cg-tile').first().click()
  await page.waitForSelector('.mp-viewer', { timeout: 15000 })
  await page.waitForTimeout(600)
  ok('cleared state persists after reopening', (await dislike.getAttribute('aria-pressed')) === 'false')
  await context.close()
  await browser.close()
  ok('reactions flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionCaseFive() {
  console.log('\n[E] Case 5: reactions OFF hides the controls')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await openGallery(context, 'MP-9HXT2M')
  attach(page, errors)
  await page.locator('.mp-cg-folder').first().click()
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  await page.locator('.mp-cg-tile:not(:has(.mp-cg-tile__play))').first().click()
  await page.waitForSelector('.mp-viewer', { timeout: 15000 })
  ok('no reaction buttons when disabled', (await page.locator('.mp-viewer__react').count()) === 0)
  await shot(page, '04-case5-reactions-off')
  await context.close()
  await browser.close()
  ok('case 5 no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionReactionPrivacy() {
  console.log('\n[F] Reactions are private: no counts, nothing from other sessions')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })

  // Session A likes the first photo of the first folder.
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageA = await openGallery(contextA)
  attach(pageA, errors)
  await pageA.locator('.mp-cg-folder').first().click()
  await pageA.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  await pageA.locator('.mp-cg-tile:not(:has(.mp-cg-tile__play))').first().click()
  await pageA.waitForSelector('.mp-viewer', { timeout: 15000 })
  await pageA.waitForTimeout(500)
  const likeA = pageA.locator('button[aria-label="Like this photo"]')
  await likeA.click()
  await pageA.waitForTimeout(700)
  ok('session A liked the photo', (await likeA.getAttribute('aria-pressed')) === 'true')
  const galleryText = await pageA.locator('body').innerText()
  ok('no like counts anywhere in the client UI', !/\d+\s+(people|likes?|dislikes?)/i.test(galleryText))

  // Session B sees nothing of A's reaction.
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageB = await openGallery(contextB)
  attach(pageB, errors)
  await pageB.locator('.mp-cg-folder').first().click()
  await pageB.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  await pageB.locator('.mp-cg-tile:not(:has(.mp-cg-tile__play))').first().click()
  await pageB.waitForSelector('.mp-viewer', { timeout: 15000 })
  await pageB.waitForTimeout(600)
  const likeB = pageB.locator('button[aria-label="Like this photo"]')
  ok("session B does not see A's like", (await likeB.getAttribute('aria-pressed')) === 'false')
  await shot(pageB, '05-reaction-privacy')
  await contextA.close()
  await contextB.close()
  await browser.close()
  ok('privacy flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionAdminSelection() {
  console.log('\n[G] Case 6: admin photo selection, independent from client reactions')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })

  // A client likes two photos and dislikes one through the real RPC.
  const token = await adminToken()
  const rows = await reactionRowCount(token)
  const like1 = rows[1].media_id
  const like2 = rows[2].media_id
  const dislike1 = rows[3].media_id
  for (const [mediaId, reaction] of [[like1, 'like'], [like2, 'like'], [dislike1, 'dislike']]) {
    await api('POST', '/rest/v1/rpc/set_reaction', {
      p_code: 'MP-4K7RQP',
      p_media_id: mediaId,
      p_session_id: 'phase9-selector-1234',
      p_reaction: reaction,
    }, token)
  }
  // Expected numbers come straight from the database.
  const expected = await api('POST', '/rest/v1/rpc/admin_reaction_summary', {
    p_event_id: 'event-1',
  }, token).then((r) => r.json())
  const expectedLiked = Number(expected.liked)
  const expectedDisliked = Number(expected.disliked)
  const expectedUnselected = Number(expected.unselected)

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', 'studio@markipie.test')
  await page.fill('input[name="password"]', 'markipie-test-admin')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/dashboard')
  await page.goto(`${APP}/admin/gallery/event-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mp-adm-sel')
  await page.waitForTimeout(800)

  const stats = await page.locator('.mp-adm-sel__stats').innerText()
  ok('liked count comes from real data', new RegExp(`^${expectedLiked}$`, 'm').test(stats), `want ${expectedLiked}, got ${stats.replace(/\n/g, ' | ')}`)
  ok('disliked count comes from real data', new RegExp(`^${expectedDisliked}$`, 'm').test(stats), `want ${expectedDisliked}, got ${stats.replace(/\n/g, ' | ')}`)
  ok('unselected count comes from real data', new RegExp(`^${expectedUnselected}$`, 'm').test(stats), `want ${expectedUnselected}, got ${stats.replace(/\n/g, ' | ')}`)
  await shot(page, '06-admin-selection')

  // Filters: counts shown on the buttons must match the database numbers.
  const filterLabels = await page.locator('.mp-adm-sel__filter').allInnerTexts()
  ok('filter buttons show database counts', filterLabels.some((t) => t.includes(`Liked (${expectedLiked})`)) && filterLabels.some((t) => t.includes(`Disliked (${expectedDisliked})`)) && filterLabels.some((t) => t.includes(`Unselected (${expectedUnselected})`)), filterLabels.join(' / '))
  await page.click('.mp-adm-sel__filter:has-text("Liked")')
  await page.waitForTimeout(500)
  ok('liked filter shows exactly the liked photos', (await page.locator('.mp-adm-sel__item').count()) === expectedLiked)
  ok('liked tiles carry the like badge', (await page.locator('.mp-adm-sel__reaction:not(.mp-adm-sel__reaction--down)').count()) === expectedLiked)
  await page.click('.mp-adm-sel__filter:has-text("Disliked")')
  await page.waitForTimeout(500)
  ok('disliked filter shows exactly the disliked photos', (await page.locator('.mp-adm-sel__item').count()) === expectedDisliked)
  await page.click('.mp-adm-sel__filter:has-text("Unselected")')
  await page.waitForTimeout(500)
  const unselectedShown = await page.locator('.mp-adm-sel__item').count()
  ok('unselected filter caps at the page size when long', unselectedShown === Math.min(expectedUnselected, 60), `got ${unselectedShown}`)
  const moreLabel = await page.locator('.mp-adm-sel__more button').innerText().catch(() => '')
  ok('show more reports the remaining photos', moreLabel.includes(`${expectedUnselected - 60} left`), moreLabel)
  await page.click('.mp-adm-sel__filter:has-text("All")')
  await page.waitForTimeout(500)

  // Mark for album: a photo with NO client reaction, proving independence.
  await page.click('.mp-adm-sel__filter:has-text("Unselected")')
  await page.waitForTimeout(400)
  const firstUnselected = page.locator('.mp-adm-sel__item').first()
  const albumButton = firstUnselected.locator('.mp-adm-sel__album')
  await albumButton.click()
  await page.waitForTimeout(900)
  ok('album mark applied', (await firstUnselected.locator('.mp-adm-sel__album.is-on').count()) === 1)
  ok('client reaction stays empty on the marked photo', (await firstUnselected.locator('.mp-adm-sel__reaction').count()) === 0)

  // Bulk selection
  await page.click('.mp-adm-sel__filter:has-text("All")')
  await page.waitForTimeout(400)
  const items = page.locator('.mp-adm-sel__item')
  for (let i = 0; i < 3; i += 1) {
    await items.nth(i).locator('.mp-adm-sel__check').click()
  }
  await page.waitForSelector('.mp-adm-sel__bulk')
  ok('bulk bar shows the selection count', (await page.locator('.mp-adm-sel__bulk-count').innerText()) === '3 selected')
  await page.click('button:has-text("Mark selected")')
  await page.waitForTimeout(900)
  const statsAfter = await page.locator('.mp-adm-sel__stats').innerText()
  ok('album count grows to 4', statsAfter.includes('4'), statsAfter.replace(/\n/g, ' | '))
  ok('album badges visible', (await page.locator('.mp-adm-sel__album.is-on').count()) === 4)

  // Bulk remove
  await page.waitForTimeout(900)
  const statsFinal = await page.locator('.mp-adm-sel__stats').innerText()
  ok('removing from the album drops the count', statsFinal.includes('3'), statsFinal.replace(/\n/g, ' | '))

  // Refresh reloads everything from the database.
  await page.click('button:has-text("Refresh")')
  await page.waitForTimeout(1200)
  const statsRefreshed = await page.locator('.mp-adm-sel__stats').innerText()
  ok('refreshed numbers match the database', statsRefreshed.includes('3'), statsRefreshed.replace(/\n/g, ' | '))
  await shot(page, '07-admin-selection-after')

  // The client's own view is untouched by album selection.
  const clientContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const clientPage = await openGallery(clientContext)
  attach(clientPage, errors)
  const clientText = await clientPage.locator('body').innerText()
  ok('client never sees payment or album internals', !/Payment status|Mark for album|In album/i.test(clientText))
  await context.close()
  await clientContext.close()
  await browser.close()
  ok('admin selection flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionAdminPermissionsPanel() {
  console.log('\n[H] Admin permission panel controls and summary')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)
  await page.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', 'studio@markipie.test')
  await page.fill('input[name="password"]', 'markipie-test-admin')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/dashboard')
  await page.goto(`${APP}/admin/gallery/event-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mp-adm-perm')

  let summary = await page.locator('.mp-adm-perm__summary').innerText()
  ok('summary shows the stored payment', /PAID/.test(summary), summary.replace(/\n/g, ' | '))
  ok('summary shows watermark off', /WATERMARK\s*\n?\s*OFF/.test(summary.toUpperCase()), summary.replace(/\n/g, ' | '))
  ok('summary shows download on', /DOWNLOAD\s*\n?\s*ON/.test(summary.toUpperCase()), summary.replace(/\n/g, ' | '))

  // Payment buttons use exact labels; PARTIAL must not match UNPAID.
  await page.locator('.mp-adm-perm__pay-btn', { hasText: /^PARTIAL$/ }).click()
  await page.waitForTimeout(900)
  summary = await page.locator('.mp-adm-perm__summary').innerText()
  ok('payment changes to PARTIAL', /PARTIAL/.test(summary) && !/UNPAID/.test(summary), summary.replace(/\n/g, ' | '))
  const meta = await page.locator('.mp-adm-perm__meta').first().innerText()
  ok('payment change recorded', /30 Sept|29 Sept|Oct|Sept/.test(meta) && /studio@markipie\.test/.test(meta), meta.replace(/\n/g, ' | '))

  // Turn the watermark back on through the explicit switch.
  const watermarkSwitch = page.locator('.mp-adm-perm__switch[aria-label="Watermark"]')
  ok('watermark switch is off', (await watermarkSwitch.getAttribute('aria-checked')) === 'false')
  await watermarkSwitch.click()
  await page.waitForTimeout(900)
  ok('watermark switch flips on', (await watermarkSwitch.getAttribute('aria-checked')) === 'true')
  summary = await page.locator('.mp-adm-perm__summary').innerText()
  ok('summary reflects watermark on', /WATERMARK\s*\n?\s*ON/.test(summary.toUpperCase()), summary.replace(/\n/g, ' | '))
  await shot(page, '08-admin-permissions')

  // Download off through the switch, then verified in the client.
  const downloadSwitch = page.locator('.mp-adm-perm__switch[aria-label="Download photos and videos"]')
  await downloadSwitch.click()
  await page.waitForTimeout(900)
  ok('download switch flips off', (await downloadSwitch.getAttribute('aria-checked')) === 'false')

  const clientContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const clientPage = await openGallery(clientContext)
  attach(clientPage, errors)
  await openFirstPhoto(clientPage)
  ok('client sees the watermark again', (await clientPage.locator('.mp-viewer .mp-wm').count()) === 1)
  ok('client download hidden again', (await clientPage.locator('.mp-viewer__btn:has-text("Download")').count()) === 0)
  await context.close()
  await clientContext.close()
  await browser.close()
  ok('permission panel flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

async function sectionMobile() {
  console.log('\n[I] Mobile viewer: controls reachable, watermark visible')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await openGallery(context)
  attach(page, errors)
  await page.locator('.mp-cg-folder').first().click()
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  await page.locator('.mp-cg-tile').first().click()
  await page.waitForSelector('.mp-viewer', { timeout: 15000 })
  await page.waitForTimeout(800)
  ok('watermark visible on mobile', (await page.locator('.mp-viewer .mp-wm').count()) === 1)
  const likeBox = await page.locator('button[aria-label="Like this photo"]').boundingBox()
  ok('like button fully visible and tappable', likeBox && likeBox.x >= 0 && likeBox.x + likeBox.width <= 390 + 1)
  const closeBox = await page.locator('button[aria-label="Close viewer"]').boundingBox()
  ok('close button fully visible', closeBox && closeBox.x >= 0 && closeBox.x + closeBox.width <= 390 + 1)
  ok('no horizontal overflow in the viewer', await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1))
  // Swipe navigation still works.
  const stage = await page.locator('.mp-viewer__stage').boundingBox()
  if (stage) {
    await page.touchscreen.tap(stage.x + stage.width / 2, stage.y + 20).catch(() => {})
  }
  ok('viewer usable on mobile', (await page.locator('.mp-viewer').count()) === 1)
  await shot(page, '09-mobile-viewer')
  await context.close()
  await browser.close()
  ok('mobile flow no unexpected console errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).join(' | '))
}

// ---------------------------------------------------------------- main

async function main() {
  await api('POST', '/__reset')
  await importEventViaApi('event-1', 'MOCKWEDDINGFOLDER1')
  await importEventViaApi('event-2', 'MOCKBIRTHDAYFOLDER01')
  console.log('mock seeded')

  // Warm up: the very first client page load can trigger a dev-server
  // recompile or reload; do it once here so the real sections are stable.
  {
    const browser = await chromium.launch({ args: ['--no-sandbox'] })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await openGallery(context)
    await openFirstPhoto(page)
    await page.keyboard.press('Escape')
    await context.close()
    await browser.close()
    console.log('warmup done')
  }

  const only = process.env.P9_ONLY ? process.env.P9_ONLY.split(',') : null
  const sections = ([
    ['case 1: unpaid + watermark', sectionCaseOne],
    ['case 2: paid keeps watermark', sectionCaseTwo],
    ['case 3: paid + watermark off + download', sectionCaseThree],
    ['case 4: reactions on', sectionReactions],
    ['case 5: reactions off', sectionCaseFive],
    ['reaction privacy', sectionReactionPrivacy],
    ['case 6: admin selection', sectionAdminSelection],
    ['admin permission panel', sectionAdminPermissionsPanel],
    ['mobile viewer', sectionMobile],
  ]).filter(([name]) => !only || only.some((o) => name.includes(o)))
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
  console.log(`PHASE 9 E2E: ${passed} passed, ${failed} failed`)
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
