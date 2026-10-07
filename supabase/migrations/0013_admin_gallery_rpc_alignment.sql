-- MARKIPIE production repair 0013
-- Align the live admin gallery RPCs with the current frontend contract and
-- lock admin-only functions to authenticated admin sessions.

drop function if exists public.admin_set_album_selection(uuid, boolean);
drop function if exists public.admin_reaction_summary(uuid);
drop function if exists public.admin_event_media_list(uuid);

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
      album_selected_at = case when p_selected then now() else null end,
      album_selected_by = case when p_selected then auth.uid() else null end
  where m.event_id = p_event_id
    and m.id = any(coalesce(p_media_ids, '{}'::uuid[]));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_reaction_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
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
      select count(*)
      from public.media m
      where m.event_id = p_event_id
        and m.file_type = 'image'
        and m.status = 'available'
    ),
    'liked', (
      select count(*)
      from (
        select distinct on (r.media_id) r.media_id, r.reaction
        from public.reactions r
        where r.event_id = p_event_id
        order by r.media_id, r.updated_at desc
      ) latest
      where latest.reaction = 'like'
    ),
    'disliked', (
      select count(*)
      from (
        select distinct on (r.media_id) r.media_id, r.reaction
        from public.reactions r
        where r.event_id = p_event_id
        order by r.media_id, r.updated_at desc
      ) latest
      where latest.reaction = 'dislike'
    ),
    'album_selected', (
      select count(*)
      from public.media m
      where m.event_id = p_event_id
        and m.file_type = 'image'
        and m.status = 'available'
        and m.album_selected = true
    )
  ) into v_result;

  return v_result;
end;
$$;

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
    exists (
      select 1
      from public.face_index_state fis
      where fis.media_id = m.id
    ) as indexed,
    m.album_selected,
    (
      select r.reaction
      from public.reactions r
      where r.media_id = m.id
      order by r.updated_at desc
      limit 1
    ) as client_reaction
  from public.media m
  where m.event_id = p_event_id
    and m.file_type = 'image'
    and m.status = 'available'
  order by m.sort_order asc, m.created_at asc;
end;
$$;

revoke execute on function public.admin_check() from public, anon;
revoke execute on function public.is_admin() from public, anon;

revoke execute on function public.admin_media_overview() from public, anon;
revoke execute on function public.admin_event_media_stats(uuid) from public, anon;
revoke execute on function public.admin_event_media_list(uuid) from public, anon;
revoke execute on function public.admin_store_face_embeddings(uuid, jsonb) from public, anon;
revoke execute on function public.admin_clear_face_index(uuid) from public, anon;
revoke execute on function public.admin_face_index_stats(uuid) from public, anon;
revoke execute on function public.admin_set_payment_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_initial_payment_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_album_selection(uuid, uuid[], boolean) from public, anon;
revoke execute on function public.admin_reaction_summary(uuid) from public, anon;

grant execute on function public.admin_check() to authenticated;
grant execute on function public.admin_media_overview() to authenticated;
grant execute on function public.admin_event_media_stats(uuid) to authenticated;
grant execute on function public.admin_event_media_list(uuid) to authenticated;
grant execute on function public.admin_store_face_embeddings(uuid, jsonb) to authenticated;
grant execute on function public.admin_clear_face_index(uuid) to authenticated;
grant execute on function public.admin_face_index_stats(uuid) to authenticated;
grant execute on function public.admin_set_payment_status(uuid, text) to authenticated;
grant execute on function public.admin_set_initial_payment_status(uuid, text) to authenticated;
grant execute on function public.admin_set_album_selection(uuid, uuid[], boolean) to authenticated;
grant execute on function public.admin_reaction_summary(uuid) to authenticated;

drop policy if exists "read own or any admin row" on public.admins;
create policy "read own or any admin row"
  on public.admins for select
  to authenticated
  using ((select public.is_admin()) or user_id = (select auth.uid()));

create index if not exists idx_drive_jobs_event_id on public.drive_jobs (event_id);
create index if not exists idx_drive_oauth_states_admin_user_id on public.drive_oauth_states (admin_user_id);
create index if not exists idx_events_payment_status_updated_by on public.events (payment_status_updated_by);
create index if not exists idx_media_album_selected_by on public.media (album_selected_by);
create index if not exists idx_reactions_event_id on public.reactions (event_id);
