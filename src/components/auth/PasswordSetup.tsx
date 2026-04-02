import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

interface PasswordSetupProps {
  email: string;
  isLoading: boolean;
  error: string | null;
  onSubmit: (password: string, confirmPassword: string) => void;
  onBack: () => void;
  hasError: boolean;
}

const PasswordSetup = ({ email, isLoading, error, onSubmit, onBack, hasError }: PasswordSetupProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password, confirmPassword);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-white/40 hover:text-white/60 text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <ShieldCheck className="h-6 w-6 text-purple-400 shrink-0" />
        <div>
          <p className="text-white text-sm font-medium">¡Encontramos tu cuenta!</p>
          <p className="text-white/50 text-xs mt-0.5">Crea una contraseña para acceder a <span className="text-purple-300">{email}</span></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/70 text-sm">Nueva contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="pl-10 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 focus:border-purple-500/50 h-12 rounded-xl"
              autoFocus
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              className="pl-10 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 focus:border-purple-500/50 h-12 rounded-xl"
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p className={`text-red-400 text-sm ${hasError ? 'animate-shake' : ''}`}>{error}</p>}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Crear contraseña y entrar'}
        </Button>
      </form>
    </div>
  );
};

export default PasswordSetup;
