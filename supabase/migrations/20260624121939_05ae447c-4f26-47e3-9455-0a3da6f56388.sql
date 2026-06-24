
-- Enum for live status
DO $$ BEGIN
  CREATE TYPE public.live_status AS ENUM ('pending_payment','active','ended','expired','canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sessions: a paid broadcaster
CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  daily_room_url text,
  daily_room_name text,
  duration_hours numeric(5,2) NOT NULL,
  amount_paid_usd numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL,
  provider_ref text,
  status public.live_status NOT NULL DEFAULT 'pending_payment',
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX live_sessions_one_active_per_host
  ON public.live_sessions(host_id)
  WHERE status IN ('pending_payment','active');

CREATE INDEX live_sessions_active_idx
  ON public.live_sessions(status, expires_at);

GRANT SELECT, INSERT, UPDATE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can see live sessions"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Hosts insert their own session"
  ON public.live_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts update their own session"
  ON public.live_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE TRIGGER live_sessions_updated_at
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Passes: a paid viewer
CREATE TABLE public.live_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  duration_hours numeric(5,2) NOT NULL,
  amount_paid_usd numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL,
  provider_ref text,
  status public.live_status NOT NULL DEFAULT 'pending_payment',
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX live_passes_viewer_active_idx
  ON public.live_passes(viewer_id, status, expires_at);
CREATE INDEX live_passes_session_idx
  ON public.live_passes(session_id, status);

GRANT SELECT, INSERT, UPDATE ON public.live_passes TO authenticated;
GRANT ALL ON public.live_passes TO service_role;

ALTER TABLE public.live_passes ENABLE ROW LEVEL SECURITY;

-- Viewers see their own passes
CREATE POLICY "Viewers see own passes"
  ON public.live_passes FOR SELECT TO authenticated
  USING (auth.uid() = viewer_id);

-- Hosts see passes against their session (for viewer counts)
CREATE POLICY "Hosts see passes for their session"
  ON public.live_passes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE s.id = live_passes.session_id AND s.host_id = auth.uid()
  ));

CREATE POLICY "Viewers insert own pass"
  ON public.live_passes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Viewers update own pass"
  ON public.live_passes FOR UPDATE TO authenticated
  USING (auth.uid() = viewer_id)
  WITH CHECK (auth.uid() = viewer_id);

CREATE TRIGGER live_passes_updated_at
  BEFORE UPDATE ON public.live_passes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_passes;

-- Aggregate view-like helper for active sessions with host profile + viewer count
CREATE OR REPLACE FUNCTION public.get_active_live_sessions()
RETURNS TABLE (
  id uuid,
  host_id uuid,
  display_name text,
  photos text[],
  daily_room_url text,
  duration_hours numeric,
  started_at timestamptz,
  expires_at timestamptz,
  viewer_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.host_id, p.display_name, p.photos,
    s.daily_room_url, s.duration_hours, s.started_at, s.expires_at,
    COALESCE((
      SELECT count(*)::int FROM public.live_passes lp
      WHERE lp.session_id = s.id AND lp.status = 'active' AND lp.expires_at > now()
    ), 0) AS viewer_count
  FROM public.live_sessions s
  JOIN public.profiles p ON p.user_id = s.host_id
  WHERE s.status = 'active' AND s.expires_at > now()
  ORDER BY s.started_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_active_live_sessions() TO authenticated;
