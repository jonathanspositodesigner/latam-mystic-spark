import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface JobRecoveryResult {
  inputUrl: string | null;
  outputUrl: string | null;
  jobId: string;
  status: string;
  personImageUrl?: string | null;
  referenceImageUrl?: string | null;
  clothingImageUrl?: string | null;
}

type SupportedToolTable = 'upscaler_jobs' | 'pose_changer_jobs' | 'veste_ai_jobs' | 'video_upscaler_jobs' | 'arcano_cloner_jobs' | 'flyer_maker_jobs' | 'bg_remover_jobs' | 'image_generator_jobs';

const TABLE_SELECT_MAP: Record<SupportedToolTable, string> = {
  upscaler_jobs: 'id, status, input_url, output_url, user_id',
  pose_changer_jobs: 'id, status, person_image_url, reference_image_url, output_url, user_id',
  veste_ai_jobs: 'id, status, person_image_url, clothing_image_url, output_url, user_id',
  video_upscaler_jobs: 'id, status, input_url, output_url, user_id',
  arcano_cloner_jobs: 'id, status, user_image_url, reference_image_url, output_url, user_id',
  flyer_maker_jobs: 'id, status, reference_image_url, output_url, user_id',
  bg_remover_jobs: 'id, status, input_url, output_url, user_id',
  image_generator_jobs: 'id, status, output_url, user_id',
};

interface UseNotificationTokenRecoveryProps {
  userId: string | null | undefined;
  toolTable: SupportedToolTable;
  onRecovery: (result: JobRecoveryResult) => void;
}

export function useNotificationTokenRecovery({
  userId,
  toolTable,
  onRecovery,
}: UseNotificationTokenRecoveryProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  const notificationToken = searchParams.get('nt');

  const clearToken = useCallback(() => {
    if (notificationToken) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('nt');
      setSearchParams(newParams, { replace: true });
    }
  }, [notificationToken, searchParams, setSearchParams]);

  useEffect(() => {
    if (recoveryAttempted || !notificationToken) return;
    if (userId === undefined) return;
    
    const recoverFromToken = async () => {
      setIsRecovering(true);
      setRecoveryAttempted(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('verify-notification-token', {
          body: { token: notificationToken, userId: userId || null }
        });

        if (error || !data?.valid) {
          clearToken();
          return;
        }

        const { table, jobId } = data;
        
        if (table !== toolTable) {
          clearToken();
          return;
        }

        const selectColumns = TABLE_SELECT_MAP[toolTable];
        const { data: jobRaw } = await supabase
          .from(toolTable as any)
          .select(selectColumns)
          .eq('id', jobId)
          .maybeSingle();
        const job = jobRaw as any;

        if (!job) {
          clearToken();
          return;
        }

        if (userId && job.user_id !== userId) {
          clearToken();
          return;
        }

        onRecovery({
          inputUrl: job.input_url || null,
          outputUrl: job.output_url || null,
          jobId: job.id,
          status: job.status,
          personImageUrl: job.person_image_url || null,
          referenceImageUrl: job.reference_image_url || null,
          clothingImageUrl: job.clothing_image_url || null,
        });

        clearToken();
        
      } catch (err) {
        console.error('[TokenRecovery] Error:', err);
        clearToken();
      } finally {
        setIsRecovering(false);
      }
    };

    recoverFromToken();
  }, [notificationToken, userId, toolTable, onRecovery, recoveryAttempted, clearToken]);

  return {
    isRecovering,
    hasToken: !!notificationToken,
  };
}
