CREATE OR REPLACE FUNCTION public.validate_token_purchase_amount()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type='purchase' AND TG_OP='INSERT' THEN
    IF NEW.amount IS NULL OR NEW.amount<=0 OR NEW.amount<>trunc(NEW.amount) THEN
      RAISE EXCEPTION 'invalid purchase amount';
    END IF;
    IF NEW.amount NOT IN (3,5,10,20) AND NEW.amount<15 THEN
      RAISE EXCEPTION 'coin purchases start at 3 coins; custom amounts start at 15';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;