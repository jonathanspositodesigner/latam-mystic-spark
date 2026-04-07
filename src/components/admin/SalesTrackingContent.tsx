import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Mail, MailCheck, CheckCircle, XCircle, Pencil, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SaleRow {
  id: string;
  user_id: string;
  pack_slug: string | null;
  amount: number | null;
  gateway: string | null;
  payment_status: string | null;
  created_at: string;
  welcome_email_sent: boolean;
  welcome_email_sent_at: string | null;
  external_id: string | null;
  // joined from profiles
  email: string;
  name: string | null;
  phone: string | null;
  has_logged_in: boolean;
  password_changed: boolean;
}

const SLUG_LABELS: Record<string, string> = {
  "upscaller-arcano-v3": "Upscaler V3 Vitalício",
  "upscaller-arcano": "Upscaler Arcano",
  "upscaller-arcano-vitalicio": "Upscaler Vitalício",
  "upscaler-creditos-starter": "Créditos Starter (1500)",
  "upscaler-creditos-pro": "Créditos Pro (4200)",
  "upscaler-creditos-ultimate": "Créditos Ultimate (14000)",
};

const SalesTrackingContent = () => {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resending, setResending] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SaleRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    // We need to join user_pack_purchases with profiles
    const { data: purchases } = await supabase
      .from("user_pack_purchases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!purchases || purchases.length === 0) {
      setSales([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(purchases.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, name, phone, has_logged_in, password_changed")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const merged: SaleRow[] = purchases.map((p) => {
      const profile = profileMap.get(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        pack_slug: p.pack_slug,
        amount: p.amount,
        gateway: p.gateway,
        payment_status: p.payment_status,
        created_at: p.created_at || "",
        welcome_email_sent: (p as any).welcome_email_sent ?? false,
        welcome_email_sent_at: (p as any).welcome_email_sent_at ?? null,
        external_id: p.external_id,
        email: profile?.email || "—",
        name: profile?.name || null,
        phone: profile?.phone || null,
        has_logged_in: profile?.has_logged_in ?? false,
        password_changed: profile?.password_changed ?? false,
      };
    });

    setSales(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const filtered = sales.filter(
    (s) =>
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.pack_slug?.toLowerCase().includes(search.toLowerCase()) ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      ""
  );

  const handleResendEmail = async (sale: SaleRow) => {
    setResending(sale.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-welcome-email", {
        body: {
          purchase_id: sale.id,
          customer_email: sale.email,
          pack_slug: sale.pack_slug,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email reenviado para ${sale.email}`);
      await fetchSales();
    } catch (err: any) {
      toast.error(`Erro ao reenviar: ${err.message}`);
    } finally {
      setResending(null);
    }
  };

  const openEdit = (sale: SaleRow) => {
    setEditingRow(sale);
    setEditForm({ name: sale.name || "", phone: sale.phone || "" });
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ name: editForm.name || null, phone: editForm.phone || null })
        .eq("id", editingRow.user_id);
      if (error) throw error;
      toast.success("Dados atualizados com sucesso");
      setEditingRow(null);
      await fetchSales();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (sent: boolean) =>
    sent ? (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
        <MailCheck className="h-3 w-3" /> Enviado
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Não enviado
      </Badge>
    );

  const getLoginBadge = (loggedIn: boolean, passwordChanged: boolean) => {
    if (loggedIn && passwordChanged) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
          <CheckCircle className="h-3 w-3" /> Ativo
        </Badge>
      );
    }
    if (passwordChanged) {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
          Senha criada
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <XCircle className="h-3 w-3" /> Pendente
      </Badge>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Vendas Stripe</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Acompanhe vendas, envio de emails e status de acesso dos clientes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{sales.length}</p>
          <p className="text-xs text-muted-foreground">Total Vendas</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{sales.filter((s) => s.welcome_email_sent).length}</p>
          <p className="text-xs text-muted-foreground">Emails Enviados</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{sales.filter((s) => !s.welcome_email_sent).length}</p>
          <p className="text-xs text-muted-foreground">Emails Pendentes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{sales.filter((s) => s.has_logged_in).length}</p>
          <p className="text-xs text-muted-foreground">Logaram</p>
        </Card>
      </div>

      {/* Search + Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, nome ou plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchSales} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Sales list */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Carregando vendas...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma venda encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((sale) => (
            <Card key={sale.id} className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                {/* Client info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{sale.email}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    {sale.name && <span>👤 {sale.name}</span>}
                    <span>🏷️ {SLUG_LABELS[sale.pack_slug || ""] || sale.pack_slug || "N/A"}</span>
                    {sale.amount != null && <span>💰 ${Number(sale.amount).toFixed(2)}</span>}
                    <span>📅 {new Date(sale.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(sale.welcome_email_sent)}
                  {getLoginBadge(sale.has_logged_in, sale.password_changed)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResendEmail(sale)}
                    disabled={resending === sale.id}
                    className="gap-1"
                  >
                    {resending === sale.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Mail className="h-3 w-3" />
                    )}
                    Reenviar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(sale)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Email: {editingRow?.email}</p>
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+55 11 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesTrackingContent;
