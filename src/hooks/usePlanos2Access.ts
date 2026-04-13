// Planos2 not yet implemented — all features default to FALSE (deny by default)
export const usePlanos2Access = (_userId?: string) => {
  return {
    subscription: null,
    isLoading: false,
    hasImageGeneration: false,
    hasVideoGeneration: false,
    isPlanos2User: false,
    planSlug: null,
    costMultiplier: 1.0,
  };
};
