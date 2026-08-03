ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_tokens numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_earning numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_earning numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.like_live_session(_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_live_access(_session_id, _uid) THEN
    RAISE EXCEPTION 'no access to live';
  END IF;

  UPDATE public.live_sessions
     SET like_count = COALESCE(like_count,0) + 1,
         updated_at = now()
   WHERE id = _session_id
  RETURNING like_count INTO _new;

  RETURN _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_live_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_live_pass(_session_id uuid, _hours integer DEFAULT 1)
RETURNS TABLE(pass_id uuid, expires_at timestamp with time zone, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _s public.live_sessions;
  _cost numeric;
  _bal numeric;
  _exp timestamptz;
  _pid uuid;
  _host_share numeric;
  _plat_share numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _hours IS NULL OR _hours < 1 OR _hours > 24 THEN RAISE EXCEPTION 'invalid duration'; END IF;

  SELECT * INTO _s FROM public.live_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'live not found'; END IF;
  IF _s.status <> 'active' OR _s.expires_at <= now() THEN RAISE EXCEPTION 'live not active'; END IF;

  IF _s.host_id = _uid THEN
    RAISE EXCEPTION 'host does not need a pass';
  END IF;

  SELECT lp.id, lp.expires_at INTO _pid, _exp
  FROM public.live_passes lp
  WHERE lp.session_id = _session_id AND lp.viewer_id = _uid
    AND lp.status = 'active' AND lp.expires_at > now()
  ORDER BY lp.expires_at DESC LIMIT 1;
  IF _pid IS NOT NULL THEN
    SELECT token_balance INTO _bal FROM public.profiles WHERE user_id = _uid;
    RETURN QUERY SELECT _pid, _exp, _bal;
    RETURN;
  END IF;

  _cost := _hours; -- 1 token per hour

  SELECT token_balance INTO _bal FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _cost THEN
    RAISE EXCEPTION 'insufficient tokens' USING HINT = 'insufficient_tokens';
  END IF;

  UPDATE public.profiles
     SET token_balance = token_balance - _cost, updated_at = now()
   WHERE user_id = _uid
  RETURNING token_balance INTO _bal;

  _exp := LEAST(now() + make_interval(hours => _hours), _s.expires_at);

  INSERT INTO public.live_passes (session_id, viewer_id, duration_hours, amount_paid_usd, currency, provider, status, started_at, expires_at)
  VALUES (_session_id, _uid, _hours, _cost, 'USD', 'tokens', 'active', now(), _exp)
  RETURNING id INTO _pid;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
  VALUES (_uid, 'spend', _cost, 'completed', 'live_pass:' || _pid::text);

  -- Instant 60/40 split on ticket revenue: host keeps 60%, Tutwine keeps 40%.
  _host_share := ROUND(_cost * 0.60, 4);
  _plat_share := _cost - _host_share;

  UPDATE public.profiles
     SET available_earnings = COALESCE(available_earnings,0) + _host_share,
         total_lifetime_earnings = COALESCE(total_lifetime_earnings,0) + _host_share,
         updated_at = now()
   WHERE user_id = _s.host_id;

  UPDATE public.live_sessions
     SET gross_tokens = COALESCE(gross_tokens,0) + _cost,
         host_earning = COALESCE(host_earning,0) + _host_share,
         platform_earning = COALESCE(platform_earning,0) + _plat_share,
         updated_at = now()
   WHERE id = _session_id;

  RETURN QUERY SELECT _pid, _exp, _bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_earnings_stats(_host_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(available_earnings numeric, pending_withdrawals numeric, paid_withdrawals numeric, total_lifetime_earnings numeric, total_live_views bigint, total_gifts_received bigint, total_gift_tokens numeric, total_likes_received bigint, total_watch_seconds bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := COALESCE(_host_id, auth.uid());
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _uid <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(p.available_earnings,0),
    COALESCE(p.pending_withdrawals,0),
    COALESCE((
      SELECT SUM(amount) FROM public.token_transactions
      WHERE user_id = _uid AND type = 'withdrawal' AND status = 'completed'
    ),0),
    COALESCE(p.total_lifetime_earnings,0),
    COALESCE((SELECT COUNT(*) FROM public.live_tickets t
              JOIN public.lives l ON l.id = t.live_id
              WHERE l.host_id = _uid),0)
    + COALESCE((SELECT COUNT(*) FROM public.live_passes lp
              JOIN public.live_sessions s ON s.id = lp.session_id
              WHERE s.host_id = _uid),0),
    COALESCE((SELECT COUNT(*) FROM public.gifts WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(token_amount) FROM public.gifts WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(like_count)::bigint FROM public.lives WHERE host_id = _uid),0)
    + COALESCE((SELECT SUM(like_count)::bigint FROM public.live_sessions WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(l.ended_at, now()) - l.started_at)))::bigint
              FROM public.lives l WHERE l.host_id = _uid AND l.started_at IS NOT NULL),0)
    + COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(s.expires_at, now()), now()) - s.started_at)))::bigint
              FROM public.live_sessions s WHERE s.host_id = _uid AND s.started_at IS NOT NULL),0)
  FROM public.profiles p WHERE p.user_id = _uid;
END;
$$;