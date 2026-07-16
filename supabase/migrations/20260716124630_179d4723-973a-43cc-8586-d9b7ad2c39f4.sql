-- Revoke public/anon EXECUTE on SECURITY DEFINER functions flagged by linter.
-- All of these already validate auth.uid() internally; this closes the anon exposure surface.

REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.convert_earnings_to_tokens(numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.renew_subscription_with_earnings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.host_earnings_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_gift(uuid, text, numeric) FROM PUBLIC, anon;

-- Trigger-only functions: no direct callers, safe to lock down.
REVOKE EXECUTE ON FUNCTION public.auto_assign_emrand_on_active_sub() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_settle_on_end() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_settle_after_end() FROM PUBLIC, anon;

-- Ensure authenticated + service_role retain access for app + edge functions.
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_earnings_to_tokens(numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_subscription_with_earnings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.host_earnings_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, text, numeric) TO authenticated, service_role;