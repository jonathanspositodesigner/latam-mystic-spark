-- Drop all variants to avoid overloads and signature conflicts
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.grant_lifetime_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid, text);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.revoke_lifetime_credits(uuid);

-- Recreate grant_lifetime_credits with canonical signature
CREATE OR REPLACE FUNCTION public.grant_lifetime_credits(
    _user_id uuid,
    _amount integer,
    _description text DEFAULT 'Créditos Vitalícios'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security check: ONLY admins or service_role
    IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Not authorized to grant credits';
    END IF;

    UPDATE public.upscaler_credits
    SET 
        lifetime_balance = COALESCE(lifetime_balance, 0) + _amount,
        balance = COALESCE(balance, 0) + _amount,
        updated_at = now()
    WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (
        user_id, 
        amount, 
        description, 
        transaction_type,
        credit_type,
        balance_after
    )
    SELECT 
        _user_id, 
        _amount, 
        _description, 
        'grant',
        'lifetime',
        balance
    FROM public.upscaler_credits
    WHERE user_id = _user_id;
END;
$$;

-- Recreate revoke_lifetime_credits with canonical signature
CREATE OR REPLACE FUNCTION public.revoke_lifetime_credits(
    _user_id uuid,
    _amount integer,
    _description text DEFAULT 'Revogação de Créditos Vitalícios'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security check: ONLY admins or service_role
    IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Not authorized to revoke credits';
    END IF;

    UPDATE public.upscaler_credits
    SET 
        lifetime_balance = GREATEST(0, COALESCE(lifetime_balance, 0) - _amount),
        balance = GREATEST(0, COALESCE(balance, 0) - _amount),
        updated_at = now()
    WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (
        user_id, 
        amount, 
        description, 
        transaction_type,
        credit_type,
        balance_after
    )
    SELECT 
        _user_id, 
        -_amount, 
        _description, 
        'revoke',
        'lifetime',
        balance
    FROM public.upscaler_credits
    WHERE user_id = _user_id;
END;
$$;

-- Ensure grants for authenticated users (admin UI)
GRANT EXECUTE ON FUNCTION public.grant_lifetime_credits(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_lifetime_credits(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_lifetime_credits(uuid, integer, text) TO service_role;

-- Force reload PostgREST cache
NOTIFY pgrst, 'reload schema';