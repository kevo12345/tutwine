CREATE OR REPLACE FUNCTION public.validate_token_purchase_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'purchase' THEN
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'invalid purchase amount';
    END IF;
    IF NEW.amount NOT IN (3, 5, 10) AND NEW.amount < 15 THEN
      RAISE EXCEPTION 'minimum custom purchase amount is 15';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;