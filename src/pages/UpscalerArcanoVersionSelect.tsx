import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Sparkles, Zap, Target, Star, ChevronRight } from "lucide-react";
import { usePremiumArtesStatus } from "@/hooks/usePremiumArtesStatus";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";

interface ToolVersionBadge {
  text: string;
  icon: "sparkles" | "zap" | "target" | "star";
  color: "yellow" | "blue" | "purple" | "green" | "orange";
}

interface ToolVersion {
  id: string;
  name: string;
  slug: string;
  cover_url: string | null;
  display_order: number;
  is_visible: boolean;
  badges: ToolVersionBadge[];
}

const ICON_MAP: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  zap: Zap,
  target: Target,
  star: Star,
};

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-500/30 text-yellow-300",
  blue: "bg-blue-500/30 text-blue-300",
  purple: "bg-purple-500/30 text-purple-300",
  green: "bg-green-500/30 text-green-300",
  orange: "bg-orange-500/30 text-orange-300",
  gray: "bg-gray-500/30 text-gray-300",
};

const UpscalerArcanoVersionSelect = () => {
  const navigate = useNavigate();
  const { user, hasAccessToPack, isLoading: premiumLoading } = usePremiumArtesStatus();
  const { planType, isLoading: statusLoading } = usePremiumStatus();

  const [versions, setVersions] = useState<ToolVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);

  const hasUnlimitedAccess = planType === "arcano_unlimited";
  const hasUpscalerPack = hasAccessToPack("upscaller-arcano");
  const hasVitalicioPack = hasAccessToPack("upscaller-arcano-vitalicio");
  const hasV3Pack = hasAccessToPack("upscaller-arcano-v3");
  const hasNonV3Access = hasUnlimitedAccess || hasUpscalerPack || hasVitalicioPack || hasV3Pack;

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const { data, error } = await supabase
          .from("artes_packs")
          .select("slug, tool_versions")
          .in("slug", ["upscaller-arcano-vitalicio", "upscaller-arcano"]);

        if (error) throw error;

        const packWithVersions = data?.find(
          (pack) => Array.isArray(pack.tool_versions) && pack.tool_versions.length > 0 && pack.slug === "upscaller-arcano-vitalicio"
        )
          ?? data?.find((pack) => Array.isArray(pack.tool_versions) && pack.tool_versions.length > 0);

        const dbVersions = (packWithVersions?.tool_versions as unknown as ToolVersion[] | null) ?? [];
        const visibleVersions = dbVersions
          .filter((version) => version.is_visible)
          .sort((a, b) => a.display_order - b.display_order);

        setVersions(visibleVersions);
      } catch {
        setVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    };

    fetchVersions();
  }, []);

  const isLoading = premiumLoading || statusLoading || loadingVersions;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-2xl text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Upscaler Arcano</h1>
          <p className="text-muted-foreground">Inicia sesión para acceder a las clases</p>
          <Button onClick={() => navigate("/")} className="bg-gradient-to-r from-purple-600 to-blue-500">
            Iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  const handleVersionClick = (version: ToolVersion) => {
    navigate(`/ferramenta-ia-artes/upscaller-arcano-vitalicio/${version.slug}`);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Upscaler Arcano</h1>
        <p className="text-muted-foreground mb-6">Selecciona una versión para acceder a las clases</p>

        {versions.length === 0 ? (
          <Card className="border-border bg-card">
            <div className="p-6 text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Nenhuma versão disponível</h2>
              <p className="text-sm text-muted-foreground">
                As versões do Upscaler Vitalício ainda não foram configuradas no painel administrativo.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {versions.map((version) => {
              const isV3 = version.name.toLowerCase().includes("v3") || version.slug === "v3";
              const hasVersionAccess = isV3 ? hasV3Pack || hasUnlimitedAccess : hasNonV3Access;

              return (
                <Card
                  key={version.id + "-" + version.name}
                  className={`relative overflow-hidden transition-all duration-300 ${
                    hasVersionAccess
                      ? "cursor-pointer group border-purple-500/30 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10"
                      : "border-muted"
                  } bg-card`}
                  onClick={() => hasVersionAccess && handleVersionClick(version)}
                >
                  <div className="aspect-[3/4] overflow-hidden relative bg-gradient-to-br from-purple-900/50 to-purple-800/30">
                    {version.cover_url ? (
                      <img
                        src={version.cover_url}
                        alt={`Upscaler Arcano ${version.name}`}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          hasVersionAccess ? "group-hover:scale-105" : "grayscale opacity-60"
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className={`h-16 w-16 ${hasVersionAccess ? "text-purple-400" : "text-muted-foreground"}`} />
                      </div>
                    )}

                    {version.badges?.length > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/70 to-transparent">
                        {version.badges.map((badge, i) => {
                          const Icon = ICON_MAP[badge.icon] || Sparkles;
                          const colorClass = COLOR_MAP[badge.color] || COLOR_MAP.yellow;
                          return (
                            <div key={i} className={`flex items-center gap-1 ${colorClass} backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-medium`}>
                              <Icon className="h-2.5 w-2.5" />
                              {badge.text}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 right-4">
                    {!hasVersionAccess ? (
                      <div className="flex items-center gap-1.5 bg-yellow-500/20 backdrop-blur-sm text-yellow-300 px-3 py-1 rounded-full text-xs font-medium">
                        <Lock className="h-3 w-3" />
                        Próximamente
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-green-500/20 backdrop-blur-sm text-green-400 px-3 py-1 rounded-full text-xs font-medium">
                        <Unlock className="h-3 w-3" />
                        Disponible
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 left-4">
                    <div className={`px-4 py-1.5 rounded-full text-sm font-black shadow-lg ${hasVersionAccess ? "bg-white text-purple-900" : "bg-muted text-muted-foreground"}`}>
                      {version.name}
                    </div>
                  </div>

                  <div className="p-4">
                    <h2 className={`text-lg md:text-xl font-bold mb-3 ${hasVersionAccess ? "text-foreground" : "text-muted-foreground"}`}>
                      Upscaler Arcano {isV3 ? "V3" : ""}
                    </h2>
                    <Button
                      disabled={!hasVersionAccess}
                      className={`w-full ${
                        hasVersionAccess
                          ? "bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasVersionAccess) return;
                        navigate(`/ferramenta-ia-artes/upscaller-arcano-vitalicio/${version.slug}`);
                      }}
                    >
                      {hasVersionAccess ? (
                        <>
                          Acceder a Clases <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>Próximamente</>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UpscalerArcanoVersionSelect;
