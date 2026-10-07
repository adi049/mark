-- Qualify the pgvector distance operator as well as the vector type.
create or replace function public.search_event_faces(
  p_code text,
  p_embedding text,
  p_threshold double precision default 0.5,
  p_session_id text default null
)
returns table(id uuid, file_name text, file_type text, my_reaction text, distance double precision)
language plpgsql
security definer
set search_path=public
as $function$
declare v_event record;
begin
  if p_embedding is null or length(p_embedding) < 10 then raise exception 'A face scan is required before searching.'; end if;
  select e.* into v_event from public.events e
  where e.status='active' and (upper(e.access_code)=upper(nullif(p_code,'')) or e.qr_token=nullif(p_code,''))
  limit 1;
  if not found then raise exception 'Invalid or expired access code.'; end if;
  if not v_event.face_scan_enabled then raise exception 'Face scan is not enabled for this event.'; end if;
  if p_threshold is null or p_threshold < 0.2 or p_threshold > 0.9 then p_threshold := 0.5; end if;
  return query
  select m.id,m.file_name,m.file_type,
    (select r.reaction from public.reactions r where r.media_id=m.id and r.session_id=p_session_id limit 1),
    d.dist::float
  from (
    select fe.media_id, min(fe.embedding operator(extensions.<->) (p_embedding)::extensions.vector) as dist
    from public.face_embeddings fe
    where fe.event_id=v_event.id
      and (fe.embedding operator(extensions.<->) (p_embedding)::extensions.vector) < p_threshold
    group by fe.media_id
  ) d
  join public.media m on m.id=d.media_id and m.event_id=v_event.id and m.status='available'
  order by d.dist asc limit 240;
end;
$function$;