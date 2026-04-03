import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";

const AdminUpload = () => (
  <AdminLayout>
    <h1 className="text-3xl font-bold text-foreground mb-6">Upload de Conteúdo</h1>
    <Card className="p-12 text-center"><Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Área de upload será implementada em breve.</p></Card>
  </AdminLayout>
);

export default AdminUpload;
