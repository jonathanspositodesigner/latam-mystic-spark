import { useAuth } from "@/contexts/AuthContext";

export const usePremiumStatus = () => {
  const { user, session, isPremium, planType, isLoading, logout, refetch } = useAuth();
  return { user, session, isPremium, planType, isLoading, logout, refetch };
};
