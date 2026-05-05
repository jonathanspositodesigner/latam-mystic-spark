import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Scissors, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

const MediaTrimModal: React.FC<MediaTrimModalProps> = ({
  isOpen,
  onClose,
  mediaFile,
  mediaDuration,
  onSave,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Recortar Audio
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 text-center">
          <p>Módulo de recorte de audio en desarrollo.</p>
          <Button onClick={onClose} className="mt-4">Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaTrimModal;