import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Palette, Sparkles, Smartphone, RefreshCw, Lock,
  Figma, BrainCircuit, Layers, Users, Camera, MessageSquare,
  Clapperboard, Video, Info,
} from "lucide-react";

// ─── Color system (mypostflow-style, purple identity) ────────────────────────
const GRAD = "linear-gradient(135deg, #7c5cfc 0%, #a855f7 55%, #c084fc 100%)";
const GRAD_TEXT = { background: GRAD, WebkitBackgroundClip: "text" as const, WebkitTextFillColor: "transparent" as const };
const PINK = "#7c5cfc";
const BG = "#ffffff";
const BG_SOFT = "#f5f5f7";
const TEXT = "#1D1D1F";
const TEXT_SEC = "#6E6E73";
const TEXT_MUT = "#A1A1A6";
const BORDER = "#E5E5EA";
const DARK = "#1D1D1F";

// ─── Font ────────────────────────────────────────────────────────────────────
const FONT = "'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif";

// ─── Plans data (from Planos2) ────────────────────────────────────────────────
const PLANS = [
  {
    name: "Pro",
    monthlyPrice: "R$ 59,90",
    annualPrice: "R$ 59,90",
    annualTotal: null as string | null,
    credits: "7.000 créditos/mes",
    badge: null,
    popular: false,
    monthlySlug: "landing-flyer-pro-mensal-7k",
    annualSlug: "landing-flyer-pro-mensal-7k",
    motionInfo: "10 motions en el motor Standard / 5 motions en el motor Pro (alta calidad)",
    features: [
      "70 flyers/mes",
      "10 motions/mes",
      "Soporte WhatsApp",
      "10 prompts/día",
      "Acceso a MovieLed — generador de videos para pantalla LED",
    ],
  },
  {
    name: "Ultimate",
    monthlyPrice: "R$ 79,90",
    annualPrice: "R$ 59,90",
    annualTotal: "R$ 718,80/año · ahorra R$ 240",
    credits: "14.000 créditos/mes",
    badge: "2x más flyers por + R$ 20",
    popular: true,
    monthlySlug: "landing-flyer-ultimate-mensal",
    annualSlug: "landing-flyer-ultimate-anual",
    motionInfo: "20 motions en el motor Standard / 11 motions en el motor Pro (alta calidad)",
    features: [
      "140 flyers/mes",
      "20 motions/mes",
      "Soporte WhatsApp prioritario",
      "20 prompts/día",
      "Acceso a MovieLed — generador de videos para pantalla LED",
    ],
  },
  {
    name: "IA Unlimited",
    monthlyPrice: "R$ 179,90",
    annualPrice: "R$ 149,90",
    annualTotal: "R$ 1.798,80/año · ahorra R$ 240",
    credits: "Flyers ilimitados + 20 motions/mes",
    badge: "Crea flyers sin límite",
    popular: true,
    monthlySlug: "landing-flyer-unlimited-mensal",
    annualSlug: "landing-flyer-unlimited-anual",
    motionInfo: "20 motions en el motor Standard / 11 motions en el motor Pro (alta calidad)",
    features: [
      "Flyers ilimitados/mes",
      "20 motions/mes",
      "Soporte WhatsApp prioritario",
      "Cola prioritaria",
      "Prompts ilimitados",
      "Acceso a MovieLed — generador de videos para pantalla LED",
    ],
  },
];

