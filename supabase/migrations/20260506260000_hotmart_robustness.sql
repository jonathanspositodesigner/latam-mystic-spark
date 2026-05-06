-- ============================================================
-- HOTMART ROBUSTNESS — fixes definitivos para garantir nunca
-- haver bug em vendas/refunds/idempotência.
-- ============================================================

-- 1) RPC grant_lifetime_credits — atomic, race-safe (Upscaler creditos)
CREATE OR REPLACE FUNCTION public.grant_lifetime_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_lifetime INTEGER;
  current_monthly INTEGER;
  new_lifetime INTEGER;
  new_balance INTEGER;
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;

  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT lifetime_balance, monthly_balance
  INTO current_lifetime, current_monthly
  FROM public.upscaler_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  new_lifetime := COALESCE(current_lifetime, 0) + _amount;
  new_balance := new_lifetime + COALESCE(current_monthly, 0);

  UPDATE public.upscaler_credits
  SET lifetime_balance = new_lifetime,
      balance = new_balance,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, _amount, new_balance, 'purchase', _description, 'lifetime'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;

-- 2) RPC revoke_lifetime_credits — usado em refund de Upscaler
CREATE OR REPLACE FUNCTION public.revoke_lifetime_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_lifetime INTEGER;
  current_monthly INTEGER;
  to_revoke INTEGER;
  new_lifetime INTEGER;
  new_balance INTEGER;
BEGIN
  IF _amount <= 0 THEN RETURN 0; END IF;

  SELECT COALESCE(lifetime_balance, 0), COALESCE(monthly_balance, 0)
  INTO current_lifetime, current_monthly
  FROM public.upscaler_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF current_lifetime IS NULL OR current_lifetime = 0 THEN
    RETURN 0;
  END IF;

  -- Não revoga mais do que tem (caso já tenha consumido parte)
  to_revoke := LEAST(_amount, current_lifetime);
  new_lifetime := current_lifetime - to_revoke;
  new_balance := new_lifetime + current_monthly;

  UPDATE public.upscaler_credits
  SET lifetime_balance = new_lifetime,
      balance = new_balance,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, -to_revoke, new_balance, 'refund', _description, 'lifetime'
  );

  RETURN to_revoke;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;

-- 3) Index único para idempotência: (gateway, external_id) em user_pack_purchases
-- Se Hotmart re-enviar webhook, INSERT com mesmo external_id falha
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'user_pack_purchases'
      AND indexname = 'uniq_user_pack_purchases_gateway_external_id'
  ) THEN
    -- Limpar duplicatas pré-existentes antes de criar UNIQUE
    DELETE FROM public.user_pack_purchases a USING public.user_pack_purchases b
    WHERE a.id < b.id
      AND a.gateway = b.gateway
      AND a.external_id = b.external_id
      AND a.gateway IS NOT NULL
      AND a.external_id IS NOT NULL;

    CREATE UNIQUE INDEX uniq_user_pack_purchases_gateway_external_id
      ON public.user_pack_purchases (gateway, external_id)
      WHERE gateway IS NOT NULL AND external_id IS NOT NULL;
  END IF;
END $$;

-- 4) RPC find_user_id_by_email — case-insensitive lookup
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email TEXT)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE LOWER(email) = LOWER(_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO service_role;

-- 5) Index para acelerar webhook idempotency check
CREATE INDEX IF NOT EXISTS idx_webhook_logs_external_id_processed
  ON public.webhook_logs (source, processed)
  WHERE processed = true;

-- 6) FIX CRÍTICO: get_upscaler_credits agora lê de upscaler_credits.balance
-- (que respeita expiração mensal), não soma de transactions (que ignora).
-- Antes: cliente via 7000 mas só conseguia gastar 0 após expiração.
CREATE OR REPLACE FUNCTION public.get_upscaler_credits(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  is_expired BOOLEAN;
  current_lifetime INTEGER;
BEGIN
  SELECT
    COALESCE(balance, 0),
    COALESCE(lifetime_balance, 0),
    (monthly_expires_at IS NOT NULL AND monthly_expires_at < now() AND COALESCE(monthly_balance, 0) > 0)
  INTO current_balance, current_lifetime, is_expired
  FROM public.upscaler_credits
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Se monthly expirou, retorna apenas lifetime (sem mutar — STABLE function)
  IF is_expired THEN
    RETURN current_lifetime;
  END IF;

  RETURN current_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upscaler_credits(UUID) TO authenticated, service_role;

-- 7) FIX CRÍTICO: expire_monthly_credits_if_due agora INSERE transação de expiração
-- (mantém log de auditoria coerente)
CREATE OR REPLACE FUNCTION public.expire_monthly_credits_if_due(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_monthly INTEGER;
  current_lifetime INTEGER;
  expires_at_val TIMESTAMPTZ;
BEGIN
  SELECT monthly_balance, lifetime_balance, monthly_expires_at
  INTO current_monthly, current_lifetime, expires_at_val
  FROM public.upscaler_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF expires_at_val IS NULL OR expires_at_val >= now() OR COALESCE(current_monthly, 0) <= 0 THEN
    RETURN;
  END IF;

  -- Expirou: zera monthly_balance, registra transação de expiração
  UPDATE public.upscaler_credits
  SET monthly_balance = 0,
      balance = COALESCE(lifetime_balance, 0),
      monthly_expires_at = NULL,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, -current_monthly, COALESCE(current_lifetime, 0),
    'expiration', 'Créditos mensales expirados', 'monthly'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_monthly_credits_if_due(UUID) TO authenticated, service_role;
