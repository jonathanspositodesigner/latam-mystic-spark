import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';
import { markJobAsFailedInDb } from '@/utils/markJobAsFailedInDb';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Download, Loader2, ZoomIn, ZoomOut, ImageIcon, XCircle, AlertTriangle, Coins, RefreshCw, Plus, Trash2, Upload, Wand2, ArrowLeft, Construction, Play, Film, Lock, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSeedanceTotalCost, modeToGenType } from '@/config/seedance-pricing';
import flyerTypeEvento from '@/assets/flyer-type-evento.webp';
import flyerTypeAgenda from '@/assets/flyer-type-agenda.webp';
import flyerTypeContrate from '@/assets/flyer-type-contrate.webp';
import flyerTypeOutro from '@/assets/flyer-type-outro.jpg';
import flyerPreview from '@/assets/flyer-preview.webp';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useSmartBackNavigation } from '@/hooks/useSmartBackNavigation';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useCredits } from '@/contexts/CreditsContext';
import { useQueueSessionCleanup } from '@/hooks/useQueueSessionCleanup';
import { useProcessingButton } from '@/hooks/useProcessingButton';
import { useAIJobContext } from '@/contexts/AIJobContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import ReferenceImageCard from '@/components/arcano-cloner/ReferenceImageCard';
import FlyerLibraryModal from '@/components/flyer-maker/FlyerLibraryModal';
import CreativitySlider from '@/components/arcano-cloner/CreativitySlider';
import NoCreditsModal from '@/components/upscaler/NoCreditsModal';
import ActiveJobBlockModal from '@/components/ai-tools/ActiveJobBlockModal';
import FlyerMakerTutorialModal from '@/components/flyer-maker/FlyerMakerTutorialModal';

import { optimizeForAI } from '@/hooks/useImageOptimizer';
import { isAcceptedImage, ensureBrowserCompatibleImage, IMAGE_ACCEPT } from '@/lib/heicConverter';
import { cancelJob as centralCancelJob, checkActiveJob, createJob as centralCreateJob, startJob as centralStartJob } from '@/ai/JobManager';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { ResilientImage } from '@/components/upscaler/ResilientImage';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
// TODO: useNotificationTokenRecovery no existe en LATAM — recuperación por notification token deshabilitada.
import { useJobPendingWatchdog } from '@/hooks/useJobPendingWatchdog';
import { getAIErrorMessage } from '@/utils/errorMessages';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import RefinePanel from '@/components/arcano-cloner/RefinePanel';
import RefinementTimeline, { type RefinementVersion } from '@/components/arcano-cloner/RefinementTimeline';
import { useCollaboratorAttribution } from '@/hooks/useCollaboratorAttribution';


type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'waiting' | 'completed' | 'error';

const queueMessages = [
  { emoji: '🎨', text: 'Creando tu flyer personalizado...' },
  { emoji: '✨', text: 'Aplicando estilos y efectos...' },
  { emoji: '🚀', text: '¡Casi listo, sigue esperando!' },
  { emoji: '🌟', text: 'Finalizando los detalles...' },
];


