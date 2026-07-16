
-- 1. Sweeper function: flip expired active subscriptions to 'expired'
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.subscriptions
     SET status = 'expired'
   WHERE status = 'active'
     AND ends_at IS NOT NULL
     AND ends_at <= now();
$$;

REVOKE EXECUTE ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;

-- Run immediately once to clean current data
SELECT public.expire_subscriptions();

-- 2. Schedule via pg_cron (every 5 minutes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-subscriptions') THEN
      PERFORM cron.unschedule('expire-subscriptions');
    END IF;
    PERFORM cron.schedule(
      'expire-subscriptions',
      '*/5 * * * *',
      $cron$ SELECT public.expire_subscriptions(); $cron$
    );
  END IF;
END $$;

-- 3. Update helpers so active_tier honours ends_at
CREATE OR REPLACE FUNCTION public.discover_profiles(_my_lat double precision, _my_lng double precision, _max_distance_km integer, _min_age integer, _max_age integer, _gender gender_type, _limit integer, _offset integer)
 RETURNS TABLE(user_id uuid, display_name text, photos text[], bio text, interests text[], gender gender_type, city text, country text, state text, verified boolean, age integer, distance_km numeric, active_tier subscription_tier, like_count integer, hide_distance boolean, hide_state boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid)
  SELECT
    p.user_id,
    p.display_name,
    p.photos,
    p.bio,
    p.interests,
    p.gender,
    p.city,
    p.country,
    CASE WHEN COALESCE(p.hide_state, false) THEN NULL ELSE p.state END AS state,
    p.verified,
    CASE
      WHEN p.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int
    END AS age,
    CASE
      WHEN _my_lat IS NULL OR _my_lng IS NULL OR p.latitude IS NULL OR p.longitude IS NULL
        THEN NULL
      ELSE ROUND(
        (6371 * acos(LEAST(1.0,
          cos(radians(_my_lat)) * cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians(_my_lng)) +
          sin(radians(_my_lat)) * sin(radians(p.latitude))
        )))::numeric, 1)
    END AS distance_km,
    (
      SELECT s.tier FROM public.subscriptions s
      WHERE s.user_id = p.user_id
        AND s.status = 'active'
        AND (s.ends_at IS NULL OR s.ends_at > now())
      ORDER BY s.started_at DESC LIMIT 1
    ) AS active_tier,
    COALESCE((
      SELECT count(*)::int FROM public.swipes
      WHERE target_id = p.user_id AND action = 'like'
    ), 0) AS like_count,
    p.hide_distance,
    p.hide_state,
    p.created_at
  FROM public.profiles p
  WHERE p.user_id <> (SELECT uid FROM me)
    AND p.onboarding_complete = true
    AND p.suspended = false
    AND p.display_name IS NOT NULL
    AND array_length(p.photos, 1) > 0
    AND p.user_id NOT IN (
      SELECT target_id FROM public.swipes WHERE swiper_id = (SELECT uid FROM me)
    )
    AND p.user_id NOT IN (
      SELECT blocked_id FROM public.blocked_users WHERE blocker_id = (SELECT uid FROM me)
    )
    AND (_gender IS NULL OR p.gender = _gender)
    AND (
      p.date_of_birth IS NULL OR
      EXTRACT(YEAR FROM AGE(p.date_of_birth))::int BETWEEN _min_age AND _max_age
    )
    AND (
      _my_lat IS NULL OR _my_lng IS NULL OR p.latitude IS NULL OR p.longitude IS NULL OR
      (6371 * acos(LEAST(1.0,
        cos(radians(_my_lat)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(_my_lng)) +
        sin(radians(_my_lat)) * sin(radians(p.latitude))
      ))) <= _max_distance_km
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(_limit, 0) OFFSET GREATEST(_offset, 0)
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_public(_target uuid)
 RETURNS TABLE(user_id uuid, display_name text, photos text[], bio text, interests text[], gender gender_type, interested_in gender_type[], city text, country text, state text, verified boolean, suspended boolean, hide_distance boolean, hide_state boolean, onboarding_complete boolean, created_at timestamp with time zone, updated_at timestamp with time zone, age integer, like_count integer, active_tier subscription_tier)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id, p.display_name, p.photos, p.bio, p.interests,
    p.gender, p.interested_in, p.city, p.country,
    CASE WHEN COALESCE(p.hide_state, false) THEN NULL ELSE p.state END,
    p.verified, p.suspended, p.hide_distance, p.hide_state,
    p.onboarding_complete, p.created_at, p.updated_at,
    CASE WHEN p.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int END,
    COALESCE((SELECT count(*)::int FROM public.swipes WHERE target_id = p.user_id AND action = 'like'), 0),
    (SELECT s.tier FROM public.subscriptions s
       WHERE s.user_id = p.user_id
         AND s.status = 'active'
         AND (s.ends_at IS NULL OR s.ends_at > now())
       ORDER BY s.started_at DESC LIMIT 1)
  FROM public.profiles p
  WHERE p.user_id = _target
$function$;

CREATE OR REPLACE FUNCTION public.get_profiles_public(_targets uuid[])
 RETURNS TABLE(user_id uuid, display_name text, photos text[], bio text, interests text[], gender gender_type, interested_in gender_type[], city text, country text, state text, verified boolean, suspended boolean, hide_distance boolean, hide_state boolean, onboarding_complete boolean, created_at timestamp with time zone, updated_at timestamp with time zone, age integer, like_count integer, active_tier subscription_tier)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id, p.display_name, p.photos, p.bio, p.interests,
    p.gender, p.interested_in, p.city, p.country,
    CASE WHEN COALESCE(p.hide_state, false) THEN NULL ELSE p.state END,
    p.verified, p.suspended, p.hide_distance, p.hide_state,
    p.onboarding_complete, p.created_at, p.updated_at,
    CASE WHEN p.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int END,
    COALESCE((SELECT count(*)::int FROM public.swipes WHERE target_id = p.user_id AND action = 'like'), 0),
    (SELECT s.tier FROM public.subscriptions s
       WHERE s.user_id = p.user_id
         AND s.status = 'active'
         AND (s.ends_at IS NULL OR s.ends_at > now())
       ORDER BY s.started_at DESC LIMIT 1)
  FROM public.profiles p
  WHERE p.user_id = ANY(_targets)
$function$;
