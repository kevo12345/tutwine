CREATE OR REPLACE FUNCTION public.purchase_live_pass(_session_id uuid, _hours integer DEFAULT 1)
RETURNS TABLE(pass_id uuid, expires_at timestamptz, new_balance numeric)
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _hours IS NULL OR _hours < 1 OR _hours > 24 THEN RAISE EXCEPTION 'invalid duration'; END IF;

  SELECT * INTO _s FROM public.live_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'live not found'; END IF;
  IF _s.status <> 'active' OR _s.expires_at <= now() THEN RAISE EXCEPTION 'live not active'; END IF;

  IF _s.host_id = _uid THEN
    RAISE EXCEPTION 'host does not need a pass';
  END IF;

  -- Reuse an existing valid pass instead of charging twice.
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

  RETURN QUERY SELECT _pid, _exp, _bal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_live_pass(uuid, integer) TO authenticated;