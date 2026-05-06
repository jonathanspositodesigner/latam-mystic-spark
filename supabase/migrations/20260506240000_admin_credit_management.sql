-- ============================================================
-- Restaurar acesso admin ao gerenciamento de créditos
-- Hotfix anterior bloqueou TODOS os clientes (anon+authenticated),
-- quebrando o painel admin que chama consume/refund direto.
-- Agora permitimos authenticated MAS validamos has_role('admin')
-- dentro da própria função.
-- ============================================================

-- 1) consume_upscaler_credits — permite admin OR service_role
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
  -- Bloquear chamada direta pelo client comum.
  -- service_role bypass: auth.uid() é NULL.
  -- admin bypass: has_role('admin') = true.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY SELECT false, 0, 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  PERFORM public.expire_monthly_credits_if_due(_user_id);

  SELECT COALESCE(SUM(amount), 0) INTO current_bal
  FROM public.upscaler_credit_transactions
  WHERE user_id = _user_id;

  IF current_bal < _amount THEN
    RETURN QUERY SELECT false, current_bal, 'Créditos insuficientes'::TEXT;
    RETURN;
  END IF;

  PERFORM public.consume_upscaler_credits_forced(_user_id, _amount, _description);

  SELECT COALESCE(SUM(amount), 0) INTO current_bal
  FROM public.upscaler_credit_transactions
  WHERE user_id = _user_id;

  RETURN QUERY SELECT true, current_bal::INTEGER, NULL::TEXT;
END;
$$;

-- 2) consume_upscaler_credits_forced — permite admin OR service_role
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
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY SELECT FALSE, 0, 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  IF _amount <= 0 OR _amount > 50000 THEN
    RETURN QUERY SELECT FALSE, 0, 'Invalid amount'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

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

-- 3) refund_upscaler_credits — permite admin OR service_role
CREATE OR REPLACE FUNCTION public.refund_upscaler_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Refund'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.upscaler_credit_transactions (user_id, amount, transaction_type, description)
  VALUES (_user_id, _amount, 'refund', _description);

  -- Sincronizar lifetime_balance em upscaler_credits
  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, _amount, 0, _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET lifetime_balance = upscaler_credits.lifetime_balance + _amount,
        balance = upscaler_credits.monthly_balance + upscaler_credits.lifetime_balance + _amount,
        updated_at = now();
END;
$$;

-- 4) Restaurar EXECUTE para authenticated (validação interna agora protege)
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(UUID, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(UUID, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_upscaler_credits(UUID, INTEGER, TEXT) TO authenticated, service_role;

-- grant_monthly_credits e revoke_monthly_credits permanecem service_role-only
-- (nunca são chamadas pelo painel admin, apenas pelo webhook Hotmart)
