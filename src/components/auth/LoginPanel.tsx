import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import type { AuthState } from "@/hooks/useAuthFlow";
import PasswordSetup from "./PasswordSetup";

interface LoginPanelProps {
  state: AuthState;
  onEmailChange: (email: string) => void;
  onCheckEmail: () => void;
  onLogin: (password: string) => void;
  onSetPassword: (password: string, confirm: string) => void;
  onGoToSignup: () => void;
  onGoToEmail: () => void;
  onClearError: () => void;
  forgotPasswordUrl: string;
}

const LoginPanel = ({
  state,
  onEmailChange,
  onCheckEmail,
  onLogin,
  onSetPassword,
  onGoToSignup,
  onGoToEmail,
  onClearError,
  forgotPasswordUrl,
}: LoginPanelProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Shake animation on error
  useEffect(() => {
    if (state.error) {
      setHasError(true);
      const timer = setTimeout(() => setHasError(false), 600);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCheckEmail();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="w-full lg:w-1/3 min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-10 xl:px-14 bg-[hsl(270,60%,4%)] animate-slide-in-left">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 mb-4 shadow-lg shadow-purple-500/25">
          <span className="text-2xl font-black text-white">A</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Arcano</h1>
        <p className="text-white/40 text-sm mt-1">Plataforma Premium</p>
      </div>

      {/* State B: Set password */}
      {state.step === 'set-password' && (
        <PasswordSetup
          email={state.verifiedEmail}
          isLoading={state.isLoading}
          error={state.error}
          onSubmit={onSetPassword}
          onBack={onGoToEmail}
          hasError={hasError}
        />
      )}

      {/* State A & initial: Email/Password form */}
      {(state.step === 'email' || state.step === 'password') && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Iniciar sesión</h2>
            <p className="text-white/40 text-sm">Ingresa tu correo para continuar</p>
          </div>

          {/* Email form */}
          <form onSubmit={state.step === 'email' ? handleEmailSubmit : handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70 text-sm">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  id="email"
                  type="email"
                  value={state.email}
                  onChange={(e) => { onEmailChange(e.target.value); onClearError(); }}
                  placeholder="tu@correo.com"
                  className="pl-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20 h-12 rounded-xl"
                  disabled={state.step === 'password'}
                  autoFocus
                />
              </div>
              {state.step === 'password' && (
                <button
                  type="button"
                  onClick={() => { onGoToEmail(); setPassword(""); }}
                  className="text-purple-400 text-xs hover:text-purple-300 transition-colors"
                >
                  Cambiar correo
                </button>
              )}
            </div>

            {/* Password field - animated slide down */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-out ${
                state.step === 'password'
                  ? 'max-h-32 opacity-100'
                  : 'max-h-0 opacity-0'
              }`}
            >
              <div className="space-y-2 pt-1">
                <Label htmlFor="password" className="text-white/70 text-sm">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); onClearError(); }}
                    placeholder="••••••••"
                    className={`pl-10 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20 h-12 rounded-xl ${
                      hasError ? 'animate-shake' : ''
                    }`}
                    autoFocus={state.step === 'password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error message */}
            {state.error && (
              <p className={`text-red-400 text-sm ${hasError ? 'animate-shake' : ''}`}>
                {state.error}
              </p>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={state.isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.98]"
            >
              {state.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {state.step === 'password' ? 'Iniciar sesión' : 'Continuar'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Signup link */}
          {state.step === 'email' && (
            <p className="text-center text-white/30 text-sm">
              ¿No tienes cuenta?{' '}
              <button
                onClick={onGoToSignup}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Crear cuenta
              </button>
            </p>
          )}
        </div>
      )}

      {/* Footer links */}
      <div className="mt-10 flex items-center justify-center gap-4 text-xs text-white/20">
        <a href={forgotPasswordUrl} className="hover:text-white/40 transition-colors">
          ¿Olvidaste tu contraseña?
        </a>
        <span>·</span>
        <a href="mailto:soporte@arcano.app" className="hover:text-white/40 transition-colors">
          Soporte
        </a>
      </div>
    </div>
  );
};

export default LoginPanel;
