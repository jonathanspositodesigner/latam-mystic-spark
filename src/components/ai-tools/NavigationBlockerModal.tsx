import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface NavigationBlockerModalProps {
  open: boolean;
  toolName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const NavigationBlockerModal = ({ open, toolName, onConfirm, onCancel }: NavigationBlockerModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="bg-[#1A0A2E] border-purple-500/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Procesamiento en curso
          </DialogTitle>
          <DialogDescription className="text-purple-200/80">
            {toolName ? `${toolName} está procesando tu imagen.` : 'Tienes un procesamiento en curso.'}
            {' '}Si sales ahora, perderás los créditos utilizados y el resultado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="border-purple-500/30">
            Quedarme
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Salir de todos modos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NavigationBlockerModal;
