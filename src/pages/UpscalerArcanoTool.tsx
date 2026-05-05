import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Sparkles, Download, RotateCcw, Loader2, ZoomIn, ZoomOut, Info, AlertCircle, Clock, MessageSquare, Crown, Coins } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import upscalerExampleBefore from '@/assets/upscaler-example-before.webp';
import upscalerExampleAfter from '@/assets/upscaler-example-after.webp';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useQueueSessionCleanup } from '@/hooks/useQueueSessionCleanup';
import { useProcessingButton } from '@/hooks/useProcessingButton';
import { useAIJobContext } from '@/contexts/AIJobContext';
import { optimizeForUpscaler, getImageDimensions, compressToMaxDimension, MAX_AI_DIMENSION } from '@/hooks/useImageOptimizer';
import AppLayout from '@/components/layout/AppLayout';
import NoCreditsModal from '@/components/upscaler/NoCreditsModal';
import ActiveJobBlockModal from '@/components/ai-tools/ActiveJobBlockModal';
import { JobDebugPanel, DownloadProgressOverlay, NotificationPromptToast } from '@/components/ai-tools';
import { ResilientImage } from '@/components/upscaler/ResilientImage';
import { cancelJob as centralCancelJob, checkActiveJob } from '@/ai/JobManager';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { useIsMobile } from '@/hooks/use-mobile';
import { useJobPendingWatchdog } from '@/hooks/useJobPendingWatchdog';
import { getAIErrorMessage } from '@/utils/errorMessages';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';

// Max dimension for mobile slider preview optimization
const SLIDER_PREVIEW_MAX_PX = 1500;
type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface ErrorDetails {
  message: string;
  code?: string | number;
  solution?: string;
  details?: any;
}

// Prompt categories for image types
const PROMPT_CATEGORIES = {
  pessoas_perto: "Enhance the close-up portrait photo while maintaining 100% of the original identity and lighting. Increase hyper-realism: natural and realistic skin texture, visible micro-pores, subtle microvilli/peach fuzz, hairs corrected strand by strand, defined eyebrows with natural hairs, sharper eyes with realistic reflections, defined eyelashes without exaggeration, lips with natural texture and lines, noise reduction preserving fine details, high yet clean sharpness, balanced contrast and skin tones, PBR detail enhancement (skin with subtle subsurface scattering), realistic depth of field and 4K/8K photographic finish.",
  pessoas_longe: "Enhance the full-body or wide-angle photo of people while maintaining 100% of the original identity and lighting. Focus on overall sharpness, clean silhouettes, natural body proportions, clothing texture enhancement, hair definition, balanced skin tones across the entire figure, environmental context clarity, noise reduction while preserving fine details, and 4K/8K photographic finish.",
  comida: "Realistic food photography: boost sharpness and micro-textures, enhance ingredient detail, natural highlights, true-to-life appetizing colors, soft studio lighting, clean professional finish.",
  fotoAntiga: "Realistic photo restoration: remove scratches/tears/stains, reduce blur, recover sharpness and fine details, fix faded colors, balanced contrast, preserve original texture and identity, natural look.",
  logo: "Preserve exact colors, proportions, typography, spacing, outlines, and alignment. Restore clean, sharp edges; remove jaggies/blur/artifacts and noise while keeping the same visual identity.",
  render3d: "Premium 3D detailing: sharpen edges and emboss depth, add fine surface micro-textures (metal/plastic), realistic reflections and highlights, clean shadows, consistent depth, high-end render finish."
} as const;

type PromptCategory = keyof typeof PROMPT_CATEGORIES;
type PessoasFraming = 'perto' | 'longe';

