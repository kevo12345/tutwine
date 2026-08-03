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
  LEFT JOIN public.user_presence up ON up.user_id = p.user_id
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
  ORDER BY up.last_seen_at DESC NULLS LAST, p.created_at DESC
  LIMIT GREATEST(_limit, 0) OFFSET GREATEST(_offset, 0)
$function$;