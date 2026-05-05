import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Download, Loader2, ZoomIn, ZoomOut, ImageIcon, XCircle, Coins, RefreshCw, Plus, Trash2, Upload, Wand2, ArrowLeft, Play, Film, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSeedanceTotalCost } from '@/config/seedance-pricing';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useSmartBackNavigation } from '@/hooks/useSmartBackNavigation';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useCredits } from '@/contexts/CreditsContext';
import { useQueueSessionCleanup } from '@/hooks/useQueueSessionCleanup';
import { useProcessingButton } from '@/hooks/useProcessingButton';
import { useAIJob } from '@/contexts/AIJobContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import ReferenceImageCard from '@/components/arcano-cloner/ReferenceImageCard';
import FlyerLibraryModal from '@/components/flyer-maker/FlyerLibraryModal';
import CreativitySlider from '@/components/arcano-cloner/CreativitySlider';
import NoCreditsModal from '@/components/upscaler/NoCreditsModal';
import ActiveJobBlockModal from '@/components/ai-tools/ActiveJobBlockModal';
import FlyerMakerTutorialModal from '@/components/flyer-maker/FlyerMakerTutorialModal';
import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';
import { optimizeForAI } from '@/hooks/useImageOptimizer';
import { isAcceptedImage, ensureBrowserCompatibleImage, IMAGE_ACCEPT } from '@/lib/heicConverter';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { useJobPendingWatchdog } from '@/hooks/useJobPendingWatchdog';
import { getAIErrorMessage } from '@/utils/errorMessages';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import { useCollaboratorAttribution } from '@/hooks/useCollaboratorAttribution';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'waiting' | 'completed' | 'error';

