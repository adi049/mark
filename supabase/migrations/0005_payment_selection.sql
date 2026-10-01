-- ============================================================================
-- MARKIPIE · migration 0005 · payment status + album selection (Phase 9)
--
-- Completes the permission system:
--   * Payment status is an admin-controlled label (unpaid / partial / paid).
--     No payment gateway is connected in this phase and no payment is ever
--     claimed to be provider-verified. Payment status is information only:
--     it never changes the watermark or any other permission by itself.
--   * Basic audit fields for payment and permission changes.
--   * Internal album selection on media rows: the studio's own "mark for
--     album" choice, entirely separate from client like/dislike reactions.
--   * Admin RPCs for payment status, album selection and the aggregated
--     reaction summary used by the photo selection view.
-- ============================================================================

-- ------------------------------------------------------------- events ----
alter table public.events
  add column if not exists payment_status text not null default 'unpaid';

do $$
begin
  alter table public.events
    add constraint events_payment_status_check
    check (payment_status in ('unpaid', 'partial', 'paid'));
exception
  when duplicate_object then null;
end $$;

alter table public.events
  add column if not exists payment_updated_at timestamptz,
  add column if not exists payment_updated_by text,
  add column if not exists permissions_updated_at timestamptz,
  add column if not exists permissions_updated_by text;

-- --------------------------------------------------------------- media ----
-- One internal studio flag per photo. Independent of client reactions.
alter table public.media
  add column if not exists album_selected boolean not null default false,
  add column if not exists album_selected_at timestamptz,
  add column if not exists album_selected_by text;

-- ------------------------------------------------- helper: admin email ----
create or replace function public.admin_email_or_default()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.email from public.admins a where a.user_id = auth.uid() limit 1),
    'admin'
  );
$$;

-- ------------------------------------------------------ admin RPCs -------
-- Payment status. Admin-only, records who changed it and when.
create or replace function public.admin_set_payment_status(
  p_event_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_status is null or p_status not in ('unpaid', 'partial', 'paid') then
    raise exception 'Invalid payment status.';
  end if;

  update public.events e
  set payment_status = p_status,
      payment_updated_at = now(),
      payment_updated_by = public.admin_email_or_default()
  where e.id = p_event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  select jsonb_build_object(
    'payment_status', e.payment_status,
    'payment_updated_at', e.payment_updated_at,
    'payment_updated_by', e.payment_updated_by
  )
  into v_result
  from public.events e
  where e.id = p_event_id;

  return v_result;
end;
$$;

-- Album selection for a set of photos. Admin-only. Never touches client
-- reactions and never deletes media.
create or replace function public.admin_set_album_selection(
  p_event_id uuid,
  p_media_ids uuid[],
  p_selected boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  update public.media m
  set album_selected = p_selected,
      album_selected_at = now(),
      album_selected_by = public.admin_email_or_default()
  where m.event_id = p_event_id
    and m.id = any(p_media_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Aggregated client reaction summary for the photo selection view. The
-- latest reaction per photo wins, so one photo counts as either liked or
-- disliked no matter how many visitors reacted to it over time.
create or replace function public.admin_reaction_summary(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select jsonb_build_object(
    'total_images', (
      select count(*) from public.media m
      where m.event_id = p_event_id
        and m.file_type = 'image'
        and m.status = 'available'
    ),
    'liked', (
      select count(*) from (
        select distinct on (r.media_id) r.reaction
        from public.reactions r
        where r.event_id = p_event_id
        order by r.media_id, r.updated_at desc
      ) latest
      where latest.reaction = 'like'
    ),
    'disliked', (
      select count(*) from (
        select distinct on (r.media_id) r.reaction
        from public.reactions r
        where r.event_id = p_event_id
        order by r.media_id, r.updated_at desc
      ) latest
      where latest.reaction = 'dislike'
    ),
    'album_selected', (
      select count(*) from public.media m
      where m.event_id = p_event_id
        and m.album_selected
        and m.status = 'available'
    )
  ) into v_result;

  return v_result;
end;
$$;

-- admin_event_media_list now also returns each photo's latest client
-- reaction and the album selection flag, so the admin selection view and
-- the face index share one source of truth.
create or replace function public.admin_event_media_list(p_event_id uuid)
returns table (
  media_id uuid,
  file_name text,
  file_type text,
  sort_order integer,
  indexed boolean,
  album_selected boolean,
  client_reaction text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  return query
  select
    m.id,
    m.file_name,
    m.file_type,
    m.sort_order,
    exists (select 1 from public.face_index_state fis where fis.media_id = m.id),
    m.album_selected,
    (
      select r.reaction from public.reactions r
      where r.media_id = m.id
      order by r.updated_at desc
      limit 1
    )
  from public.media m
  where m.event_id = p_event_id
    and m.file_type = 'image'
    and m.status = 'available'
  order by m.sort_order asc, m.created_at asc;
end;
$$;

revoke execute on function public.admin_set_payment_status(uuid, text) from anon, authenticated;
revoke execute on function public.admin_set_album_selection(uuid, uuid[], boolean) from anon, authenticated;
revoke execute on function public.admin_reaction_summary(uuid) from anon, authenticated;
revoke execute on function public.admin_event_media_list(uuid) from anon, authenticated;
revoke execute on function public.admin_email_or_default() from anon, authenticated;
