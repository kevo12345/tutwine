
-- Constants: 1 token per 1-hour live ticket
-- (Kept in code via RPC; no config table needed for MVP.)

-- ============================================================================
-- live_tickets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  price_tokens numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_tickets TO authenticated;
GRANT ALL ON public.live_tickets TO service_role;

ALTER TABLE public.live_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS live_tickets_user_live_idx
  ON public.live_tickets (user_id, live_id, expires_at DESC);

-- Viewers see their own; hosts see all tickets for their own lives (analytics)
CREATE POLICY "read own tickets"
  ON public.live_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lives l
      WHERE l.id = live_tickets.live_id AND l.host_id = auth.uid()
    )
  );

-- INSERT only via RPC (no client-side INSERT grant)

-- ============================================================================
-- live_participants (for moderation flags like is_muted)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_id, user_id)
);

GRANT SELECT, INSERT ON public.live_participants TO authenticated;
GRANT UPDATE (is_muted) ON public.live_participants TO authenticated;
GRANT ALL ON public.live_participants TO service_role;

ALTER TABLE public.live_participants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_live_participants_updated_at
  BEFORE UPDATE ON public.live_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anyone in the live can see participants (needed for host UI + mute state broadcast)
CREATE POLICY "read live participants"
  ON public.live_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lives l
      WHERE l.id = live_participants.live_id AND l.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_tickets t
      WHERE t.live_id = live_participants.live_id
        AND t.user_id = auth.uid()
        AND t.expires_at > now()
    )
  );

-- Users register their own presence
CREATE POLICY "insert own participant row"
  ON public.live_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only the host can change is_muted (column-level grant already scopes columns)
CREATE POLICY "host mutes viewers"
  ON public.live_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lives l
      WHERE l.id = live_participants.live_id AND l.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lives l
      WHERE l.id = live_participants.live_id AND l.host_id = auth.uid()
    )
  );

-- ============================================================================
-- live_chat_messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS live_chat_messages_live_created_idx
  ON public.live_chat_messages (live_id, created_at);

-- Read: host + anyone with a valid ticket
CREATE POLICY "read live chat"
  ON public.live_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lives l
      WHERE l.id = live_chat_messages.live_id AND l.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_tickets t
      WHERE t.live_id = live_chat_messages.live_id
        AND t.user_id = auth.uid()
        AND t.expires_at > now()
    )
  );

-- Post: must be author, must have active subscription, and (host OR valid ticket)
-- Also: not muted by host
CREATE POLICY "post live chat (subscribers only)"
  ON public.live_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_active_subscription(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.live_participants p
      WHERE p.live_id = live_chat_messages.live_id
        AND p.user_id = auth.uid()
        AND p.is_muted = true
    )
    AND (
      EXISTS (SELECT 1 FROM public.lives l
              WHERE l.id = live_chat_messages.live_id AND l.host_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.live_tickets t
                 WHERE t.live_id = live_chat_messages.live_id
                   AND t.user_id = auth.uid()
                   AND t.expires_at > now())
    )
  );

-- ============================================================================
-- RPC: purchase_live_ticket
-- Deducts tokens atomically, inserts ticket + token_transactions row.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purchase_live_ticket(_live_id uuid)
RETURNS TABLE(
  ticket_id uuid,
  expires_at timestamptz,
  new_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _price numeric := 1; -- 1 token per hour
  _live record;
  _bal numeric;
  _new_ticket_id uuid;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id, host_id, status INTO _live FROM public.lives WHERE id = _live_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'live not found';
  END IF;
  IF _live.status NOT IN ('live','paused') THEN
    RAISE EXCEPTION 'live not active';
  END IF;

  -- Host doesn't need a ticket (short-circuit for callers that don't check)
  IF _live.host_id = _uid THEN
    _exp := now() + interval '1 hour';
    INSERT INTO public.live_tickets (live_id, user_id, expires_at, price_tokens)
    VALUES (_live_id, _uid, _exp, 0)
    RETURNING id INTO _new_ticket_id;
    SELECT token_balance INTO _bal FROM public.profiles WHERE user_id = _uid;
    RETURN QUERY SELECT _new_ticket_id, _exp, _bal;
    RETURN;
  END IF;

  -- Lock the buyer's profile row for atomic deduction
  SELECT token_balance INTO _bal FROM public.profiles
    WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _price THEN
    RAISE EXCEPTION 'insufficient tokens' USING ERRCODE = 'P0001', HINT = 'insufficient_tokens';
  END IF;

  UPDATE public.profiles
     SET token_balance = token_balance - _price,
         updated_at = now()
   WHERE user_id = _uid
  RETURNING token_balance INTO _bal;

  _exp := now() + interval '1 hour';
  INSERT INTO public.live_tickets (live_id, user_id, expires_at, price_tokens)
  VALUES (_live_id, _uid, _exp, _price)
  RETURNING id INTO _new_ticket_id;

  INSERT INTO public.token_transactions (user_id, type, amount, status, payment_ref)
  VALUES (_uid, 'spend', _price, 'completed', 'live_ticket:' || _live_id::text);

  -- Register participant row if missing so mute state can attach
  INSERT INTO public.live_participants (live_id, user_id)
  VALUES (_live_id, _uid)
  ON CONFLICT (live_id, user_id) DO NOTHING;

  RETURN QUERY SELECT _new_ticket_id, _exp, _bal;
END;
$$;

-- Widen token_transactions insert check to allow spend rows via SECURITY DEFINER
-- (the RPC runs as owner so it bypasses RLS anyway, but keep the CHECK sensible)
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_type_check;
ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_type_check
  CHECK (type IN ('purchase','spend','refund','bonus'));

REVOKE ALL ON FUNCTION public.purchase_live_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_live_ticket(uuid) TO authenticated, service_role;

-- ============================================================================
-- RPC: like_live (unlimited taps)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.like_live(_live_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  -- Must have a valid ticket or be host
  IF NOT EXISTS (
    SELECT 1 FROM public.lives WHERE id = _live_id AND host_id = _uid
  ) AND NOT EXISTS (
    SELECT 1 FROM public.live_tickets
    WHERE live_id = _live_id AND user_id = _uid AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'no access to live';
  END IF;

  UPDATE public.lives
     SET like_count = like_count + 1,
         updated_at = now()
   WHERE id = _live_id
  RETURNING like_count INTO _new;

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.like_live(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.like_live(uuid) TO authenticated, service_role;

-- ============================================================================
-- Direct 1:1 messaging: also require an active subscription to send
-- ============================================================================
DROP POLICY IF EXISTS "Users can send messages in their matches" ON public.messages;
CREATE POLICY "Users can send messages in their matches"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.has_active_subscription(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = messages.match_id
        AND (matches.user_a = auth.uid() OR matches.user_b = auth.uid())
    )
  );

-- ============================================================================
-- Realtime for new tables (lives already added earlier)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_participants;
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_participants REPLICA IDENTITY FULL;
