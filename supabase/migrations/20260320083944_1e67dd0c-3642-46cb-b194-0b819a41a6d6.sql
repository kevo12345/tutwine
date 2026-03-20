
-- Allow authenticated users to insert matches where they are a participant
CREATE POLICY "Users can create matches they participate in"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
