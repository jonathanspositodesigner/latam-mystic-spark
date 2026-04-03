import { useNavigate } from "react-router-dom";
import { Crown, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const UpscalerArcanoCard = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/upscaler-arcano")}
      className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#1A0A2E] via-[#2D1654] to-[#1A0A2E] text-left transition-all duration-500 hover:border-purple-400/50 hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-[1.02] w-full"
    >
      {/* Animated glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-fuchsia-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-700" />
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl group-hover:bg-fuchsia-500/20 transition-all duration-700" />

      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      <div className="relative p-6 flex flex-col h-full">
        {/* Badge */}
        <div className="mb-4">
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
            <Crown className="h-3 w-3 mr-1" />
            Acceso Completo
          </Badge>
        </div>

        {/* Visual element - abstract before/after */}
        <div className="relative mb-6 aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/60 to-fuchsia-900/40 border border-purple-500/20">
          <div className="absolute inset-0 flex">
            {/* "Before" side */}
            <div className="w-1/2 bg-gradient-to-br from-gray-800/80 to-gray-700/60 flex items-center justify-center border-r border-white/10">
              <div className="w-16 h-16 rounded-lg bg-gray-600/50 flex items-center justify-center">
                <div className="w-8 h-8 rounded bg-gray-500/50" />
              </div>
            </div>
            {/* "After" side */}
            <div className="w-1/2 bg-gradient-to-br from-purple-700/40 to-fuchsia-600/30 flex items-center justify-center">
              <div className="w-16 h-16 rounded-lg bg-purple-500/30 flex items-center justify-center border border-purple-400/30">
                <Sparkles className="h-8 w-8 text-purple-300" />
              </div>
            </div>
          </div>
          {/* Divider line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gradient-to-b from-purple-400/60 via-fuchsia-400/80 to-purple-400/60" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-fuchsia-500 border-2 border-white/30 flex items-center justify-center">
            <ArrowRight className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-1">Upscaler Arcano</h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-fuchsia-300 font-semibold text-sm flex items-center gap-1">
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            Vitalicio
          </span>
        </div>

        {/* Version chips */}
        <div className="flex gap-2 mb-5">
          {["V1", "V2", "V3"].map((v) => (
            <span
              key={v}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30"
            >
              {v}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto space-y-2">
          <Button
            className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold group-hover:shadow-lg group-hover:shadow-purple-500/25 transition-shadow"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/upscaler-arcano");
            }}
          >
            Acceder a Clases
            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p
            className="text-center text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/upscaler-arcano");
            }}
          >
            Seleccionar Versión →
          </p>
        </div>
      </div>
    </button>
  );
};

export default UpscalerArcanoCard;
