
-- 1. email_confirmation_tokens — remove user policy, keep service_role only
DROP POLICY IF EXISTS "Service role manages tokens" ON public.email_confirmation_tokens;
CREATE POLICY "Deny direct access to email_confirmation_tokens"
  ON public.email_confirmation_tokens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 2. webhook_logs — remove anon insert, deny direct access
DROP POLICY IF EXISTS "Service insert webhook_logs" ON public.webhook_logs;

-- 3. rate_limits — explicit deny for client roles
CREATE POLICY "Deny direct access to rate_limits"
  ON public.rate_limits
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 4. Lock search_path on all SECURITY DEFINER / public functions missing it
ALTER FUNCTION public.has_role(text) SET search_path = public;
ALTER FUNCTION public.consume_upscaler_credits(uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.refund_upscaler_credits(uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.user_cancel_ai_job(text, uuid) SET search_path = public;
ALTER FUNCTION public.user_has_unlimited_flyer(uuid) SET search_path = public;
ALTER FUNCTION public.mark_pending_job_as_failed(uuid, text) SET search_path = public;
ALTER FUNCTION public.fn_protect_ai_job_financial_columns() SET search_path = public;
ALTER FUNCTION public.expire_monthly_credits_if_due(uuid) SET search_path = public;
ALTER FUNCTION public.expire_monthly_credits_if_due() SET search_path = public;
ALTER FUNCTION public.get_ai_tools_cost_averages() SET search_path = public;
ALTER FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) SET search_path = public;
ALTER FUNCTION public.revoke_flyer_monthly_credits(uuid, text) SET search_path = public;

-- 5. Revoke EXECUTE on backend-only SECURITY DEFINER functions from anon/authenticated.
-- These are invoked exclusively from edge functions with the service_role key.
REVOKE EXECUTE ON FUNCTION public.arcano_find_user_id_by_email(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arcano_grant_lifetime_credits(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arcano_revoke_lifetime_credits(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_seedance_job(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_collaborator_tool_earning(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_all_stale_ai_jobs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_unlimited_flyer(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_flyer_test_credits(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_monthly_credits_if_due() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_monthly_credits_if_due(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_pending_job_as_failed(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_pending_job_as_failed(text, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_tools_cost_averages() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
