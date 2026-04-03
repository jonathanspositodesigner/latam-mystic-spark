import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Layers, Shield, Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const UpgradeUpscalerV3 = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const features = [
    {
      icon: Zap,
      title: "Modo Turbo",
      description: "Resultados en menos de 1 minuto con calidad profesional",
    },
    {
      icon: Layers,
      title: "Upscale en Lote",
      description: "Procesa hasta 10 imágenes de una sola vez",
    },
    {
      icon: Shield,
      title: "Acceso V2 Mantenido",
      description: "Conservas el acceso completo a todas las versiones anteriores",
    },
  ];

  const benefits = [
    "Procesamiento 10x más rápido",
    "Upscale en lote (hasta 10 imágenes)",
    "Mayor fidelidad de colores",
    "Acceso a todas las versiones (V1, V2, V3)",
    "Clases exclusivas de la V3",
    "Soporte prioritario",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky bar */}
      <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-fuchsia-600 to-purple-700 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs sm:text-sm font-semibold text-white text-center sm:text-left flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            ARCANO V3 — Modo Turbo + Upscale en Lote
          </p>
          <Button
            size="sm"
            onClick={() => navigate("/upscaler-arcano")}
            className="bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold hover:from-amber-300 hover:to-amber-400"
          >
            Ver Versiones <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Hero */}
      <section className="px-4 md:px-6 pt-16 md:pt-24 pb-12 md:pb-16 w-full">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              Exclusivo para clientes V2
            </span>
          </div>

          <h1 className="font-bold text-3xl md:text-5xl text-foreground mb-5 leading-[1.15]">
            Ya sabes que funciona.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-500">
              Ahora descubre lo que es 10x más rápido.
            </span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground mb-10 max-w-[580px] leading-relaxed">
            El V3 transforma tu flujo de trabajo completo. Dos nuevos recursos. Impacto real. Acceso inmediato.
          </p>

          <div className="flex flex-wrap justify-center items-center gap-4 mb-10">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-muted-foreground text-xs px-3 py-1">
                <f.icon className="h-3.5 w-3.5 text-fuchsia-400" />
                <span>{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
            ¿Qué cambió en el <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-500">V3</span>?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="p-6 bg-card border-border text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-4">
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Todo lo que incluye el upgrade
          </h2>
          <div className="space-y-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <Check className="h-5 w-5 text-green-400 shrink-0" />
                <span className="text-foreground">{b}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button
              size="lg"
              onClick={() => navigate("/upscaler-arcano")}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white px-8"
            >
              Acceder a las Versiones <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UpgradeUpscalerV3;
