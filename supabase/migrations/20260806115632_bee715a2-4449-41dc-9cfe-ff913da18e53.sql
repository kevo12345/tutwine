CREATE POLICY "admins read all token txs"
ON public.token_transactions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));