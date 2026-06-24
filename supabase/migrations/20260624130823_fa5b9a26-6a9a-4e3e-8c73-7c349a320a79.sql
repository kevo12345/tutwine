
-- 1) Storage: drop broad listing policy on photos bucket. Public file URLs still work.
DROP POLICY IF EXISTS "Public read access to photos bucket" ON storage.objects;

-- Allow owners to list/read their own folder (needed for the app's own management).
CREATE POLICY "Users can list their own photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2) user_roles: scope self-view policy to authenticated role only.
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) profiles: revoke column-level access to sensitive fields from client roles.
-- SECURITY DEFINER functions (discover_profiles, get_profile_public, get_profiles_public)
-- already exclude these columns and continue to work because they run as definer.
REVOKE SELECT (phone, latitude, longitude, geohash) ON public.profiles FROM anon;
REVOKE SELECT (phone, latitude, longitude, geohash) ON public.profiles FROM authenticated;
-- Owner may still update their own values via the existing UPDATE policy; UPDATE grant is unchanged.

-- 4) subscriptions: hide payment_phone from clients and Realtime broadcasts.
REVOKE SELECT (payment_phone) ON public.subscriptions FROM anon;
REVOKE SELECT (payment_phone) ON public.subscriptions FROM authenticated;
-- service_role retains full access for edge functions (sellapay-callback, sellapay-stk-push).
