-- ==========================================
-- FLYER MAKER - TABLE + RLS + REALTIME
-- ==========================================

CREATE TABLE IF NOT EXISTS public.flyer_maker_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Flyer reference
  reference_image_url TEXT,
  reference_file_name TEXT,
  
  -- Artist photos (1-5)
  artist_photo_urls JSONB DEFAULT '[]'::jsonb,
  artist_photo_file_names JSONB DEFAULT '[]'::jsonb,
  artist_count INTEGER DEFAULT 1,
  
  -- Logo
  logo_url TEXT,
  logo_file_name TEXT,
  
  -- Text inputs
  date_time_location TEXT,
  title TEXT,
  address TEXT,
  artist_names TEXT,
  footer_promo TEXT,
  
  -- Settings
  image_size TEXT DEFAULT '3:4',
  creativity INTEGER DEFAULT 0,
  
  -- Processing fields
  task_id TEXT,
  output_url TEXT,
  thumbnail_url TEXT,
  error_message TEXT,
  position INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Credits
  user_credit_cost INTEGER,
  rh_cost NUMERIC,
  credits_charged BOOLEAN DEFAULT false,
  credits_refunded BOOLEAN DEFAULT false,
  
  -- Queue
  waited_in_queue BOOLEAN DEFAULT false,
  queue_wait_seconds INTEGER,
  api_account TEXT NOT NULL DEFAULT 'primary',
  
  -- Observability
  current_step TEXT,
  failed_at_step TEXT,
  step_history JSONB DEFAULT '[]'::jsonb,
  raw_api_response JSONB,
  raw_webhook_payload JSONB,
  job_payload JSONB,
  
  -- Adicionados después
  reference_prompt_id TEXT,
  tool_type TEXT DEFAULT 'flyer-maker',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flyer_maker_jobs_user_id ON public.flyer_maker_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_flyer_maker_jobs_status ON public.flyer_maker_jobs(status);
CREATE INDEX IF NOT EXISTS idx_flyer_maker_jobs_task_id ON public.flyer_maker_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_flyer_maker_jobs_session_id ON public.flyer_maker_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_flyer_maker_jobs_reference_prompt ON public.flyer_maker_jobs(reference_prompt_id) WHERE reference_prompt_id IS NOT NULL;

-- RLS
ALTER TABLE public.flyer_maker_jobs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own flyer maker jobs') THEN
    CREATE POLICY "Users can view their own flyer maker jobs"
      ON public.flyer_maker_jobs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own flyer maker jobs') THEN
    CREATE POLICY "Users can create their own flyer maker jobs"
      ON public.flyer_maker_jobs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.flyer_maker_jobs;

-- Updated_at trigger
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_flyer_maker_jobs_updated_at') THEN
    CREATE TRIGGER update_flyer_maker_jobs_updated_at
      BEFORE UPDATE ON public.flyer_maker_jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ==========================================
-- FLYER MAKER TEST CREDITS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.flyer_maker_test_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  balance INTEGER NOT NULL DEFAULT 0,
  granted_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.flyer_maker_test_credits ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own test credits') THEN
    CREATE POLICY "Users can view own test credits"
      ON public.flyer_maker_test_credits
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_flyer_test_credits(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT balance FROM flyer_maker_test_credits WHERE user_id = _user_id),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.consume_flyer_test_credits(_user_id UUID, _amount INTEGER)
RETURNS TABLE(test_used INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  to_consume INTEGER;
  leftover INTEGER;
BEGIN
  SELECT balance INTO current_balance
  FROM flyer_maker_test_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF current_balance IS NULL OR current_balance <= 0 THEN
    test_used := 0;
    remaining := _amount;
    RETURN NEXT;
    RETURN;
  END IF;

  to_consume := LEAST(current_balance, _amount);
  leftover := _amount - to_consume;

  UPDATE flyer_maker_test_credits
  SET balance = balance - to_consume,
      updated_at = now()
  WHERE user_id = _user_id;

  test_used := to_consume;
  remaining := leftover;
  RETURN NEXT;
  RETURN;
END;
$$;
