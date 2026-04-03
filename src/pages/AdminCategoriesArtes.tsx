import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Category { id: string; name: string; slug: string | null; display_order: number; is_active: boolean; }

const AdminCategoriesArtes = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("artes_categories").select("*").eq("platform", "artes-eventos").order("display_order");
    setCategories((data || []) as Category[]);
    setLoading(false);
  };

  const generateSlug = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleAdd = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.display_order)) : 0;
    const { error } = await supabase.from("artes_categories").insert({ name, slug: generateSlug(name), display_order: maxOrder + 1, is_active: isActive, platform: "artes-eventos" });
    if (error) toast.error(error.message); else { toast.success("Categoria criada!"); setIsAddOpen(false); setName(""); fetchCategories(); }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editingCat || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("artes_categories").update({ name, slug: generateSlug(name), is_active: isActive }).eq("id", editingCat.id);
    if (error) toast.error(error.message); else { toast.success("Atualizada!"); setEditingCat(null); setName(""); fetchCategories(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar esta categoria?")) return;
    const { error } = await supabase.from("artes_categories").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deletada!"); fetchCategories(); }
  };

  const openEdit = (cat: Category) => { setEditingCat(cat); setName(cat.name); setIsActive(cat.is_active); };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate("/admin-artes-eventos")} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-3xl font-bold text-foreground">Categorias</h1><p className="text-muted-foreground">{categories.length} categorias</p></div>
          <Button onClick={() => { setIsAddOpen(true); setName(""); setIsActive(true); }}><Plus className="mr-2 h-4 w-4" />Nova Categoria</Button>
        </div>
        <div className="space-y-3">
          {categories.map(cat => (
            <Card key={cat.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                <div>
                  <p className="font-semibold text-foreground">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.slug}</p>
                </div>
                {!cat.is_active && <Badge variant="secondary">Inativa</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(cat.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={isAddOpen || !!editingCat} onOpenChange={o => { if (!o) { setIsAddOpen(false); setEditingCat(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativa</Label></div>
              <Button onClick={editingCat ? handleEdit : handleAdd} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCategoriesArtes;
