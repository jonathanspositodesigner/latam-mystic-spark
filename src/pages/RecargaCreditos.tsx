import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, Zap, Crown, Infinity, ShieldCheck, Clock, ArrowLeft, TrendingDown, Flame } from "lucide-react";

interface Pack {
  hotmartId: string;
  hotmartUrl: string;
  credits: number;
  price: number; // USD
  badge?: string;
  badgeIcon?: typeof Crown;
  highlight?: boolean;
  bestValue?: boolean;
  icon: typeof Coins;
  gradient: string;
  borderColor: string;
  shadowColor: string;
}

const PACKS: Pack[] = [
  {
    hotmartId: "7699742",
    hotmartUrl: "https://pay.hotmart.com/W105744993P",
    credits: 7000,
    price: 9.99,
    icon: Coins,
    gradient: "from-purple-500 to-violet-600",
    borderColor: "border-purple-500/30",
    shadowColor: "shadow-purple-500/10",
  },
  {
    hotmartId: "7699822",
    hotmartUrl: "https://pay.hotmart.com/U105745160R",
    credits: 14000,
    price: 17.99,
    badge: "MÁS ELEGIDO",
    badgeIcon: Flame,
    highlight: true,
    icon: Zap,
    gradient: "from-fuchsia-500 to-pink-500",
    borderColor: "border-fuchsia-500/60",
    shadowColor: "shadow-fuchsia-500/20",
  },
  {
    hotmartId: "7699842",
    hotmartUrl: "https://pay.hotmart.com/U105745197P",
    credits: 25000,
    price: 29.99,
    badge: "MEJOR VALOR",
    badgeIcon: Crown,
    bestValue: true,
    icon: Crown,
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    borderColor: "border-amber-500/50",
    shadowColor: "shadow-orange-500/20",
  },
];

const RecargaCreditos = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Cálculo de economia: preço por crédito do pack base (7k) vs cada pack
  const basePack = PACKS[0];
  const basePricePerCredit = basePack.price / basePack.credits;

  const calcSavings = (pack: Pack) => {
    if (pack.credits === basePack.credits) return null;
    const equivalentPriceAtBaseRate = pack.credits * basePricePerCredit;
    const savedAmount = equivalentPriceAtBaseRate - pack.price;
    const savedPercent = Math.round((savedAmount / equivalentPriceAtBaseRate) * 100);
    return { savedAmount, savedPercent, equivalentPriceAtBaseRate };
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background ambient orbs */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-3xl animate-pulse-slow" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-500/10 blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-pink-500/10 blur-3xl animate-pulse-slow" style={{ animationDelay: "3s" }} />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <h1 className="text-sm font-bold text-foreground">Recarga de Créditos</h1>
          <div className="w-16" />
        </div>
      </div>

      {/* Hero */}
      <section className="relative px-4 pt-12 pb-8 text-center z-10">
        <div className="inline-flex items-center gap-1.5 bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-full px-3 py-1 mb-4">
          <Infinity className="h-3 w-3 text-fuchsia-400" />
          <span className="text-fuchsia-300 text-[10px] font-semibold uppercase tracking-wider">
            Sin vencimiento
          </span>
        </div>
        <h2 className="text-2xl md:text-4xl font-bold mb-2 leading-tight">
          Recarga tus{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">
            créditos
          </span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Una compra, créditos para siempre. Cuanto más grande el pack, mayor el ahorro.
        </p>
      </section>

      {/* Packs Grid */}
      <section className="relative px-4 pb-12 z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {PACKS.map((pack) => {
            const savings = calcSavings(pack);
            const PackIcon = pack.icon;
            const BadgeIcon = pack.badgeIcon;
            return (
              <Card
                key={pack.hotmartId}
                className={`relative p-5 bg-card/70 backdrop-blur-sm border ${pack.borderColor} ${pack.shadowColor} shadow-lg transition-all duration-300 hover:border-opacity-100 hover:-translate-y-0.5 flex flex-col`}
              >
                {/* Badge */}
                {pack.badge && BadgeIcon && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${pack.gradient} text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md uppercase tracking-wider whitespace-nowrap`}>
                      <BadgeIcon className="h-2.5 w-2.5" />
                      {pack.badge}
                    </div>
                  </div>
                )}

                {/* Header: icon + créditos */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pack.gradient} flex items-center justify-center shrink-0`}>
                    <PackIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground tabular-nums leading-none">
                      {pack.credits.toLocaleString("es-ES")}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">créditos vitalicios</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  {savings && (
                    <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                      USD {savings.equivalentPriceAtBaseRate.toFixed(2)}
                    </p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-foreground/60">USD</span>
                    <span className="text-3xl font-bold text-foreground tabular-nums">
                      {pack.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  {savings ? (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-green-400 text-[11px] font-semibold">
                      <TrendingDown className="h-3 w-3" />
                      Ahorras {savings.savedPercent}%
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1.5">pago único</p>
                  )}
                </div>

                {/* CTA */}
                <a
                  href={pack.hotmartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full mt-auto"
                >
                  <Button
                    className={`w-full h-10 text-sm font-semibold bg-gradient-to-r ${pack.gradient} hover:opacity-95 text-white`}
                  >
                    Comprar
                  </Button>
                </a>

                {/* Rodapé sutil */}
                <p className="text-[10px] text-center text-muted-foreground/70 mt-2.5 tabular-nums">
                  USD {((pack.price / pack.credits) * 1000).toFixed(2)} / 1.000 créditos
                </p>
              </Card>
            );
          })}
        </div>

        {/* Trust + nota — uma linha discreta */}
        <div className="max-w-3xl mx-auto mt-10 flex flex-wrap justify-center items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-green-400" /> Pago seguro Hotmart</div>
          <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-blue-400" /> Acceso instantáneo</div>
          <div className="flex items-center gap-1.5"><Infinity className="h-3 w-3 text-fuchsia-400" /> Sin caducidad</div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/80 mt-3 max-w-md mx-auto">
          Si ya tienes cuenta, usa el mismo correo en el checkout — créditos llegan automáticamente.
        </p>
      </section>
    </div>
  );
};

export default RecargaCreditos;
