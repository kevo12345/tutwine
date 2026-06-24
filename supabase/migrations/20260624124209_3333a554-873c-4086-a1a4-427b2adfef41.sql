
DROP FUNCTION IF EXISTS public.get_active_live_sessions();

CREATE FUNCTION public.get_active_live_sessions()
 RETURNS TABLE(id uuid, host_id uuid, display_name text, photos text[], duration_hours numeric, started_at timestamp with time zone, expires_at timestamp with time zone, viewer_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.host_id, p.display_name, p.photos,
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

DROP POLICY IF EXISTS "Anyone authenticated can see live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Host or pass holders can read live sessions" ON public.live_sessions;
CREATE POLICY "Host or pass holders can read live sessions"
ON public.live_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() = host_id
  OR EXISTS (
    SELECT 1 FROM public.live_passes lp
    WHERE lp.session_id = live_sessions.id
      AND lp.viewer_id = auth.uid()
      AND lp.status = 'active'
      AND lp.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read access to photos bucket" ON storage.objects;
CREATE POLICY "Public read access to photos bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');
