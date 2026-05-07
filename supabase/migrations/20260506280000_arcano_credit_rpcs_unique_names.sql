-- ============================================================
-- HOTFIX: Renomear lifetime credits e find_user_by_email para nomes únicos
--
-- Auditoria pós-deploy detectou:
-- 1) grant_lifetime_credits e revoke_lifetime_credits têm versões
--    fantasmas que fazem RAISE 'Not authorized' quando auth.uid() é NULL,
--    o que QUEBRA chamadas via service_role do webhook.
-- 2) find_user_id_by_email está acessível por anon (vulnerabilidade
--    de enumeração de usuários por email).
--
-- Estratégia: renomear minhas funções para `arcano_*` (nome único,
-- sem conflito com scaffolding do Lovable).
-- ============================================================

-- ============================================================
-- 1) DROP de todas as variantes possíveis das funções legadas
-- ============================================================
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(TEXT, UUID);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(UUID, TEXT);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(INTEGER, TEXT, UUID);

DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(TEXT, UUID);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(UUID, TEXT);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(INTEGER, TEXT, UUID);

DROP FUNCTION IF EXISTS public.find_user_id_by_email(TEXT);

-- ============================================================
-- 2) Cria arcano_grant_lifetime_credits (nome único, sem conflito)
-- ============================================================
CREATE OR REPLACE FUNCTION public.arcano_grant_lifetime_credits(
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

REVOKE ALL ON FUNCTION public.arcano_grant_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arcano_grant_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;

-- ============================================================
-- 3) Cria arcano_revoke_lifetime_credits (nome único)
-- ============================================================
CREATE OR REPLACE FUNCTION public.arcano_revoke_lifetime_credits(
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

REVOKE ALL ON FUNCTION public.arcano_revoke_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arcano_revoke_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;

-- ============================================================
-- 4) Cria arcano_find_user_id_by_email (nome único, service_role only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.arcano_find_user_id_by_email(_email TEXT)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE LOWER(email) = LOWER(_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.arcano_find_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arcano_find_user_id_by_email(TEXT) TO service_role;

-- ============================================================
-- 5) Reload schema cache do PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
