import { useEffect, useState, useMemo, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, ExternalLink, Lock, AlertTriangle, ChevronRight, CheckCircle2, Circle, Trophy, ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePremiumArtesStatus } from "@/hooks/usePremiumArtesStatus";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import AppLayout from "@/components/layout/AppLayout";

interface TutorialLesson {
  title: string;
  description: string;
  videoUrl: string;
  buttons: { text: string; url: string }[];
}

interface ToolVersion {
  id: string;
  name: string;
  slug: string;
  cover_url: string | null;
  display_order: number;
  is_visible: boolean;
  unlock_days: number;
  badges: { text: string; icon: string; color: string }[];
  lessons: TutorialLesson[];
  localized?: {
    es?: { name?: string; lessons?: TutorialLesson[] };
  };
}

const getVideoEmbedUrl = (videoUrl: string): string | null => {
  if (!videoUrl) return null;
  if (videoUrl.includes("<iframe")) {
    const srcMatch = videoUrl.match(/src="([^"]+)"/);
    return srcMatch?.[1] || null;
  }
  if (videoUrl.includes("/embed/")) return videoUrl;
  if (videoUrl.includes("youtube.com/watch")) {
    const videoId = new URL(videoUrl).searchParams.get("v");
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (videoUrl.includes("youtu.be/")) {
    const videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  return videoUrl;
};

const getToolLinkFromLessons = (lessons: TutorialLesson[]): string | null => {
  for (const lesson of lessons) {
    if (lesson.buttons) {
      const toolButton = lesson.buttons.find((b) =>
        ["link", "acces", "herramienta", "ferramenta", "tool"].some((k) => b.text.toLowerCase().includes(k))
      );
      if (toolButton) return toolButton.url;
    }
  }
  return null;
};

const ToolVersionLessons = () => {
  const { toolSlug, versionSlug } = useParams<{ toolSlug: string; versionSlug: string }>();
  const navigate = useNavigate();
  const { user, hasAccessToPack, isLoading: premiumLoading } = usePremiumArtesStatus();
  const { planType } = usePremiumStatus();

  const [videoLoading, setVideoLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<ToolVersion | null>(null);
  const [toolName, setToolName] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(0);

  const [watchedLessons, setWatchedLessons] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(`watched_lessons_${toolSlug}_${versionSlug}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const lessons = useMemo(() => {
    if (!version) return [];
    // Prefer Spanish localized lessons
    if (version.localized?.es?.lessons && version.localized.es.lessons.length > 0) {
      return version.localized.es.lessons;
    }
    return version.lessons || [];
  }, [version]);

  const versionName = useMemo(() => {
    if (!version) return "";
    return version.localized?.es?.name || version.name;
  }, [version]);

  const toolLink = useMemo(() => getToolLinkFromLessons(lessons), [lessons]);
  const currentEmbedUrl = useMemo(() => {
    const lesson = lessons[selectedLesson];
    if (!lesson?.videoUrl) return null;
    return getVideoEmbedUrl(lesson.videoUrl);
  }, [lessons, selectedLesson]);

  useEffect(() => { setVideoLoading(true); }, [selectedLesson]);

  const totalLessons = lessons.length;
  const isToolUnlocked = useMemo(() => {
    return totalLessons > 0 && Array.from({ length: totalLessons }, (_, i) => i + 1).every((n) => watchedLessons.includes(n));
  }, [watchedLessons, totalLessons]);
  const progressCount = useMemo(() => Math.min(watchedLessons.filter((n) => n <= totalLessons).length, totalLessons), [watchedLessons, totalLessons]);

  const toggleWatchedStatus = (lessonNum: number) => {
    const updated = watchedLessons.includes(lessonNum) ? watchedLessons.filter((n) => n !== lessonNum) : [...watchedLessons, lessonNum];
    setWatchedLessons(updated);
    localStorage.setItem(`watched_lessons_${toolSlug}_${versionSlug}`, JSON.stringify(updated));
  };

  const isToolAccessButton = (text: string) => ["link", "ferramenta", "herramienta", "acces", "tool"].some((k) => text.toLowerCase().includes(k));

  const handleToolButtonClick = (url: string) => {
    if (isToolUnlocked) { window.open(url, "_blank"); return; }
    setPendingUrl(url);
    setShowWarningModal(true);
  };

  useEffect(() => {
    if (isToolUnlocked && !justUnlocked) {
      const wasUnlocked = localStorage.getItem(`tool_unlocked_${toolSlug}_${versionSlug}`);
      if (!wasUnlocked) {
        setShowConfetti(true);
        setJustUnlocked(true);
        localStorage.setItem(`tool_unlocked_${toolSlug}_${versionSlug}`, "true");
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }
  }, [isToolUnlocked, justUnlocked, toolSlug, versionSlug]);

  useEffect(() => {
    const fetchVersionData = async () => {
      if (!toolSlug || !versionSlug) return;
      try {
        const { data, error } = await supabase
          .from("artes_packs")
          .select("name, tool_versions")
          .eq("slug", toolSlug)
          .single();
        if (error) throw error;
        if (data) {
          setToolName(data.name);
          const versions = data.tool_versions as unknown as ToolVersion[] | null;
          if (versions?.length) {
            const found = versions.find((v) => v.slug === versionSlug);
            if (found) setVersion(found);
          }
        }
      } catch (err) {
        console.error("Error fetching version data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVersionData();
  }, [toolSlug, versionSlug]);

  if (loading || premiumLoading) {
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
          <h1 className="text-2xl font-bold text-foreground">{toolName}</h1>
          <p className="text-muted-foreground">Inicia sesión para acceder a las clases</p>
          <Button onClick={() => navigate("/")} className="bg-gradient-to-r from-purple-600 to-blue-500">Iniciar sesión</Button>
        </div>
      </div>
    );
  }

  const hasUnlimitedAccess = planType === "arcano_unlimited";
  const hasAccess = (() => {
    if (hasUnlimitedAccess) return true;
    if (toolSlug === "upscaller-arcano" || toolSlug === "upscaller-arcano-vitalicio") {
      if (versionSlug === "v3") return hasAccessToPack("upscaller-arcano-v3");
      return hasAccessToPack("upscaller-arcano") || hasAccessToPack("upscaller-arcano-v3") || hasAccessToPack("upscaller-arcano-vitalicio");
    }
    return toolSlug ? hasAccessToPack(toolSlug) : false;
  })();

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-2xl text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">{toolName}</h1>
          <p className="text-muted-foreground">No tienes acceso a esta herramienta</p>
          <Button onClick={() => navigate("/upscaler-arcano")} className="bg-gradient-to-r from-purple-600 to-blue-500">
            Ver versiones
          </Button>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-2xl text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Versión no encontrada</h1>
          <p className="text-muted-foreground">Esta versión no existe o fue removida</p>
          <Button onClick={() => navigate(`/upscaler-arcano`)} className="bg-gradient-to-r from-purple-600 to-blue-500">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  const currentLesson = lessons[selectedLesson];
  const isStandalone = toolSlug === "upscaller-arcano" || toolSlug === "upscaller-arcano-vitalicio";

  const Wrapper = ({ children }: { children: ReactNode }) => {
    if (isStandalone) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
            <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
              <Button variant="ghost" size="sm" onClick={() => navigate("/upscaler-arcano")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
              <h1 className="text-sm md:text-base font-bold text-foreground absolute left-1/2 -translate-x-1/2">
                {toolName || "Upscaler Arcano"}
              </h1>
              <div />
            </div>
          </header>
          {children}
        </div>
      );
    }
    return <AppLayout>{children}</AppLayout>;
  };

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="text-6xl animate-bounce">🎉</div>
            <div className="absolute text-5xl animate-ping" style={{ animationDelay: "0.1s" }}>✨</div>
          </div>
        )}

        {/* Progress Bar */}
        {lessons.length >= 1 && (
          <div className="mb-6 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Recorrido del Maestro
              </span>
              <span className="text-xs text-muted-foreground">
                {progressCount} de {totalLessons} clases completadas
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-violet-500 to-purple-400 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${totalLessons > 0 ? (progressCount / totalLessons) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {lessons.map((lesson, idx) => {
                const lessonNum = idx + 1;
                const isWatched = watchedLessons.includes(lessonNum);
                const isSelected = selectedLesson === idx;
                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedLesson(idx)}
                          className={`flex flex-col items-center gap-1 transition-all ${isSelected ? "scale-110" : "hover:scale-105"}`}
                        >
                          {isWatched ? (
                            <CheckCircle2 className={`h-5 w-5 ${isSelected ? "text-green-400" : "text-green-500/70"}`} />
                          ) : (
                            <Circle className={`h-5 w-5 ${isSelected ? "text-purple-400" : "text-muted-foreground"}`} />
                          )}
                          <span className={`text-[10px] ${isSelected ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                            {lessonNum}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">{lesson.title}</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden bg-card border-border">
              <div className="aspect-video bg-black relative">
                {currentEmbedUrl ? (
                  <>
                    {videoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    )}
                    <iframe
                      src={currentEmbedUrl}
                      title={currentLesson?.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      onLoad={() => setVideoLoading(false)}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Play className="h-12 w-12" />
                  </div>
                )}
              </div>

              {currentLesson && (
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-foreground">{currentLesson.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{currentLesson.description}</p>
                    </div>
                    <button
                      onClick={() => toggleWatchedStatus(selectedLesson + 1)}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        watchedLessons.includes(selectedLesson + 1)
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {watchedLessons.includes(selectedLesson + 1) ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {currentLesson.buttons?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {currentLesson.buttons.map((btn, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={isToolAccessButton(btn.text) ? "default" : "outline"}
                          onClick={() =>
                            isToolAccessButton(btn.text) ? handleToolButtonClick(btn.url) : window.open(btn.url, "_blank")
                          }
                          className={isToolAccessButton(btn.text) ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white" : ""}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {btn.text}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Lesson List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Clases — {versionName}
            </h3>
            {lessons.map((lesson, idx) => {
              const lessonNum = idx + 1;
              const isWatched = watchedLessons.includes(lessonNum);
              const isSelected = selectedLesson === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedLesson(idx)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    isSelected ? "bg-purple-500/20 border border-purple-500/30" : "bg-card border border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isWatched ? "bg-green-500/20 text-green-400" : isSelected ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {isWatched ? <CheckCircle2 className="h-4 w-4" /> : lessonNum}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? "text-foreground" : "text-foreground/80"}`}>
                        {lesson.title}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Tool Access Button */}
            {toolLink && (
              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  onClick={() => handleToolButtonClick(toolLink)}
                  className={`w-full ${
                    isToolUnlocked
                      ? "bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white"
                      : "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                  }`}
                >
                  {isToolUnlocked ? (
                    <>Acceder a la Herramienta <ChevronRight className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-1" />
                      Completa las clases para desbloquear
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Modal */}
      <AlertDialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ¿Acceder sin completar las clases?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Recomendamos ver todas las clases antes de usar la herramienta para obtener mejores resultados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowWarningModal(false); setPendingUrl(null); }}>
              Seguir viendo
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingUrl) window.open(pendingUrl, "_blank"); setShowWarningModal(false); setPendingUrl(null); }}
              className="bg-gradient-to-r from-purple-600 to-blue-500 text-white"
            >
              Acceder de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Wrapper>
  );
};

export default ToolVersionLessons;
