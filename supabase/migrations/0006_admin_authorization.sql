-- ============================================================================
-- Markipie migration 0006: admin authorization (Phase 10)
--
-- Two changes, both about the production behaviour of the admin panel:
--
-- 1. admin_check(): a tiny RPC the admin app calls to confirm that the
--    signed-in Supabase user is a Markipie admin (listed in public.admins).
--    Executable by any authenticated user, returns a plain boolean. A normal
--    authenticated user simply receives false; no data is exposed.
--
-- 2. Execute grants for the admin RPCs. Every admin function already guards
--    itself with public.is_admin() (raising 'Admin access required.' or
--    filtering to zero rows), but their execute privilege was revoked from
--    the authenticated role entirely, which meant the real admin panel could
--    not call them with a user session in production. Granting execute to
--    authenticated is safe because the body checks is_admin(); anonymous
--    stays revoked everywhere.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- admin_check()
-- ---------------------------------------------------------------------------
create or replace function public.admin_check()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

revoke execute on function public.admin_check() from anon;
grant execute on function public.admin_check() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPC grants (bodies already enforce is_admin())
-- ---------------------------------------------------------------------------
grant execute on function public.admin_media_overview() to authenticated;
grant execute on function public.admin_event_media_stats(uuid) to authenticated;
grant execute on function public.admin_event_media_list(uuid) to authenticated;
grant execute on function public.admin_store_face_embeddings(uuid, jsonb) to authenticated;
grant execute on function public.admin_clear_face_index(uuid) to authenticated;
grant execute on function public.admin_face_index_stats(uuid) to authenticated;
grant execute on function public.admin_set_payment_status(uuid, text) to authenticated;
grant execute on function public.admin_set_album_selection(uuid, uuid[], boolean) to authenticated;
grant execute on function public.admin_reaction_summary(uuid) to authenticated;

-- admin_email_or_default() stays revoked from anon and authenticated: it is
-- an internal helper used inside other admin functions only.

-- Client-facing functions keep their existing grants: lookup_event_by_code,
-- get_event_folders, get_event_subfolders, get_event_media, set_reaction and
-- search_event_faces run with the anon key and never check admin state.

-- ---------------------------------------------------------------------------
-- Deliberate admin membership
-- ---------------------------------------------------------------------------
-- Phase 2 shipped a trigger that added every new Supabase auth user to
-- public.admins automatically. With signups closed that was safe in
-- practice, but it made "has an account" mean "is an admin". Admin
-- membership is now a deliberate act: drop the auto-admin trigger. To make
-- someone an admin, create their auth user and insert their row into
-- public.admins (see supabase/README.md).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_admin();
