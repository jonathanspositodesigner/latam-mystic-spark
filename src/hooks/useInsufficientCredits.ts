import { useNavigate } from "react-router-dom";
import { useCredits } from "@/contexts/CreditsContext";

/**
 * Hook centralizado pra detectar saldo insuficiente nas ferramentas de IA.
 *
 * Uso típico:
 * ```tsx
 * const { insufficient, goToRecharge, hasEnough } = useInsufficientCredits(creditCost);
 *
 * <Button
 *   onClick={insufficient ? goToRecharge : handleGenerate}
 *   className={insufficient ? "bg-gradient-to-r from-purple-600 to-fuchsia-600" : ""}
 * >
 *   {insufficient ? "Recargar créditos" : "Generar"}
 * </Button>
 * ```
 *
 * - Usuários `unlimited` nunca caem em "insufficient"
 * - Enquanto carrega o saldo, retorna `hasEnough = true` pra evitar piscar o botão
 * - `goToRecharge` navega pra `/recarga-creditos`
 */
export const useInsufficientCredits = (requiredCredits: number) => {
  const { balance, isUnlimited, isLoading } = useCredits();
  const navigate = useNavigate();

  const hasEnough = isUnlimited || isLoading || balance >= requiredCredits;
  const insufficient = !hasEnough;

  const goToRecharge = () => navigate("/recarga-creditos");

  return {
    hasEnough,
    insufficient,
    balance,
    isUnlimited,
    isLoading,
    goToRecharge,
  };
};
