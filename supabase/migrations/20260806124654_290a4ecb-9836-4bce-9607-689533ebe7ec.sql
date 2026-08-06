ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

UPDATE public.live_sessions
   SET ended_at = LEAST(COALESCE(expires_at, updated_at), updated_at)
 WHERE status <> 'active' AND ended_at IS NULL;

-- Stamp the real end time and close viewer tickets the moment a live stops.
CREATE OR REPLACE FUNCTION public.trg_live_session_ended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    IF NEW.ended_at IS NULL THEN
      NEW.ended_at := now();
    END IF;
    IF NEW.expires_at IS NULL OR NEW.expires_at > NEW.ended_at THEN
      NEW.expires_at := NEW.ended_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_session_ended ON public.live_sessions;
CREATE TRIGGER live_session_ended
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_live_session_ended();

CREATE OR REPLACE FUNCTION public.trg_live_session_expire_passes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    UPDATE public.live_passes lp
       SET status = 'expired',
           expires_at = LEAST(lp.expires_at, COALESCE(NEW.ended_at, now())),
           updated_at = now()
     WHERE lp.session_id = NEW.id
       AND lp.status = 'active';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS live_session_expire_passes ON public.live_sessions;
CREATE TRIGGER live_session_expire_passes
AFTER UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_live_session_expire_passes();

