import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Sparkles, Download, RotateCcw, Loader2, AlertCircle, Clock, Coins, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAIJob } from '@/hooks/useAIJob';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import NavigationBlockerModal from '@/components/ai-tools/NavigationBlockerModal';
import AppLayout from '@/components/layout/AppLayout';
import { getToolConfig } from '@/ai/toolRegistry';

const QUEUE_MESSAGES = [
  { emoji: "🔥", title: "¡Está al máximo!", subtitle: "Relájate, ya casi es tu turno" },
  { emoji: "☕", title: "Hora del café", subtitle: "Aprovecha para descansar" },
  { emoji: "🚀", title: "Despegue pronto", subtitle: "¡Preparando tu foto para el espacio!" },
  { emoji: "⚡", title: "Alta demanda", subtitle: "Esto vuela, ya casi te toca" },
  { emoji: "✨", title: "Preparando tu magia", subtitle: "La calidad lleva su tiempo" },
];

const UpscalerArcanoTool: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance: credits, isLoading: creditsLoading, canAfford, formatBalance } = useCredits();
  const toolConfig = getToolConfig('upscaler');

  const {
    startProcessing,
    cancelProcessing,
    reset,
    status,
    outputUrl,
    errorMessage,
    isProcessing,
    isQueued,
    queuePosition,
    progress,
    isSubmitting,
  } = useAIJob({ toolId: 'upscaler' });

  const { showConfirmModal, confirmLeave, cancelLeave, activeToolName } = useNavigationGuard();

  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [queueComboIdx] = useState(() => Math.floor(Math.random() * QUEUE_MESSAGES.length));

  const handleFileSelect = useCallback((file: File) => {
    if (!(toolConfig.acceptedTypes as readonly string[]).includes(file.type)) {
      toast.error('Formato no soportado. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > toolConfig.maxFileSizeMB * 1024 * 1024) {
      toast.error(`Imagen demasiado grande. Máximo ${toolConfig.maxFileSizeMB}MB.`);
      return;
    }
    const url = URL.createObjectURL(file);
    setInputImage(url);
    setInputFile(file);
    reset();
  }, [toolConfig, reset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleProcess = useCallback(async () => {
    if (!inputFile || !user) return;
    await startProcessing(inputFile, { creditCost: toolConfig.creditCost });
  }, [inputFile, user, startProcessing, toolConfig.creditCost]);

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `upscaler-arcano-${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  }, [outputUrl]);

  const handleNewImage = useCallback(() => {
    if (inputImage?.startsWith('blob:')) URL.revokeObjectURL(inputImage);
    setInputImage(null);
    setInputFile(null);
    setSliderPosition(50);
    reset();
  }, [inputImage, reset]);

  // Slider drag logic
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(pct);
  }, []);

  useEffect(() => {
    return () => { if (inputImage?.startsWith('blob:')) URL.revokeObjectURL(inputImage); };
  }, [inputImage]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(270,60%,4%)] p-4 md:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Upscaler Arcano</h1>
            <p className="text-sm text-purple-300/70">Mejora la calidad de tus imágenes con IA</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-purple-900/50 border border-purple-500/30 rounded-lg px-3 py-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-purple-200">
                {creditsLoading ? '...' : formatBalance()}
              </span>
            </div>
          </div>
        </div>

        {/* Upload / Result Area */}
        {!inputImage ? (
          <Card
            className="border-2 border-dashed border-purple-500/30 bg-purple-900/10 hover:bg-purple-900/20 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Upload className="w-12 h-12 text-purple-400 mb-4" />
              <p className="text-lg font-medium text-purple-200 mb-1">Subir imagen</p>
              <p className="text-sm text-purple-300/60">Arrastra o haz clic para seleccionar</p>
              <p className="text-xs text-purple-300/40 mt-2">JPG, PNG o WebP • Máx. {toolConfig.maxFileSizeMB}MB</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Image display */}
            {status === 'completed' && outputUrl ? (
              /* Before/After Slider */
              <div
                ref={sliderRef}
                className="relative w-full aspect-square max-h-[500px] rounded-xl overflow-hidden border border-purple-500/30 select-none"
                onMouseDown={() => { isDraggingRef.current = true; }}
                onMouseUp={() => { isDraggingRef.current = false; }}
                onMouseMove={(e) => { if (isDraggingRef.current) handleSliderMove(e.clientX); }}
                onTouchMove={(e) => handleSliderMove(e.touches[0].clientX)}
              >
                <img src={outputUrl} alt="Resultado" className="absolute inset-0 w-full h-full object-contain" />
                <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                  <img src={inputImage} alt="Original" className="w-full h-full object-contain" />
                </div>
                <div className="absolute top-0 bottom-0" style={{ left: `${sliderPosition}%` }}>
                  <div className="w-0.5 h-full bg-white/80" />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <div className="w-4 h-4 border-l-2 border-r-2 border-purple-600" />
                  </div>
                </div>
                <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">Antes</div>
                <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">Después</div>
              </div>
            ) : (
              /* Input preview */
              <div className="relative w-full aspect-square max-h-[500px] rounded-xl overflow-hidden border border-purple-500/30">
                <img src={inputImage} alt="Input" className="w-full h-full object-contain" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                    {isQueued ? (
                      <div className="text-center">
                        <span className="text-4xl mb-2 block">{QUEUE_MESSAGES[queueComboIdx].emoji}</span>
                        <p className="text-lg font-bold text-white">{QUEUE_MESSAGES[queueComboIdx].title}</p>
                        <p className="text-purple-300 text-sm">Posición: {queuePosition}</p>
                        <p className="text-purple-300/60 text-xs mt-1">{QUEUE_MESSAGES[queueComboIdx].subtitle}</p>
                      </div>
                    ) : (
                      <>
                        <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                        <p className="text-white font-medium">Procesando...</p>
                        <div className="w-48 bg-purple-900/50 rounded-full h-2 mt-3">
                          <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-purple-300/60 text-xs mt-2">{progress}%</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {status === 'error' && errorMessage && (
              <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {status === 'idle' && (
                <>
                  <Button
                    onClick={handleProcess}
                    disabled={isSubmitting || !canAfford(toolConfig.creditCost)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Procesar ({toolConfig.creditCost} crédito{toolConfig.creditCost > 1 ? 's' : ''})
                  </Button>
                  <Button variant="outline" onClick={handleNewImage} className="border-purple-500/30">
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}

              {isProcessing && (
                <Button
                  onClick={cancelProcessing}
                  variant="outline"
                  className="flex-1 border-red-500/30 text-red-300 hover:bg-red-900/20"
                >
                  Cancelar
                </Button>
              )}

              {status === 'completed' && (
                <>
                  <Button onClick={handleDownload} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600">
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                  <Button variant="outline" onClick={handleNewImage} className="border-purple-500/30">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Nueva
                  </Button>
                </>
              )}

              {status === 'error' && (
                <>
                  <Button onClick={handleProcess} disabled={isSubmitting} className="flex-1 bg-gradient-to-r from-purple-600 to-fuchsia-600">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                  <Button variant="outline" onClick={handleNewImage} className="border-purple-500/30">
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={toolConfig.acceptedTypes.join(',')}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
        />

        {/* Navigation blocker */}
        <NavigationBlockerModal
          open={showConfirmModal}
          toolName={activeToolName}
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      </div>
    </AppLayout>
  );
};

export default UpscalerArcanoTool;
