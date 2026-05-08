import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import AppTopBar from "./AppTopBar";

/**
 * Topbar global do app — aparece em TODAS as rotas exceto:
 * - tela de login (/)
 * - recuperação/reset de senha
 * - admin login
 * - landings públicas
 *
 * Por design o AppTopBar já lida com user logado/não-logado, então
 * mesmo nas rotas autenticadas onde a sessão ainda não foi resolvida
 * o componente se adapta sem quebrar.
 */
const HIDDEN_PATHS = new Set([
  "/",
  "/olvide-contrasena",
  "/restablecer-contrasena",
  "/admin-login",
  "/flyermakerlanding",
]);

const GlobalTopBar = () => {
  const location = useLocation();
  const { user, isPremium, planType, logout } = usePremiumStatus();
  const [userProfile, setUserProfile] = useState<{ name?: string; phone?: string } | null>(null);

  useEffect(() => {
    if (!user) { setUserProfile(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("name, phone")
        .eq("id", user.id)
        .single();
      if (!cancelled && data) setUserProfile(data);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (HIDDEN_PATHS.has(location.pathname)) return null;

  return (
    <AppTopBar
      user={user}
      isPremium={isPremium}
      planType={planType}
      userProfile={userProfile}
      onLogout={logout}
    />
  );
};

export default GlobalTopBar;
