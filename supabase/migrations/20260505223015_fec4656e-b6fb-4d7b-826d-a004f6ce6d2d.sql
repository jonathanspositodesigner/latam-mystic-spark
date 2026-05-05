-- 1. Ensure columns exist in seedance_jobs
ALTER TABLE public.seedance_jobs 
  ADD COLUMN IF NOT EXISTS credits_refunded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- 2. Create the protection trigger function
CREATE OR REPLACE FUNCTION public.protect_ai_job_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role to do anything
  IF current_setting('role', true) = 'service_role' 
     OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block changes to financial/sensitive columns
  IF OLD.credits_charged IS DISTINCT FROM NEW.credits_charged THEN
    RAISE EXCEPTION 'Cannot modify credits_charged';
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF OLD.credits_refunded IS DISTINCT FROM NEW.credits_refunded THEN
        RAISE EXCEPTION 'Cannot modify credits_refunded';
    END IF;
  END IF;

  IF OLD.output_url IS DISTINCT FROM NEW.output_url THEN
    RAISE EXCEPTION 'Cannot modify output_url';
  END IF;

  IF OLD.task_id IS DISTINCT FROM NEW.task_id THEN
    RAISE EXCEPTION 'Cannot modify task_id';
  END IF;

  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Apply protection triggers
DO $$
DECLARE
    v_table_name text;
    v_tables text[] := ARRAY['seedance_jobs', 'upscaler_jobs', 'bg_remover_jobs', 'veste_ai_jobs', 'arcano_cloner_jobs', 'image_generator_jobs', 'pose_changer_jobs', 'character_generator_jobs', 'flyer_maker_jobs', 'video_upscaler_jobs', 'video_generator_jobs', 'movieled_maker_jobs'];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table_name AND table_schema = 'public') THEN
            EXECUTE format('DROP TRIGGER IF EXISTS protect_%I_financial ON public.%I', v_table_name, v_table_name);
            EXECUTE format('CREATE TRIGGER protect_%I_financial BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_ai_job_financial_columns()', v_table_name, v_table_name);
        END IF;
    END LOOP;
END $$;

