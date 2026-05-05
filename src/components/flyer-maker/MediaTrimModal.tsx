import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Scissors, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Mp3Encoder } from '@breezystack/lamejs';

 interface MediaMetadata {
   width: number;
   height: number;
   duration: number;
 }

 interface MediaTrimModalProps {
   isOpen: boolean;
   onClose: () => void;
   mediaFile: File;
   mediaDuration: number;
   onSave: (trimmedFile: File, metadata: MediaMetadata) => void;
 }

const MAX_TRIM_DURATION = 10;
const GLOBAL_TIMEOUT_MS = 60000; // 60s timeout máximo

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

// Codifica um AudioBuffer (PCM float) em um arquivo MP3 real (audio/mpeg) usando lamejs.
// Isso é o que a Evolink Seedance 2.0 Reference-to-Video exige (.mp3 ou .wav).
function encodeAudioBufferToMp3(audioBuffer: AudioBuffer): File {
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 128;
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const left = audioBuffer.getChannelData(0);
  const right = channels === 2 ? audioBuffer.getChannelData(1) : null;

  const len = left.length;
  const leftInt = new Int16Array(len);
  const rightInt = right ? new Int16Array(len) : null;
  for (let i = 0; i < len; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    leftInt[i] = l < 0 ? l * 0x8000 : l * 0x7fff;
    if (right && rightInt) {
      const r = Math.max(-1, Math.min(1, right[i]));
      rightInt[i] = r < 0 ? r * 0x8000 : r * 0x7fff;
    }
  }

  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];
  for (let i = 0; i < len; i += blockSize) {
    const leftChunk = leftInt.subarray(i, i + blockSize);
    const buf = rightInt
      ? encoder.encodeBuffer(leftChunk, rightInt.subarray(i, i + blockSize))
      : encoder.encodeBuffer(leftChunk);
    if (buf.length > 0) mp3Chunks.push(buf);
  }
  const flushBuf = encoder.flush();
  if (flushBuf.length > 0) mp3Chunks.push(flushBuf);

  const file = new File(mp3Chunks as BlobPart[], `trimmed-audio-${Date.now()}.mp3`, { type: 'audio/mpeg' });
  (file as any).__mp3Meta = { sampleRate, channels };
  return file;
}

