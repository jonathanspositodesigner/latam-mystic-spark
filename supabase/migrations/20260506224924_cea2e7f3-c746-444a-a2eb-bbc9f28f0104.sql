-- Revoke access to credit mutation functions for non-privileged roles
REVOKE EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_monthly_credits(uuid, integer, text, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_monthly_credits(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_flyer_test_credits(uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_monthly_credits_if_due(uuid) FROM public, anon, authenticated;

-- Ensure read-only functions are also restricted if they contain sensitive info
REVOKE EXECUTE ON FUNCTION public.get_upscaler_credits(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_flyer_test_credits(uuid) FROM public, anon, authenticated;

-- Re-grant to service_role if needed (usually it has it by default, but being explicit is safer)
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(uuid, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_monthly_credits(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_flyer_test_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_monthly_credits_if_due(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_upscaler_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_flyer_test_credits(uuid) TO service_role;