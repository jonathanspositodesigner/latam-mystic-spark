import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, RefreshCw, Mail, Phone, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Checkout {
  id: string; email: string; name: string | null; phone: string | null;
  product_name: string | null; amount: number | null; remarketing_status: string | null;
  abandoned_at: string | null; contacted_at: string | null; notes: string | null;
  checkout_link: string | null;
}

const AbandonedCheckoutsContent = () => {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null);
  const [notes, setNotes] = useState("");

  const fetchCheckouts = async () => {
    setLoading(true);
    let q = supabase.from("abandoned_checkouts").select("*").order("abandoned_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("remarketing_status", filter);
    const { data } = await q;
    setCheckouts((data || []) as Checkout[]);
    setLoading(false);
  };

  useEffect(() => { fetchCheckouts(); }, [filter]);

  const markContacted = async (id: string) => {
    await supabase.from("abandoned_checkouts").update({ remarketing_status: "contacted", contacted_at: new Date().toISOString() }).eq("id", id);
    toast.success("Marcado como contatado");
    fetchCheckouts();
  };

  const saveNotes = async () => {
    if (!selectedCheckout) return;
    await supabase.from("abandoned_checkouts").update({ notes }).eq("id", selectedCheckout.id);
    toast.success("Notas salvas");
    setSelectedCheckout(null);
    fetchCheckouts();
  };

  const filtered = checkouts.filter(c =>
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-foreground">Remarketing</h1><p className="text-muted-foreground">{filtered.length} checkouts abandonados</p></div>
        <Button variant="outline" onClick={fetchCheckouts} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "pending", "contacted", "recovered", "lost"].map(s => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
            {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "contacted" ? "Contatados" : s === "recovered" ? "Recuperados" : "Perdidos"}
          </Button>
        ))}
      </div>

      <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>

      <div className="space-y-3">
        {filtered.map(c => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{c.name || c.email}</p>
                <p className="text-xs text-muted-foreground">{c.email} • {c.product_name || "N/A"}</p>
                {c.abandoned_at && <p className="text-xs text-muted-foreground">Abandonado em: {new Date(c.abandoned_at).toLocaleString("pt-BR")}</p>}
              </div>
              <div className="flex items-center gap-2">
                {c.amount && <span className="text-sm font-bold text-foreground">R$ {Number(c.amount).toFixed(2)}</span>}
                <Badge variant={c.remarketing_status === 'pending' ? 'secondary' : c.remarketing_status === 'recovered' ? 'default' : 'outline'}>
                  {c.remarketing_status || "pending"}
                </Badge>
                {c.phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://api.whatsapp.com/send/?phone=${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><Phone className="h-4 w-4" /></a>
                  </Button>
                )}
                {c.remarketing_status === 'pending' && <Button size="sm" onClick={() => markContacted(c.id)}>Contatado</Button>}
                <Button variant="outline" size="sm" onClick={() => { setSelectedCheckout(c); setNotes(c.notes || ""); }}>Notas</Button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum checkout abandonado</p>}
      </div>

      <Dialog open={!!selectedCheckout} onOpenChange={o => !o && setSelectedCheckout(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notas - {selectedCheckout?.email}</DialogTitle></DialogHeader>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Adicione notas..." />
          <Button onClick={saveNotes}>Salvar Notas</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AbandonedCheckoutsContent;
