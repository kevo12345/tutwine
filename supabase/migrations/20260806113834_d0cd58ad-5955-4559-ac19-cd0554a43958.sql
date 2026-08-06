REVOKE EXECUTE ON FUNCTION public.admin_live_overview(boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_live_overview(boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_live_session_detail(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_live_session_detail(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_live_session_room(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_live_session_room(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.like_live_session(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.like_live_session(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.purchase_live_pass(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.purchase_live_pass(uuid, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.send_gift(uuid, text, numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, text, numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_live_paused(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_live_paused(uuid, boolean) TO authenticated, service_role;