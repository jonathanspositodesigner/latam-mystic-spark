import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Zap, Sparkles, Video, Star, LogIn, Smartphone, Home, ImagePlus, Settings, LogOut, Coins, BookOpen, ChevronDown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface AppSidebarProps {
  user: any;
  isPremium: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppSidebar = ({ user, isPremium, sidebarOpen, setSidebarOpen }: AppSidebarProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [aiToolsOpen, setAiToolsOpen] = useState(true);

  const aiToolLinks = [
    { name: "Upscaler Arcano App", path: "/upscaler-arcano-tool", badge: null, badgeColor: null, disabled: false },
    { name: "Flyer Maker", path: "/flyer-maker", badge: "Nuevo", badgeColor: "bg-green-500", disabled: false },
    { name: "Arcano Cloner", path: "/arcano-cloner-tool", badge: "Nuevo", badgeColor: "bg-green-500", disabled: false },
    { name: "Pose Changer", path: "/pose-changer-tool", badge: null, badgeColor: null, disabled: false },
    { name: "Veste AI", path: "/veste-ai-tool", badge: null, badgeColor: null, disabled: false },
    { name: "MovieLed Maker", path: "/movieled-maker", badge: "Nuevo", badgeColor: "bg-green-500/30", textColor: "text-green-300", disabled: false },
    { name: "Forja de Sellos 3D", path: "#", badge: "Próximamente", badgeColor: "bg-purple-400/30", textColor: "text-purple-300", disabled: true },
  ];

  const handleLogout = async () => { await logout(); navigate("/"); };
  const handleNavAndClose = (path: string) => { navigate(path); setSidebarOpen(false); };

  return (
    <>
      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 min-h-screen bg-[#1A0A2E] border-r border-purple-500/20 p-5 flex flex-col transform transition-transform duration-300 ease-in-out lg:pt-4 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="mb-4 flex justify-center lg:hidden">
          <h2 className="text-xl font-bold text-white cursor-pointer" onClick={() => navigate('/')}>ArcanoApp</h2>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto">
          <button onClick={() => handleNavAndClose("/")} className="w-full flex items-center text-left text-[12px] font-medium text-purple-200 hover:text-white py-2 px-2.5 rounded-lg hover:bg-purple-500/20 transition-colors">
            <Home className="h-3.5 w-3.5 mr-1.5" />Home
          </button>

          <div className="border-t border-purple-400/30" />

          {isPremium && (
            <div className="flex items-center justify-center gap-2 p-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
              <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
              <span className="text-[11px] font-semibold text-yellow-400">Premium Activo</span>
            </div>
          )}

          {user && !isPremium && (
            <Button onClick={() => handleNavAndClose("/planes")} className="w-full h-auto py-2 px-2.5 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white font-medium text-[11px] flex items-center justify-between">
              <span className="flex items-center"><Star className="h-3 w-3 mr-1.5" fill="currentColor" />Ser Premium</span>
            </Button>
          )}

          {!user && (
            <>
              <Button onClick={() => handleNavAndClose("/planes")} className="w-full h-auto py-2 px-2.5 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white font-medium text-[11px] flex items-center justify-between">
                <span className="flex items-center"><Star className="h-3 w-3 mr-1.5" fill="currentColor" />Ser Premium</span>
              </Button>
              <Button onClick={() => handleNavAndClose("/login")} variant="outline" className="w-full h-auto py-2 px-2.5 bg-purple-900/50 border-purple-400/50 text-white hover:bg-purple-500/30 font-medium text-[11px] flex items-center justify-between">
                <span className="flex items-center"><LogIn className="h-3 w-3 mr-1.5" />Iniciar Sesión</span>
              </Button>
            </>
          )}

          <div className="my-3 border-t border-purple-400/30" />

          <button onClick={() => setAiToolsOpen(!aiToolsOpen)} className="w-full flex items-center justify-between text-left text-[12px] font-semibold text-white hover:text-purple-200 py-2 px-2.5 rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-purple-600/20 hover:from-fuchsia-500/30 hover:to-purple-600/30 transition-colors">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-fuchsia-400" />Herramientas de IA</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${aiToolsOpen ? 'rotate-180' : ''}`} />
          </button>

          {aiToolsOpen && (
            <div className="space-y-1 pl-2">
              {aiToolLinks.map(link => (
                <button key={link.name} onClick={() => !link.disabled && handleNavAndClose(link.path)} disabled={link.disabled} className={`w-full flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-md transition-colors ${link.disabled ? 'text-purple-400/50 cursor-not-allowed' : 'text-purple-200 hover:text-white hover:bg-purple-500/20'}`}>
                  <span>{link.name}</span>
                  {link.badge && <span className={`text-[9px] font-bold ${link.badgeColor} ${link.textColor || 'text-white'} px-1.5 py-0.5 rounded-full leading-none`}>{link.badge}</span>}
                </button>
              ))}
              <button onClick={() => handleNavAndClose("/herramientas-ia")} className="w-full flex items-center justify-center text-[11px] py-1.5 px-2.5 rounded-md text-fuchsia-300 hover:text-white hover:bg-purple-500/20 transition-colors font-medium mt-1">
                Ver todas →
              </button>
            </div>
          )}

          <button onClick={() => handleNavAndClose("/biblioteca-prompts")} className="w-full flex items-center text-left text-[12px] font-medium text-purple-200 hover:text-white py-2 px-2.5 rounded-lg hover:bg-purple-500/20 transition-colors">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />PromptClub
          </button>

          <button onClick={() => handleNavAndClose("/generar-imagen")} className="w-full flex items-center text-left text-[12px] font-medium text-purple-200 hover:text-white py-2 px-2.5 rounded-lg hover:bg-purple-500/20 transition-colors">
            <ImagePlus className="h-3.5 w-3.5 mr-1.5" />Generar Imagen
          </button>
          <button onClick={() => handleNavAndClose("/generar-video")} className="w-full flex items-center text-left text-[12px] font-medium text-purple-200 hover:text-white py-2 px-2.5 rounded-lg hover:bg-purple-500/20 transition-colors">
            <Video className="h-3.5 w-3.5 mr-1.5" />Generar Video
          </button>

          <div className="my-3 border-t border-purple-400/30" />

          {user && (
            <button onClick={() => handleNavAndClose("/historial-creditos")} className="w-full flex items-center text-left text-[12px] font-medium text-purple-200 hover:text-white py-2 px-2.5 rounded-lg hover:bg-purple-500/20 transition-colors">
              <Coins className="h-3.5 w-3.5 mr-1.5" />Mis Créditos
            </button>
          )}

          {user && (
            <button onClick={() => handleNavAndClose("/configuracion")} className="w-full flex items-center text-left text-[12px] font-medium text-purple-200 hover:text-white py-2 px-2.5 rounded-lg hover:bg-purple-500/20 transition-colors">
              <Settings className="h-3.5 w-3.5 mr-1.5" />Configuración
            </button>
          )}
        </div>

        {user && (
          <div className="pt-3 border-t border-purple-400/30 mt-3">
            <button onClick={handleLogout} className="w-full flex items-center text-left text-[12px] font-medium text-red-400 hover:text-red-300 py-2 px-2.5 rounded-lg hover:bg-red-500/10 transition-colors">
              <LogOut className="h-3.5 w-3.5 mr-1.5" />Salir
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default AppSidebar;
