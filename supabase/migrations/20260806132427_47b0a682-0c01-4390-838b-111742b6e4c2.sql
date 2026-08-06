CREATE OR REPLACE FUNCTION public.send_session_gift(_session_id uuid, _gift_key text, _token_amount numeric)
RETURNS TABLE(gift_id uuid, new_balance numeric, host_share numeric, platform_share numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _s record;
  _cat record;
  _bal numeric;
  _gift_id uuid := gen_random_uuid();
  _host_share numeric;
  _plat_share numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT key, token_price, active INTO _cat FROM public.gift_catalog WHERE key = _gift_key;
  IF NOT FOUND OR NOT _cat.active THEN RAISE EXCEPTION 'gift unavailable'; END IF;
  IF _token_amount IS NULL OR _token_amount <> _cat.token_price THEN
    RAISE EXCEPTION 'price mismatch';
  END IF;

  SELECT id, host_id, status INTO _s FROM public.live_sessions WHERE id = _session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live not found'; END IF;
  IF _s.status <> 'active' THEN RAISE EXCEPTION 'live not active'; END IF;
  IF _s.host_id = _uid THEN RAISE EXCEPTION 'host cannot gift own live'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_passes
    WHERE session_id = _session_id AND viewer_id = _uid
      AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'no active ticket for live';
  END IF;

  SELECT token_balance INTO _bal FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _cat.token_price THEN
    RAISE EXCEPTION 'insufficient tokens' USING HINT='insufficient_tokens';
  END IF;

  UPDATE public.profiles
    SET token_balance = token_balance - _cat.token_price, updated_at = now()
    WHERE user_id = _uid
    RETURNING token_balance INTO _bal;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
  VALUES (_uid, 'spend', _cat.token_price, 'completed', 'gift:' || _gift_id::text);

  _host_share := ROUND(_cat.token_price * 0.60, 4);
  _plat_share := _cat.token_price - _host_share;

  UPDATE public.profiles
    SET available_earnings = COALESCE(available_earnings,0) + _host_share,
        total_lifetime_earnings = COALESCE(total_lifetime_earnings,0) + _host_share,
        updated_at = now()
    WHERE user_id = _s.host_id;

  UPDATE public.live_sessions
    SET gross_tokens = COALESCE(gross_tokens,0) + _cat.token_price,
        host_earning = COALESCE(host_earning,0) + _host_share,
        platform_earning = COALESCE(platform_earning,0) + _plat_share,
        updated_at = now()
    WHERE id = _session_id;

  RETURN QUERY SELECT _gift_id, _bal, _host_share, _plat_share;
END;
$$;

REVOKE ALL ON FUNCTION public.send_session_gift(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_session_gift(uuid, text, numeric) TO authenticated;