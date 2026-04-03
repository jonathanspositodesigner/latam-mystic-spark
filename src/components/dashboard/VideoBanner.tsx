import { useRef, useEffect } from "react";

const VIDEO_SRC = "/videos/APP_ARCANO_PROPAGANDA.mp4";

const VideoBanner = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Force play on mount — needed for some mobile browsers
    const tryPlay = () => {
      video.play().catch(() => {
        // Silently ignore — autoplay may be blocked without user gesture
      });
    };

    tryPlay();

    // Also try on visibility change (tab switch back)
    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-purple-500/20">
      <div className="relative aspect-[21/9] md:aspect-[3/2] overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          webkit-playsinline="true"
          x5-playsinline="true"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default VideoBanner;