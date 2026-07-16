
-- Gifts table
CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  host_id uuid NOT NULL,
  gift_key text NOT NULL,
  token_amount numeric NOT NULL CHECK (token_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

-- Readable by sender, host, and any current-ticket holder of the live
CREATE POLICY "gifts_read_participants" ON public.gifts
FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR host_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.live_tickets t
    WHERE t.live_id = gifts.live_id AND t.user_id = auth.uid() AND t.expires_at > now()
  )
);

-- Inserts must go through send_gift RPC; block direct client insert
CREATE POLICY "gifts_insert_none" ON public.gifts
FOR INSERT TO authenticated WITH CHECK (false);

CREATE INDEX gifts_live_id_idx ON public.gifts(live_id);
CREATE INDEX gifts_host_id_idx ON public.gifts(host_id);

-- Settlement tracking flag on lives so we don't double-pay
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS host_earning numeric NOT NULL DEFAULT 0;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS platform_earning numeric NOT NULL DEFAULT 0;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS gross_tokens numeric NOT NULL DEFAULT 0;

-- send_gift RPC: atomically debit sender, credit nothing yet (settled at end)
CREATE OR REPLACE FUNCTION public.send_gift(_live_id uuid, _gift_key text, _token_amount numeric)
RETURNS TABLE (gift_id uuid, new_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _live record;
  _bal numeric;
  _gift_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _token_amount IS NULL OR _token_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  SELECT id, host_id, status INTO _live FROM public.lives WHERE id = _live_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live not found'; END IF;
  IF _live.status NOT IN ('live','paused') THEN
    RAISE EXCEPTION 'live not active';
  END IF;
  IF _live.host_id = _uid THEN
    RAISE EXCEPTION 'host cannot gift own live';
  END IF;

  -- Require a valid ticket
  IF NOT EXISTS (
    SELECT 1 FROM public.live_tickets
    WHERE live_id = _live_id AND user_id = _uid AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'no active ticket for live';
  END IF;

  SELECT token_balance INTO _bal FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _token_amount THEN
    RAISE EXCEPTION 'insufficient tokens' USING HINT='insufficient_tokens';
  END IF;

  UPDATE public.profiles
    SET token_balance = token_balance - _token_amount, updated_at = now()
    WHERE user_id = _uid
    RETURNING token_balance INTO _bal;

  INSERT INTO public.gifts (live_id, sender_id, host_id, gift_key, token_amount)
  VALUES (_live_id, _uid, _live.host_id, _gift_key, _token_amount)
  RETURNING id INTO _gift_id;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
  VALUES (_uid, 'spend', _token_amount, 'completed', 'gift:' || _gift_id::text);

  RETURN QUERY SELECT _gift_id, _bal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, text, numeric) TO authenticated;

-- Settlement function
CREATE OR REPLACE FUNCTION public.settle_live_earnings(_live_id uuid)
RETURNS TABLE (live_id uuid, gross numeric, host_share numeric, platform_share numeric, host_pct int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _live public.lives;
  _tickets numeric := 0;
  _gifts numeric := 0;
  _gross numeric := 0;
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

  SELECT COALESCE(SUM(price_tokens),0) INTO _tickets
    FROM public.live_tickets WHERE live_id = _live_id;
  SELECT COALESCE(SUM(token_amount),0) INTO _gifts
    FROM public.gifts WHERE live_id = _live_id;
  _gross := _tickets + _gifts;

  SELECT * INTO _split FROM public.calculate_live_duration_payout(_live_id);

  _host_share := ROUND(_gross * COALESCE(_split.host_pct,0) / 100.0, 4);
  _plat_share := _gross - _host_share;

  UPDATE public.lives
    SET settled_at = now(),
        gross_tokens = _gross,
        host_earning = _host_share,
        platform_earning = _plat_share,
        updated_at = now()
    WHERE id = _live_id;

  IF _host_share > 0 THEN
    UPDATE public.profiles
      SET available_earnings = COALESCE(available_earnings,0) + _host_share,
          total_lifetime_earnings = COALESCE(total_lifetime_earnings,0) + _host_share,
          updated_at = now()
      WHERE user_id = _live.host_id;
  END IF;

  RETURN QUERY SELECT _live.id, _gross, _host_share, _plat_share, _split.host_pct;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_live_earnings(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_live_earnings(uuid) TO service_role;

-- Trigger: auto-settle when a live transitions to ended
CREATE OR REPLACE FUNCTION public.trg_settle_on_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ended' AND (OLD.status IS DISTINCT FROM 'ended') THEN
    IF NEW.ended_at IS NULL THEN
      NEW.ended_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lives_set_ended_at ON public.lives;
CREATE TRIGGER lives_set_ended_at
BEFORE UPDATE ON public.lives
FOR EACH ROW EXECUTE FUNCTION public.trg_settle_on_end();

CREATE OR REPLACE FUNCTION public.trg_settle_after_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ended' AND (OLD.status IS DISTINCT FROM 'ended') AND NEW.settled_at IS NULL THEN
    PERFORM public.settle_live_earnings(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS lives_settle_after_end ON public.lives;
CREATE TRIGGER lives_settle_after_end
AFTER UPDATE ON public.lives
FOR EACH ROW EXECUTE FUNCTION public.trg_settle_after_end();

-- Host earnings dashboard aggregate
CREATE OR REPLACE FUNCTION public.host_earnings_stats(_host_id uuid DEFAULT NULL)
RETURNS TABLE (
  available_earnings numeric,
  pending_withdrawals numeric,
  paid_withdrawals numeric,
  total_lifetime_earnings numeric,
  total_live_views bigint,
  total_gifts_received bigint,
  total_gift_tokens numeric,
  total_likes_received bigint,
  total_watch_seconds bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
              WHERE l.host_id = _uid),0),
    COALESCE((SELECT COUNT(*) FROM public.gifts WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(token_amount) FROM public.gifts WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(like_count)::bigint FROM public.lives WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(l.ended_at, now()) - l.started_at)))::bigint
              FROM public.lives l WHERE l.host_id = _uid AND l.started_at IS NOT NULL),0)
  FROM public.profiles p WHERE p.user_id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.host_earnings_stats(uuid) TO authenticated;
