// TODO: Implement when upscaler credits tables/functions are created
export const useUpscalerCredits = (_userId: string | undefined) => {
  return {
    balance: 0,
    breakdown: { total: 0, monthly: 0, lifetime: 0 },
    isLoading: false,
    hasError: false,
    refetch: async () => {},
    consumeCredits: async (_amount: number, _description?: string) => ({
      success: false as const,
      error: 'Credits not configured yet',
    }),
    checkBalance: async () => 0,
  };
};
