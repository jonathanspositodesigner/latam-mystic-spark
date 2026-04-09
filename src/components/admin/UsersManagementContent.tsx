import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, RefreshCw, Loader2, Shield, ShieldOff, Coins, Mail,
  KeyRound, Trash2, Pencil, Save, X, UserCheck, UserX, Plus, Minus,
  ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  has_logged_in: boolean;
  password_changed: boolean;
  created_at: string;
  // derived
  credits: number;
  products: { id: string; pack_slug: string | null; payment_status: string | null; created_at: string }[];
  isAdmin: boolean;
}

const SLUG_LABELS: Record<string, string> = {
  "upscaller-arcano-v3": "Upscaler V3 Vitalício",
  "upscaller-arcano": "Upscaler Arcano",
  "upscaller-arcano-vitalicio": "Upscaler Vitalício",
  "upscaler-creditos-starter": "Créditos Starter (1500)",
  "upscaler-creditos-pro": "Créditos Pro (4200)",
  "upscaler-creditos-ultimate": "Créditos Ultimate (14000)",
};

const UsersManagementContent = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Edit modal
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ email: "", name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  // Credits modal
  const [creditsUser, setCreditsUser] = useState<UserRow | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("100");
  const [creditsType, setCreditsType] = useState<"add" | "remove">("add");
  const [creditsDesc, setCreditsDesc] = useState("");
  const [creditsSaving, setCreditsSaving] = useState(false);

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const searchUsers = async () => {
    if (!search.trim() || search.trim().length < 3) {
      toast.error("Digite ao menos 3 caracteres para buscar");
      return;
    }
    setLoading(true);
    try {
      const searchTerm = search.trim().toLowerCase();
      
      // Search profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, name, phone, has_logged_in, password_changed, created_at")
        .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = profiles.map(p => p.id);

      // Fetch purchases, credits, roles in parallel
      const [purchasesRes, rolesRes] = await Promise.all([
        supabase.from("user_pack_purchases").select("id, user_id, pack_slug, payment_status, created_at").in("user_id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);

      // Fetch credits for each user via RPC
      const creditsMap: Record<string, number> = {};
      await Promise.all(userIds.map(async (uid) => {
        const { data } = await supabase.rpc("get_upscaler_credits", { _user_id: uid });
        creditsMap[uid] = data ?? 0;
      }));

      const purchases = purchasesRes.data || [];
      const roles = rolesRes.data || [];

      const mapped: UserRow[] = profiles.map(p => ({
        id: p.id,
        email: p.email,
        name: p.name,
        phone: p.phone,
        has_logged_in: p.has_logged_in ?? false,
        password_changed: p.password_changed ?? false,
        created_at: p.created_at,
        credits: creditsMap[p.id] || 0,
        products: purchases.filter(pu => pu.user_id === p.id),
        isAdmin: roles.some(r => r.user_id === p.id && r.role === "admin"),
      }));

      setUsers(mapped);
    } catch (err: any) {
      toast.error("Erro ao buscar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit profile
  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ email: u.email || "", name: u.name || "", phone: u.phone || "" });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        email: editForm.email || null,
        name: editForm.name || null,
        phone: editForm.phone || null,
      }).eq("id", editUser.id);
      if (error) throw error;
      toast.success("Perfil atualizado!");
      setEditUser(null);
      searchUsers();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Credits
  const openCredits = (u: UserRow) => {
    setCreditsUser(u);
    setCreditsAmount("100");
    setCreditsType("add");
    setCreditsDesc("");
  };

  const saveCredits = async () => {
    if (!creditsUser) return;
    const amount = parseInt(creditsAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    setCreditsSaving(true);
    try {
      if (creditsType === "add") {
        await supabase.rpc("refund_upscaler_credits", {
          _user_id: creditsUser.id,
          _amount: amount,
          _description: creditsDesc || "Créditos adicionados pelo admin",
        });
      } else {
        const res = await supabase.rpc("consume_upscaler_credits", {
          _user_id: creditsUser.id,
          _amount: amount,
          _description: creditsDesc || "Créditos removidos pelo admin",
        });
        const result = res.data?.[0];
        if (result && !result.success) {
          toast.error(result.error_message || "Créditos insuficientes");
          setCreditsSaving(false);
          return;
        }
      }
      toast.success(`${amount} créditos ${creditsType === "add" ? "adicionados" : "removidos"}!`);
      setCreditsUser(null);
      searchUsers();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setCreditsSaving(false);
    }
  };

  // Toggle product status
  const toggleProductStatus = async (purchaseId: string, currentStatus: string) => {
    setActionLoading(purchaseId);
    try {
      const newStatus = currentStatus === "active" ? "blocked" : "active";
      const { error } = await supabase.from("user_pack_purchases").update({ payment_status: newStatus }).eq("id", purchaseId);
      if (error) throw error;
      toast.success(`Produto ${newStatus === "active" ? "liberado" : "bloqueado"}!`);
      searchUsers();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Send password reset email
  const sendPasswordReset = async (u: UserRow) => {
    if (!u.email) { toast.error("Usuário sem email"); return; }
    setActionLoading("reset-" + u.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
        redirectTo: "https://arcanoapp-es.voxvisual.com.br/reset-password",
      });
      if (error) throw error;
      toast.success("Email de reset enviado para " + u.email);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Reset password (set to email as temp password)
  const resetPassword = async (u: UserRow) => {
    if (!u.email) { toast.error("Usuário sem email"); return; }
    setActionLoading("resetpw-" + u.id);
    try {
      // Use admin function to reset password
      const { error } = await supabase.functions.invoke("signup-user", {
        body: { action: "reset-password", email: u.email },
      });
      if (error) throw error;
      // Mark password_changed as false so they'll be prompted
      await supabase.from("profiles").update({ password_changed: false }).eq("id", u.id);
      toast.success("Senha resetada! O usuário precisará criar nova senha no próximo login.");
      searchUsers();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete user account
  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      // Delete related data
      await supabase.from("user_pack_purchases").delete().eq("user_id", deleteUser.id);
      await supabase.from("upscaler_credit_transactions").delete().eq("user_id", deleteUser.id);
      await supabase.from("upscaler_jobs").delete().eq("user_id", deleteUser.id);
      await supabase.from("user_roles").delete().eq("user_id", deleteUser.id);
      await supabase.from("profiles").delete().eq("id", deleteUser.id);
      toast.success("Dados do usuário removidos! (conta auth mantida)");
      setDeleteUser(null);
      searchUsers();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Resend welcome email
  const resendWelcome = async (u: UserRow) => {
    if (!u.email) return;
    setActionLoading("welcome-" + u.id);
    try {
      const { error } = await supabase.functions.invoke("resend-welcome-email", {
        body: { email: u.email },
      });
      if (error) throw error;
      toast.success("Email de boas-vindas reenviado!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Gerenciar Usuários</h2>
        <p className="text-muted-foreground text-sm">Busque por email ou nome para gerenciar contas, produtos, créditos e acessos</p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email ou nome (mín. 3 caracteres)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchUsers()}
            className="pl-10"
          />
        </div>
        <Button onClick={searchUsers} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-1.5">Buscar</span>
        </Button>
      </div>

      {/* Results */}
      {users.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum resultado. Busque por email ou nome.</p>
        </Card>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.id} className="overflow-hidden">
            {/* Header */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{u.email || "Sem email"}</p>
                    {u.isAdmin && <Badge variant="outline" className="text-[10px] border-primary text-primary">Admin</Badge>}
                    {u.has_logged_in ? (
                      <Badge variant="outline" className="text-[10px] text-green-600 border-green-600">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-600">Nunca logou</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {u.name || "Sem nome"} • {u.products.length} produto(s) • {u.credits} créditos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedUser === u.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {/* Expanded */}
            {expandedUser === u.id && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{u.email}</span></div>
                  <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{u.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{u.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">Cadastro:</span> <span className="font-medium">{new Date(u.created_at).toLocaleDateString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Senha definida:</span> <span className="font-medium">{u.password_changed ? "Sim" : "Não"}</span></div>
                  <div><span className="text-muted-foreground">Créditos:</span> <span className="font-bold text-primary">{u.credits}</span></div>
                </div>

                {/* Products */}
                {u.products.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Produtos</p>
                    <div className="space-y-1.5">
                      {u.products.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                          <div className="text-xs">
                            <span className="font-medium">{SLUG_LABELS[p.pack_slug || ""] || p.pack_slug || "Produto"}</span>
                            <span className="text-muted-foreground ml-2">{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={p.payment_status === "active" ? "default" : "destructive"} className="text-[10px]">
                              {p.payment_status === "active" ? "Ativo" : p.payment_status || "—"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={actionLoading === p.id}
                              onClick={() => toggleProductStatus(p.id, p.payment_status || "active")}
                            >
                              {actionLoading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : p.payment_status === "active" ? (
                                <><ShieldOff className="h-3 w-3 mr-1" />Bloquear</>
                              ) : (
                                <><Shield className="h-3 w-3 mr-1" />Liberar</>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEdit(u)}>
                    <Pencil className="h-3 w-3 mr-1" />Editar Perfil
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openCredits(u)}>
                    <Coins className="h-3 w-3 mr-1" />Gerenciar Créditos
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => resendWelcome(u)} disabled={actionLoading === "welcome-" + u.id}>
                    {actionLoading === "welcome-" + u.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                    Email Boas-vindas
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => sendPasswordReset(u)} disabled={actionLoading === "reset-" + u.id}>
                    {actionLoading === "reset-" + u.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <KeyRound className="h-3 w-3 mr-1" />}
                    Email Reset Senha
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-orange-600 hover:text-orange-700" onClick={() => resetPassword(u)} disabled={actionLoading === "resetpw-" + u.id}>
                    {actionLoading === "resetpw-" + u.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <KeyRound className="h-3 w-3 mr-1" />}
                    Resetar Senha
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setDeleteUser(u)}>
                    <Trash2 className="h-3 w-3 mr-1" />Excluir Conta
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Nome</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      <Dialog open={!!creditsUser} onOpenChange={() => setCreditsUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerenciar Créditos — {creditsUser?.email}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Saldo atual: <span className="font-bold text-primary">{creditsUser?.credits}</span></p>
          <div className="space-y-3">
            <div>
              <Label>Operação</Label>
              <Select value={creditsType} onValueChange={(v: "add" | "remove") => setCreditsType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Adicionar créditos</SelectItem>
                  <SelectItem value="remove">Remover créditos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade</Label><Input type="number" value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)} /></div>
            <div><Label>Descrição (opcional)</Label><Input value={creditsDesc} onChange={e => setCreditsDesc(e.target.value)} placeholder="Ex: Bônus promocional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsUser(null)}>Cancelar</Button>
            <Button onClick={saveCredits} disabled={creditsSaving}>
              {creditsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : creditsType === "add" ? <Plus className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
              {creditsType === "add" ? "Adicionar" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Conta</DialogTitle></DialogHeader>
          <p className="text-sm text-destructive font-medium">⚠️ Esta ação é irreversível!</p>
          <p className="text-sm text-muted-foreground">
            Todos os dados do usuário <strong>{deleteUser?.email}</strong> serão removidos (perfil, compras, créditos, jobs).
            A conta de autenticação será mantida no Supabase Auth.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManagementContent;
