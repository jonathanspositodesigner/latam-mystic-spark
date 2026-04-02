import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { LoginEmailStep, LoginPasswordStep, SignupForm } from "@/components/auth";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const auth = useUnifiedAuth({
    changePasswordRoute: '/cambiar-contrasena',
    loginRoute: '/login',
    forgotPasswordRoute: '/olvide-contrasena',
    defaultRedirect: redirectTo,
  });

  useEffect(() => {
    const checkLoginStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate(redirectTo);
    };
    checkLoginStatus();
  }, [navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-[#0D0221] flex items-center justify-center p-4">
      <Dialog open={auth.state.step === 'signup'} onOpenChange={(open) => !open && auth.goToLogin()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0">
          <SignupForm
            defaultEmail={auth.state.email}
            onSubmit={auth.signup}
            onBackToLogin={auth.goToLogin}
            isLoading={auth.state.isLoading}
            variant="purple"
            labels={{
              title: 'Crear Cuenta',
              subtitle: 'Únete a la plataforma',
              email: 'Email',
              emailPlaceholder: 'tu@email.com',
              password: 'Contraseña',
              passwordPlaceholder: 'Mínimo 6 caracteres',
              confirmPassword: 'Confirmar Contraseña',
              confirmPasswordPlaceholder: 'Confirma tu contraseña',
              warning: 'Después de registrarte, revisa tu email para confirmar tu cuenta.',
              createAccount: 'Crear mi Cuenta',
              creatingAccount: 'Creando cuenta...',
              backToLogin: 'Volver al inicio de sesión',
            }}
          />
        </DialogContent>
      </Dialog>

      <Card className="w-full max-w-md p-8 bg-[#1A0A2E] border-purple-500/20">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6 text-purple-300 hover:text-white hover:bg-purple-500/20">
          <ArrowLeft className="mr-2 h-4 w-4" />Volver
        </Button>

        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Star className="h-8 w-8 text-yellow-500" fill="currentColor" />
            <h1 className="text-3xl font-bold text-white">Área Premium</h1>
          </div>
          <p className="text-purple-300">Inicia sesión para acceder a tu contenido</p>
        </div>

        {auth.state.step === 'email' && (
          <LoginEmailStep
            email={auth.state.email}
            onEmailChange={auth.setEmail}
            onSubmit={auth.checkEmail}
            onSignupClick={auth.goToSignup}
            isLoading={auth.state.isLoading}
            variant="purple"
            labels={{
              email: 'Email',
              emailPlaceholder: 'tu@email.com',
              continue: 'Continuar',
              loading: 'Verificando...',
              noAccountYet: '¿Aún no tienes cuenta?',
              createAccount: 'Crear Cuenta',
            }}
          />
        )}

        {auth.state.step === 'password' && (
          <LoginPasswordStep
            email={auth.state.verifiedEmail}
            onSubmit={auth.loginWithPassword}
            onChangeEmail={auth.changeEmail}
            forgotPasswordUrl={auth.getForgotPasswordUrl()}
            isLoading={auth.state.isLoading}
            variant="purple"
            labels={{
              password: 'Contraseña',
              passwordPlaceholder: 'Contraseña',
              signIn: 'Iniciar Sesión',
              signingIn: 'Iniciando sesión...',
              forgotPassword: '¿Olvidaste tu contraseña?',
              changeEmail: 'Cambiar',
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default Login;