// ─── Motion AI videos (facade pattern: poster WebP + lazy MP4) ──────────────
const MOTION_VIDEOS = [
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/1.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/bfbff170388f4e8598829650eb89a725.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/2.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/seedance-_____title____Feriadinho_Promo-1777251036339.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/3.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/Seedance%202_0%20-%20_%20%20title%20Monster%20Energy%20Snake%20Promo_%20%20genre%20Motion%20Design%20%20Product%20Promo_%20%20duration%201.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/4.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/Seedance%2020%20-%20_%20%20title%20Cavalgada%20Rustic%20Promo_%20%20genre%20Motion%20Design%20%20Event%20Promo_%20%20duration%2010s_%20%20a.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/5.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/flyer-motion-1777576682516.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/6.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/Seedance%202_0%20-%20_%20%20title%20Proximos%20Shows%20Sunset%20Tour_%20%20genre%20Motion%20Design%20%20Event%20Promo_%20%20duration%2010s.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/7.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/Seedance%202_0%20-%20_%20%20title%20Street%20Surrealism%20Cover_%20%20genre%20Motion%20Design%20%20Cinematic%20Poster_%20%20duration%201.mp4" },
  { poster: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp/8.webp", video: "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos/seedance-_____title____O__ltimo_Samba_d-1777251989355.mp4" },
];

const COMPARISON_ROWS = [
  { tool: "Canva Pro", price: "R$ 54,99/mes", icon: "canva" },
  { tool: "Adobe After Effects", price: "R$ 119,90/mes", icon: "ae" },
  { tool: "Adobe Photoshop", price: "R$ 89,90/mes", icon: "ps" },
  { tool: "Motion designer freelancer", price: "R$ 300/animación", icon: "motion" },
  { tool: "Diseñador freelancer", price: "R$ 150/flyer", icon: "designer" },
  { tool: "ChatGPT Plus", price: "R$ 90,00/mes", icon: "ai" },
];

const FAQS = [
  { q: "¿Necesito saber diseño para usarlo?", a: "No. Tú escribes lo que quieres crear — producto, promoción, marca, estilo, colores — y la IA lo genera todo. Cero habilidad técnica necesaria." },
  { q: "¿Cuánto tiempo tarda en generar un flyer?", a: "En menos de 60 segundos tu flyer profesional está listo para descargar y publicar." },
  { q: "¿Puedo usarlo en el celular?", a: "Sí. ArcanoApp funciona directo desde el navegador del celular, sin instalar nada." },
  { q: "¿Qué son los créditos?", a: "Los créditos son la moneda interna de ArcanoApp. Cada generación de flyer consume una cantidad de créditos según el plan." },
  { q: "¿Qué es el Flyer Animado (Motion AI)?", a: "Es una función que transforma tu flyer en un video de 10 segundos con animaciones generadas por IA — perfecto para Stories y Reels." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Sin permanencia, sin burocracia. Cancela en cualquier momento desde el panel de configuración." },
  { q: "¿Cuál es el plan más recomendado?", a: "El IA Unlimited es la mejor relación costo-beneficio: flyers ilimitados + 20 motions en el motor Standard u 11 motions en el motor Pro (alta calidad) por mes, por solo R$ 179,90/mes. Perfecto para quienes crean con frecuencia." },
];

const TESTIMONIALS = [
  { name: "Rodrigo M.", handle: "@produtorrodrigom", text: "Antes pasaba 2 horas haciendo un flyer en Canva. Ahora lo hago en 1 minuto y el resultado es mucho mejor.", initials: "RM" },
  { name: "Carla S.", handle: "@carlashow", text: "Lo usé para mi show y el flyer quedó súper profesional. Todos preguntaron quién hizo mi diseño.", initials: "CS" },
  { name: "Bruno T.", handle: "@brunobar", text: "Ahorré mucho en diseñador. Ahora hago mis propios flyers y el movimiento en el bar aumentó.", initials: "BT" },
  { name: "Ana P.", handle: "@anaposts", text: "Nunca pensé que iba a poder crear un flyer tan bonito sola. ¡Y el Motion AI es increíble!", initials: "AP" },
  { name: "Lucas F.", handle: "@lucaseventos", text: "Lo uso cada fin de semana para promocionar mis eventos. Indispensable para cualquier productor.", initials: "LF" },
  { name: "Mariana C.", handle: "@marianacriativa", text: "La calidad de los flyers animados es absurda. Mis Stories nunca tuvieron tanto engagement.", initials: "MC" },
  { name: "Felipe N.", handle: "@felipemkt", text: "Reemplacé a mi diseñador freelancer y ahorro más de R$400 al mes. Herramienta increíble.", initials: "FN" },
  { name: "Julia R.", handle: "@juliarestaurante", text: "Hago promociones diarias para mi restaurante. El flyer queda listo antes de que termine mi café.", initials: "JR" },
];

const AVATAR_COLORS = ["#7c5cfc","#a855f7","#c084fc","#8b5cf6","#6d28d9","#9333ea"];

// Helper: Supabase Storage on-the-fly resize/format conversion (Pro feature já ativa)
// IMPORTANTE: resize=contain preserva proporção; sem ele Supabase distorce
const optimizeImg = (url: string, width: number) => {
  if (!url || !url.includes("/storage/v1/object/public/")) return url;
  return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&quality=75&format=webp&resize=contain`;
};
// Gera srcset 1x/2x pra responsividade
const optimizeSrcSet = (url: string, baseWidth: number) =>
  `${optimizeImg(url, baseWidth)} 1x, ${optimizeImg(url, baseWidth * 2)} 2x`;

// ─── Marquee images (placeholder flyers) ─────────────────────────────────────
const FLYER_ROW_1 = [
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/7ST.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/ComfyUI_00013_njhem_1776716280.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp//DYNHO%20ALVES.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/flyer-outro-1777587096424.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/flyer-outro-1777587522950.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/flyer-outro-1777588398715.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/gerar-imagem-1777586510716.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/gerar-imagem-1777588743741.webp",
];
const FLYER_ROW_2 = [
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp//Stores%202.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp//Stores%203.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp//Stores%204.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/flyermakerlp//Stores%207.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/flyer-outro-1777587694465.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/flyer-outro-1777587815986.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/flyer-1776807510388.webp",
  "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/assets/ComfyUI_00008_ipoqh_1776713776.webp",
];

// ─── Main component ───────────────────────────────────────────────────────────
const FlyerMakerLanding: React.FC = () => {
  const navigate = useNavigate();

  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [activeMotion, setActiveMotion] = useState<Set<number>>(new Set());
  // Lazy load dos 3 vídeos motion da seção 6 — só carrega quando entram em viewport
  const motionSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [motionInView, setMotionInView] = useState(false);
  // Demo video YouTube — facade pattern (poster até clicar)
  const [demoVideoActive, setDemoVideoActive] = useState(false);

  // Inject Space Grotesk font
  useEffect(() => {
    const existing = document.getElementById("lp-sg-font");
    if (existing) return;
    const link = document.createElement("link");
    link.id = "lp-sg-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
    return () => { if (document.head.contains(link)) document.head.removeChild(link); };
  }, []);

  // Navbar scroll state
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Countdown to May 15 — só roda se banner visível (e o countdown só é exibido em desktop)
  useEffect(() => {
    if (!bannerVisible) return;
    const updateCountdown = () => {
      const now = new Date();
      const deadline = new Date(2026, 4, 15, 23, 59, 59); // May 15, 2026
      const diff = deadline.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ days, hours, mins, secs });
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [bannerVisible]);

  // Scroll-reveal
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = "1";
          (e.target as HTMLElement).style.transform = "translateY(0)";
        }
      }),
      { threshold: 0.1 }
    );
    els.forEach((el) => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.transform = "translateY(24px)";
      (el as HTMLElement).style.transition = "opacity 0.6s ease, transform 0.6s ease";
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // Preload da PRIMEIRA imagem do hero carousel — melhora LCP drasticamente
  useEffect(() => {
    const firstHero = optimizeImg(FLYER_ROW_1[0], 280);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = firstHero;
    link.fetchPriority = "high";
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);

  // Lazy autoplay dos vídeos motion da seção 6 (só carrega quando perto do viewport)
  useEffect(() => {
    const target = motionSectionRef.current;
    if (!target) return;
    if (motionInView) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setMotionInView(true);
        obs.disconnect();
      }
    }, { rootMargin: "300px 0px" });
    obs.observe(target);
    return () => obs.disconnect();
  }, [motionInView]);

  const goPlanos = () => {
    const el = document.getElementById("planos");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };


  return (
    <>
    <div style={{ background: BG, color: TEXT, fontFamily: FONT, overflowX: "hidden", minHeight: "100vh" }}>

      {/* ── Global styles ─────────────────────────────────────────────── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(124,92,252,0.2); }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; }

        /* Pill buttons */
        .lp-btn {
          display: inline-flex; align-items: center; gap: 10px;
          border-radius: 999px; font-weight: 700; font-size: 1rem;
          padding: 14px 28px; border: none; cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          white-space: nowrap; font-family: inherit;
        }
        .lp-btn:hover { transform: translateY(-2px); }
        .lp-btn-grad {
          background: ${GRAD};
          color: #fff;
          box-shadow: 0 8px 28px rgba(124,92,252,0.38), 0 2px 6px rgba(124,92,252,0.2);
        }
        .lp-btn-grad:hover { box-shadow: 0 12px 36px rgba(124,92,252,0.5), 0 4px 12px rgba(124,92,252,0.25); }
        .lp-btn-dark { background: #1D1D1F; color: #fff; }
        .lp-btn-dark:hover { background: #2D2D2D; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .lp-btn-outline {
          background: transparent; color: ${PINK};
          border: 1.5px solid rgba(124,92,252,0.35); box-shadow: none;
        }
        .lp-btn-outline:hover { background: rgba(124,92,252,0.06); box-shadow: none; }
        .lp-btn-arrow {
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;
          font-size: 0.9rem; flex-shrink: 0;
        }
        .lp-btn-dark .lp-btn-arrow { background: rgba(255,255,255,0.1); }

        /* Sections */
        .lp-sec { padding: 96px 24px; background: ${BG}; }
        .lp-sec-soft { padding: 96px 24px; background: ${BG_SOFT}; }
        .lp-wrap { max-width: 1140px; margin: 0 auto; }

        /* Text */
        .lp-eyebrow {
          display: inline-block; font-size: 0.78rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: ${GRAD}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 16px;
        }
        .lp-h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; }
        .lp-h2 { font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
        .lp-sub { font-size: 1.1rem; color: ${TEXT_SEC}; line-height: 1.65; }

        /* Nav */
        .lp-nav {
          padding: 0 24px; height: 64px;
          display: flex; align-items: center;
          transition: background 0.3s, box-shadow 0.3s;
          background: transparent;
        }
        .lp-nav.scrolled {
          background: rgba(255,255,255,0.96);
          box-shadow: 0 1px 12px rgba(0,0,0,0.06);
          backdrop-filter: blur(16px);
        }
        .lp-nav-inner {
          max-width: 1140px; margin: 0 auto; width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
        }
        .lp-nav-links { display: flex; gap: 32px; }
        .lp-nav-link {
          font-size: 0.9rem; font-weight: 500; color: ${TEXT_SEC};
          transition: color 0.15s; background: none; border: none; cursor: pointer;
        }
        .lp-nav-link:hover { color: ${TEXT}; }

        /* Plan cards */
        .plan-card {
          background: #fff; border: 1.5px solid ${BORDER};
          border-radius: 24px; padding: 32px 28px;
          display: flex; flex-direction: column; gap: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
        }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.08); }
        .plan-card.popular {
          border-color: ${PINK};
          border-width: 2px;
          box-shadow: 0 8px 32px rgba(124,92,252,0.16);
        }
        .plan-card.popular:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(124,92,252,0.22); }
        .plan-feat { display: flex; align-items: flex-start; gap: 10px; }
        .plan-dot { width: 6px; height: 6px; border-radius: 50%; background: ${PINK}; flex-shrink: 0; margin-top: 6px; }

        /* FAQ */
        .faq-item {
          border: 1px solid ${BORDER}; border-radius: 14px;
          overflow: hidden; transition: border-color 0.2s;
        }
        .faq-item.open { border-color: rgba(124,92,252,0.35); background: rgba(124,92,252,0.04); }
        .faq-q {
          width: 100%; text-align: left; padding: 20px 24px;
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          background: none; border: none; cursor: pointer; font-family: inherit;
          font-size: 1rem; font-weight: 600; color: ${TEXT};
        }
        .faq-icon {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          background: rgba(124,92,252,0.1); color: ${PINK};
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; font-weight: 400; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.2s;
        }
        .faq-item.open .faq-icon { transform: rotate(45deg); background: rgba(124,92,252,0.18); }
        .faq-body {
          display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s cubic-bezier(0.33,1,0.68,1);
        }
        .faq-item.open .faq-body { grid-template-rows: 1fr; }
        .faq-inner { overflow: hidden; }
        .faq-a { padding: 0 24px 20px; color: ${TEXT_SEC}; font-size: 0.95rem; line-height: 1.7; }

        /* Marquee */
        @keyframes lp-scroll-fwd { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes lp-scroll-rev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes social-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        .motion-info-wrap:hover .motion-info-tooltip,
        .motion-info-wrap:focus .motion-info-tooltip,
        .motion-info-wrap:focus-within .motion-info-tooltip { opacity: 1 !important; }
        @keyframes hero-scroll-fwd { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes hero-scroll-rev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .marquee-track { display: flex; gap: 16px; width: max-content; }
        .marquee-fwd { animation: lp-scroll-fwd 48s linear infinite; }
        .marquee-rev { animation: lp-scroll-rev 56s linear infinite; }
        .marquee-wrap {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%);
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-fwd, .marquee-rev { animation: none; }
          [style*="hero-scroll-up"], [style*="hero-scroll-down"] { animation: none !important; }
        }

        /* Scenario comparison */
        .scenario-card {
          border-radius: 20px; padding: 32px;
          flex: 1; min-width: 280px;
        }
        .scenario-bad { background: #fff5f5; border: 1.5px solid #fecaca; }
        .scenario-good { background: #f0fdf4; border: 1.5px solid #bbf7d0; }
        .scenario-item { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 14px; font-size: 0.95rem; color: ${TEXT_SEC}; line-height: 1.55; }

        /* Feature icon */
        .feat-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: rgba(124,92,252,0.1); display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem; flex-shrink: 0; margin-bottom: 16px;
        }

        /* Comparison table */
        .comp-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid ${BORDER};
          font-size: 0.95rem;
        }
        .comp-row:last-child { border-bottom: none; }
        .comp-tool { display: flex; align-items: center; gap: 10px; color: ${TEXT}; }
        .comp-price { color: #dc2626; font-weight: 600; }

        /* Stats box visibility toggle */
        .stats-mobile { display: none; }
        .stats-desktop { display: block; }
        .verdade-extra { display: block; }
        /* Hero sub text mobile */
        .hero-sub-mobile { display: none; }
        .hero-sub-desktop { display: block; }
        /* Motion paragraph */
        .motion-p-desktop { display: block; }
        /* Cost summary */
        .cost-summary-mobile { display: none; }
        .cost-summary-desktop { display: block; }
        /* Banner text — desktop por padrão */
        .banner-text-mobile { display: none; }
        .banner-text-desktop { display: inline; }

        /* Motion features — desktop: lista simples em coluna */
        .motion-features { grid-template-columns: 1fr !important; }
        .motion-feat-item {
          flex-direction: row !important;
          align-items: flex-start !important;
          gap: 14px !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
        }
        .motion-feat-item > div:first-child {
          width: 48px !important; height: 48px !important;
          border-radius: 14px !important;
          background: rgba(124,92,252,0.1) !important;
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
        }

        /* ════════════════════════════════════════════════════════════ */
        /* SHARED: max-width 768px (mobile + tablet)                    */
        /* ════════════════════════════════════════════════════════════ */
        @media (max-width: 768px) {
          body { font-size: 16px; }
          .lp-nav-links { display: none !important; }
          .hero-grid { flex-direction: column !important; }
          .hero-left { width: 100% !important; flex: none !important; max-width: 100% !important; }
          .hero-right { width: 100% !important; flex: none !important; }
          .section-flex { flex-direction: column !important; gap: 32px !important; }
          /* Evita que flex-basis vire min-height fantasma quando vira coluna */
          .section-flex > div { flex: 0 1 auto !important; width: 100% !important; }
          .btn-group { flex-direction: column !important; gap: 12px !important; }
          .btn-group-center { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .footer-flex { flex-direction: column !important; gap: 24px !important; }
          .scenario-wrap { flex-direction: column !important; gap: 16px !important; }
          .banner-inner {
            flex-wrap: nowrap !important;
            gap: 0 !important;
            padding: 6px 36px 6px 16px !important;
            font-size: 0.7rem !important;
          }
          .banner-text-desktop { display: none !important; }
          .banner-text-mobile { display: inline !important; }
          .banner-countdown { display: none !important; }
          .marquee-fwd { animation-duration: 70s !important; }
          .marquee-rev { animation-duration: 80s !important; }

          /* Social proof do hero centralizado no mobile */
          .hero-social-proof { justify-content: center !important; }
          /* Steps grid — 2 colunas no mobile */
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 14px !important; }
          .step-card { padding: 24px 16px !important; }
          /* Motion steps grid — empilha em 1 coluna no mobile pra leitura confortável */
          .motion-steps-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .motion-step-card { padding: 28px 20px 22px !important; }
          /* Objection strip — 2x2 no mobile */
          .objection-strip { grid-template-columns: repeat(2, 1fr) !important; padding: 16px !important; gap: 10px !important; }
          /* Preço riscado + badge centralizado no mobile (no desktop fica à direita) */
          .plan-strike-row { justify-content: center !important; }

          /* Motion videos (seção 6 - 3 cards) — empilhados centrados em mobile e tablet */
          .motion-videos {
            flex-wrap: nowrap !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 0 !important;
            padding: 24px 0 !important;
          }
          .motion-video-card:nth-child(1) {
            transform: rotate(-10deg) !important;
            z-index: 1 !important;
          }
          .motion-video-card:nth-child(2) {
            transform: scale(1.08) !important;
            z-index: 3 !important;
            box-shadow: 0 16px 48px rgba(124,92,252,0.3) !important;
          }
          .motion-video-card:nth-child(3) {
            transform: rotate(10deg) !important;
            z-index: 1 !important;
          }
          /* Galeria motions (seção 7b - 8 cards) — grid 2 colunas */
          .motion-grid-cards {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }

        /* ════════════════════════════════════════════════════════════ */
        /* TABLET: 481px - 768px                                        */
        /* ════════════════════════════════════════════════════════════ */
        @media (min-width: 481px) and (max-width: 768px) {
          .lp-h1 { font-size: clamp(1.8rem, 5vw, 2.4rem) !important; }
          .lp-h2 { font-size: clamp(1.6rem, 4vw, 2.2rem) !important; }
          .lp-sub { font-size: 1rem !important; }
          .lp-eyebrow { font-size: 0.75rem !important; }
          .lp-nav { height: 60px !important; }
          .lp-nav-inner { padding: 0 16px !important; }
          .lp-sec, .lp-sec-soft { padding: 64px 20px !important; }
          .hero-grid { gap: 40px !important; }
          .hero-right-inner { width: 100% !important; }
          .hero-card { width: 220px !important; }
          .sec-grid-3 { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
          .plans-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
          .motion-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
          .plan-card { padding: 24px 20px !important; }
          .lp-btn { min-height: 44px !important; padding: 12px 24px !important; font-size: 0.95rem !important; }
          /* Motion videos (seção 6) — tamanho card no tablet */
          .motion-video-card { width: 180px !important; }
          .motion-video-card:nth-child(1) { margin-right: -50px !important; }
          .motion-video-card:nth-child(3) { margin-left: -50px !important; }
          .testimonial-card { width: 260px !important; }
          .flyer-marquee-card { width: 220px !important; }
        }

        /* ════════════════════════════════════════════════════════════ */
        /* MOBILE: max-width 480px                                      */
        /* ════════════════════════════════════════════════════════════ */
        @media (max-width: 768px) {
          .stats-mobile { display: block !important; }
          .stats-desktop { display: none !important; }
          .verdade-extra { display: none !important; }
          .hero-sub-mobile { display: block !important; }
          .hero-sub-desktop { display: none !important; }
          .motion-p-desktop { display: none !important; }
          .cost-summary-mobile { display: block !important; }
          .cost-summary-desktop { display: none !important; }

          /* Comp-table: garante largura 100% no mobile, sem overflow */
          .comp-table { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; min-width: 0 !important; text-align: left !important; overflow: hidden !important; }
          .comp-table .comp-row { text-align: left !important; }

          /* Comp-row: ferramenta à esquerda, preço à direita — sem quebra */
          .comp-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 10px 12px !important;
          }
          .comp-tool {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex: 1 1 0 !important;
            min-width: 0 !important;
            font-size: 0.82rem !important;
          }
          .comp-tool span:last-child {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .comp-price {
            white-space: nowrap !important;
            font-size: 0.78rem !important;
            flex-shrink: 0 !important;
            text-align: right !important;
          }

          /* ── Centralização global mobile ── */
          /* Seções com texto: centraliza headings e subs */
          .lp-sec .lp-wrap > div,
          .lp-sec-soft .lp-wrap > div { text-align: center; }
          .lp-eyebrow { display: block; text-align: center; }
          .lp-h2 { text-align: center; }
          .lp-sub { text-align: center; }

          /* Seções flex (section-flex): centraliza children */
          .section-flex > div { text-align: center; }
          .section-flex .lp-eyebrow,
          .section-flex .lp-h2,
          .section-flex .lp-sub,
          .section-flex p { text-align: center; }

          /* Botões: centraliza dentro de containers */
          .btn-group { justify-content: center !important; }
          .section-flex .lp-btn { align-self: center; }

          /* Hero: centraliza texto */
          .hero-left { text-align: center; }
          .hero-left .lp-h1 { text-align: center; }
          .hero-left .lp-sub { text-align: center; }

          /* Avatar group: centraliza */
          .hero-left [style*="display: flex"][style*="alignItems: center"] { justify-content: center; }

          /* Feat icon: centraliza */
          .section-flex .feat-icon { margin: 0 auto 16px; }

          /* Tópicos com ícone (feat-icon rows): mantém alinhamento interno esquerdo mas centraliza o bloco */
          .section-flex [style*="alignItems: flex-start"] { text-align: left; }

          /* FAQ centraliza título */
          #faq .lp-h2 { text-align: center; }

          /* Planos: centraliza toggle e título */
          #planos [style*="textAlign"] { text-align: center !important; }

          /* Tudo Incluso cards — mobile */
          .sec-grid-3 [data-reveal] {
            padding: 16px 14px !important;
          }
          .sec-grid-3 .feat-icon {
            width: 36px !important; height: 36px !important;
            border-radius: 10px !important;
            font-size: 1rem !important;
            margin-bottom: 10px !important;
            margin-left: auto !important; margin-right: auto !important;
          }
          .sec-grid-3 h3 { font-size: 0.85rem !important; text-align: center; }
          .sec-grid-3 p { font-size: 0.78rem !important; text-align: center; }

          /* Motion features — mobile: grid 2x2 com cards */
          .motion-features { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
          .motion-feat-item {
            flex-direction: column !important;
            background: #fff !important;
            border: 1px solid ${BORDER} !important;
            border-radius: 16px !important;
            padding: 16px 14px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
            text-align: left !important;
          }
          .motion-feat-item > div:first-child {
            width: 36px !important; height: 36px !important;
            border-radius: 10px !important;
            margin-bottom: 0 !important;
          }

          /* Stats bar — mobile: grid 2x2 limpo */
          .motion-stats-bar {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 0 !important;
          }
          .motion-stat-item {
            border-right: none !important;
            border-bottom: 1px solid ${BORDER};
            padding: 20px 12px !important;
          }
          .motion-stat-item:nth-child(1),
          .motion-stat-item:nth-child(2) { border-bottom: 1px solid ${BORDER}; }
          .motion-stat-item:nth-child(3),
          .motion-stat-item:nth-child(4) { border-bottom: none !important; }
          .motion-stat-item:nth-child(1),
          .motion-stat-item:nth-child(3) { border-right: 1px solid ${BORDER} !important; }

          /* CTA motion — mobile */
          .motion-cta .lp-btn {
            width: 100% !important;
            font-size: 0.95rem !important;
            padding: 14px 20px !important;
          }
        }
        @media (max-width: 480px) {
          .lp-h1 { font-size: clamp(1.5rem, 6vw, 1.9rem) !important; }
          .lp-h2 { font-size: clamp(1.3rem, 5vw, 1.7rem) !important; }
          .lp-sub { font-size: 0.95rem !important; }
          .lp-eyebrow { font-size: 0.7rem !important; }
          .lp-nav { height: 56px !important; }
          .lp-nav-inner { padding: 0 12px !important; gap: 8px !important; }
          .lp-btn {
            width: 100% !important;
            min-height: 44px !important;
            padding: 12px 16px !important;
            font-size: 0.9rem !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            box-sizing: border-box !important;
          }
          .lp-btn-arrow { width: 28px !important; height: 28px !important; }
          .lp-sec, .lp-sec-soft { padding: 48px 16px !important; }
          .hero-section { padding-left: 16px !important; padding-right: 16px !important; }
          .hero-grid { gap: 24px !important; }
          .hero-card { width: 220px !important; }
          .hero-right-inner { gap: 12px !important; }
          .sec-grid-3 { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
          .plans-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .motion-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .plan-card { padding: 20px 16px !important; }
          .feat-icon { width: 40px !important; height: 40px !important; font-size: 1.1rem !important; }
          .faq-q { padding: 16px 20px !important; font-size: 0.95rem !important; }
          .faq-a { padding: 0 20px 16px !important; font-size: 0.9rem !important; }
          .marquee-wrap { -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%) !important; mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%) !important; }
          .section-flex { gap: 24px !important; }
          .motion-video-card { width: 150px !important; }
          .motion-video-card:nth-child(1) { margin-right: -42px !important; }
          .motion-video-card:nth-child(3) { margin-left: -42px !important; }
          .motion-grid-cards { gap: 10px !important; }
          .testimonial-card { width: 240px !important; }
          .flyer-marquee-card { width: 200px !important; }
          .comp-row { padding: 12px 14px !important; font-size: 0.85rem !important; }
          .comp-price { font-size: 0.8rem !important; }
          .footer-flex { gap: 20px !important; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HEADER FIXO (banner + nav juntos)                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200 }}>
        {/* Nav */}
        <nav className={`lp-nav${navScrolled ? " scrolled" : ""}`} style={{ position: "relative", top: "auto" }}>
          <div className="lp-nav-inner">
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "1.2rem", color: TEXT, letterSpacing: "-0.02em" }}>
              Arcano<span style={{ ...GRAD_TEXT }}>App</span>
            </div>
            <div className="lp-nav-links">
              {["Cómo Funciona", "Recursos", "Planes", "FAQ"].map((item, i) => (
                <button
                  key={i}
                  className="lp-nav-link"
                  onClick={() => {
                    const ids: Record<string, string> = {
                      "Cómo Funciona": "como-funciona",
                      Recursos: "recursos",
                      Planes: "planos",
                      FAQ: "faq",
                    };
                    document.getElementById(ids[item])?.scrollIntoView({ behavior: "smooth" });
                  }}
                >{item}</button>
              ))}
            </div>
            <button className="lp-btn lp-btn-grad" style={{ padding: "10px 22px", fontSize: "0.9rem" }} onClick={goPlanos}>
              Crear mi flyer
            </button>
          </div>
        </nav>
        {/* Banner — abaixo do nav */}
        {bannerVisible && (
          <div style={{
            background: GRAD, color: "#fff", textAlign: "center",
            padding: "12px 48px 12px 24px", fontSize: "0.82rem",
            fontWeight: 600, letterSpacing: "0.01em", position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
          }} className="banner-inner">
            <span className="banner-text-desktop">✦ Recibiste un acceso especial al Flyer Maker AI — 52% off hasta el 15 de mayo</span>
            <span className="banner-text-mobile">PROMO DE LANZAMIENTO: 52%OFF HASTA EL 15 DE MAYO</span>
            <div className="banner-countdown" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {[
                { val: countdown.days, label: "d" },
                { val: countdown.hours, label: "h" },
                { val: countdown.mins, label: "m" },
                { val: countdown.secs, label: "s" },
              ].map((item, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.2)", padding: "4px 8px",
                  borderRadius: 6, fontWeight: 700, fontSize: "0.75rem",
                  minWidth: 32, textAlign: "center",
                }}>
                  {String(item.val).padStart(2, "0")}{item.label}
                </div>
              ))}
            </div>
            <button
              onClick={() => setBannerVisible(false)}
              style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.25)", border: "none", color: "#fff",
                width: 24, height: 24, borderRadius: "50%", cursor: "pointer",
                fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. HERO                                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="hero-section" style={{
        paddingTop: bannerVisible ? "168px" : "124px",
        paddingBottom: 80,
        paddingLeft: 24,
        paddingRight: 24,
        background: BG,
      }}>
        <div className="lp-wrap">
          <div className="hero-grid" style={{ display: "flex", alignItems: "center", gap: 64, justifyContent: "space-between" }}>

            {/* ── Left ── */}
            <div className="hero-left" style={{ flex: "0 0 auto", maxWidth: 560 }}>
              <div data-reveal>
                <span className="lp-eyebrow">Flyer Maker AI</span>
              </div>
              <h1 data-reveal className="lp-h1" style={{ marginBottom: 20 }}>
                Crea{" "}
                <span style={GRAD_TEXT}>flyers animados con IA</span>
                {" "}¡en menos de 1 minuto!
              </h1>
              {/* Desktop subtitle */}
              <p data-reveal className="lp-sub hero-sub-desktop" style={{ marginBottom: 16 }}>
                Genera flyers y videos animados de manera automática con IA.
              </p>
              <p data-reveal className="lp-sub hero-sub-desktop" style={{ marginBottom: 36 }}>
                La IA hace todo por ti: layout profesional, textos persuasivos y artes listas para publicar.{" "}
                <strong style={{ color: TEXT }}>Sin Canva. Sin diseñador. Sin perder horas.</strong>
              </p>
              {/* Mobile subtitle — resumido */}
              <p data-reveal className="lp-sub hero-sub-mobile" style={{ marginBottom: 28 }}>
                La IA hace todo por ti en menos de 60 segundos.{" "}
                <strong style={{ color: TEXT }}>Sin Canva. Sin diseñador.</strong>
              </p>

              <div data-reveal className="btn-group" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 36 }}>
                <button className="lp-btn lp-btn-grad" onClick={goPlanos}>
                  Quiero Crear Flyers Profesionales
                  <span className="lp-btn-arrow">→</span>
                </button>
              </div>

              {/* Social proof avatars */}
              <div data-reveal className="hero-social-proof" style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start" }}>
                <div style={{ display: "flex" }}>
                  {[1, 2, 3].map((n, i) => (
                    <img
                      key={n}
                      src={`/images/social-proof-${n}.webp`}
                      alt=""
                      width="32"
                      height="32"
                      loading="eager"
                      decoding="async"
                      fetchPriority="low"
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        border: "2.5px solid #fff", objectFit: "cover",
                        marginLeft: i === 0 ? 0 : -10,
                      }}
                    />
                  ))}
                </div>
                <span style={{
                  position: "relative", display: "inline-flex",
                  width: 9, height: 9, marginLeft: 4, marginRight: 2,
                }}>
                  <span style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "#10b981", opacity: 0.75,
                    animation: "social-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                  }} />
                  <span style={{
                    position: "relative", width: 9, height: 9, borderRadius: "50%",
                    background: "#10b981", boxShadow: "0 0 6px 2px rgba(52,211,153,0.4)",
                  }} />
                </span>
                <p style={{ fontSize: "0.85rem", color: TEXT_SEC, lineHeight: 1.4 }}>
                  <strong style={{ color: TEXT }}>+7.500</strong> usuarios activos
                </p>
              </div>
            </div>

            {/* ── Right: Flyer marquee — 1 imagem por coluna, rola direita→esquerda ── */}
            <div className="hero-right" style={{
              flex: "0 0 auto",
              width: 560,
              overflow: "hidden",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)",
              maskImage: "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)",
            }}>
              <div className="hero-right-inner" style={{ display: "flex", gap: 20, width: "max-content", animation: "hero-scroll-fwd 60s linear infinite" }}>
                {[...FLYER_ROW_1, ...FLYER_ROW_1].map((src, i) => (
                  <div key={i} className="hero-card" style={{
                    width: 260,
                    flexShrink: 0,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: `1px solid ${BORDER}`,
                    aspectRatio: "2/3",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  }}>
                    <img
                      src={optimizeImg(src, 280)}
                      srcSet={optimizeSrcSet(src, 280)}
                      alt=""
                      loading={i < 4 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={i < 2 ? "high" : "auto" as any}
                      width={260}
                      height={390}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. A VERDADE                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec-soft">
        <div className="lp-wrap">
          <div className="section-flex" style={{ display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 380px" }}>
              <span data-reveal className="lp-eyebrow">La verdad</span>
              <h2 data-reveal className="lp-h2" style={{ marginBottom: 24 }}>
                La verdad que nadie te cuenta sobre{" "}
                <span style={GRAD_TEXT}>crear flyers</span>
              </h2>
              <p data-reveal className="lp-sub" style={{ marginBottom: 20 }}>
                Las herramientas de diseño no fueron hechas para quien necesita crear artes todos los días. ¿Y motion en After Effects? Cuesta caro y lleva horas.
              </p>
              <p data-reveal className="lp-sub verdade-extra" style={{ marginBottom: 32 }}>
                Mientras tú intentas dejar todo bonito, tus competidores con IA ya publicaron 5 artes animadas.
              </p>
              {/* Stats box — mobile only (acima do botão) */}
              <div className="stats-mobile" style={{ marginBottom: 24 }}>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
                  {[
                    { n: "2h+", label: "gastadas en promedio por flyer en Canva" },
                    { n: "R$300+", label: "por tarea de diseñador o motion designer" },
                    { n: "8h+", label: "para crear 1 motion en After Effects" },
                    { n: "< 60s", label: "es lo que tarda en Flyer Maker AI" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: i < 3 ? 16 : 0, marginBottom: i < 3 ? 16 : 0, borderBottom: i < 3 ? `1px solid ${BORDER}` : "none" }}>
                      <div style={{ color: i === 3 ? "#10b981" : "#dc2626", fontFamily: FONT, fontSize: "1.4rem", fontWeight: 700, minWidth: 70 }}>{s.n}</div>
                      <div style={{ color: TEXT_SEC, fontSize: "0.85rem", lineHeight: 1.45 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div data-reveal className="stats-desktop" style={{ flex: "1 1 300px" }}>
              <div style={{
                background: "#fff", border: `1px solid ${BORDER}`,
                borderRadius: 20, padding: 32,
                boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
              }}>
                {[
                  { n: "2h+", label: "gastadas en promedio por flyer en Canva" },
                  { n: "R$300+", label: "por tarea de diseñador o motion designer" },
                  { n: "8h+", label: "para crear 1 motion en After Effects desde cero" },
                  { n: "< 60s", label: "es lo que tarda en Flyer Maker AI" },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 16, alignItems: "center",
                    paddingBottom: i < 3 ? 20 : 0, marginBottom: i < 3 ? 20 : 0,
                    borderBottom: i < 3 ? `1px solid ${BORDER}` : "none",
                  }}>
                    <div style={{ color: i === 3 ? "#10b981" : "#dc2626", fontFamily: FONT, fontSize: "1.6rem", fontWeight: 700, minWidth: 80 }}>{s.n}</div>
                    <div style={{ color: TEXT_SEC, fontSize: "0.9rem", lineHeight: 1.5 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4b. DEMO / VÍDEO — Veja na Prática                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec" style={{ textAlign: "center" }}>
        <div className="lp-wrap">
          <span data-reveal className="lp-eyebrow">Velo en la Práctica</span>
          <h2 data-reveal className="lp-h2" style={{ marginBottom: 16 }}>
            Cómo funciona Flyer Maker AI
          </h2>
          <p data-reveal className="lp-sub" style={{ maxWidth: 540, margin: "0 auto 40px" }}>
            En menos de 2 minutos entiendes el proceso completo — del prompt al flyer publicado.
          </p>
          <div
            data-reveal
            onClick={() => !demoVideoActive && setDemoVideoActive(true)}
            style={{
              maxWidth: 800, margin: "0 auto",
              background: "#000", border: `1px solid ${BORDER}`,
              borderRadius: 20, aspectRatio: "16/9",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
              overflow: "hidden", position: "relative",
              cursor: demoVideoActive ? "default" : "pointer",
            }}
          >
            {demoVideoActive ? (
              <iframe
                src="https://www.youtube.com/embed/uX1oXFs9gNk?autoplay=1&rel=0&modestbranding=1&playsinline=1"
                title="Cómo funciona Flyer Maker AI"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%", border: "none",
                }}
              />
            ) : (
              <>
                <img
                  src="https://i.ytimg.com/vi/uX1oXFs9gNk/maxresdefault.jpg"
                  alt="Cómo funciona Flyer Maker AI"
                  loading="lazy"
                  decoding="async"
                  width={1280}
                  height={720}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover", display: "block",
                  }}
                />
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)",
                  pointerEvents: "none",
                }} />
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 80, height: 80, borderRadius: "50%",
                  background: GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "2rem", color: "#fff",
                  paddingLeft: 6,
                  boxShadow: "0 12px 40px rgba(124,92,252,0.5)",
                  pointerEvents: "none",
                }}>▶</div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 6. MOTION AI — SEÇÃO DEDICADA                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec-soft">
        <div className="lp-wrap">
          <div className="section-flex" style={{ display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap" }}>

            {/* Vídeos motion AI — MP4 hospedado, autoplay loop muted (lazy load via IntersectionObserver) */}
            <div data-reveal ref={motionSectionRef} className="motion-videos" style={{ flex: "0 0 auto", display: "flex", gap: 0, alignItems: "center" }}>
              {[
                "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos//flyer-motion-1777582594378.mp4",
                "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos//flyer-motion-1777582255644.mp4",
                "https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/videos//Seedance%2020%20-%20_%20%20title%20Forr_%20de%20S_o%20Jo_o%20-%20Poster%20Animation_%20%20genre%20Motion%20Design%20%20Event%20Promo_%20%20du.mp4",
              ].map((src, i) => (
                <div key={i} className="motion-video-card" style={{
                  width: 220, borderRadius: 16, overflow: "hidden",
                  border: `1px solid ${BORDER}`, aspectRatio: "9/16",
                  background: "#0d0b1a",
                  boxShadow: i === 1 ? "0 20px 56px rgba(124,92,252,0.32)" : "0 8px 24px rgba(0,0,0,0.12)",
                  transform: i === 0 ? "rotate(-10deg)" : i === 2 ? "rotate(10deg)" : "scale(1.08)",
                  marginRight: i === 0 ? -56 : 0,
                  marginLeft: i === 2 ? -56 : 0,
                  position: "relative", zIndex: i === 1 ? 3 : 1,
                }}>
                  {motionInView && (
                    <video
                      src={src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover", display: "block",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Copy */}
            <div style={{ flex: "1 1 340px" }}>
              <span data-reveal className="lp-eyebrow">Flyer Animado</span>
              <h2 data-reveal className="lp-h2" style={{ marginBottom: 20 }}>
                Olvida After Effects.<br />
                <span style={GRAD_TEXT}>Tu arte se mueve con IA.</span>
              </h2>
              <p data-reveal className="lp-sub motion-p-desktop" style={{ marginBottom: 20 }}>
                Los motion designers cobran R$300–800 por animación. En After Effects, te toma días solo aprender la herramienta. Con Flyer Maker AI, transformas cualquier arte en un video animado de 10 segundos en menos de 1 minuto.
              </p>
              <div data-reveal className="motion-features" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                {[
                  { icon: <Zap size={20} strokeWidth={1.75} />, title: "Generación en < 60s", desc: "Del flyer al video animado en menos de 1 minuto." },
                  { icon: <Smartphone size={20} strokeWidth={1.75} />, title: "Stories y Reels", desc: "Formato vertical perfecto para Instagram y TikTok." },
                  { icon: <Clapperboard size={20} strokeWidth={1.75} />, title: "Sin After Effects", desc: "Sin curva de aprendizaje, sin complicación." },
                  { icon: <BrainCircuit size={20} strokeWidth={1.75} />, title: "Ahorra R$300–800", desc: "Lo que cobra un motion designer, lo haces con IA." },
                ].map((item, i) => (
                  <div key={i} className="motion-feat-item" style={{
                    display: "flex", flexDirection: "column", gap: 10,
                    background: "#fff", border: `1px solid ${BORDER}`,
                    borderRadius: 16, padding: "20px 16px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: "rgba(124,92,252,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: PINK,
                    }}>{item.icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: TEXT, marginBottom: 4, lineHeight: 1.3 }}>{item.title}</div>
                      <div style={{ color: TEXT_SEC, fontSize: "0.82rem", lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 7b. GALERIA — MOTIONS (carro-chefe)                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: "linear-gradient(135deg, #f5f0ff 0%, #faf7ff 40%, #ede8ff 100%)", padding: "96px 0", overflow: "hidden", position: "relative" }}>

        {/* Header */}
        <div className="lp-wrap" style={{ paddingLeft: 24, paddingRight: 24, textAlign: "center", marginBottom: 56 }}>
          <div data-reveal style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,92,252,0.12)", border: "1px solid rgba(124,92,252,0.25)", borderRadius: 999, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: GRAD, display: "inline-block", animation: "pulse-dot 1.8s ease-in-out infinite" }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: PINK, letterSpacing: "0.08em", textTransform: "uppercase" }}>Motion AI</span>
          </div>
          <h2 data-reveal style={{ fontFamily: FONT, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", color: TEXT, marginBottom: 16 }}>
            Tu arte en movimiento.<br />
            <span style={GRAD_TEXT}>Generada por IA en menos de 1 minuto.</span>
          </h2>
        </div>

        {/* Grid de 8 motions — facade pattern: poster WebP por padrão, iframe YouTube carrega no clique */}
        <div data-reveal className="lp-wrap" style={{ paddingLeft: 24, paddingRight: 24, marginBottom: 56 }}>
          <div className="motion-grid motion-grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {MOTION_VIDEOS.map((v, i) => {
              const isActive = activeMotion.has(i);
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (!isActive) {
                      setActiveMotion(prev => {
                        const next = new Set(prev);
                        next.add(i);
                        return next;
                      });
                    }
                  }}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(124,92,252,0.2)",
                    aspectRatio: "9/16",
                    background: "#0d0b1a",
                    position: "relative",
                    boxShadow: i % 3 === 1
                      ? "0 0 32px rgba(124,92,252,0.35), 0 12px 28px rgba(0,0,0,0.14)"
                      : "0 8px 20px rgba(0,0,0,0.1)",
                    transition: "transform 0.3s, box-shadow 0.3s",
                    cursor: isActive ? "default" : "pointer",
                  }}
                  onMouseEnter={e => {
                    if (isActive) return;
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-6px) scale(1.02)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(124,92,252,0.45), 0 16px 48px rgba(0,0,0,0.5)";
                  }}
                  onMouseLeave={e => {
                    if (isActive) return;
                    (e.currentTarget as HTMLElement).style.transform = "none";
                    (e.currentTarget as HTMLElement).style.boxShadow = i % 3 === 1
                      ? "0 0 32px rgba(124,92,252,0.35), 0 12px 28px rgba(0,0,0,0.14)"
                      : "0 8px 20px rgba(0,0,0,0.1)";
                  }}
                >
                  {isActive ? (
                    <video
                      src={v.video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      controls={false}
                      style={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%",
                        objectFit: "cover", display: "block",
                      }}
                    />
                  ) : (
                    <>
                      <img
                        src={optimizeImg(v.poster, 320)}
                        srcSet={optimizeSrcSet(v.poster, 320)}
                        alt={`motion AI ${i + 1}`}
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={569}
                        style={{
                          width: "100%", height: "100%",
                          objectFit: "cover", display: "block",
                        }}
                      />
                      {/* Subtle gradient overlay */}
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)",
                        pointerEvents: "none",
                      }} />
                      {/* Play button glassmorphic */}
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 52, height: 52, borderRadius: "50%",
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        border: "1.5px solid rgba(255,255,255,0.35)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.05rem", color: "#fff",
                        paddingLeft: 4,
                        boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
                        pointerEvents: "none",
                      }}>▶</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats bar */}
        <div data-reveal className="lp-wrap" style={{ paddingLeft: 24, paddingRight: 24, marginBottom: 48 }}>
          <div className="motion-stats-bar" style={{
            display: "flex", gap: 0,
            background: "#fff",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 4px 24px rgba(124,92,252,0.1)",
            borderRadius: 16, overflow: "hidden",
          }}>
            {[
              { n: "10s", label: "duración del video" },
              { n: "< 60s", label: "para generar" },
              { n: "R$0", label: "de After Effects" },
              { n: "∞", label: "posibilidades" },
            ].map((s, i, arr) => (
              <div key={i} className="motion-stat-item" style={{
                flex: "1 1 0", padding: "24px 16px", textAlign: "center",
                borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : "none",
              }}>
                <div style={{ ...GRAD_TEXT as any, fontFamily: FONT, fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>{s.n}</div>
                <div style={{ color: TEXT_MUT, fontSize: "0.78rem", lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="motion-cta" style={{ textAlign: "center", paddingLeft: 24, paddingRight: 24 }}>
          <button className="lp-btn lp-btn-grad" style={{ fontSize: "1.05rem", padding: "16px 40px", boxShadow: "0 8px 40px rgba(124,92,252,0.5)" }} onClick={goPlanos}>
            Quiero Crear Mis Motions con IA
            <span className="lp-btn-arrow">→</span>
          </button>
          <p style={{ color: TEXT_MUT, fontSize: "0.82rem", marginTop: 14 }}>Tus competidores ya están usándolo. No te quedes atrás.</p>
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.4); }
          }
        `}</style>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 7c. PASSO A PASSO MOTION — quebra objeção "é difícil"                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec-soft">
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
            <span data-reveal className="lp-eyebrow">Tan Fácil Como 1, 2, 3</span>
            <h2 data-reveal className="lp-h2" style={{ marginBottom: 16 }}>
              Sin prompts. Sin timeline.<br />
              <span style={GRAD_TEXT}>Sin ninguna complicación.</span>
            </h2>
            <p data-reveal className="lp-sub">
              Tú <strong style={{ color: TEXT }}>no escribes ningún prompt</strong>. No necesitas saber motion design. No necesitas abrir After Effects, Photoshop ni Premiere. <strong style={{ color: TEXT }}>3 pasos. Menos de 1 minuto.</strong>
            </p>
          </div>

          <div data-reveal className="motion-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32 }}>
            {[
              {
                n: "1",
                icon: <Camera size={28} strokeWidth={1.75} />,
                title: "Envía tu imagen",
                desc: "Suelta el flyer que ya tienes en la computadora o el celular. PNG o JPG, da igual.",
                tag: "PNG · JPG",
              },
              {
                n: "2",
                icon: <Smartphone size={28} strokeWidth={1.75} />,
                title: "Elige el formato",
                desc: "Stories, Reels, TikTok o feed. Solo haz clic en el tamaño que quieres publicar.",
                tag: "9:16 · 1:1 · 16:9",
              },
              {
                n: "3",
                icon: <Sparkles size={28} strokeWidth={1.75} />,
                title: "Haz clic en Generar",
                desc: "La IA hace todo. En menos de 60 segundos tu motion está listo para descargar y publicar.",
                tag: "Cero prompt · Listo en 60s",
                highlight: true,
              },
            ].map((s, i) => (
              <div key={i} className={`motion-step-card${s.highlight ? " highlight" : ""}`} style={{
                position: "relative",
                background: s.highlight ? "linear-gradient(135deg, rgba(124,92,252,0.06), rgba(168,85,247,0.06))" : "#fff",
                border: s.highlight ? `1.5px solid rgba(124,92,252,0.35)` : `1px solid ${BORDER}`,
                borderRadius: 20, padding: "36px 24px 28px",
                boxShadow: s.highlight ? "0 12px 40px rgba(124,92,252,0.18)" : "0 2px 12px rgba(0,0,0,0.04)",
                display: "flex", flexDirection: "column", gap: 14,
              }}>
                <div style={{
                  position: "absolute", top: -16, left: 24,
                  background: GRAD, color: "#fff",
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.05rem", fontWeight: 700,
                  boxShadow: "0 6px 20px rgba(124,92,252,0.45)",
                }}>{s.n}</div>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: "rgba(124,92,252,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: PINK, marginTop: 4,
                }}>{s.icon}</div>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{s.title}</h3>
                  <p style={{ color: TEXT_SEC, fontSize: "0.9rem", lineHeight: 1.55 }}>{s.desc}</p>
                </div>
                <div style={{
                  marginTop: "auto",
                  display: "inline-block", alignSelf: "flex-start",
                  background: s.highlight ? GRAD : "rgba(124,92,252,0.08)",
                  color: s.highlight ? "#fff" : PINK,
                  fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em",
                  padding: "5px 10px", borderRadius: 999, textTransform: "uppercase",
                }}>{s.tag}</div>
              </div>
            ))}
          </div>

          {/* Strip de objeções resolvidas */}
          <div data-reveal className="objection-strip" style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
            background: "#fff", border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: "20px 24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            maxWidth: 920, marginLeft: "auto", marginRight: "auto",
          }}>
            {[
              "Sin prompt",
              "Sin After Effects",
              "Sin timeline",
              "Sin curva de aprendizaje",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600, color: TEXT, justifyContent: "center" }}>
                <span style={{ color: "#10b981", fontSize: "1rem", flexShrink: 0 }}>✓</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 7. GALERIA — FLYERS ESTÁTICOS                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div className="lp-wrap" style={{ paddingLeft: 24, paddingRight: 24, textAlign: "center", marginBottom: 40 }}>
          <span data-reveal className="lp-eyebrow">Ejemplos Reales</span>
          <h2 data-reveal className="lp-h2">Flyers generados por IA</h2>
          <p data-reveal className="lp-sub" style={{ maxWidth: 480, margin: "12px auto 0" }}>
            IA que aprende con referencias reales y recrea en tu estilo — resultado profesional en segundos.
          </p>
        </div>

        <div className="marquee-wrap" style={{ marginBottom: 16 }}>
          <div className="marquee-track marquee-fwd">
            {[...FLYER_ROW_1, ...FLYER_ROW_1].map((src, i) => (
              <div key={i} className="flyer-marquee-card" style={{ width: 280, flexShrink: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${BORDER}`, aspectRatio: "2/3", background: BG_SOFT }}>
                <img
                  src={optimizeImg(src, 300)}
                  srcSet={optimizeSrcSet(src, 300)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={280}
                  height={420}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="marquee-wrap">
          <div className="marquee-track marquee-rev">
            {[...FLYER_ROW_2, ...FLYER_ROW_2].map((src, i) => (
              <div key={i} className="flyer-marquee-card" style={{ width: 280, flexShrink: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${BORDER}`, aspectRatio: "2/3", background: BG_SOFT }}>
                <img
                  src={optimizeImg(src, 300)}
                  srcSet={optimizeSrcSet(src, 300)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={280}
                  height={420}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 9. FAÇA AS CONTAS                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="section-flex" style={{ display: "flex", gap: 64, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 360px" }}>
              <span data-reveal className="lp-eyebrow">Haz las Cuentas</span>
              <h2 data-reveal className="lp-h2" style={{ marginBottom: 16 }}>
                ¿Cuánto gastas<br />intentando crear flyers?
              </h2>
              <p data-reveal className="lp-sub" style={{ marginBottom: 0 }}>
                Sumando todo lo que usas hoy, el costo es mucho mayor de lo que parece.
              </p>
            </div>
            <div data-reveal className="comp-table" style={{ flex: "1 1 360px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              {COMPARISON_ROWS.map((r, i) => {
                const iconMap: Record<string, React.ReactNode> = {
                  canva: <Figma size={16} strokeWidth={1.75} />,
                  ae: <Clapperboard size={16} strokeWidth={1.75} />,
                  ps: <Layers size={16} strokeWidth={1.75} />,
                  motion: <Video size={16} strokeWidth={1.75} />,
                  designer: <Users size={16} strokeWidth={1.75} />,
                  ai: <BrainCircuit size={16} strokeWidth={1.75} />,
                };
                return (
                  <div key={i} className="comp-row">
                    <div className="comp-tool">
                      <span style={{ color: TEXT_MUT, display: "flex", alignItems: "center" }}>{iconMap[r.icon]}</span>
                      <span style={{ fontWeight: 500 }}>{r.tool}</span>
                    </div>
                    <span className="comp-price">{r.price}</span>
                  </div>
                );
              })}
              <div className="comp-row" style={{ background: "rgba(124,92,252,0.05)", borderTop: `2px solid rgba(124,92,252,0.2)` }}>
                <div className="comp-tool">
                  <span style={{ color: PINK, display: "flex", alignItems: "center" }}><Sparkles size={16} strokeWidth={1.75} /></span>
                  <span style={{ fontWeight: 700, ...GRAD_TEXT as any }}>Flyer Maker AI</span>
                </div>
                <span className="comp-price" style={{ ...GRAD_TEXT as any, fontWeight: 700, whiteSpace: "nowrap" }}>desde R$ 39,90/mes</span>
              </div>
            </div>
            {/* Cost summary abaixo da tabela — visível em todas as telas */}
            <div data-reveal style={{
              background: "linear-gradient(135deg, rgba(124,92,252,0.08), rgba(168,85,247,0.08))",
              border: `1px solid rgba(124,92,252,0.2)`,
              borderRadius: 16, padding: 24, width: "100%",
              flex: "1 1 100%",
            }}>
              <div style={{ fontSize: "0.85rem", color: TEXT_MUT, marginBottom: 6, textAlign: "center" }}>Costo total estimado por mes:</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 700, color: "#dc2626", letterSpacing: "-0.03em", textAlign: "center" }}>R$ 652+/mes</div>
              <div style={{ fontSize: "0.85rem", color: TEXT_MUT, marginTop: 8, textAlign: "center" }}>vs. Flyer Maker AI desde <strong style={{ color: PINK }}>R$ 39,90/mes</strong></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 10. PREÇOS                                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec-soft" id="planos">
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span data-reveal className="lp-eyebrow">Comienza Ahora</span>
            <h2 data-reveal className="lp-h2" style={{ marginBottom: 16 }}>Elige tu plan</h2>
            <p data-reveal className="lp-sub" style={{ maxWidth: 500, margin: "0 auto 32px" }}>
              Todos los planes incluyen acceso a Flyer Maker AI. Cancela cuando quieras.
            </p>
            {/* Toggle */}
            <div data-reveal style={{ display: "inline-flex", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, padding: 4, gap: 4 }}>
              {["Mensual", "Anual"].map((label, i) => (
                <button
                  key={i}
                  onClick={() => setAnnual(i === 1)}
                  style={{
                    borderRadius: 999, padding: "8px 22px", border: "none",
                    fontFamily: FONT, fontWeight: 600, fontSize: "0.9rem",
                    cursor: "pointer", transition: "all 0.2s",
                    background: (annual ? i === 1 : i === 0) ? GRAD : "transparent",
                    color: (annual ? i === 1 : i === 0) ? "#fff" : TEXT_SEC,
                    boxShadow: (annual ? i === 1 : i === 0) ? "0 4px 16px rgba(124,92,252,0.3)" : "none",
                  }}
                >{label}{i === 1 && <span style={{ marginLeft: 6, fontSize: "0.75rem", opacity: 0.9 }}>hasta -20%</span>}</button>
              ))}
            </div>
          </div>

          <div data-reveal className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 280px))", gap: 20, justifyContent: "center" }}>
            {PLANS.map((p, i) => {
              const isUnlimited = p.name === "IA Unlimited";
              const RED_GRAD = "linear-gradient(135deg, #ef4444 0%, #f43f5e 50%, #ec4899 100%)";
              return (
              <div
                key={i}
                className={`plan-card${p.popular ? " popular" : ""}`}
                style={isUnlimited ? {
                  borderColor: "#ef4444",
                  borderWidth: 2,
                  boxShadow: "0 8px 32px rgba(239,68,68,0.18)",
                } : undefined}
              >
                {p.badge && (
                  <div style={{
                    position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                    background: isUnlimited ? RED_GRAD : GRAD, color: "#fff",
                    fontSize: "0.72rem", fontWeight: 700, padding: "4px 14px",
                    borderRadius: 999, whiteSpace: "nowrap",
                    boxShadow: isUnlimited ? "0 4px 14px rgba(239,68,68,0.45)" : "0 4px 12px rgba(124,92,252,0.35)",
                  }}>{p.badge}</div>
                )}
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{p.name}</div>
                <div>
                  <div className="plan-strike-row" style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8, marginBottom: 4 }}>
                    {p.name === "Pro" && (
                      <>
                        <div style={{ fontSize: "0.75rem", color: TEXT_MUT, textDecoration: "line-through" }}>R$ 119,80</div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, background: PINK, color: "#fff", padding: "2px 8px", borderRadius: 4 }}>-50%</div>
                      </>
                    )}
                    {p.name === "Ultimate" && (
                      <>
                        <div style={{ fontSize: "0.75rem", color: TEXT_MUT, textDecoration: "line-through" }}>R$ 232,40</div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, background: PINK, color: "#fff", padding: "2px 8px", borderRadius: 4 }}>-66%</div>
                      </>
                    )}
                    {p.name === "IA Unlimited" && (
                      <>
                        <div style={{ fontSize: "0.75rem", color: TEXT_MUT, textDecoration: "line-through" }}>R$ 499,00</div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: 4 }}>-66%</div>
                      </>
                    )}
                  </div>
                  <span style={{
                    fontFamily: FONT, fontSize: "1.9rem", fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: TEXT,
                  }}>{annual ? p.annualPrice : p.monthlyPrice}</span>
                  <span style={{ color: TEXT_MUT, fontSize: "0.8rem" }}>/mes</span>
                </div>
                {annual && p.annualTotal && (
                  <div style={{ color: TEXT_MUT, fontSize: "0.75rem", marginTop: -12 }}>{p.annualTotal}</div>
                )}
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                  <div style={isUnlimited ? {
                    color: "#ef4444",
                    fontSize: "0.95rem", fontWeight: 700, marginBottom: 4, letterSpacing: "-0.01em",
                  } : { ...GRAD_TEXT as any, fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>{p.credits}</div>
                  {(p as any).extraInfo && (
                    <div style={{
                      display: "inline-block",
                      background: "rgba(124,92,252,0.1)",
                      border: `1px solid rgba(124,92,252,0.25)`,
                      color: PINK,
                      fontSize: "0.72rem", fontWeight: 700,
                      padding: "4px 10px", borderRadius: 999,
                      marginBottom: 10,
                    }}>{(p as any).extraInfo}</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.features.map((f, fi) => (
                      <div key={fi} className="plan-feat">
                        <div className="plan-dot" style={isUnlimited ? { background: "#ef4444" } : undefined} />
                        <span style={{ color: TEXT_SEC, fontSize: "0.82rem", lineHeight: 1.45, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {f}
                          {f.toLowerCase().includes("motions/mes") && (p as any).motionInfo && (
                            <span className="motion-info-wrap" tabIndex={0} style={{
                              position: "relative", display: "inline-flex", alignItems: "center",
                              cursor: "help", color: PINK,
                            }}>
                              <Info size={13} strokeWidth={2} />
                              <span className="motion-info-tooltip" style={{
                                position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
                                transform: "translateX(-50%)",
                                background: "#1D1D1F", color: "#fff",
                                fontSize: "0.72rem", lineHeight: 1.4,
                                padding: "8px 10px", borderRadius: 8,
                                whiteSpace: "normal", width: 220, maxWidth: 220,
                                textAlign: "center",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                                opacity: 0, pointerEvents: "none",
                                transition: "opacity 0.18s ease",
                                zIndex: 50,
                              }}>{(p as any).motionInfo}</span>
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className={`lp-btn ${p.popular ? "lp-btn-grad" : "lp-btn-dark"}`}
                  style={{
                    width: "100%", justifyContent: "center", fontSize: "0.88rem", padding: "12px 16px",
                    ...(isUnlimited ? {
                      background: RED_GRAD,
                      boxShadow: "0 8px 24px rgba(239,68,68,0.4)",
                    } : {}),
                  }}
                  onClick={() => navigate("/planes")}
                >{p.name === "IA Unlimited" ? "Quiero crear sin límites" : "Quiero este"}</button>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 11. DEPOIMENTOS MARQUEE                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec" style={{ paddingLeft: 0, paddingRight: 0, overflow: "hidden" }}>
        <div style={{ textAlign: "center", marginBottom: 48, paddingLeft: 24, paddingRight: 24 }}>
          <span data-reveal className="lp-eyebrow">Resultados Reales</span>
          <h2 data-reveal className="lp-h2">Resultados de quienes crean con IA</h2>
        </div>
        {/* Row 1 */}
        <div className="marquee-wrap" style={{ marginBottom: 16 }}>
          <div className="marquee-track marquee-fwd">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
               <div key={i} className="testimonial-card" style={{
                 width: 300, flexShrink: 0, border: `1px solid ${BORDER}`,
                 borderRadius: 16, padding: 20,
                 background: "linear-gradient(135deg, #fff 60%, #f9f7ff 100%)",
               }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: GRAD,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>{t.initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{t.name}</div>
                    <div style={{ color: TEXT_MUT, fontSize: "0.78rem" }}>{t.handle}</div>
                  </div>
                </div>
                <div style={{ color: "#fbbf24", fontSize: "0.85rem", marginBottom: 8, letterSpacing: 2 }}>★★★★★</div>
                <p style={{ color: TEXT_SEC, fontSize: "0.88rem", lineHeight: 1.6 }}>"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
        {/* Row 2 (reversed) */}
        <div className="marquee-wrap">
          <div className="marquee-track marquee-rev">
            {[...TESTIMONIALS.slice().reverse(), ...TESTIMONIALS.slice().reverse()].map((t, i) => (
               <div key={i} className="testimonial-card" style={{
                 width: 300, flexShrink: 0, border: `1px solid ${BORDER}`,
                 borderRadius: 16, padding: 20,
                 background: "linear-gradient(135deg, #fff 60%, #f9f7ff 100%)",
               }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: GRAD,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>{t.initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{t.name}</div>
                    <div style={{ color: TEXT_MUT, fontSize: "0.78rem" }}>{t.handle}</div>
                  </div>
                </div>
                <div style={{ color: "#fbbf24", fontSize: "0.85rem", marginBottom: 8, letterSpacing: 2 }}>★★★★★</div>
                <p style={{ color: TEXT_SEC, fontSize: "0.88rem", lineHeight: 1.6 }}>"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 12. FAQ                                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec-soft" id="faq">
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span data-reveal className="lp-eyebrow">FAQ</span>
            <h2 data-reveal className="lp-h2">Preguntas frecuentes</h2>
          </div>
          <div data-reveal style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map((f, i) => (
              <div key={i} className={`faq-item${openFaq === i ? " open" : ""}`}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-body">
                  <div className="faq-inner">
                    <p className="faq-a">{f.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 13. CTA FINAL — DOIS CENÁRIOS                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span data-reveal className="lp-eyebrow">Tu Elección</span>
            <h2 data-reveal className="lp-h2">Dos opciones. Tú eliges.</h2>
          </div>
          <div data-reveal className="scenario-wrap" style={{ display: "flex", gap: 24, marginBottom: 48, flexWrap: "wrap" }}>
            {/* Bad scenario */}
            <div className="scenario-card scenario-bad">
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#dc2626", marginBottom: 20 }}>
                ❌ Sigue como estás
              </div>
              {[
                "Gasta 2h+ por flyer intentando dejarlo bonito en Canva",
                "Paga R$300+ por diseñador cada vez que lo necesites urgente",
                "Publica flyers sin consistencia visual y pierde engagement",
                "Mira a tus competidores crecer mientras tú te quedas trabado",
              ].map((item, i) => (
                <div key={i} className="scenario-item">
                  <span style={{ color: "#dc2626", flexShrink: 0 }}>✗</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            {/* Good scenario */}
            <div className="scenario-card scenario-good" style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#16a34a", marginBottom: 20 }}>
                ✦ Activa el Flyer Maker AI
              </div>
              {[
                "Crea flyers profesionales en menos de 60 segundos",
                "Ahorra R$300-600/mes en herramientas y diseñadores",
                "Publica todos los días con visual consistente y atractivo",
                "Anima tus flyers con Motion AI para Stories que se vuelven virales",
              ].map((item, i) => (
                <div key={i} className="scenario-item">
                  <span style={{ color: "#16a34a", flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: FONT, fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Crea tu primer flyer <span style={GRAD_TEXT}>ahora mismo</span>
            </h2>
            <p style={{ color: TEXT_SEC, marginBottom: 32, fontSize: "1rem" }}>
              Listo en 60 segundos. Cancela cuando quieras.
            </p>
            <div className="btn-group btn-group-center" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="lp-btn lp-btn-grad" style={{ fontSize: "1.05rem", padding: "16px 36px" }} onClick={goPlanos}>
                Quiero Crear Mi Flyer
                <span className="lp-btn-arrow">→</span>
              </button>
              <button className="lp-btn lp-btn-outline" onClick={() => navigate("/flyer-maker")}>
                Ya tengo cuenta
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 14. FOOTER                                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{ background: DARK, color: "#A1A1A6", padding: "56px 24px 32px" }}>
        <div className="lp-wrap">
          <div className="footer-flex" style={{ display: "flex", gap: 48, flexWrap: "wrap", marginBottom: 48, justifyContent: "space-between" }}>
            <div style={{ flex: "0 0 auto" }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "1.2rem", color: "#fff", marginBottom: 12 }}>
                Arcano<span style={GRAD_TEXT}>App</span>
              </div>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.6, maxWidth: 220, color: "#6E6E73" }}>
                Herramientas de IA para creadores y emprendedores.
              </p>
            </div>
            {[
              { title: "Producto", links: ["Flyer Maker AI", "Generar Imagen", "Generar Video", "Herramientas de IA"] },
              { title: "Empresa", links: ["Planes", "Afiliados", "Contacto"] },
              { title: "Legal", links: ["Política de Privacidad", "Términos de Uso", "Cookies"] },
            ].map((col, i) => (
              <div key={i}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {col.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.links.map((link, li) => (
                    <a key={li} href="#" style={{ fontSize: "0.88rem", color: "#6E6E73", transition: "color 0.15s" }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#fff")}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#6E6E73")}
                    >{link}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #2D2D2D", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: "0.82rem" }}>© 2025 ArcanoApp. Todos los derechos reservados.</p>
            <div style={{ display: "flex", gap: 16 }}>
              {["Instagram", "TikTok"].map((s, i) => (
                <a key={i} href="#" style={{ fontSize: "0.82rem", color: "#6E6E73", transition: "color 0.15s" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#fff")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#6E6E73")}
                >{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
    </>
  );
};

export default FlyerMakerLanding;
