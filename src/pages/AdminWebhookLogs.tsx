import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

const AdminWebhookLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from("webhook_logs").select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(l =>
    l.event_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.source?.toLowerCase().includes(search.toLowerCase()) ||
    l.status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-3xl font-bold text-foreground">Webhook Logs</h1><p className="text-muted-foreground">{filtered.length} eventos</p></div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
        </div>
        <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <div className="space-y-3">
          {filtered.map(log => (
            <Card key={log.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{log.event_type || "Evento"}</p>
                  <p className="text-xs text-muted-foreground">{log.source || "N/A"} • {new Date(log.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <Badge variant={log.status === 'approved' || log.status === 'paid' ? 'default' : 'secondary'}>{log.status || "unknown"}</Badge>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum log encontrado</p>}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminWebhookLogs;
