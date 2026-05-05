import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface FlyerMakerTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const YOUTUBE_ID = "uX1oXFs9gNk";

const FlyerMakerTutorialModal = ({ open, onClose }: FlyerMakerTutorialModalProps) => {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleClose = () => {
    setPlaying(false);
    onClose();
  };

  const handlePlay = useCallback(() => {
    setPlaying(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl p-0 bg-background border-border overflow-hidden rounded-2xl">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-1">Tutorial — Flyer Maker</h2>
          <p className="text-sm text-muted-foreground mb-4">Aprende a usar la herramienta viendo el video a continuación:</p>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            {playing ? (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1`}
                title="Tutorial Flyer Maker"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            ) : (
              <button onClick={handlePlay} className="absolute inset-0 w-full h-full flex items-center justify-center bg-muted/50">
                <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-9 w-9 text-black ml-1" fill="black" />
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="p-6 pt-0">
          <Button onClick={handleClose} className="w-full bg-gradient-to-r from-purple-700 to-purple-500 text-white font-semibold">
            Continuar a la herramienta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlyerMakerTutorialModal;