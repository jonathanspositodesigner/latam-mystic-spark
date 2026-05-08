-- ============================================================
-- AUDITORIA DE CRÉDITOS — fixes pra bugs encontrados
-- ============================================================
-- Resolve:
-- 1. Race condition em consume_upscaler_credits (sem FOR UPDATE)
-- 2. grant_flyer_monthly_credits não atualizava monthly_balance
-- 3. revoke_flyer_monthly_credits não zerava monthly_balance
-- 4. arcano_*_lifetime_credits referenciava colunas inexistentes
--    (lifetime_credits / monthly_credits — corretas: lifetime_balance / monthly_balance)
-- 5. refund_upscaler_credits sempre devolvia pra lifetime mesmo quando consumo
--    saiu do monthly — agora reverte bucket original via lookup da última consumption
-- 6. Tracking de bucket origin nas transactions (monthly_deducted, lifetime_deducted)
--
-- Source de verdade: tabela `upscaler_credits` com colunas
--   - balance (total derivado)
--   - monthly_balance (créditos de assinatura mensal, expiram)
--   - lifetime_balance (créditos vitalícios, nunca expiram)
--   - monthly_expires_at (timestamp de expiração)
-- ============================================================

-- 1) Add bucket tracking columns to transactions (idempotent)
ALTER TABLE public.upscaler_credit_transactions
  ADD COLUMN IF NOT EXISTS monthly_deducted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_deducted INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_upscaler_credit_transactions_user_consumption
  ON public.upscaler_credit_transactions (user_id, transaction_type, created_at DESC)
  WHERE transaction_type = 'consumption';

-- ============================================================
-- 2) consume_upscaler_credits: FOR UPDATE lock + bucket tracking
-- ============================================================
DROP FUNCTION IF EXISTS public.consume_upscaler_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.consume_upscaler_credits_forced(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.consume_upscaler_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Usage'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _current_monthly INTEGER;
  _current_lifetime INTEGER;
  _expires_at TIMESTAMP WITH TIME ZONE;
  _monthly_deduct INTEGER := 0;
  _lifetime_deduct INTEGER := 0;
  _new_balance INTEGER;
BEGIN
  -- Authorization: user OR admin OR service_role
  IF auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin')
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to manage credits for this user';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Expire monthly credits if past expiry (resets to 0 if monthly_expires_at < now)
  PERFORM public.expire_monthly_credits_if_due(_user_id);

  -- Lock the row to serialize concurrent consumptions (prevents double-spend race)
  SELECT monthly_balance, lifetime_balance, monthly_expires_at
    INTO _current_monthly, _current_lifetime, _expires_at
    FROM public.upscaler_credits
    WHERE user_id = _user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error_message', 'Account not initialized', 'new_balance', 0);
  END IF;

  IF (_current_monthly + _current_lifetime) < _amount THEN
    RETURN json_build_object(
      'success', false,
      'error_message', 'Insufficient credits',
      'new_balance', _current_monthly + _current_lifetime
    );
  END IF;

  -- Priority: deduct from monthly first, then lifetime
  IF _current_monthly >= _amount THEN
    _monthly_deduct := _amount;
  ELSE
    _monthly_deduct := _current_monthly;
    _lifetime_deduct := _amount - _current_monthly;
  END IF;

  UPDATE public.upscaler_credits
  SET
    monthly_balance = monthly_balance - _monthly_deduct,
    lifetime_balance = lifetime_balance - _lifetime_deduct,
    balance = (monthly_balance - _monthly_deduct) + (lifetime_balance - _lifetime_deduct),
    updated_at = now()
  WHERE user_id = _user_id;

  _new_balance := (_current_monthly - _monthly_deduct) + (_current_lifetime - _lifetime_deduct);

  -- Record transaction with bucket breakdown for accurate refund later
  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description,
    monthly_deducted, lifetime_deducted, credit_type
  )
  VALUES (
    _user_id, -_amount, _new_balance, 'consumption', _description,
    _monthly_deduct, _lifetime_deduct,
    CASE
      WHEN _monthly_deduct > 0 AND _lifetime_deduct > 0 THEN 'mixed'
      WHEN _monthly_deduct > 0 THEN 'monthly'
      ELSE 'lifetime'
    END
  );

  RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$$;

-- Forced wrapper (legacy alias used by edge functions)
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits_forced(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Usage'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.consume_upscaler_credits(_user_id, _amount, _description);
END;
$$;

-- ============================================================
-- 3) refund_upscaler_credits: smart bucket-aware refund
-- ============================================================
DROP FUNCTION IF EXISTS public.refund_upscaler_credits(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.refund_upscaler_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Refund'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _last RECORD;
  _monthly_refund INTEGER := 0;
  _lifetime_refund INTEGER := _amount;
  _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to refund credits';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  -- Look up the most recent matching consumption (last 24h) to reverse the EXACT bucket split.
  -- Heuristic but accurate for the typical job-failure refund flow.
  SELECT monthly_deducted, lifetime_deducted
    INTO _last
    FROM public.upscaler_credit_transactions
    WHERE user_id = _user_id
      AND transaction_type = 'consumption'
      AND amount = -_amount
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at DESC
    LIMIT 1;

  IF FOUND AND (_last.monthly_deducted + _last.lifetime_deducted) = _amount THEN
    _monthly_refund := _last.monthly_deducted;
    _lifetime_refund := _last.lifetime_deducted;
  END IF;

  -- Lock and update
  UPDATE public.upscaler_credits
  SET
    monthly_balance = monthly_balance + _monthly_refund,
    lifetime_balance = lifetime_balance + _lifetime_refund,
    balance = balance + _amount,
    updated_at = now()
  WHERE user_id = _user_id;

  -- Initialize row if user doesn't have one (edge case)
  IF NOT FOUND THEN
    INSERT INTO public.upscaler_credits (user_id, monthly_balance, lifetime_balance, balance)
    VALUES (_user_id, _monthly_refund, _lifetime_refund, _amount);
  END IF;

  SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  )
  VALUES (
    _user_id, _amount, _new_balance, 'refund', _description,
    CASE
      WHEN _monthly_refund > 0 AND _lifetime_refund > 0 THEN 'mixed'
      WHEN _monthly_refund > 0 THEN 'monthly'
      ELSE 'lifetime'
    END
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', _new_balance,
    'monthly_refunded', _monthly_refund,
    'lifetime_refunded', _lifetime_refund
  );
