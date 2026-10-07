-- MARKIPIE production repair 0015
-- Keep face-index rebuilds exact, normalize face access codes, and make
-- Drive OAuth state unreachable through the public Data API.

create or replace function public.search_event_faces(
  p_code text, p_embedding text, p_threshold double precision default 0.5,
  p_session_id text default null
)
returns table(id uuid, file_name text, file_type text, my_reaction text, distance double precision)
language plpgsql security definer set search_path = public
as $function$
declare v_event record;
begin
  if p_embedding is null or length(p_embedding) < 10 then
    raise exception 'A face scan is required before searching.';
  end if;
  select e.* into v_event from public.events e
  where e.status = 'active'
    and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''))
  limit 1;
  if not found then raise exception 'Invalid or expired access code.'; end if;
  if not v_event.face_scan_enabled then raise exception 'Face scan is not enabled for this event.'; end if;
  if p_threshold is null or p_threshold < 0.2 or p_threshold > 0.9 then p_threshold := 0.5; end if;
  return query
  select m.id, m.file_name, m.file_type,
    (select r.reaction from public.reactions r where r.media_id=m.id and r.session_id=p_session_id limit 1),
    d.dist::float
  from (
    select fe.media_id, min(fe.embedding <-> (p_embedding)::vector) dist
    from public.face_embeddings fe
    where fe.event_id=v_event.id and (fe.embedding <-> (p_embedding)::vector) < p_threshold
    group by fe.media_id
  ) d
  join public.media m on m.id=d.media_id and m.event_id=v_event.id and m.status='available'
  order by d.dist asc limit 240;
end;
$function$;

create or replace function public.admin_store_face_embeddings(p_event_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path=public
as $function$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  insert into public.face_index_state(media_id,event_id)
  select (r->>'media_id')::uuid,p_event_id
  from jsonb_array_elements(p_rows) r
  where exists (
    select 1 from public.media m
    where m.id=(r->>'media_id')::uuid and m.event_id=p_event_id and m.file_type='image'
  )
  on conflict(media_id) do update set indexed_at=now();

  delete from public.face_embeddings
  where event_id=p_event_id
    and media_id in (
      select (r->>'media_id')::uuid
      from jsonb_array_elements(p_rows) r
      where exists (
        select 1 from public.media m
        where m.id=(r->>'media_id')::uuid and m.event_id=p_event_id and m.file_type='image'
      )
    );

  insert into public.face_embeddings(event_id,media_id,face_index,embedding)
  select p_event_id,(r->>'media_id')::uuid,coalesce((r->>'face_index')::integer,0),(r->>'embedding')::text::vector
  from jsonb_array_elements(p_rows) r
  where r->>'embedding' is not null
    and exists (
      select 1 from public.media m
      where m.id=(r->>'media_id')::uuid and m.event_id=p_event_id and m.file_type='image'
    );
  get diagnostics v_count=row_count;
  return v_count;
end;
$function$;

revoke all on table public.drive_oauth_states from anon, authenticated;
