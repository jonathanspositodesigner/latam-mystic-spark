import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Download, Loader2, ImageIcon, RefreshCw, Upload, ArrowLeft, Film, Play, GraduationCap, XCircle, AlertTriangle, Wand2, Trash2, Plus, Coins, Lock, Settings, Zap, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import FlyerMakerTutorialModal from '@/components/flyer-maker/FlyerMakerTutorialModal';
import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import { useCollaboratorAttribution } from '@/hooks/useCollaboratorAttribution';
import { isAcceptedImage, ensureBrowserCompatibleImage, IMAGE_ACCEPT } from '@/lib/heicConverter';
import { optimizeForAI } from '@/hooks/useImageOptimizer';
import { cancelJob as centralCancelJob, checkActiveJob } from '@/ai/JobManager';

import flyerTypeEvento from '@/assets/flyer-type-evento.webp';
import flyerTypeAgenda from '@/assets/flyer-type-agenda.webp';
import flyerTypeContrate from '@/assets/flyer-type-contrate.webp';
import flyerTypeOutro from '@/assets/flyer-type-outro.jpg';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'waiting' | 'completed' | 'error';
type FlyerScreen = 'choose' | 'static-type' | 'static-controls' | 'motion' | 'motion-result';

const FlyerMakerTool: React.FC = () => {
  const navigate = useNavigate();
  const { user } = usePremiumStatus();
  const { balance: credits, refetch: refetchCredits } = useCredits();
  const { getCreditCost } = useAIToolSettings();
  const creditCost = getCreditCost('Flyer Maker', 100);
  
  const [flyerType, setFlyerType] = useState<'evento' | 'agenda' | 'contrate' | 'outro' | null>(null);
  const [flyerScreen, setFlyerScreen] = useState<FlyerScreen>('choose');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(!localStorage.getItem("flyer-maker-tutorial-seen"));

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dateTimeLocation, setDateTimeLocation] = useState('');
  const [address, setAddress] = useState('');
  const [footerPromo, setFooterPromo] = useState('');
  const [creativity, setCreativity] = useState(0);
  const [imageSize, setImageSize] = useState<'3:4' | '9:16'>('3:4');

  const [artistPhotos, setArtistPhotos] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(null);

  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();
  const { download } = useResilientDownload();
  const sessionIdRef = useRef(crypto.randomUUID());

  useQueueSessionCleanup(sessionIdRef.current, status);

  const handleGenerate = async () => {
    if (!referenceImage) {
      toast.error("Por favor, selecciona una imagen de referencia.");
      return;
    }
    if (!startSubmit()) return;
    
    setStatus('uploading');
    try {
      const response = await supabase.functions.invoke('runninghub-flyer-maker', {
        body: {
          jobId: crypto.randomUUID(),
          flyerSubType: flyerType,
          referenceImageUrl: referenceImage,
          title,
          dateTimeLocation,
          address,
          footerPromo,
          creativity,
          imageSize,
          creditCost
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      setStatus('processing');
      toast.success("Flyer en proceso...");
    } catch (err: any) {
      toast.error("Error al generar: " + err.message);
      endSubmit();
      setStatus('idle');
    }
  };

  return (
    <AppLayout fullScreen>
      <div className="h-full flex flex-col p-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-4 bg-[#1A0A2E] border border-purple-500/20 rounded-2xl p-5 flex flex-col gap-5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">Flyer Maker</h1>
              <Button variant="ghost" size="sm" onClick={() => setShowTutorial(true)}>
                <Play className="w-4 h-4 mr-2" /> Tutorial
              </Button>
            </div>

            {flyerScreen === 'choose' ? (
              <div className="flex flex-col gap-4 py-8">
                <Card className="p-4 cursor-pointer hover:border-purple-500 bg-black/20 border-purple-500/30" onClick={() => setFlyerScreen('static-type')}>
                  <ImageIcon className="w-8 h-8 text-purple-400 mb-2" />
                  <h3 className="font-bold text-white">Flyer Estático</h3>
                  <p className="text-xs text-gray-400">Crea diseños profesionales para redes sociales.</p>
                </Card>
                <Card className="p-4 cursor-pointer hover:border-fuchsia-500 bg-black/20 border-fuchsia-500/30" onClick={() => setFlyerScreen('motion')}>
                  <Film className="w-8 h-8 text-fuchsia-400 mb-2" />
                  <h3 className="font-bold text-white">Flyer Animado</h3>
                  <p className="text-xs text-gray-400">Dale vida a tus eventos con movimiento.</p>
                </Card>
              </div>
            ) : flyerScreen === 'static-type' ? (
              <div className="flex flex-col gap-4 py-4">
                 <button onClick={() => setFlyerScreen('choose')} className="flex items-center text-xs text-gray-400 mb-4 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                </button>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'evento', label: 'Evento', img: flyerTypeEvento },
                    { id: 'agenda', label: 'Agenda', img: flyerTypeAgenda },
                    { id: 'contrate', label: 'Contrate', img: flyerTypeContrate },
                    { id: 'outro', label: 'Personalizado', img: flyerTypeOutro },
                  ].map(t => (
                    <button key={t.id} onClick={() => { setFlyerType(t.id as any); setFlyerScreen('static-controls'); }} className="group text-left">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden border border-purple-500/30 group-hover:border-purple-400">
                        <img src={t.img} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs font-bold mt-2 block text-white">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                 <button onClick={() => setFlyerScreen('static-type')} className="flex items-center text-xs text-gray-400 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Cambiar Categoría
                </button>
                <ReferenceImageCard 
                    image={referenceImage} 
                    onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }} 
                    onOpenLibrary={() => setShowPhotoLibrary(true)} 
                />
                <Input placeholder="Título del evento" value={title} onChange={e => setTitle(e.target.value)} className="bg-black/20 border-purple-500/30" />
                <Input placeholder="Fecha, hora y lugar" value={dateTimeLocation} onChange={e => setDateTimeLocation(e.target.value)} className="bg-black/20 border-purple-500/30" />
                <Button className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600" onClick={handleGenerate} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Flyer"}
                </Button>
              </div>
            )}
          </div>
          
          <div className="lg:col-span-8 bg-black/40 border border-purple-500/20 rounded-2xl p-5 flex items-center justify-center">
            {outputImage ? (
              <img src={outputImage} className="max-w-full max-h-full rounded-xl shadow-2xl" />
            ) : (
              <div className="text-center text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Tu flyer aparecerá aquí</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <FlyerLibraryModal isOpen={showPhotoLibrary} onClose={() => setShowPhotoLibrary(false)} onSelectPhoto={(url) => setReferenceImage(url)} />
      <FlyerMakerTutorialModal open={showTutorial} onClose={() => { setShowTutorial(false); localStorage.setItem("flyer-maker-tutorial-seen", "true"); }} />
    </AppLayout>
  );
};

export default FlyerMakerTool;
