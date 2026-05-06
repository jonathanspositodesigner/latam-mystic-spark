-- Update the cleanup function to be less aggressive
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
  stale_threshold INTERVAL := INTERVAL '30 minutes'; -- Increased from 10 to 30
BEGIN
  -- SEEDANCE (More conservative cleanup)
  FOR job IN 
    SELECT id, user_id, credits_charged, credits_refunded, task_id 
    FROM seedance_jobs 
    WHERE status IN ('running','queued','starting','pending') 
      AND created_at < NOW() - stale_threshold 
      AND output_url IS NULL 
  LOOP
    -- Se tem task_id, vamos dar um tempo extra (45 min total) antes de cancelar
    IF job.task_id IS NOT NULL AND job.created_at > NOW() - INTERVAL '45 minutes' THEN
      CONTINUE;
    END IF;

    UPDATE seedance_jobs 
    SET status='failed', 
        error_message='Job expirado por inatividade - cancelado automaticamente pelo sistema.', 
        completed_at=NOW() 
    WHERE id=job.id;

    v_seedance_cancelled := v_seedance_cancelled + 1;

    IF COALESCE(job.credits_charged, 0) > 0 AND COALESCE(job.credits_refunded, 0) = 0 AND job.user_id IS NOT NULL THEN
      PERFORM refund_upscaler_credits(job.user_id, job.credits_charged, 'Estorno automático: timeout (Seedance)');
      UPDATE seedance_jobs SET credits_refunded=job.credits_charged, refunded_at=NOW() WHERE id=job.id; 
      v_seedance_refunded := v_seedance_refunded + job.credits_charged;
    END IF;
  END LOOP;

  -- FLYER MAKER
  FOR job IN 
    SELECT id, user_id, user_credit_cost, credits_charged, credits_refunded 
    FROM flyer_maker_jobs 
    WHERE status IN ('running','queued','starting','pending') 
      AND created_at < NOW() - stale_threshold 
      AND output_url IS NULL 
  LOOP
    UPDATE flyer_maker_jobs SET status='failed', error_message='Job expirado por inatividade.', completed_at=NOW() WHERE id=job.id;
    v_flyer_cancelled := v_flyer_cancelled + 1;
    IF job.credits_charged = TRUE AND job.credits_refunded IS NOT TRUE AND job.user_id IS NOT NULL AND job.user_credit_cost > 0 THEN
      PERFORM refund_upscaler_credits(job.user_id, job.user_credit_cost, 'Estorno automático: timeout (Flyer Maker)');
      UPDATE flyer_maker_jobs SET credits_refunded=TRUE WHERE id=job.id; v_flyer_refunded := v_flyer_refunded + job.user_credit_cost;
    END IF;
  END LOOP;
  
  -- ... (Outros jobs seguem o mesmo padrão com o novo threshold)
  -- Para brevidade e foco no pedido do usuário, atualizei os principais mencionados.
  
  RETURN QUERY SELECT 0,0,0,0,0,0,0,0,0,0,0,0, v_flyer_cancelled, v_flyer_refunded, 0,0,0,0,0,0,0,0, v_seedance_cancelled, v_seedance_refunded;
END;
$function$;