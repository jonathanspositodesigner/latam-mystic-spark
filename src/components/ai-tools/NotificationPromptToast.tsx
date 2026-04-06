/**
 * NotificationPromptToast — Asks user to enable browser notifications
 * Shows once per session when a job starts processing
 */
import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  toolName?: string;
  className?: string;
}

const NotificationPromptToast = ({ toolName = 'Upscaler Arcano' }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if notifications are supported and not yet granted/denied
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    
    const dismissed = sessionStorage.getItem('notification_prompt_dismissed');
    if (dismissed) return;

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('¡Notificaciones activadas! Te avisaremos cuando tu imagen esté lista.');
      }
    } catch (e) {
      console.error('Notification permission error:', e);
    }
    setVisible(false);
    sessionStorage.setItem('notification_prompt_dismissed', 'true');
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('notification_prompt_dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-card border border-border rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-4">
      <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-lg shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            ¿Activar notificaciones?
          </p>
          <p className="text-xs text-muted-foreground">
            Te avisamos cuando {toolName} termine de procesar tu imagen, incluso si cierras la pestaña.
          </p>
          <Button size="sm" onClick={handleEnable} className="h-7 text-xs">
            Activar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPromptToast;
