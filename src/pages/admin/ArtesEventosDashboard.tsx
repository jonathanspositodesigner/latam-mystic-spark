import AdminLayoutPlatform from "@/components/admin/AdminLayoutPlatform";
import { Card } from "@/components/ui/card";

const ArtesEventosDashboard = () => (
  <AdminLayoutPlatform platform="artes-eventos">
    <h1 className="text-3xl font-bold text-foreground mb-6">Dashboard - Artes Eventos</h1>
    <Card className="p-12 text-center"><p className="text-muted-foreground">🚧 Em breve</p></Card>
  </AdminLayoutPlatform>
);

export default ArtesEventosDashboard;
