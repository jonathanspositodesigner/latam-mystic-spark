import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/admin/AdminLayout";

const AdminLeads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = leads.filter(l =>
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.source?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-3xl font-bold text-foreground">Leads</h1><p className="text-muted-foreground">{filtered.length} leads capturados</p></div>
          <Button variant="outline" onClick={fetchLeads} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
        </div>
        <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por email, nome ou fonte..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <div className="space-y-3">
          {filtered.map(lead => (
            <Card key={lead.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{lead.email}</p>
                <p className="text-xs text-muted-foreground">{lead.name || "Sem nome"} • {new Date(lead.created_at).toLocaleDateString("pt-BR")}</p>
                {lead.utm_source && <p className="text-xs text-muted-foreground">UTM: {lead.utm_source}/{lead.utm_medium}/{lead.utm_campaign}</p>}
              </div>
              <div className="flex gap-2">
                <Badge variant={lead.status === 'converted' ? 'default' : 'secondary'}>{lead.status || "new"}</Badge>
                {lead.source && <Badge variant="outline">{lead.source}</Badge>}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum lead encontrado</p>}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminLeads;
