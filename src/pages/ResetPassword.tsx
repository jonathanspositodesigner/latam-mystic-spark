import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (error) { toast.error('Link de recuperación inválido o expirado'); navigate("/olvide-contrasena"); return; }
        setIsVerifying(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Link de recuperación inválido'); navigate("/"); return; }
      setIsVerifying(false);
    };
    verifyToken();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from('profiles').update({ password_changed: true }).eq('id', user.id);
      }
      toast.success('¡Contraseña restablecida exitosamente!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[hsl(270,60%,4%)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(270,60%,4%)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-[hsl(270,50%,8%)] border-purple-500/20">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Lock className="h-8 w-8 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Restablecer Contraseña</h1>
          </div>
          <p className="text-purple-300">Crea tu nueva contraseña</p>
        </div>
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <Label htmlFor="newPassword" className="text-purple-200">Nueva Contraseña</Label>
            <div className="relative mt-2">
              <Input id="newPassword" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-white/[0.06] border-white/[0.1] text-white" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-purple-200">Confirmar Contraseña</Label>
            <div className="relative mt-2">
              <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-white/[0.06] border-white/[0.1] text-white" />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:opacity-90 text-white">
            {isLoading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
