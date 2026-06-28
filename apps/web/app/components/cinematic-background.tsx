import React from "react";

export function CinematicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Soft Mint Radial Glow (Bottom-Left / Center-Left) */}
      <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-[#65F2B0]/12 blur-[140px] dark:opacity-100 opacity-30" />

      {/* Soft Pink Radial Glow (Top-Right / Center-Right) */}
      <div className="absolute -right-32 top-1/3 h-[500px] w-[500px] rounded-full bg-[#FF7AAE]/12 blur-[140px] dark:opacity-100 opacity-30" />

      {/* Secondary Mint Glow for Lower Sections Depth */}
      <div className="absolute left-1/3 top-[60%] h-[600px] w-[600px] rounded-full bg-[#65F2B0]/08 blur-[160px] dark:opacity-100 opacity-20" />

      {/* Faint Grid and Proof-Path Contour SVG Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:opacity-100 opacity-40" />

      {/* Topographic proof-path curves */}
      <svg
        className="absolute left-0 top-0 h-full w-full opacity-15 dark:opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <path
          d="M-100 200 C300 100, 600 400, 1500 200"
          stroke="url(#mint-pink-grad-1)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <path
          d="M-100 500 C400 300, 800 700, 1600 400"
          stroke="url(#mint-pink-grad-2)"
          strokeWidth="1.5"
        />
        <defs>
          <linearGradient id="mint-pink-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#65F2B0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FF7AAE" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="mint-pink-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF7AAE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#65F2B0" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
