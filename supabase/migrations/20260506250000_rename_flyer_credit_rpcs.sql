-- ============================================================
-- FIX FINAL: Renomear grant/revoke_monthly_credits para nome único
-- Existe uma função antiga grant_monthly_credits(_amount, _product_id,
-- _user_id, _valid_days) no banco que conflitou com nossa nova versão
-- (PostgREST não consegue resolver o overload por nomes de parâmetros).
-- Renomeamos pra grant_flyer_monthly_credits e revoke_flyer_monthly_credits
-- para evitar qualquer ambiguidade.
-- ============================================================

-- 1) Drop versões antigas (se existirem) e recria com nomes únicos
DROP FUNCTION IF EXISTS public.grant_monthly_credits(UUID, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.revoke_monthly_credits(UUID, TEXT);

-- 2) Cria grant_flyer_monthly_credits (versão nova com nome único)
CREATE OR REPLACE FUNCTION public.grant_flyer_monthly_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT,
  _months INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_lifetime INTEGER;
  new_expires TIMESTAMPTZ;
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;

  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.expire_monthly_credits_if_due(_user_id);

  SELECT lifetime_balance
  INTO current_lifetime
  FROM public.upscaler_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  new_expires := now() + (_months || ' months')::INTERVAL;

  UPDATE public.upscaler_credits
  SET monthly_balance = _amount,
      monthly_expires_at = new_expires,
      balance = _amount + COALESCE(current_lifetime, 0),
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, _amount, _amount + COALESCE(current_lifetime, 0),
    'purchase', _description, 'monthly'
  );
END;
$$;

-- 3) Cria revoke_flyer_monthly_credits
CREATE OR REPLACE FUNCTION public.revoke_flyer_monthly_credits(
  _user_id UUID,
  _description TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_monthly INTEGER;
  current_lifetime INTEGER;
BEGIN
  SELECT COALESCE(monthly_balance, 0), COALESCE(lifetime_balance, 0)
  INTO current_monthly, current_lifetime
  FROM public.upscaler_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF current_monthly IS NULL OR current_monthly <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.upscaler_credits
  SET monthly_balance = 0,
      monthly_expires_at = NULL,
      balance = current_lifetime,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, -current_monthly, current_lifetime,
    'refund', _description, 'monthly'
  );

  RETURN current_monthly;
END;
$$;

-- 4) Permissões — service_role only (apenas o webhook chama)
REVOKE ALL ON FUNCTION public.grant_flyer_monthly_credits(UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_flyer_monthly_credits(UUID, INTEGER, TEXT, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_flyer_monthly_credits(UUID, INTEGER, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_flyer_monthly_credits(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_flyer_monthly_credits(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_flyer_monthly_credits(UUID, TEXT) TO service_role;

-- 5) Garantir que funções de leitura usadas pelo frontend tenham EXECUTE
-- (frontend autenticado precisa, não anon)
GRANT EXECUTE ON FUNCTION public.get_upscaler_credits(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_monthly_credits_if_due(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_unlimited_flyer(UUID) TO authenticated, anon, service_role;
