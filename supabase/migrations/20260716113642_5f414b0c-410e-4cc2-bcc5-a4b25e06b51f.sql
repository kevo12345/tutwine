
-- Withdrawals table
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  cooldown_until timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  processed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update withdrawals" ON public.withdrawals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER withdrawals_updated_at BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX withdrawals_user_requested_idx ON public.withdrawals (user_id, requested_at DESC);

-- Convert earnings to tokens (1:1)
CREATE OR REPLACE FUNCTION public.convert_earnings_to_tokens(_amount numeric)
RETURNS TABLE(new_available numeric, new_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _avail numeric;
  _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  SELECT available_earnings, token_balance INTO _avail, _bal
    FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_avail,0) < _amount THEN
    RAISE EXCEPTION 'insufficient earnings' USING HINT='insufficient_earnings';
  END IF;

  UPDATE public.profiles
    SET available_earnings = COALESCE(available_earnings,0) - _amount,
        token_balance = COALESCE(token_balance,0) + _amount,
        updated_at = now()
    WHERE user_id = _uid
    RETURNING available_earnings, token_balance INTO _avail, _bal;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
    VALUES (_uid, 'earnings_conversion', _amount, 'completed', 'convert_earnings');

  RETURN QUERY SELECT _avail, _bal;
END;
$$;

-- Renew subscription with earnings
CREATE OR REPLACE FUNCTION public.renew_subscription_with_earnings()
RETURNS TABLE(subscription_id uuid, new_ends_at timestamptz, new_available numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub public.subscriptions;
  _avail numeric;
  _price numeric;
  _new_end timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO _sub FROM public.subscriptions
    WHERE user_id = _uid AND status = 'active'
    ORDER BY started_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active subscription'; END IF;

  _price := COALESCE(_sub.price, 0);
  IF _price <= 0 THEN RAISE EXCEPTION 'invalid subscription price'; END IF;

  SELECT available_earnings INTO _avail FROM public.profiles
    WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_avail,0) < _price THEN
    RAISE EXCEPTION 'insufficient earnings' USING HINT='insufficient_earnings';
  END IF;

  _new_end := GREATEST(COALESCE(_sub.ends_at, now()), now()) + interval '30 days';

  UPDATE public.subscriptions
    SET ends_at = _new_end, updated_at = now()
    WHERE id = _sub.id;

  UPDATE public.profiles
    SET available_earnings = COALESCE(available_earnings,0) - _price, updated_at = now()
    WHERE user_id = _uid
    RETURNING available_earnings INTO _avail;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
    VALUES (_uid, 'subscription_renewal', _price, 'completed', 'renew_sub:' || _sub.id::text);

  RETURN QUERY SELECT _sub.id, _new_end, _avail;
END;
$$;

-- Request a withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _wallet_address text)
RETURNS TABLE(withdrawal_id uuid, new_available numeric, new_pending numeric, cooldown_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _avail numeric;
  _pending numeric;
  _last_req timestamptz;
  _cool timestamptz;
  _wid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 100 THEN
    RAISE EXCEPTION 'minimum withdrawal is 100';
  END IF;
  IF _wallet_address IS NULL OR length(trim(_wallet_address)) < 10 THEN
    RAISE EXCEPTION 'invalid wallet address';
  END IF;

  -- Cooldown check
  SELECT MAX(w.cooldown_until) INTO _last_req FROM public.withdrawals w
    WHERE w.user_id = _uid;
  IF _last_req IS NOT NULL AND _last_req > now() THEN
    RAISE EXCEPTION 'cooldown active until %', _last_req USING HINT='cooldown';
  END IF;

  SELECT available_earnings, pending_withdrawals INTO _avail, _pending
    FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_avail,0) < _amount THEN
    RAISE EXCEPTION 'insufficient earnings' USING HINT='insufficient_earnings';
  END IF;

  _cool := now() + interval '72 hours';

  INSERT INTO public.withdrawals (user_id, amount, wallet_address, status, requested_at, cooldown_until)
    VALUES (_uid, _amount, trim(_wallet_address), 'pending', now(), _cool)
    RETURNING id INTO _wid;

  UPDATE public.profiles
    SET available_earnings = COALESCE(available_earnings,0) - _amount,
        pending_withdrawals = COALESCE(pending_withdrawals,0) + _amount,
        litecoin_wallet_address = trim(_wallet_address),
        updated_at = now()
    WHERE user_id = _uid
    RETURNING available_earnings, pending_withdrawals INTO _avail, _pending;

  RETURN QUERY SELECT _wid, _avail, _pending, _cool;
END;
$$;

-- Admin: approve withdrawal
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_withdrawal_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _w.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;

  UPDATE public.withdrawals
    SET status = 'paid', processed_at = now(), admin_note = _note, updated_at = now()
    WHERE id = _withdrawal_id;

  UPDATE public.profiles
    SET pending_withdrawals = GREATEST(0, COALESCE(pending_withdrawals,0) - _w.amount),
        updated_at = now()
    WHERE user_id = _w.user_id;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
    VALUES (_w.user_id, 'withdrawal', _w.amount, 'completed', 'withdrawal:' || _w.id::text);
END;
$$;

-- Admin: reject withdrawal
CREATE OR REPLACE FUNCTION public.reject_withdrawal(_withdrawal_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _w.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;

  UPDATE public.withdrawals
    SET status = 'rejected', processed_at = now(), admin_note = _note, updated_at = now()
    WHERE id = _withdrawal_id;

  -- Move amount back from pending to available (cooldown still applies from original request)
  UPDATE public.profiles
    SET pending_withdrawals = GREATEST(0, COALESCE(pending_withdrawals,0) - _w.amount),
        available_earnings = COALESCE(available_earnings,0) + _w.amount,
        updated_at = now()
    WHERE user_id = _w.user_id;
END;
$$;
