"use client";

/**
 * HeroOrbital — Editorial Full-Viewport LEO Cupola Hero.
 *
 * Luxury aerospace minimalism:
 *   - Seamless feathered optical glass veil strictly behind the hero typography
 *     (zero harsh rectangular edges, full Milky Way transparency preserved)
 *   - Single focused primary CTA (AI Co-Pilot lives exclusively in the top navbar)
 *   - Ultra-sheer bottom orbital horizon caption
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";

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

      {/* Ultra-subtle photographic edge vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 125% 95% at 50% 48%, transparent 56%, rgba(1,3,10,0.36) 86%, rgba(1,3,10,0.72) 100%)",
        }}
      />

      {/* ── Editorial Centerpiece Typography & Single Luxury CTA ────── */}
      <div className="pointer-events-none absolute inset-x-0 top-[15.5vh] z-20 flex flex-col items-center px-6 text-center sm:top-[17vh] lg:top-[18vh]">
        <div className="relative flex w-full max-w-4xl flex-col items-center">
          {/* Seamless feathered liquid-glass veil: softens bright Milky Way stars strictly behind text with zero boxy border */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 backdrop-blur-[5px]"
            style={{
              background:
                "radial-gradient(ellipse 56% 58% at 50% 48%, rgba(2,5,14,0.52) 0%, rgba(2,5,14,0.24) 48%, rgba(2,5,14,0) 78%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 58% 60% at 50% 48%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.55) 50%, transparent 78%)",
              maskImage:
                "radial-gradient(ellipse 58% 60% at 50% 48%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.55) 50%, transparent 78%)",
            }}
          />

          {/* Sheer Micro Glass Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-[#020614]/28 px-4 py-1 backdrop-blur-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <span className="h-1 w-1 rounded-full bg-sky-300/90 shadow-[0_0_6px_rgba(125,211,252,0.9)]" />
            <p className="font-mono text-[10px] font-medium tracking-[0.32em] text-sky-100/90 uppercase">
              Deep Space Observatory
            </p>
          </div>

          {/* Primary Display Headline — crisp legibility, never overflows */}
          <h1 className="mt-5 font-[family-name:var(--font-orbitron)] text-2xl font-medium tracking-[0.2em] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.95),0_4px_42px_rgba(1,4,14,0.92)] sm:text-4xl lg:text-[42px] lg:leading-[1.18]">
            THE UNIVERSE IN REAL TIME
          </h1>

          {/* Clean Concise Subtitle */}
          <p className="mt-3.5 max-w-xl text-xs font-normal leading-relaxed tracking-[0.04em] text-slate-100/90 [text-shadow:0_1px_14px_rgba(0,0,0,0.98),0_2px_28px_rgba(1,4,14,0.95)] sm:text-[14px]">
            Orbital mechanics, planetary defense, and live astrometry — computed
            from first principles.
          </p>

          {/* Singular Luxury Translucent Primary CTA */}
          <div className="pointer-events-auto mt-7 sm:mt-8">
            <Link
              href="/solar-system"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-white/25 bg-white/[0.10] px-7 py-3 text-[11px] font-medium tracking-[0.18em] text-white uppercase backdrop-blur-xl shadow-[0_10px_36px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.28)] transition-all duration-300 hover:border-white/45 hover:bg-white/[0.17] hover:shadow-[0_12px_42px_rgba(148,197,255,0.22),inset_0_1px_0_rgba(255,255,255,0.42)] active:scale-[0.98]"
            >
              <span className="[text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
                Explore Observatory
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-200 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Whisper-Quiet Sheer Horizon Caption ─────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-6 sm:bottom-7">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full border border-white/[0.08] bg-[#020510]/24 px-5 py-1.5 font-mono text-[10px] tracking-[0.2em] text-white/75 uppercase backdrop-blur-sm [text-shadow:0_1px_8px_rgba(0,0,0,0.95)]">
          <span className="inline-flex items-center gap-2 text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            LEO Horizon
          </span>
          <span className="text-white/20">·</span>
          <span>
            Alt{" "}
            <strong className="font-medium text-white/95">
              {tm?.altitude ?? iss.avgAltitudeKm} km
            </strong>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Vel{" "}
            <strong className="font-medium text-white/95">
              {(tm?.velocity ?? 27580).toLocaleString()} km/h
            </strong>
          </span>
          {tm && (
            <>
              <span className="hidden text-white/20 md:inline">·</span>
              <span className="hidden md:inline">
                {tm.latitude >= 0
                  ? `${tm.latitude}° N`
                  : `${Math.abs(tm.latitude)}° S`}
                ,{" "}
                {tm.longitude >= 0
                  ? `${tm.longitude}° E`
                  : `${Math.abs(tm.longitude)}° W`}
              </span>
            </>
          )}
          <span className="hidden text-white/20 sm:inline">·</span>
          <span className="hidden text-white/80 sm:inline">
            {timeUtc || "00:00:00 UTC"}
          </span>
        </div>
      </div>
    </section>
  );
}
