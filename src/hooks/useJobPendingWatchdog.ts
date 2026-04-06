import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ToolId, getToolTable } from '@/ai/toolRegistry';

const ORPHAN_TIMEOUT_MS = 240000; // 240s

interface UseJobPendingWatchdogOptions {
  jobId: string | null;
  toolType: ToolId;
  enabled: boolean;
  onJobFailed: (errorMessage: string) => void;
}

export function useJobPendingWatchdog({
  jobId,
  toolType,
  enabled,
  onJobFailed,
}: UseJobPendingWatchdogOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredRef = useRef(false);
  const currentJobIdRef = useRef<string | null>(null);

  const stableOnJobFailed = useCallback(onJobFailed, [onJobFailed]);

  useEffect(() => {
    if (jobId !== currentJobIdRef.current) {
      currentJobIdRef.current = jobId;
      hasTriggeredRef.current = false;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    }

    if (!enabled || !jobId) {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      return;
    }

    if (hasTriggeredRef.current) return;

    const tableName = getToolTable(toolType);

    timeoutRef.current = setTimeout(async () => {
      if (hasTriggeredRef.current) return;

      try {
        const { data: job, error } = await supabase
          .from(tableName as 'upscaler_jobs')
          .select('status, task_id, created_at, current_step, step_history')
          .eq('id', jobId)
          .maybeSingle();

        if (error || !job) return;

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'running') return;
        if (job.task_id) return;

        const createdAt = new Date(job.created_at).getTime();
        const age = Date.now() - createdAt;

        if (age < ORPHAN_TIMEOUT_MS) return;

        hasTriggeredRef.current = true;

        // Try to mark as failed via queue manager
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              table: tableName,
              jobId: jobId,
              status: 'failed',
              errorMessage: 'Error al iniciar procesamiento. La conexión con el servidor falló.',
            }),
          });
        } catch (rpcErr) {
          console.error('[PendingWatchdog] Failed to mark job:', rpcErr);
        }

        stableOnJobFailed('Error al iniciar procesamiento. Intenta nuevamente.');

      } catch (e) {
        console.error('[PendingWatchdog] Exception:', e);
      }
    }, ORPHAN_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
  }, [jobId, enabled, toolType, stableOnJobFailed]);
}
