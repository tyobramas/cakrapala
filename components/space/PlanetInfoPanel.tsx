"use client";

/**
 * PlanetInfoPanel — NASA Deep Space Object Inspector & Astrophysical HUD.
 * Ultra-translucent crystal frosted glassmorphic inspector card floating on the right.
 */

import { useState } from "react";
import {
  X,
  Orbit,
  Sparkles,
  Info,
  CircleDot,
  Layers,
  Compass,
  Rocket,
  Flame,
  Droplets,
  Radio,
  ChevronRight,
  Sparkle,
} from "lucide-react";
import { DETAILED_PLANET_DATA } from "@/lib/astronomy/planetDetailedData";
import type { PlanetId } from "@/lib/astronomy/types";

type Props = {
  selectedPlanetId: PlanetId | null;
  onClose: () => void;
};

export default function PlanetInfoPanel({ selectedPlanetId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "moons" | "orbit" | "physics" | "atmosphere" | "missions"
  >("overview");

  const planet = selectedPlanetId ? DETAILED_PLANET_DATA[selectedPlanetId] : null;
  if (!planet) return null;

  return (
    <aside
      className="
        fixed top-20 right-4 bottom-24 z-30 w-80 sm:w-96
        flex flex-col rounded-[26px] bg-[#030712]/30
        border border-slate-700/35 shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)]
        backdrop-blur-2xl overflow-y-auto text-slate-100 font-sans pointer-events-auto
        animate-fade-in
      "
      aria-label="NASA Deep Space Planet Telemetry Inspector"
    >
      {/* ── Top Header with Neon Badge & Close Button ─────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/50 bg-[#030712]/35 backdrop-blur-xl sticky top-0 z-30 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-cyan-300">
            OBJECT INSPECTOR // NASA J2000
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Inspector"
          title="Close Panel"
          className="
            w-7 h-7 rounded-full text-slate-400 hover:text-white
            bg-slate-900/60 border border-slate-700/60 hover:border-cyan-400 transition-all
            flex items-center justify-center
          "
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Panel Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-col p-5 space-y-4">
        
        {/* ── Hero Thumbnail of Planet (NASA Imagery) ─────────────────────── */}
        <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-cyan-500/25 bg-[#030712]/40 backdrop-blur-md flex items-center justify-center group">
          <div
            className="absolute inset-0 opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
            style={{ backgroundColor: planet.color }}
          />

          <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.85)] border border-white/25">
            <img
              src={planet.planetImageSrc}
              alt={planet.name}
              className="w-full h-full object-cover transform scale-105 group-hover:scale-115 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,transparent_40%,rgba(0,0,0,0.75)_100%)] pointer-events-none" />
          </div>

          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/70 border border-cyan-500/30 font-mono text-[9px] text-cyan-300">
            NASA IMAGERY
          </div>
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-700/60 font-mono text-[9px] text-emerald-400">
            TARGET: {planet.id.toUpperCase()}
          </div>
        </div>

        {/* Title & Classification */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[10px] font-mono mb-1.5">
            <Sparkle className="w-3 h-3 text-cyan-400" />
            <span>{planet.badge}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-white/70 shadow-sm">
              <img src={`/textures/planets/${planet.id}.jpg`} alt={planet.name} className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              {planet.name}
            </h2>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tracking-wider mt-1">
            {planet.subtitle} &bull; {planet.classification}
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="grid grid-cols-6 gap-1 p-1 rounded-xl bg-[#030712]/50 border border-slate-800/60 font-mono text-[9px]">
          {(
            [
              { id: "overview", label: "INFO" },
              { id: "moons", label: `MOONS` },
              { id: "orbit", label: "ORBIT" },
              { id: "physics", label: "PHYS" },
              { id: "atmosphere", label: "ATMO" },
              { id: "missions", label: "PROBES" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 rounded-lg font-bold transition-all text-center ${
                activeTab === tab.id
                  ? "bg-[#25324d]/80 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-3 font-sans text-xs">
            <p className="text-slate-300 leading-relaxed bg-[#030712]/40 p-3 rounded-xl border border-slate-800/50">
              {planet.overview}
            </p>

            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
              <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">RADIUS</span>
                <strong className="text-white block">{planet.physicalStats.meanRadiusKm}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">GRAVITY</span>
                <strong className="text-cyan-300 block">{planet.physicalStats.surfaceGravity}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">DISTANCE (SUN)</span>
                <strong className="text-amber-300 block">{planet.orbitalStats.semiMajorAxisAU}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">AVG TEMP</span>
                <strong className="text-emerald-400 block">{planet.physicalStats.avgTempC}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MOONS ─────────────────────────────────────────────────── */}
        {activeTab === "moons" && (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="flex items-center justify-between px-2 py-1 text-slate-400">
              <span>TOTAL SATELLITES:</span>
              <strong className="text-cyan-300">{planet.moons.count} MOONS</strong>
            </div>

            {planet.moons.moonsList.length > 0 ? (
              planet.moons.moonsList.map((moon) => (
                <div
                  key={moon.name}
                  className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex items-center justify-between"
                >
                  <div>
                    <strong className="text-white block">{moon.name}</strong>
                    <span className="text-[9px] text-slate-400">Diameter: {moon.diameterKm}</span>
                  </div>
                  <span className="text-[9px] text-slate-400">{moon.orbitalPeriodDays}</span>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-[#030712]/45 border border-slate-800/50 text-center text-slate-500 italic">
                No natural satellites in orbit
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ORBIT ─────────────────────────────────────────────────── */}
        {activeTab === "orbit" && (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Semi-Major Axis:</span>
              <strong className="text-white">{planet.orbitalStats.semiMajorAxisAU} ({planet.orbitalStats.semiMajorAxisKm})</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Orbital Period:</span>
              <strong className="text-cyan-300">{planet.orbitalStats.orbitalPeriod}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Orbital Velocity:</span>
              <strong className="text-amber-300">{planet.orbitalStats.orbitalSpeedKmS}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Orbital Inclination:</span>
              <strong className="text-emerald-400">{planet.orbitalStats.inclinationDeg}</strong>
            </div>
          </div>
        )}

        {/* ── TAB 4: PHYSICS ───────────────────────────────────────────────── */}
        {activeTab === "physics" && (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Mass:</span>
              <strong className="text-white">{planet.physicalStats.massKg}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Surface Gravity:</span>
              <strong className="text-cyan-300">{planet.physicalStats.surfaceGravity}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Escape Velocity:</span>
              <strong className="text-amber-300">{planet.physicalStats.escapeVelocity}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Axial Tilt:</span>
              <strong className="text-emerald-400">{planet.physicalStats.axialTilt}</strong>
            </div>
          </div>
        )}

        {/* ── TAB 5: ATMOSPHERE ────────────────────────────────────────────── */}
        {activeTab === "atmosphere" && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 flex justify-between">
              <span className="text-slate-400">Surface Pressure:</span>
              <strong className="text-cyan-300">{planet.atmosphere.pressureBar}</strong>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-[#030712]/45 border border-slate-800/50">
              <span className="text-slate-400 block text-[9px] mb-1.5 uppercase">CHEMICAL COMPOSITION</span>
              {planet.atmosphere.components.map((comp) => (
                <div key={comp.name} className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300">{comp.name}</span>
                  <strong className="text-cyan-400">{comp.percent}</strong>
                </div>
              ))}
            </div>

            <p className="text-slate-400 text-[9px] italic leading-relaxed px-1">
              {planet.atmosphere.notes}
            </p>
          </div>
        )}

        {/* ── TAB 6: MISSIONS ──────────────────────────────────────────────── */}
        {activeTab === "missions" && (
          <div className="space-y-2 font-mono text-[10px]">
            {planet.missions.map((m) => (
              <div
                key={m.name}
                className="p-2.5 rounded-xl bg-[#030712]/45 border border-slate-800/50 space-y-1"
              >
                <div className="flex justify-between items-center">
                  <strong className="text-cyan-300 font-sans">{m.name}</strong>
                  <span className="text-[9px] text-slate-400">{m.agency} &bull; {m.year}</span>
                </div>
                <p className="text-[9px] text-slate-300 font-sans leading-tight">
                  {m.achievement}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
