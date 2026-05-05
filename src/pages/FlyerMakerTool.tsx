import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Download, Loader2, ZoomIn, ZoomOut, ImageIcon, XCircle, AlertTriangle, Coins, RefreshCw, Plus, Trash2, Upload, Wand2, ArrowLeft, Construction, Play, Film, Lock, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSeedanceTotalCost } from '@/config/seedance-pricing';
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
import { cancelJob as centralCancelJob, checkActiveJob } from '@/ai/JobManager';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { ResilientImage } from '@/components/upscaler/ResilientImage';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { getAIErrorMessage } from '@/utils/errorMessages';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import RefinePanel from '@/components/arcano-cloner/RefinePanel';
import RefinementTimeline, { type RefinementVersion } from '@/components/arcano-cloner/RefinementTimeline';
import { useCollaboratorAttribution } from '@/hooks/useCollaboratorAttribution';


type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'waiting' | 'completed' | 'error';

const queueMessages = [
  { emoji: '🎨', text: 'Criando seu flyer personalizado...' },
  { emoji: '✨', text: 'Aplicando estilos e efeitos...' },
  { emoji: '🚀', text: 'Quase lá, continue esperando!' },
  { emoji: '🌟', text: 'Finalizando os detalhes...' },
];

const FlyerMakerTool: React.FC = () => {
  const location = useLocation();
  const { goBack } = useSmartBackNavigation({ fallback: '/ferramentas-ia-aplicativo' });
  const { user } = usePremiumStatus();
  const { balance: credits, isLoading: creditsLoading, refetch: refetchCredits, checkBalance } = useCredits();
  const { getCreditCost } = useAIToolSettings();
  const creditCost = getCreditCost('Flyer Maker', 100);
  
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
  
  const { registerJob, updateJobStatus, clearJob: clearGlobalJob } = useAIJobContext();

  const { referencePromptId, clear: clearAttribution } = useCollaboratorAttribution();

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [artistPhotos, setArtistPhotos] = useState<{ url: string, file: File }[]>([]);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const [dateTimeLocation, setDateTimeLocation] = useState('');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [artistNames, setArtistNames] = useState('');
  const [footerPromo, setFooterPromo] = useState('');
  
  const [imageSize, setImageSize] = useState<'3:4' | '9:16'>('3:4');
  const [creativity, setCreativity] = useState(0);

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

  const [contrateArtistPhoto, setContrateArtistPhoto] = useState<string | null>(null);
  const [contrateArtistFile, setContrateArtistFile] = useState<File | null>(null);
  const [contrateTitle, setContrateTitle] = useState('CONTRATE AGORA');
  const [contrateArtistName, setContrateArtistName] = useState('');
  const [contrateContact, setContrateContact] = useState('');
  const [contrateFooter, setContrateFooter] = useState('');
  const [contrateCreativity, setContrateCreativity] = useState(4);
  const [contrateImageSize, setContrateImageSize] = useState<'3:4' | '9:16'>('9:16');

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

  const [outputImage, setOutputImage] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('flyer_output_image') : null);
  useEffect(() => {
    if (outputImage) localStorage.setItem('flyer_output_image', outputImage);
    else localStorage.removeItem('flyer_output_image');
  }, [outputImage]);

  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);

  const [flyerType, setFlyerType] = useState<'evento' | 'agenda' | 'contrate' | 'outro' | null>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_type') as any : null));
  useEffect(() => {
    if (flyerType) localStorage.setItem('flyer_type', flyerType);
    else localStorage.removeItem('flyer_type');
  }, [flyerType]);

  type FlyerScreen = 'choose' | 'static-type' | 'static-controls' | 'motion' | 'motion-result';
  const [flyerScreen, setFlyerScreen] = useState<FlyerScreen>(() => (typeof window !== 'undefined' ? localStorage.getItem('flyer_screen') as FlyerScreen : null) || 'choose');
  
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

  useEffect(() => {
    if (motionVideoUrl) localStorage.setItem('flyer_motion_video_url', motionVideoUrl);
    else localStorage.removeItem('flyer_motion_video_url');
  }, [motionVideoUrl]);

  useEffect(() => {
    if (motionJobId) localStorage.setItem('flyer_motion_job_id', motionJobId);
    else localStorage.removeItem('flyer_motion_job_id');
  }, [motionJobId]);

  useEffect(() => {
    localStorage.setItem('flyer_motion_status', motionStatus);
  }, [motionStatus]);

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
  const { download } = useResilientDownload();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [noCreditsReason, setNoCreditsReason] = useState<'not_logged' | 'insufficient'>('insufficient');
  const [showActiveJobModal, setShowActiveJobModal] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string>('');
  const [activeJobId, setActiveJobId] = useState<string | undefined>();
  const [activeStatus, setActiveStatus] = useState<string | undefined>();
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("flyer-maker-tutorial-seen"));

  const [refineMode, setRefineMode] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refineReferenceFile, setRefineReferenceFile] = useState<File | null>(null);
  const [refineReferencePreview, setRefineReferencePreview] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<RefinementVersion[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [refineJobId, setRefineJobId] = useState<string | null>(null);

  const canProcess = referenceImage && artistPhotos.length > 0 && status === 'idle';
  const canProcessAgenda = !!(referenceImage && agendaArtistPhoto && agendaTitle.trim() && agendaArtistName.trim() && agendaDates.length > 0 && agendaDates[0].dia.trim() && agendaDates[0].local.trim()) && status === 'idle';
  const canProcessContrate = !!(referenceImage && contrateArtistPhoto && contrateTitle.trim() && contrateArtistName.trim()) && status === 'idle';
  const canProcessOutro = !!(referenceImage && outroHeadline.trim()) && status === 'idle';
  const isProcessing = status === 'uploading' || status === 'processing' || status === 'waiting';

  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  const resetMotion = useCallback(() => {
    if (motionPollTimer.current) { clearInterval(motionPollTimer.current); motionPollTimer.current = null; }
    setMotionSourceImage(null);
    setMotionJobId(null);
    setMotionJobToolType(null);
    setMotionStatus('idle');
    setMotionVideoUrl(null);
    localStorage.removeItem('flyer_motion_video_url');
    localStorage.removeItem('flyer_motion_job_id');
    localStorage.removeItem('flyer_motion_status');
    localStorage.setItem('flyer_screen', 'choose');
  }, []);

  const handleReset = () => {
    setOutputImage(null);
    setReferenceImage(null);
    setReferenceFile(null);
    setArtistPhotos([]);
    setLogoImage(null);
    setLogoFile(null);
    setDateTimeLocation('');
    setTitle('');
    setAddress('');
    setArtistNames('');
    setFooterPromo('');
    setStatus('idle');
    setFlyerScreen('choose');
  };

  const handleNew = () => {
    setOutputImage(null);
    setStatus('idle');
    setRefineMode(false);
    setRefinePrompt('');
  };

  const handleUnifiedProcess = async () => {
    if (!startSubmit()) return;
    if (!user?.id) {
      setNoCreditsReason('not_logged');
      setShowNoCreditsModal(true);
      endSubmit();
      return;
    }
    // Simplificado para reconstrução de layout fiel
    setStatus('uploading');
    toast.info("Iniciando processamento...");
    endSubmit();
  };

  const handleCancelQueue = async () => {
    if (!jobId) return;
    setStatus('idle');
  };

  const handleRefine = async () => {
    setIsRefining(true);
    setTimeout(() => setIsRefining(false), 2000);
  };

  const handleSelectVersion = (index: number) => {
    setSelectedHistoryIndex(index);
  };

  return (
    <AppLayout fullScreen>
      <div className="h-full lg:overflow-hidden overflow-y-auto flex flex-col bg-background">
        {isProcessing && (
          <div className="bg-amber-500/20 border-b border-amber-500/50 px-4 py-2 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-200">Não feche esta página durante o processamento</span>
          </div>
        )}

        <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-4 overflow-y-auto lg:overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1 lg:min-h-0">
            {/* INPUTS */}
            <div className="lg:col-span-4 min-h-0 overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto h-full max-h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">Flyer Maker</h1>
                    <button onClick={() => setShowTutorial(true)} className="flex items-center gap-1 rounded-md border border-border bg-accent0/10 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-muted-foreground hover:bg-accent0/20 transition-colors">
                      <Play className="h-3 w-3" /> Ver tutorial
                    </button>
                  </div>
                  <button onClick={handleReset} className="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted">
                    <RefreshCw className="w-3 h-3" /> Resetar
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Crie flyers profissionais a partir de uma referência e seus dados.</p>

                {flyerScreen === 'choose' ? (
                  <div className="flex-1 flex flex-col justify-start py-4">
                    <p className="text-sm font-medium text-foreground text-center mb-6">Como você quer criar seu flyer?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="group relative p-0 overflow-hidden border border-border bg-card hover:border-primary/40 transition-all cursor-pointer" onClick={() => setFlyerScreen('static-type')}>
                        <div className="w-full h-48 sm:h-auto sm:aspect-[3/4] bg-cover bg-center" style={{ backgroundImage: `url(${flyerPreview})` }} />
                        <div className="px-4 py-3"><h4 className="text-sm font-bold text-foreground">🖼️ Flyer Estático</h4></div>
                      </Card>
                      <Card className="group relative p-0 overflow-hidden border-2 border-purple-500/40 bg-purple-500/5 hover:border-purple-500 transition-all cursor-pointer" onClick={() => setFlyerScreen('motion')}>
                        <Badge className="absolute top-3 right-3 z-10 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white animate-pulse">✨ NOVO</Badge>
                        <div className="w-full h-48 sm:h-auto sm:aspect-[3/4] bg-black relative overflow-hidden">
                          <video autoPlay loop muted playsInline className="w-full h-full object-cover" src="https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos//Seedance%2020%20-%20_%20%20title%20Forr_%20de%20S_o%20Jo_o%20-%20Poster%20Animation_%20%20genre%20Motion%20Design%20%20Event%20Promo_%20%20du.mp4" />
                        </div>
                        <div className="px-4 py-3"><h4 className="text-sm font-bold text-foreground">🎬 Flyer Animado</h4></div>
                      </Card>
                    </div>
                  </div>
                ) : flyerScreen === 'static-type' ? (
                  <div className="flex-1 flex flex-col">
                    <button onClick={() => setFlyerScreen('choose')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 self-start">
                      <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                    </button>
                    <p className="text-sm font-semibold text-foreground mb-4">Qual tipo de flyer vamos fazer hoje?</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'evento', label: 'Evento', img: flyerTypeEvento },
                        { id: 'agenda', label: 'Agenda de Artista', img: flyerTypeAgenda },
                        { id: 'contrate', label: 'Contrate', img: flyerTypeContrate },
                        { id: 'outro', label: 'Outro', img: flyerTypeOutro },
                      ].map(({ id, label, img }) => (
                        <button key={id} onClick={() => { setFlyerType(id as any); setFlyerScreen('static-controls'); }} className="group flex flex-col gap-2">
                          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border group-hover:border-primary/60 bg-muted/40 transition-all">
                            <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                          </div>
                          <span className="text-[11px] font-bold text-foreground text-center uppercase tracking-wide group-hover:text-primary transition-colors">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-4">
                    <button onClick={() => setFlyerScreen('static-type')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1 self-start">
                      <ArrowLeft className="w-3.5 h-3.5" /> Trocar tipo
                    </button>
                    <ReferenceImageCard
                      image={referenceImage}
                      onClearImage={() => setReferenceImage(null)}
                      onOpenLibrary={() => setShowPhotoLibrary(true)}
                      title="Referência"
                      emptyLabel="Biblioteca"
                    />
                    <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-muted" />
                    <CreativitySlider value={creativity} onChange={setCreativity} max={5} />
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-500" onClick={handleUnifiedProcess}>Gerar Flyer</Button>
                  </div>
                )}
              </div>
            </div>

            {/* OUTPUT */}
            <div className="lg:col-span-8 min-h-0 overflow-hidden">
              <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-[400px] h-full">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-muted-foreground" /> Resultado</h3>
                </div>
                <div className="relative flex-1 flex items-center justify-center p-4">
                  {outputImage ? (
                    <TransformWrapper ref={transformRef}>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                        <ResilientImage 
                          src={outputImage} 
                          alt="Resultado"
                          className="max-w-full max-h-full object-contain" 
                        />
                      </TransformComponent>
                    </TransformWrapper>

                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      <ImageIcon className="w-16 h-16 mb-2 mx-auto" />
                      <p className="text-sm">O resultado aparecerá aqui</p>
                    </div>
                  )}
                </div>
                <RefinementTimeline versions={refinementHistory} selectedIndex={selectedHistoryIndex} onSelect={handleSelectVersion} />
              </div>
            </div>
          </div>
        </div>

        <FlyerLibraryModal isOpen={showPhotoLibrary} onClose={() => setShowPhotoLibrary(false)} onSelectPhoto={(url) => setReferenceImage(url)} />
        <NoCreditsModal isOpen={showNoCreditsModal} onClose={() => setShowNoCreditsModal(false)} reason={noCreditsReason} />
        <ActiveJobBlockModal isOpen={showActiveJobModal} onClose={() => setShowActiveJobModal(false)} activeTool={activeToolName} onCancelJob={centralCancelJob} />
        <FlyerMakerTutorialModal open={showTutorial} onClose={() => { setShowTutorial(false); localStorage.setItem("flyer-maker-tutorial-seen", "true"); }} />
      </div>
    </AppLayout>
  );
};

export default FlyerMakerTool;
