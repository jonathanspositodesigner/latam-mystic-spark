import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Scissors, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
const GLOBAL_TIMEOUT_MS = 60000;

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

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
    const buf = rightInt ? encoder.encodeBuffer(leftChunk, rightInt.subarray(i, i + blockSize)) : encoder.encodeBuffer(leftChunk);
    if (buf.length > 0) mp3Chunks.push(buf);
  }
  const flushBuf = encoder.flush();
  if (flushBuf.length > 0) mp3Chunks.push(flushBuf);
  return new File(mp3Chunks as BlobPart[], `trimmed-audio-${Date.now()}.mp3`, { type: 'audio/mpeg' });
}

const MediaTrimModal: React.FC<MediaTrimModalProps> = ({ isOpen, onClose, mediaFile, mediaDuration, onSave }) => {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const isAudio = mediaFile?.type.startsWith('audio/');
  const [range, setRange] = useState<[number, number]>([0, Math.min(MAX_TRIM_DURATION, mediaDuration)]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPreviewTime, setCurrentPreviewTime] = useState(0);
  const abortRef = useRef(false);

  useEffect(() => {
    if (isOpen && mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setMediaUrl(url);
      setRange([0, Math.min(MAX_TRIM_DURATION, mediaDuration)]);
      setCurrentPreviewTime(0);
      setProgress(0);
      abortRef.current = false;
      return () => URL.revokeObjectURL(url);
    }
  }, [isOpen, mediaFile, mediaDuration]);

  const handleRangeChange = useCallback((newValues: number[]) => {
    const [newStart, newEnd] = newValues as [number, number];
    let adjustedStart = newStart;
    let adjustedEnd = newEnd;
    if (newEnd - newStart > MAX_TRIM_DURATION) {
      if (newStart !== range[0]) {
        adjustedEnd = Math.min(mediaDuration, newStart + MAX_TRIM_DURATION);
        adjustedStart = Math.max(0, adjustedEnd - MAX_TRIM_DURATION);
      } else {
        adjustedStart = Math.max(0, newEnd - MAX_TRIM_DURATION);
        adjustedEnd = Math.min(mediaDuration, adjustedStart + MAX_TRIM_DURATION);
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
      if (currentTime >= range[1]) mediaRef.current.currentTime = range[0];
    }
  }, [range]);

  const handleSave = async () => {
    setIsProcessing(true);
    setProgress(0);
    abortRef.current = false;
    try {
      const [startTime, endTime] = range;
      const duration = endTime - startTime;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(mediaUrl!);
      const arrayBuffer = await response.arrayBuffer();
      const fullBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      const sampleRate = fullBuffer.sampleRate;
      const startOffset = Math.floor(startTime * sampleRate);
      const endOffset = Math.floor(endTime * sampleRate);
      const frameCount = endOffset - startOffset;
      
      const trimmedBuffer = audioCtx.createBuffer(fullBuffer.numberOfChannels, frameCount, sampleRate);
      for (let i = 0; i < fullBuffer.numberOfChannels; i++) {
        const channelData = fullBuffer.getChannelData(i);
        const trimmedData = trimmedBuffer.getChannelData(i);
        trimmedData.set(channelData.subarray(startOffset, endOffset));
      }
      
      const mp3File = encodeAudioBufferToMp3(trimmedBuffer);
      audioCtx.close();
      
      onSave(mp3File, { width: 0, height: 0, duration });
      onClose();
    } catch (error) {
      console.error('Error trimming media:', error);
      toast.error("Error al recortar el archivo");
    } finally {
      setIsProcessing(false);
    }
  };

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
            {mediaUrl && (isAudio ? (
              <audio ref={mediaRef as any} src={mediaUrl} className="w-full" onTimeUpdate={handleTimeUpdate} controls />
            ) : (
              <video ref={mediaRef} src={mediaUrl} className="w-full max-h-[300px] object-contain" onTimeUpdate={handleTimeUpdate} muted playsInline controls />
            ))}
            <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
              {formatTime(currentPreviewTime)} / {formatTime(mediaDuration)}
            </div>
          </div>
          <div className="space-y-3 px-2">
            <p className="text-sm text-muted-foreground">Selecciona hasta {MAX_TRIM_DURATION} segundos:</p>
            <div className="py-4"><Slider value={range} onValueChange={handleRangeChange} min={0} max={mediaDuration} step={0.1} className="w-full" /></div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">0s</span>
              <div className="bg-accent/20 px-3 py-1.5 rounded-full text-foreground font-medium">
                {formatTime(range[0])} → {formatTime(range[1])}
                <span className={cn("ml-2 px-2 py-0.5 rounded text-[10px] font-bold", (range[1] - range[0]) <= MAX_TRIM_DURATION ? "bg-green-500/30 text-green-300" : "bg-red-500/30 text-red-300")}>
                  {(range[1] - range[0]).toFixed(1)}s
                </span>
              </div>
              <span className="text-muted-foreground">{formatTime(mediaDuration)}</span>
            </div>
          </div>
          <Button className="w-full py-6 bg-gradient-to-r from-purple-600 to-fuchsia-600" onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</> : "Guardar recorte"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaTrimModal;
