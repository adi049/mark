-- Production security repair applied to the live MARKIPIE project.
-- Client gallery RPCs remain public by design; admin RPCs stay authenticated
-- and enforce public.is_admin() inside their SECURITY DEFINER bodies.

revoke execute on function public.is_admin() from anon;
revoke execute on function public.admin_check() from anon;

create or replace function public.admin_reaction_summary(p_event_id uuid)
returns table(
  media_id uuid,
  file_name text,
  likes bigint,
  dislikes bigint,
  total_reactions bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  return query
  select
    m.id as media_id,
    m.file_name,
    count(*) filter (where r.reaction = 'like') as likes,
    count(*) filter (where r.reaction = 'dislike') as dislikes,
    count(r.id) as total_reactions
  from public.media m
  left join public.reactions r on r.media_id = m.id
  where m.event_id = p_event_id
    and m.status = 'available'
  group by m.id, m.file_name
  order by m.file_name asc;
end;
$function$;

alter function public.set_updated_at() set search_path = public;

grant execute on function public.lookup_event_by_code(text) to anon, authenticated;
grant execute on function public.get_event_folders(text) to anon, authenticated;
grant execute on function public.get_event_subfolders(text, uuid) to anon, authenticated;
grant execute on function public.get_event_media(text, uuid, integer, integer, text) to anon, authenticated;
grant execute on function public.search_event_faces(text, text, double precision, text) to anon, authenticated;
grant execute on function public.set_reaction(text, uuid, text, text) to anon, authenticated;
