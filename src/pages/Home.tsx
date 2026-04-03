import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import LoginPanel from "@/components/auth/LoginPanel";
import HeroPanel from "@/components/auth/HeroPanel";
import RegisterModal from "@/components/auth/RegisterModal";
import AdminLoginModal from "@/components/admin/AdminLoginModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Shield, CheckCircle2, AlertCircle } from "lucide-react";

type ConfirmationDialogState = {
  tone: "success" | "error";
  title: string;
  description: string;
  actionLabel: string;
  email?: string;
};

const getConfirmationDialogState = (
  status: string | null,
  reason: string | null,
  email?: string,
): ConfirmationDialogState | null => {
  if (!status) return null;

  if (status === "success") {
    return {
      tone: "success",
      title: "Conta confirmada com sucesso",
      description: "Agora você já pode entrar com seu e-mail e senha.",
      actionLabel: "Fazer login",
      email,
    };
  }

  const messages: Record<string, string> = {
    expired_token: "Esse link expirou. Peça um novo e-mail de confirmação.",
    invalid_token: "Esse link é inválido ou já não pode mais ser usado.",
    missing_token: "O link de confirmação está incompleto.",
    internal_error: "Houve um problema ao confirmar sua conta. Tente novamente.",
  };

  return {
    tone: "error",
    title: "Não foi possível confirmar sua conta",
    description: messages[reason || ""] || messages.internal_error,
    actionLabel: "Voltar ao login",
    email,
  };
};

const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuthFlow();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState | null>(null);

  useEffect(() => {
    const checkLogin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate('/dashboard');
    };
    checkLogin();
  }, [navigate]);

  useEffect(() => {
    const email = searchParams.get("email") || undefined;
    const dialogState = getConfirmationDialogState(
      searchParams.get("confirmation"),
      searchParams.get("reason"),
      email,
    );

    if (!dialogState) return;

    if (email) {
      auth.setEmail(email);
    }

    setConfirmationDialog(dialogState);
  }, [searchParams, auth.setEmail]);

  const showModal = auth.state.step === 'signup' || auth.state.step === 'waiting-confirmation';

  const closeConfirmationDialog = () => {
    setConfirmationDialog(null);
    navigate('/', { replace: true });
  };

  const handleConfirmationAction = async () => {
    if (confirmationDialog?.tone === 'success' && confirmationDialog.email) {
      await auth.checkEmail(confirmationDialog.email);
    }

    closeConfirmationDialog();
  };

  return (
    <div className="flex min-h-screen bg-[hsl(270,60%,4%)]">
      {/* Discrete admin button */}
      <button
        onClick={() => setShowAdminModal(true)}
        className="fixed top-3 right-3 z-50 p-2 rounded-lg opacity-40 hover:opacity-100 transition-opacity duration-300"
        aria-label="Admin access"
      >
        <Shield className="h-4 w-4 text-white/50" />
      </button>

      <LoginPanel
        state={auth.state}
        onEmailChange={auth.setEmail}
        onCheckEmail={auth.checkEmail}
        onLogin={auth.loginWithPassword}
        onSetPassword={auth.setPassword}
        onGoToSignup={auth.goToSignup}
        onGoToEmail={auth.goToEmail}
        onClearError={auth.clearError}
        forgotPasswordUrl="/olvide-contrasena"
      />
      <HeroPanel />
      <RegisterModal
        open={showModal}
        onClose={auth.goToEmail}
        state={auth.state}
        onSignup={auth.signup}
        onResend={auth.resendConfirmation}
        onClearError={auth.clearError}
      />
      <Dialog open={Boolean(confirmationDialog)} onOpenChange={(open) => !open && closeConfirmationDialog()}>
        <DialogContent className="max-w-md border-0 bg-[hsl(270,60%,6%)] p-8 rounded-2xl animate-scale-fade-in">
          {confirmationDialog && (
            <div className="text-center space-y-4">
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${confirmationDialog.tone === 'success' ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                {confirmationDialog.tone === 'success' ? (
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-destructive" />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">{confirmationDialog.title}</h2>
                <p className="text-sm text-white/60">{confirmationDialog.description}</p>
              </div>

              <Button
                onClick={() => void handleConfirmationAction()}
                className="w-full h-12 rounded-xl"
              >
                {confirmationDialog.actionLabel}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AdminLoginModal open={showAdminModal} onClose={() => setShowAdminModal(false)} />
    </div>
  );
};

export default Home;
