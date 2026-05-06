-- 0) Deduplicate user_pack_purchases to allow unique index
DELETE FROM public.user_pack_purchases a
USING public.user_pack_purchases b
WHERE a.id < b.id
  AND a.gateway = b.gateway
  AND a.external_id = b.external_id;

-- Create missing core functions first to avoid dependency errors
CREATE OR REPLACE FUNCTION public.grant_lifetime_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Créditos Vitalícios'
)
RETURNS void AS $$
BEGIN
  UPDATE public.upscaler_credits
  SET balance = balance + _amount,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, description, type)
  VALUES (_user_id, _amount, _description, 'grant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1) flyer_maker_monthly_credits
ALTER TABLE public.upscaler_credits ADD COLUMN IF NOT EXISTS monthly_expires_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.user_has_unlimited_flyer(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_pack_purchases
    WHERE user_id = _user_id
    AND pack_slug = 'flyer-maker-unlimited'
    AND payment_status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) revoke_credit_function_grants
REVOKE EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_lifetime_credits(uuid, integer, text) FROM public, anon, authenticated;

-- 3) admin_credit_management
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role') = role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits_forced(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_credits(uuid, integer, text) TO service_role;

-- 4) rename_flyer_credit_rpcs
DROP FUNCTION IF EXISTS public.grant_monthly_credits(uuid, integer, text, integer);

CREATE OR REPLACE FUNCTION public.grant_flyer_monthly_credits(
  _user_id uuid,
  _amount integer,
  _description text DEFAULT 'Créditos Mensais Flyer Maker',
  _months integer DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE public.upscaler_credits
  SET balance = balance + _amount,
      monthly_expires_at = now() + (interval '1 month' * _months),
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, description, type)
  VALUES (_user_id, _amount, _description, 'grant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_flyer_monthly_credits(
  _user_id uuid,
  _description text DEFAULT 'Revogação de Créditos Mensais'
)
RETURNS void AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT balance INTO v_balance FROM public.upscaler_credits WHERE user_id = _user_id;
  
  UPDATE public.upscaler_credits
  SET balance = 0,
      monthly_expires_at = NULL,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, description, type)
  VALUES (_user_id, -v_balance, _description, 'revoke');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) TO service_role;

-- 5) hotmart_robustness
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_pack_purchases_gateway_external_id 
ON public.user_pack_purchases (gateway, external_id);

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.expire_monthly_credits_if_due()
RETURNS void AS $$
BEGIN
  UPDATE public.upscaler_credits
  SET balance = 0,
      monthly_expires_at = NULL,
      updated_at = now()
  WHERE monthly_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_lifetime_credits(
  _user_id uuid,
  _description text DEFAULT 'Revogação de Créditos Vitalícios'
)
RETURNS void AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT balance INTO v_balance FROM public.upscaler_credits WHERE user_id = _user_id;
  
  UPDATE public.upscaler_credits
  SET balance = 0,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, description, type)
  VALUES (_user_id, -v_balance, _description, 'revoke');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure read access for authenticated users
GRANT EXECUTE ON FUNCTION public.get_upscaler_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_unlimited_flyer(uuid) TO authenticated;
