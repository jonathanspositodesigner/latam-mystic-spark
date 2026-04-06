import { createContext, useContext, ReactNode } from 'react';
import { useUpscalerCredits } from '@/hooks/useUpscalerCredits';

interface CreditsContextType {
  balance: number;
  breakdown: { total: number; monthly: number; lifetime: number };
  isLoading: boolean;
  hasError: boolean;
  isUnlimited: boolean;
  refetch: () => Promise<void>;
  consumeCredits: (amount: number, description?: string) => Promise<{ success: boolean; error?: string; newBalance?: number; currentBalance?: number }>;
  checkBalance: () => Promise<number>;
  canAfford: (cost: number) => boolean;
  formatBalance: () => string;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider = ({ children, userId }: { children: ReactNode; userId?: string }) => {
  const creditsData = useUpscalerCredits(userId);
  
  // TODO: Check unlimited plan subscription when plans are implemented
  const isUnlimited = false;

  const canAfford = (cost: number): boolean => {
    if (isUnlimited) return true;
    return creditsData.balance >= cost;
  };

  const formatBalance = (): string => {
    if (isUnlimited) return '∞';
    return creditsData.balance.toLocaleString('es-ES');
  };

  return (
    <CreditsContext.Provider value={{ ...creditsData, isUnlimited, canAfford, formatBalance }}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCredits = (): CreditsContextType => {
  const ctx = useContext(CreditsContext);
  if (!ctx) {
    return {
      balance: 0,
      breakdown: { total: 0, monthly: 0, lifetime: 0 },
      isLoading: true,
      hasError: false,
      isUnlimited: false,
      refetch: async () => {},
      consumeCredits: async () => ({ success: false, error: 'No CreditsProvider' }),
      checkBalance: async () => 0,
      canAfford: () => false,
      formatBalance: () => '0',
    };
  }
  return ctx;
};
