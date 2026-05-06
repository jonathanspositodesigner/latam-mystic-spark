-- ============================================================
-- HOTFIX SEGURANÇA: Revoga EXECUTE de PUBLIC nas funções de
-- créditos para evitar que anon/authenticated drenem créditos
-- ou concedam para si mesmos via REST API.
-- ============================================================

-- Funções críticas que JAMAIS devem ser chamadas direto pelo cliente.
-- Apenas edge functions (service_role) podem invocar.

REVOKE ALL ON FUNCTION public.consume_upscaler_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_upscaler_credits(UUID, INTEGER, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(UUID, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.consume_upscaler_credits_forced(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_upscaler_credits_forced(UUID, INTEGER, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(UUID, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.refund_upscaler_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_upscaler_credits(UUID, INTEGER, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_upscaler_credits(UUID, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.grant_monthly_credits(UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_monthly_credits(UUID, INTEGER, TEXT, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(UUID, INTEGER, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_monthly_credits(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_monthly_credits(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_monthly_credits(UUID, TEXT) TO service_role;

-- Funções LEITURA seguras (mantêm acesso authenticated):
-- - user_has_unlimited_flyer (lê user_pack_purchases que já tem RLS)
-- - get_upscaler_credits (lê transações do próprio user)
-- - expire_monthly_credits_if_due (idempotente, só zera o que já expirou)
-- Não precisam de mudança.
