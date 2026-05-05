-- Create rate limit table if not exists
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(ip_address, endpoint)
);

-- Rate limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    _ip_address TEXT,
    _endpoint TEXT,
    _max_requests INTEGER,
    _window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _window_start TIMESTAMP WITH TIME ZONE;
    _current_count INTEGER;
BEGIN
    _window_start := now() - (_window_seconds || ' seconds')::INTERVAL;
    
    -- Clean up old entries (optional, can be done via cron)
    DELETE FROM public.rate_limits WHERE window_start < _window_start;
    
    INSERT INTO public.rate_limits (ip_address, endpoint, request_count, window_start)
    VALUES (_ip_address, _endpoint, 1, now())
    ON CONFLICT (ip_address, endpoint) DO UPDATE
    SET request_count = CASE 
            WHEN public.rate_limits.window_start < _window_start THEN 1 
            ELSE public.rate_limits.request_count + 1 
        END,
        window_start = CASE 
            WHEN public.rate_limits.window_start < _window_start THEN now() 
            ELSE public.rate_limits.window_start 
        END
    RETURNING request_count INTO _current_count;
    
    IF _current_count > _max_requests THEN
        RETURN QUERY SELECT FALSE, 0;
    ELSE
        RETURN QUERY SELECT TRUE, _max_requests - _current_count;
    END IF;
END;
$$;

-- Add missing columns to flyer_maker_jobs
ALTER TABLE public.flyer_maker_jobs 
ADD COLUMN IF NOT EXISTS step_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS failed_at_step TEXT,
ADD COLUMN IF NOT EXISTS raw_api_response JSONB,
ADD COLUMN IF NOT EXISTS user_credit_cost INTEGER,
ADD COLUMN IF NOT EXISTS reference_file_name TEXT,
ADD COLUMN IF NOT EXISTS artist_photo_file_names TEXT[],
ADD COLUMN IF NOT EXISTS logo_file_name TEXT;
