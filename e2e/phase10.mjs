/**
 * Phase 10 end-to-end suite: final integration, polish, SEO, security and
 * deployment QA.
 *
 * Two targets:
 *   - http://localhost:4173  production build (vite preview) with the mock
 *     backend baked in: routing, public site, SEO, client access, mobile
 *     widths, accessibility.
 *   - http://localhost:5175  dev server with mock env: admin panel QA
 *     (login, authorization, pages, CRUD).
 *
 * Requires: mock on :54321 (seeded), dev server :5175, production preview
 * :4173, playwright in /home/user/node_modules.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const PREVIEW = 'http://localhost:4173'
const DEV = 'http://localhost:5175'
const API = 'http://localhost:54321'
const SHOTS = '/home/user/markipie/docs/phase-10'
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
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('54321')) {
      bucket.push(`http ${r.status()}: ${r.url().replace(PREVIEW, '').replace(DEV, '').slice(0, 90)}`)
    }
  })
}

function unexpectedErrors(errors) {
  return errors.filter(
    (e) =>
      !/GroupMarkerNotSet|software WebGL|GPU stall|favicon|net::ERR/i.test(e)
  )
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

/** Waits for the opening intro to finish (shell no longer inert). */
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

async function api(method, path, body, token) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function adminToken() {
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    email: 'studio@markipie.test',
    password: 'markipie-test-admin',
  }).then((r) => r.json())
  return login.access_token
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
    if (status.done) return status.result
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('import job timed out')
}

const PUBLIC_ROUTES = [
  { path: '/', title: 'MARKIPIE | Photography & Cinematography' },
  { path: '/about', title: 'About · MARKIPIE' },
  { path: '/services', title: 'Services · MARKIPIE' },
  { path: '/client-access', title: 'Client Access · MARKIPIE' },
  { path: '/gallery', title: 'Gallery · MARKIPIE' },
  { path: '/marketing', title: 'Marketing · MARKIPIE' },
  { path: '/blogs', title: 'Blogs · MARKIPIE' },
  { path: '/contact', title: 'Contact · MARKIPIE' },
  { path: '/privacy-policy', title: 'Privacy Policy · MARKIPIE' },
  { path: '/terms-and-conditions', title: 'Terms & Conditions · MARKIPIE' },
]

// ---------------------------------------------------------------- sections

