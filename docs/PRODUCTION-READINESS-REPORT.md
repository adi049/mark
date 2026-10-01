# MARKIPIE — Production Readiness Report (Phase 11)

Date: 30 September 2026 · Scope: real connection, security, database activation, end-to-end functionality. No redesign; existing features preserved.

---

## Verdict up front

**The application code is production-ready. The system is not yet live** because three things only the owner can provide are still missing: a real Supabase project, Google Cloud OAuth credentials, and the production domain/hosting. Everything code-side that Phase 11 asked for is implemented, and the full test matrix passes: **363 e2e assertions, 0 failures** (against the mock backend that mirrors the production contracts).

---

## 1. Build status — PASS

- `npm install` clean · `npm run build` succeeds (Vite 7.3.6, ~8 s, 0 errors) · `npm run preview` serves the production build (verified live on :4173).
- `playwright` moved to `devDependencies` (e2e-only tooling; no app code imports it). No dependencies added or removed otherwise.

## 2. Supabase status — SCHEMA COMPLETE, NOT CONNECTED

- 7 migrations in `supabase/migrations/` (0001 schema + RLS … **0007 new: `drive_oauth_states`**) cover every table: admins, clients, events, event_folders, media, reactions, blogs, services, marketing_services, drive_connections, drive_jobs, face_embeddings, payment/album-selection columns, Instagram-gate fields. Primary keys, FKs, timestamps, status fields, unique constraints (blog/service slugs, `media (event_id, external_file_id)` dedupe, `reactions (media_id, session_id)`) are all in place.
- **No real Supabase project is connected** — there is no `.env` (by design; the file is git-ignored). The site honestly renders its unconfigured state until the owner adds credentials. **Not testable against the real service until the owner creates the project** — see §18.

## 3. Admin Auth status — IMPLEMENTED, VERIFIED (mock)

- `/admin` → Supabase Auth login → `/admin/dashboard`; all eight admin routes redirect unauthenticated users to login; logout invalidates the session; refresh preserves it. Authorization = authenticated user **+ row in `admins`** (`admin_check()` / `is_admin()`); non-admin authenticated users are rejected (tested). No privilege escalation from the frontend is possible: admin RPCs re-verify `is_admin()` server-side.

## 4. RLS status — AUDITED, HARDENED

- Every table has RLS enabled. Studio tables: admin-only policies (`is_admin()`), no anon policies. Public content: select-only on `published = true` blogs / `active = true` services+marketing. Gallery data flows through `security definer` RPCs gated by event code/QR token with active-status checks. **Zero `USING (true)` policies exist anywhere.**
- New: `drive_oauth_states` — RLS on, **no policies** (service-role only), so OAuth state rows are unreachable by anon/authenticated roles.

## 5. Google Drive status — SECURITY-HARDENED, VERIFIED (mock)

Two real vulnerabilities found in the audit were fixed:

| Issue | Fix |
| --- | --- |
| **OAuth `state` was the predictable return URL**, and `/auth/start` never verified an admin started the flow — anyone could connect *their* Google account to the studio | New `POST /auth/begin` (admin JWT required) generates a 32-byte CSPRNG state, stores only its SHA-256 hash in `drive_oauth_states` bound to the admin user id, site origin and a 10-minute expiry. The callback validates hash + expiry + **one-time use** (marked used before the token exchange, so replay is impossible) |
| **Callback redirected to the edge function's own origin** — broken in production where the site and Supabase are on different domains | Callback now redirects only to the site origin captured at `/auth/begin` time from the authenticated request, with a path-only `return_to` (no `//`, must start with `/`) |

Verified in-browser: connect flow completes; anonymous `/auth/begin` → 401; unknown/replayed state → 410 with a plain-HTML explanation. Import dedupe (unique `external_file_id`), sync (renames updated, deletions marked unavailable), empty folders, API errors, token refresh all remain covered by the e2e suites. Client never opens Google Drive; media streams through the edge function only.

## 6. Event Code status — VERIFIED

Code lookup (`lookup_event_by_code`) enforces active status; invalid codes show a clear error; inactive/archived events expose nothing (tested in phases 7/8).

## 7. QR status — VERIFIED

QR encodes only `{site}/client-access?event={qr_token}` — a route + opaque token, no credentials. Scanning opens MARKIPIE, resolves the event, and continues the normal access flow (gate, gallery).

## 8. Client Gallery status — VERIFIED + SERVER-SIDE GATE ADDED

**Third real vulnerability fixed:** `/media/:id?...&download=1` never checked `download_enabled` — downloads disabled in the UI were still downloadable by calling the URL directly. The edge function (and the mock, and a new regression test) now refuse with **403** server-side. Media URLs expose only the internal media id + event code; Drive file ids/URLs stay server-side; watermark is an overlay and is independent of payment status (no auto-removal on PAID — verified in code and tests).

