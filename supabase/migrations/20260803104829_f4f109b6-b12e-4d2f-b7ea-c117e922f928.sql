REVOKE ALL ON FUNCTION public.get_live_session_room(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_live_session_room(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_live_session_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_session_room(uuid) TO service_role;