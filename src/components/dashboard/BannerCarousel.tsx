import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  description: string | null;
  button_text: string | null;
  button_link: string;
  image_url: string;
  mobile_image_url: string | null;
  display_order: number | null;
}

const BannerCarousel = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      const { data } = await supabase
        .from("artes_banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (data && data.length > 0) setBanners(data);
      setLoading(false);
    };
    fetchBanners();
  }, []);

  // Auto-advance
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const goNext = useCallback(() => setCurrent((p) => (p + 1) % banners.length), [banners.length]);
  const goPrev = useCallback(() => setCurrent((p) => (p - 1 + banners.length) % banners.length), [banners.length]);

  if (loading) {
    return (
      <div className="w-full aspect-[21/9] md:aspect-[3/1] rounded-2xl bg-card border border-border animate-pulse" />
    );
  }

  if (banners.length === 0) {
    return (
      <div className="w-full aspect-[21/9] md:aspect-[3/1] rounded-2xl bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 border border-purple-500/20 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Sin banners activos — configúralos en el panel admin</p>
      </div>
    );
  }

  const banner = banners[current];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const imgUrl = isMobile && banner.mobile_image_url ? banner.mobile_image_url : banner.image_url;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden group">
      {/* Banner image */}
      <a
        href={banner.button_link}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-[21/9] md:aspect-[3/1] overflow-hidden"
      >
        <img
          src={imgUrl}
          alt={banner.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <h3 className="text-white font-bold text-lg md:text-2xl mb-1 drop-shadow-lg">{banner.title}</h3>
          {banner.description && (
            <p className="text-white/80 text-sm md:text-base mb-3 drop-shadow max-w-lg">{banner.description}</p>
          )}
          {banner.button_text && (
            <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm font-medium px-4 py-2 rounded-full border border-white/20 hover:bg-white/30 transition-colors">
              {banner.button_text}
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </a>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setCurrent(i); }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === current ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;
