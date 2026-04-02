
-- 1. Email confirmation tokens table
CREATE TABLE public.email_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anon to read tokens (confirm-email edge function uses service role, but just in case)
CREATE POLICY "Service role manages tokens"
  ON public.email_confirmation_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_email_confirmation_tokens_token ON public.email_confirmation_tokens(token);
CREATE INDEX idx_email_confirmation_tokens_user ON public.email_confirmation_tokens(user_id);

-- 2. Device signups table
CREATE TABLE public.device_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_signups ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_device_signups_fingerprint ON public.device_signups(fingerprint);

-- 3. Blacklisted emails table
CREATE TABLE public.blacklisted_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blacklisted_emails ENABLE ROW LEVEL SECURITY;

-- 4. RPC: Check if device fingerprint already signed up
CREATE OR REPLACE FUNCTION public.check_device_signup_limit(p_fingerprint TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.device_signups
    WHERE fingerprint = p_fingerprint
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_device_signup_limit(TEXT) TO anon, authenticated;

-- 5. RPC: Register device signup
CREATE OR REPLACE FUNCTION public.register_device_signup(p_fingerprint TEXT, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.device_signups (fingerprint, user_id)
  VALUES (p_fingerprint, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_signup(TEXT, UUID) TO anon, authenticated;