## 9–16. Face Scan / Instagram Gate / Watermark / Downloads / Reactions / Album Selection / Blogs / Services+Marketing — VERIFIED (mock)

- **Face scan**: live camera only (no upload), open-source face-api in the browser, event-scoped, camera stopped and video element removed after capture, all states (loading, permission-denied, no-face, two-faces, no-match, results) — 30+ assertions in phase 7, all passing.
- **Instagram gate**: event-level on/off, 5-4-3-2-1 countdown, external profile open, fallback, return to gallery; when off, nothing shows; **no verification claims** (copy checked).
- **Reactions**: session-scoped per event via `set_reaction` RPC (one session's reaction never appears as another's); event-gated, `like/dislike` validated, duplicate-safe upsert.
- **Album selection**: admin "mark for album" on media rows with RPC audit fields (`album_selected_by/at`); client likes stay separate. No duplicate system created.
- **Blogs**: create → save → publish → public list → detail page; unpublished hidden; slugs unique in schema; SEO metadata per page.
- **Services/Marketing**: single source of truth = database (admin pages write it, public pages read it with local fallback when unconfigured). No conflicting hardcoded+DB duplicates of the *same* content — the local files are clearly the fallback/seed catalogue, merged by slug.

## 17. Security issues fixed this phase

1. Predictable, unauthenticated OAuth state → CSPRNG state bound to admin, hashed at rest, expiring, single-use (**migration 0007 + edge function**).
2. Cross-origin redirect bug in the OAuth callback (would have 404'd in production).
3. Missing server-side download enforcement when downloads are disabled (now 403 at the media endpoint).
4. Hygiene: `.gitignore` now exactly `.env` / `.env.*` / `!.env.example`; `.env.example` clearly separates public `VITE_` variables from server-side secrets (which are documented as `supabase secrets set` only); e2e helpers updated to the real OAuth contract instead of a fake callback shortcut.

**Secret scan** (`service_role`, `client_secret`, `private_key`, `access_token`, `refresh_token`, `password`, `secret` across the whole repo): every hit is a safe server-side reference (`Deno.env.get` in the edge function), an env-var *name*, documentation, or test credentials in the mock. **No secret values exist anywhere in the repo.**

## Test evidence (all run this session, after every change)

| Suite | Result |
| --- | --- |
| Phase 7 — client access, Drive import/sync, face scan (camera streams), downloads, mobile | **76 / 76** (+2 new download-gate tests) |
| Phase 8 — event codes, Instagram gate, unconfigured states | **70 / 70** |
| Phase 9 — admin panel QA, reactions, photo selection, mobile | **67 / 67** |
| Phase 10 — production routes, SEO, responsive (320–1920 px), accessibility, 404, admin auth | **150 / 150** |
| **Total** | **363 passed, 0 failed** |

Two suite crashes during the session were environmental, not code: missing fake-camera files (`/tmp` is wiped between sessions — regenerated) and a zombie-chromium memory cascade that exhausted the 2 GB sandbox. After cleanup, every suite passes cleanly.

## 18. Remaining owner configuration — exactly what to enter, and where

| # | What | Where | How |
| --- | --- | --- | --- |
| 1 | **Supabase project** | supabase.com → new project | Create project, then run `supabase/migrations/0001`–`0007` (SQL editor or `supabase db push`) |
| 2 | **Frontend env** | `.env` (copy from `.env.example`) | `VITE_SUPABASE_URL=https://<ref>.supabase.co` · `VITE_SUPABASE_ANON_KEY=<anon key>` — never the service-role key |
| 3 | **First admin user** | Supabase Dashboard → Authentication → Users | Create the studio user, then insert its id into `public.admins` (the `handle_new_admin` trigger also supports self-service invites if configured) |
| 4 | **Google OAuth client** | Google Cloud Console → Credentials | OAuth client (Web application). Authorized redirect URI: `https://<ref>.supabase.co/functions/v1/drive/auth/callback`. Enable the Google Drive API |
| 5 | **Edge function secrets** | `supabase secrets set` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never in `.env`) |
| 6 | **Deploy edge function** | `supabase functions deploy drive --no-verify-jwt` | The function verifies admin JWTs itself on every admin endpoint |
| 7 | **Site hosting + domain** | Any static host (Vercel/Netlify/Cloudflare) | Build with the `.env` from step 2; set `SITE_URL` for the sitemap; then set `SITE.url` in `src/lib/constants.js` to activate canonical + og:url tags |
| 8 | Studio email (optional) | Admin settings / contact config | Still absent by design — never invented |

