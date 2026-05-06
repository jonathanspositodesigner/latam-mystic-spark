-- Marcar como falho jobs de seedance que estão 'pending' ou 'running' há mais de 10 minutos
UPDATE public.seedance_jobs 
SET status = 'failed', 
    error_message = 'Job expirado por inatividade no processamento.',
    updated_at = now()
WHERE status IN ('pending', 'running', 'starting', 'queued') 
  AND created_at < (now() - interval '10 minutes');

-- Marcar como falho jobs de flyer_maker que estão presos
UPDATE public.flyer_maker_jobs
SET status = 'failed',
    error_message = 'Job expirado por inatividade no processamento.',
    updated_at = now()
WHERE status IN ('pending', 'running', 'starting', 'queued')
  AND created_at < (now() - interval '10 minutes');