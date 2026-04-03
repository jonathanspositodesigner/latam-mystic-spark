import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, Star, Lock, Settings, LogOut, User, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCredits } from "@/contexts/CreditsContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppTopBarProps {
  user: any;
  isPremium: boolean;
  planType: string | null;
  userProfile?: { name?: string; phone?: string } | null;
  onLogout: () => void;
}

const AppTopBar = ({ user, isPremium, planType, userProfile, onLogout }: AppTopBarProps) => {
  const navigate = useNavigate();
  const { balance: credits, isLoading: creditsLoading } = useCredits();

  const ProfileDropdown = ({ isMobile = false }: { isMobile?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`${isMobile ? 'text-white hover:bg-white/20' : 'text-purple-300 hover:text-white hover:bg-purple-500/20'} rounded-full`}>
          <User className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#1A0A2E] border-purple-500/30 text-white">
        <DropdownMenuLabel className="text-purple-200">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{userProfile?.name || user?.email?.split('@')[0] || 'Mi Perfil'}</span>
            <span className="text-xs text-purple-400 font-normal">{user?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-purple-500/20" />
        <div className="px-2 py-2 flex items-center justify-between">
          <span className="text-sm text-purple-300 flex items-center gap-2"><Coins className="w-4 h-4 text-yellow-400" />Créditos</span>
          <Badge className="bg-purple-600 text-white">{creditsLoading ? '...' : credits.toLocaleString('es')}</Badge>
        </div>
        <DropdownMenuSeparator className="bg-purple-500/20" />
        <DropdownMenuItem onClick={() => navigate('/cambiar-contrasena')} className="cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20">
          <Lock className="w-4 h-4 mr-2" />Cambiar Contraseña
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/configuracion')} className="cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20">
          <Settings className="w-4 h-4 mr-2" />Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-purple-500/20" />
        <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-400 hover:bg-red-500/20 focus:bg-red-500/20 focus:text-red-400">
          <LogOut className="w-4 h-4 mr-2" />Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="bg-[hsl(270,60%,4%)]/80 backdrop-blur-lg border-b border-purple-500/20 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <h1 className="text-lg font-bold text-white cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/dashboard')}>
        ArcanoAppes
      </h1>
      <div className="flex items-center gap-3">
        {!user && (
          <Button onClick={() => navigate("/")} variant="ghost" size="sm" className="text-purple-300 hover:text-white hover:bg-purple-500/20">
            <LogIn className="h-4 w-4 mr-2" />Iniciar Sesión
          </Button>
        )}
        {user && (
          <>
            {isPremium && (
              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                <Star className="h-3 w-3 mr-1" fill="currentColor" />Premium
              </Badge>
            )}
            <ProfileDropdown />
          </>
        )}
      </div>
    </header>
  );
};

export default AppTopBar;
