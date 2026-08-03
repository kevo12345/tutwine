CREATE OR REPLACE FUNCTION public.admin_live_overview(_include_ended boolean DEFAULT false)
RETURNS TABLE(
  live_id uuid,
  source text,
  host_id uuid,
  display_name text,
  emrand_id text,
  title text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  hours_running numeric,
  viewers_now integer,
  tickets_sold integer,
  ticket_tokens numeric,
  gifts_count integer,
  gift_tokens numeric,
  likes integer,
  host_earning numeric,
  platform_earning numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    CASE WHEN s.status <> 'active' THEN s.updated_at END,
    ROUND(GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(s.expires_at, now()), now()) - COALESCE(s.started_at, s.created_at))))::numeric / 3600.0, 2),
    COALESCE((SELECT count(*)::int FROM public.live_passes lp
              WHERE lp.session_id = s.id AND lp.status = 'active' AND lp.expires_at > now()), 0),
    COALESCE((SELECT count(*)::int FROM public.live_passes lp WHERE lp.session_id = s.id), 0),
    COALESCE((SELECT SUM(lp.amount_paid_usd) FROM public.live_passes lp WHERE lp.session_id = s.id), 0),
    COALESCE((SELECT count(*)::int FROM public.gifts g
              WHERE g.host_id = s.host_id AND g.created_at >= COALESCE(s.started_at, s.created_at)
                AND g.created_at <= COALESCE(s.expires_at, now())), 0),
    COALESCE((SELECT SUM(g.token_amount) FROM public.gifts g
              WHERE g.host_id = s.host_id AND g.created_at >= COALESCE(s.started_at, s.created_at)
                AND g.created_at <= COALESCE(s.expires_at, now())), 0),
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_live_overview(boolean) TO authenticated;