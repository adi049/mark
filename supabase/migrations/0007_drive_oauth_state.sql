-- ============================================================================
-- Markipie migration 0007: Drive OAuth state hardening (Phase 11)
--
-- The OAuth "state" parameter used to be the plain return URL, which is
-- predictable and not bound to anyone. It now is a cryptographically random
-- value whose SHA-256 hash is stored here, bound to the admin who started
-- the flow, with an expiry and single-use marker. The edge function:
--
--   POST /auth/begin  (admin JWT required)  → inserts a row, returns the
--                                            Google consent URL
--   GET  /auth/callback?code&state         → hash lookup, checks expiry and
--                                            used_at, marks the row used,
--                                            exchanges the code, redirects
--
-- Rows are readable and writable only through the service role (the edge
-- function); RLS is on with no policies so no anon/authenticated role can
-- touch them. Expired rows are pruned opportunistically on each /auth/begin.
-- ============================================================================

create table if not exists public.drive_oauth_states (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 of the random state value sent to Google, base64 encoded. The
  -- raw state never touches the database.
  state_hash text not null unique,
  -- Supabase auth user id of the admin who started the flow.
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  -- Site origin + safe relative path to return to after the callback.
  site_origin text not null,
  return_to text not null default '/admin/gallery',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists drive_oauth_states_expires_idx
  on public.drive_oauth_states (expires_at);

alter table public.drive_oauth_states enable row level security;

-- No policies on purpose: only the service role (the drive edge function)
-- reads or writes this table. Anonymous and authenticated roles get nothing.

comment on table public.drive_oauth_states is
  'Short-lived OAuth state values for the Drive connect flow; service role only.';
