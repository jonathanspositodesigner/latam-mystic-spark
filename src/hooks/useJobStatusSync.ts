/**
 * useJobStatusSync — Triple sync system for AI jobs
 * 
 * 1. REALTIME (primary): Supabase Realtime for instant updates
 * 2. POLLING (backup): Direct DB query every 5s after initial delay
 * 3. VISIBILITY RECOVERY: When user returns to tab, check immediately
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ToolId, getToolTable, getToolConfig } from '@/ai/toolRegistry';
import { JobStatus, JobUpdate, queryJobStatus } from '@/ai/JobManager';

const POLLING_CONFIG = {
  INITIAL_DELAY_MS: 5000,
  INTERVAL_MS: 5000,
} as const;

interface UseJobStatusSyncOptions {
  jobId: string | null;
  toolId: ToolId;
  enabled: boolean;
  onStatusChange: (update: JobUpdate) => void;
  onGlobalStatusChange?: (status: JobStatus) => void;
}

export function useJobStatusSync({
  jobId,
  toolId,
  enabled,
  onStatusChange,
  onGlobalStatusChange,
}: UseJobStatusSyncOptions) {
  const tableName = getToolTable(toolId);
  const toolConfig = getToolConfig(toolId);
  
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onGlobalStatusChangeRef = useRef(onGlobalStatusChange);
  onGlobalStatusChangeRef.current = onGlobalStatusChange;
  
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const absoluteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownStatusRef = useRef<JobStatus | null>(null);
  const isCompletedRef = useRef(false);
  
  useEffect(() => {
    const processUpdate = async (data: any, source: string) => {
      const status = data.status as JobStatus;
      if (status === lastKnownStatusRef.current) return;
      
      console.log(`[JobSync] ${source}: ${lastKnownStatusRef.current} -> ${status}`);
      lastKnownStatusRef.current = status;
      onGlobalStatusChangeRef.current?.(status);
      
      let update: JobUpdate = {
        status,
        outputUrl: data.output_url,
        thumbnailUrl: data.thumbnail_url,
        errorMessage: data.error_message,
        position: data.position,
        currentStep: data.current_step,
      };
      
      // Fallback: if completed but no output_url, fetch from DB
      if (status === 'completed' && !data.output_url && jobId) {
        const dbUpdate = await queryJobStatus(toolId, jobId);
        if (dbUpdate?.outputUrl) {
          update = { ...update, outputUrl: dbUpdate.outputUrl };
        } else {
          await new Promise(r => setTimeout(r, 2000));
          const retry = await queryJobStatus(toolId, jobId);
          if (retry?.outputUrl) update = { ...update, outputUrl: retry.outputUrl };
        }
      }
      
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        isCompletedRef.current = true;
        if (absoluteTimeoutRef.current) { clearTimeout(absoluteTimeoutRef.current); absoluteTimeoutRef.current = null; }
      }
      
      onStatusChangeRef.current(update);
    };
    
    const pollJobStatus = async () => {
      if (!jobId || isCompletedRef.current) return;
      try {
        const update = await queryJobStatus(toolId, jobId);
        if (update) {
          processUpdate({
            status: update.status,
            output_url: update.outputUrl,
            thumbnail_url: update.thumbnailUrl,
            error_message: update.errorMessage,
            position: update.position,
            current_step: update.currentStep,
          }, 'polling');
        }
      } catch (error) {
        console.error('[JobSync] Polling error:', error);
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isCompletedRef.current) pollJobStatus();
    };
    
    const doCleanup = () => {
      if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
      if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
      if (absoluteTimeoutRef.current) { clearTimeout(absoluteTimeoutRef.current); absoluteTimeoutRef.current = null; }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      lastKnownStatusRef.current = null;
      isCompletedRef.current = false;
    };
    
    if (!enabled || !jobId) { doCleanup(); return; }
    
    console.log(`[JobSync] Setting up triple sync for ${toolId} job ${jobId}`);
    isCompletedRef.current = false;
    lastKnownStatusRef.current = null;
    
    // 1. REALTIME
    const channel = supabase
      .channel(`job-sync-${toolId}-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: tableName, filter: `id=eq.${jobId}` },
        (payload) => { if (!isCompletedRef.current) processUpdate(payload.new, 'realtime'); }
      )
      .subscribe();
    realtimeChannelRef.current = channel;
    
    // 2. POLLING
    const pollingDelayTimeout = setTimeout(() => {
      if (isCompletedRef.current) return;
      pollJobStatus();
      pollingIntervalRef.current = setInterval(() => {
        if (isCompletedRef.current) { clearInterval(pollingIntervalRef.current!); pollingIntervalRef.current = null; return; }
        pollJobStatus();
      }, POLLING_CONFIG.INTERVAL_MS);
    }, POLLING_CONFIG.INITIAL_DELAY_MS);
    
    // 3. VISIBILITY
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 4. ABSOLUTE TIMEOUT
    const timeoutMs = toolConfig.timeoutMs;
    absoluteTimeoutRef.current = setTimeout(async () => {
      if (isCompletedRef.current) return;
      
      // Final check
      const update = await queryJobStatus(toolId, jobId);
      if (update && ['completed', 'failed', 'cancelled'].includes(update.status)) {
        processUpdate({ status: update.status, output_url: update.outputUrl, error_message: update.errorMessage, position: update.position }, 'polling');
        return;
      }
      
      // Force fail
      isCompletedRef.current = true;
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ table: tableName, jobId, status: 'failed', errorMessage: 'Tiempo límite de procesamiento excedido' }),
        });
      } catch (e) { console.error('[JobSync] Failed to cancel job server-side:', e); }
      
      onGlobalStatusChangeRef.current?.('failed');
      onStatusChangeRef.current({ status: 'failed', errorMessage: 'Tiempo límite de procesamiento excedido. Tus créditos serán reembolsados automáticamente.' });
      doCleanup();
    }, timeoutMs);
    
    return () => { clearTimeout(pollingDelayTimeout); doCleanup(); };
  }, [enabled, jobId, toolId, tableName, toolConfig.timeoutMs]);
}
