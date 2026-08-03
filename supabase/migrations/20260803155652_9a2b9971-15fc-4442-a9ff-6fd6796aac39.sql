CREATE OR REPLACE FUNCTION public.admin_live_session_detail(_live_id uuid, _source text)
RETURNS TABLE(
  kind text,
  event_id uuid,
  user_id uuid,
  display_name text,
  emrand_id text,
  label text,
  coins numeric,
  host_share numeric,
  platform_share numeric,
  created_at timestamp with time zone,
  expires_at timestamp with time zone
)
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
    SELECT s.host_id, COALESCE(s.started_at, s.created_at), COALESCE(s.expires_at, now())
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