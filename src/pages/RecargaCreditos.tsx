import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, Zap, Crown, Sparkles, Check, Infinity, ShieldCheck, Clock, ArrowLeft, TrendingDown, Flame } from "lucide-react";

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
      <section className="relative px-4 pt-16 pb-10 text-center z-10">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/15 to-fuchsia-500/15 border border-purple-500/30 rounded-full px-4 py-1.5 mb-6 animate-fade-in-delayed">
          <Infinity className="h-3.5 w-3.5 text-fuchsia-400" />
          <span className="text-fuchsia-300 text-xs font-bold uppercase tracking-wider">
            Sin vencimiento — Una vez, para siempre
          </span>
        </div>
        <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
          Recarga tus{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">
            créditos vitalicios
          </span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">
          Compra una sola vez, úsalos cuando quieras. Los créditos <strong className="text-foreground">nunca expiran</strong>.
          Cuanto más grande el pack, <strong className="text-fuchsia-300">mayor el ahorro</strong>.
        </p>

        {/* Trust badges row */}
        <div className="mt-6 flex flex-wrap justify-center items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-green-400" /> Pago seguro Hotmart</div>
          <div className="hidden sm:block w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-blue-400" /> Acceso instantáneo</div>
          <div className="hidden sm:block w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5"><Infinity className="h-3.5 w-3.5 text-fuchsia-400" /> Sin caducidad</div>
        </div>
      </section>

      {/* Packs Grid */}
      <section className="relative px-4 pb-20 z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {PACKS.map((pack) => {
            const savings = calcSavings(pack);
            const PackIcon = pack.icon;
            const BadgeIcon = pack.badgeIcon;
            return (
              <Card
                key={pack.hotmartId}
                className={`relative p-6 md:p-7 bg-card/80 backdrop-blur-sm border-2 ${pack.borderColor} ${pack.shadowColor} shadow-2xl transition-all duration-300 hover:scale-[1.03] hover:shadow-3xl flex flex-col ${
                  pack.highlight ? "md:scale-[1.05] md:-translate-y-2" : ""
                }`}
              >
                {/* Badge */}
                {pack.badge && BadgeIcon && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <div className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${pack.gradient} text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-full shadow-lg uppercase tracking-wider whitespace-nowrap`}>
                      <BadgeIcon className="h-3 w-3" />
                      {pack.badge}
                    </div>
                  </div>
                )}

                {/* Icon */}
                <div className="text-center mb-5">
                  <div className={`inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br ${pack.gradient} items-center justify-center shadow-lg mb-3`}>
                    <PackIcon className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl md:text-5xl font-extrabold text-foreground tabular-nums tracking-tight">
                      {pack.credits.toLocaleString("es-ES")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium mt-0.5">créditos vitalicios</p>
                </div>

                {/* Price + savings */}
                <div className="text-center mb-5">
                  {savings && (
                    <p className="text-xs text-muted-foreground line-through mb-0.5">
                      USD {savings.equivalentPriceAtBaseRate.toFixed(2)}
                    </p>
                  )}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-foreground/70">USD</span>
                    <span className="text-4xl font-extrabold text-foreground tabular-nums">
                      {pack.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    pago único · sin renovación
                  </p>
                  {savings && (
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                      <TrendingDown className="h-3 w-3" />
                      Ahorras {savings.savedPercent}% (USD {savings.savedAmount.toFixed(2)})
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2.5 mb-6 flex-1">
                  <FeatureRow text={`${pack.credits.toLocaleString("es-ES")} créditos para usar cuando quieras`} />
                  <FeatureRow text="Sin vencimiento — son tuyos para siempre" />
                  <FeatureRow text="Todas las herramientas de IA del Arcano App" />
                  <FeatureRow text="Acreditados al instante en tu cuenta" />
                  {pack.highlight && (
                    <FeatureRow text={<><strong className="text-fuchsia-300">2× más créditos</strong> que el pack básico</>} />
                  )}
                  {pack.bestValue && (
                    <FeatureRow text={<><strong className="text-amber-300">Mejor precio por crédito</strong> de todos los packs</>} />
                  )}
                </div>

                {/* CTA */}
                <a
                  href={pack.hotmartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <Button
                    className={`w-full h-12 text-sm font-bold bg-gradient-to-r ${pack.gradient} hover:opacity-95 text-white shadow-lg ${pack.shadowColor}`}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Comprar Ahora
                  </Button>
                </a>

                {/* Equivalência por crédito (rodapé sutil) */}
                <p className="text-[10px] text-center text-muted-foreground mt-3 tabular-nums">
                  USD {((pack.price / pack.credits) * 1000).toFixed(2)} cada 1.000 créditos
                </p>
              </Card>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="max-w-3xl mx-auto mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            💡 Los créditos comprados aquí <strong className="text-foreground">no expiran nunca</strong>. Si ya tienes una cuenta, basta usar el mismo correo en el checkout — los créditos llegan automáticamente sin tocar tu contraseña.
          </p>
        </div>

        {/* FAQ minimalista */}
        <div className="max-w-3xl mx-auto mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FaqCard
            question="¿Los créditos caducan?"
            answer="No. Una vez comprados, son tuyos para siempre. Úsalos cuando quieras."
          />
          <FaqCard
            question="¿En qué herramientas puedo usarlos?"
            answer="En todas las herramientas de IA del Arcano App: Upscaler, Flyer Maker, generación de imágenes y más."
          />
          <FaqCard
            question="¿Ya tengo cuenta, qué pasa?"
            answer="Solo usa el mismo correo en el checkout. Los créditos se suman a tu cuenta sin alterar tu contraseña."
          />
          <FaqCard
            question="¿Cómo recibo los créditos?"
            answer="Al instante. En cuanto se aprueba el pago, ya están disponibles en tu cuenta."
          />
        </div>
      </section>
    </div>
  );
};

const FeatureRow = ({ text }: { text: React.ReactNode }) => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
      <Check className="h-2.5 w-2.5 text-green-400" strokeWidth={3} />
    </div>
    <span className="text-sm text-foreground/85 leading-snug">{text}</span>
  </div>
);

const FaqCard = ({ question, answer }: { question: string; answer: string }) => (
  <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
    <p className="font-semibold text-foreground text-sm mb-1">{question}</p>
    <p className="text-xs text-muted-foreground leading-relaxed">{answer}</p>
  </div>
);

export default RecargaCreditos;
