# Supabase setup for MARKIPIE

The database, authentication and row level security for the Markipie
platform. Migration `0001` holds the core schema, `0002` adds the Google
Drive gallery tables and functions, `0003` the face index, `0004` the
Instagram gate, `0005` payment status and album selection, and `0006`
admin authorization (the `admin_check()` RPC, execute grants for the admin
functions, and deliberate admin membership).

## First time setup

1. **Create the project** at [supabase.com](https://supabase.com)
   (New project). Note the region closest to your audience, for example
   Mumbai. Set a strong database password and keep it safe.

2. **Run the schema**. Open the Supabase dashboard, go to
   **SQL Editor**, and run every migration file in order:
   `supabase/migrations/0001_markipie_schema.sql` through
   `supabase/migrations/0006_admin_authorization.sql`. They create
   all tables, indexes, triggers, helper functions and RLS policies. They
   are safe to run more than once.

3. **Create the first admin user**. In the dashboard go to
   **Authentication > Users > Add user**, enter the studio email and a
   strong password, and create the user. Then make them an admin
   explicitly: in **Table editor > admins > Insert row**, set `user_id`
   to the new user's id and `email` to their address. Admin membership is
   a deliberate step: having a Supabase account alone never opens the
   admin panel (the app verifies with the `admin_check()` RPC).

   Keep public signups closed: **Authentication > Providers > Email**
   should stay invite-only (Confirm email can stay on; the admin creates
   users manually).

4. **Connect the website**. Copy `.env.example` to `.env.local` in the
   project root and fill in, from **Project Settings > API**:

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```

   Use the **anon public** key only. Never put the service role key in
   the frontend or in this file.

5. **Restart the dev server** (`npm run dev`). The admin panel at
   `/admin` (open it by clicking the site logo three times quickly) will
   switch from the setup notice to the login screen.

## How access control works

- Every table has row level security enabled.
- Admins are rows in `admins` linked to Supabase auth users. Only admins
  can read or write clients, events, folders, media and reactions.
- Anonymous visitors can only read published blogs and active services
  and marketing services.
- The Client Access code lookup calls the `lookup_event_by_code`
  function: a security definer that returns only the minimum fields of an
  active event that matches the typed code or QR token. Anonymous visitors
  can never list events or clients directly.

## Everyday operations

- **Add an admin**: Authentication > Users > Add user. The trigger adds
  them to `admins`.
- **Remove an admin**: delete the auth user (their `admins` row goes with
  it), or set `user_id` handling as needed.
- **Inspect data**: Table editor in the dashboard, or the admin panel.
- **Backup**: Database > Backups in the dashboard.

## What is stored where

| Table | Purpose |
| --- | --- |
| `admins` | Studio staff, synced from Supabase auth |
| `clients` | Clients and their access codes (`MP-XXXXXX`) |
| `events` | Client events, access codes, QR tokens, permission flags, Drive folder reference |
| `event_folders` | Imported Google Drive folder structure (sections and subfolders) |
| `media` | Imported Google Drive media metadata, keyed by `external_file_id` for duplicate protection |
| `reactions` | Client like/dislike on gallery media, one per visitor session |
| `drive_connections` | Google OAuth tokens for the studio account. Service role only: no RLS policies, no anon or authenticated access |
| `drive_jobs` | Import and sync job bookkeeping. Service role only |
| `blogs` | Journal posts, published or draft |
| `services` | Studio services |
| `marketing_services` | Marketing packages and starting prices |

## Google Drive gallery setup (Phase 6)

Event photos and videos are imported from the studio's Google Drive into
Supabase, and clients view them through the site. The client never sees
Google Drive: the browser only talks to the `drive` edge function below.

External setup that only the studio can perform:

1. **Google Cloud project**. Create one at
   [console.cloud.google.com](https://console.cloud.google.com) (for
   example "Markipie Studio").

2. **Enable the Google Drive API** for that project:
   **APIs and Services > Library > Google Drive API > Enable**.

3. **Create OAuth credentials**:
   **APIs and Services > Credentials > Create credentials > OAuth client
   ID**, application type **Web application**.

4. **Set the redirect URI** exactly to:

   ```
   https://<project-ref>.supabase.co/functions/v1/drive/auth/callback
   ```

   Replace `<project-ref>` with your Supabase project reference.

5. **Configure the consent screen**
   (APIs and Services > OAuth consent screen). Add the scope
   `https://www.googleapis.com/auth/drive.readonly` (view only). The
   studio Google account that owns the event folders is the only account
   that needs to consent. Publishing the app is not required while only
   studio accounts connect, but Google may show an unverified-app warning
   in testing mode.

6. **Store the secrets in Supabase** (never in the frontend):

   ```
   supabase secrets set GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
   supabase secrets set GOOGLE_CLIENT_SECRET=<client secret>
   ```

   The service role key is provided to functions automatically by
   Supabase; do not set or share it anywhere else.

7. **Deploy the edge function**:

   ```
   supabase functions deploy drive --no-verify-jwt
   ```

   `--no-verify-jwt` is used because the OAuth callbacks and media
   streaming are called without a Supabase session; every admin endpoint
   verifies the caller's JWT itself.

The website needs nothing new: it talks to the function through the
existing `VITE_SUPABASE_URL`. Optionally, `VITE_DRIVE_API_URL` can point
the frontend at a different deployment of the same API contract
(for local development or a self hosted function). `VITE_GOOGLE_CLIENT_ID`
is not used by the app; the client id lives server side only.

### What the edge function does

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/begin` | admin-authenticated; creates a single-use OAuth state and returns the Google consent URL |
| `GET /auth/callback` | validates the state (hash, expiry, one-time), then token exchange and storage in `drive_connections` |
| `GET /status` | is the studio account connected, and as whom |
| `POST /disconnect` | forget the connection |
| `POST /verify-folder` | validates a pasted link and reads folder stats |
| `POST /import` | imports folder structure and media metadata as a job |
| `POST /sync` | re-reads the folder, adds new files, marks removed ones unavailable |
| `GET /jobs/:id` | import or sync progress for the admin UI |
| `GET /media/:id?t=&v=` | streams media bytes to the client gallery, gated by event code or QR token |

Security notes:

- Only `drive.readonly` is requested. No Gmail, no Contacts, no write
  access to Drive.
- Google tokens live in `drive_connections`, which the anon and
  authenticated roles cannot read. The frontend never sees them.
- The OAuth `state` is a cryptographically random value bound to the admin
  who started the flow (`drive_oauth_states`, service-role only, ten minute
  expiry, single use). A predictable return URL is never used as state, and
  the callback redirects only to the site origin captured at begin time.
- `/media/:id?...&download=1` is refused server-side (403) when the event
  has downloads disabled; hiding the button in the UI is never the only
  gate.
- Media URLs carry only the internal media id and the event code. The
  underlying Drive file id and URL stay server side.
- Re-importing the same folder inserts nothing (unique on
  `external_file_id`); sync never deletes rows, it only marks removed
  files `unavailable`.
- Original Drive files are never modified. Watermarks are drawn in the
  browser as an overlay.
