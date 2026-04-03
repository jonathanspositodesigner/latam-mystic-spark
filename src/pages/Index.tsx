import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, Zap, ImagePlus, Video, BookOpen, ArrowRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import UpscalerArcanoCard from "@/components/dashboard/UpscalerArcanoCard";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Zap,
      title: "Herramientas de IA",
      description: "Upscaler, Cloner, Pose Changer y más",
      route: "/herramientas-ia",
      color: "from-fuchsia-500 to-purple-600",
    },
    {
      icon: BookOpen,
      title: "Biblioteca de Prompts",
      description: "Miles de prompts listos para usar",
      route: "/biblioteca-prompts",
      color: "from-blue-500 to-indigo-600",
    },
    {
      icon: ImagePlus,
      title: "Generar Imagen",
      description: "Crea imágenes con inteligencia artificial",
      route: "/generar-imagen",
      color: "from-green-500 to-emerald-600",
    },
    {
      icon: Video,
      title: "Generar Video",
      description: "Crea videos con IA de última generación",
      route: "/generar-video",
      color: "from-orange-500 to-red-600",
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Bienvenido a <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">ArcanoAppes</span>
            </h1>
            <p className="text-purple-300 text-lg md:text-xl max-w-2xl mx-auto">
              La plataforma de herramientas de IA más completa para creativos en Latinoamérica
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
            {features.map((feature) => (
              <button
                key={feature.title}
                onClick={() => navigate(feature.route)}
                className="group relative overflow-hidden rounded-xl border border-purple-500/20 bg-[#1A0A2E] p-6 text-left transition-all hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <div className="relative">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-purple-300 text-sm mb-4">{feature.description}</p>
                  <div className="flex items-center text-fuchsia-400 text-sm font-medium group-hover:text-fuchsia-300 transition-colors">
                    Explorar <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-purple-900/50 to-fuchsia-900/50 rounded-xl border border-purple-500/20 p-8">
            <Star className="h-10 w-10 text-yellow-500 mx-auto mb-4" fill="currentColor" />
            <h2 className="text-2xl font-bold text-white mb-2">¿Listo para empezar?</h2>
            <p className="text-purple-300 mb-6">Accede a todas las herramientas con un plan Premium</p>
            <Button
              onClick={() => navigate("/planes")}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white px-8"
            >
              <Star className="h-4 w-4 mr-2" fill="currentColor" />
              Ver Planes
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
