import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Purchase {
  id: string; user_id: string; pack_slug: string | null; amount: number | null;
  payment_status: string | null; gateway: string | null; plan_type: string | null;
  expires_at: string | null; created_at: string;
}

const AdminPackPurchases = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("user_pack_purchases").select("*").order("created_at", { ascending: false }).limit(200);
      setPurchases((data || []) as Purchase[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = purchases.filter(p =>
    p.pack_slug?.toLowerCase().includes(search.toLowerCase()) ||
    p.user_id.includes(search) ||
    p.gateway?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate("/admin-artes-eventos")} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        <h1 className="text-3xl font-bold text-foreground mb-2">Compras de Packs</h1>
        <p className="text-muted-foreground mb-6">{filtered.length} compras</p>
        <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por pack, user_id ou gateway..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        {loading ? <p className="text-center text-muted-foreground py-12">Carregando...</p> : (
          <div className="space-y-3">
            {filtered.map(p => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{p.pack_slug || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">ID: {p.user_id.slice(0, 8)}... • {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.amount && <span className="text-sm font-bold text-foreground">R$ {Number(p.amount).toFixed(2)}</span>}
                  <Badge variant={p.payment_status === 'active' ? 'default' : 'secondary'}>{p.payment_status || "N/A"}</Badge>
                  {p.gateway && <Badge variant="outline">{p.gateway}</Badge>}
                </div>
              </Card>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhuma compra encontrada</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPackPurchases;
