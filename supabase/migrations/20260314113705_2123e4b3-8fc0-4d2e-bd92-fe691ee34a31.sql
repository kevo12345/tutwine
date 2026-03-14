CREATE POLICY "Authenticated can view subscription tiers"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (true);