const FlyerMakerTool: React.FC = () => {
  const location = useLocation();
  const { goBack } = useSmartBackNavigation({ fallback: '/ferramentas-ia-aplicativo' });
  const { user } = usePremiumStatus();
  const { balance: credits, refetch: refetchCredits, checkBalance } = useCredits();
  const { getCreditCost } = useAIToolSettings();
  const creditCost = getCreditCost('Flyer Maker', 100);
  
  const [testCredits, setTestCredits] = useState(0);
  const fetchTestCredits = useCallback(async () => {
    if (!user?.id) return 0;
    const { data } = await supabase.rpc('get_flyer_test_credits', { _user_id: user.id });
    if (typeof data === 'number') setTestCredits(data);
    return data || 0;
  }, [user?.id]);
  
  useEffect(() => { fetchTestCredits(); }, [fetchTestCredits]);
  
  const { registerJob, updateJobStatus, playNotificationSound } = useAIJob();
  const { referencePromptId } = useCollaboratorAttribution();

  // Inputs
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
  const [creativity, setCreativity] = useState(4);

  // Agenda states
  const [agendaArtistPhoto, setAgendaArtistPhoto] = useState<string | null>(null);
  const [agendaArtistFile, setAgendaArtistFile] = useState<File | null>(null);
  const [agendaDates, setAgendaDates] = useState([{ dia: '', local: '', cidade: '' }]);

  // Contrate states
  const [contrateArtistPhoto, setContrateArtistPhoto] = useState<string | null>(null);
  const [contrateArtistFile, setContrateArtistFile] = useState<File | null>(null);

  // Outro states
  const [outroHeadline, setOutroHeadline] = useState('');
  const [outroPessoaSwitch, setOutroPessoaSwitch] = useState(false);
  const [outroPessoaFile, setOutroPessoaFile] = useState<File | null>(null);

  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [flyerType, setFlyerType] = useState<'evento' | 'agenda' | 'contrate' | 'outro' | null>(null);
  const [flyerScreen, setFlyerScreen] = useState<'choose' | 'static-type' | 'static-controls' | 'motion' | 'motion-result'>('choose');
  
  // Motion states
  const [motionEngine, setMotionEngine] = useState<'standard' | 'pro'>('pro');
  const [motionResolution, setMotionResolution] = useState<'480p' | '720p'>('480p');
  const [motionSourceImage, setMotionSourceImage] = useState<string | null>(null);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [motionStatus, setMotionStatus] = useState<ProcessingStatus>('idle');
  const [motionJobId, setMotionJobId] = useState<string | null>(null);

  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(!localStorage.getItem("flyer-maker-tutorial-seen"));
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [showActiveJobModal, setShowActiveJobModal] = useState(false);

  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();
  const { download } = useResilientDownload();
  const sessionIdRef = useRef(crypto.randomUUID());

  useQueueSessionCleanup(sessionIdRef.current, status);

  useJobStatusSync({
    jobId, toolType: 'flyer_maker', enabled: status === 'processing' || status === 'waiting',
    onStatusChange: (update) => {
      if (update.status === 'completed' && update.outputUrl) {
        setOutputImage(update.outputUrl); setStatus('completed'); setProgress(100); endSubmit(); playNotificationSound(); refetchCredits(); fetchTestCredits();
        toast.success('¡Flyer generado con éxito!');
      } else if (update.status === 'failed') {
        setStatus('error'); endSubmit(); toast.error(getAIErrorMessage(update.errorMessage).message);
      }
    }
  });

  const handleUnifiedProcess = async () => {
    if (!startSubmit()) return;
    if (!user?.id) { setShowNoCreditsModal(true); endSubmit(); return; }
    
    setStatus('uploading'); setProgress(10);
    try {
      const referenceUrl = referenceFile ? await uploadToStorage(referenceFile, 'reference') : referenceImage;
      const artistUrls = [];
      for (const p of artistPhotos) artistUrls.push(await uploadToStorage(p.file, 'artist'));
      const logoUrlStr = logoFile ? await uploadToStorage(logoFile, 'logo') : null;

      const { data: job } = await supabase.from('flyer_maker_jobs').insert({
        user_id: user.id, status: 'pending', reference_image_url: referenceUrl, artist_photo_urls: artistUrls, logo_url: logoUrlStr,
        title, date_time_location: dateTimeLocation, image_size: imageSize, creativity, tool_type: 'flyer-maker'
      } as any).select().single();

      if (!job) throw new Error('Error al crear el trabajo');
      setJobId(job.id); setStatus('processing');
      
      await supabase.functions.invoke('runninghub-flyer-maker/run', {
        body: { jobId: job.id, creditCost, flyerSubType: flyerType, referenceImageUrl: referenceUrl, artistPhotoUrls: artistUrls, logoUrl: logoUrlStr, title, dateTimeLocation, imageSize, creativity }
      });
    } catch (e: any) {
      toast.error(e.message); setStatus('error'); endSubmit();
    }
  };

  const uploadToStorage = async (file: File, prefix: string) => {
    const { file: optimized } = await optimizeForAI(file);
    const path = `flyer-maker/${user!.id}/${prefix}-${Date.now()}.jpg`;
    await supabase.storage.from('artes-cloudinary').upload(path, optimized);
    return supabase.storage.from('artes-cloudinary').getPublicUrl(path).data.publicUrl;
  };

  return (
    <AppLayout showNavigation={false}>
      <div className="flex flex-col h-full max-w-lg mx-auto p-4 gap-4">
        {flyerScreen === 'choose' ? (
          <div className="flex flex-col gap-6 items-center justify-center h-full">
            <h1 className="text-2xl font-bold text-center">Flyer Maker</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <Card className="p-6 cursor-pointer hover:border-primary transition-all flex flex-col items-center gap-4" onClick={() => setFlyerScreen('static-type')}>
                <ImageIcon className="w-12 h-12 text-primary" />
                <span className="font-bold">Flyer Estático</span>
              </Card>
              <Card className="p-6 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center gap-4 border-purple-500/40" onClick={() => setFlyerScreen('motion')}>
                <Film className="w-12 h-12 text-purple-500" />
                <span className="font-bold">Flyer Animado</span>
              </Card>
            </div>
          </div>
        ) : flyerScreen === 'static-type' ? (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" onClick={() => setFlyerScreen('choose')} className="self-start gap-2"><ArrowLeft className="w-4 h-4" /> Volver</Button>
            <h2 className="text-xl font-bold">Elige el tipo de flyer</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['evento', 'agenda', 'contrate', 'outro'] as const).map(t => (
                <Button key={t} variant="outline" className="h-24 capitalize" onClick={() => { setFlyerType(t); setFlyerScreen('static-controls'); }}>{t}</Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" onClick={() => setFlyerScreen('static-type')} className="self-start gap-2"><ArrowLeft className="w-4 h-4" /> Cambiar tipo</Button>
            {status === 'completed' && outputImage ? (
              <div className="flex flex-col gap-4">
                <img src={outputImage} className="w-full rounded-lg shadow-lg" alt="Resultado" />
                <Button className="w-full py-6 bg-green-600" onClick={() => download({ url: outputImage, filename: 'flyer.png' })}><Download className="w-4 h-4 mr-2" /> Descargar HD</Button>
                <Button variant="outline" className="w-full" onClick={() => setStatus('idle')}>Crear otro</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <ReferenceImageCard image={referenceImage} onClearImage={() => setReferenceImage(null)} onOpenLibrary={() => setShowPhotoLibrary(true)} title="Flyer de Referencia" />
                <div className="space-y-4 bg-muted/30 p-4 rounded-xl">
                  <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
                  <Input placeholder="Fecha, Hora y Lugar" value={dateTimeLocation} onChange={e => setDateTimeLocation(e.target.value)} />
                </div>
                <CreativitySlider value={creativity} onChange={setCreativity} />
                <Button className="w-full py-8 text-lg font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600" onClick={handleUnifiedProcess} disabled={!referenceImage || isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Generar Flyer ({creditCost} cr)</>}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <FlyerLibraryModal isOpen={showPhotoLibrary} onClose={() => setShowPhotoLibrary(false)} onSelectPhoto={setReferenceImage} />
      <FlyerMakerTutorialModal open={showTutorial} onClose={() => { setShowTutorial(false); localStorage.setItem("flyer-maker-tutorial-seen", "true"); }} />
      <NoCreditsModal open={showNoCreditsModal} onOpenChange={setShowNoCreditsModal} reason="insufficient" />
    </AppLayout>
  );
};

export default FlyerMakerTool;
