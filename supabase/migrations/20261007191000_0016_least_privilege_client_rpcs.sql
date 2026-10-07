-- MARKIPIE production repair 0016
-- Client gallery is intentionally anonymous; signed-in users do not need
-- the public gallery RPC surface.

revoke execute on function public.lookup_event_by_code(text) from authenticated;
revoke execute on function public.get_event_folders(text) from authenticated;
revoke execute on function public.get_event_subfolders(text, uuid) from authenticated;
revoke execute on function public.get_event_media(text, uuid, integer, integer, text) from authenticated;
revoke execute on function public.search_event_faces(text, text, double precision, text) from authenticated;
revoke execute on function public.set_reaction(text, uuid, text, text) from authenticated;

grant execute on function public.lookup_event_by_code(text) to anon;
grant execute on function public.get_event_folders(text) to anon;
grant execute on function public.get_event_subfolders(text, uuid) to anon;
grant execute on function public.get_event_media(text, uuid, integer, integer, text) to anon;
grant execute on function public.search_event_faces(text, text, double precision, text) to anon;
grant execute on function public.set_reaction(text, uuid, text, text) to anon;
