import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/restablecer-contrasena`,
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success('¡Email de recuperación enviado!');
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar email de recuperación');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-[#0D0221] flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-[#1A0A2E] border-purple-500/20 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">¡Email Enviado!</h1>
          <p className="text-purple-300 mb-6">Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.</p>
          <Button onClick={() => navigate("/login")} variant="outline" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />Volver al inicio de sesión
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0221] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-[#1A0A2E] border-purple-500/20">
        <Button variant="ghost" onClick={() => navigate("/login")} className="mb-6 text-purple-300 hover:text-white hover:bg-purple-500/20">
          <ArrowLeft className="mr-2 h-4 w-4" />Volver
        </Button>
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mail className="h-8 w-8 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Recuperar Contraseña</h1>
          </div>
          <p className="text-purple-300">Ingresa tu email y te enviaremos un link para restablecer tu contraseña.</p>
        </div>
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <Label htmlFor="email" className="text-purple-200">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu-email@ejemplo.com" className="mt-2 bg-[#0D0221] border-purple-500/30 text-white placeholder:text-purple-400" required />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white">
            {isLoading ? 'Enviando...' : 'Enviar link de recuperación'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPassword;
