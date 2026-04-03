import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Trash2, ToggleLeft, ToggleRight, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Partner {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  is_active: boolean;
  created_at: string;
}

const generateRandomPassword = (length = 12): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
  return password;
};

const PartnersManagementContent = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: "", email: "", phone: "", company: "", password: "" });

  useEffect(() => { fetchPartners(); }, []);

  useEffect(() => {
    if (showAddModal && !newPartner.password) setNewPartner(prev => ({ ...prev, password: generateRandomPassword() }));
  }, [showAddModal]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase.from('partners').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar colaboradores");
    } finally { setIsLoading(false); }
  };

  const handleToggleActive = async (partnerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('partners').update({ is_active: !currentStatus }).eq('id', partnerId);
      if (error) throw error;
      toast.success(currentStatus ? "Colaborador desativado" : "Colaborador ativado");
      fetchPartners();
    } catch (error) { toast.error("Erro ao alterar status"); }
  };

  const handleDeletePartner = async (partnerId: string) => {
    if (!confirm("Tem certeza que deseja excluir este colaborador?")) return;
    try {
      const { error } = await supabase.from('partners').delete().eq('id', partnerId);
      if (error) throw error;
      toast.success("Colaborador excluído"); fetchPartners();
    } catch (error) { toast.error("Erro ao excluir colaborador"); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><p className="text-foreground">Carregando...</p></div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Gerenciar Colaboradores</h1>
          <p className="text-muted-foreground text-lg">{partners.length} colaborador(es) cadastrado(s)</p>
        </div>
        <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) setNewPartner({ name: "", email: "", phone: "", company: "", password: "" }); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Adicionar Colaborador</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cadastrar Novo Colaborador</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nome *</Label><Input value={newPartner.name} onChange={(e) => setNewPartner(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome do colaborador" className="mt-1" /></div>
              <div><Label>Email *</Label><Input type="email" value={newPartner.email} onChange={(e) => setNewPartner(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" className="mt-1" /></div>
              <div>
                <Label>Senha *</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input type={showPassword ? "text" : "password"} value={newPartner.password} onChange={(e) => setNewPartner(prev => ({ ...prev, password: e.target.value }))} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => setNewPartner(prev => ({ ...prev, password: generateRandomPassword() }))}><RefreshCw className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(newPartner.password); toast.success("Copiado!"); }}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div><Label>Telefone</Label><Input value={newPartner.phone} onChange={(e) => setNewPartner(prev => ({ ...prev, phone: e.target.value }))} placeholder="(11) 99999-9999" className="mt-1" /></div>
              <div><Label>Empresa</Label><Input value={newPartner.company} onChange={(e) => setNewPartner(prev => ({ ...prev, company: e.target.value }))} placeholder="Nome da empresa (opcional)" className="mt-1" /></div>
              <DialogFooter>
                <Button onClick={() => toast.info("Funcionalidade requer edge function create-partner")} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Cadastrando..." : "Cadastrar Colaborador"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {partners.length === 0 ? (
          <Card className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum colaborador cadastrado</p></Card>
        ) : partners.map((partner) => (
          <Card key={partner.id} className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-full"><Users className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-medium text-foreground">{partner.name}</p>
                  <p className="text-sm text-muted-foreground">{partner.email}</p>
                  {partner.phone && <p className="text-xs text-muted-foreground">{partner.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={partner.is_active ? "default" : "secondary"}>{partner.is_active ? "Ativo" : "Inativo"}</Badge>
                <Button variant="ghost" size="icon" onClick={() => handleToggleActive(partner.id, partner.is_active)}>
                  {partner.is_active ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePartner(partner.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PartnersManagementContent;
