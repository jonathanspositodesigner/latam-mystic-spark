import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Infinity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import coverImage from "@/assets/flyer-preview.webp";

interface FlyerMakerCardProps {
  hasAccess?: boolean;
  isUnlimited?: boolean;
  isLoading?: boolean;
  purchaseUrl?: string;
  label?: string;
}

const FlyerMakerCard = ({
  hasAccess = false,
  isUnlimited = false,
  isLoading = false,
  purchaseUrl,
  label,
}: FlyerMakerCardProps) => {
  const navigate = useNavigate();
  const ctaLabel = isLoading ? "Verificando" : hasAccess ? "Acceder" : "Adquirir";

  const handleAction = () => {
    if (isLoading) return;

    if (!hasAccess) {
      if (purchaseUrl) {
        window.location.assign(purchaseUrl);
      } else {
        navigate("/flyermakerlanding");
      }
      return;
    }

    navigate("/flyer-maker");
  };

  return (
    <div
      onClick={handleAction}
      className={`group relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[hsl(var(--card))] to-[hsl(270,50%,8%)] transition-all duration-500 hover:border-purple-400/40 hover:shadow-2xl hover:shadow-purple-500/15 hover:scale-[1.02] animate-fade-in w-full max-w-[280px] ${isLoading ? "cursor-wait" : "cursor-pointer"}`}
      style={{ aspectRatio: "3/4" }}
    >
      {/* Cover image */}
      <div className="absolute inset-0">
        <img
          src={coverImage}
          alt="Flyer Maker IA"
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

      {/* Badge top left */}
      <div className="absolute top-4 left-4 z-10">
        <Badge className="bg-purple-600/40 text-purple-100 border-purple-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1 backdrop-blur-md">
          <Sparkles className="h-3 w-3 mr-1.5 text-purple-300" />
          FLYER MAKER IA
        </Badge>
      </div>

      {/* Badge top right - Unlimited */}
      {isUnlimited && (
        <div className="absolute top-4 right-4 z-10">
          <Badge className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border-none text-[10px] font-bold uppercase tracking-widest px-3 py-1 shadow-lg shadow-fuchsia-500/30 animate-pulse">
            <Infinity className="h-3 w-3 mr-1" />
            UNLIMITED
          </Badge>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10 flex flex-col gap-3">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Flyer Maker</h3>
          <p className="text-white/70 text-xs leading-relaxed line-clamp-2">
            Crea flyers profesionales en segundos con inteligencia artificial.
            {label && <span className="block mt-1 text-purple-300 font-medium">{label}</span>}
          </p>
        </div>
        <Button
          size="sm"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            handleAction();
          }}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

export default FlyerMakerCard;
