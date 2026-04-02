import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface PackAccess {
  pack_slug: string;
  access_type: string;
  has_bonus: boolean;
  expires_at: string | null;
}

interface Planos2Subscription {
  plan_slug: string;
  is_active: boolean;
  credits_per_month: number;
  daily_prompt_limit: number | null;
  has_image_generation: boolean;
  has_video_generation: boolean;
  cost_multiplier: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  planType: string | null;
  hasExpiredSubscription: boolean;
  expiredPlanType: string | null;
  expiringStatus: 'today' | 'tomorrow' | null;
  userPacks: PackAccess[];
  expiredPacks: PackAccess[];
  hasBonusAccess: boolean;
  hasAccessToPack: (slug: string) => boolean;
  getPackAccessInfo: (slug: string) => PackAccess | undefined;
  hasExpiredPack: (slug: string) => boolean;
  getExpiredPackInfo: (slug: string) => PackAccess | undefined;
  isMusicosPremium: boolean;
  musicosPlanType: string | null;
  musicosBillingPeriod: string | null;
  musicosExpiresAt: string | null;
  planos2Subscription: Planos2Subscription | null;
  isPlanos2User: boolean;
  hasImageGeneration: boolean;
  hasVideoGeneration: boolean;
  costMultiplier: number;
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
  const [hasExpiredSubscription, setHasExpiredSubscription] = useState(false);
  const [expiredPlanType, setExpiredPlanType] = useState<string | null>(null);
  const [expiringStatus, setExpiringStatus] = useState<'today' | 'tomorrow' | null>(null);
  const [userPacks, setUserPacks] = useState<PackAccess[]>([]);
  const [expiredPacks, setExpiredPacks] = useState<PackAccess[]>([]);
  const [hasBonusAccess, setHasBonusAccess] = useState(false);
  const [isMusicosPremium, setIsMusicosPremium] = useState(false);
  const [musicosPlanType, setMusicosPlanType] = useState<string | null>(null);
  const [musicosBillingPeriod, setMusicosBillingPeriod] = useState<string | null>(null);
  const [musicosExpiresAt, setMusicosExpiresAt] = useState<string | null>(null);
  const [planos2Subscription, setPlanos2Subscription] = useState<Planos2Subscription | null>(null);
  const isInitialized = useRef(false);

