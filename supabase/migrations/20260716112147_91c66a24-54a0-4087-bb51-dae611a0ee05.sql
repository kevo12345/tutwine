
CREATE TABLE public.gift_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text NOT NULL,
  token_price numeric NOT NULL CHECK (token_price > 0),
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_catalog TO authenticated;
GRANT ALL ON public.gift_catalog TO service_role;

ALTER TABLE public.gift_catalog ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read active gifts
CREATE POLICY "gift_catalog_read_active" ON public.gift_catalog
FOR SELECT TO authenticated
USING (active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gift_catalog_admin_insert" ON public.gift_catalog
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gift_catalog_admin_update" ON public.gift_catalog
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gift_catalog_admin_delete" ON public.gift_catalog
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER gift_catalog_updated_at
BEFORE UPDATE ON public.gift_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.gift_catalog (key, label, emoji, token_price, sort_order) VALUES
  ('rose',    'Rose',    '🌹', 1,   10),
  ('heart',   'Heart',   '❤️', 5,   20),
  ('star',    'Star',    '⭐', 10,  30),
  ('crown',   'Crown',   '👑', 25,  40),
  ('diamond', 'Diamond', '💎', 50,  50),
  ('rocket',  'Rocket',  '🚀', 100, 60)
ON CONFLICT (key) DO NOTHING;

-- Harden send_gift so the client can't fabricate prices
CREATE OR REPLACE FUNCTION public.send_gift(_live_id uuid, _gift_key text, _token_amount numeric)
RETURNS TABLE (gift_id uuid, new_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _live record;
  _bal numeric;
  _gift_id uuid;
  _cat record;
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

  RETURN QUERY SELECT _gift_id, _bal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, text, numeric) TO authenticated;
