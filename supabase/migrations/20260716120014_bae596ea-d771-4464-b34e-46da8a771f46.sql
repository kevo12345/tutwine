
CREATE OR REPLACE FUNCTION public.validate_token_purchase_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'purchase' THEN
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'invalid purchase amount';
    END IF;
    IF NEW.amount NOT IN (3, 5) AND NEW.amount < 10 THEN
      RAISE EXCEPTION 'minimum custom purchase amount is 10';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_token_purchase_amount ON public.token_transactions;
CREATE TRIGGER trg_validate_token_purchase_amount
  BEFORE INSERT OR UPDATE ON public.token_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_token_purchase_amount();
