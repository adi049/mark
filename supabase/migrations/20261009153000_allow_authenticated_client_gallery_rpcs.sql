-- Client Access is public-by-event-code, not by Supabase auth state.
-- Allow an already-authenticated browser session to use the same code/QR
-- gallery RPCs. Each function remains SECURITY DEFINER and validates the
-- active event code/QR token internally.
grant execute on function public.lookup_event_by_code(text) to authenticated;
grant execute on function public.get_event_folders(text) to authenticated;
grant execute on function public.get_event_subfolders(text, uuid) to authenticated;
grant execute on function public.get_event_media(text, uuid, integer, integer, text) to authenticated;
