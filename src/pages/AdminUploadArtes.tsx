import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, ArrowLeft, X, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface MediaData {
  file: File;
  preview: string;
  title: string;
  description: string;
  category: string;
  pack: string;
  isPremium: boolean;
  canvaLink: string;
  driveLink: string;
}

const AdminUploadArtes = () => {
  const navigate = useNavigate();
  const [mediaFiles, setMediaFiles] = useState<MediaData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [packs, setPacks] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [catRes, packRes] = await Promise.all([
        supabase.from('artes_categories').select('id, name').order('display_order'),
        supabase.from('artes_packs').select('id, name').order('display_order'),
      ]);
      setCategories(catRes.data || []);
      setPacks(packRes.data || []);
    };
    fetchData();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    const newMedia: MediaData[] = files
      .filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .map(file => ({
        file,
        preview: URL.createObjectURL(file),
        title: "", description: "", category: "", pack: "",
        isPremium: false, canvaLink: "", driveLink: ""
      }));
    if (newMedia.length > 0) {
      setMediaFiles(prev => [...prev, ...newMedia]);
      setShowModal(true);
      setCurrentIndex(0);
    }
  };

  const updateMediaData = (field: keyof MediaData, value: string | boolean) => {
    setMediaFiles(prev => prev.map((m, i) => i === currentIndex ? { ...m, [field]: value } : m));
  };

  const handleSaveSingle = async () => {
    const media = mediaFiles[currentIndex];
    if (!media.title.trim() || !media.category || !media.pack) {
      toast.error("Título, categoria e pack são obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      const ext = media.file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('admin-artes').upload(fileName, media.file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('admin-artes').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('admin_artes').insert({
        title: media.title.charAt(0).toUpperCase() + media.title.slice(1).toLowerCase(),
        description: media.description || null,
        category: media.category,
        pack: media.pack,
        image_url: publicUrl,
        is_premium: media.isPremium,
        canva_link: media.canvaLink || null,
        drive_link: media.driveLink || null,
      });
      if (insertError) throw insertError;

      setMediaFiles(prev => prev.filter((_, i) => i !== currentIndex));
      setShowModal(false);
      toast.success(`"${media.title}" enviado com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMedia = mediaFiles[currentIndex];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate("/admin-artes-eventos")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>

        <Card className="p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Upload de Artes</h1>
          <p className="text-muted-foreground mb-6">Envio de administrador - Artes para eventos</p>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); processFiles(Array.from(e.dataTransfer.files)); }}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
          >
            <input id="media" type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
            <label htmlFor="media" className="cursor-pointer">
              <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-foreground mb-2">Arraste imagens aqui ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground">Você pode enviar vários arquivos de uma vez</p>
            </label>
          </div>

          {mediaFiles.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Arquivos: {mediaFiles.length}</h3>
              <div className="grid grid-cols-4 gap-4">
                {mediaFiles.map((m, i) => (
                  <div key={i} className="relative group cursor-pointer" onClick={() => { setCurrentIndex(i); setShowModal(true); }}>
                    <img src={m.preview} alt="" className="w-full h-32 object-cover rounded-lg hover:ring-2 hover:ring-primary" />
                    <button onClick={e => { e.stopPropagation(); setMediaFiles(prev => prev.filter((_, j) => j !== i)); }}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Arte ({currentIndex + 1}/{mediaFiles.length})</DialogTitle>
            </DialogHeader>
            {currentMedia && (
              <div className="space-y-4">
                <img src={currentMedia.preview} alt="" className="w-full h-48 object-cover rounded-lg" />
                <div><Label>Título *</Label><Input value={currentMedia.title} onChange={e => updateMediaData("title", e.target.value)} /></div>
                <div><Label>Descrição</Label><Textarea value={currentMedia.description} onChange={e => updateMediaData("description", e.target.value)} /></div>
                <div><Label>Categoria *</Label>
                  <Select value={currentMedia.category} onValueChange={v => updateMediaData("category", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Pack *</Label>
                  <Select value={currentMedia.pack} onValueChange={v => updateMediaData("pack", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{packs.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Link Canva</Label><Input value={currentMedia.canvaLink} onChange={e => updateMediaData("canvaLink", e.target.value)} /></div>
                <div><Label>Link Drive</Label><Input value={currentMedia.driveLink} onChange={e => updateMediaData("driveLink", e.target.value)} /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={currentMedia.isPremium} onCheckedChange={v => updateMediaData("isPremium", v)} />
                  <Label className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />Premium</Label>
                </div>
                <div className="flex gap-2">
                  {currentIndex > 0 && <Button variant="outline" onClick={() => setCurrentIndex(i => i - 1)}>Anterior</Button>}
                  {currentIndex < mediaFiles.length - 1 && <Button variant="outline" onClick={() => setCurrentIndex(i => i + 1)}>Próximo</Button>}
                  <Button onClick={handleSaveSingle} disabled={isSubmitting} className="ml-auto">
                    {isSubmitting ? "Enviando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminUploadArtes;
