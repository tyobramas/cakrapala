"use client";

/**
 * HeroOrbital — Editorial Full-Viewport LEO Cupola Hero.
 *
 * Balanced, uncluttered luxury aerospace presentation that puts the
 * photorealistic 8K 3D Earth and HD Milky Way front and center.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Sparkles } from "lucide-react";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

const CommandCenterGlobe = dynamic(() => import("./CommandCenterGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#01030a]">
      <span className="font-mono text-[10px] tracking-[0.35em] text-slate-400/60 uppercase">
        Calibrating Orbital Viewport
      </span>
    </div>
  ),
});

interface Telemetry {
  altitude: number;
  velocity: number;
  latitude: number;
  longitude: number;
}

export default function HeroOrbital() {
  const iss =
    SATELLITE_CATALOG.find((s) => s.id === "iss") ?? SATELLITE_CATALOG[0];
  const [tm, setTm] = useState<Telemetry | null>(null);
  const [timeUtc, setTimeUtc] = useState<string>("");
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);

  useEffect(() => {
    const tick = () =>
      setTimeUtc(new Date().toUTCString().slice(17, 25) + " UTC");
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
          });
        }
      } catch {
        /* keep last known orbital state */
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
    <section className="relative h-screen w-full overflow-hidden bg-[#01030a]">
      {/* 3D Photorealistic Earth & HD Milky Way — Full Viewport */}
      <div className="absolute inset-0">
        <CommandCenterGlobe variant="fullscreen" />
      </div>

      {/* Ultra-subtle photographic edge vignette (keeps Milky Way & limb vibrant) */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 125% 95% at 50% 48%, transparent 56%, rgba(1,3,10,0.38) 86%, rgba(1,3,10,0.72) 100%)",
        }}
      />

      {/* ── Editorial Centerpiece Typography & Balanced Actions ─────── */}
      <div className="pointer-events-none absolute inset-x-0 top-[14.5vh] z-20 flex flex-col items-center px-5 text-center sm:top-[16vh] lg:top-[17vh]">
        {/* Compact translucent glassmorphism strictly behind the copy for crisp legibility without hiding the Milky Way */}
        <div className="inline-flex max-w-2xl flex-col items-center rounded-2xl border border-white/[0.10] bg-[#020510]/42 px-6 py-4 backdrop-blur-[8px] shadow-[0_16px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] sm:rounded-3xl sm:px-9 sm:py-5">
          {/* Refined Eyebrow */}
          <p className="font-mono text-[10px] font-medium tracking-[0.34em] text-sky-200/95 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
            Deep Space Observatory
          </p>

          {/* Primary Display Headline */}
          <h1 className="mt-2.5 font-[family-name:var(--font-orbitron)] text-xl font-normal tracking-[0.18em] text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.85)] sm:text-3xl lg:whitespace-nowrap lg:text-[34px] lg:leading-[1.2]">
            THE UNIVERSE IN REAL TIME
          </h1>

          {/* Clean Minimal Subtitle */}
          <p className="mt-2.5 max-w-xl text-xs font-normal leading-relaxed tracking-[0.03em] text-slate-100/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.9)] sm:text-[13.5px]">
            Orbital mechanics, planetary defense, and live astrometry — computed
            from first principles.
          </p>
        </div>

        {/* Balanced Dual Action Pills */}
        <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-7 sm:gap-4">
          <Link
            href="/solar-system"
            className="group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-2.5 text-[11px] font-semibold tracking-[0.14em] text-slate-950 uppercase shadow-[0_8px_30px_rgba(255,255,255,0.18)] transition-all duration-300 hover:bg-sky-50 hover:shadow-[0_10px_36px_rgba(186,230,253,0.3)] active:scale-[0.98]"
          >
            <span>Explore Observatory</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>

          <button
            type="button"
            onClick={() => setIsAiOpen(true)}
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-[#050a18]/60 px-6 py-2.5 text-[11px] font-medium tracking-[0.14em] text-white/95 uppercase backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/[0.14] hover:text-white active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-300 transition-transform duration-300 group-hover:scale-110" />
            <span>Ask AI Co-Pilot</span>
          </button>
        </div>
      </div>

      {/* ── Whisper-Quiet Horizon Caption (Balanced & Non-Intrusive) ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-6 sm:bottom-7">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full border border-white/[0.08] bg-[#020510]/38 px-5 py-1.5 font-mono text-[10px] tracking-[0.2em] text-white/75 uppercase backdrop-blur-md [text-shadow:0_1px_8px_rgba(0,0,0,0.95)]">
          <span className="inline-flex items-center gap-2 text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            LEO Horizon
          </span>
          <span className="text-white/20">·</span>
          <span>
            Alt <strong className="font-medium text-white/85">{tm?.altitude ?? iss.avgAltitudeKm} km</strong>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Vel{" "}
            <strong className="font-medium text-white/85">
              {(tm?.velocity ?? 27580).toLocaleString()} km/h
            </strong>
          </span>
          {tm && (
            <>
              <span className="hidden text-white/20 md:inline">·</span>
              <span className="hidden md:inline">
                {tm.latitude >= 0 ? `${tm.latitude}° N` : `${Math.abs(tm.latitude)}° S`},{" "}
                {tm.longitude >= 0 ? `${tm.longitude}° E` : `${Math.abs(tm.longitude)}° W`}
              </span>
            </>
          )}
          <span className="hidden text-white/20 sm:inline">·</span>
          <span className="hidden text-white/70 sm:inline">
            {timeUtc || "00:00:00 UTC"}
          </span>
        </div>
      </div>

      {/* Astronomy AI Terminal Modal */}
      <AstronomyTerminal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </section>
  );
}
