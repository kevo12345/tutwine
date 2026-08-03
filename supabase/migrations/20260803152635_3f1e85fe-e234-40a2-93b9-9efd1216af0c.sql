DROP FUNCTION IF EXISTS public.send_gift(uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.send_gift(_live_id uuid, _gift_key text, _token_amount numeric)
 RETURNS TABLE(gift_id uuid, new_balance numeric, host_share numeric, platform_share numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _live record;
  _bal numeric;
  _gift_id uuid;
  _cat record;
  _host_share numeric;
  _plat_share numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT key, token_price, active INTO _cat FROM public.gift_catalog WHERE key = _gift_key;
  IF NOT FOUND OR NOT _cat.active THEN
    RAISE EXCEPTION 'gift unavailable';
  END IF;
  IF _token_amount IS NULL OR _token_amount <> _cat.token_price THEN
    RAISE EXCEPTION 'price mismatch';
  END IF;

  SELECT id, host_id, status INTO _live FROM public.lives WHERE id = _live_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live not found'; END IF;
  IF _live.status NOT IN ('live','paused') THEN
    RAISE EXCEPTION 'live not active';
  END IF;
  IF _live.host_id = _uid THEN
    RAISE EXCEPTION 'host cannot gift own live';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_tickets
    WHERE live_id = _live_id AND user_id = _uid AND expires_at > now()
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

  INSERT INTO public.gifts (live_id, sender_id, host_id, gift_key, token_amount)
  VALUES (_live_id, _uid, _live.host_id, _cat.key, _cat.token_price)
  RETURNING id INTO _gift_id;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
  VALUES (_uid, 'spend', _cat.token_price, 'completed', 'gift:' || _gift_id::text);

  -- Instant 60/40 split: host keeps 60%, Tutwine keeps 40%.
  _host_share := ROUND(_cat.token_price * 0.60, 4);
  _plat_share := _cat.token_price - _host_share;

  UPDATE public.profiles
    SET available_earnings = COALESCE(available_earnings,0) + _host_share,
        total_lifetime_earnings = COALESCE(total_lifetime_earnings,0) + _host_share,
        updated_at = now()
    WHERE user_id = _live.host_id;

  UPDATE public.lives
    SET gross_tokens = COALESCE(gross_tokens,0) + _cat.token_price,
        host_earning = COALESCE(host_earning,0) + _host_share,
        platform_earning = COALESCE(platform_earning,0) + _plat_share,
        updated_at = now()
    WHERE id = _live_id;

  RETURN QUERY SELECT _gift_id, _bal, _host_share, _plat_share;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_live_earnings(_live_id uuid)
 RETURNS TABLE(live_id uuid, gross numeric, host_share numeric, platform_share numeric, host_pct integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _live public.lives;
  _tickets numeric := 0;
  _split record;
  _host_share numeric := 0;
  _plat_share numeric := 0;
BEGIN
  SELECT * INTO _live FROM public.lives WHERE id = _live_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live not found'; END IF;
  IF _live.status <> 'ended' THEN
    RAISE EXCEPTION 'live not ended';
  END IF;
  IF _live.settled_at IS NOT NULL THEN
    RETURN QUERY SELECT _live.id, _live.gross_tokens, _live.host_earning, _live.platform_earning, NULL::int;
    RETURN;
  END IF;

  -- Gifts are already paid out instantly (60/40) at send time, so settlement
  -- only covers ticket revenue.
  SELECT COALESCE(SUM(price_tokens),0) INTO _tickets
    FROM public.live_tickets WHERE live_id = _live_id;

  SELECT * INTO _split FROM public.calculate_live_duration_payout(_live_id);

  _host_share := ROUND(_tickets * COALESCE(_split.host_pct,0) / 100.0, 4);
  _plat_share := _tickets - _host_share;

  UPDATE public.lives
    SET settled_at = now(),
        gross_tokens = COALESCE(gross_tokens,0) + _tickets,
        host_earning = COALESCE(host_earning,0) + _host_share,
        platform_earning = COALESCE(platform_earning,0) + _plat_share,
        updated_at = now()
    WHERE id = _live_id;

  IF _host_share > 0 THEN
    UPDATE public.profiles
      SET available_earnings = COALESCE(available_earnings,0) + _host_share,
          total_lifetime_earnings = COALESCE(total_lifetime_earnings,0) + _host_share,
          updated_at = now()
      WHERE user_id = _live.host_id;
  END IF;

  RETURN QUERY SELECT _live.id, _tickets, _host_share, _plat_share, _split.host_pct;
END;
$function$;