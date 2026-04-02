import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  planType: string | null;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [planType, setPlanType] = useState<string | null>(null);
  const isInitialized = useRef(false);

  const checkStatuses = async (_userId: string) => {
    // TODO: Add premium/subscription checks when tables are created
    setIsPremium(false);
    setPlanType(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          setTimeout(() => {
            checkStatuses(currentSession.user.id)
              .catch(err => console.error('[Auth] Status check failed:', err))
              .finally(() => setIsLoading(false));
          }, 0);
        } else {
          setIsPremium(false);
          setPlanType(null);
          setIsLoading(false);
        }
      }
    );

    if (!isInitialized.current) {
      isInitialized.current = true;
      const safetyTimeout = setTimeout(() => {
        console.warn('[Auth] Safety timeout: forcing loading=false after 8s');
        setIsLoading(false);
      }, 8000);

      supabase.auth.getSession()
        .then(async ({ data: { session: existingSession } }) => {
          setSession(existingSession);
          setUser(existingSession?.user ?? null);
          if (existingSession?.user) {
            try { await checkStatuses(existingSession.user.id); } catch {}
          }
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false))
        .finally(() => clearTimeout(safetyTimeout));
    }

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsPremium(false);
    setPlanType(null);
  };

  const refetch = async () => {
    if (user) await checkStatuses(user.id);
  };

  const value: AuthContextType = {
    user, session, isLoading, isPremium, planType, logout, refetch
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
