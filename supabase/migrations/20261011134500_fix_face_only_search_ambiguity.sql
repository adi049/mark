create or replace function public.search_all_event_faces(
  p_embedding text,
  p_threshold double precision default 0.6
)
returns table(id uuid, file_name text, file_type text, event_id uuid, event_name text, face_token text, distance double precision)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_token text;
  v_media_ids uuid[];
begin
  if p_embedding is null or length(p_embedding) < 10 then raise exception 'A face scan is required before searching.'; end if;
  if p_threshold is null or p_threshold < 0.2 or p_threshold > 0.9 then p_threshold := 0.6; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  with matched as materialized (
    select m.id, m.event_id, m.file_name, m.file_type, e.name as event_name,
      min(fe.embedding operator(extensions.<->) (p_embedding)::extensions.vector)::double precision as distance
    from public.face_embeddings fe
    join public.events e on e.id = fe.event_id
    join public.media m on m.id = fe.media_id and m.event_id = fe.event_id
    where e.status = 'active' and e.face_scan_enabled = true and m.status = 'available' and m.file_type = 'image'
    group by m.id, m.event_id, m.file_name, m.file_type, e.name
  ), limited as materialized (
    select matched.* from matched where matched.distance < p_threshold order by matched.distance asc limit 1000
  )
  select array_agg(limited.id) into v_media_ids from limited;
  if coalesce(array_length(v_media_ids, 1), 0) = 0 then return; end if;
  insert into public.face_access_grants(token, media_ids, expires_at) values (v_token, v_media_ids, now() + interval '30 minutes');
  delete from public.face_access_grants where expires_at < now();
  return query
  with matched as materialized (
    select m.id, m.event_id, m.file_name, m.file_type, e.name as event_name,
      min(fe.embedding operator(extensions.<->) (p_embedding)::extensions.vector)::double precision as distance
    from public.face_embeddings fe
    join public.events e on e.id = fe.event_id
    join public.media m on m.id = fe.media_id and m.event_id = fe.event_id
    where e.status = 'active' and e.face_scan_enabled = true and m.status = 'available' and m.file_type = 'image'
    group by m.id, m.event_id, m.file_name, m.file_type, e.name
  ), limited as materialized (
    select matched.* from matched where matched.distance < p_threshold order by matched.distance asc limit 1000
  )
  select limited.id, limited.file_name, limited.file_type, limited.event_id, limited.event_name, v_token, limited.distance
  from limited order by limited.distance asc;
end;
$function$;
revoke all on function public.search_all_event_faces(text, double precision) from public;
grant execute on function public.search_all_event_faces(text, double precision) to anon, authenticated;