const FlyerMakerTool: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack } = useSmartBackNavigation({ fallback: '/ferramentas-ia-aplicativo' });
  const { user } = usePremiumStatus();
  const { balance: credits, isLoading: creditsLoading, refetch: refetchCredits, checkBalance } = useCredits();
  const { getCreditCost } = useAIToolSettings();
  const creditCost = getCreditCost('Flyer Maker', 100);

  // Flyer Maker test credits
  const [testCredits, setTestCredits] = useState(0);

  const fetchTestCredits = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;
    try {
      const { data, error } = await supabase.rpc('get_flyer_test_credits', { _user_id: user.id });
      if (!error && typeof data === 'number') {
        setTestCredits(data);
        return data;
      }
    } catch {}
    return 0;
  }, [user?.id]);

  useEffect(() => { fetchTestCredits(); }, [fetchTestCredits]);

  // LATAM: useAIJobContext no expone playNotificationSound — usamos un no-op.
  const { registerJob, updateJobStatus, clearJob: clearGlobalJob } = useAIJobContext();
  const playNotificationSound = useCallback(() => { /* no-op en LATAM */ }, []);

  // Collaborator attribution (vitalícia/mensal por usuário×prompt — lógica compartilhada)
  const { referencePromptId, clear: clearAttribution } = useCollaboratorAttribution();

  // Inputs
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [artistPhotos, setArtistPhotos] = useState<{ url: string, file: File }[]>([]);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Text inputs
  const [dateTimeLocation, setDateTimeLocation] = useState('');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [artistNames, setArtistNames] = useState('');
  const [footerPromo, setFooterPromo] = useState('');

  // Settings
  const [imageSize, setImageSize] = useState<'3:4' | '9:16'>('3:4');
  const [creativity, setCreativity] = useState(0);

  // === Agenda-specific states ===
  const [agendaArtistPhoto, setAgendaArtistPhoto] = useState<string | null>(null);
  const [agendaArtistFile, setAgendaArtistFile] = useState<File | null>(null);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaArtistName, setAgendaArtistName] = useState('');
  const [agendaFooter, setAgendaFooter] = useState('');
  const [agendaCreativity, setAgendaCreativity] = useState(0);
  const [agendaImageSize, setAgendaImageSize] = useState<'3:4' | '9:16'>('9:16');
  const [agendaDates, setAgendaDates] = useState<Array<{ dia: string; local: string; cidade: string }>>([
    { dia: '', local: '', cidade: '' }
  ]);

  // === Contrate-specific states ===
  const [contrateArtistPhoto, setContrateArtistPhoto] = useState<string | null>(null);
  const [contrateArtistFile, setContrateArtistFile] = useState<File | null>(null);
  const [contrateTitle, setContrateTitle] = useState('CONTRÁTAME');
  const [contrateArtistName, setContrateArtistName] = useState('');
  const [contrateContact, setContrateContact] = useState('');
  const [contrateFooter, setContrateFooter] = useState('');
  const [contrateCreativity, setContrateCreativity] = useState(4);
  const [contrateImageSize, setContrateImageSize] = useState<'3:4' | '9:16'>('9:16');

  // === Outro-specific states ===
  const [outroPessoaSwitch, setOutroPessoaSwitch] = useState(false);
  const [outroPessoaPhoto, setOutroPessoaPhoto] = useState<string | null>(null);
  const [outroPessoaFile, setOutroPessoaFile] = useState<File | null>(null);
  const [outroLogoImage, setOutroLogoImage] = useState<string | null>(null);
  const [outroLogoFile, setOutroLogoFile] = useState<File | null>(null);
  const [outroHeadline, setOutroHeadline] = useState('');
  const [outroSubHeadline, setOutroSubHeadline] = useState('');
  const [outroCallToAction, setOutroCallToAction] = useState('');
  const [outroRodape, setOutroRodape] = useState('');
  const [outroImageSize, setOutroImageSize] = useState<'3:4' | '9:16' | '16:9'>('9:16');
  const [outroCreativity, setOutroCreativity] = useState(2);

  // Outputs (Persistência com localStorage para sobreviver a fechamento de aba/app)
  const [outputImage, setOutputImage] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('flyer_output_image') : null);
  useEffect(() => {
    if (outputImage) localStorage.setItem('flyer_output_image', outputImage);
    else localStorage.removeItem('flyer_output_image');
  }, [outputImage]);

  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);

  // UI states (Persistência com localStorage)
  const [flyerType, setFlyerType] = useState<'evento' | 'agenda' | 'contrate' | 'outro' | null>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_type') as any : null));
  useEffect(() => {
    if (flyerType) localStorage.setItem('flyer_type', flyerType);
    else localStorage.removeItem('flyer_type');
  }, [flyerType]);

  type FlyerScreen = 'choose' | 'static-type' | 'static-controls' | 'motion' | 'motion-result';
  const [flyerScreen, setFlyerScreen] = useState<FlyerScreen>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_screen') as FlyerScreen : null) || 'choose');

  // Motion screen states
  const [motionEngine, setMotionEngine] = useState<'standard' | 'pro'>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_motion_engine') as 'standard' | 'pro' : null) || 'pro');
  const [motionResolution, setMotionResolution] = useState<'480p' | '720p'>('480p');
  const [motionAudioFile, setMotionAudioFile] = useState<File | null>(null);
  const [motionAudioPreview, setMotionAudioPreview] = useState<string | null>(null);
  const [motionAspectRatio, setMotionAspectRatio] = useState<'3:4' | '9:16'>('9:16');
  const [showMediaTrimModal, setShowMediaTrimModal] = useState(false);
  const [mediaToTrim, setMediaToTrim] = useState<File | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [motionSourceImage, setMotionSourceImage] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('flyer_motion_source_image') : null);
  useEffect(() => {
    if (motionSourceImage && !motionSourceImage.startsWith('blob:')) {
      localStorage.setItem('flyer_motion_source_image', motionSourceImage);
    } else if (!motionSourceImage) {
      localStorage.removeItem('flyer_motion_source_image');
    }
  }, [motionSourceImage]);

  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('flyer_motion_video_url') : null);
  const [motionJobId, setMotionJobId] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('flyer_motion_job_id') : null);
  const [motionJobToolType, setMotionJobToolType] = useState<'flyer_maker' | 'flyer_motion' | null>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_motion_job_tool_type') as 'flyer_maker' | 'flyer_motion' | null : null));
  const [motionStatus, setMotionStatus] = useState<ProcessingStatus>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_motion_status') as ProcessingStatus : null) || 'idle');
  const motionPrice480 = getSeedanceTotalCost('standard', '480p', motionAudioFile ? 'r2v' : 'i2v', 10, 'flyer_motion');
  const motionPrice720 = getSeedanceTotalCost('standard', '720p', motionAudioFile ? 'r2v' : 'i2v', 10, 'flyer_motion');
  const motionPriceStandard = 700;
  const motionCurrentPrice = motionEngine === 'standard' ? motionPriceStandard : (motionResolution === '480p' ? motionPrice480 : motionPrice720);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_status') as ProcessingStatus : null) || 'idle');
  const [progress, setProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [jobId, setJobId] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('flyer_job_id') : null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueMessageIndex, setQueueMessageIndex] = useState(0);
  const [debugErrorMessage, setDebugErrorMessage] = useState<string | null>(null);

  const sessionIdRef = useRef<string>('');
  const motionPollTimer = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (motionPollTimer.current) {
        clearInterval(motionPollTimer.current);
        motionPollTimer.current = null;
      }
    };
  }, []);

  // Sincronizar estados con localStorage para resiliencia máxima
  useEffect(() => {
    if (motionVideoUrl) localStorage.setItem('flyer_motion_video_url', motionVideoUrl);
    else localStorage.removeItem('flyer_motion_video_url');
  }, [motionVideoUrl]);

  useEffect(() => {
    if (motionJobId) localStorage.setItem('flyer_motion_job_id', motionJobId);
    else localStorage.removeItem('flyer_motion_job_id');
  }, [motionJobId]);

  useEffect(() => {
    if (motionJobToolType) localStorage.setItem('flyer_motion_job_tool_type', motionJobToolType);
    else localStorage.removeItem('flyer_motion_job_tool_type');
  }, [motionJobToolType]);

  useEffect(() => {
    localStorage.setItem('flyer_motion_status', motionStatus);
  }, [motionStatus]);

  useEffect(() => {
    localStorage.setItem('flyer_motion_engine', motionEngine);
  }, [motionEngine]);

  useEffect(() => {
    localStorage.setItem('flyer_screen', flyerScreen);
  }, [flyerScreen]);

  useEffect(() => {
    if (jobId) localStorage.setItem('flyer_job_id', jobId);
    else localStorage.removeItem('flyer_job_id');
  }, [jobId]);

  useEffect(() => {
    localStorage.setItem('flyer_status', status);
  }, [status]);

  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();
  const { isDownloading, progress: downloadProgress, download, cancel: cancelDownload } = useResilientDownload();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // Reconcile
  const [isReconciling, setIsReconciling] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [showReconcileButton, setShowReconcileButton] = useState(false);

  // Modals
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [noCreditsReason, setNoCreditsReason] = useState<'not_logged' | 'insufficient'>('insufficient');
  const [showActiveJobModal, setShowActiveJobModal] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string>('');
  const [activeJobId, setActiveJobId] = useState<string | undefined>();
  const [activeStatus, setActiveStatus] = useState<string | undefined>();
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem("flyer-maker-tutorial-seen");
  });


  // Refine
  const [refineMode, setRefineMode] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refineReferenceFile, setRefineReferenceFile] = useState<File | null>(null);
  const [refineReferencePreview, setRefineReferencePreview] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<RefinementVersion[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [refineJobId, setRefineJobId] = useState<string | null>(null);

  // Refs for refine callback (avoid stale closures)
  const outputImageRef = useRef<string | null>(null);
  const refinementHistoryRef = useRef<RefinementVersion[]>([]);
  outputImageRef.current = outputImage;
  refinementHistoryRef.current = refinementHistory;

  const canProcess = referenceImage && artistPhotos.length > 0 && status === 'idle';
  const canProcessAgenda = !!(referenceImage && agendaArtistPhoto && agendaTitle.trim() && agendaArtistName.trim() && agendaDates.length > 0 && agendaDates[0].dia.trim() && agendaDates[0].local.trim()) && status === 'idle';
  const canProcessContrate = !!(referenceImage && contrateArtistPhoto && contrateTitle.trim() && contrateArtistName.trim()) && status === 'idle';
  const canProcessOutro = !!(referenceImage && outroHeadline.trim()) && status === 'idle';
  const isProcessing = status === 'uploading' || status === 'processing' || status === 'waiting';

  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  // Auto-open refine mode when coming from "Modificar" in My Creations
  useEffect(() => {
    const state = location.state as { refineImageUrl?: string } | null;
    if (state?.refineImageUrl) {
      setOutputImage(state.refineImageUrl);
      setStatus('completed');
      setRefineMode(true);
      // Clear the state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Pre-fill reference image and flyer type from navigation state (e.g. from Biblioteca de Artes)
  useEffect(() => {
    const state = location.state as { referenceImageUrl?: string; flyerType?: string } | null;
    if (state?.referenceImageUrl && !referenceImage) {
      setReferenceImage(state.referenceImageUrl);
      if (state.flyerType) {
        const validTypes = ['evento', 'agenda', 'contrate', 'outro'];
        if (validTypes.includes(state.flyerType)) {
          setFlyerType(state.flyerType as 'evento' | 'agenda' | 'contrate' | 'outro');
          setFlyerScreen('static-controls');
        }
      }
      // Clear the state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useQueueSessionCleanup(sessionIdRef.current, status);

  useJobStatusSync({
    jobId,
    toolId: 'flyer_maker',
    enabled: isProcessing,
    onStatusChange: useCallback((update) => {
      if (update.status === 'completed' && update.outputUrl) {
        setOutputImage(update.outputUrl);
        if (update.thumbnailUrl) setThumbnailImage(update.thumbnailUrl);
        setStatus('completed');
        setProgress(100);
        endSubmit();
        playNotificationSound();
        refetchCredits(); fetchTestCredits();
        toast.success('¡Flyer generado con éxito!');
      } else if (update.status === 'failed' || update.status === 'cancelled') {
        setStatus('error');
        const friendlyError = getAIErrorMessage(update.errorMessage);
        setDebugErrorMessage(update.errorMessage);
        endSubmit();
        refetchCredits(); fetchTestCredits();
        toast.error(friendlyError.message);
      } else if (update.status === 'queued') {
        setStatus('waiting');
        setQueuePosition(update.position || 0);
      } else if (update.status === 'running' || update.status === 'starting') {
        setStatus('processing');
        setQueuePosition(0);
      }
    }, [endSubmit, playNotificationSound, refetchCredits, fetchTestCredits]),
   onGlobalStatusChange: (status) => updateJobStatus(status),
  });

  // TODO: 'image_generator' no es un ToolId registrado en LATAM. El refine usa actualmente
  // la misma tabla de flyer_maker_jobs como fallback. Si necesita refine real con image_generator,
  // hay que registrar ese tool en src/ai/toolRegistry.ts.
  useJobStatusSync({
    jobId: refineJobId,
    toolId: 'flyer_maker',
    enabled: isRefining && !!refineJobId,
    onStatusChange: useCallback((update) => {
      if (update.status === 'completed' && update.outputUrl) {
        const newUrl = update.thumbnailUrl || update.outputUrl;
        const history = refinementHistoryRef.current;
        const newIndex = history.length === 0 ? 1 : history.length;
        const newVersion: RefinementVersion = { url: newUrl, label: `Modificación ${newIndex}` };

        setRefinementHistory(prev => {
          const updated = prev.length === 0
            ? [{ url: outputImageRef.current!, label: 'Original' }, newVersion]
            : [...prev, newVersion];
          setSelectedHistoryIndex(updated.length - 1);
          return updated;
        });

        setOutputImage(newUrl);
        setRefineMode(false);
        setRefinePrompt('');
        setRefineReferenceFile(null);
        setRefineReferencePreview(null);
        setIsRefining(false);
        setRefineJobId(null);
        endSubmit();
        playNotificationSound();
        refetchCredits();
        toast.success('¡Modificación realizada con éxito!');
      } else if (update.status === 'failed' || update.status === 'cancelled') {
        setIsRefining(false);
        setRefineJobId(null);
        endSubmit();
        refetchCredits();
        const friendlyError = getAIErrorMessage(update.errorMessage);
        toast.error(friendlyError.message);
      }
    }, [endSubmit, playNotificationSound, refetchCredits]),
   onGlobalStatusChange: (status) => updateJobStatus(status),
  });

  // Sincronización resiliente para Flyer Animado (Motion)
  const isMotionProcessing = motionStatus === "uploading" || motionStatus === "processing" || motionStatus === "waiting";
  const activeMotionToolType = motionJobToolType || (motionEngine === "standard" ? "flyer_maker" : "flyer_motion");
  useJobStatusSync({
    jobId: motionJobId,
    toolId: activeMotionToolType,
    enabled: isMotionProcessing && !!motionJobId,
    onStatusChange: useCallback((update) => {
      if (update.status === "completed" && update.outputUrl) {
        setMotionVideoUrl(update.outputUrl);
        setMotionStatus("completed");
        setFlyerScreen("motion-result");
        setProgress(100);
        endSubmit();
        playNotificationSound();
        refetchCredits();
        toast.success("¡Animación completada con éxito!");
      } else if (update.status === "failed" || update.status === "cancelled") {
        setMotionStatus("error");
        const friendlyError = getAIErrorMessage(update.errorMessage);
        setDebugErrorMessage(update.errorMessage);
        endSubmit();
        refetchCredits();
        toast.error(friendlyError.message);
      } else if (update.status === "running" || update.status === "starting") {
        setMotionStatus("processing");
      } else if (update.status === "queued") {
        setMotionStatus("waiting");
      }
    }, [endSubmit, playNotificationSound, refetchCredits]),
    onGlobalStatusChange: (status) => updateJobStatus(status),
  });

  // TODO: useNotificationTokenRecovery no existe en LATAM — recuperación deshabilitada.

  useJobPendingWatchdog({
    jobId,
    toolType: 'flyer_maker',
    enabled: isProcessing,
    onJobFailed: useCallback((errorMessage) => {
      setStatus('error');
      setDebugErrorMessage(errorMessage);
      endSubmit();
      toast.error(errorMessage);
    }, [endSubmit]),
  });

  useEffect(() => {
    // Solo registra en el contexto global si el job ID existe Y el status local indica que está en procesamiento
    if (jobId && (status === 'uploading' || status === 'processing' || status === 'waiting')) {
      registerJob(jobId, 'Flyer Maker', 'pending');
    }
  }, [jobId, status, registerJob]);

  useEffect(() => {
    if (isProcessing && !processingStartTime) {
      setProcessingStartTime(Date.now());
      setShowReconcileButton(false);
    } else if (!isProcessing) {
      setProcessingStartTime(null);
      setShowReconcileButton(false);
    }
  }, [isProcessing, processingStartTime]);

  useEffect(() => {
    if (!isProcessing || !processingStartTime) return;
    const timer = setTimeout(() => setShowReconcileButton(true), 60000);
    return () => clearTimeout(timer);
  }, [isProcessing, processingStartTime]);

  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setQueueMessageIndex(prev => (prev + 1) % queueMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (status !== 'processing') return;
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 95 ? prev : prev + Math.random() * 5));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const startMotionPolling = useCallback((newJobId: string, initialToken: string) => {
    if (motionPollTimer.current) clearInterval(motionPollTimer.current);

    let resolvedTaskId: string | null = null;
    let currentToken = initialToken;

    const timer = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(timer);
        return;
      }

      try {
        if (!resolvedTaskId) {
          const { data: jobRow } = await supabase
            .from('seedance_jobs' as any)
            .select('status, task_id, output_url, error_message')
            .eq('id', newJobId)
            .maybeSingle();

          if (!isMountedRef.current) return;

          if ((jobRow as any)?.task_id) {
            resolvedTaskId = (jobRow as any).task_id;
          } else if ((jobRow as any)?.status === 'completed' && (jobRow as any)?.output_url) {
            clearInterval(timer);
            motionPollTimer.current = null;
            const outputUrl = (jobRow as any).output_url;
            setMotionVideoUrl(outputUrl);
            setMotionStatus('completed');
            if (isMountedRef.current) setFlyerScreen('motion-result');
            updateJobStatus('completed');
            playNotificationSound();
            fetchTestCredits();
            refetchCredits();
          } else if ((jobRow as any)?.status === 'failed') {
            clearInterval(timer);
            motionPollTimer.current = null;
            setMotionStatus('error');
            toast.error((jobRow as any)?.error_message || 'Error al generar el video animado');
          }
          return;
        }

        const { data: pollData } = await supabase.functions.invoke('seedance-poll', {
          body: { taskId: resolvedTaskId, jobId: newJobId },
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        if (!isMountedRef.current) return;

         if (pollData?.status === 'completed' && pollData?.outputUrl) {
           clearInterval(timer);
           motionPollTimer.current = null;
           const finalUrl = pollData.outputUrl;
           setMotionVideoUrl(finalUrl);
           setMotionStatus('completed');
           updateJobStatus('completed');

            if (isMountedRef.current) setFlyerScreen('motion-result');
          playNotificationSound();
          fetchTestCredits();
          refetchCredits();
        } else if (pollData?.status === 'failed') {
          clearInterval(timer);
          motionPollTimer.current = null;
          setMotionStatus('error');
          toast.error('Error al generar el video animado');
        }
      } catch (err) {
        console.error('[MotionPoll] Error:', err);
      }
    }, 5000);

    motionPollTimer.current = timer as any;
  }, [updateJobStatus, playNotificationSound, fetchTestCredits, refetchCredits]);

  // Efecto de Recuperación de Jobs (Resiliencia Máxima)
  // Verifica si hay jobs en curso en la base para restaurar el estado de la UI si el usuario salió y volvió.
  useEffect(() => {
    const recoverJobs = async () => {
      if (!user?.id) return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return;

        // 1. Recuperar Motion Flyer manteniendo la tabla correcta por motor.
        // Standard corre en flyer_maker_jobs/RunningHub Kling; Pro corre en seedance_jobs.
        if (motionJobId && (motionStatus === 'processing' || motionStatus === 'waiting')) {
          if ((motionJobToolType || activeMotionToolType) === 'flyer_motion') {
            console.log('[FlyerMaker] Resuming Pro motion polling for job:', motionJobId);
            startMotionPolling(motionJobId, accessToken);
          } else {
            console.log('[FlyerMaker] Resuming Standard motion via flyer_maker_jobs sync:', motionJobId);
            setMotionJobToolType('flyer_maker');
          }
         } else if (!motionJobId || motionStatus === 'idle') {
            const { data: activeStandardMotion } = await (supabase
              .from('flyer_maker_jobs' as any)
              .select('id, status, output_url')
              .eq('user_id', user.id)
              .eq('tool_type', 'flyer-motion-standard')
              .in('status', ['pending', 'starting', 'running', 'queued'])
              .order('created_at', { ascending: false })
              .limit(1) as any);

            if (activeStandardMotion && activeStandardMotion.length > 0) {
              const recovered = activeStandardMotion[0];
              console.log('[FlyerMaker] Recovered active Standard motion job from DB:', recovered.id);
              setMotionEngine('standard');
              setMotionJobToolType('flyer_maker');
              setMotionJobId(recovered.id);
              setMotionStatus(recovered.status === 'queued' ? 'waiting' : 'processing');
              setFlyerScreen('motion');
              return;
            }

            if (!motionVideoUrl) {
              const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
              const { data: recentStandardMotion } = await (supabase
                .from('flyer_maker_jobs' as any)
                .select('id, output_url')
                .eq('user_id', user.id)
                .eq('tool_type', 'flyer-motion-standard')
                .eq('status', 'completed')
                .gt('created_at', oneHourAgo)
                .order('created_at', { ascending: false })
                .limit(1) as any);

              if (recentStandardMotion && recentStandardMotion.length > 0) {
                const recovered = recentStandardMotion[0];
                console.log('[FlyerMaker] Recovered recent completed Standard motion job:', recovered.id);
                setMotionEngine('standard');
                setMotionJobToolType('flyer_maker');
                setMotionJobId(recovered.id);
                setMotionVideoUrl(recovered.output_url);
                setMotionStatus('completed');
                setFlyerScreen('motion-result');
                return;
              }
            }

            const { data: activeMotion } = await (supabase
             .from('seedance_jobs' as any)
             .select('id, status')
             .eq('user_id', user.id)
             .eq('source_tool', 'flyer_motion')
             .in('status', ['pending', 'starting', 'running', 'queued'])
             .order('created_at', { ascending: false })
             .limit(1) as any);

            if (activeMotion && activeMotion.length > 0) {
             const recovered = activeMotion[0];
             console.log('[FlyerMaker] Recovered active motion job from DB:', recovered.id);
              setMotionEngine('pro');
              setMotionJobToolType('flyer_motion');
             setMotionJobId(recovered.id);
             setMotionStatus('processing');
             setFlyerScreen('motion');
             startMotionPolling(recovered.id, accessToken);
            } else if (!motionVideoUrl) {
              // Intentar recuperar un job completado recientemente
              const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
              const { data: recentMotion } = await (supabase
                .from('seedance_jobs' as any)
                .select('id, output_url')
                .eq('user_id', user.id)
                .eq('source_tool', 'flyer_motion')
                .eq('status', 'completed')
                .gt('created_at', oneHourAgo)
                .order('created_at', { ascending: false })
                .limit(1) as any);

              if (recentMotion && recentMotion.length > 0) {
                const recovered = recentMotion[0];
                console.log('[FlyerMaker] Recovered recent completed motion job:', recovered.id);
                setMotionVideoUrl(recovered.output_url);
                setMotionStatus('completed');
                setFlyerScreen('motion-result');
              }
           }
         }

        // 2. Recuperar Static Flyer (flyer_maker_jobs)
        // Si el status local es idle pero hay un job activo en la base, restaurar.
         if (!jobId || status === 'idle') {
           const { data: activeStatic } = await (supabase
             .from('flyer_maker_jobs' as any)
            .select('id, status, job_payload')
             .eq('user_id', user.id)
             .in('status', ['pending', 'starting', 'running', 'queued'])
             .order('created_at', { ascending: false })
             .limit(1) as any);

           if (activeStatic && activeStatic.length > 0) {
             const recovered = activeStatic[0];
             console.log('[FlyerMaker] Recovered active static job from DB:', recovered.id);
              if (recovered.job_payload?.flyerSubType === 'motion_standard') {
                setMotionEngine('standard');
                setMotionJobId(recovered.id);
                setMotionStatus('processing');
                setFlyerScreen('motion');
             } else {
                setJobId(recovered.id);
                setStatus('processing');
               setFlyerScreen('static-controls');
                if (recovered.job_payload?.flyerSubType) {
                  setFlyerType(recovered.job_payload.flyerSubType);
                } else {
                  setFlyerType('evento');
                }
            }
           } else if (!outputImage) {
             const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
             const { data: recentCompleted } = await (supabase
               .from('flyer_maker_jobs' as any)
              .select('id, output_url, thumbnail_url, job_payload')
               .eq('user_id', user.id)
               .eq('status', 'completed')
               .gt('created_at', oneHourAgo)
               .order('created_at', { ascending: false })
               .limit(1) as any);

             if (recentCompleted && recentCompleted.length > 0) {
               const recovered = recentCompleted[0];
               console.log('[FlyerMaker] Recovered recent completed job:', recovered.id);
               setOutputImage(recovered.output_url);
               if (recovered.thumbnail_url) setThumbnailImage(recovered.thumbnail_url);
               setStatus('completed');
               setFlyerScreen('static-controls');
              if (recovered.job_payload?.flyerSubType) {
                setFlyerType(recovered.job_payload.flyerSubType);
              } else {
                setFlyerType('evento');
              }
             }
           }
         }
      } catch (err) {
        console.error('[FlyerMaker] Recovery error:', err);
      }
    };

    recoverJobs();
  }, [user?.id, startMotionPolling]); // Ejecuta en mount o cuando el user cambia

   const resetMotion = useCallback(() => {
     if (motionPollTimer.current) { clearInterval(motionPollTimer.current); motionPollTimer.current = null; }
     setMotionSourceImage(null);
    setMotionJobId(null);
     setMotionJobToolType(null);
    setMotionStatus('idle');
     setMotionVideoUrl(null);
     localStorage.removeItem('flyer_motion_video_url');
     localStorage.removeItem('flyer_motion_job_id');
      localStorage.removeItem('flyer_motion_job_tool_type');
     localStorage.removeItem('flyer_motion_status');
     localStorage.setItem('flyer_screen', 'choose');
    }, []);

    const handleGenerateMotion = async () => {
      if (!motionSourceImage || (motionStatus !== 'idle' && motionStatus !== 'completed') || !user?.id) return;

    // Guard sincrónico contra clic doble
    if (!startSubmit()) return;

    // Chequeo de saldo ANTES de cualquier débito.
    // Compara saldo fresco con el costo exacto. Si falta, muestra modal de créditos.
    let createdMotionJobId: string | null = null;
    let createdMotionJobToolType: 'flyer_maker' | 'flyer_motion' | null = null;

    try {
      const freshBalance = await checkBalance();
      if (freshBalance < motionCurrentPrice) {
        endSubmit();
        setNoCreditsReason('insufficient');
        setShowNoCreditsModal(true);
        return;
      }
    } catch {
      // si falla chequear el saldo, continúa al backend que hace la verificación final
    }

    setMotionStatus('uploading');

      try {
        // 1. Upload de la imagen si es blob local
        let finalImageUrl = motionSourceImage;
        if (motionSourceImage.startsWith('blob:')) {
          const response = await fetch(motionSourceImage);
          const blob = await response.blob();
          const compressed = await compressImage(new File([blob], 'motion-source.jpg', { type: 'image/jpeg' }));
          finalImageUrl = await uploadToStorage(compressed, 'flyer-motion-source');
        }

        // 1.1 Upload del audio si existe
        let finalAudioUrl: string | null = null;
        if (motionAudioFile) {
          finalAudioUrl = await uploadToStorage(motionAudioFile, 'flyer-motion-audio');
        }

      setMotionStatus('processing');

      // Obtener token de acceso
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        accessToken = refreshed.session?.access_token;
      }
      if (!accessToken) throw new Error('Sesión expirada. Inicia sesión nuevamente.');

      let newJobId: string;

      if (motionEngine === 'pro') {
        // 3. Crear job en Seedance vía hook/sistema central (usando modelos 2.0 que son más estables)
        // Si tiene audio, usa el modelo de referencia-to-video para multi-referencia
        const seedanceModel = motionAudioFile
          ? 'seedance-2.0-fast-reference-to-video'
          : (motionResolution === '720p' ? 'seedance-2.0-fast-image-to-video' : 'seedance-2.0-fast-image-to-video');

        const { data: jobData, error: jobError } = await supabase.from('seedance_jobs' as any).insert({
          user_id: user.id,
          model: seedanceModel,
          prompt: 'Generando animación basada en el flyer...',
          duration: 10,
          quality: motionResolution,
          aspect_ratio: motionAspectRatio,
          input_image_urls: [finalImageUrl],
          // Now we always treat the trimmed file as audio
          input_audio_urls: finalAudioUrl ? [finalAudioUrl] : [],
          input_video_urls: [],
          status: 'pending',
          generation_type: motionAudioFile ? 'r2v' : 'i2v',
          source_tool: 'flyer_motion',
        }).select('id').single();

        if (jobError || !jobData) throw new Error(jobError?.message || 'Falló la creación del registro de video');

        newJobId = (jobData as any).id;
        createdMotionJobId = newJobId;
        createdMotionJobToolType = 'flyer_motion';
        setMotionJobId(newJobId);
        setMotionJobToolType('flyer_motion');
        registerJob(newJobId, 'Flyer Animado', 'pending');

        // 4. RunningHub analiza el flyer en background y dispara Seedance
        const { data: motionData, error: motionError } = await supabase.functions.invoke('runninghub-flyer-motion', {
          body: { imageUrl: finalImageUrl, jobId: newJobId },
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (motionError || !motionData?.success) {
          console.error('Motion Error:', motionError, motionData);
          throw new Error(motionData?.error || motionError?.message || 'Error al iniciar el análisis de animación');
        }
      } else {
        // MOTOR STANDARD - KLING vía RunningHub (no usa Seedance)
        const { data: jobData, error: jobError } = await supabase.from('flyer_maker_jobs' as any).insert({
          session_id: sessionIdRef.current,
          user_id: user.id,
          status: 'pending',
          reference_image_url: finalImageUrl,
          image_size: '9:16',
          tool_type: 'flyer-motion-standard',
          job_payload: { flyerSubType: 'motion_standard', engine: 'kling2.5', duration: 10, resolution: '720p' },
        }).select('id').single();

        if (jobError || !jobData) throw new Error(jobError?.message || 'Falló la creación del registro de video');

        newJobId = (jobData as any).id;
        createdMotionJobId = newJobId;
        createdMotionJobToolType = 'flyer_maker';
        setMotionJobId(newJobId);
        setMotionJobToolType('flyer_maker');
        registerJob(newJobId, 'Flyer Animado Standard', 'pending');

        // Llama a la función centralizada del Flyer Maker con el motor Standard
        const { data: motionData, error: motionError } = await supabase.functions.invoke('runninghub-flyer-maker/run', {
          body: {
            jobId: newJobId,
            userId: user.id,
            referenceImageUrl: finalImageUrl,
            flyerSubType: 'motion_standard',
            creditCost: motionPriceStandard,
            imageSize: 'auto',
            creativity: 0
          },
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (motionError || (motionData?.error && !motionData?.success && !motionData?.queued)) {
          throw new Error(motionData?.error || motionError?.message || 'Error al iniciar la animación standard');
        }
      }

        // 5. Polling manual sólo es necesario en Pro; Standard usa Realtime/Polling de flyer_maker_jobs
        if (motionEngine === 'pro') startMotionPolling(newJobId, accessToken);

        // Libera el botón para permitir nuevas generaciones tras el inicio del proceso
        endSubmit();
    } catch (err: any) {
      if (createdMotionJobId) {
        if (createdMotionJobToolType === 'flyer_maker') {
          await markJobAsFailedInDb(createdMotionJobId, 'flyer_maker', err.message || 'Error al iniciar la animación standard');
        } else if (createdMotionJobToolType === 'flyer_motion') {
          await supabase.from('seedance_jobs' as any).update({
            status: 'failed',
            error_message: err.message || 'Error al iniciar la animación pro',
            completed_at: new Date().toISOString(),
          }).eq('id', createdMotionJobId);
        }
      }
      setMotionStatus('error');
      endSubmit();
      const errorMsg = err.message || 'Error al generar motion del flyer';
      console.error('[Motion] Generation failed:', err);
      toast.error(errorMsg);

      // Log error to a central place if needed, or at least help the user identify where it failed
      if (errorMsg.includes('storage') || errorMsg.includes('upload')) {
        toast.error('Error al subir los archivos. Verifica tu conexión.');
      }
    }
  };

  const handleReferenceImageChange = async (imageUrl: string | null, file?: File) => {
    setReferenceImage(imageUrl);
    if (imageUrl && !file) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        setReferenceFile(new File([blob], 'reference.png', { type: blob.type }));
      } catch (e) { console.error(e); }
    } else {
      setReferenceFile(file || null);
    }
  };

  const handleArtistPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = '';
    if (!rawFile) return;
    if (artistPhotos.length >= 5) {
      toast.error('Máximo de 5 fotos de artistas');
      return;
    }
    if (!isAcceptedImage(rawFile)) {
      toast.error('Selecciona una imagen válida (JPG, PNG, WEBP o HEIC).');
      return;
    }
    try {
      const file = await ensureBrowserCompatibleImage(rawFile);
      const url = URL.createObjectURL(file);
      setArtistPhotos([...artistPhotos, { url, file }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen.');
    }
  };

  const removeArtistPhoto = (index: number) => {
    const newPhotos = [...artistPhotos];
    URL.revokeObjectURL(newPhotos[index].url);
    newPhotos.splice(index, 1);
    setArtistPhotos(newPhotos);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = '';
    if (!rawFile) return;
    if (!isAcceptedImage(rawFile)) {
      toast.error('Selecciona una imagen válida (JPG, PNG, WEBP o HEIC).');
      return;
    }
    try {
      const file = await ensureBrowserCompatibleImage(rawFile);
      setLogoImage(URL.createObjectURL(file));
      setLogoFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen.');
    }
  };

  const compressImage = async (file: File): Promise<Blob> => {
    const result = await optimizeForAI(file);
    return result.file;
  };

  const uploadToStorage = async (file: File | Blob, prefix: string): Promise<string> => {
    if (!user?.id) throw new Error('User not authenticated');
    const timestamp = Date.now();
    const isAudioPrefix = prefix.includes('audio');

    let extension: string;
    let contentType: string;

    if (isAudioPrefix) {
      // Seedance Reference-to-Video sólo acepta .mp3 y .wav.
      // Forzamos extensión/MIME a partir del TYPE real del archivo, no del nombre.
      const t = (file.type || '').toLowerCase();
      if (t === 'audio/mpeg' || t === 'audio/mp3') {
        extension = 'mp3'; contentType = 'audio/mpeg';
      } else if (t === 'audio/wav' || t === 'audio/x-wav') {
        extension = 'wav'; contentType = 'audio/wav';
      } else {
        throw new Error(`Formato de audio no soportado por Evolink Seedance: ${t || 'desconocido'} (usa MP3 o WAV).`);
      }
    } else {
      extension = file instanceof File ? (file.name.split('.').pop() || 'jpg') : (file.type.split('/')[1] || 'jpg');
      contentType = file.type || 'image/jpeg';
    }

    const fileName = `${prefix}-${timestamp}.${extension}`;
    const filePath = `flyer-maker/${user.id}/${fileName}`;
    const { error } = await supabase.storage.from('artes-cloudinary').upload(filePath, file, { contentType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('artes-cloudinary').getPublicUrl(filePath);
    return data.publicUrl;
  };


  const handleUnifiedProcess = async () => {
    if (!startSubmit()) return;

    if (!user?.id) {
      setNoCreditsReason('not_logged');
      setShowNoCreditsModal(true);
      endSubmit();
      return;
    }

    // 1. Validations per type
    if (flyerType === 'evento') {
      if (!referenceImage || artistPhotos.length === 0) {
        toast.error('Completa todos los campos obligatorios (referencia y artistas)');
        endSubmit();
        return;
      }
    } else if (flyerType === 'agenda') {
      const validDates = agendaDates.filter(d => d.dia.trim() && d.local.trim());
      if (!referenceImage || !agendaArtistPhoto || !agendaTitle.trim() || !agendaArtistName.trim() || validDates.length === 0) {
        toast.error('Completa todos los campos obligatorios y agrega al menos una fecha');
        endSubmit();
        return;
      }
    } else if (flyerType === 'contrate') {
      if (!referenceImage || !contrateArtistPhoto || !contrateTitle.trim() || !contrateArtistName.trim()) {
        toast.error('Completa todos los campos obligatorios');
        endSubmit();
        return;
      }
    } else if (flyerType === 'outro') {
      if (!referenceImage || !outroHeadline.trim()) {
        toast.error('Flyer de referencia y Headline son obligatorios');
        endSubmit();
        return;
      }
    }

    // 2. Resource check
    const activeCheck = await checkActiveJob(user.id);
    if (activeCheck.hasActiveJob && activeCheck.activeTool) {
      setActiveToolName(activeCheck.activeTool);
      setActiveJobId(activeCheck.activeJobId);
      setActiveStatus(activeCheck.activeStatus);
      setShowActiveJobModal(true);
      endSubmit();
      return;
    }

    const freshCredits = await checkBalance();
    const freshTestCredits = await fetchTestCredits();
    if (freshCredits + freshTestCredits < creditCost) {
      setNoCreditsReason('insufficient');
      setShowNoCreditsModal(true);
      endSubmit();
      return;
    }

    setStatus('uploading');
    setProgress(0);
    setOutputImage(null);
    setThumbnailImage(null);
    setDebugErrorMessage(null);

    let localJobId: string | null = null;

    try {
      // 3. Upload common and specific files
      setProgress(10);
      let referenceUrl = referenceImage;
      if (referenceFile) {
        referenceUrl = await uploadToStorage(await compressImage(referenceFile), `${flyerType}-reference`);
      }

      let artistUrls: string[] = [];
      let logoUrlStr: string | null = null;
      let dateTimeLocationStr = '';
      let titleStr = '';
      let addressStr = '';
      let artistNamesStr = '';
      let footerPromoStr = '';
      let currentImageSize = imageSize;
      let currentCreativity = creativity;

      if (flyerType === 'evento') {
        for (let i = 0; i < artistPhotos.length; i++) {
          artistUrls.push(await uploadToStorage(await compressImage(artistPhotos[i].file), `artist_${i}`));
        }
        logoUrlStr = logoFile ? await uploadToStorage(await compressImage(logoFile), 'logo') : 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png';
        dateTimeLocationStr = dateTimeLocation ? `DATA HORA E LOCAL: ${dateTimeLocation}` : '';
        titleStr = title ? `TITULO: ${title}` : '';
        addressStr = address ? `ENDEREÇO: ${address}` : '';
        artistNamesStr = artistNames ? `NOMES DOS ARTISTAS: ${artistNames}` : '';
        footerPromoStr = footerPromo ? `PROMOÇÃO DE RODAPÉ: ${footerPromo}` : '';
      } else if (flyerType === 'agenda') {
        artistUrls = [await uploadToStorage(await compressImage(agendaArtistFile!), 'agenda-artist')];
        dateTimeLocationStr = agendaDates.filter(d => d.dia.trim() && d.local.trim()).map((d, i) => `DATA${i + 1}: ${d.dia.trim()}, ${d.local.trim()}${d.cidade.trim() ? ` - ${d.cidade.trim()}` : ''}`).join('\n');
        titleStr = agendaTitle.trim() ? `TITULO: ${agendaTitle.trim()}` : '';
        artistNamesStr = agendaArtistName.trim() ? `NOMES DOS ARTISTAS: ${agendaArtistName.trim()}` : '';
        footerPromoStr = agendaFooter.trim() ? `PROMOÇÃO DE RODAPÉ: ${agendaFooter.trim()}` : 'PROMOÇÃO DE RODAPÉ:';
        currentImageSize = agendaImageSize as any;
        currentCreativity = agendaCreativity;
      } else if (flyerType === 'contrate') {
        artistUrls = [await uploadToStorage(await compressImage(contrateArtistFile!), 'contrate-artist')];
        dateTimeLocationStr = contrateContact.trim() ? `CONTATO: ${contrateContact.trim()}` : 'CONTATO:';
        titleStr = contrateTitle.trim() ? `TITULO: ${contrateTitle.trim()}` : 'TITULO:';
        artistNamesStr = contrateArtistName.trim() ? `NOMES DOS ARTISTAS: ${contrateArtistName.trim()}` : 'NOMES DOS ARTISTAS:';
        footerPromoStr = contrateFooter.trim() ? `PROMOÇÃO DE RODAPÉ: ${contrateFooter.trim()}` : 'PROMOÇÃO DE RODAPÉ:';
        currentImageSize = contrateImageSize as any;
        currentCreativity = contrateCreativity;
      } else if (flyerType === 'outro') {
        if (outroPessoaSwitch && outroPessoaFile) artistUrls = [await uploadToStorage(await compressImage(outroPessoaFile), 'outro-person')];
        if (outroLogoFile) logoUrlStr = await uploadToStorage(await compressImage(outroLogoFile), 'outro-logo');
        titleStr = `HEADLINE:${outroHeadline.trim()}`;
        addressStr = `SUB-HEADLINE:${outroSubHeadline.trim()}`;
        dateTimeLocationStr = `CALL TO ACTION:${outroCallToAction.trim()}`;
        footerPromoStr = `PROMO:${outroRodape.trim()}`;
        currentImageSize = outroImageSize as any;
        currentCreativity = outroCreativity;
      }

      // 4. Create Job in DB
      setProgress(40);
      const { data: job, error: jobError } = await supabase.from('flyer_maker_jobs').insert({
        session_id: sessionIdRef.current,
        user_id: user.id,
        status: 'pending',
        reference_prompt_id: referencePromptId,
        reference_image_url: referenceUrl,
        artist_photo_urls: artistUrls,
        logo_url: logoUrlStr,
        artist_count: artistUrls.length,
        date_time_location: dateTimeLocationStr,
        title: titleStr,
        address: addressStr,
        artist_names: artistNamesStr,
        footer_promo: footerPromoStr,
        image_size: currentImageSize,
        creativity: currentCreativity,
        job_payload: { flyerSubType: flyerType },
        tool_type: 'flyer-maker'
      } as any).select().single();

      if (jobError || !job) throw new Error(jobError?.message || 'Falló la creación del job');

      localJobId = job.id;
      setJobId(job.id);
      localStorage.setItem('flyer_job_id', job.id);
      localStorage.setItem('flyer_status', 'processing');
      registerJob(job.id, 'Flyer Maker', 'pending');

      // 5. Call Edge Function
      setProgress(50);
      setStatus('processing');

      const { data: runResult, error: runError } = await supabase.functions.invoke('runninghub-flyer-maker/run', {
        body: {
          jobId: job.id,
          userId: user.id,
          creditCost,
          flyerSubType: flyerType,
          referenceImageUrl: referenceUrl,
          artistPhotoUrls: artistUrls,
          logoUrl: logoUrlStr,
          dateTimeLocation: dateTimeLocationStr,
          title: titleStr,
          address: addressStr,
          artistNames: artistNamesStr,
          footerPromo: footerPromoStr,
          imageSize: currentImageSize,
          creativity: currentCreativity
        },
      });

      if (runError) {
        setStatus('idle');
        endSubmit();
        throw new Error(runError.message || 'Error al iniciar el procesamiento');
      }

      fetchTestCredits();
      refetchCredits();

      if (runResult?.error === 'INSUFFICIENT_CREDITS' || runResult?.code === 'INSUFFICIENT_CREDITS') {
        setStatus('idle');
        setNoCreditsReason('insufficient');
        setShowNoCreditsModal(true);
        endSubmit();
        return;
      }

      if (runResult?.queued) {
        setStatus('waiting');
        setQueuePosition(runResult.position || 1);
      } else {
        setStatus('processing');
        setProgress(60);
      }

      // FORÇA O BOTÃO A FICAR CLICÁVEL SEMPRE APÓS O CLIQUE INICIAL
      setStatus('idle');
      endSubmit();
    } catch (error: any) {
      console.error(`[FlyerMaker ${flyerType}] Process error:`, error);
      if (localJobId) {
        await markJobAsFailedInDb(localJobId, 'flyer_maker', error.message || 'Error desconocido');
      }
      setDebugErrorMessage(error.message);
      toast.error(error.message);
      
      // GARANTE QUE O BOTÃO SEJA DESTRAVADO EM QUALQUER ERRO
      setStatus('idle');
      endSubmit();
    }
    }
  };


  const handleCancelQueue = async () => {
    if (!jobId) return;
    try {
      const result = await centralCancelJob('flyer_maker', jobId);
      if (result.success) {
        setStatus('idle');
        setJobId(null);
        endSubmit();
        if (result.refundedAmount > 0) toast.success(`¡Cancelado! ${result.refundedAmount} créditos devueltos.`);
        else toast.info('Cancelado');
        refetchCredits();
      } else {
        toast.error(result.errorMessage || 'Error al cancelar');
      }
    } catch (e) { console.error(e); toast.error('Error al cancelar'); }
  };

  // Handle refine submission (vía RunningHub queue)
  const handleRefine = async () => {
    if (!startSubmit()) return;

    if (!outputImage || !refinePrompt.trim() || !user?.id) {
      endSubmit();
      return;
    }

    const REFINE_COST = 50;

    // Check active job
    const activeCheck = await checkActiveJob(user.id);
    if (activeCheck.hasActiveJob && activeCheck.activeTool) {
      setActiveToolName(activeCheck.activeTool);
      setActiveJobId(activeCheck.activeJobId);
      setActiveStatus(activeCheck.activeStatus);
      setShowActiveJobModal(true);
      endSubmit();
      return;
    }

    const freshCredits = await checkBalance();
    if (freshCredits < REFINE_COST) {
      setNoCreditsReason('insufficient');
      setShowNoCreditsModal(true);
      endSubmit();
      return;
    }

    setIsRefining(true);
    let localRefineJobId: string | null = null;

    try {
      // Build reference URLs — outputImage is already a storage URL
      const referenceImageUrls: string[] = [outputImage];

      // Upload extra reference if provided
      if (refineReferenceFile) {
        const compressed = await compressImage(refineReferenceFile);
        const extraUrl = await uploadToStorage(compressed, 'refine-ref');
        referenceImageUrls.push(extraUrl);
      }

      // If first refinement, seed history with original
      if (refinementHistory.length === 0) {
        setRefinementHistory([{ url: outputImage, label: 'Original' }]);
      }

      // Create job in image_generator_jobs
      const { data: job, error: jobError } = await supabase
        .from('image_generator_jobs')
        .insert({
          session_id: sessionIdRef.current,
          user_id: user.id,
          status: 'pending',
          prompt: refinePrompt.trim(),
          aspect_ratio: imageSize === '9:16' ? '9:16' : '3:4',
          model: 'refine',
        } as any)
        .select('id')
        .single();

      if (jobError || !job) throw new Error(jobError?.message || 'Error al crear job de refinamiento');

      localRefineJobId = job.id;
      setRefineJobId(job.id);
      registerJob(job.id, 'Generar Imagen', 'pending');

      // Start vía edge function
      const { data: runResult, error: runError } = await supabase.functions.invoke('runninghub-image-generator/run', {
        body: {
          jobId: job.id,
          referenceImageUrls,
          aspectRatio: imageSize === '9:16' ? '9:16' : '3:4',
          creditCost: REFINE_COST,
          prompt: refinePrompt.trim(),
          source: 'flyer_maker_refine',
        },
      });

      if (runError) throw new Error(runError.message || 'Error al iniciar el refinamiento');

      if (runResult?.code === 'INSUFFICIENT_CREDITS') {
        setNoCreditsReason('insufficient');
        setShowNoCreditsModal(true);
        setIsRefining(false);
        setRefineJobId(null);
        endSubmit();
        return;
      }

      if (runResult?.error && !runResult?.success && !runResult?.queued) {
        throw new Error(runResult.error);
      }

      // Now wait for useJobStatusSync to deliver the result via Realtime
      endSubmit();
    } catch (err: any) {
      console.error('[FlyerMaker] Refine error:', err);
      toast.error(err.message || 'Error al modificar la imagen');
      if (localRefineJobId) {
        await markJobAsFailedInDb(localRefineJobId, 'image_generator', err.message || 'Refine invocation failed');
      }
      setIsRefining(false);
      setRefineJobId(null);
      endSubmit();
    }
  };

  const handleSelectVersion = (index: number) => {
    setSelectedHistoryIndex(index);
    if (refinementHistory[index]) {
      setOutputImage(refinementHistory[index].url);
    }
  };

  // "Nueva" — keep inputs filled, only clear the result/refine state
   const handleNew = () => {
     setOutputImage(null);
     localStorage.removeItem('flyer_output_image');
     setThumbnailImage(null);
    setRefinementHistory([]);
    setSelectedHistoryIndex(0);
    setRefineMode(false);
    setRefinePrompt('');
    setRefineJobId(null);
    setIsRefining(false);
    setJobId(null);
    setProgress(0);
    setQueuePosition(0);
    setDebugErrorMessage(null);
    setStatus('idle');
  };

  // Full reset — clears every input. Triggered by the discreet "Resetear" button.
  const handleReset = () => {
    handleNew();
    // Evento inputs
    if (referenceImage) URL.revokeObjectURL(referenceImage);
    setReferenceImage(null);
    setReferenceFile(null);
    artistPhotos.forEach(p => { try { URL.revokeObjectURL(p.url); } catch {} });
    setArtistPhotos([]);
    if (logoImage) URL.revokeObjectURL(logoImage);
    setLogoImage(null);
    setLogoFile(null);
    setDateTimeLocation('');
    setTitle('');
    setAddress('');
    setArtistNames('');
    setFooterPromo('');
    setImageSize('3:4');
    setCreativity(0);
    // Agenda inputs
    if (agendaArtistPhoto) URL.revokeObjectURL(agendaArtistPhoto);
    setAgendaArtistPhoto(null);
    setAgendaArtistFile(null);
    setAgendaTitle('');
    setAgendaArtistName('');
    setAgendaFooter('');
    setAgendaCreativity(0);
    setAgendaImageSize('9:16');
    setAgendaDates([{ dia: '', local: '', cidade: '' }]);
    // Contrate inputs
    if (contrateArtistPhoto) URL.revokeObjectURL(contrateArtistPhoto);
    setContrateArtistPhoto(null);
    setContrateArtistFile(null);
    setContrateTitle('CONTRÁTAME');
    setContrateArtistName('');
    setContrateContact('');
    setContrateFooter('');
    setContrateCreativity(4);
    setContrateImageSize('9:16');
    // Outro inputs
    setOutroPessoaSwitch(false);
    if (outroPessoaPhoto) URL.revokeObjectURL(outroPessoaPhoto);
    setOutroPessoaPhoto(null);
    setOutroPessoaFile(null);
    setOutroLogoImage(null);
    setOutroLogoFile(null);
    setOutroHeadline('');
    setOutroSubHeadline('');
    setOutroCallToAction('');
    setOutroRodape('');
    setOutroImageSize('9:16');
    setOutroCreativity(2);
  };

  return (
    <AppLayout fullScreen>
      <div className="h-full lg:overflow-hidden overflow-y-auto flex flex-col">
        {isProcessing && (
          <div className="bg-amber-500/20 border-b border-amber-500/50 px-4 py-2 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-200">No cierres esta página durante el procesamiento</span>
          </div>
        )}

        <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-4 overflow-y-auto lg:overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1 lg:min-h-0">
            {/* INPUTS */}
            <div className="lg:col-span-4 min-h-0 overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto h-full max-h-full"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
              >
                {/* Title */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                     <div className="flex items-center gap-2">
                       <h1 className="text-xl font-bold text-foreground">Flyer Maker</h1>
                       <button
                         onClick={() => setShowTutorial(true)}
                         className="flex items-center gap-1 rounded-md border border-border bg-accent0/10 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-muted-foreground hover:bg-accent0/20 transition-colors"
                       >
                         <Play className="h-3 w-3" />
                         Ver tutorial
                       </button>
                     </div>
                    <button
                      onClick={handleReset}
                      disabled={isProcessing}
                      title="Limpiar todos los campos"
                      className="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-3 h-3" /> Resetear
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Crea flyers profesionales a partir de una referencia y tus datos.</p>
                  {testCredits > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-1.5">
                      <span className="text-xs">🧪</span>
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{testCredits} créditos de prueba</span>
                    </div>
                  )}
                </div>

                  {flyerScreen === 'choose' ? (
                    <div className="flex-1 flex flex-col justify-start py-4">
                      <p className="text-sm font-medium text-foreground text-center mb-6">¿Cómo quieres crear tu flyer?</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Card 1 — Estático */}
                        <Card className="group relative p-0 overflow-hidden border border-border bg-card hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer" onClick={() => setFlyerScreen('static-type')}>
                          <div className="flex flex-col h-full">
                            <div className="w-full h-48 sm:h-auto sm:aspect-[3/4] bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center relative bg-cover bg-center" style={{ backgroundImage: `url(${flyerPreview})` }}>
                              {!flyerPreview && <ImageIcon className="w-12 h-12 text-white/20 group-hover:scale-110 transition-transform duration-300" />}
                            </div>
                            <div className="px-4 py-3">
                              <h4 className="text-sm font-bold text-foreground">🖼️ Flyer Estático</h4>
                            </div>
                          </div>
                        </Card>

                        {/* Card 2 — Animado */}
                        <Card className="group relative p-0 overflow-hidden border-2 border-purple-500/40 bg-purple-500/5 hover:border-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer" onClick={() => setFlyerScreen('motion')}>
                          <Badge className="absolute top-3 right-3 z-10 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-0 text-[10px] font-bold px-2.5 py-0.5 animate-pulse">✨ NUEVO</Badge>
                          <div className="flex flex-col h-full">
                            <div className="w-full h-48 sm:h-auto sm:aspect-[3/4] bg-black relative overflow-hidden">
                              <video
                                autoPlay
                                loop
                                muted
                                playsInline
                                disablePictureInPicture
                                controlsList="nodownload nofullscreen noremoteplayback"
                                className="w-full h-full object-cover"
                                src="https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos//Seedance 20 - _  title Forr_ de S_o Jo_o - Poster Animation_  genre Motion Design  Event Promo_  du.mp4"
                              />
                            </div>
                            <div className="px-4 py-3">
                              <h4 className="text-sm font-bold text-foreground">🎬 Flyer Animado</h4>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                 ) : (flyerScreen === 'motion' || flyerScreen === 'motion-result') ? (
                  <div className="flex-1 flex flex-col gap-3">
                    <button
                      onClick={() => { resetMotion(); setFlyerScreen('choose'); }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-1 self-start"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Volver
                    </button>
                    <div>
                      <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">🎬 Flyer Animado</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Video generado por IA a partir de tu flyer.</p>
                    </div>

                    {/* Upload box */}
                    <label className={`block cursor-pointer group relative ${(motionStatus !== 'idle' && motionStatus !== 'completed') ? 'pointer-events-none opacity-50' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setMotionSourceImage(URL.createObjectURL(f));
                            // Limpiar el valor para permitir seleccionar el mismo archivo nuevamente si es necesario
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className="border-2 border-dashed border-purple-500/50 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
                        {motionSourceImage ? (
                          <img src={motionSourceImage} alt="Source" className="max-h-24 rounded-md" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-purple-500 mb-2" />
                            <p className="text-xs font-medium text-foreground">Haz clic o arrastra el flyer para animar</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">elige un archivo de tu dispositivo</p>
                          </>
                        )}
                      </div>
                    </label>

                    {/* Configuraciones */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-foreground">Motor de IA</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium transition-colors ${motionEngine === 'standard' ? 'text-primary' : 'text-muted-foreground'}`}>Standard</span>
                          <Switch
                            checked={motionEngine === 'pro'}
                            onCheckedChange={(checked) => setMotionEngine(checked ? 'pro' : 'standard')}
                            className="data-[state=checked]:bg-purple-600"
                            disabled={motionStatus !== 'idle' && motionStatus !== 'completed'}
                          />
                          <span className={`text-[10px] font-medium transition-colors flex items-center gap-1 ${motionEngine === 'pro' ? 'text-purple-500' : 'text-muted-foreground'}`}>
                            Pro <Lock className={`w-2.5 h-2.5 ${motionEngine === 'pro' ? 'text-purple-500' : 'text-muted-foreground'}`} />
                          </span>
                        </div>
                      </div>

                      <div className="bg-muted/40 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Duración</span>
                        <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-foreground text-[10px] gap-1">
                          <Lock className="w-2.5 h-2.5" /> 10 segundos
                        </Badge>
                      </div>
                    </div>

                    {motionEngine === 'standard' && (
                      <div className="bg-muted/40 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Resolución</span>
                        <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-foreground text-[10px]">720p</Badge>
                      </div>
                    )}

                    {motionEngine === 'pro' && (
                      <>
                     {/* Formato / Aspect Ratio */}
                     <div>
                        <p className="text-xs font-semibold text-foreground mb-2">Formato del Video (Pro)</p>
                       <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setMotionAspectRatio('9:16')}
                            disabled={motionStatus !== 'idle' && motionStatus !== 'completed'}
                            className={`rounded-lg px-3 py-2 text-xs font-medium border h-auto transition-colors flex flex-col items-center justify-center gap-0.5 ${
                              motionAspectRatio === '9:16'
                                ? 'border-purple-500 bg-purple-500/15 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                            }`}
                          >
                           <span>9:16</span>
                            <span className="text-[10px] opacity-70">Stories / Reels</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setMotionAspectRatio('3:4')}
                            disabled={motionStatus !== 'idle' && motionStatus !== 'completed'}
                            className={`rounded-lg px-3 py-2 text-xs font-medium border h-auto transition-colors flex flex-col items-center justify-center gap-0.5 ${
                              motionAspectRatio === '3:4'
                                ? 'border-purple-500 bg-purple-500/15 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                            }`}
                          >
                           <span>3:4</span>
                            <span className="text-[10px] opacity-70">Feed / Post</span>
                          </Button>
                       </div>
                     </div>

                     {/* Resolución */}
                      <div className="space-y-4">
                        {/* Resolución */}
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-2">Resolución</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setMotionResolution('480p')}
                              disabled={motionStatus !== 'idle' && motionStatus !== 'completed'}
                              className={`rounded-lg px-3 py-2 text-xs font-medium border h-auto transition-colors flex items-center justify-center gap-1.5 ${
                                motionResolution === '480p'
                                  ? 'border-purple-500 bg-purple-500/15 text-foreground'
                                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                               480p <span className="flex items-center gap-0.5 opacity-80"><Coins className="w-3 h-3" /> {motionPrice480}</span>
                             </Button>
                            <Button
                              variant="outline"
                              onClick={() => setMotionResolution('720p')}
                              disabled={motionStatus !== 'idle' && motionStatus !== 'completed'}
                              className={`rounded-lg px-3 py-2 text-xs font-medium border h-auto transition-colors flex items-center justify-center gap-1.5 ${
                                motionResolution === '720p'
                                  ? 'border-purple-500 bg-purple-500/15 text-foreground'
                                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                               720p <span className="flex items-center gap-0.5 opacity-80"><Coins className="w-3 h-3" /> {motionPrice720}</span>
                             </Button>
                          </div>
                        </div>

                        {/* Referencia de Música/Video */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-foreground">Referencia Musical (Opcional)</p>
                            {motionAudioPreview && (
                              <button
                                onClick={() => { setMotionAudioFile(null); setMotionAudioPreview(null); }}
                                className="text-[10px] text-destructive hover:underline"
                                disabled={motionStatus !== 'idle' && motionStatus !== 'completed'}
                              >
                                Quitar
                              </button>
                            )}
                          </div>

                          <label className={`block cursor-pointer group relative ${(motionStatus !== 'idle' && motionStatus !== 'completed') ? 'pointer-events-none opacity-50' : ''}`}>
                            <input
                              type="file"
                              accept="audio/*,video/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const media = document.createElement(f.type.startsWith('audio/') ? 'audio' : 'video');
                                  media.src = URL.createObjectURL(f);
                                  media.onloadedmetadata = () => {
                                    setMediaDuration(media.duration);
                                    setMediaToTrim(f);
                                    setShowMediaTrimModal(true);
                                    URL.revokeObjectURL(media.src);
                                  };
                                  // Limpiar el valor para permitir seleccionar el mismo archivo nuevamente si es necesario
                                  e.target.value = '';
                                }
                              }}
                            />
                            <div className={`border-2 border-dashed transition-all rounded-xl p-3 flex flex-col items-center justify-center text-center min-h-[80px] ${
                              motionAudioPreview
                                ? 'border-purple-500/50 bg-purple-500/10'
                                : 'border-border bg-muted/30 group-hover:bg-muted/50'
                            }`}>
                              {motionAudioPreview ? (
                                <div className="flex items-center gap-2 text-purple-500">
                                  <Play className="w-4 h-4 fill-current" />
                                  <span className="text-xs font-medium truncate max-w-[150px]">{motionAudioPreview}</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-2 mb-1">
                                    <Film className="w-4 h-4 text-muted-foreground/60" />
                                    <Sparkles className="w-4 h-4 text-purple-500/60" />
                                  </div>
                                  <p className="text-[11px] font-medium text-foreground">Haz clic o arrastra música/video</p>
                                  <p className="text-[9px] text-muted-foreground">Sincroniza la animación con el ritmo</p>
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>
                      </>
                    )}

                      {motionStatus !== 'error' && (
                        (() => {
                          const isIdle = motionStatus === 'idle' || motionStatus === 'completed';
                          const motionInsufficient = isIdle && credits < motionCurrentPrice;

                          if (motionInsufficient) {
                            return (
                              <Button
                                className="w-full py-4 text-sm font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl shadow-md"
                                onClick={() => { setNoCreditsReason('insufficient'); setShowNoCreditsModal(true); }}
                              >
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  <Coins className="w-4 h-4" />
                                  <span>Generar flyer animado (Sin créditos)</span>
                                  <span className="text-xs px-2 py-0.5 bg-black/20 rounded-full">
                                    {credits} / {motionCurrentPrice}
                                  </span>
                                </div>
                              </Button>
                            );
                          }

                          return (
                            <Button
                              className="w-full py-4 text-sm font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md shadow-purple-500/30"
                              onClick={handleGenerateMotion}
                              disabled={!motionSourceImage || (motionStatus !== 'idle' && motionStatus !== 'completed') || isSubmitting}
                            >
                              {isIdle ? (
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  <Sparkles className="w-4 h-4 shrink-0" />
                                  <span className="font-bold">Generar flyer animado</span>
                                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/20 rounded-full">
                                    <Coins className="w-3 h-3" /> {motionCurrentPrice}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  {motionStatus === 'uploading' ? 'Subiendo flyer...' : motionStatus === 'waiting' ? `En cola (${queuePosition})` : 'Generando flyer animado...'}
                                </>
                              )}
                            </Button>
                          );
                        })()
                     )}

                      {motionStatus === 'error' && (
                        <Button
                          className="w-full py-4 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md"
                          onClick={() => { setMotionStatus('idle'); endSubmit(); }}
                        >
                          Generar flyer animado (Intentar de Nuevo)
                        </Button>
                      )}

                    <p className="text-[10px] text-muted-foreground text-center">
                      Tiempo estimado: 2–4 minutos. Puedes seguir usando la app.
                    </p>
                  </div>
                ) : flyerScreen === 'static-type' ? (
                  <div className="flex-1 flex flex-col">
                    <button
                      onClick={() => setFlyerScreen('choose')}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 self-start"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Volver
                    </button>
                    <p className="text-sm font-semibold text-foreground mb-4">¿Qué tipo de flyer vamos a hacer hoy?</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'evento' as const, label: 'Evento', img: flyerTypeEvento },
                        { id: 'agenda' as const, label: 'Agenda de Artista', img: flyerTypeAgenda },
                        { id: 'contrate' as const, label: 'Contrátame', img: flyerTypeContrate },
                        { id: 'outro' as const, label: 'Otro', img: flyerTypeOutro },
                      ].map(({ id, label, img }) => (
                        <button
                          key={id}
                          onClick={() => { setFlyerType(id); setFlyerScreen('static-controls'); }}
                          className="group flex flex-col gap-2 active:scale-95 transition-transform"
                        >
                          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border group-hover:border-primary/60 bg-muted/40 transition-all group-hover:shadow-md group-hover:-translate-y-1">
                            <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                          </div>
                          <span className="text-[11px] font-bold text-foreground text-center leading-tight uppercase tracking-wide group-hover:text-primary transition-colors">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : flyerType === 'agenda' ? (
                  <>
                    <button
                      onClick={() => setFlyerScreen('static-type')}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-1 self-start"
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Cambiar tipo
                    </button>

                    <ReferenceImageCard
                      image={referenceImage}
                      onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }}
                      onOpenLibrary={() => setShowPhotoLibrary(true)}
                      disabled={isProcessing}
                      title="Agenda de Referencia"
                      emptyLabel="Elegir de la biblioteca"
                      emptySubLabel="O sube tu agenda"
                    />

                    {/* Foto del Artista */}
                    <div className="border border-border rounded-xl p-4 bg-muted/50">
                      <span className="text-sm font-medium text-foreground mb-2 block">Foto del Artista</span>
                      {agendaArtistPhoto ? (
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden group max-w-[120px]">
                          <img src={agendaArtistPhoto} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => {
                              if (agendaArtistPhoto) URL.revokeObjectURL(agendaArtistPhoto);
                              setAgendaArtistPhoto(null);
                              setAgendaArtistFile(null);
                            }}
                            className="absolute inset-0 bg-muted/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-foreground transition-opacity"
                            disabled={isProcessing}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={`aspect-[3/4] max-w-[120px] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            accept={IMAGE_ACCEPT}
                            className="hidden"
                            onChange={async (e) => {
                              const rawFile = e.target.files?.[0];
                              e.target.value = '';
                              if (!rawFile) return;
                              if (!isAcceptedImage(rawFile)) {
                                toast.error('Selecciona una imagen válida');
                                return;
                              }
                              try {
                                const file = await ensureBrowserCompatibleImage(rawFile);
                                setAgendaArtistPhoto(URL.createObjectURL(file));
                                setAgendaArtistFile(file);
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen');
                              }
                            }}
                            disabled={isProcessing}
                          />
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-[10px] text-muted-foreground">Subir foto</span>
                        </label>
                      )}
                    </div>

                    {/* Campos de texto */}
                    <div className="space-y-2.5">
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Título de la Agenda:</span>
                        <Input placeholder="AGENDA MENSUAL" value={agendaTitle} onChange={e => setAgendaTitle(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Nombre del Artista:</span>
                        <Input placeholder="ANA CASTELA" value={agendaArtistName} onChange={e => setAgendaArtistName(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Pie de página / Promoción (opcional):</span>
                        <Input placeholder="SHOWS PRIVADOS: (99) 99999-9999" value={agendaFooter} onChange={e => setAgendaFooter(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="border border-border rounded-xl p-4 bg-muted/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-foreground">Fechas de la Agenda</span>
                        <span className="text-[10px] text-muted-foreground">{agendaDates.length}/20</span>
                      </div>

                      <div className="space-y-3">
                        {agendaDates.map((date, index) => (
                          <div key={index} className="relative border border-border rounded-lg p-3 bg-background">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Fecha {index + 1}
                              </span>
                              {agendaDates.length > 1 && (
                                <button
                                  onClick={() => setAgendaDates(prev => prev.filter((_, i) => i !== index))}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  disabled={isProcessing}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2">
                                <Input
                                  placeholder="15 DE ABRIL"
                                  value={date.dia}
                                  onChange={e => {
                                    const updated = [...agendaDates];
                                    updated[index] = { ...updated[index], dia: e.target.value };
                                    setAgendaDates(updated);
                                  }}
                                  disabled={isProcessing}
                                  className="bg-muted border-border text-foreground text-xs h-8 uppercase placeholder:text-muted-foreground"
                                />
                                <span className="text-[9px] text-muted-foreground mt-0.5 block">Día *</span>
                              </div>
                              <div>
                                <Input
                                  placeholder="BAR DE JUAN"
                                  value={date.local}
                                  onChange={e => {
                                    const updated = [...agendaDates];
                                    updated[index] = { ...updated[index], local: e.target.value };
                                    setAgendaDates(updated);
                                  }}
                                  disabled={isProcessing}
                                  className="bg-muted border-border text-foreground text-xs h-8 uppercase placeholder:text-muted-foreground"
                                />
                                <span className="text-[9px] text-muted-foreground mt-0.5 block">Lugar *</span>
                              </div>
                              <div>
                                <Input
                                  placeholder="CIUDAD DE MÉXICO"
                                  value={date.cidade}
                                  onChange={e => {
                                    const updated = [...agendaDates];
                                    updated[index] = { ...updated[index], cidade: e.target.value };
                                    setAgendaDates(updated);
                                  }}
                                  disabled={isProcessing}
                                  className="bg-muted border-border text-foreground text-xs h-8 uppercase placeholder:text-muted-foreground"
                                />
                                <span className="text-[9px] text-muted-foreground mt-0.5 block">Ciudad</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {agendaDates.length < 20 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAgendaDates(prev => [...prev, { dia: '', local: '', cidade: '' }])}
                          disabled={isProcessing}
                          className="w-full mt-3 text-xs border-dashed"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Agregar fecha ({agendaDates.length}/20)
                        </Button>
                      )}
                    </div>

                    {/* Tamaño */}
                    <div>
                      <span className="text-sm font-medium text-foreground mb-2 block">Tamaño</span>
                      <div className="grid grid-cols-2 gap-0 bg-muted border border-border rounded-lg p-1">
                        <button onClick={() => setAgendaImageSize('3:4')} className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${agendaImageSize === '3:4' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} disabled={isProcessing}>
                          Feed (3:4)
                        </button>
                        <button onClick={() => setAgendaImageSize('9:16')} className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${agendaImageSize === '9:16' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} disabled={isProcessing}>
                          Stories (9:16)
                        </button>
                      </div>
                    </div>

                    <CreativitySlider value={agendaCreativity} onChange={setAgendaCreativity} disabled={isProcessing} max={5} showRecommendation={false} />

                    {/* Generate Button */}
                    {!isProcessing && status !== 'completed' && (
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl shadow-lg disabled:opacity-50"
                          disabled={!canProcessAgenda || isSubmitting}
                          onClick={handleUnifiedProcess}
                        >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span>Iniciando...</span></div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 flex-wrap text-center">
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span className="shrink-0">Generar Agenda</span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/20 rounded-full whitespace-nowrap">
                              <Coins className="w-3 h-3" /> {creditCost}
                              {testCredits > 0 && <span className="ml-1">(🧪 prueba)</span>}
                            </span>
                          </div>
                        )}
                      </Button>
                    )}

                    {/* Completed Actions */}
                    {status === 'completed' && (
                      <div className="space-y-2">
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl"
                          onClick={() => download({ url: outputImage!, filename: `agenda-${Date.now()}.png` })}
                        >
                          <Download className="w-4 h-4 mr-2" /> Descargar HD
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl" onClick={handleNew}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Nuevo
                          </Button>
                       <Button variant="outline" className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl" onClick={() => setRefineMode(true)}>
                         <Wand2 className="w-4 h-4 mr-2" /> Modificar
                       </Button>
                     </div>
                       <Button
                         size="sm"
                         onClick={() => {
                           setMotionSourceImage(outputImage);
                           setFlyerScreen('motion');
                         }}
                         className="w-full mt-2 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md shadow-purple-500/30"
                       >
                         ✨ Animar
                       </Button>
                   </div>
                 )}

                    {status === 'waiting' && (
                      <Button
                        variant="outline"
                        className="w-full py-3 text-sm border-red-500/30 text-red-300 hover:bg-red-500/100/10 rounded-xl"
                        onClick={handleCancelQueue}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Salir de la Cola
                      </Button>
                    )}
                  </>
                ) : flyerType === 'contrate' ? (
                  <>
                    <button
                      onClick={() => setFlyerScreen('static-type')}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-1 self-start"
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Cambiar tipo
                    </button>

                    <ReferenceImageCard
                      image={referenceImage}
                      onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }}
                      onOpenLibrary={() => setShowPhotoLibrary(true)}
                      disabled={isProcessing}
                      title="Flyer de Referencia"
                      emptyLabel="Elegir de la biblioteca"
                      emptySubLabel="O sube tu propio flyer"
                    />

                    {/* Foto del Artista */}
                    <div className="border border-border rounded-xl p-4 bg-muted/50">
                      <span className="text-sm font-medium text-foreground mb-2 block">Foto del Artista</span>
                      {contrateArtistPhoto ? (
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden group max-w-[120px]">
                          <img src={contrateArtistPhoto} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => {
                              if (contrateArtistPhoto) URL.revokeObjectURL(contrateArtistPhoto);
                              setContrateArtistPhoto(null);
                              setContrateArtistFile(null);
                            }}
                            className="absolute inset-0 bg-muted/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-foreground transition-opacity"
                            disabled={isProcessing}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={`aspect-[3/4] max-w-[120px] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            accept={IMAGE_ACCEPT}
                            className="hidden"
                            onChange={async (e) => {
                              const rawFile = e.target.files?.[0];
                              e.target.value = '';
                              if (!rawFile) return;
                              if (!isAcceptedImage(rawFile)) {
                                toast.error('Selecciona una imagen válida');
                                return;
                              }
                              try {
                                const file = await ensureBrowserCompatibleImage(rawFile);
                                setContrateArtistPhoto(URL.createObjectURL(file));
                                setContrateArtistFile(file);
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen');
                              }
                            }}
                            disabled={isProcessing}
                          />
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-[10px] text-muted-foreground">Subir foto</span>
                        </label>
                      )}
                    </div>

                    {/* Campos de texto */}
                    <div className="space-y-2.5">
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Título:</span>
                        <Input placeholder="CONTRÁTAME" value={contrateTitle} onChange={e => setContrateTitle(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Nombre del Artista:</span>
                        <Input placeholder="ANA CASTELA" value={contrateArtistName} onChange={e => setContrateArtistName(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Contacto / Teléfono:</span>
                        <Input placeholder="(99) 99999-9999" value={contrateContact} onChange={e => setContrateContact(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Pie de página / Información adicional (opcional):</span>
                        <Input placeholder="DISPONIBLE PARA EVENTOS" value={contrateFooter} onChange={e => setContrateFooter(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                    </div>

                    {/* Tamaño */}
                    <div>
                      <span className="text-sm font-medium text-foreground mb-2 block">Tamaño</span>
                      <div className="grid grid-cols-2 gap-0 bg-muted border border-border rounded-lg p-1">
                        <button onClick={() => setContrateImageSize('3:4')} className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${contrateImageSize === '3:4' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} disabled={isProcessing}>
                          Feed (3:4)
                        </button>
                        <button onClick={() => setContrateImageSize('9:16')} className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${contrateImageSize === '9:16' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} disabled={isProcessing}>
                          Stories (9:16)
                        </button>
                      </div>
                    </div>

                    <CreativitySlider value={contrateCreativity} onChange={setContrateCreativity} disabled={isProcessing} max={10} showRecommendation={false} />

                    {/* Generate Button */}
                    {!isProcessing && status !== 'completed' && (
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl shadow-lg disabled:opacity-50"
                          disabled={!canProcessContrate || isSubmitting}
                          onClick={handleUnifiedProcess}
                        >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span>Iniciando...</span></div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <Sparkles className="w-4 h-4" />
                            <span>Generar Flyer</span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/20 rounded-full">
                              <Coins className="w-3 h-3" /> {creditCost}
                              {testCredits > 0 && <span className="ml-1">(🧪 prueba)</span>}
                            </span>
                          </div>
                        )}
                      </Button>
                    )}

                    {/* Completed Actions */}
                    {status === 'completed' && (
                      <div className="space-y-2">
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl"
                          onClick={() => download({ url: outputImage!, filename: `contrate-${Date.now()}.png` })}
                        >
                          <Download className="w-4 h-4 mr-2" /> Descargar HD
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl" onClick={handleNew}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Nuevo
                          </Button>
                       <Button variant="outline" className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl" onClick={() => setRefineMode(true)}>
                         <Wand2 className="w-4 h-4 mr-2" /> Modificar
                       </Button>
                     </div>
                       <Button
                         size="sm"
                         onClick={() => {
                           setMotionSourceImage(outputImage);
                           setFlyerScreen('motion');
                         }}
                         className="w-full mt-2 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md shadow-purple-500/30"
                       >
                         ✨ Animar
                       </Button>
                   </div>
                 )}

                    {status === 'waiting' && (
                      <Button
                        variant="outline"
                        className="w-full py-3 text-sm border-red-500/30 text-red-300 hover:bg-red-500/100/10 rounded-xl"
                        onClick={handleCancelQueue}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Salir de la Cola
                      </Button>
                    )}
                  </>
                ) : flyerType === 'outro' ? (
                  <>
                    <button
                      onClick={() => setFlyerScreen('static-type')}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-1 self-start"
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Cambiar tipo
                    </button>

                    {!refineMode ? (
                      <>
                        {/* 1. Referencia */}
                        <ReferenceImageCard
                          image={referenceImage}
                          onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }}
                          onOpenLibrary={() => setShowPhotoLibrary(true)}
                          disabled={isProcessing}
                          title="Referencia del Flyer"
                          emptyLabel="Elegir de la biblioteca"
                          emptySubLabel="O sube tu flyer"
                        />

                        {/* 2. Switch: ¿Hay persona en el arte? */}
                        <div className="border border-border rounded-xl p-4 bg-muted/50">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-sm font-medium text-foreground block">¿Hay persona en el arte?</span>
                              <span className="text-[10px] text-muted-foreground">Activa para enviar una foto</span>
                            </div>
                            <Switch
                              checked={outroPessoaSwitch}
                              onCheckedChange={(checked) => {
                                setOutroPessoaSwitch(checked);
                                if (!checked) {
                                  if (outroPessoaPhoto) URL.revokeObjectURL(outroPessoaPhoto);
                                  setOutroPessoaPhoto(null);
                                  setOutroPessoaFile(null);
                                }
                              }}
                              disabled={isProcessing}
                            />
                          </div>

                          {outroPessoaSwitch && (
                            outroPessoaPhoto ? (
                              <div className="relative aspect-[3/4] rounded-lg overflow-hidden group max-w-[120px]">
                                <img src={outroPessoaPhoto} alt="" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => {
                                    URL.revokeObjectURL(outroPessoaPhoto);
                                    setOutroPessoaPhoto(null);
                                    setOutroPessoaFile(null);
                                  }}
                                  className="absolute inset-0 bg-muted/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-foreground transition-opacity"
                                  disabled={isProcessing}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <label className={`aspect-[3/4] max-w-[120px] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input
                                  type="file"
                                  accept={IMAGE_ACCEPT}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const rawFile = e.target.files?.[0];
                                    e.target.value = '';
                                    if (!rawFile) return;
                                    if (!isAcceptedImage(rawFile)) { toast.error('Selecciona una imagen válida'); return; }
                                    try {
                                      const file = await ensureBrowserCompatibleImage(rawFile);
                                      setOutroPessoaPhoto(URL.createObjectURL(file));
                                      setOutroPessoaFile(file);
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen');
                                    }
                                  }}
                                  disabled={isProcessing}
                                />
                                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                                <span className="text-[10px] text-muted-foreground">Subir foto</span>
                              </label>
                            )
                          )}
                        </div>

                        {/* 3. Logo / Otra imagen */}
                        <div className="border border-border rounded-xl p-4 bg-muted/50">
                          <span className="text-sm font-medium text-foreground mb-2 block">Logo / Otra imagen <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span></span>
                          {outroLogoImage ? (
                            <div className="relative h-20 rounded-lg overflow-hidden group">
                              <img src={outroLogoImage} alt="" className="w-full h-full object-contain bg-muted/50" />
                              <button
                                onClick={() => { setOutroLogoImage(null); setOutroLogoFile(null); }}
                                className="absolute inset-0 bg-muted/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-foreground transition-opacity"
                                disabled={isProcessing}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className={`h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                              <input
                                type="file"
                                accept={IMAGE_ACCEPT}
                                className="hidden"
                                onChange={async (e) => {
                                  const rawFile = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!rawFile) return;
                                  if (!isAcceptedImage(rawFile)) { toast.error('Selecciona una imagen válida'); return; }
                                  try {
                                    const file = await ensureBrowserCompatibleImage(rawFile);
                                    setOutroLogoImage(URL.createObjectURL(file));
                                    setOutroLogoFile(file);
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen');
                                  }
                                }}
                                disabled={isProcessing}
                              />
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-[10px] text-muted-foreground">Subir logo/imagen</span>
                            </label>
                          )}
                        </div>

                        {/* 4. Campos de texto */}
                        <div className="space-y-2.5">
                          <div>
                            <span className="text-xs text-muted-foreground mb-1 block">Headline <span className="text-destructive">*</span></span>
                            <Input placeholder="GRAN OFERTA DE VERANO" value={outroHeadline} onChange={e => setOutroHeadline(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground mb-1 block">Sub-Headline <span className="text-[10px]">(opcional)</span></span>
                            <Input placeholder="HASTA 70% OFF EN TODOS LOS PRODUCTOS" value={outroSubHeadline} onChange={e => setOutroSubHeadline(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground mb-1 block">Call to Action <span className="text-[10px]">(opcional)</span></span>
                            <Input placeholder="COMPRA AHORA" value={outroCallToAction} onChange={e => setOutroCallToAction(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground mb-1 block">Información de Pie de Página <span className="text-[10px]">(opcional)</span></span>
                            <Input placeholder="VÁLIDO HASTA 30/04 | WHATSAPP (99) 99999-9999" value={outroRodape} onChange={e => setOutroRodape(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                          </div>
                        </div>

                        {/* 5. Tamaño */}
                        <div>
                          <span className="text-sm font-medium text-foreground mb-2 block">Tamaño</span>
                          <div className="grid grid-cols-3 gap-0 bg-muted border border-border rounded-lg p-1">
                            {([
                              { value: '3:4' as const, label: 'Feed' },
                              { value: '9:16' as const, label: 'Stories' },
                              { value: '16:9' as const, label: 'Landscape' },
                            ]).map(({ value, label }) => (
                              <button
                                key={value}
                                onClick={() => setOutroImageSize(value)}
                                className={`py-2.5 px-2 text-xs rounded-md transition-all font-medium ${
                                  outroImageSize === value
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                disabled={isProcessing}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 6. Creatividad */}
                        <CreativitySlider value={outroCreativity} onChange={setOutroCreativity} disabled={isProcessing} max={5} showRecommendation={false} />

                        {/* 7. Botón generar */}
                        {!isProcessing && status !== 'completed' && (
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl shadow-lg disabled:opacity-50"
                          disabled={!canProcessOutro || isSubmitting}
                          onClick={handleUnifiedProcess}
                        >
                            {isSubmitting ? (
                              <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span>Iniciando...</span></div>
                            ) : (
                              <div className="flex items-center justify-center gap-2 flex-wrap text-center">
                                <Sparkles className="w-4 h-4 shrink-0" />
                                <span className="shrink-0">Generar Flyer</span>
                                <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/20 rounded-full whitespace-nowrap">
                                  <Coins className="w-3 h-3" /> {creditCost}
                                  {testCredits > 0 && <span className="ml-1">(🧪 prueba)</span>}
                                </span>
                              </div>
                            )}
                          </Button>
                        )}

                        {/* Completed Actions */}
                        {status === 'completed' && (
                          <div className="space-y-2">
                            <Button
                              className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl"
                              onClick={() => download({ url: outputImage!, filename: `flyer-otro-${Date.now()}.png` })}
                            >
                              <Download className="w-4 h-4 mr-2" /> Descargar HD
                            </Button>
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl" onClick={handleNew}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Nuevo
                              </Button>
                       <Button variant="outline" className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl" onClick={() => setRefineMode(true)}>
                         <Wand2 className="w-4 h-4 mr-2" /> Modificar
                       </Button>
                     </div>
                       <Button
                         size="sm"
                         onClick={() => {
                           setMotionSourceImage(outputImage);
                           setFlyerScreen('motion');
                         }}
                         className="w-full mt-2 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md shadow-purple-500/30"
                       >
                         ✨ Animar
                       </Button>
                   </div>
                 )}

                        {status === 'waiting' && (
                          <Button
                            variant="outline"
                            className="w-full py-3 text-sm border-red-500/30 text-red-300 hover:bg-red-500/100/10 rounded-xl"
                            onClick={handleCancelQueue}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Salir de la Cola
                          </Button>
                        )}
                      </>
                    ) : (
                      <RefinePanel
                        title="Hacer Modificación"
                        buttonLabel="Hacer Modificación"
                        loadingLabel="Modificando..."
                        prompt={refinePrompt}
                        onPromptChange={setRefinePrompt}
                        referencePreview={refineReferencePreview}
                        onReferenceChange={(file, preview) => {
                          setRefineReferenceFile(file);
                          setRefineReferencePreview(preview);
                        }}
                        onSubmit={handleRefine}
                        onCancel={() => {
                          setRefineMode(false);
                          setRefinePrompt('');
                          setRefineReferenceFile(null);
                          setRefineReferencePreview(null);
                        }}
                        isRefining={isRefining}
                        creditCost={50}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setFlyerScreen('static-type')}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-1 self-start"
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Cambiar tipo
                    </button>
                    {!refineMode ? (
                  <>
                    <ReferenceImageCard
                      image={referenceImage}
                      onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }}
                      onOpenLibrary={() => setShowPhotoLibrary(true)}
                      disabled={isProcessing}
                      title="Flyer de Referencia"
                      emptyLabel="Elegir de la biblioteca"
                      emptySubLabel="O sube tu flyer"
                    />

                    {/* Artist Photos */}
                    <div className="border border-border rounded-xl p-4 bg-muted/50">
                      <span className="text-sm font-medium text-foreground mb-2 block">Fotos de los Artistas (Máx 5)</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2, 3, 4].map((idx) => {
                          const photo = artistPhotos[idx];
                          if (photo) {
                            return (
                              <div key={idx} className={`relative aspect-[3/4] rounded-lg overflow-hidden group ${idx >= 3 ? 'col-span-1' : ''}`}>
                                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                                <button onClick={() => removeArtistPhoto(idx)} className="absolute inset-0 bg-muted/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-foreground transition-opacity" disabled={isProcessing}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          }
                          if (idx === artistPhotos.length) {
                            return (
                              <label key={idx} className={`aspect-[3/4] rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-accent transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={handleArtistPhotoUpload} disabled={isProcessing} />
                                <Plus className="w-5 h-5 text-muted-foreground" />
                              </label>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="border border-border rounded-xl p-4 bg-muted/50">
                      <span className="text-sm font-medium text-foreground mb-2 block">Logo del Lugar</span>
                      {logoImage ? (
                        <div className="relative h-20 rounded-lg overflow-hidden group">
                          <img src={logoImage} alt="" className="w-full h-full object-contain bg-muted/50" />
                          <button onClick={() => { setLogoImage(null); setLogoFile(null); }} className="absolute inset-0 bg-muted/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-foreground transition-opacity" disabled={isProcessing}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={`h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={handleLogoUpload} disabled={isProcessing} />
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-[10px] text-muted-foreground">Subir Logo</span>
                        </label>
                      )}
                    </div>

                    {/* Text inputs */}
                    <div className="space-y-2.5">
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Fecha y Hora:</span>
                        <Input placeholder="LUN.18.ABR - 18H" value={dateTimeLocation} onChange={e => setDateTimeLocation(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Título del Evento:</span>
                        <Input placeholder="LLEGARON LAS VACACIONES" value={title} onChange={e => setTitle(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Dirección:</span>
                        <Input placeholder="DIRECCIÓN DEL LUGAR..." value={address} onChange={e => setAddress(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Nombres de los Artistas:</span>
                        <Input placeholder="DJ ALOK - RASTA CHINELA..." value={artistNames} onChange={e => setArtistNames(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Pie de Página / Promoción:</span>
                        <Input placeholder="ENTRADA OFF PARA ELLAS..." value={footerPromo} onChange={e => setFooterPromo(e.target.value)} disabled={isProcessing} className="bg-muted border-border text-foreground text-sm h-10 placeholder:text-muted-foreground" />
                      </div>
                    </div>

                    {/* Size Toggle */}
                    <div>
                      <span className="text-sm font-medium text-foreground mb-2 block">Tamaño</span>
                      <div className="grid grid-cols-2 gap-0 bg-muted border border-border rounded-lg p-1">
                        <button
                          onClick={() => setImageSize('3:4')}
                          className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${
                            imageSize === '3:4'
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          disabled={isProcessing}
                        >
                          Feed (3:4)
                        </button>
                        <button
                          onClick={() => setImageSize('9:16')}
                          className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${
                            imageSize === '9:16'
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          disabled={isProcessing}
                        >
                          Stories (9:16)
                        </button>
                      </div>
                    </div>

                    <CreativitySlider value={creativity} onChange={setCreativity} disabled={isProcessing} max={5} showRecommendation={false} />

                    {/* Generate Button */}
                    {!isProcessing && status !== 'completed' && (
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl shadow-lg disabled:opacity-50"
                          disabled={!canProcess || isSubmitting}
                          onClick={handleUnifiedProcess}
                        >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span>Iniciando...</span></div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 flex-wrap text-center">
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span className="shrink-0">Generar Flyer</span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/20 rounded-full whitespace-nowrap">
                              <Coins className="w-3 h-3" /> {creditCost}
                              {testCredits > 0 && <span className="ml-1">(🧪 prueba)</span>}
                            </span>
                          </div>
                        )}
                      </Button>
                    )}

                    {/* Completed Actions */}
                    {status === 'completed' && (
                      <div className="space-y-2">
                        <Button
                          className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl"
                          onClick={() => download({ url: outputImage!, filename: `flyer-${Date.now()}.png` })}
                        >
                          <Download className="w-4 h-4 mr-2" /> Descargar HD
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl"
                            onClick={handleNew}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" /> Nuevo
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full py-3 text-sm border-border text-muted-foreground hover:bg-accent rounded-xl"
                            onClick={() => setRefineMode(true)}
                          >
                            <Wand2 className="w-4 h-4 mr-2" /> Modificar
                          </Button>
                        </div>
                          <Button
                            size="sm"
                            onClick={() => { if (outputImage) setMotionSourceImage(outputImage); setFlyerScreen('motion'); }}
                            className="w-full mt-2 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md shadow-purple-500/30"
                          >
                            ✨ Animar
                          </Button>
                      </div>
                    )}

                    {status === 'waiting' && (
                      <Button
                        variant="outline"
                        className="w-full py-3 text-sm border-red-500/30 text-red-300 hover:bg-red-500/100/10 rounded-xl"
                        onClick={handleCancelQueue}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Salir de la Cola
                      </Button>
                    )}
                  </>
                ) : (
                  <RefinePanel
                    title="Hacer Modificación"
                    buttonLabel="Hacer Modificación"
                    loadingLabel="Modificando..."
                    prompt={refinePrompt}
                    onPromptChange={setRefinePrompt}
                    referencePreview={refineReferencePreview}
                    onReferenceChange={(file, preview) => {
                      setRefineReferenceFile(file);
                      setRefineReferencePreview(preview);
                    }}
                    onSubmit={handleRefine}
                    onCancel={() => {
                      setRefineMode(false);
                      setRefinePrompt('');
                      setRefineReferenceFile(null);
                      setRefineReferencePreview(null);
                    }}
                    isRefining={isRefining}
                    creditCost={50}
                  />
                )}
                  </>
                )}
              </div>
            </div>

            {/* OUTPUT */}
            <div className="lg:col-span-8 min-h-0 overflow-hidden">
              <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-[400px] h-full">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-muted-foreground" /> Resultado</h3>
                  {outputImage && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => transformRef.current?.zoomOut(0.5)}><ZoomOut className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => transformRef.current?.zoomIn(0.5)}><ZoomIn className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>

                <div className="relative flex-1 min-h-0 flex items-center justify-center p-4">
                   {flyerScreen === 'motion-result' && motionVideoUrl ? (
                     <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                       <button
                         onClick={() => { resetMotion(); setFlyerScreen('choose'); }}
                         className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
                       >
                         <ArrowLeft className="w-3.5 h-3.5" /> Nueva generación
                       </button>
                        {motionVideoUrl && (
                          <video
                            key={motionVideoUrl}
                            src={motionVideoUrl}
                            className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                            controls
                            autoPlay
                            loop
                            playsInline
                            preload="auto"
                          />
                        )}
                       <Button
                         className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8 py-6 text-lg rounded-xl shadow-lg"
                         onClick={() => download({ url: motionVideoUrl, filename: `flyer-motion-${Date.now()}.mp4` })}
                       >
                         <Download className="w-5 h-5" /> Descargar Video
                       </Button>
                     </div>
                    ) : outputImage ? (
                     <TransformWrapper ref={transformRef} initialScale={1} minScale={0.5} maxScale={4}>
                       <TransformComponent
                         wrapperStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                         contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                       >
                         <ResilientImage src={outputImage} originalSrc={thumbnailImage || undefined} alt="Resultado" className="max-w-full max-h-full object-contain" maxRetries={4} compressOnFailure={true} locale="es" objectFit="contain" />
                       </TransformComponent>
                     </TransformWrapper>
                   ) : isRefining ? (
                     <div className="flex flex-col items-center p-8">
                      <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-border"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
                        <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-primary" />
                      </div>
                      <p className="text-foreground font-medium mb-1">Refinando imagen...</p>
                      <p className="text-xs text-muted-foreground animate-pulse">La IA está modificando tu imagen</p>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      {isProcessing ? (
                        <div className="flex flex-col items-center">
                          <div className="relative w-16 h-16 mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-border"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
                          </div>
                          <p className="text-foreground font-medium mb-1">{status === 'uploading' ? 'Subiendo imágenes...' : status === 'waiting' ? `En cola: Posición ${queuePosition}` : 'Procesando IA...'}</p>
                          <p className="text-xs text-muted-foreground animate-pulse">{queueMessages[queueMessageIndex].text}</p>
                          <div className="w-48 h-1 bg-accent rounded-full mt-4 overflow-hidden"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <ImageIcon className="w-16 h-16 mb-2" />
                          <p className="text-sm">El resultado aparecerá aquí</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <RefinementTimeline
                  versions={refinementHistory}
                  selectedIndex={selectedHistoryIndex}
                  onSelect={handleSelectVersion}
                />
              </div>
            </div>
          </div>
        </div>

        <FlyerLibraryModal
          isOpen={showPhotoLibrary}
          onClose={() => setShowPhotoLibrary(false)}
          onSelectPhoto={(url) => { handleReferenceImageChange(url); setShowPhotoLibrary(false); }}
          onUploadPhoto={(dataUrl, file) => { handleReferenceImageChange(dataUrl, file); setShowPhotoLibrary(false); }}
          categorySlug={
            flyerType === 'evento' ? 'evento'
            : flyerType === 'agenda' ? 'agenda-de-artista'
            : flyerType === 'contrate' ? 'contrate'
            : flyerType === 'outro' ? 'outros-modelos'
            : undefined
          }
        />
         <NoCreditsModal isOpen={showNoCreditsModal} onClose={() => setShowNoCreditsModal(false)} reason={noCreditsReason} />
         <ActiveJobBlockModal isOpen={showActiveJobModal} onClose={() => setShowActiveJobModal(false)} activeTool={activeToolName} activeJobId={activeJobId} activeStatus={activeStatus} onCancelJob={centralCancelJob} />
         <FlyerMakerTutorialModal
           open={showTutorial}
           onClose={() => {
             setShowTutorial(false);
             localStorage.setItem("flyer-maker-tutorial-seen", "true");
           }}
          />

          {mediaToTrim && (
            <MediaTrimModal
              isOpen={showMediaTrimModal}
              onClose={() => setShowMediaTrimModal(false)}
              mediaFile={mediaToTrim}
              mediaDuration={mediaDuration}
              onSave={(trimmedFile) => {
                setMotionAudioFile(trimmedFile);
                setMotionAudioPreview(trimmedFile.name);
                setShowMediaTrimModal(false);
                toast.success(`¡${trimmedFile.type.startsWith('video/') ? 'Video' : 'Audio'} recortado y seleccionado!`);
              }}
            />
          )}
        </div>
     </AppLayout>
  );
};

export default FlyerMakerTool;
