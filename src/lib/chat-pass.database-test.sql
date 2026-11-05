-- Transactional regression checks; all test changes are rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub', '65505aa0-d47d-4d77-af8a-ad8c4f5b16da', true);
UPDATE public.subscriptions SET status='expired' WHERE user_id=auth.uid();
UPDATE public.profiles SET token_balance=2,suspended=false WHERE user_id=auth.uid();
DELETE FROM public.chat_passes WHERE user_id=auth.uid();
DO $$
DECLARE result record; second_result record;
BEGIN
  IF public.has_private_chat_access() THEN RAISE EXCEPTION 'Access without a pass'; END IF;
  SELECT * INTO result FROM public.purchase_chat_pass();
  IF result.new_balance <> 1 THEN RAISE EXCEPTION 'Pass must deduct exactly one coin'; END IF;
  IF result.expires_at <> now()+interval '12 hours' THEN RAISE EXCEPTION 'Pass must last exactly twelve hours'; END IF;
  IF NOT public.has_private_chat_access() THEN RAISE EXCEPTION 'Purchased pass must enable all private chats'; END IF;
  SELECT * INTO second_result FROM public.purchase_chat_pass();
  IF second_result.new_balance <> 1 OR second_result.expires_at <> result.expires_at THEN RAISE EXCEPTION 'Repeat request must not charge twice'; END IF;
  UPDATE public.chat_passes SET started_at=now()-interval '12 hours', expires_at=now() WHERE user_id=auth.uid();
  IF public.has_private_chat_access() THEN RAISE EXCEPTION 'Access must stop at expiry'; END IF;
  UPDATE public.profiles SET token_balance=0 WHERE user_id=auth.uid();
  BEGIN
    PERFORM public.purchase_chat_pass();
    RAISE EXCEPTION 'Zero balance purchase unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Not enough coins' THEN RAISE; END IF;
  END;
  INSERT INTO public.token_transactions(user_id,type,amount,status) VALUES(auth.uid(),'purchase',1,'pending');
  BEGIN
    INSERT INTO public.token_transactions(user_id,type,amount,status) VALUES(auth.uid(),'purchase',14,'pending');
    RAISE EXCEPTION 'Invalid custom purchase unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'minimum custom purchase amount is 15' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;