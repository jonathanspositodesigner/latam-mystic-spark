import AdminLayoutPlatform from "@/components/admin/AdminLayoutPlatform";
import AdminSimpleMetrics from "@/components/admin/AdminSimpleMetrics";

const ArtesEventosDashboard = () => (
  <AdminLayoutPlatform platform="artes-eventos">
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard - Artes Eventos</h1>
      <p className="text-muted-foreground mb-6">Métricas essenciais da plataforma</p>
      <AdminSimpleMetrics />
    </div>
  </AdminLayoutPlatform>
);

export default ArtesEventosDashboard;