END;
$$;

-- ============================================================
-- 4) grant_flyer_monthly_credits: actually update monthly_balance
--    (Era um bug que só atualizava `balance` — daria saldo 0 em consume)
-- ============================================================
DROP FUNCTION IF EXISTS public.grant_flyer_monthly_credits(uuid, integer, text, integer);

CREATE OR REPLACE FUNCTION public.grant_flyer_monthly_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Créditos Mensais Flyer Maker',
  _months integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new_expires_at TIMESTAMP WITH TIME ZONE;
  _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to grant credits';
  END IF;

  _new_expires_at := now() + (_months || ' month')::interval;

  -- Subscription renewal: REPLACE monthly balance (não acumula entre meses)
  -- Lifetime balance é preservado.
  INSERT INTO public.upscaler_credits (user_id, monthly_balance, lifetime_balance, balance, monthly_expires_at)
  VALUES (_user_id, _amount, 0, _amount, _new_expires_at)
  ON CONFLICT (user_id) DO UPDATE SET
    monthly_balance = _amount,
    monthly_expires_at = _new_expires_at,
    balance = _amount + public.upscaler_credits.lifetime_balance,
    updated_at = now();

  SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  )
  VALUES (_user_id, _amount, _new_balance, 'grant_monthly', _description, 'monthly');

  RETURN json_build_object('success', true, 'new_balance', _new_balance, 'expires_at', _new_expires_at);
END;
$$;

-- ============================================================
-- 5) revoke_flyer_monthly_credits: actually zero monthly_balance
-- ============================================================
DROP FUNCTION IF EXISTS public.revoke_flyer_monthly_credits(uuid, text);

CREATE OR REPLACE FUNCTION public.revoke_flyer_monthly_credits(
  _user_id uuid,
  _description text DEFAULT 'Revogação de Créditos Mensais'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _revoked INTEGER;
  _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to revoke credits';
  END IF;

  SELECT monthly_balance INTO _revoked
    FROM public.upscaler_credits WHERE user_id = _user_id;
  _revoked := COALESCE(_revoked, 0);

  UPDATE public.upscaler_credits
  SET
    monthly_balance = 0,
    monthly_expires_at = NULL,
    balance = lifetime_balance,
    updated_at = now()
  WHERE user_id = _user_id;

  SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  )
  VALUES (_user_id, -_revoked, COALESCE(_new_balance, 0), 'revoke_monthly', _description, 'monthly');

  RETURN json_build_object('success', true, 'revoked', _revoked, 'new_balance', COALESCE(_new_balance, 0));
END;
$$;

-- ============================================================
-- 6) arcano_grant_lifetime_credits / arcano_revoke_lifetime_credits
--    Corrige referência a `lifetime_credits` → `lifetime_balance`
-- ============================================================
DROP FUNCTION IF EXISTS public.arcano_grant_lifetime_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.arcano_revoke_lifetime_credits(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.arcano_grant_lifetime_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Créditos vitalícios concedidos'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.upscaler_credits (user_id, monthly_balance, lifetime_balance, balance)
  VALUES (_user_id, 0, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE SET
    lifetime_balance = public.upscaler_credits.lifetime_balance + _amount,
    balance = public.upscaler_credits.balance + _amount,
    updated_at = now();

  SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  )
  VALUES (_user_id, _amount, _new_balance, 'grant', _description, 'lifetime');

  RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.arcano_revoke_lifetime_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Créditos vitalícios removidos'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _current INTEGER;
  _to_remove INTEGER;
  _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT lifetime_balance INTO _current
    FROM public.upscaler_credits WHERE user_id = _user_id;
  _current := COALESCE(_current, 0);

  _to_remove := LEAST(_current, _amount);

  IF _to_remove > 0 THEN
    UPDATE public.upscaler_credits
    SET
      lifetime_balance = lifetime_balance - _to_remove,
      balance = balance - _to_remove,
      updated_at = now()
    WHERE user_id = _user_id;

    SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (
      user_id, amount, balance_after, transaction_type, description, credit_type
    )
    VALUES (_user_id, -_to_remove, _new_balance, 'revoke', _description, 'lifetime');
  ELSE
    _new_balance := 0;
  END IF;

  RETURN json_build_object('success', true, 'removed', _to_remove, 'new_balance', _new_balance);
END;
$$;

-- ============================================================
-- 7) Permissions — só service_role chama as RPCs sensíveis
-- ============================================================
REVOKE ALL ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcano_grant_lifetime_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcano_revoke_lifetime_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;

-- O hook do frontend chama consume_upscaler_credits direto (com auth.uid() check),
-- então damos EXECUTE pra authenticated nessa única
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcano_grant_lifetime_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcano_revoke_lifetime_credits(uuid, integer, text) TO service_role;

NOTIFY pgrst, 'reload schema';
