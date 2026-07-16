
-- New "lives" hosting table (separate from live_sessions/Daily.co system)
CREATE TABLE IF NOT EXISTS public.lives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  banner_url text,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','paused','ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  viewer_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  share_link text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lives TO authenticated;
GRANT ALL ON public.lives TO service_role;

ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS lives_active_idx ON public.lives (status, started_at DESC);
CREATE INDEX IF NOT EXISTS lives_host_idx ON public.lives (host_id, started_at DESC);

CREATE TRIGGER trg_lives_updated_at
  BEFORE UPDATE ON public.lives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: does user have an active, non-expired subscription?
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

-- SELECT: anyone signed in can see currently-live streams; hosts see all of theirs
CREATE POLICY "read live streams"
  ON public.lives FOR SELECT
  TO authenticated
  USING (status IN ('live','paused') OR host_id = auth.uid());

-- INSERT: only subscribers can start a live, and only as themselves
CREATE POLICY "subscribers start own live"
  ON public.lives FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid()
    AND status = 'live'
    AND public.has_active_subscription(auth.uid())
  );

-- UPDATE: only the host can update their own live (used for pause/resume/end)
CREATE POLICY "host updates own live"
  ON public.lives FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Payout split calculator. Full split (60/40) if duration >= 1h AND ended,
-- reduced (10/90) if ended early, and pending if still live/paused.
CREATE OR REPLACE FUNCTION public.calculate_live_duration_payout(_live_id uuid)
RETURNS TABLE(
  live_id uuid,
  status text,
  duration_seconds integer,
  qualifies_full boolean,
  host_pct integer,
  platform_pct integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.lives;
  ended timestamptz;
  dur integer;
  qualifies boolean;
BEGIN
  SELECT * INTO r FROM public.lives WHERE id = _live_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'live not found';
  END IF;

  ended := COALESCE(r.ended_at, now());
  dur := GREATEST(0, EXTRACT(EPOCH FROM (ended - r.started_at))::int);
  qualifies := (r.status = 'ended' AND (ended - r.started_at) >= interval '1 hour');

  IF r.status <> 'ended' THEN
    RETURN QUERY SELECT r.id, r.status, dur, false, NULL::int, NULL::int;
  ELSIF qualifies THEN
    RETURN QUERY SELECT r.id, r.status, dur, true,  60, 40;
  ELSE
    RETURN QUERY SELECT r.id, r.status, dur, false, 10, 90;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_live_duration_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_live_duration_payout(uuid) TO authenticated, service_role;

-- Realtime for live discovery
ALTER PUBLICATION supabase_realtime ADD TABLE public.lives;
ALTER TABLE public.lives REPLICA IDENTITY FULL;

-- Storage: banners bucket policies (bucket created via storage tool separately)
