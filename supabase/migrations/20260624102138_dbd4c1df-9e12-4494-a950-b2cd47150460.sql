
-- ============================================================
-- 1) PROFILES: tighten direct-table SELECT to own row + admin
-- ============================================================
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) profiles_public view: cross-user safe data
--    Bypasses RLS on profiles (security_invoker = false) but
--    only exposes non-sensitive columns + derived age/like_count/tier.
-- ============================================================
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  p.user_id,
  p.display_name,
  p.photos,
  p.bio,
  p.interests,
  p.gender,
  p.interested_in,
  p.city,
  p.country,
  CASE WHEN COALESCE(p.hide_state, false) THEN NULL ELSE p.state END AS state,
  p.verified,
  p.suspended,
  p.hide_distance,
  p.hide_state,
  p.onboarding_complete,
  p.created_at,
  p.updated_at,
  CASE
    WHEN p.date_of_birth IS NOT NULL
      THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int
    ELSE NULL
  END AS age,
  COALESCE((
    SELECT count(*)::int FROM public.swipes
    WHERE target_id = p.user_id AND action = 'like'
  ), 0) AS like_count,
  (
    SELECT s.tier FROM public.subscriptions s
    WHERE s.user_id = p.user_id AND s.status = 'active'
    ORDER BY s.started_at DESC LIMIT 1
  ) AS active_tier
FROM public.profiles p;

GRANT SELECT ON public.profiles_public TO authenticated;

-- ============================================================
-- 3) SUBSCRIPTIONS: remove broad authenticated read
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view subscription tiers" ON public.subscriptions;

-- ============================================================
-- 4) SWIPES: stop social graph leak
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can count likes on profiles" ON public.swipes;

CREATE POLICY "Users can see likes targeting them"
  ON public.swipes FOR SELECT TO authenticated
  USING (auth.uid() = target_id AND action = 'like');

-- ============================================================
-- 5) MATCHES: remove direct INSERT (trigger creates matches)
-- ============================================================
DROP POLICY IF EXISTS "Users can create matches they participate in" ON public.matches;

-- ============================================================
-- 6) USER_ROLES: explicit RESTRICTIVE deny for non-admin writes
-- ============================================================
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 7) STORAGE: lock down email-assets uploads + remove broad listing
-- ============================================================
DROP POLICY IF EXISTS "Authenticated upload email assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for email assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
-- Public buckets continue to serve files at /storage/v1/object/public/<bucket>/<path>
-- without needing storage.objects RLS policies; uploads still controlled by
-- the existing photos owner-path policy. email-assets uploads now require service_role.

-- ============================================================
-- 8) Function search_path + EXECUTE hardening
-- ============================================================
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- has_role MUST stay callable by authenticated (used in RLS USING clauses).
-- Revoke from anon only (defense in depth).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

-- Backend-only SECURITY DEFINER helpers: revoke from clients
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- Trigger functions: only the trigger fires them; revoke direct execute
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_mutual_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 9) RPC: discover_profiles — server-side distance, no coords exposed
-- ============================================================
CREATE OR REPLACE FUNCTION public.discover_profiles(
  _my_lat double precision,
  _my_lng double precision,
  _max_distance_km integer,
  _min_age integer,
  _max_age integer,
  _gender gender_type,
  _limit integer,
  _offset integer
) RETURNS TABLE (
  user_id uuid,
  display_name text,
  photos text[],
  bio text,
  interests text[],
  gender gender_type,
  city text,
  country text,
  state text,
  verified boolean,
  age int,
  distance_km numeric,
  active_tier subscription_tier,
  like_count int,
  hide_distance boolean,
  hide_state boolean,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
      WHERE s.user_id = p.user_id AND s.status = 'active'
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
$$;

REVOKE EXECUTE ON FUNCTION public.discover_profiles(double precision, double precision, integer, integer, integer, gender_type, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(double precision, double precision, integer, integer, integer, gender_type, integer, integer) TO authenticated;

-- ============================================================
-- 10) RPC: who_liked_me — unmatched likers with safe fields only
-- ============================================================
CREATE OR REPLACE FUNCTION public.who_liked_me()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  photos text[],
  bio text,
  interests text[],
  gender gender_type,
  city text,
  country text,
  state text,
  verified boolean,
  age int,
  liked_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  matched AS (
    SELECT CASE WHEN user_a = (SELECT uid FROM me) THEN user_b ELSE user_a END AS other
    FROM public.matches
    WHERE user_a = (SELECT uid FROM me) OR user_b = (SELECT uid FROM me)
  ),
  passed AS (
    SELECT target_id FROM public.swipes
    WHERE swiper_id = (SELECT uid FROM me) AND action = 'pass'
  )
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
    sw.created_at AS liked_at
  FROM public.swipes sw
  JOIN public.profiles p ON p.user_id = sw.swiper_id
  WHERE sw.target_id = (SELECT uid FROM me)
    AND sw.action = 'like'
    AND p.suspended = false
    AND sw.swiper_id NOT IN (SELECT other FROM matched)
    AND sw.swiper_id NOT IN (SELECT target_id FROM passed)
  ORDER BY sw.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.who_liked_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.who_liked_me() TO authenticated;
