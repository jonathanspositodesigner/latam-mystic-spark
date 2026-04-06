
-- ==========================================
-- Table: upscaler_jobs
-- ==========================================
CREATE TABLE public.upscaler_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_url TEXT,
  output_url TEXT,
  thumbnail_url TEXT,
  error_message TEXT,
  position INTEGER DEFAULT 0,
  current_step TEXT,
  failed_at_step TEXT,
  step_history JSONB DEFAULT '[]'::jsonb,
  credits_charged BOOLEAN DEFAULT false,
  credits_refunded BOOLEAN DEFAULT false,
  user_credit_cost INTEGER DEFAULT 0,
  task_id TEXT,
  api_account TEXT,
  raw_api_response JSONB,
  raw_webhook_payload JSONB,
  rh_cost NUMERIC,
  queue_wait_seconds INTEGER,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

ALTER TABLE public.upscaler_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own upscaler jobs"
  ON public.upscaler_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own upscaler jobs"
  ON public.upscaler_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all upscaler jobs"
  ON public.upscaler_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_upscaler_jobs_user_status ON public.upscaler_jobs(user_id, status);
CREATE INDEX idx_upscaler_jobs_active ON public.upscaler_jobs(status) WHERE status IN ('pending','queued','starting','running');

-- ==========================================
-- Table: upscaler_credit_transactions
-- ==========================================
CREATE TABLE public.upscaler_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  tool_type TEXT DEFAULT 'upscaler',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.upscaler_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credit transactions"
  ON public.upscaler_credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all credit transactions"
  ON public.upscaler_credit_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_credit_transactions_user ON public.upscaler_credit_transactions(user_id);

-- ==========================================
-- RPC: get_upscaler_credits
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_upscaler_credits(_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM public.upscaler_credit_transactions
  WHERE user_id = _user_id;
$$;

-- ==========================================
-- RPC: consume_upscaler_credits
-- ==========================================
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Usage'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_bal INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO current_bal
  FROM public.upscaler_credit_transactions
  WHERE user_id = _user_id;

  IF current_bal < _amount THEN
    RETURN QUERY SELECT false, current_bal, 'Créditos insuficientes'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.upscaler_credit_transactions (user_id, amount, transaction_type, description)
  VALUES (_user_id, -_amount, 'consumption', _description);

  RETURN QUERY SELECT true, (current_bal - _amount), NULL::TEXT;
END;
$$;

-- ==========================================
-- RPC: refund_upscaler_credits
-- ==========================================
CREATE OR REPLACE FUNCTION public.refund_upscaler_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Refund'
)
RETURNS VOID
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.upscaler_credit_transactions (user_id, amount, transaction_type, description)
  VALUES (_user_id, _amount, 'refund', _description);
END;
$$;

-- ==========================================
-- RPC: user_cancel_ai_job
-- ==========================================
CREATE OR REPLACE FUNCTION public.user_cancel_ai_job(p_table_name TEXT, p_job_id UUID)
RETURNS TABLE(success BOOLEAN, refunded_amount INTEGER, error_message TEXT)
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  job_record RECORD;
  allowed_tables TEXT[] := ARRAY['upscaler_jobs'];
BEGIN
  -- Validate table name to prevent SQL injection
  IF NOT (p_table_name = ANY(allowed_tables)) THEN
    RETURN QUERY SELECT false, 0, 'Invalid table name'::TEXT;
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT user_id, status, user_credit_cost, credits_charged, credits_refunded FROM %I WHERE id = $1',
    p_table_name
  ) INTO job_record USING p_job_id;

  IF job_record IS NULL THEN
    RETURN QUERY SELECT false, 0, 'Job not found'::TEXT;
    RETURN;
  END IF;

  IF job_record.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN QUERY SELECT false, 0, 'Job already terminal'::TEXT;
    RETURN;
  END IF;

  IF auth.uid() != job_record.user_id THEN
    RETURN QUERY SELECT false, 0, 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE %I SET status = $1, cancelled_at = now(), completed_at = now() WHERE id = $2',
    p_table_name
  ) USING 'cancelled', p_job_id;

  IF job_record.credits_charged AND NOT job_record.credits_refunded AND job_record.user_credit_cost > 0 THEN
    INSERT INTO public.upscaler_credit_transactions (user_id, amount, transaction_type, description)
    VALUES (job_record.user_id, job_record.user_credit_cost, 'refund', 'Cancelación por el usuario');

    EXECUTE format('UPDATE %I SET credits_refunded = true WHERE id = $1', p_table_name) USING p_job_id;
    RETURN QUERY SELECT true, job_record.user_credit_cost::INTEGER, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT true, 0, NULL::TEXT;
  END IF;
END;
$$;

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.upscaler_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.upscaler_credit_transactions;
