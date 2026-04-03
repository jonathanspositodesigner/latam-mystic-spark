import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Upload, Eye, EyeOff, Package } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ToolVersionEditor, { type ToolVersion } from "@/components/ToolVersionEditor";

const PACK_SLUG = "upscaller-arcano-vitalicio";
const WEBHOOK_URL = `https://nqebjeyyslscxnjvsysb.supabase.co/functions/v1/webhook-greenn-artes`;

interface Pack {
  id: string;
  name: string;
  slug: string;
  cover_url: string | null;
  is_visible: boolean;
  tool_versions: ToolVersion[] | null;
  tutorial_lessons: any[] | null;
}

const createVersionTemplate = ({
  id,
  name,
  slug,
  displayOrder,
  badges = [],
}: {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  badges?: ToolVersion["badges"];
}): ToolVersion => ({
  id,
  name,
  slug,
  cover_url: null,
  display_order: displayOrder,
  is_visible: true,
  unlock_days: 0,
  badges: badges.map((badge) => ({ ...badge })),
  lessons: [],
  webhook: {
    greenn_product_id_6_meses: null,
    greenn_product_id_1_ano: null,
    greenn_product_id_order_bump: null,
    greenn_product_id_vitalicio: null,
  },
  sales: {
    price_6_meses: null,
    price_1_ano: null,
    price_vitalicio: null,
    enabled_6_meses: true,
    enabled_1_ano: true,
    enabled_vitalicio: true,
    checkout_link_6_meses: null,
    checkout_link_1_ano: null,
    checkout_link_vitalicio: null,
    checkout_link_renovacao_6_meses: null,
    checkout_link_renovacao_1_ano: null,
    checkout_link_renovacao_vitalicio: null,
    checkout_link_membro_6_meses: null,
    checkout_link_membro_1_ano: null,
    checkout_link_membro_vitalicio: null,
  },
});

const cloneVersion = (version: ToolVersion): ToolVersion => ({
  ...version,
  badges: version.badges.map((badge) => ({ ...badge })),
  lessons: version.lessons.map((lesson) => ({
    ...lesson,
    buttons: (lesson.buttons ?? []).map((button) => ({ ...button })),
  })),
  webhook: { ...version.webhook },
  sales: { ...version.sales },
});

const DEFAULT_TOOL_VERSIONS: ToolVersion[] = [
  createVersionTemplate({
    id: "v2",
    name: "V2.5",
    slug: "v2",
    displayOrder: 0,
    badges: [
      { text: "NUEVO", icon: "sparkles", color: "yellow" },
      { text: "MÁS RÁPIDO", icon: "zap", color: "blue" },
      { text: "MAYOR FIDELIDAD", icon: "target", color: "purple" },
    ],
  }),
  createVersionTemplate({
    id: "v1",
    name: "V1.5",
    slug: "v1",
    displayOrder: 1,
  }),
];

const getDefaultToolVersions = () => DEFAULT_TOOL_VERSIONS.map(cloneVersion);

