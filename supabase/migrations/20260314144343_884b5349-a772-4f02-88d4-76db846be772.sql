CREATE POLICY "Users can delete their own swipes"
ON public.swipes FOR DELETE
TO authenticated
USING (auth.uid() = swiper_id);