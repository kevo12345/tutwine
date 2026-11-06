DROP POLICY IF EXISTS "Anyone can view presence" ON public.user_presence;

CREATE POLICY "View presence of visible, unblocked users"
ON public.user_presence
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_presence.user_id
        AND p.onboarding_complete = true
        AND p.suspended = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = user_presence.user_id)
         OR (b.blocker_id = user_presence.user_id AND b.blocked_id = auth.uid())
    )
  )
);