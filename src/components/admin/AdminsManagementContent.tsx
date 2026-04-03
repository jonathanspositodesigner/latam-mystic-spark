import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Key, Shield, Mail, Copy, RefreshCw, Loader2 } from "lucide-react";

interface Admin {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  recovery_email: string | null;
}

const AdminsManagementContent = () => {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRecoveryEmail, setNewRecoveryEmail] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
      await fetchAdmins();
    } finally { setLoading(false); }
  };

  const fetchAdmins = async () => {
    try {
      const { data: adminRoles, error: rolesError } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (rolesError) throw rolesError;
      if (!adminRoles || adminRoles.length === 0) { setAdmins([]); return; }

      const adminUserIds = adminRoles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, email, name, recovery_email").in("id", adminUserIds);
      if (profilesError) throw profilesError;

      const adminsList: Admin[] = adminRoles.map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        return {
          id: role.user_id, user_id: role.user_id,
          email: profile?.email || "Email não encontrado",
          name: profile?.name || null,
          recovery_email: profile?.recovery_email || null,
        };
      });
      setAdmins(adminsList);
    } catch (error) {
      console.error("Error fetching admins:", error);
      toast.error("Erro ao carregar administradores");
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    return password;
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const resetAddDialog = () => { setNewEmail(""); setNewName(""); setNewRecoveryEmail(""); setAddDialogOpen(false); };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Administradores</h2>
          <p className="text-muted-foreground">Adicione, edite senhas ou remova administradores</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={(open) => !open && resetAddDialog()}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4" />Adicionar Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Novo Administrador</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Email *</Label><Input type="email" placeholder="admin@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Nome (opcional)</Label><Input placeholder="Nome do administrador" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email de Resgate 2FA (opcional)</Label><Input type="email" placeholder="email.real@gmail.com" value={newRecoveryEmail} onChange={(e) => setNewRecoveryEmail(e.target.value)} /></div>
              <DialogFooter>
                <Button variant="outline" onClick={resetAddDialog}>Cancelar</Button>
                <Button onClick={() => { toast.info("Funcionalidade requer edge function manage-admin"); }}>Criar Administrador</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {admins.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum administrador encontrado</p>
          </Card>
        ) : (
          admins.map((admin) => (
            <Card key={admin.id} className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-full"><Shield className="h-6 w-6 text-primary" /></div>
                  <div>
                    <p className="font-medium text-foreground">
                      {admin.name || "Sem nome"}
                      {admin.user_id === currentUserId && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Você</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                    {admin.recovery_email && (
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1"><Mail className="h-3 w-3" /> 2FA: {admin.recovery_email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditingAdmin(admin); setEditDialogOpen(true); }}>
                    <Key className="h-4 w-4 mr-1" />Alterar Senha
                  </Button>
                  {admin.user_id !== currentUserId && (
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setDeletingAdmin(admin); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-4 w-4 mr-1" />Remover
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditingAdmin(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Alterar senha de: <strong>{editingAdmin?.email}</strong></p>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="flex gap-2">
                <Input type="text" placeholder="Digite a nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Button variant="outline" size="icon" onClick={() => setNewPassword(generatePassword())} title="Gerar senha"><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => toast.info("Funcionalidade requer edge function manage-admin")} disabled={updatingPassword}>Atualizar Senha</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeletingAdmin(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja remover <strong>{deletingAdmin?.email}</strong> como administrador?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => toast.info("Funcionalidade requer edge function manage-admin")} disabled={deleting}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminsManagementContent;
