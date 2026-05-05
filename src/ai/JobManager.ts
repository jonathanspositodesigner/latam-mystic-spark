/**
 * AI TOOLS JOB MANAGER — Centralized module for all AI tool jobs
 * 
 * Uses direct mapping for configuration. Handles:
 * - Check active jobs (1 per user globally)
 * - Create/start jobs with retry logic
 * - Subscribe to realtime updates
 * - Cancel jobs with refund
 * - Upload files to storage
 * - Check credits
 */

import { supabase } from '@/integrations/supabase/client';

export type ToolType = 'upscaler' | 'pose_changer' | 'veste_ai' | 'video_upscaler' | 'arcano_cloner' | 'character_generator' | 'flyer_maker' | 'bg_remover' | 'image_generator' | 'video_generator' | 'movieled_maker' | 'flyer_motion';

const TABLE_MAP: Record<ToolType, string> = {
  upscaler: 'upscaler_jobs',
  pose_changer: 'pose_changer_jobs',
  veste_ai: 'veste_ai_jobs',
  video_upscaler: 'video_upscaler_jobs',
  arcano_cloner: 'arcano_cloner_jobs',
  character_generator: 'character_generator_jobs',
  flyer_maker: 'flyer_maker_jobs',
  bg_remover: 'bg_remover_jobs',
  image_generator: 'image_generator_jobs',
  video_generator: 'video_generator_jobs',
  movieled_maker: 'movieled_maker_jobs',
  flyer_motion: 'seedance_jobs',
};

const EDGE_FUNCTION_MAP: Record<ToolType, string> = {
  upscaler: 'runninghub-upscaler/run',
  pose_changer: 'runninghub-pose-changer/run',
  veste_ai: 'runninghub-veste-ai/run',
  video_upscaler: 'runninghub-video-upscaler/run',
  arcano_cloner: 'runninghub-arcano-cloner/run',
  character_generator: 'runninghub-character-generator/run',
  flyer_maker: 'runninghub-flyer-maker/run',
  bg_remover: 'runninghub-bg-remover/run',
  image_generator: 'runninghub-image-generator/run',
  video_generator: 'generate-video/run',
  movieled_maker: 'runninghub-movieled-maker/run',
  flyer_motion: 'runninghub-flyer-motion',
};


// ==================== TYPES ====================

export type JobStatus = 'pending' | 'queued' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobResult {
  success: boolean;
  jobId?: string;
  queued?: boolean;
  position?: number;
  error?: string;
  code?: string;
}

export interface ActiveJobInfo {
  hasActiveJob: boolean;
  activeTool: string | null;
  activeJobId?: string;
  activeStatus?: string;
}

export interface CancelResult {
  success: boolean;
  refundedAmount: number;
  errorMessage?: string;
}

export interface JobUpdate {
  status: JobStatus;
  outputUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  position?: number;
  currentStep?: string;
}

// ==================== CORE FUNCTIONS ====================

/**
 * Check if user has an active job in ANY tool
 */
