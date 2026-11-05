CREATE TABLE public.chat_passes (user_id uuid PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, CONSTRAINT chat_pass_duration CHECK (expires_at > started_at));
GRANT SELECT ON public.chat_passes TO authenticated;
GRANT ALL ON public.chat_passes TO service_role;
ALTER TABLE public.chat_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own chat pass" ON public.chat_passes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.has_private_chat_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=auth.uid() AND status='active' AND tier <> 'free' AND (ends_at IS NULL OR ends_at > now())) OR EXISTS (SELECT 1 FROM public.chat_passes WHERE user_id=auth.uid() AND expires_at > now())); $$;
REVOKE ALL ON FUNCTION public.has_private_chat_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_private_chat_access() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.purchase_chat_pass() RETURNS TABLE(expires_at timestamptz,new_balance numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); bal numeric; expiry timestamptz;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT p.token_balance INTO bal FROM public.profiles p WHERE p.user_id=uid AND NOT p.suspended FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 SELECT cp.expires_at INTO expiry FROM public.chat_passes cp WHERE cp.user_id=uid AND cp.expires_at>now();
 IF expiry IS NOT NULL THEN RETURN QUERY SELECT expiry,bal; RETURN; END IF;
 IF public.has_private_chat_access() THEN RAISE EXCEPTION 'Chat is already included in your subscription'; END IF;
 IF bal < 1 THEN RAISE EXCEPTION 'Not enough coins'; END IF;
 expiry := now() + interval '12 hours';
 UPDATE public.profiles p SET token_balance=p.token_balance-1 WHERE p.user_id=uid RETURNING p.token_balance INTO bal;
 INSERT INTO public.chat_passes(user_id,started_at,expires_at) VALUES(uid,now(),expiry) ON CONFLICT(user_id) DO UPDATE SET started_at=excluded.started_at,expires_at=excluded.expires_at;
 INSERT INTO public.token_transactions(user_id,type,amount,status,payment_ref) VALUES(uid,'spend',1,'completed','chat_pass');
 RETURN QUERY SELECT expiry,bal;
END; $$;
REVOKE ALL ON FUNCTION public.purchase_chat_pass() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_chat_pass() TO authenticated;
ALTER POLICY "Users can send messages in their matches" ON public.messages TO authenticated WITH CHECK (auth.uid()=sender_id AND public.has_private_chat_access() AND EXISTS(SELECT 1 FROM public.matches m WHERE m.id=messages.match_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())));
CREATE OR REPLACE FUNCTION public.validate_token_purchase_amount() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.type='purchase' THEN IF NEW.amount IS NULL OR NEW.amount<=0 OR NEW.amount<>trunc(NEW.amount) THEN RAISE EXCEPTION 'invalid purchase amount'; END IF; IF NEW.amount NOT IN (1,3,5,10) AND NEW.amount<15 THEN RAISE EXCEPTION 'minimum custom purchase amount is 15'; END IF; END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.open_private_chat(_target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); a uuid; b uuid; mid uuid;
BEGIN
 IF uid IS NULL OR _target IS NULL OR uid=_target THEN RAISE EXCEPTION 'Invalid conversation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=uid AND NOT suspended) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_target AND NOT suspended) THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.blocked_users WHERE (blocker_id=uid AND blocked_id=_target) OR (blocker_id=_target AND blocked_id=uid)) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 a:=least(uid,_target); b:=greatest(uid,_target);
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text || b::text,0));
 SELECT id INTO mid FROM public.matches WHERE user_a=a AND user_b=b;
 IF mid IS NULL THEN INSERT INTO public.matches(user_a,user_b) VALUES(a,b) RETURNING id INTO mid; END IF;
 RETURN mid;
END; $$;
REVOKE ALL ON FUNCTION public.open_private_chat(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_private_chat(uuid) TO authenticated;