-- 4. RPC: mark_pending_job_as_failed
DROP FUNCTION IF EXISTS public.mark_pending_job_as_failed(text, uuid, text);
CREATE OR REPLACE FUNCTION public.mark_pending_job_as_failed(
  p_table_name TEXT,
  p_job_id UUID,
  p_error_message TEXT DEFAULT 'Job marcado como falho pelo sistema'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
  v_user_id UUID;
  v_credits_charged BOOLEAN;
  v_credits_refunded BOOLEAN;
  v_user_credit_cost INT;
BEGIN
  IF p_table_name = 'upscaler_jobs' THEN
    UPDATE public.upscaler_jobs SET status = 'failed', error_message = p_error_message, completed_at = NOW() WHERE id = p_job_id AND status IN ('pending', 'queued', 'starting')
    RETURNING TRUE, user_id, COALESCE(credits_charged, FALSE), COALESCE(credits_refunded, FALSE), COALESCE(user_credit_cost, 0)
    INTO v_updated, v_user_id, v_credits_charged, v_credits_refunded, v_user_credit_cost;
  ELSIF p_table_name = 'seedance_jobs' THEN
    UPDATE public.seedance_jobs SET status = 'failed', error_message = p_error_message, completed_at = NOW() WHERE id = p_job_id AND status IN ('pending', 'queued', 'starting')
    RETURNING TRUE, user_id, (COALESCE(credits_charged, 0) > 0), (COALESCE(credits_refunded, 0) > 0), COALESCE(credits_charged, 0)
    INTO v_updated, v_user_id, v_credits_charged, v_credits_refunded, v_user_credit_cost;
  ELSIF p_table_name = 'flyer_maker_jobs' THEN
    UPDATE public.flyer_maker_jobs SET status = 'failed', error_message = p_error_message, completed_at = NOW() WHERE id = p_job_id AND status IN ('pending', 'queued', 'starting')
    RETURNING TRUE, user_id, COALESCE(credits_charged, FALSE), COALESCE(credits_refunded, FALSE), COALESCE(user_credit_cost, 0)
    INTO v_updated, v_user_id, v_credits_charged, v_credits_refunded, v_user_credit_cost;
  END IF;

  IF COALESCE(v_updated, FALSE) AND v_credits_charged = TRUE AND COALESCE(v_credits_refunded, FALSE) = FALSE AND COALESCE(v_user_credit_cost, 0) > 0 AND v_user_id IS NOT NULL THEN
    PERFORM public.refund_upscaler_credits(v_user_id, v_user_credit_cost, 'WATCHDOG_REFUND: ' || LEFT(p_error_message, 100));
    IF p_table_name = 'seedance_jobs' THEN
        UPDATE public.seedance_jobs SET credits_refunded = v_user_credit_cost, refunded_at = NOW() WHERE id = p_job_id;
    ELSE
        EXECUTE format('UPDATE public.%I SET credits_refunded = TRUE WHERE id = $1', p_table_name) USING p_job_id;
    END IF;
  END IF;
  RETURN COALESCE(v_updated, FALSE);
END;
$$;

-- 5. RPC: refund_seedance_job
DROP FUNCTION IF EXISTS public.refund_seedance_job(uuid, text);
CREATE OR REPLACE FUNCTION public.refund_seedance_job(
  _job_id uuid,
  _reason text DEFAULT 'Estorno automático - Seedance falhou'
)
RETURNS TABLE(success boolean, refunded_amount integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_charged integer;
  v_already_refunded integer;
BEGIN
  SELECT user_id, COALESCE(credits_charged, 0), COALESCE(credits_refunded, 0)
  INTO v_user_id, v_charged, v_already_refunded
  FROM public.seedance_jobs
  WHERE id = _job_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Job not found'::text;
    RETURN;
  END IF;

  IF v_already_refunded > 0 THEN
    RETURN QUERY SELECT TRUE, 0, 'Already refunded'::text;
    RETURN;
  END IF;

  IF v_charged <= 0 THEN
    UPDATE public.seedance_jobs
    SET refunded_at = now()
    WHERE id = _job_id;
    RETURN QUERY SELECT TRUE, 0, 'Nothing to refund'::text;
    RETURN;
  END IF;

  UPDATE public.seedance_jobs
  SET credits_refunded = v_charged,
      refunded_at = now()
  WHERE id = _job_id;

  PERFORM public.refund_upscaler_credits(v_user_id, v_charged, _reason);

  RETURN QUERY SELECT TRUE, v_charged, 'Refunded'::text;
END;
$$;

-- 6. RPC: cleanup_all_stale_ai_jobs
DROP FUNCTION IF EXISTS public.cleanup_all_stale_ai_jobs();
CREATE OR REPLACE FUNCTION public.cleanup_all_stale_ai_jobs()
 RETURNS TABLE(
   upscaler_cancelled integer, upscaler_refunded integer,
   pose_cancelled integer, pose_refunded integer,
   veste_cancelled integer, veste_refunded integer,
   video_cancelled integer, video_refunded integer,
   arcano_cancelled integer, arcano_refunded integer,
   chargen_cancelled integer, chargen_refunded integer,
   flyer_cancelled integer, flyer_refunded integer,
   bgremover_cancelled integer, bgremover_refunded integer,
   imggen_cancelled integer, imggen_refunded integer,
   videogen_cancelled integer, videogen_refunded integer,
   movieled_cancelled integer, movieled_refunded integer,
   seedance_cancelled integer, seedance_refunded integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  job RECORD;
  v_upscaler_cancelled INTEGER := 0; v_upscaler_refunded INTEGER := 0;
  v_pose_cancelled INTEGER := 0; v_pose_refunded INTEGER := 0;
  v_veste_cancelled INTEGER := 0; v_veste_refunded INTEGER := 0;
  v_video_cancelled INTEGER := 0; v_video_refunded INTEGER := 0;
  v_arcano_cancelled INTEGER := 0; v_arcano_refunded INTEGER := 0;
  v_chargen_cancelled INTEGER := 0; v_chargen_refunded INTEGER := 0;
  v_flyer_cancelled INTEGER := 0; v_flyer_refunded INTEGER := 0;
  v_bgremover_cancelled INTEGER := 0; v_bgremover_refunded INTEGER := 0;
  v_imggen_cancelled INTEGER := 0; v_imggen_refunded INTEGER := 0;
  v_videogen_cancelled INTEGER := 0; v_videogen_refunded INTEGER := 0;
  v_movieled_cancelled INTEGER := 0; v_movieled_refunded INTEGER := 0;
  v_seedance_cancelled INTEGER := 0; v_seedance_refunded INTEGER := 0;
  stale_threshold INTERVAL := INTERVAL '10 minutes';
BEGIN
  -- FLYER MAKER
  FOR job IN SELECT id, user_id, user_credit_cost, credits_charged, credits_refunded FROM flyer_maker_jobs WHERE status IN ('running','queued','starting','pending') AND created_at < NOW() - stale_threshold AND output_url IS NULL LOOP
    UPDATE flyer_maker_jobs SET status='failed', error_message='Job timed out - cancelled automatically after 10 minutes', completed_at=NOW() WHERE id=job.id;
    v_flyer_cancelled := v_flyer_cancelled + 1;
    IF job.credits_charged = TRUE AND job.credits_refunded IS NOT TRUE AND job.user_id IS NOT NULL AND job.user_credit_cost > 0 THEN
      PERFORM refund_upscaler_credits(job.user_id, job.user_credit_cost, 'Estorno automático: timeout após 10 minutos (Flyer Maker)');
      UPDATE flyer_maker_jobs SET credits_refunded=TRUE WHERE id=job.id; v_flyer_refunded := v_flyer_refunded + job.user_credit_cost;
    END IF;
  END LOOP;

  -- SEEDANCE
  FOR job IN SELECT id, user_id, credits_charged, credits_refunded FROM seedance_jobs WHERE status IN ('running','queued','starting','pending') AND created_at < NOW() - stale_threshold AND output_url IS NULL LOOP
    UPDATE seedance_jobs SET status='failed', error_message='Job timed out - cancelled automatically after 10 minutes', completed_at=NOW() WHERE id=job.id;
    v_seedance_cancelled := v_seedance_cancelled + 1;
    IF COALESCE(job.credits_charged, 0) > 0 AND COALESCE(job.credits_refunded, 0) = 0 AND job.user_id IS NOT NULL THEN
      PERFORM refund_upscaler_credits(job.user_id, job.credits_charged, 'Estorno automático: timeout após 10 minutos (Seedance)');
      UPDATE seedance_jobs SET credits_refunded=job.credits_charged, refunded_at=NOW() WHERE id=job.id; v_seedance_refunded := v_seedance_refunded + job.credits_charged;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_upscaler_cancelled, v_upscaler_refunded, v_pose_cancelled, v_pose_refunded, v_veste_cancelled, v_veste_refunded, v_video_cancelled, v_video_refunded, v_arcano_cancelled, v_arcano_refunded, v_chargen_cancelled, v_chargen_refunded, v_flyer_cancelled, v_flyer_refunded, v_bgremover_cancelled, v_bgremover_refunded, v_imggen_cancelled, v_imggen_refunded, v_videogen_cancelled, v_videogen_refunded, v_movieled_cancelled, v_movieled_refunded, v_seedance_cancelled, v_seedance_refunded;
END;
$function$;

-- 7. RPC: register_collaborator_tool_earning
DROP FUNCTION IF EXISTS public.register_collaborator_tool_earning(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.register_collaborator_tool_earning(_user_id uuid, _job_id text, _tool_table text, _prompt_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _partner_id UUID;
  _prompt_title TEXT;
  _amount NUMERIC;
  _tool_name TEXT;
  _rows_affected INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaborator_tool_rates') THEN
    RETURN jsonb_build_object('success', false, 'error', 'system_not_ready');
  END IF;

  SELECT earning_per_use, tool_display_name INTO _amount, _tool_name
  FROM collaborator_tool_rates
  WHERE tool_table = _tool_table AND is_active = true;
  
  IF _amount IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'tool_not_configured');
  END IF;
  
  SELECT pp.partner_id, pp.title INTO _partner_id, _prompt_title
  FROM partner_prompts pp
  JOIN partners p ON p.id = pp.partner_id
  WHERE pp.id::text = _prompt_id AND pp.approved = true AND p.is_active = true;
  
  IF _partner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_prompt_or_partner');
  END IF;
  
  INSERT INTO collaborator_tool_earnings (collaborator_id, user_id, job_id, tool_table, prompt_id, prompt_title, amount)
  VALUES (_partner_id, _user_id, _job_id, _tool_table, _prompt_id, _prompt_title, _amount)
  ON CONFLICT (job_id, tool_table) DO NOTHING;
  
  GET DIAGNOSTICS _rows_affected = ROW_COUNT;
  
  IF _rows_affected > 0 THEN
    INSERT INTO collaborator_balances (collaborator_id, total_earned)
    VALUES (_partner_id, _amount)
    ON CONFLICT (collaborator_id) DO UPDATE SET total_earned = collaborator_balances.total_earned + _amount, updated_at = now();
    RETURN jsonb_build_object('success', true, 'amount', _amount);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'already_registered');
  END IF;
END;
$function$;

-- 8. RPC: get_ai_tools_cost_averages
DROP FUNCTION IF EXISTS public.get_ai_tools_cost_averages();
CREATE OR REPLACE FUNCTION public.get_ai_tools_cost_averages()
RETURNS TABLE(
  tool_name TEXT,
  total_completed BIGINT,
  avg_rh_cost NUMERIC,
  avg_user_credits NUMERIC,
  total_rh_cost NUMERIC,
  total_user_credits NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 'Flyer Maker'::TEXT, COUNT(*)::BIGINT, COALESCE(ROUND(AVG(fmj.rh_cost)::NUMERIC, 2), 0), COALESCE(ROUND(AVG(fmj.user_credit_cost)::NUMERIC, 2), 0), COALESCE(SUM(fmj.rh_cost)::NUMERIC, 0), COALESCE(SUM(fmj.user_credit_cost)::NUMERIC, 0)
  FROM flyer_maker_jobs fmj WHERE fmj.status = 'completed'
  UNION ALL
  SELECT 'Seedance 2.0'::TEXT, COUNT(*)::BIGINT, COALESCE(ROUND(AVG(sj.rh_cost)::NUMERIC, 2), 0), COALESCE(ROUND(AVG(sj.credits_charged::INTEGER)::NUMERIC, 2), 0), COALESCE(SUM(sj.rh_cost)::NUMERIC, 0), COALESCE(SUM(sj.credits_charged::INTEGER)::NUMERIC, 0)
  FROM seedance_jobs sj WHERE sj.status = 'completed';
END;
$$;