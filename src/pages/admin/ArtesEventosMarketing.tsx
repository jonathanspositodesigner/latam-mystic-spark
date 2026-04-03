import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Bell, ShoppingCart, Mail, UserPlus } from "lucide-react";
import AdminLayoutPlatform from "@/components/admin/AdminLayoutPlatform";

const ArtesEventosMarketing = () => {
  const navigate = useNavigate();
  const cards = [
    { label: "Notificações Push", desc: "Envie notificações para o app", icon: Bell, color: "from-yellow-500 to-amber-600", path: "/admin-push-notifications" },
    { label: "Remarketing", desc: "Checkouts abandonados", icon: ShoppingCart, color: "from-orange-500 to-red-500", path: "/admin-abandoned-checkouts" },
    { label: "Emails", desc: "Templates e envios", icon: Mail, color: "from-blue-500 to-cyan-500", path: "/admin-hub" },
    { label: "Leads", desc: "Captura e gestão de leads", icon: UserPlus, color: "from-green-500 to-emerald-500", path: "/admin-leads" },
  ];
  return (
    <AdminLayoutPlatform platform="artes-eventos">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Marketing - Artes Eventos</h1>
        <p className="text-muted-foreground mb-6">Ferramentas de divulgação e campanhas</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {cards.map((card) => (
            <Card key={card.label} className="p-3 sm:p-8 cursor-pointer hover:shadow-lg transition-all hover:scale-105" onClick={() => navigate(card.path)}>
              <div className="flex flex-col items-center text-center space-y-2 sm:space-y-4">
                <div className={`p-2 sm:p-4 bg-gradient-to-r ${card.color} rounded-full`}>
                  <card.icon className="h-6 w-6 sm:h-12 sm:w-12 text-white" />
                </div>
                <h2 className="text-xs sm:text-2xl font-bold text-foreground">{card.label}</h2>
                <p className="text-muted-foreground hidden sm:block">{card.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayoutPlatform>
  );
};

export default ArtesEventosMarketing;
const ArtesEventosMarketing = () => (
  <AdminLayoutPlatform platform="artes-eventos">
    <h1 className="text-3xl font-bold text-foreground mb-6">Marketing - Artes Eventos</h1>
    <Card className="p-12 text-center"><p className="text-muted-foreground">🚧 Em breve</p></Card>
  </AdminLayoutPlatform>
);

export default ArtesEventosMarketing;
