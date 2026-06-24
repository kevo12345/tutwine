
-- 1) Lock down SECURITY DEFINER functions: revoke from PUBLIC + anon, grant only to the roles that need them.

-- User-facing helpers (called from the authenticated client)
REVOKE ALL ON FUNCTION public.discover_profiles(double precision, double precision, integer, integer, integer, gender_type, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_profiles(double precision, double precision, integer, integer, integer, gender_type, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_profile_public(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_public(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_profiles_public(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_public(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.who_liked_me() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.who_liked_me() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Internal helpers — server/trigger only, never client-callable
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_mutual_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- 2) Add explicit SELECT policy on storage.objects for the photos bucket (authenticated only).
-- Bucket remains public for direct CDN URLs used by the app, but the Data API path now has an explicit allow rule.
DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'photos');
