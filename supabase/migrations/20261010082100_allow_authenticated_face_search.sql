-- Client face search is public-by-event-code, just like the gallery lookup.
-- Keep embeddings private; only the SECURITY DEFINER search function is exposed.
grant execute on function public.search_event_faces(text, text, double precision, text) to authenticated;
