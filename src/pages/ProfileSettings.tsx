import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Lock, Eye, EyeOff, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import AppLayout from "@/components/layout/AppLayout";

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { user, isLoading: premiumLoading } = usePremiumStatus();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => { if (!premiumLoading && !user) navigate('/'); }, [user, premiumLoading, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const { data } = await (supabase as any).from('profiles').select('name, phone').eq('id', user.id).single();
      if (data) { setName(data.name || ""); setPhone(data.phone || ""); }
    };
    loadProfile();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await (supabase as any).from('profiles').update({ name, phone, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      toast.success('¡Perfil actualizado!');
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    setIsPasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email || "", password: currentPassword });
      if (signInError) { toast.error('Contraseña actual incorrecta'); setIsPasswordLoading(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (user) await (supabase as any).from('profiles').update({ password_changed: true }).eq('id', user.id);
      toast.success('¡Contraseña cambiada exitosamente!');
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar contraseña');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (premiumLoading) {
    return <div className="min-h-screen bg-[hsl(270,60%,4%)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>;
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-purple-300 hover:text-white hover:bg-purple-500/20">
            <ArrowLeft className="mr-2 h-4 w-4" />Volver
          </Button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="h-6 w-6 text-purple-400" />Configuración del Perfil
          </h1>
          <Card className="p-6 bg-[hsl(270,50%,8%)] border-purple-500/20">
            <h2 className="text-lg font-semibold mb-4 text-white">Información Personal</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-purple-200">Email</Label>
                <Input id="email" type="email" value={user?.email || ""} disabled className="mt-2 bg-white/[0.04] border-white/[0.1] text-purple-400" />
              </div>
              <div>
                <Label htmlFor="name" className="text-purple-200">Nombre</Label>
                <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="mt-2 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-purple-200">Teléfono</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 11 1234-5678" className="mt-2 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25" />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                <Save className="h-4 w-4 mr-2" />{isLoading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </form>
          </Card>
          <Card className="p-6 bg-[hsl(270,50%,8%)] border-purple-500/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-purple-400" />Cambiar Contraseña
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label className="text-purple-200">Contraseña Actual</Label>
                <div className="relative mt-2">
                  <Input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" required className="bg-white/[0.06] border-white/[0.1] text-white" />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white">
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-purple-200">Nueva Contraseña</Label>
                <div className="relative mt-2">
                  <Input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-white/[0.06] border-white/[0.1] text-white" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white">
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-purple-200">Confirmar Nueva Contraseña</Label>
                <div className="relative mt-2">
                  <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-white/[0.06] border-white/[0.1] text-white" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={isPasswordLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                {isPasswordLoading ? 'Guardando...' : 'Cambiar Contraseña'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProfileSettings;
