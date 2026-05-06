-- ============================================================
-- Flyer Maker Hotmart Plans — Monthly Credits + Unlimited Plan
-- ============================================================

-- 1) Adiciona expiração mensal em upscaler_credits
ALTER TABLE public.upscaler_credits
  ADD COLUMN IF NOT EXISTS monthly_expires_at TIMESTAMPTZ;

-- 2) Função para zerar monthly_balance se expirou (chamada pelos consumers)
CREATE OR REPLACE FUNCTION public.expire_monthly_credits_if_due(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.upscaler_credits
  SET monthly_balance = 0,
      balance = lifetime_balance,
      monthly_expires_at = NULL,
      updated_at = now()
  WHERE user_id = _user_id
    AND monthly_expires_at IS NOT NULL
    AND monthly_expires_at < now()
    AND monthly_balance > 0;
END;
$$;

-- 3) Atualiza consume_upscaler_credits_forced para honrar expiração mensal
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits_forced(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'AI Tool'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_monthly INTEGER;
  current_lifetime INTEGER;
  total_balance INTEGER;
  monthly_to_consume INTEGER;
  lifetime_to_consume INTEGER;
  updated_monthly INTEGER;
  updated_lifetime INTEGER;
  updated_balance INTEGER;
  tx_credit_type TEXT;
BEGIN
  IF _amount <= 0 OR _amount > 50000 THEN
    RETURN QUERY SELECT FALSE, 0, 'Invalid amount'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Expirar mensais se vencidos
  PERFORM public.expire_monthly_credits_if_due(_user_id);

  SELECT COALESCE(uc.monthly_balance, 0), COALESCE(uc.lifetime_balance, 0)
  INTO current_monthly, current_lifetime
  FROM public.upscaler_credits uc
  WHERE uc.user_id = _user_id
  FOR UPDATE;

  total_balance := current_monthly + current_lifetime;

  IF total_balance < _amount THEN
    RETURN QUERY SELECT FALSE, total_balance, 'Saldo insuficiente'::TEXT;
    RETURN;
  END IF;

  IF current_monthly >= _amount THEN
    monthly_to_consume := _amount;
    lifetime_to_consume := 0;
    tx_credit_type := 'monthly';
  ELSIF current_monthly > 0 THEN
    monthly_to_consume := current_monthly;
    lifetime_to_consume := _amount - current_monthly;
    tx_credit_type := 'mixed';
  ELSE
    monthly_to_consume := 0;
    lifetime_to_consume := _amount;
    tx_credit_type := 'lifetime';
  END IF;

  updated_monthly := current_monthly - monthly_to_consume;
  updated_lifetime := current_lifetime - lifetime_to_consume;
  updated_balance := updated_monthly + updated_lifetime;

  UPDATE public.upscaler_credits
  SET monthly_balance = updated_monthly,
      lifetime_balance = updated_lifetime,
      balance = updated_balance,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, -_amount, updated_balance, 'consumption',
    COALESCE(_description, 'AI Tool'), tx_credit_type
  );

  RETURN QUERY SELECT TRUE, updated_balance, NULL::TEXT;
END;
$$;

-- 4) Atualiza consume_upscaler_credits (usado pelo runninghub-image-generator) para honrar expiração
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Usage'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_bal INTEGER;
BEGIN
  PERFORM public.expire_monthly_credits_if_due(_user_id);

  SELECT COALESCE(SUM(amount), 0) INTO current_bal
  FROM public.upscaler_credit_transactions
  WHERE user_id = _user_id;

  IF current_bal < _amount THEN
    RETURN QUERY SELECT false, current_bal, 'Créditos insuficientes'::TEXT;
    RETURN;
  END IF;

  -- Sincronizar com upscaler_credits (priorizar monthly)
  PERFORM public.consume_upscaler_credits_forced(_user_id, _amount, _description);

  -- Mantém lógica antiga retornando saldo via transactions (compatibilidade)
  SELECT COALESCE(SUM(amount), 0) INTO current_bal
  FROM public.upscaler_credit_transactions
  WHERE user_id = _user_id;

  RETURN QUERY SELECT true, current_bal::INTEGER, NULL::TEXT;
END;
$$;

-- 5) RPC para conceder créditos mensais (chamada pelo hotmart-webhook nos planos Flyer Maker)
CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT,
  _months INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_monthly INTEGER;
  current_lifetime INTEGER;
  current_expires TIMESTAMPTZ;
  new_expires TIMESTAMPTZ;
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;

  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Zerar monthly se já expirou antes de adicionar
  PERFORM public.expire_monthly_credits_if_due(_user_id);

  SELECT monthly_balance, lifetime_balance, monthly_expires_at
  INTO current_monthly, current_lifetime, current_expires
  FROM public.upscaler_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  -- Renova: substitui monthly_balance pelo novo amount e empurra expiração
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

-- 6) RPC para revogar créditos mensais (chamada no refund/chargeback)
CREATE OR REPLACE FUNCTION public.revoke_monthly_credits(
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

-- 7) RPC para checar se usuário tem plano Flyer Maker Unlimited ativo
CREATE OR REPLACE FUNCTION public.user_has_unlimited_flyer(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_pack_purchases
    WHERE user_id = _user_id
      AND pack_slug = 'flyer-maker-unlimited'
      AND payment_status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_unlimited_flyer(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(UUID, INTEGER, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_monthly_credits(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_monthly_credits_if_due(UUID) TO authenticated, service_role;