async function sectionRouteSweep() {
  console.log('\n[A] Production route sweep (vite preview :4173)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  for (const route of PUBLIC_ROUTES) {
    await page.goto(PREVIEW + route.path, { waitUntil: 'networkidle' })
    await introDone(page)
    const hasContent = (await page.locator('#root > *').count()) > 0
    const shellVisible = (await page.locator('.mp-navbar').count()) > 0
    ok(`route ${route.path || '/'} renders`, hasContent && shellVisible, `content=${hasContent} navbar=${shellVisible}`)
    ok(`route ${route.path || '/'} title`, (await page.title()) === route.title, await page.title())
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth)
    ok(`route ${route.path || '/'} no horizontal overflow`, overflow <= 1, `overflow=${overflow}px`)
  }

  // Unknown route: 404 page, not a blank screen, not a redirect.
  await page.goto(PREVIEW + '/this-page-does-not-exist', { waitUntil: 'networkidle' })
  await introDone(page)
  const notFoundText = await page.locator('body').innerText()
  ok(
    'unknown route shows the not-found page',
    /not found|does not exist/i.test(notFoundText) && (await page.locator('.mp-navbar').count()) === 1,
    notFoundText.slice(0, 80)
  )
  ok('unknown route stays on the unknown url', page.url().includes('/this-page-does-not-exist'), page.url())
  ok('unknown route is noindex', (await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow')

  // Deep link refresh (SPA fallback on the preview server).
  await page.goto(PREVIEW + '/services', { waitUntil: 'networkidle' })
  await introDone(page)
  ok('deep link hard refresh works', (await page.locator('.mp-navbar').count()) === 1)

  ok('no failed asset requests', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await context.close()
  await browser.close()
}

async function sectionPublicSite() {
  console.log('\n[B] Public site QA (production build)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(PREVIEW + '/', { waitUntil: 'networkidle' })
  await introDone(page)

  // Navbar links
  const navLabels = await page.locator('.mp-navbar__nav a').allInnerTexts()
  for (const label of ['Home', 'About', 'Services', 'Gallery', 'Marketing', 'Blogs', 'Contact', 'Client Access']) {
    ok(`navbar has ${label}`, navLabels.some((t) => t.trim() === label), navLabels.join(','))
  }
  await page.locator('.mp-navbar__nav a', { hasText: 'Services' }).first().click()
  await page.waitForURL('**/services')
  await page.waitForTimeout(600)
  ok('navbar navigation works', (await page.title()) === 'Services · MARKIPIE', await page.title())

  // Hero on home
  await page.locator('.mp-navbar__nav a', { hasText: 'Home' }).first().click()
  await page.waitForURL(PREVIEW + '/')
  await page.waitForTimeout(600)
  ok('hero renders', (await page.locator('.mp-hero, [class*="hero"]').first().count()) === 1)

  // Packages show the exact studio prices. Groups render one at a time,
  // so walk the tabs and collect the visible text.
  await page.waitForSelector('.mp-packages__tabs button')
  const tabCount = await page.locator('.mp-packages__tabs button').count()
  let packagesText = ''
  for (let i = 0; i < tabCount; i += 1) {
    await page.locator('.mp-packages__tabs button').nth(i).click()
    await page.waitForTimeout(450)
    packagesText += `${await page.locator('.mp-packages').innerText()}\n`
  }
  for (const price of ['₹65,000', '₹90,000', '₹1,20,000', '₹1,85,000', '₹15,000', '₹35,000', '₹45,000', '₹25,000']) {
    ok(`package price ${price} present`, packagesText.includes(price))
  }
  ok('album upgrade price note present', packagesText.includes('₹18,000'))
  await shot(page, '01b-packages')

  // Floating contact buttons: exact official numbers
  const wa = page.locator('.mp-floating a[aria-label="Chat with Markipie on WhatsApp"]')
  ok('floating WhatsApp button', (await wa.count()) === 1 && (await wa.getAttribute('href')) === 'https://wa.me/918586000345', await wa.getAttribute('href'))
  const call = page.locator('.mp-floating a[aria-label*="Call Markipie"]')
  ok('floating call button', (await call.count()) === 1 && (await call.getAttribute('href')) === 'tel:8586000345', await call.getAttribute('href'))
  const ig = page.locator('.mp-floating a[aria-label="Markipie on Instagram"]')
  ok('floating Instagram button', (await ig.count()) >= 1 && (await ig.getAttribute('href')) === 'https://www.instagram.com/markipieofficial/', await ig.getAttribute('href'))
  await shot(page, '01-public-home')

  // Footer: all columns link to real routes
  await page.locator('.mp-footer__link').filter({ hasText: 'Privacy Policy' }).first().click()
  await page.waitForURL('**/privacy-policy')
  await page.waitForFunction(() => document.title === 'Privacy Policy · MARKIPIE', null, { timeout: 10000 })
  ok('footer privacy link works', (await page.title()) === 'Privacy Policy · MARKIPIE')
  await page.locator('.mp-footer__link').filter({ hasText: 'Terms' }).first().click()
  await page.waitForURL('**/terms-and-conditions')
  await page.waitForFunction(() => document.title === 'Terms & Conditions · MARKIPIE', null, { timeout: 10000 })
  ok('footer terms link works', (await page.title()) === 'Terms & Conditions · MARKIPIE')
  const footerText = await page.locator('.mp-footer').innerText()
  ok('footer shows official phone and Instagram handle', footerText.includes('8586000345') && footerText.includes('@markipieofficial'))

  // No email invented
  ok('no invented email address', !/@(gmail|yahoo|outlook|hotmail)\./i.test(await page.locator('body').innerText()))

  // Contact page has the working channels
  await page.goto(PREVIEW + '/contact', { waitUntil: 'networkidle' })
  const contactText = await page.locator('body').innerText()
  ok('contact page shows WhatsApp number', contactText.includes('8586000345'))
  const contactIg = await page.locator('a[href*="instagram.com/markipieofficial"]').count()
  ok('contact page links Instagram', contactIg >= 1)
  await shot(page, '02-public-contact')

  // Mobile menu at 390px
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mpage = await mobile.newPage()
  attach(mpage, errors)
  await mpage.goto(PREVIEW + '/', { waitUntil: 'networkidle' })
  await introDone(mpage)
  ok('mobile menu toggle visible', (await mpage.locator('.mp-navbar__toggle').count()) === 1)
  await mpage.locator('.mp-navbar__toggle').click()
  await mpage.waitForSelector('.mp-mobile-menu')
  const mobileLinks = await mpage.locator('.mp-mobile-menu__nav a').allInnerTexts()
  ok('mobile menu lists the sections', mobileLinks.length >= 8, mobileLinks.join(','))
  await mpage.locator('.mp-mobile-menu__nav a', { hasText: 'Gallery' }).first().click()
  await mpage.waitForURL('**/gallery')
  await mpage.waitForFunction(() => document.title === 'Gallery · MARKIPIE', null, { timeout: 10000 })
  ok('mobile menu navigation works', (await mpage.title()) === 'Gallery · MARKIPIE')
  const mobileOverflow = await mpage.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth)
  ok('no horizontal overflow on mobile gallery', mobileOverflow <= 1, `${mobileOverflow}px`)
  await shot(mpage, '03-mobile-menu')
  await mobile.close()

  ok('public site no unexpected errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await context.close()
  await browser.close()
}

async function sectionSeo() {
  console.log('\n[C] SEO, favicon, robots, sitemap')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(PREVIEW + '/', { waitUntil: 'networkidle' })
  await introDone(page)

  // Home metadata
  ok('home title exact', (await page.title()) === 'MARKIPIE | Photography & Cinematography', await page.title())
  ok('home meta description set', ((await page.locator('meta[name="description"]').getAttribute('content')) || '').length > 60)
  ok('og:title set', (await page.locator('meta[property="og:title"]').getAttribute('content')) === 'MARKIPIE | Photography & Cinematography')
  ok('og:description set', ((await page.locator('meta[property="og:description"]').getAttribute('content')) || '').length > 60)
  ok('og:image points at brand asset', (await page.locator('meta[property="og:image"]').getAttribute('content')).includes('og-image'))
  ok('twitter card set', (await page.locator('meta[name="twitter:card"]').getAttribute('content')) === 'summary_large_image')
  ok('og:type website', (await page.locator('meta[property="og:type"]').getAttribute('content')) === 'website')

  // Page-specific titles already swept in [A]; verify og:url behavior and
  // blog article type here.
  await page.goto(PREVIEW + '/blogs', { waitUntil: 'networkidle' })
  const blogLinks = await page.locator('a[href^="/blogs/"]').allInnerTexts()
  ok('blogs list has posts', blogLinks.length >= 1, blogLinks.join(','))
  if (blogLinks.length) {
    await page.locator('a[href^="/blogs/"]').first().click()
    await page.waitForURL('**/blogs/**')
    await page.waitForTimeout(600)
    const articleTitle = await page.title()
    ok('blog post gets its own title', articleTitle.includes('· MARKIPIE') && articleTitle !== 'Blogs · MARKIPIE', articleTitle)
    ok('blog post og:type article', (await page.locator('meta[property="og:type"]').getAttribute('content')) === 'article')
  }

  // Admin is noindex
  await page.goto(DEV + '/admin', { waitUntil: 'networkidle' })
  ok('admin marked noindex', (await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow')

  // Static assets served
  for (const asset of ['/robots.txt', '/favicon.png', '/assets/brand/apple-touch-icon.png', '/assets/brand/og-image.png']) {
    const status = await fetch(PREVIEW + asset).then((r) => r.status)
    ok(`asset ${asset} served`, status === 200, `status ${status}`)
  }
  const robots = await fetch(PREVIEW + '/robots.txt').then((r) => r.text())
  ok('robots disallows /admin', /Disallow: \/admin/.test(robots), robots.replace(/\n/g, ' | '))

  // Build outputs on disk
  const distIndex = fs.readFileSync('/home/user/markipie/dist/index.html', 'utf8')
  ok('index.html has the brand title', distIndex.includes('MARKIPIE | Photography &amp; Cinematography'))
  ok('index.html has theme-color', distIndex.includes('theme-color'))
  ok('index.html has apple-touch-icon', distIndex.includes('apple-touch-icon'))
  ok('no sitemap without SITE_URL', !fs.existsSync('/home/user/markipie/dist/sitemap.xml'))
  const chunks = fs.readdirSync('/home/user/markipie/dist/assets').filter((f) => f.endsWith('.js'))
  ok('face-api ships as its own chunk', chunks.some((f) => f.startsWith('face-api-')))
  ok('public entry chunks stay small', chunks.filter((f) => f.startsWith('index-')).every((f) => fs.statSync(`/home/user/markipie/dist/assets/${f}`).size < 300_000))

  ok('seo section no unexpected errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await context.close()
  await browser.close()
}

async function sectionAdmin() {
  console.log('\n[D] Admin QA (dev server, real UI flows)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  // Hidden entrance: three logo clicks on the public navbar.
  await page.goto(DEV + '/', { waitUntil: 'networkidle' })
  await introDone(page)
  const logo = page.locator('.mp-navbar__brand, .mp-navbar a[aria-label="Markipie, home"]').first()
  await logo.click()
  await logo.click()
  await logo.click()
  await page.waitForURL('**/admin', { timeout: 10000 })
  ok('three logo clicks open the admin entrance', page.url().endsWith('/admin'))

  // Login screen shows no admin data before authentication.
  await page.waitForSelector('input[name="email"]', { timeout: 15000 })
  ok('login screen renders', (await page.locator('input[name="email"]').count()) === 1)

  // Non-admin user is rejected.
  await page.fill('input[name="email"]', 'client@markipie.test')
  await page.fill('input[name="password"]', 'markipie-test-client')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1500)
  ok('non-admin login rejected with a message', (await page.locator('text=does not have admin access').count()) === 1)
  await page.goto(DEV + '/admin/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  ok('non-admin cannot open a protected route', page.url().endsWith('/admin'))

  // Real admin login.
  await page.fill('input[name="email"]', 'studio@markipie.test')
  await page.fill('input[name="password"]', 'markipie-test-admin')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
  ok('admin login reaches the dashboard', page.url().includes('/admin/dashboard'))

  // Every admin section renders.
  const sections = [
    ['clients', 'Add Client'],
    ['events', 'Add Event'],
    ['gallery', 'Gallery'],
    ['blogs', 'Blogs'],
    ['services', 'Services'],
    ['marketing', 'Marketing'],
    ['settings', 'Settings'],
  ]
  for (const [slug, marker] of sections) {
    await page.goto(DEV + `/admin/${slug}`, { waitUntil: 'domcontentloaded' })
    let rendered = true
    try {
      await page.waitForSelector(`text=${marker}`, { timeout: 15000 })
    } catch {
      rendered = false
    }
    ok(`admin ${slug} renders`, rendered && (await page.url()).includes(`/admin/${slug}`), `url=${page.url()}`)
  }
  await shot(page, '04-admin-dashboard')

  // Client CRUD through the real UI.
  await page.goto(DEV + '/admin/clients', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button:has-text("Add Client")', { timeout: 20000 })
  await page.locator('button:has-text("Add Client")').first().click()
  await page.waitForSelector('.mp-adm-modal, [role="dialog"]')
  await page.locator('.mp-field:has-text("Client Name") input').fill('Phase Ten Client')
  await page.locator('.mp-field:has-text("Phone") input').fill('9876543210')
  await page.locator('.mp-adm-modal button[type="submit"]').first().click()
  await page.waitForFunction(() => document.body.innerText.includes('Phase Ten Client'), null, { timeout: 15000 })
  ok('client created via UI', true)

  const editBtn = page.locator(`button[aria-label="Edit Phase Ten Client"]`)
  ok('edit action available', (await editBtn.count()) === 1)
  await editBtn.click()
  await page.waitForSelector('.mp-adm-modal, [role="dialog"]')
  await page.locator('.mp-field:has-text("Client Name") input').fill('Phase Ten Client Edited')
  await page.locator('.mp-adm-modal button[type="submit"]').first().click()
  await page.waitForFunction(() => document.body.innerText.includes('Phase Ten Client Edited'), null, { timeout: 15000 })
  ok('client edited via UI', true)

  await page.locator('button[aria-label="Delete Phase Ten Client Edited"]').click()
  await page.waitForSelector('button:has-text("Delete client")')
  await page.locator('button:has-text("Delete client")').click()
  await page.waitForFunction(() => !document.body.innerText.includes('Phase Ten Client'), null, { timeout: 15000 })
  ok('client deleted via UI', true)

  // Event CRUD through the real UI: create one for the seeded couple, edit
  // its name, then delete it again.
  await page.goto(DEV + '/admin/events', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button:has-text("Add Event")', { timeout: 20000 })
  await page.locator('button:has-text("Add Event")').first().click()
  await page.waitForSelector('.mp-adm-modal')
  const clientSelect = page.locator('.mp-adm-modal select').first()
  await clientSelect.selectOption({ label: 'Rahul and Priya Sharma' })
  await page.locator('.mp-field:has-text("Event Name") input').fill('Phase Ten Event')
  await page.locator('.mp-adm-modal button[type="submit"]').first().click()
  await page.waitForFunction(() => document.body.innerText.includes('Phase Ten Event'), null, { timeout: 15000 })
  ok('event created via UI', true)
  await page.locator('button[aria-label="Edit Phase Ten Event"]').click()
  await page.waitForSelector('.mp-adm-modal')
  await page.locator('.mp-field:has-text("Event Name") input').fill('Phase Ten Event Edited')
  await page.locator('.mp-adm-modal button[type="submit"]').first().click()
  await page.waitForFunction(() => document.body.innerText.includes('Phase Ten Event Edited'), null, { timeout: 15000 })
  ok('event edited via UI', true)
  await page.locator('button[aria-label="Delete Phase Ten Event Edited"]').click()
  const confirmEventDelete = page.locator('button:has-text("Delete event"), button:has-text("Delete Event")')
  await confirmEventDelete.first().click()
  await page.waitForFunction(() => !document.body.innerText.includes('Phase Ten Event'), null, { timeout: 15000 })
  ok('event deleted via UI', true)

  // QR access: the events list opens a QR modal per event.
  const qrButton = page.locator('button[aria-label*="QR"], .mp-adm-iconbtn:has(.lucide-qr-code)').first()
  await qrButton.click()
  await page.waitForSelector('.mp-qr', { timeout: 10000 })
  ok('event QR modal renders with a code', (await page.locator('.mp-qr').count()) >= 1)
  await shot(page, '05b-event-qr')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // Event gallery page: all panels present.
  await page.goto(DEV + '/admin/gallery/event-1', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.mp-adm-perm', { timeout: 30000 })
  await page.waitForTimeout(1200)
  ok('event gallery shows permissions panel', (await page.locator('.mp-adm-perm').count()) === 1)
  ok('event gallery shows photo selection panel', (await page.locator('.mp-adm-sel').count()) === 1)
  ok('event gallery shows face index panel', (await page.locator('.mp-adm-face').count()) >= 1)
  ok('event gallery shows drive panel', (await page.locator('.mp-adm-drive').count()) >= 1)
  await shot(page, '05-admin-event-gallery')

  // Logout closes the session.
  await page.locator('.mp-adm-side__logout').first().click()
  await page.waitForTimeout(1200)
  ok('logout returns to the login screen', page.url().endsWith('/admin') && (await page.locator('input[name="email"]').count()) === 1)
  await page.goto(DEV + '/admin/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  ok('protected route after logout bounces to login', page.url().endsWith('/admin'))

  ok('admin section no unexpected errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await context.close()
  await browser.close()
}

async function sectionClientAccess() {
  console.log('\n[E] Client access QA (production build)')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  let page = await context.newPage()
  attach(page, errors)

  // Each attempt gets a fresh page: the client session lives in
  // sessionStorage and the code form keeps its state on same-route loads.
  const openEntry = async () => {
    await page.close()
    page = await context.newPage()
    attach(page, errors)
    await page.goto(PREVIEW + '/client-access', { waitUntil: 'networkidle' })
    await introDone(page)
    await page.waitForSelector('input[name="event-code"]')
  }

  // Invalid code
  await openEntry()
  await page.fill('input[name="event-code"]', 'MP-WRONG')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(900)
  ok('invalid code shows a friendly error', /invalid|not found|no event/i.test(await page.locator('body').innerText()))

  // Inactive event (event-3 is active in the seed; make it inactive like
  // the phase 8 suite does, then put it back)
  const token = await adminToken()
  await api('PATCH', '/rest/v1/events?id=eq.event-3', { status: 'inactive' }, token)
  await openEntry()
  await page.fill('input[name="event-code"]', 'MP-3QB8VN')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(900)
  ok(
    'inactive event is rejected like an invalid code',
    /invalid|not found|no event/i.test(await page.locator('body').innerText()) && !(await page.locator('.mp-ig').count()) && !(await page.locator('.mp-cg-folder').count())
  )
  await api('PATCH', '/rest/v1/events?id=eq.event-3', { status: 'active' }, token)

  // Valid event: gate, countdown, continue, folders, viewer
  await openEntry()
  await page.fill('input[name="event-code"]', 'MP-4K7RQP')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.mp-ig', { timeout: 20000 })
  ok('instagram gate appears', (await page.locator('.mp-ig').count()) === 1)
  await page.waitForSelector('.mp-ig__continue', { timeout: 25000 })
  await page.click('button:has-text("Continue to gallery")')
  await page.waitForSelector('.mp-cg-folder', { timeout: 30000 })
  ok('gallery folders render', (await page.locator('.mp-cg-folder').count()) === 5)
  await page.locator('.mp-cg-folder').first().click()
  await page.waitForSelector('.mp-cg-tile', { timeout: 30000 })
  ok('media grid renders thumbnails', (await page.locator('.mp-cg-tile').count()) > 3)
  await page.locator('.mp-cg-tile:not(:has(.mp-cg-tile__play))').first().click()
  await page.waitForSelector('.mp-viewer', { timeout: 15000 })
  await page.waitForTimeout(800)
  ok('viewer opens with watermark (unpaid default)', (await page.locator('.mp-viewer .mp-wm').count()) === 1)
  ok('like available', (await page.locator('button[aria-label="Like this photo"]').count()) === 1)
  await shot(page, '06-production-client-gallery')

  // Client never sees internal labels
  const galleryText = await page.locator('body').innerText()
  ok('client UI hides payment and admin internals', !/Payment status|Mark for album|In album|admin/i.test(galleryText))

  ok('client access no unexpected errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await context.close()
  await browser.close()
}

async function sectionMobileWidths() {
  console.log('\n[F] Responsive sweep across nine widths')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]
  const pages = ['/', '/services', '/contact', '/client-access']

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    attach(page, errors)
    let worst = 0
    for (const path of pages) {
      await page.goto(PREVIEW + path, { waitUntil: 'networkidle' })
      await introDone(page)
      const overflow = await page.evaluate(
        () => document.scrollingElement.scrollWidth - document.documentElement.clientWidth
      )
      worst = Math.max(worst, overflow)
    }
    ok(`width ${width}px: no horizontal overflow`, worst <= 1, `worst=${worst}px`)
    if (width === 320) {
      await page.goto(PREVIEW + '/', { waitUntil: 'networkidle' })
      await introDone(page)
      await shot(page, '07-smallest-width-320')
    }
    await context.close()
  }

  // Admin at a common laptop and small tablet width.
  const adm = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const apage = await adm.newPage()
  attach(apage, errors)
  await apage.goto(DEV + '/admin', { waitUntil: 'networkidle' })
  await apage.fill('input[name="email"]', 'studio@markipie.test')
  await apage.fill('input[name="password"]', 'markipie-test-admin')
  await apage.click('button[type="submit"]')
  await apage.waitForURL('**/admin/dashboard')
  const admOverflow = await apage.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth)
  ok('admin at 1280px: no horizontal overflow', admOverflow <= 1, `${admOverflow}px`)
  await shot(apage, '08-admin-1280')
  await adm.close()

  ok('responsive sweep no unexpected errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await browser.close()
}

async function sectionAccessibility() {
  console.log('\n[G] Accessibility spot checks')
  const errors = []
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attach(page, errors)

  await page.goto(PREVIEW + '/', { waitUntil: 'networkidle' })
  await introDone(page)

  // Skip link is the first focusable element.
  ok('skip link present', (await page.locator('.mp-skip-link').count()) === 1)
  await page.keyboard.press('Tab')
  const firstFocused = await page.evaluate(() => document.activeElement?.className || '')
  ok('first Tab stops on the skip link', firstFocused.includes('mp-skip-link'), firstFocused)

  // Keyboard navigation reaches the navbar.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const secondFocused = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim()}`)
  ok('keyboard reaches navbar controls', /A:|BUTTON:/.test(secondFocused), secondFocused)

  // Focus is visibly styled.
  const outline = await page.evaluate(() => {
    const el = document.activeElement
    const style = getComputedStyle(el)
    return `${style.outlineStyle} ${style.outlineWidth}`
  })
  ok('focused element has a visible outline', !/none 0px/.test(outline), outline)

  // Every image on the public pages has alt text.
  for (const path of ['/', '/about', '/services', '/gallery', '/blogs']) {
    await page.goto(PREVIEW + path, { waitUntil: 'networkidle' })
    await introDone(page)
    const missingAlt = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((img) => !img.hasAttribute('alt'))
        .map((img) => img.src.slice(-40))
    )
    ok(`all images have alt attributes on ${path}`, missingAlt.length === 0, missingAlt.join(','))
  }

  // Form fields are labelled.
  await page.goto(PREVIEW + '/client-access', { waitUntil: 'networkidle' })
  await introDone(page)
  const unlabelled = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input, textarea, select')]
    return inputs.filter((el) => {
      const id = el.getAttribute('id')
      const labelled =
        el.closest('label') ||
        (id && document.querySelector(`label[for="${id}"]`)) ||
        el.getAttribute('aria-label')
      return !labelled
    }).length
  })
  ok('client access form fields are labelled', unlabelled === 0, `${unlabelled} unlabelled`)

  // Reduced motion: the intro still completes and the site is usable.
  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const rpage = await reduced.newPage()
  attach(rpage, errors)
  await rpage.goto(PREVIEW + '/', { waitUntil: 'networkidle' })
  await introDone(rpage)
  ok('reduced motion: site renders and unlocks', (await rpage.locator('.mp-navbar').count()) === 1)
  await reduced.close()

  ok('accessibility no unexpected errors', unexpectedErrors(errors).length === 0, unexpectedErrors(errors).slice(0, 4).join(' | '))
  await context.close()
  await browser.close()
}

// ---------------------------------------------------------------- main

async function main() {
  // Fresh mock state with imported media for event-1.
  await api('POST', '/__reset')
  await importEventViaApi('event-1', 'MOCKWEDDINGFOLDER1')
  console.log('mock seeded')

  const sections = [
    ['route sweep', sectionRouteSweep],
    ['public site', sectionPublicSite],
    ['seo', sectionSeo],
    ['admin', sectionAdmin],
    ['client access', sectionClientAccess],
    ['mobile widths', sectionMobileWidths],
    ['accessibility', sectionAccessibility],
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
  console.log(`PHASE 10 E2E: ${passed} passed, ${failed} failed`)
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
