-- Drop and recreate functions to change return types and add admin checks

-- 1. grant_monthly_credits
DROP FUNCTION IF EXISTS public.grant_monthly_credits(uuid, integer, text, integer);
CREATE OR REPLACE FUNCTION public.grant_monthly_credits(_user_id uuid, _amount integer, _product_id text, _valid_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    _new_expires_at TIMESTAMP WITH TIME ZONE;
    _new_balance INTEGER;
BEGIN
    -- Security check: ONLY admins (or service_role) can grant credits
    IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Not authorized to grant credits';
    END IF;

    _new_expires_at := now() + (_valid_days || ' days')::interval;

    INSERT INTO public.upscaler_credits (user_id, monthly_balance, monthly_expires_at, updated_at)
    VALUES (_user_id, _amount, _new_expires_at, now())
    ON CONFLICT (user_id) DO UPDATE SET
        monthly_balance = _amount,
        monthly_expires_at = _new_expires_at,
        updated_at = now();

    SELECT (monthly_balance + lifetime_balance) INTO _new_balance
    FROM public.upscaler_credits WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (_user_id, _amount, _new_balance, 'grant', 'Monthly subscription: ' || _product_id);

    RETURN json_build_object('success', true, 'new_balance', _new_balance, 'expires_at', _new_expires_at);
END;
$function$;

-- 2. refund_upscaler_credits
DROP FUNCTION IF EXISTS public.refund_upscaler_credits(uuid, integer, text);
CREATE OR REPLACE FUNCTION public.refund_upscaler_credits(_user_id uuid, _amount integer, _description text DEFAULT 'Refund'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    _new_balance INTEGER;
BEGIN
    -- Security check: ONLY admins (or service_role) can refund credits
    IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Not authorized to refund credits';
    END IF;

    UPDATE public.upscaler_credits
    SET 
        lifetime_balance = lifetime_balance + _amount,
        balance = balance + _amount,
        updated_at = now()
    WHERE user_id = _user_id;

    SELECT balance INTO _new_balance
    FROM public.upscaler_credits WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (_user_id, _amount, _new_balance, 'refund', _description);

    RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$function$;

-- 3. consume_upscaler_credits (return type was already json, but update logic)
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits(_user_id uuid, _amount integer, _description text DEFAULT 'Usage'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    _current_monthly INTEGER;
    _current_lifetime INTEGER;
    _expires_at TIMESTAMP WITH TIME ZONE;
    _monthly_deduct INTEGER := 0;
    _lifetime_deduct INTEGER := 0;
    _new_balance INTEGER;
BEGIN
    -- Security check: User can only consume their own credits, UNLESS they are an admin
    IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Not authorized to manage credits for this user';
    END IF;

    -- Check expiration first
    PERFORM public.expire_monthly_credits_if_due(_user_id);

    SELECT monthly_balance, lifetime_balance, monthly_expires_at 
    INTO _current_monthly, _current_lifetime, _expires_at
    FROM public.upscaler_credits 
    WHERE user_id = _user_id;

    IF (_current_monthly + _current_lifetime) < _amount THEN
        RETURN json_build_object('success', false, 'error_message', 'Insufficient credits');
    END IF;

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

    INSERT INTO public.upscaler_credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (_user_id, -_amount, _new_balance, 'consumption', _description);

    RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$function$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.consume_upscaler_credits(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_upscaler_credits(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(uuid, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upscaler_credits(uuid) TO authenticated;
