"use client";

/**
 * SatelliteMissionConsole — Client layout wrapper for /iss page.
 *
 * Provides real-time orbital tracking for multi-satellite fleet (ISS, Tiangong CSS, Hubble, NOAA, Terra, Starlink).
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Satellite as SatIcon } from "lucide-react";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";
import { CURRENT_ISS_CREW } from "@/lib/iss/issService";

// Dynamic import — NO SSR, with full loading screen
const RealtimeISSTracker = dynamic(
  () => import("@/components/landing/RealtimeISSTracker"),
  {
    ssr: false,
    loading: () => <SatelliteLoading />,
  }
);

function SatelliteLoading() {
  return (
    <div className="w-full h-[500px] sm:h-[600px] lg:h-[680px] flex flex-col items-center justify-center bg-[#020617] rounded-2xl border border-cyan-500/20">
      <div className="relative w-28 h-28 flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/25 animate-[spin_14s_linear_infinite]" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-cyan-400 border-b-amber-400 animate-[spin_3s_linear_infinite_reverse]" />
        <div className="absolute inset-5 rounded-full border border-cyan-300/30 animate-ping opacity-25" />
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-cyan-500/40 shadow-[0_0_24px_rgba(6,182,212,0.5)] flex items-center justify-center">
          <SatIcon className="w-4 h-4 text-cyan-300" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 mb-4">
        <span className="text-[11px] font-mono tracking-[0.2em] text-cyan-500 uppercase font-semibold">
          Cakrapala Space Operations
        </span>
        <span className="text-base font-bold text-white">
          Satellite Flight Operations Console
        </span>
      </div>

      <div className="w-64 sm:w-80 bg-slate-900/80 rounded-full p-1 border border-cyan-500/25 mb-3">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-400 to-amber-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
          style={{ animation: "loading 1.5s ease-in-out infinite" }}
        />
      </div>

      <span className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        ACQUIRING NORAD SGP4 TELEMETRY SIGNAL...
      </span>

      <style jsx>{`
        @keyframes loading {
          0% { width: 15%; }
          50% { width: 85%; }
          100% { width: 15%; }
        }
      `}</style>
    </div>
  );
}

export default function ISSMissionConsole() {
  const [showCatalog, setShowCatalog] = useState(true);
  const [showCrew, setShowCrew] = useState(false);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <header className="border-b border-cyan-500/20 bg-[#040a17]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-50 shadow-[0_4px_25px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-white transition-all group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>MAIN PORTAL</span>
          </Link>

          <div className="h-5 w-px bg-slate-800" />

          <div>
            <h1 className="text-sm sm:text-base font-mono font-bold text-white tracking-wider flex items-center gap-2">
              SATELLITE FLIGHT OPERATIONS CONSOLE
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                SGP4 LIVE PROPAGATOR
              </span>
            </h1>
          </div>
        </div>
      </header>

      {/* Main Satellite Tracker Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Real-Time Tracker Component with Satellite Switcher & 2D/3D Globe */}
        <RealtimeISSTracker />

        {/* Tracked Satellites Fleet Manifest */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#071124] to-[#020617] border border-slate-800 p-6 sm:p-8">
          <div
            className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4 cursor-pointer"
            onClick={() => setShowCatalog((v) => !v)}
          >
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight font-mono flex items-center gap-2">
                <span>ORBITAL SATELLITE FLEET MANIFEST</span>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-normal">
                  {SATELLITE_CATALOG.length} ACTIVE CRAFT
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Verified NORAD Space Catalog tracking with SGP4 perturbation physics
              </p>
            </div>
            <span className="text-slate-500 text-xs font-mono">{showCatalog ? "▼ HIDE" : "▶ SHOW"}</span>
          </div>

          {showCatalog && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SATELLITE_CATALOG.map((sat) => (
                <div
                  key={sat.id}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-1.5 shadow-inner">
                        <img src={sat.iconSvg} alt={sat.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white font-mono">{sat.name}</div>
                        <div className="text-[11px] text-slate-400">{sat.agency}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                      NORAD {sat.noradId}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {sat.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500 block">ALTITUDE</span>
                      <strong className="text-white">{sat.avgAltitudeKm} km</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PERIOD</span>
                      <strong className="text-white">{sat.periodMin} m</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">INCLINATION</span>
                      <strong className="text-white">{sat.inclinationDeg}°</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Space Station Expedition Crew (Optional Expandable) */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#071124] to-[#020617] border border-slate-800 p-6 sm:p-8">
          <div
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => setShowCrew((v) => !v)}
          >
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight font-mono">
                ACTIVE SPACE STATION CREW EXPEDITION
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Long-Duration Orbital Astronauts &bull; Total: {CURRENT_ISS_CREW.length} Astronauts
              </p>
            </div>
            <span className="text-slate-500 text-xs font-mono">{showCrew ? "▼ HIDE" : "▶ SHOW"}</span>
          </div>

          {showCrew && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
              {CURRENT_ISS_CREW.map((member) => (
                <div
                  key={member.name}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                >
                  <div className="space-y-1 font-mono">
                    <div className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                      <span>{member.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {member.countryCode}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {member.role} &bull; {member.agency}
                    </div>
                    <div className="text-[11px] text-amber-400">
                      Craft: {member.craft}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
