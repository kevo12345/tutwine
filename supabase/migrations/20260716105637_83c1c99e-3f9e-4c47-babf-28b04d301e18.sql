
-- Add EMRAND and earnings/token columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emrand_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS token_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_earnings numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_withdrawals numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_lifetime_earnings numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS litecoin_wallet_address text;

-- Format check: exactly 8 numeric digits when set
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_emrand_id_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_emrand_id_format
  CHECK (emrand_id IS NULL OR emrand_id ~ '^[0-9]{8}$');

-- Immutability trigger: once emrand_id is non-null, it cannot change
CREATE OR REPLACE FUNCTION public.prevent_emrand_id_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.emrand_id IS NOT NULL AND NEW.emrand_id IS DISTINCT FROM OLD.emrand_id THEN
    RAISE EXCEPTION 'emrand_id is immutable once assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_emrand_id_change ON public.profiles;
CREATE TRIGGER trg_prevent_emrand_id_change
BEFORE UPDATE OF emrand_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_emrand_id_change();

-- Generator: assigns a unique 8-digit emrand_id to the given user if not set.
-- Retries on collision. No-op if user already has one.
CREATE OR REPLACE FUNCTION public.assign_emrand_id(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing text;
  candidate text;
  attempts int := 0;
BEGIN
  SELECT emrand_id INTO existing FROM public.profiles WHERE user_id = _user_id;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  LOOP
    attempts := attempts + 1;
    candidate := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE emrand_id = candidate) THEN
      BEGIN
        UPDATE public.profiles
           SET emrand_id = candidate
         WHERE user_id = _user_id AND emrand_id IS NULL;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- race: another tx grabbed it; loop and retry
        NULL;
      END;
    END IF;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not allocate unique emrand_id after % attempts', attempts;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_emrand_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_emrand_id(uuid) TO service_role;

-- Auto-assign emrand_id when a subscription becomes active for the first time
CREATE OR REPLACE FUNCTION public.auto_assign_emrand_on_active_sub()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (NEW.ends_at IS NULL OR NEW.ends_at > now()) THEN
    PERFORM public.assign_emrand_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_emrand_on_active_sub ON public.subscriptions;
CREATE TRIGGER trg_auto_assign_emrand_on_active_sub
AFTER INSERT OR UPDATE OF status, ends_at ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_emrand_on_active_sub();

-- Backfill: any user with a currently active subscription gets an emrand_id now
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT s.user_id
    FROM public.subscriptions s
    JOIN public.profiles p ON p.user_id = s.user_id
    WHERE s.status = 'active'
      AND (s.ends_at IS NULL OR s.ends_at > now())
      AND p.emrand_id IS NULL
  LOOP
    PERFORM public.assign_emrand_id(r.user_id);
  END LOOP;
END $$;
