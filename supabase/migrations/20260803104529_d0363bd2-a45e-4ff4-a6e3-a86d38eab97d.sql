CREATE OR REPLACE FUNCTION public.end_live_session(_session_id uuid)
RETURNS TABLE(id uuid, status live_status, ended_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.host_id INTO v_host FROM public.live_sessions s WHERE s.id = _session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Live session not found';
  END IF;
  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'Only the host can end this live';
  END IF;

  UPDATE public.live_sessions s
     SET status = 'ended',
         expires_at = now(),
         updated_at = now()
   WHERE s.id = _session_id
     AND s.status = 'active';

  -- Expire any outstanding viewer passes for this live.
  UPDATE public.live_passes lp
     SET status = 'expired',
         expires_at = LEAST(lp.expires_at, now()),
         updated_at = now()
   WHERE lp.session_id = _session_id
     AND lp.status = 'active';

  RETURN QUERY
    SELECT s.id, s.status, s.updated_at FROM public.live_sessions s WHERE s.id = _session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.end_live_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_live_session(uuid) TO authenticated, service_role;