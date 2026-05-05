-- Add tool_type to flyer_maker_jobs if missing
ALTER TABLE public.flyer_maker_jobs ADD COLUMN IF NOT EXISTS tool_type text DEFAULT 'flyer-maker';
UPDATE public.flyer_maker_jobs SET tool_type = CASE WHEN reference_image_url IS NOT NULL AND title IS NULL THEN 'flyer-motion' ELSE 'flyer-maker' END WHERE tool_type IS NULL;

-- RPC mark_pending_job_as_failed
CREATE OR REPLACE FUNCTION public.mark_pending_job_as_failed(p_job_id uuid, p_table_name text)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_credit_cost int;
  v_charged boolean;
  v_refunded boolean;
BEGIN
  EXECUTE format('SELECT user_id, user_credit_cost, credits_charged, credits_refunded FROM %I WHERE id = $1', p_table_name)
  INTO v_user_id, v_credit_cost, v_charged, v_refunded
  USING p_job_id;

  -- Refund if charged and not yet refunded
  IF v_charged AND NOT v_refunded AND v_credit_cost > 0 AND v_user_id IS NOT NULL THEN
    PERFORM public.consume_upscaler_credits(v_user_id, -v_credit_cost, 'Estorno: Job falhou ao iniciar');
    EXECUTE format('UPDATE %I SET credits_refunded = true WHERE id = $1', p_table_name) USING p_job_id;
  END IF;

  -- Mark as failed
  EXECUTE format('UPDATE %I SET status = ''failed'', error_message = ''Job timed out or failed to start'', completed_at = now() WHERE id = $1', p_table_name)
  USING p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC cleanup_all_stale_ai_jobs
CREATE OR REPLACE FUNCTION public.cleanup_all_stale_ai_jobs()
RETURNS TABLE (
  upscaler_cancelled int,
  flyer_maker_cancelled int
) AS $$
DECLARE
  v_upscaler_count int := 0;
  v_flyer_count int := 0;
BEGIN
  -- Cleanup upscaler_jobs (> 30 min)
  WITH updated AS (
    UPDATE public.upscaler_jobs
    SET status = 'failed', error_message = 'Timeout de processamento (30min)', completed_at = now()
    WHERE status IN ('starting', 'running') AND started_at < now() - interval '30 minutes'
    RETURNING id
  ) SELECT count(*) INTO v_upscaler_count FROM updated;

  -- Cleanup flyer_maker_jobs (> 30 min)
  WITH updated AS (
    UPDATE public.flyer_maker_jobs
    SET status = 'failed', error_message = 'Timeout de processamento (30min)', completed_at = now()
    WHERE status IN ('starting', 'running') AND started_at < now() - interval '30 minutes'
    RETURNING id
  ) SELECT count(*) INTO v_flyer_count FROM updated;

  RETURN QUERY SELECT v_upscaler_count, v_flyer_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to protect financial columns
CREATE OR REPLACE FUNCTION public.fn_protect_ai_job_financial_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.credits_charged AND (NEW.user_credit_cost != OLD.user_credit_cost) THEN
      RAISE EXCEPTION 'Cannot change credit cost after it has been charged';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_flyer_financial_columns ON public.flyer_maker_jobs;
CREATE TRIGGER tr_protect_flyer_financial_columns
BEFORE UPDATE ON public.flyer_maker_jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_ai_job_financial_columns();

-- Ensure ai_tool_registry has entries
-- Note: Assuming ai_tool_registry table exists as per ArcanoApp
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_tool_registry') THEN
    INSERT INTO public.ai_tool_registry (tool_id, name, description, status)
    VALUES 
      ('flyer-maker', 'Flyer Maker', 'Geração de Flyers via IA', 'active'),
      ('flyer-motion', 'Flyer Motion', 'Animação de Flyers via IA', 'active')
    ON CONFLICT (tool_id) DO NOTHING;
  END IF;
END $$;
