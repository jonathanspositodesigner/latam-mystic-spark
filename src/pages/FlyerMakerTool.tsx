import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Download, Loader2, ImageIcon, RefreshCw, Upload, ArrowLeft, Film, Play, GraduationCap, XCircle, AlertTriangle, Wand2, Trash2, Plus, Film as MovieIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
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
import FlyerMakerTutorialModal from '@/components/flyer-maker/FlyerMakerTutorialModal';
import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';
import { optimizeForAI } from '@/hooks/useImageOptimizer';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { getAIErrorMessage } from '@/utils/errorMessages';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import { useCollaboratorAttribution } from '@/hooks/useCollaboratorAttribution';
import { getSeedanceTotalCost } from '@/config/seedance-pricing';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'waiting' | 'completed' | 'error';
type FlyerScreen = 'choose' | 'static-type' | 'static-controls' | 'motion' | 'motion-result';

const FlyerMakerTool: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  
  const { registerJob, updateJobStatus } = useAIJobContext();
  const { referencePromptId } = useCollaboratorAttribution();

  // Common states
  const [flyerType, setFlyerType] = useState<'evento' | 'agenda' | 'contrate' | 'outro' | null>(null);
  const [flyerScreen, setFlyerScreen] = useState<FlyerScreen>('choose');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(!localStorage.getItem("flyer-maker-tutorial-seen"));
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  // Tool specific states
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [artistPhotos, setArtistPhotos] = useState<{ url: string, file: File }[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dateTimeLocation, setDateTimeLocation] = useState('');
  const [creativity, setCreativity] = useState(0);
  const [imageSize, setImageSize] = useState<'3:4' | '9:16'>('3:4');

  // Motion states
  const [motionSourceImage, setMotionSourceImage] = useState<string | null>(null);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [motionStatus, setMotionStatus] = useState<ProcessingStatus>('idle');
  const [motionJobId, setMotionJobId] = useState<string | null>(null);
  const [motionAudioFile, setMotionAudioFile] = useState<File | null>(null);
  const [motionResolution, setMotionResolution] = useState<'480p' | '720p'>('480p');

  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();
  const { download } = useResilientDownload();
  const sessionIdRef = useRef(crypto.randomUUID());

  useQueueSessionCleanup(sessionIdRef.current, status);

  // Sync for static flyer
  useJobStatusSync({
    jobId, toolId: 'flyer_maker', enabled: status === 'processing' || status === 'waiting',
    onStatusChange: (update) => {
      if (update.status === 'completed' && update.outputUrl) {
        setOutputImage(update.outputUrl); setStatus('completed'); endSubmit(); refetchCredits(); fetchTestCredits();
        toast.success('¡Flyer generado con éxito!');
      } else if (update.status === 'failed') {
        setStatus('error'); endSubmit(); toast.error(getAIErrorMessage(update.errorMessage).message);
      }
    }
  });

  // Sync for motion flyer
  useJobStatusSync({
    jobId: motionJobId, toolId: 'flyer_motion', enabled: motionStatus === 'processing' || motionStatus === 'waiting',
    onStatusChange: (update) => {
      if (update.status === 'completed' && update.outputUrl) {
        setMotionVideoUrl(update.outputUrl); setMotionStatus('completed'); setFlyerScreen('motion-result'); endSubmit(); refetchCredits(); fetchTestCredits();
        toast.success('¡Video generado con éxito!');
      } else if (update.status === 'failed') {
        setMotionStatus('error'); endSubmit(); toast.error(getAIErrorMessage(update.errorMessage).message);
      }
    }
  });

  const uploadToStorage = async (file: File, prefix: string) => {
    const { file: optimized } = await optimizeForAI(file);
    const path = `flyer-maker/${user!.id}/${prefix}-${Date.now()}.jpg`;
    await supabase.storage.from('artes-cloudinary').upload(path, optimized);
    return supabase.storage.from('artes-cloudinary').getPublicUrl(path).data.publicUrl;
  };

  const handleUnifiedProcess = async () => {
    if (!startSubmit()) return;
    if (!user?.id) { setShowNoCreditsModal(true); endSubmit(); return; }
    
    const freshCredits = await checkBalance();
    const freshTestCredits = await fetchTestCredits();
    if (freshCredits + freshTestCredits < creditCost) { setShowNoCreditsModal(true); endSubmit(); return; }

    setStatus('uploading');
    try {
      const referenceUrl = referenceFile ? await uploadToStorage(referenceFile, 'reference') : referenceImage;
      const artistUrls = [];
      for (const p of artistPhotos) artistUrls.push(await uploadToStorage(p.file, 'artist'));
      const logoUrlStr = logoFile ? await uploadToStorage(logoFile, 'logo') : null;

      const { data: job, error: jobError } = await supabase.from('flyer_maker_jobs').insert({
        user_id: user.id, status: 'pending', reference_image_url: referenceUrl, artist_photo_urls: artistUrls, logo_url: logoUrlStr,
        title, date_time_location: dateTimeLocation, image_size: imageSize, creativity, tool_type: 'flyer-maker', session_id: sessionIdRef.current,
        reference_prompt_id: referencePromptId
      } as any).select().single();

      if (jobError || !job) throw new Error(jobError?.message || 'Error al crear el trabajo');
      setJobId(job.id); setStatus('processing');
      registerJob(job.id, 'Flyer Maker', 'pending');
      
      await supabase.functions.invoke('runninghub-flyer-maker/run', {
        body: { jobId: job.id, creditCost, flyerSubType: flyerType, referenceImageUrl: referenceUrl, artistPhotoUrls: artistUrls, logoUrl: logoUrlStr, title, dateTimeLocation, imageSize, creativity }
      });
    } catch (e: any) {
      toast.error(e.message); setStatus('error'); endSubmit();
    }
  };

  const handleMotionProcess = async () => {
    if (!startSubmit()) return;
    if (!user?.id || !motionSourceImage) { endSubmit(); return; }

    const motionCost = getSeedanceTotalCost('standard', motionResolution, motionAudioFile ? 'r2v' : 'i2v', 10, 'flyer_motion');
    const freshCredits = await checkBalance();
    if (freshCredits < motionCost) { setShowNoCreditsModal(true); endSubmit(); return; }

    setMotionStatus('processing');
    try {
      let audioUrl = null;
      if (motionAudioFile) {
        const path = `flyer-motion/${user.id}/audio-${Date.now()}.mp3`;
        await supabase.storage.from('artes-cloudinary').upload(path, motionAudioFile);
        audioUrl = supabase.storage.from('artes-cloudinary').getPublicUrl(path).data.publicUrl;
      }

      const { data: job, error: jobError } = await supabase.from('seedance_jobs').insert({
        user_id: user.id, status: 'pending', input_image_urls: [motionSourceImage], input_audio_urls: audioUrl ? [audioUrl] : [],
        model: 'seedance-2-image-to-video-fast', quality: motionResolution, duration: 10, source_tool: 'flyer_motion'
      } as any).select().single();

      if (jobError || !job) throw new Error(jobError?.message || 'Error al crear animación');
      setMotionJobId(job.id);
      registerJob(job.id, 'Flyer Animado', 'pending');

      await supabase.functions.invoke('runninghub-flyer-motion', { body: { jobId: job.id, imageUrl: motionSourceImage } });
    } catch (e: any) {
      toast.error(e.message); setMotionStatus('error'); endSubmit();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full max-w-4xl mx-auto p-4 gap-4">
        {flyerScreen === 'choose' ? (
          <div className="flex flex-col gap-8 items-center justify-center min-h-[70vh]">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white">Flyer Maker</h1>
              <p className="text-muted-foreground">Crea artes profesionales para tus eventos en segundos</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
              <Card className="p-8 cursor-pointer hover:border-primary border-2 border-transparent transition-all flex flex-col items-center gap-6 bg-white/5 group" onClick={() => setFlyerScreen('static-type')}>
                <div className="p-4 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                  <ImageIcon className="w-12 h-12 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">Flyer Estático</h3>
                  <p className="text-sm text-muted-foreground mt-1">Imágenes de alta calidad para redes sociales</p>
                </div>
              </Card>
              <Card className="p-8 cursor-pointer hover:border-purple-500 border-2 border-transparent transition-all flex flex-col items-center gap-6 bg-purple-500/5 group" onClick={() => setFlyerScreen('motion')}>
                <div className="p-4 rounded-full bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                  <Film className="w-12 h-12 text-purple-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">Flyer Animado</h3>
                  <p className="text-sm text-muted-foreground mt-1">Videos dinámicos para mayor impacto</p>
                </div>
              </Card>
            </div>
            <Button variant="ghost" className="text-muted-foreground gap-2" onClick={() => setShowTutorial(true)}>
              <GraduationCap className="w-5 h-5" /> Ver Tutorial
            </Button>
          </div>
        ) : flyerScreen === 'static-type' ? (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
            <Button variant="ghost" onClick={() => setFlyerScreen('choose')} className="self-start gap-2 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4" /> Volver al Inicio
            </Button>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">¿Qué tipo de flyer quieres crear?</h2>
              <p className="text-muted-foreground">Selecciona una categoría para optimizar el diseño</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'evento', label: 'Evento / Show', img: '/assets/flyer-type-evento.webp' },
                { id: 'agenda', label: 'Agenda de Shows', img: '/assets/flyer-type-agenda.webp' },
                { id: 'contrate', label: 'Contrate Ahora', img: '/assets/flyer-type-contrate.webp' },
                { id: 'outro', label: 'Personalizado', img: '/assets/flyer-type-outro.jpg' }
              ].map(t => (
                <button key={t.id} onClick={() => { setFlyerType(t.id as any); setFlyerScreen('static-controls'); }} className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all">
                  <img src={t.img} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={t.label} />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
                    <span className="font-bold text-white text-lg text-center uppercase tracking-wider">{t.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : flyerScreen === 'static-controls' ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setFlyerScreen('static-type')} className="gap-2 text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4" /> Cambiar Categoría
              </Button>
              {testCredits > 0 && <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Prueba Gratis: {testCredits} restante(s)</Badge>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <ReferenceImageCard 
                  image={referenceImage} 
                  onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }} 
                  onOpenLibrary={() => setShowPhotoLibrary(true)} 
                  title="Flyer de Referencia" 
                />
                
                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                  <h3 className="font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Información del Flyer</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-white">Título del Evento</Label>
                      <Input placeholder="Ej: Arcano Fest 2026" value={title} onChange={e => setTitle(e.target.value)} className="bg-white/10 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Fecha, Hora y Lugar</Label>
                      <Input placeholder="Ej: 20 Mayo | 22:00 | Club Arcano" value={dateTimeLocation} onChange={e => setDateTimeLocation(e.target.value)} className="bg-white/10 border-white/10 text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white">Fotos de Artistas</h3>
                    <span className="text-xs text-muted-foreground">{artistPhotos.length}/9 fotos</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {artistPhotos.map((p, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                        <img src={p.url} className="w-full h-full object-cover" alt="Artista" />
                        <button onClick={() => setArtistPhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 p-1 bg-black/60 rounded-bl-lg text-white"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {artistPhotos.length < 9 && (
                      <label className="w-16 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <Plus className="w-6 h-6 text-white/40" />
                        <input type="file" className="hidden" accept="image/*" multiple onChange={e => {
                          const files = Array.from(e.target.files || []);
                          files.forEach(f => {
                            const url = URL.createObjectURL(f);
                            setArtistPhotos(prev => [...prev, { url, file: f }]);
                          });
                        }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <CreativitySlider value={creativity} onChange={setCreativity} />
                
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="font-bold text-white">Formato de Imagen</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant={imageSize === '3:4' ? 'default' : 'outline'} onClick={() => setImageSize('3:4')} className="flex flex-col h-20 gap-1 bg-white/5 border-white/10">
                      <span className="text-lg font-bold">3:4</span>
                      <span className="text-[10px] uppercase text-muted-foreground">Post / Feed</span>
                    </Button>
                    <Button variant={imageSize === '9:16' ? 'default' : 'outline'} onClick={() => setImageSize('9:16')} className="flex flex-col h-20 gap-1 bg-white/5 border-white/10">
                      <span className="text-lg font-bold">9:16</span>
                      <span className="text-[10px] uppercase text-muted-foreground">Story / Reels</span>
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-xs text-primary text-center">
                    El proceso tarda entre 2 y 4 minutos. Recibirás una notificación cuando termine.
                  </p>
                </div>

                <Button className="w-full py-8 text-xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-xl shadow-purple-900/20" onClick={handleUnifiedProcess} disabled={!referenceImage || artistPhotos.length === 0 || isSubmitting}>
                  {status === 'processing' || status === 'waiting' || status === 'uploading' ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>{status === 'uploading' ? 'Subiendo...' : 'Procesando...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6" />
                      <span>{testCredits > 0 ? 'Generar (Prueba)' : `Generar Flyer (${creditCost} cr)`}</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : flyerScreen === 'motion' ? (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
            <Button variant="ghost" onClick={() => setFlyerScreen('choose')} className="self-start gap-2 text-white">
              <ArrowLeft className="w-4 h-4" /> Volver
            </Button>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">Flyer Animado</h2>
              <p className="text-muted-foreground">Transforma tu imagen en un video profesional</p>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                <Label className="text-white font-bold">1. Selecciona tu Flyer Estático</Label>
                {motionSourceImage ? (
                  <div className="relative aspect-[3/4] w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-white/20">
                    <img src={motionSourceImage} className="w-full h-full object-cover" alt="Source" />
                    <button onClick={() => setMotionSourceImage(null)} className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-40 flex flex-col gap-2 border-dashed border-white/20 bg-white/5 hover:border-primary" onClick={() => setShowPhotoLibrary(true)}>
                      <ImageIcon className="w-8 h-8 text-white/40" />
                      <span>Desde Biblioteca</span>
                    </Button>
                    <label className="h-40 flex flex-col gap-2 border-2 border-dashed border-white/20 bg-white/5 items-center justify-center cursor-pointer hover:border-primary transition-all">
                      <Upload className="w-8 h-8 text-white/40" />
                      <span>Subir Imagen</span>
                      <input type="file" className="hidden" accept="image/*" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) setMotionSourceImage(await uploadToStorage(file, 'motion-source'));
                      }} />
                    </label>
                  </div>
                )}
              </div>

              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                <Label className="text-white font-bold text-lg">2. Configuración de Animación</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-1">
                      <span className="text-white font-bold">Resolución HD (720p)</span>
                      <p className="text-xs text-muted-foreground">Video más nítido y profesional</p>
                    </div>
                    <Switch checked={motionResolution === '720p'} onCheckedChange={checked => setMotionResolution(checked ? '720p' : '480p')} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white">Añadir Audio (Opcional)</Label>
                    <Input type="file" accept="audio/*" onChange={e => setMotionAudioFile(e.target.files?.[0] || null)} className="bg-white/10 border-white/10 text-white" />
                  </div>
                </div>
              </div>

              <Button className="w-full py-8 text-xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-xl shadow-purple-900/20" onClick={handleMotionProcess} disabled={!motionSourceImage || isSubmitting}>
                {motionStatus === 'processing' || motionStatus === 'waiting' ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Animando Flyer...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6" />
                    <span>Generar Animación ({getSeedanceTotalCost('standard', motionResolution, motionAudioFile ? 'r2v' : 'i2v', 10, 'flyer_motion')} cr)</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 items-center justify-center py-12">
            <h2 className="text-2xl font-bold text-white">¡Resultado Listo!</h2>
            <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              {flyerScreen === 'motion-result' ? (
                <video src={motionVideoUrl!} controls autoPlay loop className="w-full" />
              ) : (
                <img src={outputImage!} className="w-full" alt="Resultado" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <Button className="py-6 bg-green-600 text-white font-bold" onClick={() => download({ url: (flyerScreen === 'motion-result' ? motionVideoUrl : outputImage)!, filename: 'flyer-arcano' })}>
                <Download className="w-4 h-4 mr-2" /> Descargar
              </Button>
              <Button variant="outline" className="py-6 text-white border-white/20" onClick={() => { setFlyerScreen('choose'); setStatus('idle'); setMotionStatus('idle'); }}>
                <RefreshCw className="w-4 h-4 mr-2" /> Crear Otro
              </Button>
            </div>
          </div>
        )}
      </div>

      <FlyerLibraryModal isOpen={showPhotoLibrary} onClose={() => setShowPhotoLibrary(false)} onSelectPhoto={url => {
        if (flyerScreen === 'motion') setMotionSourceImage(url);
        else setReferenceImage(url);
      }} />
      <FlyerMakerTutorialModal open={showTutorial} onClose={() => { setShowTutorial(false); localStorage.setItem("flyer-maker-tutorial-seen", "true"); }} />
      <NoCreditsModal isOpen={showNoCreditsModal} onClose={() => setShowNoCreditsModal(false)} reason="insufficient" />
    </AppLayout>
  );
};

export default FlyerMakerTool;
