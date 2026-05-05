import { useCallback, useRef } from 'react';
import { useAIJob } from '@/contexts/AIJobContext';
import { subscribeToJob, type JobStatus, type JobUpdate } from '@/ai/JobManager';

interface UseAIJobWithNotificationResult {
  registerAndSubscribe: (
    toolType: any,
    jobId: string,
    toolDisplayName: string,
    initialStatus: JobStatus,
    onUpdate: (update: JobUpdate) => void
  ) => () => void;
  clearJob: () => void;
  isJobActive: boolean;
  activeToolName: string | null;
  jobStatus: JobStatus | null;
}

export function useAIJobWithNotification(): UseAIJobWithNotificationResult {
  const { 
    registerJob, 
    updateJobStatus, 
    clearJob: contextClearJob,
    isJobActive,
    activeToolName,
    jobStatus,
  } = useAIJob();
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  const registerAndSubscribe = useCallback((
    toolType: any,
    jobId: string,
    toolDisplayName: string,
    initialStatus: JobStatus,
    onUpdate: (update: JobUpdate) => void
  ) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    
    registerJob(jobId, toolDisplayName, initialStatus);
    
    const unsubscribe = subscribeToJob(
      toolType,
      jobId,
      onUpdate,
      updateJobStatus
    );
    
    unsubscribeRef.current = unsubscribe;
    
    return unsubscribe;
  }, [registerJob, updateJobStatus]);
  
  const clearJob = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    contextClearJob();
  }, [contextClearJob]);
  
  return {
    registerAndSubscribe,
    clearJob,
    isJobActive,
    activeToolName,
    jobStatus,
  };
}
