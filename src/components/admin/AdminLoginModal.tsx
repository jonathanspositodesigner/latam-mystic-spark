import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
}

const AdminLoginModal = ({ open, onClose }: AdminLoginModalProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        setError("Acesso negado. Credenciais de administrador inválidas.");
        return;
      }

      onClose();
      navigate('/admin-hub');
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 text-primary" />
            Acesso Administrativo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-foreground/70">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="admin@exemplo.com"
                className="pl-10"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-foreground/70">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                className="pl-10"
                required
              />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Acessar Painel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminLoginModal;
