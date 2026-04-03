import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Upload, CheckCircle, Settings, Users, Package, Image, Gift, FileSearch, Tag, Handshake, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayoutPlatform from "@/components/admin/AdminLayoutPlatform";

const ArtesEventosFerramentas = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const { count } = await supabase.from('partner_artes').select('*', { count: 'exact', head: true }).eq('approved', false);
      setPendingCount(count || 0);
    };
    fetchStats();
  }, []);

  const cards = [
    { id: "upload", label: "Enviar Arte", desc: "Faça upload de novas artes", icon: Upload, color: "from-amber-500 to-orange-500", path: "/admin-upload-artes" },
    { id: "review", label: "Analisar Artes", desc: "Aprove ou rejeite contribuições", icon: CheckCircle, color: "bg-green-500", path: "/admin-artes-review", badge: pendingCount },
    { id: "manage", label: "Gerenciar Artes", desc: "Edite ou exclua artes publicadas", icon: Settings, color: "bg-blue-500", path: "/admin-manage-artes" },
    { id: "packs", label: "Gerenciar Packs", desc: "Configure packs e preços", icon: Package, color: "from-purple-500 to-pink-500", path: "/admin-manage-packs" },
    { id: "clients", label: "Clientes Premium", desc: "Gerencie clientes e acessos", icon: Users, color: "bg-teal-500", path: "/admin-manage-premium" },
    { id: "partners", label: "Parceiros", desc: "Cadastre e gerencie parceiros", icon: Handshake, color: "from-amber-500 to-orange-500", path: "/admin-parceiros-artes" },
    { id: "categories", label: "Categorias", desc: "Gerencie categorias de artes", icon: Tag, color: "bg-indigo-500", path: "/admin-categories-artes" },
    { id: "banners", label: "Banners", desc: "Gerencie banners promocionais", icon: Image, color: "bg-rose-500", path: "/admin-manage-banners" },
    { id: "promotions", label: "Promoções", desc: "Gerencie promoções e combos", icon: Gift, color: "bg-emerald-500", path: "/admin-manage-promotions" },
    { id: "remarketing", label: "Remarketing", desc: "Checkouts abandonados", icon: ShoppingCart, color: "bg-orange-500", path: "/admin-abandoned-checkouts" },
    { id: "webhooks", label: "Webhook Logs", desc: "Monitore webhooks recebidos", icon: FileSearch, color: "bg-slate-500", path: "/admin-webhook-logs" },
  ];

  return (
    <AdminLayoutPlatform platform="artes-eventos">
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Ferramentas - Artes Eventos</h1>
          <p className="text-muted-foreground">Gerencie arquivos e contribuições da biblioteca de artes</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {cards.map((card) => (
            <Card key={card.id} className="p-3 sm:p-8 cursor-pointer hover:shadow-lg transition-all hover:scale-105 relative" onClick={() => navigate(card.path)}>
              <div className="flex flex-col items-center text-center space-y-2 sm:space-y-4">
                <div className={`p-2 sm:p-4 ${card.color.includes('from-') ? `bg-gradient-to-r ${card.color}` : card.color} rounded-full`}>
                  <card.icon className="h-6 w-6 sm:h-12 sm:w-12 text-white" />
                </div>
                <h2 className="text-xs sm:text-2xl font-bold text-foreground">{card.label}</h2>
                <p className="text-muted-foreground hidden sm:block">{card.desc}</p>
              </div>
              {card.badge && card.badge > 0 && (
                <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">{card.badge}</span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </AdminLayoutPlatform>
  );
};

export default ArtesEventosFerramentas;
