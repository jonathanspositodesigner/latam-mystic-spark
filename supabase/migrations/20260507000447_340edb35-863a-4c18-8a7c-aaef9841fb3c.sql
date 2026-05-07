-- Drop legacy functions with all possible signatures
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(uuid, numeric);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(text, integer);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(uuid, integer, text, boolean);

DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid, numeric);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(text, integer);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid, integer, text, boolean);

DROP FUNCTION IF EXISTS public.find_user_id_by_email(text);

-- 1. arcano_grant_lifetime_credits
CREATE OR REPLACE FUNCTION public.arcano_grant_lifetime_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Créditos vitalícios concedidos'
)
RETURNS VOID AS $$
BEGIN
  -- Insert transaction
  INSERT INTO public.upscaler_credit_transactions (
    user_id,
    amount,
    type,
    description
  ) VALUES (
    _user_id,
    _amount,
    'lifetime',
    _description
  );

  -- Update summary table (upsert)
  INSERT INTO public.upscaler_credits (user_id, lifetime_credits, monthly_credits)
  VALUES (_user_id, _amount, 0)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    lifetime_credits = public.upscaler_credits.lifetime_credits + EXCLUDED.lifetime_credits,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. arcano_revoke_lifetime_credits
CREATE OR REPLACE FUNCTION public.arcano_revoke_lifetime_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Créditos vitalícios removidos'
)
RETURNS INTEGER AS $$
DECLARE
  v_current_credits INTEGER;
  v_to_remove INTEGER;
BEGIN
  -- Get current lifetime credits
  SELECT lifetime_credits INTO v_current_credits
  FROM public.upscaler_credits
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    v_current_credits := 0;
  END IF;

  -- Ensure we don't go below zero
  v_to_remove := LEAST(v_current_credits, _amount);

  IF v_to_remove > 0 THEN
    -- Insert negative transaction
    INSERT INTO public.upscaler_credit_transactions (
      user_id,
      amount,
      type,
      description
    ) VALUES (
      _user_id,
      -v_to_remove,
      'lifetime',
      _description
    );

    -- Update summary
    UPDATE public.upscaler_credits
    SET 
      lifetime_credits = lifetime_credits - v_to_remove,
      updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  RETURN v_to_remove;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. arcano_find_user_id_by_email
CREATE OR REPLACE FUNCTION public.arcano_find_user_id_by_email(_email TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE LOWER(email) = LOWER(_email)
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke all permissions from public/anon/authenticated
REVOKE ALL ON FUNCTION public.arcano_grant_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcano_revoke_lifetime_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcano_find_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;

-- Grant execution ONLY to service_role
GRANT EXECUTE ON FUNCTION public.arcano_grant_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcano_revoke_lifetime_credits(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcano_find_user_id_by_email(TEXT) TO service_role;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
