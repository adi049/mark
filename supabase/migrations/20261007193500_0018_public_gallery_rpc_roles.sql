-- Client gallery RPCs are anonymous-only. Authenticated users do not need these public endpoints.
REVOKE EXECUTE ON FUNCTION public.lookup_event_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_folders(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_subfolders(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_media(text, uuid, integer, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_event_faces(text, text, double precision, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_reaction(text, uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lookup_event_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_folders(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_subfolders(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_media(text, uuid, integer, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_event_faces(text, text, double precision, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_reaction(text, uuid, text, text) TO anon;