## Honest limitations

- "Verified" above means **verified against the mock backend**, which implements the same contracts (auth, RLS behaviour, RPC shapes, Drive endpoints, OAuth state machine). The real Supabase/Google services cannot be exercised until the owner completes §18 — that is a configuration dependency, not a code gap.
- Watermark is a browser overlay; the underlying image bytes stream through the gated endpoint (no Drive URL is ever exposed). Pixel-level server-side watermarking was not in the architecture and was not added.
- Contact-details settings remain draft-on-device (documented in the UI); the intro-animation setting is per-device by design.
- E2E face/media data is synthetic (public-domain portraits composited by the mock); the production site will show real studio media once the owner connects Drive.

---

## 19. Brand & design non-negotiables audit (final pass)

Searched the entire project (src, index.html, public, built dist) for every banned item; anything found was fixed, not documented.

| Rule | Search method | Result |
| --- | --- | --- |
| Purple gradients | grep purple/violet/hex codes + every gradient definition | **Clean.** No purple anywhere; all gradients are neutral skeleton sheens, the green scan line, the white intro shine and image scrims |
| Pill-shaped buttons | grep `999px`/`radius-full` + manual review of every hit | **Clean.** Text buttons are 6 px rounded rectangles; 999 px appears only on toggle switches, loading spinners, dots and circular icon-only buttons (standard primitives, not pill buttons) |
| Fake reviews | grep testimonial/review/clients say | **Clean.** No reviews or testimonials exist anywhere |
| Fake metrics / customer counters | grep counter/count-up + audit of every number shown | **Clean.** Only approved facts appear (1000+ weddings, 7+ years, 12 machines, in-house lab), rendered as a static editorial list with no animation |
| Vague hero text | manual review of hero | **Clean.** Hero names the three disciplines and a specific one-roof lead sentence |
| Emoji icons | Unicode-range grep of src and dist | **Clean in UI.** Site uses Lucide only; the two dist hits are supabase-js's ⚠️ and React Router's dev-only 👋 console messages (library internals, never rendered) |
| Em dashes | grep "—" across all src + rendered-page text checks | **Clean.** Zero em dashes in any page, component, description or alt text |
| Crazy scroll animations | grep useScroll/parallax + review | **Clean.** One subtle fade-rise Reveal (0.55 s, once per element, disabled under reduced motion) and the navbar shadow toggle; nothing else |
| AI-slop photos | asset review | **Clean.** All imagery is in-house abstract brand artwork; no stock or fake wedding photography |
| Cursor animations | grep mousemove/pointermove | **Clean.** None |
| "Made with AI" branding | word-bounded grep (made with, powered by, chatgpt, openai, claude, copilot) | **Clean.** Zero occurrences |

Fixed during this audit:

1. **Privacy Policy was a placeholder** (sections rendered "Pending content" panels, banned language). Rewritten with seven real sections and seventeen paragraphs that describe what the site actually does: event-code galleries, streamed media, browser-local face scan, no trackers, and contact via WhatsApp and Instagram only. Includes a "Last updated" line.
2. **Terms & Conditions was the same placeholder.** Rewritten with seven real sections covering bookings, offline payments, gallery access and code privacy, copyright with personal-use downloads, acceptable use, liability and governing law (Jaipur, Rajasthan). No invented emails, addresses, refund schedules or registration numbers.
3. **LegalPage component** no longer has a pending-panel fallback at all; it renders multi-paragraph sections only.
4. **Favicon set completed**: added a multi-size `favicon.ico` (16/32/48) and `favicon-32.png` generated from the official logo mark, alongside the existing 64 px PNG and 180 px apple-touch-icon. All four verified live (HTTP 200) and shipped in `dist`.

Verified items:

- **Custom domain configuration**: the mechanism is complete and tested. Setting `SITE_URL` at build time emits `sitemap.xml` with absolute URLs and appends the `Sitemap:` line to `robots.txt` (verified with a test-domain build, then rebuilt without it). Setting `SITE.url` in `src/lib/constants.js` activates canonical URLs and `og:url` (verified in Phase 11). The actual domain value is the owner's to provide; it is deliberately not invented. `robots.txt` disallows `/admin`.
- **No "Made with AI" branding**: confirmed absent from source and the production build.
- **Privacy Policy and Terms & Conditions**: real pages at `/privacy-policy` and `/terms-and-conditions`, verified in-browser (7 sections each, 15 to 17 paragraphs, zero pending panels, no em dashes), plus SEO metadata.
- Regression after all fixes: **Phase 10 e2e 150/150 passed** (route sweep, SEO, responsive 320 to 1920 px, accessibility, 404, admin auth).
