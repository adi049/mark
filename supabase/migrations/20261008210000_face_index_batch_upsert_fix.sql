-- Fix face-index batch upsert when one photo contains multiple faces.
-- face_index_state is keyed by media_id, while face_embeddings can contain
-- multiple rows per media_id. Deduplicate media ids before the state upsert.

create or replace function public.admin_store_face_embeddings(p_event_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  insert into public.face_index_state(media_id, event_id)
  select distinct (r->>'media_id')::uuid, p_event_id
  from jsonb_array_elements(p_rows) r
  where exists (
    select 1
    from public.media m
    where m.id = (r->>'media_id')::uuid
      and m.event_id = p_event_id
      and m.file_type = 'image'
  )
  on conflict(media_id) do update
    set indexed_at = now();

  delete from public.face_embeddings
  where event_id = p_event_id
    and media_id in (
      select distinct (r->>'media_id')::uuid
      from jsonb_array_elements(p_rows) r
      where exists (
        select 1
        from public.media m
        where m.id = (r->>'media_id')::uuid
          and m.event_id = p_event_id
          and m.file_type = 'image'
      )
    );

  insert into public.face_embeddings(
    event_id, media_id, face_index, embedding
  )
  select
    p_event_id,
    (r->>'media_id')::uuid,
    coalesce((r->>'face_index')::integer, 0),
    (r->>'embedding')::text::extensions.vector
  from jsonb_array_elements(p_rows) r
  where r->>'embedding' is not null
    and exists (
      select 1
      from public.media m
      where m.id = (r->>'media_id')::uuid
        and m.event_id = p_event_id
        and m.file_type = 'image'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
