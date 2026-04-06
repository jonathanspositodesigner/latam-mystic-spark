/**
 * useAIJob — Universal hook for any AI tool page
 * 
 * Usage:
 *   const { startProcessing, cancelProcessing, status, outputUrl, ... } = useAIJob({ toolId: 'upscaler' });
 * 
 * Internally handles: upload → createJob → startJob → subscribe → polling → result → refund on failure
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAIJobContext } from '@/contexts/AIJobContext';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { useQueueSessionCleanup } from '@/hooks/useQueueSessionCleanup';
import { useProcessingButton } from '@/hooks/useProcessingButton';
import { ToolId, getToolConfig } from '@/ai/toolRegistry';
import {
  checkActiveJob,
  createJob,
  startJob,
  cancelJob as centralCancelJob,
  uploadToStorage,
  JobUpdate,
} from '@/ai/JobManager';
import { toast } from 'sonner';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'queued' | 'completed' | 'error';

interface UseAIJobOptions {
  toolId: ToolId;
}

export function useAIJob({ toolId }: UseAIJobOptions) {
  const { user } = useAuth();
  const { refetch: refetchCredits, canAfford } = useCredits();
  const { registerJob, updateJobStatus: updateGlobalStatus, clearJob: clearGlobalJob } = useAIJobContext();
  const toolConfig = getToolConfig(toolId);

  // State
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();

  // Queue cleanup on unmount
  useQueueSessionCleanup(sessionIdRef.current, status);

  // Triple sync (Realtime + Polling + Visibility)
  useJobStatusSync({
    jobId,
    toolId,
    enabled: status === 'processing' || status === 'queued' || status === 'uploading',
    onStatusChange: useCallback((update: JobUpdate) => {
      if (update.status === 'completed' && update.outputUrl) {
        setOutputUrl(update.outputUrl);
        setStatus('completed');
        setProgress(100);
        toast.success('¡Listo! Tu imagen fue procesada.');
        refetchCredits();
      } else if (update.status === 'failed') {
        setStatus('error');
        setErrorMessage(update.errorMessage || 'Error en el procesamiento');
        toast.error(update.errorMessage || 'Error en el procesamiento');
        endSubmit();
        refetchCredits();
      } else if (update.status === 'running') {
        setStatus('processing');
        setQueuePosition(0);
        setProgress(prev => Math.min(prev + 5, 90));
      } else if (update.status === 'queued') {
        setStatus('queued');
        setQueuePosition(update.position || 1);
      }
      setCurrentStep(update.currentStep || update.status);
    }, [refetchCredits, endSubmit]),
    onGlobalStatusChange: updateGlobalStatus,
  });

  // Register job in global context
  useEffect(() => {
    if (jobId) registerJob(jobId, toolConfig.nameEs, 'pending');
  }, [jobId, registerJob, toolConfig.nameEs]);

  // Progress animation
  useEffect(() => {
    if (status !== 'processing') return;
    const interval = setInterval(() => {
      setProgress(prev => prev >= 90 ? prev : prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [status]);

  const startProcessing = useCallback(async (
    file: File,
    options?: Record<string, any>
  ) => {
    if (!user?.id) { toast.error('Debes iniciar sesión'); return; }
    if (!startSubmit()) return;

    const creditCost = options?.creditCost ?? toolConfig.creditCost;
    
    if (!canAfford(creditCost)) {
      toast.error('Créditos insuficientes');
      endSubmit();
      return;
    }

    // Check active job
    const activeCheck = await checkActiveJob(user.id);
    if (activeCheck.hasActiveJob) {
      toast.error(`Ya tienes un trabajo activo en ${activeCheck.activeTool}`);
      endSubmit();
      return;
    }

    try {
      // 1. Upload
      setStatus('uploading');
      setProgress(10);
      setErrorMessage(null);
      setOutputUrl(null);

      const { url: inputUrl, error: uploadError } = await uploadToStorage(
        file, toolId, user.id
      );

      if (!inputUrl || uploadError) {
        throw new Error(uploadError || 'Error al subir la imagen');
      }

      setProgress(30);

      // 2. Create job
      const { jobId: newJobId, error: createError } = await createJob(
        toolId, user.id, sessionIdRef.current,
        { input_url: inputUrl, user_credit_cost: creditCost }
      );

      if (!newJobId || createError) {
        throw new Error(createError || 'Error al crear el trabajo');
      }

      setJobId(newJobId);
      setStatus('processing');
      setProgress(40);

      // 3. Start job
      const result = await startJob(toolId, newJobId, {
        imageUrl: inputUrl,
        userId: user.id,
        creditCost,
        ...options,
      });

      if (!result.success) {
        if (result.code === 'INSUFFICIENT_CREDITS') {
          setStatus('error');
          setErrorMessage('Créditos insuficientes');
          endSubmit();
          return;
        }
        throw new Error(result.error || 'Error al iniciar el procesamiento');
      }

      if (result.queued) {
        setStatus('queued');
        setQueuePosition(result.position || 1);
      }

      setProgress(50);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setStatus('error');
      setErrorMessage(msg);
      toast.error(msg);
      endSubmit();
    }
  }, [user, toolId, toolConfig.creditCost, startSubmit, endSubmit, canAfford]);

  const cancelProcessing = useCallback(async () => {
    if (!jobId) return;
    
    const result = await centralCancelJob(toolId, jobId);
    if (result.success) {
      setStatus('idle');
      setJobId(null);
      setProgress(0);
      clearGlobalJob();
      if (result.refundedAmount > 0) {
        toast.success(`Trabajo cancelado. ${result.refundedAmount} créditos reembolsados.`);
      } else {
        toast.info('Trabajo cancelado.');
      }
      refetchCredits();
      endSubmit();
    } else {
      toast.error(result.errorMessage || 'Error al cancelar');
    }
  }, [jobId, toolId, clearGlobalJob, refetchCredits, endSubmit]);

  const reset = useCallback(() => {
    setStatus('idle');
    setOutputUrl(null);
    setErrorMessage(null);
    setJobId(null);
    setQueuePosition(0);
    setProgress(0);
    setCurrentStep(null);
    clearGlobalJob();
    endSubmit();
    sessionIdRef.current = crypto.randomUUID();
  }, [clearGlobalJob, endSubmit]);

  return {
    startProcessing,
    cancelProcessing,
    reset,
    status,
    outputUrl,
    errorMessage,
    isProcessing: status === 'processing' || status === 'uploading' || status === 'queued',
    isQueued: status === 'queued',
    queuePosition,
    progress,
    jobId,
    currentStep,
    isSubmitting,
  };
}
