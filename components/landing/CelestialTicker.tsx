"use client";

/**
 * CelestialTicker — Live Aerospace Ticker & Verified Astrophysical Standards Strip.
 */

import { Sparkles, Radio, Orbit, Globe, Cpu, ShieldCheck } from "lucide-react";

export default function CelestialTicker() {
  const TICKER_ITEMS = [
    { icon: Radio, text: "LIVE NORAD SGP4 PROPAGATION: 6 Active Fleet Satellites Tracked at 27,580 km/h (LEO ~418 km)" },
    { icon: Orbit, text: "J2000.0 KEPLERIAN EPHEMERIS: Heliocentric Planetary Coordinates with Sub-arcsecond Precision" },
    { icon: Sparkles, text: "YALE BSC5 STAR MATRIX: 2,887 Naked-Eye Stars & 89 International Astronomical Union (IAU) Constellations" },
    { icon: Globe, text: "WGS-84 TOPOCENTRIC HORIZON: Real-time Azimuth, Altitude & Solar/Lunar Direction Vectors" },
    { icon: Cpu, text: "IBM GRANITE ASTROPHYSICS CO-PILOT: Multilingual Deep Space NLP & Natural Voice Assistant" },
  ];

  return (
    <div className="w-full max-w-[1580px] mx-auto px-3 sm:px-6 lg:px-8 my-4">
      {/* ── Marquee Ticker Strip ───────────────────────────────────────────── */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#0a0f1d]/90 via-[#131b2e]/90 to-[#0a0f1d]/90 border border-slate-700/60 p-2.5 shadow-lg backdrop-blur-xl overflow-hidden flex items-center gap-4">
        
        {/* Left Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>ASTRO EVENT FEED</span>
        </div>

        {/* Scrolling Ticker Text */}
        <div className="overflow-hidden whitespace-nowrap w-full mask-fade-edges">
          <div className="inline-flex gap-8 animate-marquee text-xs font-mono text-slate-300">
            {TICKER_ITEMS.concat(TICKER_ITEMS).map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="inline-flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{item.text}</span>
                  <span className="text-slate-600 font-bold ml-4">&bull;</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
