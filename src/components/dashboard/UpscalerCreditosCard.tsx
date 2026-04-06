import { useNavigate } from "react-router-dom";
import { Coins, ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import coverImage from "@/assets/upscaler-creditos-cover.webp";

interface UpscalerCreditosCardProps {
  hasAccess?: boolean;
  isLoading?: boolean;
  purchaseUrl?: string;
}

const UpscalerCreditosCard = ({
  hasAccess = false,
  isLoading = false,
  purchaseUrl,
}: UpscalerCreditosCardProps) => {
  const navigate = useNavigate();
  const ctaLabel = isLoading ? "Verificando" : hasAccess ? "Acceder" : "Adquirir";

  const handleAction = () => {
    if (isLoading) return;

    if (!hasAccess && purchaseUrl) {
      window.location.assign(purchaseUrl);
      return;
    }

    navigate("/upscaler-arcano-tool");
  };

  return (
    <div
      onClick={handleAction}
      className={`group relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[hsl(var(--card))] to-[hsl(220,50%,8%)] transition-all duration-500 hover:border-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-500/15 hover:scale-[1.02] animate-fade-in w-full max-w-[280px] ${isLoading ? "cursor-wait" : "cursor-pointer"}`}
      style={{ aspectRatio: "3/4" }}
    >
      {/* Cover image */}
      <div className="absolute inset-0">
        <img
          src={coverImage}
          alt="Upscaler Arcano IA"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          width={600}
          height={800}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      </div>

      {/* Shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      {/* Badge top */}
      <div className="relative z-10 p-4">
        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1 backdrop-blur-sm">
          <Sparkles className="h-3 w-3 mr-1.5" />
          IA por Créditos
        </Badge>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10 flex flex-col gap-3">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Upscaler Arcano</h3>
          <p className="text-white/70 text-xs leading-relaxed line-clamp-2">
            Mejora tus fotos con inteligencia artificial usando créditos.
          </p>
        </div>
        <Button
          size="sm"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/25 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            handleAction();
          }}
        >
          {ctaLabel}
          {hasAccess ? (
            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          ) : (
            <Coins className="h-4 w-4 ml-1" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default UpscalerCreditosCard;
