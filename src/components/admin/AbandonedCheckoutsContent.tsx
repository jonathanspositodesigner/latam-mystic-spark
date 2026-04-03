import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MessageCircle, Mail, RefreshCw, Users, Clock, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AbandonedCheckout {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  product_name: string | null;
  amount: number | null;
  remarketing_status: string;
  abandoned_at: string;
}

const ITEMS_PER_PAGE = 20;

const AbandonedCheckoutsContent = () => {
  const [checkouts, setCheckouts] = useState<AbandonedCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, pending: 0, contacted: 0, potentialValue: 0 });

  const fetchCheckouts = async () => {
    setLoading(true);
    try {
      let query = supabase.from('abandoned_checkouts').select('*', { count: 'exact' }).order('abandoned_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('remarketing_status', statusFilter);
      if (searchTerm) query = query.or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      query = query.range(from, from + ITEMS_PER_PAGE - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      setCheckouts(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error:', error);
      toast.error("Erro ao carregar checkouts");
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    const { count: total } = await supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true });
    const { count: pending } = await supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('remarketing_status', 'pending');
    setStats({ total: total || 0, pending: pending || 0, contacted: (total || 0) - (pending || 0), potentialValue: 0 });
  };

  useEffect(() => { fetchCheckouts(); fetchStats(); }, [currentPage, statusFilter, searchTerm]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-500", contacted_whatsapp: "bg-green-500/20 text-green-500",
      contacted_email: "bg-blue-500/20 text-blue-500", converted: "bg-emerald-500/20 text-emerald-500", ignored: "bg-gray-500/20 text-gray-500"
    };
    const labels: Record<string, string> = { pending: "Pendente", contacted_whatsapp: "WhatsApp", contacted_email: "Email", converted: "Convertido", ignored: "Ignorado" };
    return <Badge className={styles[status] || styles.pending}>{labels[status] || status}</Badge>;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-foreground">Checkouts Abandonados</h1><p className="text-muted-foreground">Gerencie leads para remarketing</p></div>
        <Button onClick={() => { fetchCheckouts(); fetchStats(); }} variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-orange-500/20 rounded-full"><Users className="h-5 w-5 text-orange-500" /></div><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-500/20 rounded-full"><Clock className="h-5 w-5 text-yellow-500" /></div><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pendentes</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-500/20 rounded-full"><TrendingUp className="h-5 w-5 text-green-500" /></div><div><p className="text-2xl font-bold">{stats.contacted}</p><p className="text-xs text-muted-foreground">Contatados</p></div></div></Card>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por email ou nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList><TabsTrigger value="all">Todos</TabsTrigger><TabsTrigger value="pending">Pendentes</TabsTrigger><TabsTrigger value="contacted_email">Email</TabsTrigger><TabsTrigger value="contacted_whatsapp">WhatsApp</TabsTrigger></TabsList>
        </Tabs>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Nome</TableHead><TableHead>Produto</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow> :
              checkouts.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum checkout encontrado</TableCell></TableRow> :
              checkouts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell>{c.name || '-'}</TableCell>
                  <TableCell>{c.product_name || '-'}</TableCell>
                  <TableCell>{c.amount ? `R$ ${Number(c.amount).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{getStatusBadge(c.remarketing_status)}</TableCell>
                  <TableCell className="text-xs">{format(new Date(c.abandoned_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {c.phone && <Button size="sm" variant="ghost" onClick={() => window.open(`https://api.whatsapp.com/send/?phone=${c.phone}`, '_blank')}><MessageCircle className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost"><Mail className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground py-2">{currentPage} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
};

export default AbandonedCheckoutsContent;
