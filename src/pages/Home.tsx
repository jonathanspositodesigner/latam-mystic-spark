import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import LoginPanel from "@/components/auth/LoginPanel";
import HeroPanel from "@/components/auth/HeroPanel";
import RegisterModal from "@/components/auth/RegisterModal";

const Home = () => {
  const navigate = useNavigate();
  const auth = useAuthFlow();

  // If already logged in, redirect
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
    </div>
  );
};

export default Home;
