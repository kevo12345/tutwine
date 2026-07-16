DROP FUNCTION IF EXISTS public.get_active_live_sessions();

CREATE FUNCTION public.get_active_live_sessions()
 RETURNS TABLE(id uuid, host_id uuid, display_name text, photos text[], thumbnail_url text, duration_hours numeric, started_at timestamp with time zone, expires_at timestamp with time zone, viewer_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.host_id, p.display_name, p.photos, s.thumbnail_url,
    s.duration_hours, s.started_at, s.expires_at,
    COALESCE((
      SELECT count(*)::int FROM public.live_passes lp
      WHERE lp.session_id = s.id AND lp.status = 'active' AND lp.expires_at > now()
    ), 0) AS viewer_count
  FROM public.live_sessions s
  JOIN public.profiles p ON p.user_id = s.host_id
  WHERE s.status = 'active' AND s.expires_at > now()
  ORDER BY s.started_at DESC
$function$;

REVOKE EXECUTE ON FUNCTION public.get_active_live_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_live_sessions() TO authenticated;