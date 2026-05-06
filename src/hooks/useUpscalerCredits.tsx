import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreditsBreakdown {
  total: number;
  monthly: number;
  lifetime: number;
}

export const useUpscalerCredits = (userId: string | undefined) => {
  const [balance, setBalance] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<CreditsBreakdown>({ total: 0, monthly: 0, lifetime: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchBalance = useCallback(async (attempt = 0) => {
    if (!userId) {
      setBalance(0);
      setBreakdown({ total: 0, monthly: 0, lifetime: 0 });
      setIsLoading(false);
      setHasError(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_upscaler_credits', {
        _user_id: userId,
      });

      if (!error && data !== null) {
        setBalance(data);
        setBreakdown({ total: data, monthly: data, lifetime: 0 });
        setHasError(false);
        hasLoadedOnceRef.current = true;
      } else if (!hasLoadedOnceRef.current) {
        setHasError(true);
      }
    } catch (err) {
      console.error('Error fetching upscaler credits:', err);
      if (attempt < 2) {
        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 500;
        setTimeout(() => fetchBalance(attempt + 1), delay);
        return;
      }
      if (!hasLoadedOnceRef.current) setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Realtime subscription for credit changes
  useEffect(() => {
    if (!userId) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`credits-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'upscaler_credit_transactions',
        filter: `user_id=eq.${userId}`,
      }, () => { fetchBalance(); })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [userId, fetchBalance]);

  const consumeCredits = async (amount: number, description?: string) => {
    if (!userId) return { success: false as const, error: 'No autenticado' };
    
    try {
      const { data, error } = await supabase.rpc('consume_upscaler_credits', {
        _user_id: userId,
        _amount: amount,
        _description: description || 'Uso de herramienta',
      });

      if (error) return { success: false as const, error: error.message };
      if (!data) return { success: false as const, error: 'Error al procesar créditos' };

      // O Postgres pode retornar o JSON direto ou um array com um elemento dependendo de como o RPC é chamado
      const result = Array.isArray(data) ? data[0] : (data as any);
      
      if (!result.success) {
        return { success: false as const, error: result.error_message || 'Saldo insuficiente', currentBalance: result.new_balance };
      }

      setBalance(result.new_balance);
      fetchBalance();
      return { success: true as const, newBalance: result.new_balance };
    } catch (err) {
      console.error('Error consuming credits:', err);
      return { success: false as const, error: 'Error al consumir créditos' };
    }
  };

  const checkBalance = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    const { data } = await supabase.rpc('get_upscaler_credits', { _user_id: userId });
    const fresh = data ?? 0;
    setBalance(fresh);
    return fresh;
  }, [userId]);

  return { balance, breakdown, isLoading, hasError, refetch: fetchBalance, consumeCredits, checkBalance };
};
