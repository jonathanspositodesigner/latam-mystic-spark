import { useState, useEffect, ReactNode } from "react";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { supabase } from "@/integrations/supabase/client";
import AppTopBar from "./AppTopBar";

interface AppLayoutProps {
  children: ReactNode;
  fullScreen?: boolean;
}

const AppLayout = ({ children, fullScreen = false }: AppLayoutProps) => {
  const { user, isPremium, planType, logout } = usePremiumStatus();
  const [userProfile, setUserProfile] = useState<{ name?: string; phone?: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from('profiles')
        .select('name, phone')
        .eq('id', user.id)
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  return (
    <div className={`${fullScreen ? 'lg:h-screen lg:overflow-hidden min-h-screen' : 'min-h-screen'} bg-[hsl(270,60%,4%)]`}>
      <AppTopBar
        user={user}
        isPremium={isPremium}
        planType={planType}
        userProfile={userProfile}
        onLogout={logout}
      />
      <main className={`flex-1 ${fullScreen ? 'lg:h-[calc(100vh-57px)] lg:overflow-hidden' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
