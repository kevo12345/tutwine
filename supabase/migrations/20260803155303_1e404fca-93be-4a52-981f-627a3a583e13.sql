ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_live_paused(_session_id uuid, _paused boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = _session_id;
  IF v_host IS NULL THEN RAISE EXCEPTION 'live not found'; END IF;
  IF v_host <> auth.uid() THEN RAISE EXCEPTION 'only the host can pause this live'; END IF;

  UPDATE public.live_sessions
     SET is_paused = COALESCE(_paused, false),
         paused_at = CASE WHEN COALESCE(_paused, false) THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _session_id;

  RETURN COALESCE(_paused, false);
END;
$$;

DROP FUNCTION IF EXISTS public.get_live_session_room(uuid);

CREATE FUNCTION public.get_live_session_room(_session_id uuid)
RETURNS TABLE(id uuid, host_id uuid, status text, daily_room_url text, expires_at timestamp with time zone, started_at timestamp with time zone, thumbnail_url text, is_paused boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select s.id, s.host_id, s.status::text, s.daily_room_url,
         s.expires_at, s.started_at, s.thumbnail_url, COALESCE(s.is_paused, false)
  from public.live_sessions s
  where s.id = _session_id
  limit 1;
$$;