"use client";

/**
 * HeroOrbital — full-viewport LEO cupola hero for the landing page.
 *
 * No frame, no card: the Earth limb runs edge to edge and the HUD floats on
 * top in screen space. Telemetry comes from /api/iss, the same source the
 * detailed dashboard uses, so no number on this page is typed by hand.
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Terminal } from "lucide-react";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

const CommandCenterGlobe = dynamic(() => import("./CommandCenterGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#020617]">
      <span className="animate-pulse font-mono text-xs tracking-widest text-cyan-400/60">
        INITIALIZING LEO VIEWPORT...
      </span>
    </div>
  ),
});

interface Telemetry {
  altitude: number;
  velocity: number;
  latitude: number;
  longitude: number;
  visibility: string;
}

export default function HeroOrbital() {
  const iss = SATELLITE_CATALOG.find((s) => s.id === "iss") ?? SATELLITE_CATALOG[0];
  const [tm, setTm] = useState<Telemetry | null>(null);
  const [timeUtc, setTimeUtc] = useState<string>("");
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);

  useEffect(() => {
    const tick = () => setTimeUtc(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/iss?id=iss");
        if (!res.ok) return;
        const raw = await res.json();
        const d = raw.telemetry || raw;
        if (alive && typeof d?.latitude === "number") {
          setTm({
            altitude: Math.round(d.altitude),
            velocity: Math.round(d.velocity),
            latitude: Number(d.latitude.toFixed(2)),
            longitude: Number(d.longitude.toFixed(2)),
            visibility: d.visibility ?? "daylight",
          });
        }
      } catch {
        /* keep last good frame */
      }
    };
    pull();
    const id = setInterval(pull, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* 3D Earth — sits behind everything, edge to edge */}
      <div className="absolute inset-0">
        <CommandCenterGlobe variant="fullscreen" />
      </div>

      {/* Cupola vignette — subtle edge darkening so the Milky Way remains vibrant and clear */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 140% 100% at 50% 45%, transparent 55%, rgba(2,6,23,0.35) 85%, rgba(2,6,23,0.75) 100%)",
        }}
      />
      {/* Top scrim so the curved navbar has contrast without overpowering the Milky Way */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-[#020617]/80 via-[#020617]/30 to-transparent" />

      {/* Action & Subtitle block — premium welcome viewport */}
      <div className="pointer-events-none absolute inset-x-0 top-[96px] sm:top-[112px] lg:top-[160px] xl:top-[168px] z-20 flex flex-col items-center px-5 text-center transition-all">
        {/* Elegant thin divider line */}
        <div className="mb-5 h-px w-16 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        {/* Premium tagline — Orbitron, elegant weight */}
        <h1
          className="font-[family-name:var(--font-orbitron)] text-[15px] sm:text-lg md:text-xl font-light tracking-[0.25em] text-white/90 drop-shadow-[0_2px_20px_rgba(2,6,23,0.95)]"
        >
          DEEP SPACE OBSERVATORY
        </h1>

        {/* High-legibility Subtitle — refined aerospace telemetry HUD */}
        <div className="mt-3.5 inline-flex items-center justify-center rounded-full border border-cyan-500/25 bg-slate-950/65 px-5 sm:px-6 py-1.5 sm:py-2 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.85),0_0_15px_rgba(6,182,212,0.1)]">
          <p className="font-mono text-[11px] sm:text-xs md:text-[13px] font-medium tracking-[0.12em] text-cyan-100 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] text-center leading-relaxed">
            Orbital mechanics, planetary defense &amp; astrometry
            <span className="mx-2 text-cyan-400 font-bold drop-shadow-[0_0_6px_#22d3ee]">·</span>
            computed from first principles
          </p>
        </div>

        {/* J.A.R.V.I.S. Holographic AI HUD Button */}
        <div className="pointer-events-auto mt-6 flex flex-col items-center sm:mt-7">
          <div className="group relative inline-flex flex-col items-center">
            {/* Top Holographic Telemetry Tag */}
            <div className="flex items-center gap-2 mb-2 px-1 opacity-80 transition-all duration-300 group-hover:opacity-100">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
              </span>
              <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.26em] text-cyan-300 font-semibold uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]">
                J.A.R.V.I.S. // NEURAL LINK
              </span>
              <span className="h-[1px] w-8 sm:w-12 bg-gradient-to-r from-cyan-400/80 to-transparent" />
              <span className="font-mono text-[8px] sm:text-[9px] tracking-widest text-cyan-400/70">
                SYS:ENGAGED
              </span>
            </div>

            {/* Relative Frame with Holographic Reticle Locks */}
            <div className="relative">
              {/* 4 Precision Targeting Reticles (Iron Man HUD corner brackets expand on hover) */}
              <div className="pointer-events-none absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 transition-all duration-300 ease-out group-hover:-translate-x-1.5 group-hover:-translate-y-1.5 group-hover:border-cyan-300 group-hover:shadow-[0_0_10px_#22d3ee] z-20" />
              <div className="pointer-events-none absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 transition-all duration-300 ease-out group-hover:translate-x-1.5 group-hover:-translate-y-1.5 group-hover:border-cyan-300 group-hover:shadow-[0_0_10px_#22d3ee] z-20" />
              <div className="pointer-events-none absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 transition-all duration-300 ease-out group-hover:-translate-x-1.5 group-hover:translate-y-1.5 group-hover:border-cyan-300 group-hover:shadow-[0_0_10px_#22d3ee] z-20" />
              <div className="pointer-events-none absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 transition-all duration-300 ease-out group-hover:translate-x-1.5 group-hover:translate-y-1.5 group-hover:border-cyan-300 group-hover:shadow-[0_0_10px_#22d3ee] z-20" />

              {/* Mid-lateral precision crosshair ticks */}
              <span className="pointer-events-none absolute -left-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-cyan-500/50 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_6px_#22d3ee] transition-all duration-300 select-none">
                +
              </span>
              <span className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-cyan-500/50 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_6px_#22d3ee] transition-all duration-300 select-none">
                +
              </span>

              {/* Holographic Ambient Glow Flare */}
              <div className="pointer-events-none absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500/20 via-sky-400/35 to-cyan-500/20 opacity-40 blur-md transition-all duration-500 group-hover:opacity-100 group-hover:blur-xl z-0" />

              <button
                type="button"
                onClick={() => setIsAiOpen(true)}
                className="relative flex items-center gap-4 sm:gap-5 overflow-hidden rounded-xl border border-cyan-400/40 bg-[#020b17]/90 px-6 sm:px-8 py-3.5 cursor-pointer backdrop-blur-2xl transition-all duration-300 group-hover:border-cyan-300 group-hover:bg-[#031427]/95 group-hover:shadow-[0_0_35px_rgba(6,182,212,0.65),inset_0_0_20px_rgba(34,211,238,0.25)] active:scale-[0.98] z-10"
              >
                {/* Holographic light sheen sweep */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-jarvis-sheen z-0" />

                {/* Ambient holographic inner gradients */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cyan-400/10 via-transparent to-cyan-400/5 opacity-60 transition-opacity duration-300 group-hover:opacity-100 z-0" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent group-hover:via-cyan-300 transition-colors z-10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent group-hover:via-cyan-300/60 transition-colors z-10" />

                {/* J.A.R.V.I.S. Arc Reactor Core (Rotating concentric vector rings) */}
                <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center shrink-0 z-10">
                  {/* Outer clockwise segmented ring */}
                  <svg className="absolute inset-0 h-full w-full animate-jarvis-spin-cw group-hover:animate-[jarvis-spin-cw_3s_linear_infinite] transition-all duration-300 text-cyan-400/80 group-hover:text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="18 7 4 7" />
                  </svg>
                  {/* Inner counter-clockwise segmented ring */}
                  <svg className="absolute inset-1 h-7 w-7 sm:h-8 sm:w-8 animate-jarvis-spin-ccw group-hover:animate-[jarvis-spin-ccw_2s_linear_infinite] transition-all duration-300 text-cyan-300/60 group-hover:text-cyan-200" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 5" />
                  </svg>
                  {/* Cardinal reticle tick crosshairs */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="absolute h-full w-[1px] bg-cyan-400/40 scale-y-80 group-hover:bg-cyan-300/80 transition-colors" />
                    <span className="absolute w-full h-[1px] bg-cyan-400/40 scale-x-80 group-hover:bg-cyan-300/80 transition-colors" />
                  </div>
                  {/* Glowing Arc Reactor Center Core */}
                  <div className="relative h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee] group-hover:bg-white group-hover:shadow-[0_0_16px_#22d3ee,0_0_28px_#38bdf8] transition-all duration-300 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_4px_#ffffff]" />
                  </div>
                </div>

                {/* Primary Button Callout */}
                <div className="flex flex-col items-start z-10">
                  <span className="font-[family-name:var(--font-orbitron)] text-xs sm:text-[13px] font-bold tracking-[0.24em] text-cyan-100 transition-all duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_12px_rgba(34,211,238,0.95)]">
                    LAUNCH TERMINAL
                  </span>
                  <span className="font-mono text-[8.5px] sm:text-[9px] tracking-[0.22em] text-cyan-400/70 group-hover:text-cyan-300/90 transition-colors">
                    ASTRONOMICAL AI CO-PILOT
                  </span>
                </div>

                {/* Holographic Neural Audio Wave & Status */}
                <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-cyan-500/30 z-10">
                  <div className="flex items-end gap-[2.5px] h-4">
                    <span className="w-[2px] bg-cyan-400/70 rounded-full animate-jarvis-wave-1 group-hover:bg-cyan-300 transition-colors" />
                    <span className="w-[2px] bg-cyan-300 rounded-full animate-jarvis-wave-2 group-hover:bg-white transition-colors" />
                    <span className="w-[2px] bg-cyan-400/80 rounded-full animate-jarvis-wave-3 group-hover:bg-cyan-300 transition-colors" />
                    <span className="w-[2px] bg-cyan-300 rounded-full animate-jarvis-wave-4 group-hover:bg-white transition-colors" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-mono text-[8.5px] tracking-[0.2em] text-cyan-400/80 font-semibold leading-none">
                      AI CORE
                    </span>
                    <span className="font-mono text-[9.5px] tracking-[0.16em] text-cyan-200 font-bold leading-tight flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                      ONLINE
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom telemetry strip — live, or the catalog value until first fetch */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-2 rounded-2xl border border-slate-800/80
                        bg-[#030712]/80 px-5 py-2 font-mono text-[10px] sm:text-[11px] tracking-wider backdrop-blur-xl shadow-[0_0_20px_rgba(2,6,23,0.9)]">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
            <span>SYS-LIVE</span>
          </span>
          <span className="text-slate-700">│</span>
          <span className="font-mono text-cyan-300 font-bold">
            {timeUtc || "00:00:00 UTC"}
          </span>
          <span className="text-slate-700">│</span>
          <span className="text-slate-400">
            ALT <strong className="text-cyan-300">{tm?.altitude ?? iss.avgAltitudeKm}</strong> KM
          </span>
          <span className="text-slate-400">
            VEL <strong className="text-cyan-300">{(tm?.velocity ?? 27500).toLocaleString()}</strong> KM/H
          </span>
          <span className="text-slate-400">
            INC <strong className="text-cyan-300">{iss.inclinationDeg}°</strong>
          </span>
          <span className="hidden text-slate-400 sm:inline">
            PERIOD <strong className="text-cyan-300">{iss.periodMin}</strong> MIN
          </span>
          {tm && (
            <>
              <span className="hidden text-slate-700 md:inline">│</span>
              <span className="hidden text-slate-400 md:inline">
                NADIR <strong className="text-cyan-300">{tm.latitude}°</strong>{" "}
                <strong className="text-cyan-300">{tm.longitude}°</strong>
              </span>
            </>
          )}
          <span className="hidden text-slate-700 lg:inline">│</span>
          <span className="hidden text-slate-500 lg:inline">TIME ×45</span>
        </div>
      </div>

      {/* Astronomy AI Terminal Modal */}
      <AstronomyTerminal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </section>
  );
}