const AdminUpscalerVitalicio = () => {
  const navigate = useNavigate();
  const [pack, setPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Tool Version States
  const [toolVersions, setToolVersions] = useState<ToolVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [versionCoverFile, setVersionCoverFile] = useState<File | null>(null);
  const [versionCoverPreview, setVersionCoverPreview] = useState<string | null>(null);

  // Pack cover
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [packName, setPackName] = useState("");
  const [packSlug, setPackSlug] = useState("");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/admin-login'); return; }
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) { toast.error("Acesso negado."); navigate('/'); return; }
    await fetchPack();
  };

  const applyPackState = (packData: Pack) => {
    setPack(packData);
    setPackName(packData.name);
    setPackSlug(packData.slug);
    setCoverPreview(packData.cover_url);
    const versions = packData.tool_versions as ToolVersion[] | null;
    setToolVersions(versions?.length ? versions.map(cloneVersion) : getDefaultToolVersions());
    setSelectedVersionIndex(0);
    setVersionCoverFile(null);
    setVersionCoverPreview(null);
  };

  const fetchPack = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("artes_packs")
        .select("id, name, slug, cover_url, is_visible, tool_versions, tutorial_lessons")
        .eq("slug", PACK_SLUG)
        .maybeSingle();

      if (data) {
        applyPackState(data);
      } else {
        const { data: createdPack, error: createError } = await supabase
          .from("artes_packs")
          .insert({
            name: "Upscaler Arcano Vitalício",
            slug: PACK_SLUG,
            type: "ferramenta",
            is_visible: true,
            tool_versions: getDefaultToolVersions() as any,
          })
          .select("id, name, slug, cover_url, is_visible, tool_versions, tutorial_lessons")
          .single();

        if (createError) throw createError;
        if (!createdPack) throw new Error("Pack não retornado após criação");

        applyPackState(createdPack as unknown as Pack);
        toast.success("Pack criado com as versões V2.5 e V1.5.");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar o pack");
      setPack(null);
      setPackName("Upscaler Arcano Vitalício");
      setPackSlug(PACK_SLUG);
      setCoverPreview(null);
      setToolVersions(getDefaultToolVersions());
    } finally {
      setLoading(false);
    }
  };

  const createEmptyVersion = (versionNumber: number): ToolVersion => createVersionTemplate({
    id: `v${versionNumber}`,
    name: `V${versionNumber}`,
    slug: `v${versionNumber}`,
    displayOrder: versionNumber - 1,
  });

  const handleCreatePack = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("artes_packs")
        .insert({
          name: "Upscaler Arcano Vitalício",
          slug: PACK_SLUG,
          type: "ferramenta",
          is_visible: true,
          tool_versions: getDefaultToolVersions() as any,
        });

      if (error) throw error;
      toast.success("Pack criado com sucesso!");
      await fetchPack();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar pack");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!pack) return;
    try {
      const { error } = await supabase
        .from("artes_packs")
        .update({ is_visible: !pack.is_visible })
        .eq("id", pack.id);
      if (error) throw error;
      toast.success(pack.is_visible ? "Pack ocultado" : "Pack visível");
      fetchPack();
    } catch (error: any) {
      toast.error("Erro ao alterar visibilidade");
    }
  };

  const handleSavePackInfo = async () => {
    if (!pack) return;
    setSaving(true);
    try {
      let coverUrl = pack.cover_url;
      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const fileName = `${pack.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("pack-covers")
          .upload(fileName, coverFile, { upsert: true });
        if (!uploadError) {
          const { data } = supabase.storage.from("pack-covers").getPublicUrl(fileName);
          coverUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from("artes_packs")
        .update({ name: packName, slug: packSlug, cover_url: coverUrl })
        .eq("id", pack.id);
      if (error) throw error;
      toast.success("Informações salvas!");
      setCoverFile(null);
      fetchPack();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const addToolVersion = () => {
    const newVersionNumber = toolVersions.length + 1;
    const newVersion = createEmptyVersion(newVersionNumber);
    setToolVersions([...toolVersions, newVersion]);
    setSelectedVersionIndex(toolVersions.length);
    setVersionCoverFile(null);
    setVersionCoverPreview(null);
    toast.success(`Versão ${newVersion.name} criada!`);
  };

  const updateToolVersion = (index: number, updates: Partial<ToolVersion>) => {
    const updated = [...toolVersions];
    updated[index] = { ...updated[index], ...updates };
    setToolVersions(updated);
  };

  const removeToolVersion = (index: number) => {
    if (toolVersions.length <= 1) {
      toast.error("É necessário ter pelo menos uma versão");
      return;
    }
    const updated = toolVersions.filter((_, i) => i !== index);
    updated.forEach((v, i) => { v.display_order = i; });
    setToolVersions(updated);
    setSelectedVersionIndex(Math.max(0, index - 1));
    toast.success("Versão removida");
  };

  const handleSaveToolVersions = async () => {
    if (!pack) return;
    setSaving(true);
    try {
      // Upload version cover if there's a new one
      if (versionCoverFile && toolVersions[selectedVersionIndex]) {
        const fileExt = versionCoverFile.name.split(".").pop();
        const fileName = `${pack.id}-${toolVersions[selectedVersionIndex].id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("pack-covers")
          .upload(fileName, versionCoverFile, { upsert: true });
        if (!uploadError) {
          const { data } = supabase.storage.from("pack-covers").getPublicUrl(fileName);
          const updated = [...toolVersions];
          updated[selectedVersionIndex] = { ...updated[selectedVersionIndex], cover_url: data.publicUrl };
          setToolVersions(updated);

          const { error } = await supabase
            .from("artes_packs")
            .update({ tool_versions: updated as any })
            .eq("id", pack.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("artes_packs")
          .update({ tool_versions: toolVersions as any })
          .eq("id", pack.id);
        if (error) throw error;
      }

      toast.success("Versões salvas com sucesso!");
      setVersionCoverFile(null);
      fetchPack();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar versões");
    } finally {
      setSaving(false);
    }
  };

  const handleVersionCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem deve ter no máximo 5MB");
        return;
      }
      setVersionCoverFile(file);
      setVersionCoverPreview(URL.createObjectURL(file));
    }
  };

  const handlePackCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem deve ter no máximo 5MB");
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-hub")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Upscaler Arcano Vitalício</h1>
            <p className="text-xs text-muted-foreground">Gerenciar versões, aulas e configurações</p>
          </div>
        </div>
        {pack && (
          <Button variant="outline" size="sm" onClick={handleToggleVisibility}>
            {pack.is_visible ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {pack.is_visible ? "Visível" : "Oculto"}
          </Button>
        )}
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto">
        {!pack ? (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground mb-2">Pack não encontrado</h2>
            <p className="text-muted-foreground mb-6">
              O pack "Upscaler Arcano Vitalício" ainda não foi criado na tabela artes_packs.
            </p>
            <Button onClick={handleCreatePack} disabled={saving}>
              {saving ? "Criando..." : "Criar Pack Agora"}
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Pack Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Informações do Pack
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome</Label>
                    <Input value={packName} onChange={(e) => setPackName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={packSlug} onChange={(e) => setPackSlug(e.target.value)} />
                  </div>
                </div>

                {/* Cover */}
                <div>
                  <Label>Capa do Pack</Label>
                  <div className="mt-2">
                    {coverPreview ? (
                      <div className="relative">
                        <img src={coverPreview} alt="Cover" className="w-full h-48 object-cover rounded-lg" />
                        <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => { setCoverPreview(null); setCoverFile(null); }}>
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Clique para enviar</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handlePackCoverChange} />
                      </label>
                    )}
                  </div>
                </div>

                <Button onClick={handleSavePackInfo} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Informações"}
                </Button>
              </CardContent>
            </Card>

            {/* Version Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Versões & Aulas</CardTitle>
              </CardHeader>
              <CardContent>
                <ToolVersionEditor
                  versions={toolVersions}
                  selectedIndex={selectedVersionIndex}
                  onSelectVersion={setSelectedVersionIndex}
                  onAddVersion={addToolVersion}
                  onUpdateVersion={updateToolVersion}
                  onRemoveVersion={removeToolVersion}
                  onSave={handleSaveToolVersions}
                  saving={saving}
                  coverPreview={versionCoverPreview}
                  onCoverChange={handleVersionCoverChange}
                  onClearCover={() => { setVersionCoverFile(null); setVersionCoverPreview(null); }}
                  webhookUrl={WEBHOOK_URL}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminUpscalerVitalicio;
