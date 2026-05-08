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
  // Mostra Flyer Maker em "Tus Compras" se user JÁ recebeu QUALQUER crédito alguma vez
  // (compra de pack/recarga, grant admin, promo, etc) — não só os pacotes flyer-* específicos
  const [hasEverHadCredit, setHasEverHadCredit] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id) { setHasEverHadCredit(false); return; }
    let cancelled = false;
    (async () => {
      const { count } = await (supabase as any)
        .from("upscaler_credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gt("amount", 0)
        .limit(1);
      if (!cancelled) setHasEverHadCredit((count ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

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
    // Recebeu créditos avulsos (recarga ou admin grant) → também aparece em "Tus Compras"
    const hasAnyCreditEver = hasEverHadCredit === true;

    return {
      hasAccess: hasPro || hasUltimate || hasUnlimited || hasAnyCreditEver,
      isUnlimited: hasUnlimited,
      label: hasUnlimited
        ? "Plan Unlimited"
        : hasUltimate
        ? "Plan Ultimate"
        : hasPro
        ? "Plan Pro"
        : hasAnyCreditEver
        ? "Créditos disponibles"
        : ""
    };
  }, [hasAccessToPack, hasEverHadCredit]);

  const purchaseState = useMemo(() => {
    // Espera tanto premiumArtesStatus quanto a query de créditos resolverem
    if (premiumArtesLoading || hasEverHadCredit === null) return "loading" as const;
    if (upscalerAccess.hasAccess || flyerAccess.hasAccess) return "active" as const;
    return "none" as const;
  }, [premiumArtesLoading, upscalerAccess, flyerAccess, hasEverHadCredit]);

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
      {/* Content (TopBar é global, vem do App.tsx via <GlobalTopBar />) */}
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
