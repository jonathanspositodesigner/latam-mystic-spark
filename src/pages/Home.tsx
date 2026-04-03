import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import LoginPanel from "@/components/auth/LoginPanel";
import HeroPanel from "@/components/auth/HeroPanel";
import RegisterModal from "@/components/auth/RegisterModal";
import AdminLoginModal from "@/components/admin/AdminLoginModal";
import { Shield } from "lucide-react";

const Home = () => {
  const navigate = useNavigate();
  const auth = useAuthFlow();
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate('/dashboard');
    };
    checkLogin();
  }, [navigate]);

  const showModal = auth.state.step === 'signup' || auth.state.step === 'waiting-confirmation';

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
      <AdminLoginModal open={showAdminModal} onClose={() => setShowAdminModal(false)} />
    </div>
  );
};

export default Home;