interface AudioInfo {
  format: string;
  size: string;
  duration: string;
  codec?: string;
  sampleRate?: string;
  channels?: string;
}

 const getSupportedMimeType = (type: 'video' | 'audio'): string | null => {
   const videoTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
   const audioTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/wav'];
   const types = type === 'video' ? videoTypes : audioTypes;
   for (const t of types) {
     if (MediaRecorder.isTypeSupported(t)) return t;
   }
   return type === 'video' ? 'video/webm' : 'audio/webm';
 };

 const MediaTrimModal: React.FC<MediaTrimModalProps> = ({
   isOpen,
   onClose,
   mediaFile,
   mediaDuration,
   onSave,
 }) => {
   const mediaRef = useRef<HTMLVideoElement>(null);
   const [mediaUrl, setMediaUrl] = useState<string | null>(null);
   const isAudio = mediaFile?.type.startsWith('audio/');
   const [range, setRange] = useState<[number, number]>([0, Math.min(MAX_TRIM_DURATION, mediaDuration)]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPreviewTime, setCurrentPreviewTime] = useState(0);
  const abortRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [trimmedAudioInfo, setTrimmedAudioInfo] = useState<AudioInfo | null>(null);
  const [trimmedAudioUrl, setTrimmedAudioUrl] = useState<string | null>(null);
  const [lastTrimmedFile, setLastTrimmedFile] = useState<File | null>(null);
  const [lastMetadata, setLastMetadata] = useState<MediaMetadata | null>(null);

  useEffect(() => {
     if (isOpen && mediaFile) {
       const url = URL.createObjectURL(mediaFile);
       setMediaUrl(url);
        setRange([0, Math.min(MAX_TRIM_DURATION, mediaDuration)]);
        setCurrentPreviewTime(0);
        setProgress(0);
        setTrimmedAudioInfo(null);
        setTrimmedAudioUrl(null);
        setLastTrimmedFile(null);
        setLastMetadata(null);
        abortRef.current = false;
        return () => URL.revokeObjectURL(url);
     }
   }, [isOpen, mediaFile, mediaDuration]);

   const handleRangeChange = useCallback((newValues: number[]) => {
     const [newStart, newEnd] = newValues as [number, number];
     const currentStart = range[0];
     const currentEnd = range[1];
     let adjustedStart = newStart;
     let adjustedEnd = newEnd;

     if (newEnd - newStart > MAX_TRIM_DURATION) {
       if (newStart !== currentStart) {
         adjustedEnd = newStart + MAX_TRIM_DURATION;
         if (adjustedEnd > mediaDuration) {
           adjustedEnd = mediaDuration;
           adjustedStart = adjustedEnd - MAX_TRIM_DURATION;
         }
       } else if (newEnd !== currentEnd) {
         adjustedStart = newEnd - MAX_TRIM_DURATION;
         if (adjustedStart < 0) {
           adjustedStart = 0;
           adjustedEnd = MAX_TRIM_DURATION;
         }
       }
     }
     setRange([adjustedStart, adjustedEnd]);
     if (mediaRef.current) {
       mediaRef.current.currentTime = adjustedStart;
       setCurrentPreviewTime(adjustedStart);
     }
   }, [range, mediaDuration]);

   const handleTimeUpdate = useCallback(() => {
     if (mediaRef.current) {
       const currentTime = mediaRef.current.currentTime;
       setCurrentPreviewTime(currentTime);
       if (currentTime >= range[1]) {
         mediaRef.current.currentTime = range[0];
       }
     }
   }, [range]);

    const trimMediaPlayback = useCallback(async (): Promise<File> => {
      // Force audio mime type even for video inputs to extract only audio
      const mimeType = getSupportedMimeType('audio');
      if (!mimeType) {
      throw new Error('Tu navegador no admite la exportación de video. Usa Chrome o Edge.');
    }

    const [startTime, endTime] = range;
    const duration = endTime - startTime;

    return new Promise((resolve, reject) => {
       const media = document.createElement(isAudio ? 'audio' : 'video');
       const mediaSrc = URL.createObjectURL(mediaFile);
       media.src = mediaSrc;
       media.muted = false;
       if (media instanceof HTMLVideoElement) media.playsInline = true;
       media.preload = 'auto';

      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let animationId: number | null = null;
      let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;

      const cleanup = () => {
        if (animationId) cancelAnimationFrame(animationId);
         if (safetyTimeout) clearTimeout(safetyTimeout);
         media.pause();
         if (stream) {
           stream.getTracks().forEach(t => t.stop());
         }
         URL.revokeObjectURL(mediaSrc);
       };

      cleanupRef.current = cleanup;

       const finishRecording = (chunks: Blob[]) => {
         if (resolved) return;
         resolved = true;
         cleanup();
          const blob = new Blob(chunks, { type: mimeType });
          (async () => {
            try {
              const arrayBuffer = await blob.arrayBuffer();
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
              const mp3File = encodeAudioBufferToMp3(audioBuffer);
              audioCtx.close().catch(() => {});
              resolve(mp3File);
            } catch (e) {
              console.error('[MediaTrim] Falha ao codificar MP3:', e);
              reject(new Error('Error al codificar el MP3 del audio recortado.'));
            }
          })();
       };

       media.onloadedmetadata = async () => {
         try {
           media.currentTime = startTime;
           await new Promise<void>((res, rej) => {
             const timeout = setTimeout(() => rej(new Error('Seek timeout')), 5000);
             media.onseeked = () => {
               clearTimeout(timeout);
               res();
             };
           });

          if (abortRef.current) {
            cleanup();
            reject(new Error('Cancelado'));
            return;
          }

            let stream: MediaStream | null = null;
            if ((media as any).captureStream) {
              stream = (media as any).captureStream();
            } else if ((media as any).mozCaptureStream) {
              stream = (media as any).mozCaptureStream();
            }

            if (!stream) throw new Error('captureStream no compatible');

            // Ensure only audio tracks are captured from the stream
            const audioStream = new MediaStream(stream.getAudioTracks());
            if (audioStream.getAudioTracks().length === 0) {
              // Fallback to the whole stream if no audio tracks (unlikely for video with sound)
              recorder = new MediaRecorder(stream, { mimeType });
            } else {
              recorder = new MediaRecorder(audioStream, { mimeType });
            }
          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            finishRecording(chunks);
          };

          recorder.onerror = (e) => {
            cleanup();
            reject(new Error('Error en MediaRecorder'));
          };

           recorder.start(100);
           await media.play();
           const checkTime = () => {
             if (abortRef.current) {
               recorder?.stop();
               return;
             }
             const currentTime = media.currentTime;
             const progressPercent = Math.min(100, ((currentTime - startTime) / duration) * 100);
             setProgress(Math.round(progressPercent));
             if (currentTime >= endTime - 0.05) {
               media.pause();
               recorder?.stop();
             } else {
               animationId = requestAnimationFrame(checkTime);
             }
           };
           animationId = requestAnimationFrame(checkTime);
           safetyTimeout = setTimeout(() => {
             if (!resolved) {
               media.pause();
               recorder?.stop();
             }
           }, (duration + 2) * 1000);
         } catch (error) {
           cleanup();
           reject(error);
         }
       };
       media.onerror = () => {
         cleanup();
         reject(new Error('Error al cargar el archivo'));
       };
     });
   }, [mediaFile, range, isAudio]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    if (cleanupRef.current) {
      cleanupRef.current();
    }
    setIsProcessing(false);
    setProgress(0);
  }, []);

   const handleSave = async () => {
     setIsProcessing(true);
     setProgress(0);
     abortRef.current = false;
     try {
       const timeoutPromise = new Promise<never>((_, reject) => {
         setTimeout(() => reject(new Error('Tiempo de espera agotado')), GLOBAL_TIMEOUT_MS);
       });
       const trimmedFile = await Promise.race([
         trimMediaPlayback(),
         timeoutPromise,
       ]);
       if (abortRef.current) return;
        // Force using audio context/recorder for extraction
        const media = document.createElement(isAudio ? 'audio' : 'video');
       const tempUrl = URL.createObjectURL(trimmedFile);
       media.src = tempUrl;
       await new Promise<void>((resolve, reject) => {
         const timeout = setTimeout(() => {
           URL.revokeObjectURL(tempUrl);
           reject(new Error('Tiempo de espera agotado al leer los metadatos'));
         }, 5000);
          media.onloadedmetadata = () => {
            clearTimeout(timeout);
            const metadata: MediaMetadata = {
              width: (media as any).videoWidth || 0,
              height: (media as any).videoHeight || 0,
              duration: media.duration,
            };

            const meta = (trimmedFile as any).__mp3Meta as { sampleRate?: number; channels?: number } | undefined;
            setTrimmedAudioInfo({
              format: 'MP3 (audio/mpeg)',
              codec: 'MPEG-1 Layer III · 128 kbps',
              size: `${(trimmedFile.size / 1024).toFixed(1)} KB`,
              duration: `${media.duration.toFixed(2)}s`,
              sampleRate: meta?.sampleRate ? `${meta.sampleRate} Hz` : undefined,
              channels: meta?.channels ? (meta.channels === 1 ? 'Mono' : 'Estéreo') : undefined,
            });
            setTrimmedAudioUrl(tempUrl);
            setLastTrimmedFile(trimmedFile);
            setLastMetadata(metadata);

            resolve();
          };
          media.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(tempUrl);
            reject(new Error('Error al leer el archivo recortado'));
          };
        });
     } catch (error) {
       console.error('Error trimming media:', error);
       if (!abortRef.current) {
         toast({
           title: "Error al recortar el archivo",
           description: error instanceof Error ? error.message : "Inténtalo de nuevo",
           variant: "destructive",
         });
       }
     } finally {
       setIsProcessing(false);
       setProgress(0);
     }
   };

  const selectedDuration = range[1] - range[0];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2 text-foreground">
             <Scissors className="w-5 h-5 text-muted-foreground" />
             {isAudio ? 'Recortar Audio' : 'Recortar Video'}
           </DialogTitle>
         </DialogHeader>

         <div className="space-y-4">
           <div className="relative bg-muted rounded-lg overflow-hidden flex flex-col items-center justify-center min-h-[150px]">
             {mediaUrl && (
               isAudio ? (
                 <div className="flex flex-col items-center justify-center p-8 gap-4 w-full">
                   <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                     <Scissors className="w-8 h-8 text-secondary" />
                   </div>
                   <audio
                     ref={mediaRef as any}
                     src={mediaUrl}
                     className="w-full"
                     onTimeUpdate={handleTimeUpdate}
                     controls
                   />
                 </div>
               ) : (
                 <video
                   ref={mediaRef}
                   src={mediaUrl}
                   className="w-full max-h-[300px] object-contain"
                   onTimeUpdate={handleTimeUpdate}
                   muted
                   playsInline
                   controls
                 />
               )
             )}

             <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-foreground">
               {formatTime(currentPreviewTime)} / {formatTime(mediaDuration)}
             </div>
           </div>

           <div className="space-y-3 px-2">
             <p className="text-sm text-muted-foreground">
               Selecciona hasta {MAX_TRIM_DURATION} segundos:
             </p>

             <div className="py-4">
               <Slider
                 value={range}
                 onValueChange={handleRangeChange}
                 min={0}
                 max={mediaDuration}
                 step={0.1}
                 className="w-full"
               />
             </div>

             <div className="flex items-center justify-between text-xs">
               <span className="text-muted-foreground">0s</span>
               <div className="flex items-center gap-2 bg-accent0/20 px-3 py-1.5 rounded-full">
                 <span className="text-foreground font-medium">
                   {formatTime(range[0])} → {formatTime(range[1])}
                 </span>
                 <span className={cn(
                   "px-2 py-0.5 rounded text-[10px] font-bold",
                   selectedDuration <= MAX_TRIM_DURATION
                     ? "bg-green-500/30 text-green-300"
                     : "bg-red-500/30 text-red-300"
                 )}>
                   {selectedDuration.toFixed(1)}s
                 </span>
               </div>
               <span className="text-muted-foreground">{formatTime(mediaDuration)}</span>
             </div>
           </div>

          {/* Progress bar during processing */}
          {isProcessing && (
            <div className="px-2">
              <div className="w-full bg-accent rounded-full h-2">
                <div
                  className="bg-accent0 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground mt-1">
                Procesando... {progress}%
              </p>
            </div>
          )}

          {/* Preview of trimmed audio and metadata */}
          {trimmedAudioInfo && (
            <div className="bg-muted/50 p-3 rounded-lg border border-border space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <p className="text-xs font-bold text-accent0 uppercase tracking-wider">Vista previa del audio recortado</p>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">Formato</span>
                  <span>{trimmedAudioInfo.format}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">Tamaño</span>
                  <span>{trimmedAudioInfo.size}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">Duración</span>
                  <span>{trimmedAudioInfo.duration}</span>
                </div>
                {trimmedAudioInfo.codec && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Codec</span>
                    <span>{trimmedAudioInfo.codec}</span>
                  </div>
                )}
                {trimmedAudioInfo.sampleRate && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Sample Rate</span>
                    <span>{trimmedAudioInfo.sampleRate}</span>
                  </div>
                )}
                {trimmedAudioInfo.channels && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Canales</span>
                    <span>{trimmedAudioInfo.channels}</span>
                  </div>
                )}
              </div>
              {trimmedAudioUrl && (
                <audio src={trimmedAudioUrl} controls className="w-full h-8 mt-2" />
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {isProcessing ? (
              <Button onClick={handleCancel} variant="outline" className="border-red-500/50 text-red-400">
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            ) : trimmedAudioInfo && lastTrimmedFile && lastMetadata ? (
              <>
                <Button onClick={() => { setTrimmedAudioInfo(null); setTrimmedAudioUrl(null); }} variant="outline">
                  Recortar de nuevo
                </Button>
                <Button
                  onClick={() => onSave(lastTrimmedFile, lastMetadata)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                >
                  Confirmar y usar audio
                </Button>
              </>
            ) : (
               <Button
                 onClick={handleSave}
                 disabled={selectedDuration > MAX_TRIM_DURATION}
                 className="bg-secondary hover:bg-secondary text-foreground px-6"
               >
                 <Scissors className="w-4 h-4 mr-2" />
                 Extraer Audio (MP3)
               </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

 export default MediaTrimModal;
