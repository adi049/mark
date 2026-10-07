-- Least privilege for admin SECURITY DEFINER RPCs.
-- Admin RPCs are private to signed-in admins; do not inherit PUBLIC execute.
REVOKE EXECUTE ON FUNCTION public.admin_check() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_clear_face_index(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_event_media_list(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_event_media_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_event_media_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_event_payment_album_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_face_index_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_media_overview() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reaction_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_album_selection(uuid, uuid[], boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_initial_payment_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_store_face_embeddings(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_face_index(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_event_media_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_event_media_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_event_media_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_event_payment_album_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_face_index_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_media_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reaction_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_album_selection(uuid, uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_initial_payment_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_store_face_embeddings(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
