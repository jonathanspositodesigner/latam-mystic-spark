import { useEffect, useRef, useCallback } from 'react';

/**
 * Cleanup queued jobs when user leaves the page.
 * - Queued jobs are cancelled with automatic refund
 * - Running/starting jobs show warning but are NOT cancelled
 */
export function useQueueSessionCleanup(
  sessionId: string | null,
  status: string
) {
  const statusRef = useRef(status);
  const sessionIdRef = useRef(sessionId);
  
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  
  const canCancelWithRefund = useCallback(() => statusRef.current === 'queued', []);
  
  const cancelSessionJobs = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || !canCancelWithRefund()) return;
    
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/cancel-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ sessionId: currentSessionId }),
          keepalive: true,
        }
      );
    } catch (error) {
      console.error('[QueueCleanup] Failed to cancel session:', error);
    }
  }, [canCancelWithRefund]);
  
  useEffect(() => {
    if (!sessionId) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentStatus = statusRef.current;
      
      if (currentStatus === 'queued') {
        cancelSessionJobs();
        e.preventDefault();
        e.returnValue = 'Tienes un trabajo en cola. Si sales, será cancelado y los créditos devueltos.';
        return e.returnValue;
      }
      
      if (['starting', 'running'].includes(currentStatus)) {
        e.preventDefault();
        e.returnValue = 'Tienes un procesamiento en curso. Si sales, perderás el resultado.';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, cancelSessionJobs]);
  
  useEffect(() => {
    return () => {
      if (statusRef.current === 'queued' && sessionIdRef.current) {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/cancel-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ sessionId: sessionIdRef.current }),
            keepalive: true,
          }
        ).catch(console.error);
      }
    };
  }, []);
  
  return { cancelSessionJobs };
}
