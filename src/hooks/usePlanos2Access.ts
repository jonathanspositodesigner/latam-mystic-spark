// TODO: Implement when planos2_subscriptions table is created
export const usePlanos2Access = (_userId?: string) => {
  return {
    subscription: null,
    isLoading: false,
    hasImageGeneration: true,
    hasVideoGeneration: true,
    isPlanos2User: false,
    planSlug: null,
    costMultiplier: 1.0,
  };
};
