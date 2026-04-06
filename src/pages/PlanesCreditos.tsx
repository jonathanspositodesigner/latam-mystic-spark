import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const plans = [
  {
    name: "Starter",
    credits: 10,
    price: 9.90,
    priceId: "", // Stripe price ID placeholder
    popular: false,
    icon: Zap,
    features: [
      "10 créditos mensuales",
      "Upscaler Arcano estándar",
      "Soporte por email",
    ],
  },
  {
    name: "Pro",
    credits: 50,
    price: 29.90,
    priceId: "",
    popular: true,
    icon: Crown,
    features: [
      "50 créditos mensuales",
      "Upscaler Arcano estándar",
      "Acceso prioritario",
      "Soporte prioritario",
    ],
  },
  {
    name: "Ilimitado",
    credits: -1,
    price: 59.90,
    priceId: "",
    popular: false,
    icon: Infinity,
    features: [
      "Créditos ilimitados",
      "Todas las herramientas IA",
      "Sin cola de espera",
      "Soporte VIP",
    ],
  },
];

const PlanesCreditos = () => {
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
          <h1 className="text-sm font-bold text-foreground">Planes Mensuales</h1>
          <div className="w-16" />
        </div>
      </div>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary text-xs font-bold uppercase tracking-wider">
            Planes de Suscripción
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Elige tu plan de{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            créditos mensuales
          </span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Los créditos se renuevan cada mes. Usa en cualquier herramienta IA de Arcano.
        </p>
      </section>

      {/* Plans Grid */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative p-6 bg-card border transition-all ${
                plan.popular
                  ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold px-4 py-1 rounded-full">
                  MÁS POPULAR
                </div>
              )}

              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
                  <plan.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">
                    ${plan.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground text-sm">/mes</span>
                </div>
                {plan.credits > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.credits} créditos/mes
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400 shrink-0" />
                    <span className="text-sm text-foreground">{f}</span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full ${
                  plan.popular
                    ? "bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
                    : ""
                }`}
                variant={plan.popular ? "default" : "outline"}
              >
                Suscribirse
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PlanesCreditos;
