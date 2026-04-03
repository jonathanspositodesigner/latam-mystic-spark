import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";

const AdminCommunityReview = () => (
  <AdminLayout>
    <h1 className="text-3xl font-bold text-foreground mb-6">Revisão da Comunidade</h1>
    <Card className="p-12 text-center"><p className="text-muted-foreground">🚧 Em breve</p></Card>
  </AdminLayout>
);

export default AdminCommunityReview;
