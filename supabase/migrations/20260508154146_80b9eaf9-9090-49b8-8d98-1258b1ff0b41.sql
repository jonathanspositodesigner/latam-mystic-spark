-- ============================================================
-- WATCHDOG — limpa seedance_jobs travados em 'pending' por >10min
-- Roda via pg_cron a cada 5 min (Opção B do plano de auditoria)
-- ============================================================
-- Mata jobs zombie (pipeline morreu antes de completar) e estorna
-- créditos se já tiverem sido cobrados. Frontend (que faz polling)
-- detecta status='failed' e para o spinner.
-- ============================================================

CREATE OR REPLACE FUNCTION public.watchdog_cleanup_stuck_seedance_jobs()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stuck RECORD;
  _cleaned INTEGER := 0;
  _refunded INTEGER := 0;
  _refund_total INTEGER := 0;
BEGIN
  -- Encontra jobs travados em 'pending' há mais de 10 min sem task_id
  FOR _stuck IN
    SELECT id, user_id, credits_charged
    FROM public.seedance_jobs
    WHERE status = 'pending'
      AND task_id IS NULL
      AND created_at < now() - interval '10 minutes'
    ORDER BY created_at ASC
    LIMIT 50
  LOOP
    -- Marca como failed
    UPDATE public.seedance_jobs
    SET status = 'failed',
        error_message = 'Watchdog: job preso em pending por >10min sem task_id (pipeline interrompida)',
        completed_at = now()
    WHERE id = _stuck.id;
    _cleaned := _cleaned + 1;

    -- Estorna se créditos já foram cobrados
    IF _stuck.credits_charged IS NOT NULL AND _stuck.credits_charged > 0 THEN
      BEGIN
        PERFORM public.refund_upscaler_credits(
          _stuck.user_id,
          _stuck.credits_charged,
          'Estorno watchdog: job ' || _stuck.id::text || ' preso'
        );
        _refunded := _refunded + 1;
        _refund_total := _refund_total + _stuck.credits_charged;

        -- Marca como estornado no próprio job
        UPDATE public.seedance_jobs
        SET credits_refunded = _stuck.credits_charged,
            refunded_at = now()
        WHERE id = _stuck.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Watchdog refund failed for job %: %', _stuck.id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'cleaned', _cleaned,
    'refunded_jobs', _refunded,
    'refunded_credits', _refund_total,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.watchdog_cleanup_stuck_seedance_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.watchdog_cleanup_stuck_seedance_jobs() TO service_role;

-- ============================================================
-- Schedule via pg_cron (extensão deve estar habilitada)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension setup skipped: %', SQLERRM;
END $$;

-- Remove schedule existente (se já houver) e cria novo
DO $$
BEGIN
  PERFORM cron.unschedule('watchdog-stuck-seedance-jobs');
EXCEPTION WHEN OTHERS THEN
  -- Job não existe, OK
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'watchdog-stuck-seedance-jobs',
    '*/5 * * * *',
    $cron$ SELECT public.watchdog_cleanup_stuck_seedance_jobs(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule failed (extensão pode não estar disponível): %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';