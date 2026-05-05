import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Download, Loader2, ZoomIn, ZoomOut, ImageIcon, XCircle, AlertTriangle, Coins, RefreshCw, Plus, Trash2, Upload, Wand2, ArrowLeft, Construction, Play, Film, Lock, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAIJobContext } from '@/contexts/AIJobContext';
import { useJobStatusSync } from '@/hooks/useJobStatusSync';
import { useQueueSessionCleanup } from '@/hooks/useQueueSessionCleanup';
import { useProcessingButton } from '@/hooks/useProcessingButton';
import { useResilientDownload } from '@/hooks/useResilientDownload';
import { useJobPendingWatchdog } from '@/hooks/useJobPendingWatchdog';
import { useAIToolSettings } from '@/hooks/useAIToolSettings';
import { optimizeForAI } from '@/hooks/useImageOptimizer';
import { isAcceptedImage, ensureBrowserCompatibleImage, IMAGE_ACCEPT } from '@/lib/heicConverter';
import { createJob, startJob, checkActiveJob } from '@/ai/JobManager';
import { ResilientImage } from '@/components/upscaler/ResilientImage';
import ReferenceImageCard from '@/components/arcano-cloner/ReferenceImageCard';
import CreativitySlider from '@/components/arcano-cloner/CreativitySlider';
import RefinePanel from '@/components/arcano-cloner/RefinePanel';
import RefinementTimeline, { type RefinementVersion } from '@/components/arcano-cloner/RefinementTimeline';
import NoCreditsModal from '@/components/upscaler/NoCreditsModal';
import ActiveJobBlockModal from '@/components/ai-tools/ActiveJobBlockModal';
import FlyerLibraryModal from '@/components/flyer-maker/FlyerLibraryModal';
import FlyerMakerTutorialModal from '@/components/flyer-maker/FlyerMakerTutorialModal';
import MediaTrimModal from '@/components/flyer-maker/MediaTrimModal';

const FlyerMakerTool: React.FC = () => {
  const [flyerScreen, setFlyerScreen] = useState<'choose' | 'static-type' | 'static-controls' | 'motion' | 'motion-result'>('choose');
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("flyer-maker-tutorial-seen"));

  const handleTutorialClose = () => {
    localStorage.setItem("flyer-maker-tutorial-seen", "true");
    setShowTutorial(false);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-fuchsia-500" />
            Flyer Maker
          </h1>
          <Badge variant="outline" className="bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20">BETA</Badge>
        </div>

        {flyerScreen === 'choose' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-accent/50 border-border hover:border-fuchsia-500/50 transition-all cursor-pointer" onClick={() => setFlyerScreen('static-type')}>
              <h3 className="text-xl font-bold mb-2">Flyer Estático</h3>
              <p className="text-muted-foreground mb-4 text-sm">Crea diseños profesionales a partir de referencias en segundos.</p>
              <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-700">Comenzar</Button>
            </Card>
            <Card className="p-6 bg-accent/50 border-border hover:border-purple-500/50 transition-all cursor-pointer opacity-50">
              <h3 className="text-xl font-bold mb-2">Flyer Motion</h3>
              <p className="text-muted-foreground mb-4 text-sm">Anima tus flyers estáticos con IA. (Próximamente)</p>
              <Button variant="secondary" className="w-full" disabled>Próximamente</Button>
            </Card>
          </div>
        )}

        {flyerScreen !== 'choose' && (
          <Button variant="ghost" onClick={() => setFlyerScreen('choose')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        )}

        {flyerScreen === 'static-type' && (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold mb-4">Selecciona el tipo de Flyer</h2>
            <p className="text-muted-foreground">Módulo de selección de tipo en desarrollo.</p>
          </div>
        )}
      </div>

      <FlyerMakerTutorialModal open={showTutorial} onClose={handleTutorialClose} />
    </AppLayout>
  );
};

export default FlyerMakerTool;