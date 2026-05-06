-- ============================================================
-- HOTFIX: revoke_lifetime_credits conflict
-- A versão pré-existente (_description TEXT, _user_id UUID)
-- referencia uma tabela 'credit_transactions' que não existe
-- no LATAM (era de outro projeto/template), e impediu o CREATE
-- OR REPLACE da minha versão (_user_id, _amount, _description).
-- Aqui forçamos DROP de TODAS as variantes e recriamos limpo.
-- ============================================================

-- 1) DROP de todas as variantes possíveis de revoke_lifetime_credits
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(TEXT, UUID);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(UUID, TEXT);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(TEXT, UUID, INTEGER);

-- 2) DROP de todas as variantes possíveis de grant_lifetime_credits (por simetria)
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(TEXT, UUID);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(UUID, TEXT);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(TEXT, UUID, INTEGER);

-- 3) Recria grant_lifetime_credits com signature canônica
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

-- 4) Recria revoke_lifetime_credits com signature canônica
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

-- 5) Permissões — service_role only (apenas hotmart-webhook chama)
REVOKE ALL ON FUNCTION public.grant_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;

-- 6) NOTIFY pgrst para forçar reload do schema cache (importante!)
NOTIFY pgrst, 'reload schema';
