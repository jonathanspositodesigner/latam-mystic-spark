CREATE TABLE IF NOT EXISTS public.seedance_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  task_id text,
  status text DEFAULT 'pending',
  model text NOT NULL,
  prompt text NOT NULL,
  duration integer DEFAULT 5,
  quality text DEFAULT '720p',
  aspect_ratio text DEFAULT '16:9',
  generate_audio boolean DEFAULT true,
  input_image_urls text[],
  input_video_urls text[],
  input_audio_urls text[],
  output_url text,
  thumbnail_url text,
  error_message text,
  credits_charged integer,
  rh_cost numeric,
  generation_type text,
  source_tool text,
  reference_prompt_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

ALTER TABLE public.seedance_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_seedance_jobs" ON public.seedance_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "service_role_seedance_jobs" ON public.seedance_jobs
  FOR ALL TO service_role USING (true);

-- Registro da ferramenta Flyer Maker nas configurações de custo
INSERT INTO public.ai_tool_settings (tool_name, credit_cost)
VALUES ('Flyer Maker', 100)
ON CONFLICT (tool_name) DO UPDATE SET credit_cost = 100;

-- Função para estornar créditos de jobs Seedance
CREATE OR REPLACE FUNCTION public.refund_seedance_job(_job_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_amount integer;
    v_status text;
    v_charged integer;
BEGIN
    SELECT user_id, status, credits_charged 
    INTO v_user_id, v_status, v_charged
    FROM public.seedance_jobs
    WHERE id = _job_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;

    IF v_charged IS NULL OR v_charged <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No credits were charged');
    END IF;

    -- Chamada ao RPC central de estorno
    PERFORM public.refund_upscaler_credits(v_user_id, v_charged, _reason);

    -- Atualizar o job para refletir o estorno
    UPDATE public.seedance_jobs
    SET status = 'failed',
        error_message = _reason,
        credits_charged = 0
    WHERE id = _job_id;

    RETURN jsonb_build_object('success', true, 'amount', v_charged);
END;
$$;
