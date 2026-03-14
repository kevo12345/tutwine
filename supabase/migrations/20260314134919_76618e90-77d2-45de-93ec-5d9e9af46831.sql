-- Allow authenticated users to count likes on any profile (for like count display)
CREATE POLICY "Authenticated can count likes on profiles"
ON public.swipes
FOR SELECT
TO authenticated
USING (action = 'like');