export async function checkActiveJob(userId: string): Promise<ActiveJobInfo> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/check-user-active`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ userId }),
      }
    );
    
    if (!response.ok) {
      console.error('[JobManager] checkActiveJob failed:', response.status);
      return { hasActiveJob: false, activeTool: null };
    }
    
    return await response.json();
  } catch (error) {
    console.error('[JobManager] checkActiveJob error:', error);
    return { hasActiveJob: false, activeTool: null };
  }
}

/**
 * Cancel an active job and refund credits if applicable
 */
export async function cancelJob(
  toolType: ToolType | string,
  jobId: string
): Promise<CancelResult> {
  try {
    let tableName: string;
    if ((toolType as ToolType) in TABLE_MAP) {
      tableName = TABLE_MAP[toolType as ToolType];
    } else {
      tableName = toolType;
    }
    console.log(`[JobManager] Cancelling job ${jobId} in ${tableName}`);

    
    const { data, error } = await supabase.rpc('user_cancel_ai_job', {
      p_table_name: tableName,
      p_job_id: jobId,
    });
    
    if (error) {
      console.error('[JobManager] Cancel error:', error);
      return { success: false, refundedAmount: 0, errorMessage: error.message };
    }
    
    const result = (Array.isArray(data) ? data[0] : data) as any;
    return {
      success: result?.success ?? false,
      refundedAmount: result?.refunded_amount ?? 0,
      errorMessage: result?.error_message ?? undefined,
    };

  } catch (error) {
    console.error('[JobManager] Cancel exception:', error);
    return {
      success: false,
      refundedAmount: 0,
      errorMessage: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Create a job record in the database
 */
export async function createJob(
  toolType: ToolType,
  userId: string,
  sessionId: string,
  payload: Record<string, any>
): Promise<{ jobId: string | null; error?: string }> {
  const tableName = TABLE_MAP[toolType];

  
  try {
    const insertData = {
      session_id: sessionId,
      user_id: userId,
      status: 'pending' as const,
      ...payload,
    };
    
    const { data: job, error } = await supabase
      .from(tableName as any)
      .insert(insertData)
      .select('id')
      .single();
    
    if (error || !job) {
      console.error('[JobManager] createJob error:', error);
      return { jobId: null, error: error?.message || 'Failed to create job' };
    }
    
    const jobRecord = job as unknown as { id: string };
    console.log(`[JobManager] Job created in ${tableName}:`, jobRecord.id);
    return { jobId: jobRecord.id };
  } catch (error) {
    console.error('[JobManager] createJob exception:', error);
    return {
      jobId: null,
      error: error instanceof Error ? error.message : 'Failed to create job',
    };
  }
}

/**
 * Start job processing via edge function with retry logic
 */
export async function startJob(
  toolType: ToolType,
  jobId: string,
  payload: Record<string, any>
): Promise<JobResult> {
  const edgeFunction = EDGE_FUNCTION_MAP[toolType];
  const tableName = TABLE_MAP[toolType];

  
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 5000, 10000];
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[JobManager] Starting job ${jobId} via ${edgeFunction} (attempt ${attempt + 1})`);
      
      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { jobId, ...payload },
      });
      
      if (error) {
        const errorMessage = error.message || 'Error desconocido';
        const isTransient =
          errorMessage.includes('Failed to send a request') ||
          errorMessage.includes('non-2xx') ||
          errorMessage.includes('502') ||
          errorMessage.includes('504') ||
          errorMessage.includes('network') ||
          errorMessage.includes('fetch');
        
        if (isTransient && attempt < MAX_RETRIES) {
          console.warn(`[JobManager] Transient error attempt ${attempt + 1}, retrying in ${RETRY_DELAYS[attempt]}ms`);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        
        const displayError = isTransient
          ? 'Error de comunicación con el servidor. Intenta nuevamente.'
          : errorMessage;
        
        await markJobFailed(tableName, jobId, displayError);
        return { success: false, error: displayError };
      }
      
      if (data.code === 'INSUFFICIENT_CREDITS') {
        return { success: false, code: 'INSUFFICIENT_CREDITS', error: 'Créditos insuficientes' };
      }
      
      if (data.code === 'RATE_LIMIT_EXCEEDED') {
        return { success: false, code: 'RATE_LIMIT_EXCEEDED', error: 'Demasiadas solicitudes. Espera 1 minuto.' };
      }
      
      if (data.code === 'IMAGE_TRANSFER_ERROR') {
        const detail = data.error || 'Error al enviar imágenes';
        await markJobFailed(tableName, jobId, detail);
        return { success: false, code: 'IMAGE_TRANSFER_ERROR', error: detail };
      }
      
      if (data.error && !data.success && !data.queued) {
        await markJobFailed(tableName, jobId, data.error);
        return { success: false, error: data.error };
      }
      
      return {
        success: data.success ?? false,
        jobId,
        queued: data.queued ?? false,
        position: data.position ?? 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (attempt < MAX_RETRIES) {
        console.warn(`[JobManager] Exception attempt ${attempt + 1}, retrying: ${errorMessage}`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      
      console.error('[JobManager] startJob failed after all retries:', error);
      await markJobFailed(tableName, jobId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }
  
  return { success: false, error: 'Error inesperado después de reintentos' };
}

/**
 * Mark job as failed via QueueManager /finish for guaranteed refund
 */
async function markJobFailed(tableName: string, jobId: string, errorMessage: string): Promise<void> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          table: tableName,
          jobId,
          status: 'failed',
          errorMessage,
        }),
      }
    );
    
    if (!response.ok) {
      console.error('[JobManager] markJobFailed via QueueManager failed:', response.status);
      await supabase
        .from(tableName as any)
        .update({
          status: 'failed' as const,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  } catch (error) {
    console.error('[JobManager] markJobFailed exception:', error);
    try {
      await supabase
        .from(tableName as any)
        .update({
          status: 'failed' as const,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (fallbackError) {
      console.error('[JobManager] Fallback update also failed:', fallbackError);
    }
  }
}

/**
 * Subscribe to job updates via Realtime
 */
export function subscribeToJob(
  toolType: ToolType,
  jobId: string,
  onUpdate: (update: JobUpdate) => void,
  onStatusChange?: (status: JobStatus) => void
): () => void {
  const tableName = TABLE_MAP[toolType];
  
  console.log(`[JobManager] Subscribing to ${tableName} job ${jobId}`);
  
  const channel = supabase
    .channel(`job-${toolType}-${jobId}`)

    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: tableName,
        filter: `id=eq.${jobId}`,
      },
      (payload) => {
        const data = payload.new as any;
        const status = data.status as JobStatus;
        
        if (onStatusChange) onStatusChange(status);
        
        onUpdate({
          status,
          outputUrl: data.output_url,
          thumbnailUrl: data.thumbnail_url,
          errorMessage: data.error_message,
          position: data.position,
          currentStep: data.current_step,
        });
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadToStorage(
  file: File | Blob,
  folder: string,
  userId: string,
  bucketName: string = 'artes-cloudinary',
  fileName?: string
): Promise<{ url: string | null; error?: string }> {
  try {
    const timestamp = Date.now();
    const extension = file instanceof File
      ? (file.name.split('.').pop() || 'webp')
      : 'webp';
    const finalName = fileName || `${timestamp}.${extension}`;
    const filePath = `${folder}/${userId}/${finalName}`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType: file.type || 'image/webp',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('[JobManager] Upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }
    
    const { data: urlData } = supabase.storage
      .from(bucketName)


      .getPublicUrl(filePath);
    
    return { url: urlData.publicUrl };
  } catch (error) {
    console.error('[JobManager] Upload exception:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Query job status directly from database (polling fallback)
 */
export async function queryJobStatus(
  toolType: ToolType,
  jobId: string
): Promise<JobUpdate | null> {
  const tableName = TABLE_MAP[toolType];

  
  try {
    const { data, error } = await supabase
      .from(tableName as any)
      .select('status, output_url, thumbnail_url, error_message, position, current_step')
      .eq('id', jobId)
      .maybeSingle();
    
    if (error || !data) return null;
    
    const record = data as any;
    return {
      status: record.status,
      outputUrl: record.output_url,
      thumbnailUrl: record.thumbnail_url,
      errorMessage: record.error_message,
      position: record.position,
      currentStep: record.current_step,
    };
  } catch (error) {
    console.error('[JobManager] queryJobStatus exception:', error);
    return null;
  }
}

/**
 * Check user credit balance
 */
export async function checkCredits(userId: string): Promise<{ balance: number; sufficient: boolean }> {
  try {
    const { data, error } = await supabase.rpc('get_upscaler_credits', {
      _user_id: userId,
    });
    
    if (error) {
      console.error('[JobManager] checkCredits error:', error);
      return { balance: 0, sufficient: false };
    }
    
    return { balance: data ?? 0, sufficient: true };
  } catch (error) {
    console.error('[JobManager] checkCredits exception:', error);
    return { balance: 0, sufficient: false };
  }
}
