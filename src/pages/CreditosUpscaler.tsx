import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Gem, Crown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const packs = [
  {
    name: "Pack Básico",
    credits: 25,
    price: 19.90,
    pricePerCredit: "0.80",
    icon: Star,
    highlight: false,
  },
  {
    name: "Pack Pro",
    credits: 75,
    price: 39.90,
    pricePerCredit: "0.53",
    icon: Crown,
    highlight: true,
    badge: "MEJOR VALOR",
  },
  {
    name: "Pack Diamante",
    credits: 200,
    price: 79.90,
    pricePerCredit: "0.40",
    icon: Gem,
    highlight: false,
  },
];

const CreditosUpscaler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Volver
          </button>
          <h1 className="text-sm font-bold text-foreground">Créditos Vitalícios</h1>
          <div className="w-16" />
        </div>
      </div>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
            Compra Única — Sin Vencimiento
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Packs de créditos{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
            vitalícios
          </span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Compra una vez, usa cuando quieras. Los créditos nunca expiran.
        </p>
      </section>

      {/* Packs Grid */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {packs.map((pack) => (
            <Card
              key={pack.name}
              className={`relative p-6 bg-card border transition-all ${
                pack.highlight
                  ? "border-amber-500/50 shadow-lg shadow-amber-500/10 scale-[1.02]"
                  : "border-border"
              }`}
            >
              {pack.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-bold px-4 py-1 rounded-full">
                  {pack.badge}
                </div>
              )}

              <div className="text-center mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                  pack.highlight
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-gradient-to-br from-primary to-accent"
                }`}>
                  <pack.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{pack.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{pack.credits} créditos</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">
                    ${pack.price.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${pack.pricePerCredit} por crédito
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-sm text-foreground">{pack.credits} créditos permanentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-sm text-foreground">Sin vencimiento</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-sm text-foreground">Todas las herramientas IA</span>
                </div>
              </div>

              <Button
                className={`w-full ${
                  pack.highlight
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 text-black font-bold"
                    : ""
                }`}
                variant={pack.highlight ? "default" : "outline"}
              >
                Comprar Ahora
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CreditosUpscaler;
