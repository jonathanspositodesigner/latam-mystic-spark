import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Download, Loader2, ImageIcon, RefreshCw, Upload, ArrowLeft, Film, Play, GraduationCap, XCircle, AlertTriangle, Wand2, Trash2, Plus, Coins, Lock } from 'lucide-react';
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
import CreativitySlider from '@/components/arcano-cloner/CreativitySlider';
import FlyerMakerTutorialModal from '@/components/flyer-maker/FlyerMakerTutorialModal';
import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { getAIErrorMessage } from '@/utils/errorMessages';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import { useCollaboratorAttribution } from '@/hooks/useCollaboratorAttribution';
import { getSeedanceTotalCost } from '@/config/seedance-pricing';
import { isAcceptedImage, ensureBrowserCompatibleImage, IMAGE_ACCEPT } from '@/lib/heicConverter';
import { optimizeForAI } from '@/hooks/useImageOptimizer';

import flyerTypeEvento from '@/assets/flyer-type-evento.webp';
import flyerTypeAgenda from '@/assets/flyer-type-agenda.webp';
import flyerTypeContrate from '@/assets/flyer-type-contrate.webp';
import flyerTypeOutro from '@/assets/flyer-type-outro.jpg';
import flyerPreview from '@/assets/flyer-preview.webp';

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
  
  const { registerJob } = useAIJobContext();
  const { referencePromptId } = useCollaboratorAttribution();

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
  const [creativity, setCreativity] = useState(0);
  const [imageSize, setImageSize] = useState<'3:4' | '9:16'>('3:4');

  const [motionSourceImage, setMotionSourceImage] = useState<string | null>(null);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [motionStatus, setMotionStatus] = useState<ProcessingStatus>('idle');

  const { isSubmitting, startSubmit, endSubmit } = useProcessingButton();
  const { download } = useResilientDownload();
  const sessionIdRef = useRef(crypto.randomUUID());

  useQueueSessionCleanup(sessionIdRef.current, status);

  const handleReset = () => {
    setReferenceImage(null);
    setReferenceFile(null);
    setOutputImage(null);
    setStatus('idle');
  };

  return (
    <AppLayout>
      <div className="h-full flex flex-col p-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-5 overflow-y-auto">
            <h1 className="text-xl font-bold text-foreground">Flyer Maker</h1>
            {flyerScreen === 'choose' ? (
              <div className="flex flex-col gap-4 py-8">
                <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => setFlyerScreen('static-type')}>
                  <ImageIcon className="w-8 h-8 text-primary mb-2" />
                  <h3 className="font-bold text-white">Flyer Estático</h3>
                </Card>
                <Card className="p-4 cursor-pointer hover:border-purple-500" onClick={() => setFlyerScreen('motion')}>
                  <Film className="w-8 h-8 text-purple-500 mb-2" />
                  <h3 className="font-bold text-white">Flyer Animado</h3>
                </Card>
              </div>
            ) : flyerScreen === 'static-type' ? (
              <div className="flex flex-col gap-4 py-4">
                 <button onClick={() => setFlyerScreen('choose')} className="flex items-center text-xs text-muted-foreground mb-4">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                </button>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'evento', label: 'Evento', img: flyerTypeEvento },
                    { id: 'agenda', label: 'Agenda', img: flyerTypeAgenda },
                    { id: 'contrate', label: 'Contrate', img: flyerTypeContrate },
                    { id: 'outro', label: 'Personalizado', img: flyerTypeOutro },
                  ].map(t => (
                    <button key={t.id} onClick={() => { setFlyerType(t.id as any); setFlyerScreen('static-controls'); }} className="group">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border group-hover:border-primary">
                        <img src={t.img} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs font-bold mt-2 block">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                 <button onClick={() => setFlyerScreen('static-type')} className="flex items-center text-xs text-muted-foreground">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Cambiar Categoría
                </button>
                <ReferenceImageCard 
                    image={referenceImage} 
                    onClearImage={() => { setReferenceImage(null); setReferenceFile(null); }} 
                    onOpenLibrary={() => setShowPhotoLibrary(true)} 
                />
                <Input placeholder="Título del evento" value={title} onChange={e => setTitle(e.target.value)} />
                <Button className="w-full" onClick={() => toast.info('Procesando...')}>Generar Flyer</Button>
              </div>
            )}
          </div>
          <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-5 flex items-center justify-center">
            {outputImage ? (
              <img src={outputImage} className="max-w-full rounded-xl" />
            ) : (
              <div className="text-muted-foreground text-sm">El flyer aparecerá aquí</div>
            )}
          </div>
        </div>
      </div>
      <FlyerLibraryModal isOpen={showPhotoLibrary} onClose={() => setShowPhotoLibrary(false)} onSelectPhoto={(url) => setReferenceImage(url)} />
    </AppLayout>
  );
};

export default FlyerMakerTool;
