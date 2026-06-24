
-- Replace SECURITY DEFINER view (flagged by linter) with table-returning functions.
DROP VIEW IF EXISTS public.profiles_public;

-- Single profile lookup (safe fields only)
CREATE OR REPLACE FUNCTION public.get_profile_public(_target uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  photos text[],
  bio text,
  interests text[],
  gender gender_type,
  interested_in gender_type[],
  city text,
  country text,
  state text,
  verified boolean,
  suspended boolean,
  hide_distance boolean,
  hide_state boolean,
  onboarding_complete boolean,
  created_at timestamptz,
  updated_at timestamptz,
  age int,
  like_count int,
  active_tier subscription_tier
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id, p.display_name, p.photos, p.bio, p.interests,
    p.gender, p.interested_in, p.city, p.country,
    CASE WHEN COALESCE(p.hide_state, false) THEN NULL ELSE p.state END,
    p.verified, p.suspended, p.hide_distance, p.hide_state,
    p.onboarding_complete, p.created_at, p.updated_at,
    CASE WHEN p.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int END,
    COALESCE((SELECT count(*)::int FROM public.swipes WHERE target_id = p.user_id AND action = 'like'), 0),
    (SELECT s.tier FROM public.subscriptions s
       WHERE s.user_id = p.user_id AND s.status = 'active'
       ORDER BY s.started_at DESC LIMIT 1)
  FROM public.profiles p
  WHERE p.user_id = _target
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_public(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_public(uuid) TO authenticated;

-- Batch profile lookup
CREATE OR REPLACE FUNCTION public.get_profiles_public(_targets uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  photos text[],
  bio text,
  interests text[],
  gender gender_type,
  interested_in gender_type[],
  city text,
  country text,
  state text,
  verified boolean,
  suspended boolean,
  hide_distance boolean,
  hide_state boolean,
  onboarding_complete boolean,
  created_at timestamptz,
  updated_at timestamptz,
  age int,
  like_count int,
  active_tier subscription_tier
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id, p.display_name, p.photos, p.bio, p.interests,
    p.gender, p.interested_in, p.city, p.country,
    CASE WHEN COALESCE(p.hide_state, false) THEN NULL ELSE p.state END,
    p.verified, p.suspended, p.hide_distance, p.hide_state,
    p.onboarding_complete, p.created_at, p.updated_at,
    CASE WHEN p.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int END,
    COALESCE((SELECT count(*)::int FROM public.swipes WHERE target_id = p.user_id AND action = 'like'), 0),
    (SELECT s.tier FROM public.subscriptions s
       WHERE s.user_id = p.user_id AND s.status = 'active'
       ORDER BY s.started_at DESC LIMIT 1)
  FROM public.profiles p
  WHERE p.user_id = ANY(_targets)
$$;

REVOKE EXECUTE ON FUNCTION public.get_profiles_public(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_public(uuid[]) TO authenticated;
