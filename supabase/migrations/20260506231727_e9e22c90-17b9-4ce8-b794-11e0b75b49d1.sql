-- Drop the conflicting functions from migration 220000
DROP FUNCTION IF EXISTS public.grant_monthly_credits(uuid, integer, text, integer);
DROP FUNCTION IF EXISTS public.revoke_monthly_credits(uuid, text);

-- Create specifically named function for granting monthly credits
CREATE OR REPLACE FUNCTION public.grant_flyer_monthly_credits(
    _user_id UUID,
    _amount INTEGER,
    _description TEXT,
    _months INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
    _expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Security check: only service_role or admin
    IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    _expires_at := NOW() + (_months || ' months')::INTERVAL;

    INSERT INTO public.upscaller_credits (
        user_id,
        credits,
        description,
        monthly_expires_at,
        created_at
    ) VALUES (
        _user_id,
        _amount,
        _description,
        _expires_at,
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create specifically named function for revoking monthly credits
CREATE OR REPLACE FUNCTION public.revoke_flyer_monthly_credits(
    _user_id UUID,
    _description TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Security check: only service_role or admin
    IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Set credits to 0 for all active monthly packs of this user
    UPDATE public.upscaller_credits
    SET credits = 0,
        description = description || ' (REVOGADO: ' || _description || ')'
    WHERE user_id = _user_id 
      AND monthly_expires_at > NOW()
      AND credits > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to reading credits for authenticated users
GRANT EXECUTE ON FUNCTION public.get_upscaler_credits(uuid) TO authenticated;

-- Ensure management functions are restricted
REVOKE ALL ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) TO service_role;

-- Re-grant to authenticated only if they are admins (checked inside the function, but good to have the grant)
GRANT EXECUTE ON FUNCTION public.grant_flyer_monthly_credits(uuid, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_flyer_monthly_credits(uuid, text) TO authenticated;