CREATE OR REPLACE FUNCTION public.end_live_session(_session_id uuid)
 RETURNS TABLE(id uuid, status live_status, ended_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.host_id INTO v_host FROM public.live_sessions s WHERE s.id = _session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Live session not found';
  END IF;
  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'Only the host can end this live';
  END IF;

  UPDATE public.live_sessions s
     SET status = 'ended',
         ended_at = now(),
         expires_at = now(),
         updated_at = now()
   WHERE s.id = _session_id
     AND s.status = 'active';

  RETURN QUERY
    SELECT s.id, s.status, s.ended_at FROM public.live_sessions s WHERE s.id = _session_id;
END;
$function$;

-- Dashboards: measure real elapsed time, not the purchased duration.
CREATE OR REPLACE FUNCTION public.admin_live_overview(_include_ended boolean DEFAULT false)
 RETURNS TABLE(live_id uuid, source text, host_id uuid, display_name text, emrand_id text, title text, status text, started_at timestamp with time zone, ended_at timestamp with time zone, hours_running numeric, viewers_now integer, tickets_sold integer, ticket_tokens numeric, gifts_count integer, gift_tokens numeric, likes integer, host_earning numeric, platform_earning numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    'session'::text,
    s.host_id,
    p.display_name,
    p.emrand_id,
    NULL::text,
    s.status::text,
    s.started_at,
    s.ended_at,
    ROUND(GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(s.ended_at, now()) - COALESCE(s.started_at, s.created_at))))::numeric / 3600.0, 2),
    COALESCE((SELECT count(*)::int FROM public.live_passes lp
              WHERE lp.session_id = s.id AND lp.status = 'active' AND lp.expires_at > now()), 0),
    COALESCE((SELECT count(*)::int FROM public.live_passes lp WHERE lp.session_id = s.id), 0),
    COALESCE((SELECT SUM(lp.amount_paid_usd) FROM public.live_passes lp WHERE lp.session_id = s.id), 0),
    COALESCE((SELECT count(*)::int FROM public.gifts g
              WHERE g.host_id = s.host_id AND g.created_at >= COALESCE(s.started_at, s.created_at)
                AND g.created_at <= COALESCE(s.ended_at, now())), 0),
    COALESCE((SELECT SUM(g.token_amount) FROM public.gifts g
              WHERE g.host_id = s.host_id AND g.created_at >= COALESCE(s.started_at, s.created_at)
                AND g.created_at <= COALESCE(s.ended_at, now())), 0),
    COALESCE(s.like_count, 0),
    COALESCE(s.host_earning, 0),
    COALESCE(s.platform_earning, 0)
  FROM public.live_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.host_id
  WHERE _include_ended OR (s.status = 'active' AND s.expires_at > now())

  UNION ALL

  SELECT
    l.id,
    'live'::text,
    l.host_id,
    p.display_name,
    p.emrand_id,
    l.title,
    l.status,
    l.started_at,
    l.ended_at,
    ROUND(GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(l.ended_at, now()) - l.started_at)))::numeric / 3600.0, 2),
    COALESCE((SELECT count(*)::int FROM public.live_tickets t
              WHERE t.live_id = l.id AND t.expires_at > now()), 0),
    COALESCE((SELECT count(*)::int FROM public.live_tickets t WHERE t.live_id = l.id), 0),
    COALESCE((SELECT SUM(t.price_tokens) FROM public.live_tickets t WHERE t.live_id = l.id), 0),
    COALESCE((SELECT count(*)::int FROM public.gifts g WHERE g.live_id = l.id), 0),
    COALESCE((SELECT SUM(g.token_amount) FROM public.gifts g WHERE g.live_id = l.id), 0),
    COALESCE(l.like_count, 0),
    COALESCE(l.host_earning, 0),
    COALESCE(l.platform_earning, 0)
  FROM public.lives l
  LEFT JOIN public.profiles p ON p.user_id = l.host_id
  WHERE _include_ended OR l.status IN ('live', 'paused')

  ORDER BY started_at DESC NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_live_session_detail(_live_id uuid, _source text)
 RETURNS TABLE(kind text, event_id uuid, user_id uuid, display_name text, emrand_id text, label text, coins numeric, host_share numeric, platform_share numeric, created_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _host uuid;
  _from timestamptz;
  _to timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _source = 'session' THEN
    SELECT s.host_id, COALESCE(s.started_at, s.created_at), COALESCE(s.ended_at, now())
      INTO _host, _from, _to
      FROM public.live_sessions s WHERE s.id = _live_id;
    IF _host IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

    RETURN QUERY
    SELECT 'ticket'::text, lp.id, lp.viewer_id, p.display_name, p.emrand_id,
           (lp.duration_hours::text || 'h pass')::text,
           COALESCE(lp.amount_paid_usd, 0),
           ROUND(COALESCE(lp.amount_paid_usd,0) * 0.60, 4),
           COALESCE(lp.amount_paid_usd,0) - ROUND(COALESCE(lp.amount_paid_usd,0) * 0.60, 4),
           lp.created_at, lp.expires_at
      FROM public.live_passes lp
      LEFT JOIN public.profiles p ON p.user_id = lp.viewer_id
     WHERE lp.session_id = _live_id
    UNION ALL
    SELECT 'gift'::text, g.id, g.sender_id, p.display_name, p.emrand_id,
           COALESCE(gc.label, g.gift_key),
           g.token_amount,
           ROUND(g.token_amount * 0.60, 4),
           g.token_amount - ROUND(g.token_amount * 0.60, 4),
           g.created_at, NULL::timestamptz
      FROM public.gifts g
      LEFT JOIN public.profiles p ON p.user_id = g.sender_id
      LEFT JOIN public.gift_catalog gc ON gc.key = g.gift_key
     WHERE g.host_id = _host AND g.created_at >= _from AND g.created_at <= _to
    ORDER BY 10 DESC;

  ELSE
    SELECT l.host_id INTO _host FROM public.lives l WHERE l.id = _live_id;
    IF _host IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

    RETURN QUERY
    SELECT 'ticket'::text, t.id, t.user_id, p.display_name, p.emrand_id,
           '1h ticket'::text,
           COALESCE(t.price_tokens, 0),
           ROUND(COALESCE(t.price_tokens,0) * 0.60, 4),
           COALESCE(t.price_tokens,0) - ROUND(COALESCE(t.price_tokens,0) * 0.60, 4),
           t.created_at, t.expires_at
      FROM public.live_tickets t
      LEFT JOIN public.profiles p ON p.user_id = t.user_id
     WHERE t.live_id = _live_id
    UNION ALL
    SELECT 'gift'::text, g.id, g.sender_id, p.display_name, p.emrand_id,
           COALESCE(gc.label, g.gift_key),
           g.token_amount,
           ROUND(g.token_amount * 0.60, 4),
           g.token_amount - ROUND(g.token_amount * 0.60, 4),
           g.created_at, NULL::timestamptz
      FROM public.gifts g
      LEFT JOIN public.profiles p ON p.user_id = g.sender_id
      LEFT JOIN public.gift_catalog gc ON gc.key = g.gift_key
     WHERE g.live_id = _live_id
    ORDER BY 10 DESC;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_earnings_stats(_host_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(available_earnings numeric, pending_withdrawals numeric, paid_withdrawals numeric, total_lifetime_earnings numeric, total_live_views bigint, total_gifts_received bigint, total_gift_tokens numeric, total_likes_received bigint, total_watch_seconds bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := COALESCE(_host_id, auth.uid());
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _uid <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(p.available_earnings,0),
    COALESCE(p.pending_withdrawals,0),
    COALESCE((
      SELECT SUM(amount) FROM public.token_transactions
      WHERE user_id = _uid AND type = 'withdrawal' AND status = 'completed'
    ),0),
    COALESCE(p.total_lifetime_earnings,0),
    COALESCE((SELECT COUNT(*) FROM public.live_tickets t
              JOIN public.lives l ON l.id = t.live_id
              WHERE l.host_id = _uid),0)
    + COALESCE((SELECT COUNT(*) FROM public.live_passes lp
              JOIN public.live_sessions s ON s.id = lp.session_id
              WHERE s.host_id = _uid),0),
    COALESCE((SELECT COUNT(*) FROM public.gifts WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(token_amount) FROM public.gifts WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(like_count)::bigint FROM public.lives WHERE host_id = _uid),0)
    + COALESCE((SELECT SUM(like_count)::bigint FROM public.live_sessions WHERE host_id = _uid),0),
    COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(l.ended_at, now()) - l.started_at)))::bigint
              FROM public.lives l WHERE l.host_id = _uid AND l.started_at IS NOT NULL),0)
    + COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, now()) - s.started_at)))::bigint
              FROM public.live_sessions s WHERE s.host_id = _uid AND s.started_at IS NOT NULL),0)
  FROM public.profiles p WHERE p.user_id = _uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_live_overview(boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_live_overview(boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_live_session_detail(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_live_session_detail(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.host_earnings_stats(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.host_earnings_stats(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.end_live_session(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.end_live_session(uuid) TO authenticated, service_role;