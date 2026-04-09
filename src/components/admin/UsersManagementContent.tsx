import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, RefreshCw, Loader2, Shield, ShieldOff, Coins, Mail,
  KeyRound, Trash2, Pencil, Save, X, UserCheck, UserX, Plus, Minus,
  ChevronDown, ChevronUp, UserPlus
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
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", name: "", phone: "" });
  const [creating, setCreating] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, name, phone, has_logged_in, password_changed, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        setAllUsers([]);
        setLoading(false);
        return;
      }

      const userIds = profiles.map(p => p.id);

      // Fetch purchases and roles in parallel
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

      setAllUsers(mapped);
    } catch (err: any) {
      toast.error("Erro ao carregar usuários: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users by search
  const filteredUsers = allUsers.filter(u => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      (u.email?.toLowerCase().includes(term)) ||
      (u.name?.toLowerCase().includes(term)) ||
      (u.phone?.toLowerCase().includes(term))
    );
  });

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
      loadUsers();
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
      loadUsers();
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
      loadUsers();
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

  // Reset password
  const resetPassword = async (u: UserRow) => {
    if (!u.email) { toast.error("Usuário sem email"); return; }
    setActionLoading("resetpw-" + u.id);
    try {
      const { error } = await supabase.functions.invoke("signup-user", {
        body: { action: "reset-password", email: u.email },
      });
      if (error) throw error;
      await supabase.from("profiles").update({ password_changed: false }).eq("id", u.id);
      toast.success("Senha resetada! O usuário precisará criar nova senha no próximo login.");
      loadUsers();
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
      await supabase.from("user_pack_purchases").delete().eq("user_id", deleteUser.id);
      await supabase.from("upscaler_credit_transactions").delete().eq("user_id", deleteUser.id);
      await supabase.from("upscaler_jobs").delete().eq("user_id", deleteUser.id);
      await supabase.from("user_roles").delete().eq("user_id", deleteUser.id);
      await supabase.from("profiles").delete().eq("id", deleteUser.id);
      toast.success("Dados do usuário removidos!");
      setDeleteUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Resend welcome email
  const resendWelcome = async (u: UserRow) => {
    if (!u.email) return;
    const latestPurchase = u.products[0];
    if (!latestPurchase) {
      toast.error("Este usuário não possui nenhuma compra registrada.");
      return;
    }
    setActionLoading("welcome-" + u.id);
    try {
      const { error } = await supabase.functions.invoke("resend-welcome-email", {
        body: {
          purchase_id: latestPurchase.id,
          customer_email: u.email,
          pack_slug: latestPurchase.pack_slug || "upscaller-arcano-v3",
        },
      });
      if (error) throw error;
      toast.success("Email de boas-vindas reenviado!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Create user manually
  const createUser = async () => {
    if (!createForm.email.trim()) { toast.error("Email é obrigatório"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("signup-user", {
        body: {
          email: createForm.email.trim().toLowerCase(),
          name: createForm.name.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado com sucesso!");
      setShowCreateUser(false);
      setCreateForm({ email: "", name: "", phone: "" });
      loadUsers();
    } catch (err: any) {
      toast.error("Erro ao criar: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Gerenciar Usuários</h2>
          <p className="text-muted-foreground text-sm">{allUsers.length} usuário(s) cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowCreateUser(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filtrar por email, nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
        </div>
      )}

      {/* Results */}
      {!loading && filteredUsers.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {search.trim() ? "Nenhum usuário encontrado com esse filtro." : "Nenhum usuário cadastrado."}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {filteredUsers.map(u => (
          <Card key={u.id} className="overflow-hidden">
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
                      <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">Nunca logou</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {u.name || "Sem nome"} • {u.products.length} produto(s) • {u.credits} créditos • {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedUser === u.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {expandedUser === u.id && (
              <div className="border-t border-border p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{u.email}</span></div>
                  <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{u.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{u.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">Cadastro:</span> <span className="font-medium">{new Date(u.created_at).toLocaleDateString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Senha definida:</span> <span className="font-medium">{u.password_changed ? "Sim" : "Não"}</span></div>
                  <div><span className="text-muted-foreground">Créditos:</span> <span className="font-bold text-primary">{u.credits}</span></div>
                </div>

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
                  <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => resetPassword(u)} disabled={actionLoading === "resetpw-" + u.id}>
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

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email *</Label>
              <Input
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="usuario@email.com"
                type="email"
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={createForm.phone}
                onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+55 11 99999-9999"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O usuário será criado com o email como senha temporária. No primeiro login, será solicitado a definir uma nova senha.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>Cancelar</Button>
            <Button onClick={createUser} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManagementContent;
