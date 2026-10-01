# MARKIPIE Website

The Markipie website and studio platform: a premium, editorial, light identity
for a photography, cinematography, wedding, event and creative digital
services studio, with a complete client gallery delivery system behind it.

**Status:** all core development phases complete. The public website, admin
panel, Supabase data layer, Google Drive import, event codes with QR access,
AI face scan, Instagram gate with countdown, watermark and download
permissions, like/dislike reactions, album selection and payment status
labels are implemented and covered by automated end-to-end suites.

## What is inside

| Area | Contents |
| ------------------ | -------------------------------------------------------- |
| Public site | Home, About, Services, Gallery, Marketing, Blogs, Contact, Privacy Policy, Terms & Conditions, opening intro animation |
| Client access | Event code entry, QR deep links, Instagram gate with countdown, session handling (6 hours), folder galleries, photos and videos |
| Viewer | Watermark per event permission, download per event permission, like/dislike, fullscreen, swipe on mobile |
| Face scan | In-browser face detection and recognition, per-event face index, match gallery |
| Admin panel | Hidden entrance (three logo clicks), Supabase auth with admin verification, clients, events, permissions, Drive import and sync, gallery, face index, photo selection, payment status, blogs, services, marketing, settings |
| Backend | Supabase Postgres schema with row level security, RPCs, and a Deno edge function for Google Drive |

## Quick start

```bash
npm install
cp .env.example .env    # then fill in the Supabase values (below)
npm run dev
```

The dev server starts at `http://localhost:5173`. The public site works
without any environment variables (the client platform simply reports that
Supabase is not configured yet).

## Scripts

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Serve the production build locally   |

## Tech stack

| Package                   | Version | Role                                        |
| ------------------------- | ------- | ------------------------------------------- |
| react, react-dom          | 19.3    | UI runtime                                  |
| react-router-dom          | 7.18    | Routing, layouts, nested admin routes       |
| framer-motion             | 13.4    | Subtle route fades and card reveals         |
| lucide-react              | 1.48    | Interface icons                             |
| @supabase/supabase-js     | 2.109   | Database, auth and storage client           |
| @vladmandic/face-api      | 1.7.15  | Face detection and recognition (in-browser) |
| qrcode                    | 1.5.4   | QR generation for event codes (admin)       |
| vite, @vitejs/plugin-react | 7.3 / 5.2 | Build tooling                             |

Styling is plain CSS driven by design tokens (`src/styles/variables.css`).
No UI framework, no CSS-in-JS.

## Environment variables

Everything lives in `.env` (git-ignored). See `.env.example` for the full
annotated list. Summary:

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `VITE_SUPABASE_URL` | frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | frontend | Public anon key; row level security protects the data |
| `VITE_DRIVE_API_URL` | frontend, optional | Override for the Drive edge function base URL |
| `VITE_GOOGLE_CLIENT_ID` | frontend, optional | Reserved for future client-side Google features |
| `SITE_URL` | build only | Final domain, for example `https://markipie.com`. When set, `npm run build` emits `sitemap.xml` with absolute URLs and points `robots.txt` at it |

Never place the Supabase service role key, Google client secret or any
private credential in a `VITE_` variable: everything prefixed `VITE_` is
embedded in the public bundle.

## Supabase setup

Detailed, current instructions are in `supabase/README.md`. In short:

1. Create a Supabase project.
2. Run the migrations in order (`supabase/migrations/0001` through `0006`)
   in the SQL editor or via the CLI. They create the schema, row level
   security policies, and all RPCs.
3. Disable public signups (Authentication > Providers > Email) and create
   the admin user manually (Authentication > Users > Add user).
4. Make the user an admin explicitly: insert their `user_id` and `email`
   into the `public.admins` table (Table editor > admins). Admin
   membership is deliberate; an account alone never opens the panel.
5. Set the frontend env vars and deploy.

How access control works:

