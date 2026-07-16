
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Update approve_withdrawal to emit a notification
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_withdrawal_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _w.user_id,
    'withdrawal_approved',
    'Withdrawal approved',
    'Your withdrawal of ' || _w.amount::text || ' has been approved and paid.',
    jsonb_build_object('withdrawal_id', _w.id, 'amount', _w.amount, 'status', 'paid', 'note', _note)
  );
END;
$function$;

-- Update reject_withdrawal to emit a notification
CREATE OR REPLACE FUNCTION public.reject_withdrawal(_withdrawal_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE public.profiles
    SET pending_withdrawals = GREATEST(0, COALESCE(pending_withdrawals,0) - _w.amount),
        available_earnings = COALESCE(available_earnings,0) + _w.amount,
        updated_at = now()
    WHERE user_id = _w.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _w.user_id,
    'withdrawal_rejected',
    'Withdrawal rejected',
    'Your withdrawal of ' || _w.amount::text || ' was rejected and returned to your available earnings.'
      || CASE WHEN _note IS NOT NULL AND length(trim(_note)) > 0 THEN ' Reason: ' || _note ELSE '' END,
    jsonb_build_object('withdrawal_id', _w.id, 'amount', _w.amount, 'status', 'rejected', 'note', _note)
  );
END;
$function$;
