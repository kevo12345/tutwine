-- Recalculate host share based on actual session duration
CREATE OR REPLACE FUNCTION public.settle_live_session_earnings(_session_id uuid)
RETURNS TABLE(session_id uuid, duration_seconds integer, host_pct integer, gross numeric, host_share numeric, platform_share numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _s public.live_sessions;
  _secs integer;
  _pct integer;
  _gross numeric;
  _host numeric;
  _plat numeric;
  _delta numeric;
  _mins integer;
BEGIN
  SELECT * INTO _s FROM public.live_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live session not found'; END IF;
  IF _s.status = 'active' THEN RAISE EXCEPTION 'live not ended'; END IF;

  _secs := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(_s.ended_at, now()) - COALESCE(_s.started_at, _s.created_at))))::int);
  _pct := CASE WHEN _secs >= 3600 THEN 60 ELSE 10 END;

  _gross := COALESCE(_s.gross_tokens, 0);
  _host := ROUND(_gross * _pct / 100.0, 4);
  _plat := _gross - _host;
  _delta := _host - COALESCE(_s.host_earning, 0);

  UPDATE public.live_sessions
     SET host_earning = _host,
         platform_earning = _plat,
         updated_at = now()
   WHERE id = _session_id;

  IF _delta <> 0 THEN
    UPDATE public.profiles
       SET available_earnings = GREATEST(0, COALESCE(available_earnings,0) + _delta),
           total_lifetime_earnings = GREATEST(0, COALESCE(total_lifetime_earnings,0) + _delta),
           updated_at = now()
     WHERE user_id = _s.host_id;
  END IF;

  _mins := _secs / 60;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _s.host_id,
    'live_settlement',
    CASE WHEN _pct = 60 THEN 'Live settled — you kept 60%' ELSE 'Live settled — you kept 10%' END,
    'Your live lasted ' || (_mins / 60) || 'h ' || (_mins % 60) || 'm ' || (_secs % 60) || 's. '
      || CASE WHEN _pct = 60
              THEN 'It reached 1 hour, so you earned 60% of ' || _gross || ' coins.'
              ELSE 'It ended before 1 hour, so you earned only 10% of ' || _gross || ' coins. Stream for at least 1 hour to keep 60%.'
         END,
    jsonb_build_object('session_id', _session_id, 'duration_seconds', _secs, 'host_pct', _pct, 'gross_tokens', _gross, 'host_earning', _host)
  );

  RETURN QUERY SELECT _session_id, _secs, _pct, _gross, _host, _plat;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_live_session_earnings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_live_session_earnings(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_settle_live_session_after_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    PERFORM public.settle_live_session_earnings(NEW.id);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_settle_live_session_after_end ON public.live_sessions;
CREATE TRIGGER trg_settle_live_session_after_end
AFTER UPDATE OF status ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_settle_live_session_after_end();