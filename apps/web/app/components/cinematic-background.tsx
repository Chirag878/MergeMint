import React, { useEffect, useState } from "react";

export function CinematicBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#1B1C2F]" aria-hidden="true">
      {/* Structural Dotted Grid */}
      <div
        className="absolute inset-0 bg-[radial-gradient(rgba(107,98,120,0.15)_1px,transparent_1px)] [background-size:24px_24px]"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
      />

      {/* Parallax Secondary Grid Layer */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(107,98,120,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(107,98,120,0.03)_1px,transparent_1px)] bg-[size:96px_96px]"
        style={{
          transform: `translateY(${scrollY * 0.2}px)`,
        }}
      />

      {/* Aurora Ambient Blurred Blobs */}
      <div className="absolute top-[10%] left-[15%] h-[400px] w-[400px] rounded-full bg-[#C0C4FF]/5 blur-[120px] animate-pulse" style={{ animationDuration: "12s" }} />
      <div className="absolute top-[40%] right-[10%] h-[500px] w-[500px] rounded-full bg-[#69FFB7]/3 blur-[140px] animate-pulse" style={{ animationDuration: "18s" }} />
      <div className="absolute top-[75%] left-[20%] h-[450px] w-[450px] rounded-full bg-[#C0C4FF]/4 blur-[130px]" />

      {/* Floating Particles (Small, low opacity dots with keyframe animations) */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[15%] left-[20%] w-1.5 h-1.5 rounded-full bg-[#69FFB7] animate-ping" style={{ animationDuration: "4s" }} />
        <div className="absolute top-[35%] left-[80%] w-1 h-1 rounded-full bg-[#C0C4FF] animate-ping" style={{ animationDuration: "6s" }} />
        <div className="absolute top-[65%] left-[40%] w-1.5 h-1.5 rounded-full bg-[#C0C4FF] animate-ping" style={{ animationDuration: "5s" }} />
        <div className="absolute top-[85%] left-[70%] w-1 h-1 rounded-full bg-[#69FFB7] animate-ping" style={{ animationDuration: "8s" }} />
      </div>

      {/* Subtle background SVG contours */}
      <svg className="absolute left-0 top-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M-100 300 C300 150, 600 450, 1500 250" stroke="#C0C4FF" strokeWidth="1.5" />
        <path d="M-100 650 C400 400, 800 850, 1600 500" stroke="#69FFB7" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
