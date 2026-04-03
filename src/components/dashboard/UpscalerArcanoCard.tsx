import { useNavigate } from "react-router-dom";
import { Crown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import coverImage from "@/assets/upscaler-cover.webp";

const UpscalerArcanoCard = () => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate("/upscaler-arcano")}
      className="group relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[hsl(var(--card))] to-[hsl(270,50%,8%)] cursor-pointer transition-all duration-500 hover:border-purple-400/40 hover:shadow-2xl hover:shadow-purple-500/15 hover:scale-[1.02] animate-fade-in w-full max-w-[280px]"
      style={{ aspectRatio: "3/4" }}
    >
      {/* Cover image */}
      <div className="absolute inset-0">
        <img
          src={coverImage}
          alt="Upscaler Arcano"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      </div>

      {/* Shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      {/* Badge top */}
      <div className="relative z-10 p-4">
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1 backdrop-blur-sm">
          <Crown className="h-3 w-3 mr-1.5" />
          Vitalicio
        </Badge>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10 flex flex-col gap-3">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Upscaler Arcano</h3>
          <p className="text-white/70 text-xs leading-relaxed line-clamp-2">
            Video clases exclusivas para dominar el upscaling con IA.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all"
          onClick={(e) => { e.stopPropagation(); navigate("/upscaler-arcano"); }}
        >
          Acceder
          <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

export default UpscalerArcanoCard;
