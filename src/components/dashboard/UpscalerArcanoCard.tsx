import { useNavigate } from "react-router-dom";
import { Crown, Sparkles, ArrowRight, Play, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const UpscalerArcanoCard = () => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate("/upscaler-arcano")}
      className="group relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[hsl(var(--card))] via-[hsl(270,50%,12%)] to-[hsl(var(--card))] cursor-pointer transition-all duration-500 hover:border-purple-400/40 hover:shadow-2xl hover:shadow-purple-500/15 hover:scale-[1.01] animate-fade-in"
    >
      {/* Animated background glow */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl group-hover:bg-purple-500/15 transition-all duration-700" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-fuchsia-500/8 rounded-full blur-3xl group-hover:bg-fuchsia-500/15 transition-all duration-700" />

      {/* Shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      <div className="relative p-5 md:p-6">
        {/* Top row: badge + version chips */}
        <div className="flex items-center justify-between mb-5">
          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px] font-bold uppercase tracking-widest px-3 py-1">
            <Crown className="h-3 w-3 mr-1.5" />
            Acceso Completo
          </Badge>
          <div className="flex gap-1.5">
            {["V1", "V2", "V3"].map((v) => (
              <span
                key={v}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20"
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Main content: two columns on desktop */}
        <div className="flex flex-col md:flex-row gap-5 items-center">
          {/* Left: visual thumbnail */}
          <div className="relative w-full md:w-48 aspect-video md:aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-fuchsia-900/30 border border-purple-500/15 shrink-0">
            {/* Before/After visual */}
            <div className="absolute inset-0 flex">
              <div className="w-1/2 bg-gradient-to-br from-gray-800/60 to-gray-700/40 flex items-center justify-center">
                <div className="w-10 h-10 rounded bg-gray-600/50 border border-gray-500/30" />
              </div>
              <div className="w-1/2 bg-gradient-to-br from-purple-700/30 to-fuchsia-600/20 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-purple-300/80" />
              </div>
            </div>
            {/* Center divider */}
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-purple-400/40 via-fuchsia-400/60 to-purple-400/40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-fuchsia-500/90 border-2 border-white/20 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
              <Play className="h-3 w-3 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Right: text content */}
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-1">
              Upscaler Arcano
            </h3>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300/90 font-semibold text-sm">Vitalicio</span>
            </div>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed max-w-sm">
              Video clases exclusivas para dominar el upscaling con IA. Accede a todas las versiones.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/30 transition-all"
                onClick={(e) => { e.stopPropagation(); navigate("/upscaler-arcano"); }}
              >
                Acceder a Clases
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                onClick={(e) => { e.stopPropagation(); navigate("/upscaler-arcano"); }}
              >
                Seleccionar Versión
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom: feature pills */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border/50">
          {[
            { icon: Sparkles, label: "Clases exclusivas" },
            { icon: Star, label: "3 versiones incluidas" },
            { icon: Play, label: "Video tutoriales HD" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-muted-foreground text-xs bg-muted/30 px-3 py-1.5 rounded-full"
            >
              <item.icon className="h-3 w-3 text-purple-400" />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UpscalerArcanoCard;