- Anonymous visitors can only call the public RPCs (`lookup_event_by_code`,
  `get_event_folders`, `get_event_subfolders`, `get_event_media`,
  `set_reaction`, `search_event_faces`) with the anon key. Row level
  security denies every table read and write.
- Authenticated users can execute the admin RPCs, but every one of them
  checks `public.is_admin()` (membership in `public.admins`) and raises or
  returns nothing otherwise.
- The admin panel verifies each session with `admin_check()` before it
  admits the user, so logging into Supabase alone never opens the admin
  panel.

## Google Drive setup

The Drive integration runs as a Supabase edge function
(`supabase/functions/drive`). Setup:

1. Create a Google Cloud project and enable the Google Drive API.
2. Create an OAuth client (web application) for the studio.
3. Add the function's redirect URI to the authorized redirect URIs:
   `<SUPABASE_URL>/functions/v1/drive/auth/callback`.
4. Set the secrets on Supabase:
   `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`
   plus `SUPABASE_SERVICE_ROLE_KEY` (set automatically for internal
   functions in most projects).
5. In the admin panel: Events > connect Google Drive, paste the Drive
   folder URL, import, and later sync for new media.

The client secret and refresh token never reach the browser; the frontend
only talks to the edge function, which streams media through token-checked
proxy endpoints.

## Face AI setup

Face detection and recognition run entirely in the visitor's browser with
`@vladmandic/face-api`. The pretrained models ship with the site in
`public/models/` (tiny face detector, 68-point landmarks, face recognition).
No image or embedding ever leaves the browser except the per-event face
index the admin builds, which is stored in Supabase and only ever compared
inside the client's browser session. No configuration is required.

## Deployment

The site is a static SPA; any static host works (Vercel, Netlify, Cloudflare
Pages, or your own server behind nginx).

1. Set the environment variables for the build (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, and `SITE_URL` once the final domain is live).
2. Build: `npm run build`. Output lands in `dist/`.
3. Serve `dist/` with SPA fallback: every unknown path must return
   `index.html` so client-side routes work on a hard refresh. On Netlify
   this is automatic; on nginx use `try_files $uri /index.html;`.
4. Confirm `/robots.txt` and (with `SITE_URL` set) `/sitemap.xml` are
   served, and that `/admin` is disallowed.
5. Deploy the edge function to Supabase (`supabase functions deploy drive`)
   and set its secrets.

Admin access: open the site, click the logo in the navbar three times
quickly, and sign in with the admin user created during Supabase setup.

## Project structure

```
src/
  pages/          one file per route (public pages + admin pages)
  sections/       home and about page sections
  components/     navigation, gallery, facescan, admin, ui primitives
  layouts/        MainLayout (public shell) and AdminLayout
  hooks/          useAdminAuth, useEventGallery, useSEO, useSupabaseQuery
  lib/            supabase client, drive, faceEngine, eventPermissions, ...
  data/           site content (services, packages, marketing, facts)
  styles/         token-driven plain CSS, one file per component area
supabase/
  migrations/     0001-0006: schema, RLS, RPCs
  functions/drive/  Google Drive edge function (Deno)
  README.md       operational Supabase notes
e2e/              mock backend + phase-by-phase Playwright suites
docs/             phase documentation and screenshots
public/           brand assets, favicon, robots.txt, face models
```

## Verification

The `e2e/` directory contains the mock backend (`mock-supabase.mjs`) and
Playwright suites (`phase7.mjs`, `phase8.mjs`, `phase9.mjs`, `phase10.mjs`)
that exercise the real UI against the mock: client access, Instagram gate,
face scan with a fake camera, watermark/download/reaction permissions,
album selection, admin authorization and the final production build checks.
Run them with the mock and both dev servers up (see the header of each
suite).

## Content notes

- All studio numbers on the site (weddings covered, years, printing
  machines) and all package prices come directly from the studio. Nothing
  is invented.
- Email is intentionally absent until the studio supplies an address; the
  WhatsApp, call and Instagram links use the official contact numbers.
- Legal pages are structured shells ready for the final legal copy.
