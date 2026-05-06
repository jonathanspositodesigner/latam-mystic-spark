-- First, drop existing functions to allow changing return type
DROP FUNCTION IF EXISTS public.consume_upscaler_credits(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.consume_upscaler_credits_forced(UUID, INTEGER, TEXT);

-- Add monthly_expires_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'upscaler_credits' AND column_name = 'monthly_expires_at') THEN
        ALTER TABLE public.upscaler_credits ADD COLUMN monthly_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Function to expire monthly credits if due
CREATE OR REPLACE FUNCTION public.expire_monthly_credits_if_due(_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.upscaler_credits
    SET 
        monthly_balance = 0,
        balance = lifetime_balance,
        monthly_expires_at = NULL,
        updated_at = now()
    WHERE user_id = _user_id
    AND monthly_expires_at IS NOT NULL
    AND monthly_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated consume_upscaler_credits (Now returns JSON)
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits(_user_id UUID, _amount INTEGER, _description TEXT)
RETURNS JSON AS $$
DECLARE
    _current_monthly INTEGER;
    _current_lifetime INTEGER;
    _expires_at TIMESTAMP WITH TIME ZONE;
    _monthly_deduct INTEGER := 0;
    _lifetime_deduct INTEGER := 0;
    _new_balance INTEGER;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated consume_upscaler_credits_forced
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits_forced(_user_id UUID, _amount INTEGER, _description TEXT)
RETURNS JSON AS $$
BEGIN
    RETURN public.consume_upscaler_credits(_user_id, _amount, _description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant monthly credits
CREATE OR REPLACE FUNCTION public.grant_monthly_credits(_user_id UUID, _amount INTEGER, _description TEXT, _months INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
    _new_expires_at TIMESTAMP WITH TIME ZONE := now() + (_months || ' month')::interval;
    _new_balance INTEGER;
BEGIN
    UPDATE public.upscaler_credits
    SET 
        monthly_balance = _amount,
        monthly_expires_at = _new_expires_at,
        balance = _amount + lifetime_balance,
        updated_at = now()
    WHERE user_id = _user_id;

    IF NOT FOUND THEN
        INSERT INTO public.upscaler_credits (user_id, monthly_balance, lifetime_balance, balance, monthly_expires_at)
        VALUES (_user_id, _amount, 0, _amount, _new_expires_at);
    END IF;

    SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (_user_id, _amount, _new_balance, 'grant_monthly', _description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke monthly credits
CREATE OR REPLACE FUNCTION public.revoke_monthly_credits(_user_id UUID, _description TEXT)
RETURNS VOID AS $$
DECLARE
    _new_balance INTEGER;
BEGIN
    UPDATE public.upscaler_credits
    SET 
        monthly_balance = 0,
        monthly_expires_at = NULL,
        balance = lifetime_balance,
        updated_at = now()
    WHERE user_id = _user_id;

    SELECT balance INTO _new_balance FROM public.upscaler_credits WHERE user_id = _user_id;

    INSERT INTO public.upscaler_credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (_user_id, 0, _new_balance, 'refund', _description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for unlimited flyer maker plan
CREATE OR REPLACE FUNCTION public.user_has_unlimited_flyer(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_pack_purchases
        WHERE user_id = _user_id
        AND pack_slug = 'flyer-maker-unlimited'
        AND payment_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;