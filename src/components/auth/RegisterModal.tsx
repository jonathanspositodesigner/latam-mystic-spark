import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import type { AuthState, SignupData } from "@/hooks/useAuthFlow";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  state: AuthState;
  onSignup: (data: SignupData) => void;
  onResend: () => void;
  onClearError: () => void;
}

const RegisterModal = ({ open, onClose, state, onSignup, onResend, onClearError }: RegisterModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(state.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync email from state
  useState(() => { setEmail(state.email); });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }
    onSignup({ email, password, name });
  };

  // Waiting confirmation view
  if (state.step === 'waiting-confirmation') {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md border-0 bg-[hsl(270,60%,6%)] p-8 rounded-2xl animate-scale-fade-in">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white">¡Revisa tu correo!</h3>
            <p className="text-white/50 text-sm">
              Te enviamos un enlace de confirmación a{' '}
              <span className="text-purple-300 font-medium">{state.verifiedEmail}</span>.
              <br />Revisa tu bandeja de entrada.
            </p>
            <Button
              variant="ghost"
              onClick={onResend}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            >
              Reenviar enlace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-0 bg-[hsl(270,60%,6%)] p-0 rounded-2xl overflow-hidden animate-scale-fade-in">
        {/* Header */}
        <div className="p-8 pb-0">
          <h3 className="text-xl font-bold text-white">Crear cuenta</h3>
          <p className="text-white/40 text-sm mt-1">Únete a la plataforma</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70 text-sm">Nombre</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="pl-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 h-12 rounded-xl"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70 text-sm">Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); onClearError(); }}
                placeholder="tu@correo.com"
                className="pl-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70 text-sm">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLocalError(null); onClearError(); }}
                placeholder="Mínimo 6 caracteres"
                className="pl-10 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 h-12 rounded-xl"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70 text-sm">Confirmar contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(null); }}
                placeholder="Repite tu contraseña"
                className="pl-10 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 h-12 rounded-xl"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {(localError || state.error) && (
            <p className="text-red-400 text-sm animate-shake">{localError || state.error}</p>
          )}

          <Button
            type="submit"
            disabled={state.isLoading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25"
          >
            {state.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Crear cuenta'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterModal;
