import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { usePremiumArtesStatus } from "@/hooks/usePremiumArtesStatus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Lock, Settings, LogOut, Coins, Star, MessageCircle } from "lucide-react";
import { useCredits } from "@/contexts/CreditsContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import VideoBanner from "@/components/dashboard/VideoBanner";
import UpscalerArcanoCard from "@/components/dashboard/UpscalerArcanoCard";
import UpscalerCreditosCard from "@/components/dashboard/UpscalerCreditosCard";
import FlyerMakerCard from "@/components/dashboard/FlyerMakerCard";
import CreditsPreviewPopover from "@/components/credits/CreditsPreviewPopover";

const VITALICIO_SLUGS = [
  "upscaller-arcano-v3",
  "upscaller-arcano",
  "upscaller-arcano-vitalicio",
];

const CREDITOS_SLUGS = [
  "upscaler-creditos-starter",
  "upscaler-creditos-pro",
  "upscaler-creditos-ultimate",
];

const FLYER_SLUGS = [
  "flyer-maker-pro-7k",
  "flyer-maker-ultimate-14k",
  "flyer-maker-unlimited",
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isPremium, planType, logout } = usePremiumStatus();
  const { hasAccessToPack, isLoading: premiumArtesLoading, packSlugs } = usePremiumArtesStatus();
  const { balance: credits, isLoading: creditsLoading } = useCredits();
  const [userProfile, setUserProfile] = useState<{ name?: string; phone?: string } | null>(null);

  // Centralised purchase state — single source of truth
  const upscalerAccess = useMemo(() => {
    const hasVitalicio = VITALICIO_SLUGS.some((slug) => hasAccessToPack(slug));
    const hasCreditos = CREDITOS_SLUGS.some((slug) => hasAccessToPack(slug));
    return {
      hasAccess: hasVitalicio || hasCreditos,
      type: hasVitalicio ? "vitalicio" : hasCreditos ? "creditos" : "none"
    };
  }, [hasAccessToPack]);

  const flyerAccess = useMemo(() => {
    const hasPro = hasAccessToPack("flyer-maker-pro-7k");
    const hasUltimate = hasAccessToPack("flyer-maker-ultimate-14k");
    const hasUnlimited = hasAccessToPack("flyer-maker-unlimited");
    
    return {
      hasAccess: hasPro || hasUltimate || hasUnlimited,
      isUnlimited: hasUnlimited,
      label: hasUnlimited ? "Plan Unlimited" : hasUltimate ? "Plan Ultimate" : hasPro ? "Plan Pro" : ""
    };
  }, [hasAccessToPack]);

  const purchaseState = useMemo(() => {
    if (premiumArtesLoading) return "loading" as const;
    if (upscalerAccess.hasAccess || flyerAccess.hasAccess) return "active" as const;
    return "none" as const;
  }, [premiumArtesLoading, upscalerAccess, flyerAccess]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("name, phone")
        .eq("id", user.id)
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-[hsl(270,60%,4%)]">
      {/* Top bar */}
      <header className="bg-[hsl(270,60%,4%)]/80 backdrop-blur-lg border-b border-purple-500/20 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <h1
          className="text-lg font-bold text-white cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/dashboard")}
        >
          ArcanoApp
        </h1>
        <div className="flex items-center gap-3">
          {user && <CreditsPreviewPopover userId={user.id} variant="desktop" />}
          <a
            href="https://api.whatsapp.com/send/?phone=5533988819891&text&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            title="Soporte"
          >
            <Button variant="ghost" size="icon" className="text-purple-300 hover:text-white hover:bg-purple-500/20 rounded-full">
              <MessageCircle className="w-5 h-5" />
            </Button>
          </a>
          {isPremium && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
              <Star className="h-3 w-3 mr-1" fill="currentColor" />
              Premium
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-purple-300 hover:text-white hover:bg-purple-500/20 rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#1A0A2E] border-purple-500/30 text-white">
              <DropdownMenuLabel className="text-purple-200">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{userProfile?.name || user?.email?.split("@")[0] || "Mi Perfil"}</span>
                  <span className="text-xs text-purple-400 font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-purple-500/20" />
              <div className="px-2 py-2 flex items-center justify-between">
                <span className="text-sm text-purple-300 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-400" />Créditos
                </span>
                <Badge className="bg-purple-600 text-white">{creditsLoading ? "..." : credits.toLocaleString("es")}</Badge>
              </div>
              <DropdownMenuSeparator className="bg-purple-500/20" />
              <DropdownMenuItem onClick={() => navigate("/cambiar-contrasena")} className="cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20">
                <Lock className="w-4 h-4 mr-2" />Cambiar Contraseña
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/configuracion")} className="cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20">
                <Settings className="w-4 h-4 mr-2" />Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-purple-500/20" />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-400 hover:bg-red-500/20 focus:bg-red-500/20 focus:text-red-400">
                <LogOut className="w-4 h-4 mr-2" />Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <VideoBanner />

          {/* ── STATE: active (has any purchase) ── */}
          {purchaseState === "active" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Tus Compras</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {upscalerAccess.hasAccess && (
                  <>
                    {upscalerAccess.type === "vitalicio" ? (
                      <UpscalerArcanoCard hasAccess={true} isLoading={false} />
                    ) : (
                      <UpscalerCreditosCard hasAccess={true} isLoading={false} />
                    )}
                  </>
                )}
                {flyerAccess.hasAccess && (
                  <FlyerMakerCard 
                    hasAccess={true} 
                    isUnlimited={flyerAccess.isUnlimited} 
                    label={flyerAccess.label}
                    isLoading={false} 
                  />
                )}
              </div>
            </div>
          )}

          {/* ── STATE: none (sem compra) ── */}
          {purchaseState === "none" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Nuestros Productos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <UpscalerCreditosCard
                  hasAccess={false}
                  isLoading={false}
                />
                <FlyerMakerCard
                  hasAccess={false}
                  isLoading={false}
                />
              </div>
            </div>
          )}

          {/* ── STATE: loading ── */}
          {purchaseState === "loading" && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-fuchsia-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
