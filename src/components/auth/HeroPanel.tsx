import heroImage from "@/assets/hero-login.jpg";

const HeroPanel = () => {
  return (
    <div className="hidden lg:block lg:w-2/3 relative overflow-hidden">
      {/* Hero Image */}
      <img
        src={heroImage}
        alt="Premium experience"
        className="absolute inset-0 w-full h-full object-cover"
        width={1280}
        height={1920}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(270,60%,8%)]/80 via-[hsl(270,60%,8%)]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(270,60%,8%)]/60 via-transparent to-[hsl(270,60%,8%)]/30" />

      {/* Floating orbs */}
      <div className="absolute top-[15%] right-[20%] w-32 h-32 rounded-full bg-purple-500/20 blur-xl animate-float-slow" />
      <div className="absolute top-[45%] right-[35%] w-24 h-24 rounded-full bg-fuchsia-500/15 blur-lg animate-float-medium" />
      <div className="absolute bottom-[20%] right-[15%] w-40 h-40 rounded-full bg-amber-500/10 blur-xl animate-float-fast" />
      <div className="absolute top-[30%] left-[10%] w-16 h-16 rounded-full bg-purple-400/20 blur-md animate-float-medium" />

      {/* Geometric shapes */}
      <div className="absolute top-[25%] right-[10%] w-20 h-20 border border-purple-400/20 rotate-45 animate-pulse-slow" />
      <div className="absolute bottom-[35%] right-[25%] w-12 h-12 border border-amber-400/15 rotate-12 animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Tagline with frosted glass */}
      <div className="absolute bottom-[12%] left-[8%] right-[8%] animate-fade-in-delayed">
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
            Tu creatividad,<br />
            <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
              sin límites.
            </span>
          </h2>
          <p className="text-white/60 text-lg">
            Accede a herramientas premium que transforman tus ideas en realidad.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroPanel;