const UpscalerArcanoTool: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance: credits, isLoading: creditsLoading, refetch: refetchCredits, checkBalance } = useCredits();
  
  const isMobile = useIsMobile();
  const { getCreditCost } = useAIToolSettings();
  
  // Contexto global de jobs
  const { registerJob, updateJobStatus, clearJob: clearGlobalJob } = useAIJobContext();

  // State
  const [version, setVersion] = useState<'standard' | 'pro'>('standard');
  const [detailDenoise, setDetailDenoise] = useState(0);
  const [resolution, setResolution] = useState<'2k' | '4k'>('2k');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('pessoas_perto');
  const [pessoasFraming, setPessoasFraming] = useState<PessoasFraming>('perto');
  const [comidaDetailLevel, setComidaDetailLevel] = useState(0.85);
  const [editingLevel, setEditingLevel] = useState(0.10);
  const [logoDetailLevel, setLogoDetailLevel] = useState(0.40);
  const [render3dDetailLevel, setRender3dDetailLevel] = useState(0.80);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputFileName, setInputFileName] = useState<string>('');
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [lastError, setLastError] = useState<ErrorDetails | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Queue state
  const [isWaitingInQueue, setIsWaitingInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  
  // Debug state
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [failedAtStep, setFailedAtStep] = useState<string | null>(null);
  
  // No credits modal state
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [noCreditsReason, setNoCreditsReason] = useState<'not_logged' | 'insufficient'>('insufficient');
  const [currentQueueCombo, setCurrentQueueCombo] = useState(0);

  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();
  const { isDownloading, progress: downloadProgress, download, cancel: cancelDownload } = useResilientDownload();
 
  const [showActiveJobModal, setShowActiveJobModal] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string>('');
  const [activeJobId, setActiveJobId] = useState<string | undefined>();
  const [activeStatus, setActiveStatus] = useState<string | undefined>();

  const [inputDimensions, setInputDimensions] = useState<{ w: number; h: number } | null>(null);

  // Mobile slider optimization state
  const [optimizedInputImage, setOptimizedInputImage] = useState<string | null>(null);
  const [optimizedOutputImage, setOptimizedOutputImage] = useState<string | null>(null);
  const [isOptimizingForSlider, setIsOptimizingForSlider] = useState(false);

  // Queue message combos
  const queueMessageCombos = [
    { emoji: "🔥", title: "¡Está al máximo!", position: (n: number) => `Eres el ${n}º de la fila`, subtitle: "¡Relájate, ya casi es tu turno!" },
    { emoji: "☕", title: "Hora del café", position: (n: number) => `Posición: ${n}`, subtitle: "Aprovecha para descansar" },
    { emoji: "🎨", title: "Artistas trabajando...", position: (n: number) => `${n > 1 ? n - 1 : 0} personas delante de ti`, subtitle: "¡Las grandes obras toman tiempo!" },
    { emoji: "🚀", title: "Despegue pronto", position: (n: number) => `Eres el ${n}º en la pista`, subtitle: "¡Preparando tu foto para el espacio!" },
    { emoji: "⚡", title: "Alta demanda ahora", position: (n: number) => `Posición ${n} en la fila`, subtitle: "¡Esto vuela, ya casi te toca!" },
    { emoji: "🤖", title: "¡Robots a toda marcha!", position: (n: number) => `Faltan ${n > 1 ? n - 1 : 0} delante de ti`, subtitle: "Están trabajando duro para ti" },
    { emoji: "✨", title: "Preparando tu magia", position: (n: number) => `${n}º lugar en la fila VIP`, subtitle: "La magia de calidad toma su tiempo" },
    { emoji: "🎮", title: "Cargando...", position: (n: number) => `Jugador ${n} en la fila`, subtitle: "¡Próxima fase desbloqueando pronto!" },
    { emoji: "🌟", title: "El éxito genera fila", position: (n: number) => `Eres el ${n}º`, subtitle: "¡Todos quieren esta calidad!" },
    { emoji: "😎", title: "Quédate tranquilo", position: (n: number) => `${n}º esperando`, subtitle: "¡Vale la pena, viene resultado top!" },
  ];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const beforeTransformRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => { sessionIdRef.current = crypto.randomUUID(); }, []);
  useQueueSessionCleanup(sessionIdRef.current, status);

  // PENDING WATCHDOG
  useJobPendingWatchdog({
    jobId,
    toolType: 'upscaler',
    enabled: status !== 'idle' && status !== 'completed' && status !== 'error',
    onJobFailed: useCallback((errorMessage) => {
      setStatus('error');
      setLastError({ message: errorMessage, code: 'INIT_TIMEOUT', solution: 'Verifica tu conexión e intenta de nuevo.' });
      toast.error(errorMessage);
      endSubmit();
    }, [endSubmit]),
  });

  useEffect(() => { if (!useCustomPrompt) { setPromptCategory('pessoas_perto'); setPessoasFraming('perto'); } }, [useCustomPrompt]);
  useEffect(() => { if (version === 'standard') setUseCustomPrompt(false); }, [version]);

  const isLongeMode = pessoasFraming === 'longe' && promptCategory.startsWith('pessoas');
  const isSpecialWorkflow = promptCategory === 'fotoAntiga' || promptCategory === 'comida' || promptCategory === 'logo' || promptCategory === 'render3d';
  const isFotoAntigaMode = promptCategory === 'fotoAntiga';
  const isComidaMode = promptCategory === 'comida';
  const isLogoMode = promptCategory === 'logo';
  const isRender3dMode = promptCategory === 'render3d';
 
  const getFinalPrompt = (): string => {
    if (useCustomPrompt) return customPrompt;
    return PROMPT_CATEGORIES[promptCategory];
  };

  // Optimize images for mobile slider preview
  const optimizeImagesForSlider = useCallback(async (inputUrl: string, outputUrl: string) => {
    setIsOptimizingForSlider(true);
    try {
      const [inputResponse, outputResponse] = await Promise.all([fetch(inputUrl), fetch(outputUrl)]);
      const [inputBlob, outputBlob] = await Promise.all([inputResponse.blob(), outputResponse.blob()]);
      const inputFile = new File([inputBlob], 'input.webp', { type: inputBlob.type });
      const outputFile = new File([outputBlob], 'output.webp', { type: outputBlob.type });
      const [optimizedInput, optimizedOutput] = await Promise.all([
        compressToMaxDimension(inputFile, SLIDER_PREVIEW_MAX_PX),
        compressToMaxDimension(outputFile, SLIDER_PREVIEW_MAX_PX)
      ]);
      setOptimizedInputImage(URL.createObjectURL(optimizedInput.file));
      setOptimizedOutputImage(URL.createObjectURL(optimizedOutput.file));
    } catch (error) {
      console.error('[Upscaler] Failed to optimize slider images:', error);
      setOptimizedInputImage(inputUrl);
      setOptimizedOutputImage(outputUrl);
    } finally {
      setIsOptimizingForSlider(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (optimizedInputImage?.startsWith('blob:')) URL.revokeObjectURL(optimizedInputImage);
      if (optimizedOutputImage?.startsWith('blob:')) URL.revokeObjectURL(optimizedOutputImage);
    };
  }, [optimizedInputImage, optimizedOutputImage]);

  // Status change handler (declared before hook to keep hook count stable)
  const handleJobStatusChange = useCallback(async (update: any) => {
    setCurrentStep(update.currentStep || update.status);
    
    if (update.status === 'completed') {
      let finalOutputUrl = update.outputUrl;
      
      // Fallback: if completed but no outputUrl, fetch directly from DB
      if (!finalOutputUrl && jobId) {
        console.warn('[Upscaler] Completed event without outputUrl, fetching from DB...');
        const { data: freshJob } = await supabase
          .from('upscaler_jobs')
          .select('output_url')
          .eq('id', jobId)
          .maybeSingle();
        finalOutputUrl = freshJob?.output_url || null;
        
        // Retry once after 2s if still missing
        if (!finalOutputUrl) {
          await new Promise(r => setTimeout(r, 2000));
          const { data: retryJob } = await supabase
            .from('upscaler_jobs')
            .select('output_url')
            .eq('id', jobId)
            .maybeSingle();
          finalOutputUrl = retryJob?.output_url || null;
        }
      }
      
      if (finalOutputUrl) {
        setOutputImage(finalOutputUrl);
        setStatus('completed');
        setProgress(100);
        setIsWaitingInQueue(false);
        setQueuePosition(0);
        endSubmit();
        toast.success('¡Listo! Tu imagen fue procesada.');
        if (isMobile && inputImage) optimizeImagesForSlider(inputImage, finalOutputUrl);
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('✅ Upscaler Arcano — ¡Listo!', { body: 'Tu imagen fue procesada con éxito. Toca para ver.', icon: '/favicon.ico' });
        }
      } else {
        console.error('[Upscaler] Job completed but no output URL found');
        setStatus('error');
        setLastError({ message: 'Procesamiento completado pero no se recibió la imagen. Intenta de nuevo.', code: 'NO_OUTPUT', solution: 'Los créditos serán reembolsados automáticamente.' });
        setIsWaitingInQueue(false);
        endSubmit();
        toast.error('Error: no se recibió la imagen procesada');
      }
      refetchCredits();
    } else if (update.status === 'failed') {
      setStatus('error');
      const friendlyError = getAIErrorMessage(update.errorMessage);
      setLastError({ message: friendlyError.message, code: 'TASK_FAILED', solution: friendlyError.solution });
      setIsWaitingInQueue(false);
      toast.error(friendlyError.message);
      endSubmit();
      refetchCredits();
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('❌ Upscaler Arcano — Error', { body: friendlyError.message, icon: '/favicon.ico' });
      }
    } else if (update.status === 'running') {
      setStatus('processing');
      setIsWaitingInQueue(false);
      setQueuePosition(0);
      setProgress(prev => Math.min(prev + 5, 90));
    } else if (update.status === 'queued') {
      setIsWaitingInQueue(true);
      setQueuePosition(update.position || 1);
    }
  }, [jobId, endSubmit, isMobile, inputImage, optimizeImagesForSlider, refetchCredits]);

  // TRIPLE SYNC (Realtime + Polling + Visibility)
  useJobStatusSync({
    jobId,
    toolId: 'upscaler',
    enabled: status === 'processing' || isWaitingInQueue || status === 'uploading',
    onStatusChange: handleJobStatusChange,
    onGlobalStatusChange: updateJobStatus,
  });

  // Register job in global context
  useEffect(() => {
    if (jobId) registerJob(jobId, 'Upscaler Arcano', 'pending');
  }, [jobId, registerJob]);

  // Progress animation
  useEffect(() => {
    if (status !== 'processing') return;
    const interval = setInterval(() => {
      setProgress(prev => prev >= 90 ? prev : prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [status]);

  // Process file after dimension check
  const processFileWithDimensions = useCallback(async (file: File, dimensions: { width: number; height: number }) => {
    toast.info('Optimizando imagen...');
    const optimizationResult = await optimizeForUpscaler(file);
    const processedFile = optimizationResult.file;
    const finalDims = await getImageDimensions(processedFile);
    setInputDimensions({ w: finalDims.width, h: finalDims.height });

    const reader = new FileReader();
    reader.onload = (e) => {
      setInputImage(e.target?.result as string);
      setInputFileName(processedFile.name || file.name);
      setOutputImage(null);
      setJobId(null);
      setIsWaitingInQueue(false);
      setQueuePosition(0);
      setStatus('idle');
      setProgress(0);
    };
    reader.readAsDataURL(processedFile);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagen demasiado grande. Máximo 10MB.');
      return;
    }
    try {
      let dimensions = await getImageDimensions(file);
      let fileToProcess = file;
      if (dimensions.width > MAX_AI_DIMENSION || dimensions.height > MAX_AI_DIMENSION) {
        toast.info('Redimensionando imagen automáticamente...');
        const compressed = await compressToMaxDimension(file, MAX_AI_DIMENSION - 1);
        fileToProcess = compressed.file;
        dimensions = { width: compressed.width, height: compressed.height };
      }
      await processFileWithDimensions(fileToProcess, dimensions);
    } catch (error) {
      try { await processFileWithDimensions(file, { width: 0, height: 0 }); }
      catch { toast.error('Error al procesar imagen. Intenta otro formato (JPG/PNG).'); }
    }
  }, [processFileWithDimensions]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // Handle paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) handleFileSelect(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

  // Process image
  const processImage = async () => {
    if (!startSubmit()) return;

    if (!inputImage) { toast.error('Selecciona una imagen primero'); endSubmit(); return; }
    if (!user?.id) { setNoCreditsReason('not_logged'); setShowNoCreditsModal(true); endSubmit(); return; }

    const activeCheck = await checkActiveJob(user.id);
    if (activeCheck.hasActiveJob && activeCheck.activeTool) {
      setActiveToolName(activeCheck.activeTool);
      setActiveJobId(activeCheck.activeJobId);
      setActiveStatus(activeCheck.activeStatus);
      setShowActiveJobModal(true);
      endSubmit();
      return;
    }

    const upscalerCreditCost = isLogoMode ? 50 : (version === 'pro' ? getCreditCost('Upscaler Pro', 80) : getCreditCost('Upscaler Arcano', 60));
    
    const freshCredits = await checkBalance();
    if (freshCredits < upscalerCreditCost) {
      setNoCreditsReason('insufficient');
      setShowNoCreditsModal(true);
      endSubmit();
      return;
    }

    // Cleanup previous optimized slider images
    if (optimizedInputImage?.startsWith('blob:')) URL.revokeObjectURL(optimizedInputImage);
    if (optimizedOutputImage?.startsWith('blob:')) URL.revokeObjectURL(optimizedOutputImage);
    setOptimizedInputImage(null);
    setOptimizedOutputImage(null);

    setLastError(null);
    setStatus('uploading');
    setProgress(10);

    let createdJobId: string | null = null;

    try {
      // Step 1: Upload image
      const base64Data = inputImage.split(',')[1];
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const tempId = crypto.randomUUID();
      const storagePath = `upscaler/${user.id}/${tempId}.jpg`;
      
      setProgress(20);

      const { error: uploadError } = await supabase.storage
        .from('ai-uploads')
        .upload(storagePath, bytes.buffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw new Error('Error en upload: ' + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from('ai-uploads')
        .getPublicUrl(storagePath);

      const imageUrl = publicUrlData.publicUrl;
      setProgress(35);

      // Step 2: Create job in database
      const resolutionValue = 2048;
      const framingMode = isLongeMode ? 'longe' : 'perto';
      const effectiveCategory = isLongeMode ? 'pessoas_longe' : promptCategory;
      
      const { data: job, error: jobError } = await supabase
        .from('upscaler_jobs')
        .insert({
          session_id: sessionIdRef.current,
          status: 'pending',
          detail_denoise: detailDenoise,
          prompt: getFinalPrompt(),
          user_id: user.id,
          input_file_name: storagePath.split('/').pop() || `${tempId}.jpg`,
          input_url: imageUrl,
          category: effectiveCategory,
          version: version,
          resolution: resolutionValue,
          framing_mode: framingMode,
        })
        .select()
        .single();

      if (jobError || !job) throw new Error('Error al crear trabajo: ' + (jobError?.message || 'Desconocido'));

      setJobId(job.id);
      createdJobId = job.id;
      setProgress(45);

      // Step 3: Call edge function (creditCost determined server-side)
      const { data: response, error: fnError } = await supabase.functions.invoke('runninghub-upscaler/run', {
        body: {
          jobId: job.id,
          imageUrl: imageUrl,
          version: version,
          userId: user.id,
          category: promptCategory,
          detailDenoise: isComidaMode 
            ? comidaDetailLevel 
            : isLogoMode 
              ? (version === 'pro' ? logoDetailLevel : undefined)
              : isRender3dMode
                ? (version === 'pro' ? render3dDetailLevel : undefined)
                : (isSpecialWorkflow ? undefined : detailDenoise),
          resolution: isSpecialWorkflow ? undefined : resolutionValue,
          prompt: isSpecialWorkflow ? undefined : getFinalPrompt(),
          framingMode: isSpecialWorkflow ? undefined : framingMode,
          editingLevel: (version === 'pro' && promptCategory === 'pessoas_perto') ? editingLevel : undefined,
        }
      });

      if (fnError) throw new Error('Error en la función: ' + fnError.message);
      if (!response) throw new Error('Sin respuesta del servidor. Intenta de nuevo.');
      if (!response.success) {
        const err: any = new Error(response.userMessage || response.error || 'Error desconocido de la función');
        err.code = response.code;
        err.userMessage = response.userMessage;
        throw err;
      }

      setProgress(50);
      setStatus('processing');
      refetchCredits();

    } catch (error: any) {
      console.error('[Upscaler] Error:', error);

      if (createdJobId) {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ table: 'upscaler_jobs', jobId: createdJobId, status: 'failed', errorMessage: `Error cliente: ${(error.message || 'Desconocido').substring(0, 200)}` }),
          });
        } catch (rpcErr) {
          console.error('[Upscaler] Failed to mark job in DB:', rpcErr);
        }
      }

      // Identify error type to show clear message
      const rawMsg = error.message || 'Error desconocido';
      const code = error.code || 'UPLOAD_ERROR';
      const isAuthError = code === 'UPSCALER_AUTH_FAILED' || /ApiKey|401|verification failed|unauthorized/i.test(rawMsg);
      const isTransferError = code === 'IMAGE_TRANSFER_ERROR';
      const isRateLimit = code === 'RATE_LIMIT_EXCEEDED';

      let displayMessage = error.userMessage || rawMsg;
      let solution = 'Intenta de nuevo o usa una imagen más pequeña.';
      let toastMsg = '⚠️ Error al procesar imagen';

      if (isAuthError) {
        displayMessage = 'Servicio temporalmente no disponible (autenticación). El equipo técnico ya fue notificado automáticamente.';
        solution = 'Espera unos minutos e intenta de nuevo. Tus créditos no fueron consumidos.';
        toastMsg = '🔧 Servicio en mantenimiento. Equipo notificado.';
      } else if (isTransferError) {
        displayMessage = 'No pudimos enviar tu imagen al servicio de upscaling.';
        solution = 'Verifica tu conexión y prueba con otra imagen.';
        toastMsg = '📡 Error al enviar la imagen';
      } else if (isRateLimit) {
        displayMessage = 'Demasiadas solicitudes seguidas.';
        solution = 'Espera 1 minuto antes de intentar de nuevo.';
        toastMsg = '⏱️ Espera 1 minuto';
      }

      // Ensure overlay closes and UI returns to error state
      setStatus('error');
      setProgress(0);
      setIsWaitingInQueue(false);
      setQueuePosition(0);
      setLastError({ message: displayMessage, code, solution });
      toast.error(toastMsg, { description: displayMessage, duration: 6000 });
      endSubmit();

      // Notify backend of frontend-side critical errors not already caught by edge function
      if (!isAuthError && !isTransferError && !isRateLimit) {
        try {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-bug-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({
              errorType: 'UPSCALER_FRONTEND_ERROR',
              errorMessage: rawMsg,
              errorKey: `upscaler:frontend:${code}`,
              context: { code, jobId: createdJobId, userId: user?.id, version },
            }),
          }).catch(() => {});
        } catch {}
      }
    }
  };

  // Cancel queue
  const cancelQueue = async () => {
    if (!jobId) return;
    try {
      const result = await centralCancelJob('upscaler', jobId);
      if (result.success) {
        setStatus('idle');
        setIsWaitingInQueue(false);
        setQueuePosition(0);
        setJobId(null);
        endSubmit();
        if (result.refundedAmount > 0) {
          toast.success(`¡Cancelado! ${result.refundedAmount} créditos devueltos.`);
        } else {
          toast.info('Saliste de la fila');
        }
        refetchCredits();
      } else {
        toast.error(result.errorMessage || 'Error al cancelar');
      }
    } catch (error) {
      toast.error('Error al cancelar');
    }
  };

  // Download result
  const downloadResult = useCallback(async () => {
    if (!outputImage) return;
    await download({
      url: outputImage,
      filename: `upscaled-${Date.now()}.png`,
      mediaType: 'image',
      timeout: 10000,
      onSuccess: () => toast.success('¡Imagen descargada!'),
      locale: 'es'
    });
  }, [outputImage, download]);

  // Reset tool
  const resetTool = useCallback(() => {
    setInputImage(null);
    setInputFileName('');
    setOutputImage(null);
    setStatus('idle');
    setProgress(0);
    setSliderPosition(50);
    setLastError(null);
    setJobId(null);
    setIsWaitingInQueue(false);
    setQueuePosition(0);
    endSubmit();
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearGlobalJob();
  }, [endSubmit, clearGlobalJob]);

  // Slider handlers
  const updateSliderPositionFromClientX = useCallback((clientX: number) => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    }
  }, []);

  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSliderPositionFromClientX(e.clientX);
  }, [updateSliderPositionFromClientX]);

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      updateSliderPositionFromClientX(e.clientX);
    }
  }, [updateSliderPositionFromClientX]);

  const handleSliderPointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const isProcessing = status === 'processing' || status === 'uploading' || isWaitingInQueue;

  return (
    <AppLayout>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 flex flex-col h-full overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-5 flex-1 min-h-0">
          
          {/* Left Side - Controls Panel */}
          <div className="lg:col-span-2 min-h-0 overflow-hidden">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-5 flex flex-col gap-5 overflow-y-auto h-full max-h-full"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
            >
              
              {/* Title */}
              <div>
                <h1 className="text-xl font-bold text-white">Upscaler Arcano App</h1>
                <p className="text-xs text-gray-400 mt-1">Mejora la calidad de tus imágenes con inteligencia artificial. Transforma fotos en alta resolución sin perder detalles.</p>
              </div>

              {/* Upload Area */}
              <div 
                className="bg-black/60 border border-white/10 border-dashed rounded-xl p-6 cursor-pointer hover:bg-black/80 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {inputImage ? (
                  <div className="flex items-center gap-3">
                    <img src={inputImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{inputFileName || 'Imagen seleccionada'}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-gray-500">Clic para cambiar</p>
                        {inputDimensions && (
                          <span className="text-[10px] text-gray-400">
                            📐 {inputDimensions.w}x{inputDimensions.h}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <p className="text-sm font-medium text-white">Arrastra tu imagen aquí</p>
                    <p className="text-[10px] text-gray-500">PNG, JPEG, WEBP - Máximo 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              {/* Modo */}
              <div>
                <span className="text-sm font-medium text-white mb-2 block">Modo</span>
                <div className="grid grid-cols-2 gap-0 bg-black/40 border border-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setVersion('standard')}
                    className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${
                      version === 'standard' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    V3 Turbo
                  </button>
                  <button
                    onClick={() => setVersion('pro')}
                    className={`py-2.5 px-3 text-sm rounded-md transition-all font-medium ${
                      version === 'pro' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    V3 Pro
                  </button>
                </div>
              </div>

              {/* Tipo de Imagen */}
              {(!useCustomPrompt || version === 'standard') && (
                <div>
                  <span className="text-sm font-medium text-white mb-2 block">Tipo de Imagen</span>
                  <Select
                    value={promptCategory.startsWith('pessoas') ? 'pessoas' : promptCategory}
                    onValueChange={(value) => {
                      if (value === 'pessoas') {
                        setPromptCategory(`pessoas_${pessoasFraming}` as PromptCategory);
                      } else {
                        setPromptCategory(value as PromptCategory);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-black/40 border-white/10 text-white text-sm h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a2e] border-white/10">
                      <SelectItem value="pessoas" className="text-white text-sm">Personas</SelectItem>
                      <SelectItem value="comida" className="text-white text-sm">Comida/Objeto</SelectItem>
                      <SelectItem value="fotoAntiga" className="text-white text-sm">Foto Antigua</SelectItem>
                      <SelectItem value="render3d" className="text-white text-sm">Sello 3D</SelectItem>
                      <SelectItem value="logo" className="text-white text-sm">Logo/Arte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tamaño */}
              {!isSpecialWorkflow && (
                <div>
                  <span className="text-sm font-medium text-white mb-2 block">Tamaño</span>
                  <div className="inline-flex gap-0 bg-black/40 border border-white/10 rounded-lg p-1">
                    <button
                      onClick={() => setResolution('2k')}
                      className={`px-6 py-2 text-sm rounded-md transition-all font-medium ${
                        resolution === '2k' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      2K
                    </button>
                    <button
                      onClick={() => setResolution('4k')}
                      className={`px-6 py-2 text-sm rounded-md transition-all font-medium ${
                        resolution === '4k' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      4k
                    </button>
                  </div>
                </div>
              )}

              {/* Detallar Rostro - V3 Pro only */}
              {version === 'pro' && !isLongeMode && !isSpecialWorkflow && (
                <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-black/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Detallar Rostro</span>
                    <Switch
                      checked={detailDenoise > 0}
                      onCheckedChange={(checked) => {
                        if (!checked) setDetailDenoise(0);
                        else setDetailDenoise(0.15);
                      }}
                      className="data-[state=checked]:bg-white/30 data-[state=unchecked]:bg-white/10 [&>span]:bg-white"
                    />
                  </div>
                  {detailDenoise > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Nivel de detalles</span>
                        <span className="text-xs text-gray-300 font-mono">{detailDenoise.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[detailDenoise]}
                        onValueChange={([value]) => setDetailDenoise(value)}
                        min={0.01}
                        max={1}
                        step={0.01}
                        className="w-full [&_[role=slider]]:bg-white [&_[role=slider]]:border-white/50 [&_.relative>div:first-child]:bg-white/20 [&_.relative>div:first-child>div]:bg-white/60"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>Menos</span>
                        <span>Más</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comida/Objeto Detail Level */}
              {isComidaMode && (
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Nivel de Detalles</span>
                    <span className="text-xs text-gray-300 font-mono">{Math.round(comidaDetailLevel * 100)}%</span>
                  </div>
                  <Slider value={[comidaDetailLevel]} onValueChange={([value]) => setComidaDetailLevel(value)} min={0.70} max={1.00} step={0.01} className="w-full" />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Más Fiel</span>
                    <span>Más Creativo</span>
                  </div>
                </div>
              )}

              {/* Logo/Arte Detail Level - PRO only */}
              {isLogoMode && version === 'pro' && (
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Nivel de Detalle</span>
                    <span className="text-xs text-gray-300 font-mono">{logoDetailLevel.toFixed(2)}</span>
                  </div>
                  <Slider value={[logoDetailLevel]} onValueChange={([value]) => setLogoDetailLevel(value)} min={0.01} max={1.00} step={0.01} className="w-full" />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Más Fidelidad</span>
                    <span>Más Creatividad</span>
                  </div>
                </div>
              )}

              {/* Selos 3D Detail Level - PRO only */}
              {isRender3dMode && version === 'pro' && (
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Nivel de Detalle</span>
                    <span className="text-xs text-gray-300 font-mono">{render3dDetailLevel.toFixed(2)}</span>
                  </div>
                  <Slider value={[render3dDetailLevel]} onValueChange={([value]) => setRender3dDetailLevel(value)} min={0.01} max={1.00} step={0.01} className="w-full" />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Más Fidelidad</span>
                    <span>Más Creatividad</span>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              {!isProcessing && status !== 'completed' && (
                <Button
                  className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl shadow-lg disabled:opacity-50"
                  onClick={processImage}
                  disabled={isSubmitting || !inputImage}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generar Upscaling
                      <span className="ml-2 flex items-center gap-1 text-xs opacity-90">
                        <Coins className="w-3.5 h-3.5" />
                        {isLogoMode ? 50 : (version === 'pro' ? getCreditCost('Upscaler Pro', 80) : getCreditCost('Upscaler Arcano', 60))}
                      </span>
                    </>
                  )}
                </Button>
              )}

              {/* Completed Actions */}
              {status === 'completed' && (
                <div className="space-y-2">
                  <Button
                    className="w-full py-4 text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl"
                    onClick={downloadResult}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar HD
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full py-3 text-sm border-white/10 text-gray-300 hover:bg-white/5 rounded-xl"
                    onClick={resetTool}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Procesar Nueva
                  </Button>
                </div>
              )}

              {/* Error State */}
              {status === 'error' && lastError && (
                <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-red-300">{lastError.message}</p>
                      {lastError.solution && (
                        <p className="text-[10px] text-gray-400">💡 {lastError.solution}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-2 py-2 text-xs border-white/10 text-gray-300 hover:bg-white/5 rounded-lg"
                    onClick={resetTool}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Intentar de Nuevo
                  </Button>
                </div>
              )}

              {/* Debug Panel */}
              <JobDebugPanel
                jobId={jobId}
                tableName="upscaler_jobs"
                currentStep={currentStep}
                failedAtStep={failedAtStep}
                errorMessage={lastError?.message}
                position={queuePosition}
                status={status}
              />
            </div>
          </div>

          {/* Right Side - Result Viewer */}
          <div className="lg:col-span-5 min-h-0 overflow-hidden">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-[400px] h-full">
              {/* Warning Banner */}
              {isProcessing && (
                <div className="bg-amber-500/20 border-b border-amber-500/50 px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-200">No cierres esta página mientras se procesa tu imagen</p>
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                {/* Queue Waiting UI */}
                {isWaitingInQueue ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse">
                      <Clock className="w-8 h-8 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-yellow-300">
                        {queueMessageCombos[currentQueueCombo].emoji} {queueMessageCombos[currentQueueCombo].title}
                      </p>
                      <p className="text-3xl font-bold text-white mt-2">
                        {queueMessageCombos[currentQueueCombo].position(queuePosition)}
                      </p>
                      <p className="text-sm text-purple-300/70 mt-2">
                        {queueMessageCombos[currentQueueCombo].subtitle}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelQueue}
                      className="text-red-300 hover:text-red-100 hover:bg-red-500/20"
                    >
                      Salir de la fila
                    </Button>
                  </div>
                ) : status === 'completed' && outputImage && (!isMobile || !isOptimizingForSlider) ? (
                  /* Result View - Before/After Slider with Zoom */
                  <TransformWrapper
                    key={outputImage}
                    initialScale={1}
                    minScale={1}
                    maxScale={6}
                    smooth={true}
                    onInit={(ref) => {
                      setZoomLevel(ref.state.scale);
                      (window as any).__upscalerTransformRef = ref;
                      if (beforeTransformRef.current) {
                        beforeTransformRef.current.style.transform = `translate(${ref.state.positionX}px, ${ref.state.positionY}px) scale(${ref.state.scale})`;
                        beforeTransformRef.current.style.transformOrigin = '0% 0%';
                      }
                    }}
                    onTransform={(_, state) => {
                      setZoomLevel(state.scale);
                      if (beforeTransformRef.current) {
                        beforeTransformRef.current.style.transform = `translate(${state.positionX}px, ${state.positionY}px) scale(${state.scale})`;
                      }
                    }}
                    wheel={{ disabled: true }}
                    pinch={{ step: 3 }}
                    doubleClick={{ mode: 'zoomIn', step: 0.14 }}
                    panning={{ disabled: zoomLevel <= 1 }}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <div className="relative w-full h-full">
                        {/* Zoom Controls */}
                        <div className="hidden sm:flex absolute top-4 left-1/2 -translate-x-1/2 z-30 items-center gap-1 bg-black/80 rounded-full px-2 py-1">
                          <button onClick={() => zoomOut(0.14)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                            <ZoomOut className="w-4 h-4 text-white" />
                          </button>
                          <span className="text-xs font-mono min-w-[3rem] text-center text-white">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button onClick={() => zoomIn(0.14)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </button>
                          {zoomLevel > 1 && (
                            <button onClick={() => resetTransform()} className="p-1.5 hover:bg-white/20 rounded-full transition-colors ml-1">
                              <RotateCcw className="w-4 h-4 text-white" />
                            </button>
                          )}
                        </div>

                        <div 
                          ref={sliderRef} 
                          className="relative w-full h-full overflow-hidden"
                          onWheel={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const transformRef = (window as any).__upscalerTransformRef;
                            if (!transformRef) return;
                            const MIN_ZOOM = 1;
                            const MAX_ZOOM = 6;
                            const WHEEL_FACTOR = 1.40;
                            const { scale, positionX, positionY } = transformRef.state;
                            const wrapperComponent = transformRef.instance?.wrapperComponent;
                            if (!wrapperComponent) return;
                            const rect = wrapperComponent.getBoundingClientRect();
                            const mouseX = e.clientX - rect.left;
                            const mouseY = e.clientY - rect.top;
                            let newScale: number;
                            if (e.deltaY < 0) newScale = scale * WHEEL_FACTOR;
                            else newScale = scale / WHEEL_FACTOR;
                            newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
                            if (newScale === scale) return;
                            const scaleDiff = newScale - scale;
                            const newPosX = positionX - mouseX * scaleDiff;
                            const newPosY = positionY - mouseY * scaleDiff;
                            transformRef.setTransform(newPosX, newPosY, newScale, 150, 'easeOut');
                          }}
                        >
                          <div className="relative w-full h-full bg-black">
                            {/* AFTER image */}
                            <TransformComponent 
                              wrapperStyle={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} 
                              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <ResilientImage 
                                src={isMobile && optimizedOutputImage ? optimizedOutputImage : outputImage} 
                                alt="Después" 
                                className="w-full h-full"
                                objectFit="contain"
                                timeout={10000}
                                compressOnFailure={true}
                                showDownloadOnFail={true}
                                onDownloadClick={downloadResult}
                                downloadFileName={`upscaled-${Date.now()}.png`}
                                locale="es"
                              />
                            </TransformComponent>

                            {/* BEFORE image - overlay clipped */}
                            <div 
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                            >
                              <div 
                                ref={beforeTransformRef}
                                className="w-full h-full flex items-center justify-center"
                                style={{ transformOrigin: '0% 0%' }}
                              >
                                <img 
                                  src={isMobile && optimizedInputImage ? optimizedInputImage : (inputImage || '')} 
                                  alt="Antes" 
                                  className="w-full h-full"
                                  style={{ objectFit: 'contain' }}
                                  draggable={false}
                                />
                              </div>
                            </div>

                            {/* Slider Line and Handle */}
                            <div 
                              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-20"
                              style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)', cursor: 'ew-resize', touchAction: 'none' }}
                              onPointerDown={handleSliderPointerDown}
                              onPointerMove={handleSliderPointerMove}
                              onPointerUp={handleSliderPointerUp}
                              onPointerCancel={handleSliderPointerUp}
                            >
                              <div 
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center cursor-ew-resize"
                                style={{ touchAction: 'none' }}
                              >
                                <div className="flex gap-0.5">
                                  <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                                  <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                                </div>
                              </div>
                            </div>

                            {/* Labels */}
                            <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/90 border border-white/30 text-white text-xs font-bold z-20 pointer-events-none">
                              Antes
                            </div>
                            <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-purple-600/90 border border-purple-400/50 text-white text-xs font-bold z-20 pointer-events-none">
                              Después
                            </div>
                          </div>
                        </div>

                        {/* Zoom Hint */}
                        <div className="hidden sm:block absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/90 bg-black/80 px-4 py-1.5 rounded-full z-20 border border-white/20">
                          🔍 Usa la rueda del mouse para hacer zoom
                        </div>
                      </div>
                    )}
                  </TransformWrapper>
                ) : status === 'completed' && isMobile && isOptimizingForSlider ? (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    <p className="text-sm text-purple-300">Preparando visualización...</p>
                  </div>
                ) : (status === 'uploading' || status === 'processing') && !isWaitingInQueue ? (
                  /* Processing State */
                  <div className="flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                    <div className="text-center">
                      <p className="text-lg font-medium text-white">
                        {status === 'uploading' ? 'Subiendo imagen...' : 'Procesando...'}
                      </p>
                      <p className="text-sm text-purple-300/70">
                        Puede tomar hasta 2 minutos
                      </p>
                    </div>
                    <div className="w-48 h-2 bg-purple-900/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : inputImage ? (
                  /* Preview uploaded image */
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img src={inputImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                  </div>
                ) : (
                  /* Empty State - Example Before/After */
                  <div 
                    ref={sliderRef}
                    className="relative w-full h-full overflow-hidden rounded-lg cursor-ew-resize select-none"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      isDraggingRef.current = true;
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      updateSliderPositionFromClientX(e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (isDraggingRef.current) {
                        e.preventDefault();
                        updateSliderPositionFromClientX(e.clientX);
                      }
                    }}
                    onPointerUp={(e) => {
                      isDraggingRef.current = false;
                      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                    }}
                  >
                    <img src={upscalerExampleAfter} alt="Ejemplo después" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                    <div 
                      className="absolute inset-0 overflow-hidden pointer-events-none"
                      style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                    >
                      <img src={upscalerExampleBefore} alt="Ejemplo antes" className="w-full h-full object-cover" draggable={false} />
                    </div>
                    <div 
                      className="absolute top-0 bottom-0 w-[2px] bg-white/70 z-10 pointer-events-none"
                      style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
                        <div className="flex gap-[1px]">
                          <div className="w-[1px] h-3 bg-gray-400 rounded-full" />
                          <div className="w-[1px] h-3 bg-gray-400 rounded-full" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 text-[10px] px-2.5 py-1 bg-black/60 text-white/80 font-medium rounded-full z-10 pointer-events-none">
                      Antes
                    </div>
                    <div className="absolute top-3 right-3 text-[10px] px-2.5 py-1 bg-white/15 text-white/80 font-medium rounded-full z-10 pointer-events-none">
                      Después
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/60 px-3 py-1 rounded-full z-10 pointer-events-none">
                      Arrastra para comparar • Ejemplo
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* No Credits Modal */}
      <NoCreditsModal
        isOpen={showNoCreditsModal}
        onClose={() => setShowNoCreditsModal(false)}
        reason={noCreditsReason}
      />
       
      {/* Active Job Block Modal */}
      <ActiveJobBlockModal
        isOpen={showActiveJobModal}
        onClose={() => setShowActiveJobModal(false)}
        activeTool={activeToolName}
        activeJobId={activeJobId}
        activeStatus={activeStatus}
        onCancelJob={centralCancelJob}
      />

      {/* Download Progress Overlay */}
      <DownloadProgressOverlay
        isVisible={isDownloading}
        progress={downloadProgress}
        onCancel={cancelDownload}
        mediaType="image"
        locale="es"
      />

      {/* Notification Prompt Toast */}
      <NotificationPromptToast toolName="upscale" />
    </AppLayout>
  );
};

export default UpscalerArcanoTool;
