
-- Token transactions ledger
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'purchase' CHECK (type IN ('purchase','spend','refund','bonus')),
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text CHECK (payment_method IN ('mpesa','litecoin')),
  payment_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.token_transactions TO authenticated;
GRANT ALL ON public.token_transactions TO service_role;

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own token txs"
  ON public.token_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users may only insert pending purchase rows for themselves; status/amount limits enforced.
CREATE POLICY "users insert own pending purchase"
  ON public.token_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND type = 'purchase'
    AND status = 'pending'
    AND amount >= 3
    AND payment_method IN ('mpesa','litecoin')
  );

CREATE INDEX IF NOT EXISTS token_transactions_user_created_idx
  ON public.token_transactions (user_id, created_at DESC);

CREATE TRIGGER trg_token_transactions_updated_at
  BEFORE UPDATE ON public.token_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic completion: marks a pending purchase completed and increments profile balance.
-- Only callable by service_role (edge function). Idempotent: no-op if already completed.
CREATE OR REPLACE FUNCTION public.complete_token_purchase(_tx_id uuid, _payment_ref text DEFAULT NULL)
RETURNS TABLE(user_id uuid, amount numeric, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx public.token_transactions;
  bal numeric;
BEGIN
  SELECT * INTO tx FROM public.token_transactions WHERE id = _tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;
  IF tx.status = 'completed' THEN
    SELECT p.token_balance INTO bal FROM public.profiles p WHERE p.user_id = tx.user_id;
    RETURN QUERY SELECT tx.user_id, tx.amount, bal;
    RETURN;
  END IF;
  IF tx.status <> 'pending' THEN
    RAISE EXCEPTION 'transaction not pending (status=%)', tx.status;
  END IF;
  IF tx.type <> 'purchase' THEN
    RAISE EXCEPTION 'not a purchase transaction';
  END IF;

  UPDATE public.token_transactions
     SET status = 'completed',
         payment_ref = COALESCE(_payment_ref, payment_ref),
         updated_at = now()
   WHERE id = _tx_id;

  UPDATE public.profiles
     SET token_balance = COALESCE(token_balance, 0) + tx.amount,
         updated_at = now()
   WHERE profiles.user_id = tx.user_id
  RETURNING token_balance INTO bal;

  RETURN QUERY SELECT tx.user_id, tx.amount, bal;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_token_purchase(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_token_purchase(uuid, text) TO service_role;

-- Companion: mark failed (also service_role only)
CREATE OR REPLACE FUNCTION public.fail_token_purchase(_tx_id uuid, _payment_ref text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.token_transactions
     SET status = 'failed',
         payment_ref = COALESCE(_payment_ref, payment_ref),
         updated_at = now()
   WHERE id = _tx_id AND status = 'pending';
$$;

REVOKE ALL ON FUNCTION public.fail_token_purchase(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_token_purchase(uuid, text) TO service_role;