  const retryQuery = async <T,>(
    fn: () => Promise<T>,
    retries = 3,
    baseDelay = 1000
  ): Promise<T> => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === retries - 1) throw err;
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
  };

  const checkAllStatuses = async (userId: string) => {
    try {
      const [isPremiumResult, userPacksResult, premiumDetailResult] = await retryQuery(() =>
        Promise.all([
          supabase.rpc('is_premium'),
          supabase.rpc('get_user_packs', { _user_id: userId }),
          supabase
            .from('premium_users')
            .select('plan_type, expires_at, is_active')
            .eq('user_id', userId)
            .order('expires_at', { ascending: false })
            .limit(2),
        ])
      );

      const [expiredPacksResult, musicosResult, planos2Result] = await retryQuery(() =>
        Promise.all([
          supabase.rpc('get_user_expired_packs', { _user_id: userId }),
          supabase
            .from('premium_musicos_users')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .or('expires_at.is.null,expires_at.gt.now()')
            .maybeSingle(),
          supabase
            .from('planos2_subscriptions')
            .select('plan_slug, is_active, credits_per_month, daily_prompt_limit, has_image_generation, has_video_generation, cost_multiplier')
            .eq('user_id', userId)
            .maybeSingle(),
        ])
      );

      const premiumStatus = !isPremiumResult.error && isPremiumResult.data === true;
      setIsPremium(premiumStatus);

      if (premiumStatus && !premiumDetailResult.error && premiumDetailResult.data) {
        const activeRecord = (premiumDetailResult.data as any[]).find((r: any) => r.is_active);
        if (activeRecord) {
          setPlanType(activeRecord.plan_type);
          if (activeRecord.expires_at) {
            const expiresDate = new Date(activeRecord.expires_at);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const expiresDay = new Date(expiresDate);
            expiresDay.setHours(0, 0, 0, 0);
            if (expiresDay.getTime() === today.getTime()) setExpiringStatus('today');
            else if (expiresDay.getTime() === tomorrow.getTime()) setExpiringStatus('tomorrow');
            else setExpiringStatus(null);
          } else {
            setExpiringStatus(null);
          }
          setHasExpiredSubscription(false);
          setExpiredPlanType(null);
        } else {
          setPlanType(null);
          setExpiringStatus(null);
          setHasExpiredSubscription(false);
          setExpiredPlanType(null);
        }
      } else if (!premiumStatus) {
        setPlanType(null);
        setExpiringStatus(null);
        if (!premiumDetailResult.error && premiumDetailResult.data) {
          const expiredRecord = (premiumDetailResult.data as any[]).find((r: any) => !r.is_active && r.expires_at);
          if (expiredRecord) {
            const expiresAt = new Date(expiredRecord.expires_at);
            if (expiresAt < new Date()) {
              setHasExpiredSubscription(true);
              setExpiredPlanType(expiredRecord.plan_type);
            } else {
              setHasExpiredSubscription(false);
              setExpiredPlanType(null);
            }
          } else {
            setHasExpiredSubscription(false);
            setExpiredPlanType(null);
          }
        }
      }

      if (!userPacksResult.error) {
        const packList = (userPacksResult.data || []) as PackAccess[];
        setUserPacks(packList);
        setHasBonusAccess(packList.some((p: PackAccess) => p.has_bonus));
      } else {
        setUserPacks([]);
        setHasBonusAccess(false);
      }

      if (!expiredPacksResult.error) {
        setExpiredPacks((expiredPacksResult.data || []) as PackAccess[]);
      } else {
        setExpiredPacks([]);
      }

      if (!musicosResult.error && musicosResult.data) {
        setIsMusicosPremium(true);
        setMusicosPlanType(musicosResult.data.plan_type);
        setMusicosBillingPeriod(musicosResult.data.billing_period);
        setMusicosExpiresAt(musicosResult.data.expires_at);
      } else {
        setIsMusicosPremium(false);
        setMusicosPlanType(null);
        setMusicosBillingPeriod(null);
        setMusicosExpiresAt(null);
      }

      if (!planos2Result.error && planos2Result.data) {
        setPlanos2Subscription(planos2Result.data as Planos2Subscription);
      } else {
        setPlanos2Subscription(null);
      }
    } catch (error) {
      console.error('Error checking statuses:', error);
      resetAllStates();
    }
  };

  const resetAllStates = () => {
    setIsPremium(false);
    setPlanType(null);
    setHasExpiredSubscription(false);
    setExpiredPlanType(null);
    setExpiringStatus(null);
    setUserPacks([]);
    setExpiredPacks([]);
    setHasBonusAccess(false);
    setIsMusicosPremium(false);
    setMusicosPlanType(null);
    setMusicosBillingPeriod(null);
    setMusicosExpiresAt(null);
    setPlanos2Subscription(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          setTimeout(() => {
            checkAllStatuses(currentSession.user.id)
              .catch(err => console.error('[Auth] Status check failed:', err))
              .finally(() => setIsLoading(false));
          }, 0);
        } else {
          resetAllStates();
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
            try { await checkAllStatuses(existingSession.user.id); } catch {}
          }
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false))
        .finally(() => clearTimeout(safetyTimeout));
    }

    return () => subscription.unsubscribe();
  }, []);

  const hasAccessToPack = (packSlug: string) => userPacks.some(p => p.pack_slug === packSlug);
  const getPackAccessInfo = (packSlug: string) => userPacks.find(p => p.pack_slug === packSlug);
  const hasExpiredPack = (packSlug: string) => expiredPacks.some(p => p.pack_slug === packSlug);
  const getExpiredPackInfo = (packSlug: string) => expiredPacks.find(p => p.pack_slug === packSlug);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    resetAllStates();
  };

  const refetch = async () => {
    if (user) await checkAllStatuses(user.id);
  };

  const value: AuthContextType = {
    user, session, isLoading, isPremium, planType,
    hasExpiredSubscription, expiredPlanType, expiringStatus,
    userPacks, expiredPacks, hasBonusAccess,
    hasAccessToPack, getPackAccessInfo, hasExpiredPack, getExpiredPackInfo,
    isMusicosPremium, musicosPlanType, musicosBillingPeriod, musicosExpiresAt,
    planos2Subscription,
    isPlanos2User: !!planos2Subscription,
    hasImageGeneration: planos2Subscription?.has_image_generation ?? true,
    hasVideoGeneration: planos2Subscription?.has_video_generation ?? true,
    costMultiplier: planos2Subscription?.cost_multiplier ?? 1.0,
    logout, refetch
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
