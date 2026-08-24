"use client";

/**
 * SpaceExplorerLayout — Master 3D Solar System & Planetary Globe Focus Deck.
 * Featuring:
 *   - Default Simulation Speed: 0.5x
 *   - Real Photographic Planet Icons in the Navigation List
 *   - Ultra-Translucent Crystal Frosted Glassmorphism
 *   - Direct Embedding of Object Inspector on Planet Focus
 */

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import SceneToolbar from "./SceneToolbar";
import PlanetInfoPanel from "./PlanetInfoPanel";
import type { SolarSystemSceneHandle } from "./SolarSystemScene";
import type {
  PlanetId,
  SimulationState,
  SimulationSpeed,
} from "@/lib/astronomy/types";
import { PLANET_DATA, SUN_DATA } from "@/lib/astronomy/planetData";
import { DETAILED_PLANET_DATA } from "@/lib/astronomy/planetDetailedData";
import {
  ArrowLeft,
  Orbit,
  Sparkles,
  Info,
  ChevronRight,
  Radio,
  Sparkle,
} from "lucide-react";

// Dynamic import of the Babylon canvas (SSR disabled)
const SolarSystemScene = dynamic(
  () => import("./SolarSystemScene"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center w-full h-full bg-[#020617] text-cyan-400 font-mono text-sm"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="tracking-widest">INITIALIZING 3D SOLAR SYSTEM ENGINE...</span>
        </div>
      </div>
    ),
  }
);

export default function SpaceExplorerLayout() {
  const [timeUtc, setTimeUtc] = useState<string>("");
  const [gmst, setGmst] = useState<string>("");
  
  // Default simulation speed is now 0.5x
  const [simulation, setSimulation] = useState<SimulationState>({
    isPaused: false,
    simulationSpeed: 0.5,
    showOrbits: true,
    showLabels: true,
  });

  const [selectedPlanetId, setSelectedPlanetId] = useState<PlanetId | null>(null);
  const sceneRef = useRef<SolarSystemSceneHandle | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + " UTC");

      const d = (now.getTime() / 86400000) + 2440587.5 - 2451545.0;
      let gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
      if (gmstHours < 0) gmstHours += 24;
      const gh = String(Math.floor(gmstHours)).padStart(2, "0");
      const gm = String(Math.floor((gmstHours % 1) * 60)).padStart(2, "0");
      const gs = String(Math.floor(((gmstHours % 1) * 60 % 1) * 60)).padStart(2, "0");
      setGmst(`${gh}:${gm}:${gs} GMST`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePause = useCallback(() => {
    setSimulation((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const handleSpeedChange = useCallback((speed: SimulationSpeed) => {
    setSimulation((prev) => ({ ...prev, simulationSpeed: speed }));
  }, []);

  const handleToggleOrbits = useCallback(() => {
    setSimulation((prev) => ({ ...prev, showOrbits: !prev.showOrbits }));
  }, []);

  const handleToggleLabels = useCallback(() => {
    setSimulation((prev) => ({ ...prev, showLabels: !prev.showLabels }));
  }, []);

  const handleResetCamera = useCallback(() => {
    setSelectedPlanetId(null);
    sceneRef.current?.resetCamera();
  }, []);

  const handlePlanetSelected = useCallback((planetId: PlanetId | null) => {
    setSelectedPlanetId(planetId);
  }, []);

  const handleDeselectPlanet = useCallback(() => {
    sceneRef.current?.deselectPlanet();
    setSelectedPlanetId(null);
  }, []);

  const detailedPlanet = selectedPlanetId ? DETAILED_PLANET_DATA[selectedPlanetId] : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans select-none flex flex-col justify-between">
      
      {/* ── 1. Unified NASA Tactical Header Bar ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 pt-3 pointer-events-none">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 pointer-events-auto">
          
          {/* Left: Emblem, Title & Return Link */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#030712]/80 hover:bg-[#16233b] border border-slate-700/80 hover:border-cyan-400 text-xs font-mono text-cyan-300 font-bold transition-all shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>MAIN PORTAL</span>
            </Link>

            <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[#030712]/80 border border-slate-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-900 border border-cyan-500/40 p-0.5">
                <Image
                  src="/cakrapala.png"
                  alt="Cakrapala Logo"
                  width={32}
                  height={32}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <span className="font-mono font-black tracking-widest text-sm text-white block">
                  3D SOLAR SYSTEM
                </span>
                <span className="text-[9px] font-mono text-cyan-400 block">
                  KEPLERIAN HELIOCENTRIC MECHANICS
                </span>
              </div>
            </div>
          </div>

          {/* Center: Tactical Target Lock Indicator (With Corner Reticles) */}
          <div className="hidden md:flex items-center gap-2 px-6 py-2 rounded-2xl bg-[#030712]/80 border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.25)] backdrop-blur-2xl font-mono text-xs relative">
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-cyan-400" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-cyan-400" />
            <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-cyan-400" />
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-cyan-400" />

            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-white font-bold tracking-widest uppercase">
              {detailedPlanet ? detailedPlanet.name : "SOLAR SYSTEM OVERVIEW"}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-[10px] text-cyan-300">
              {detailedPlanet ? `${detailedPlanet.classification.toUpperCase()} • TARGET LOCK` : "8 PLANETS + SUN"}
            </span>
          </div>

          {/* Right: Integrated Flight Telemetry Clock */}
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#030712]/80 border border-slate-700/80 font-mono text-xs text-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-emerald-400 text-[10px]">LIVE</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-300 font-bold text-[11px]">{timeUtc || "00:00:00 UTC"}</span>
            </div>
            <div className="text-[9px] text-slate-500 hidden lg:block">
              {gmst}
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Full-Screen 3D Babylon.js Canvas Engine ──────────────────────── */}
      <div className="absolute inset-0 z-0">
        <SolarSystemScene
          ref={sceneRef}
          simulationState={simulation}
          selectedPlanetId={selectedPlanetId}
          onPlanetSelected={handlePlanetSelected}
        />
      </div>

      {/* ── 3. LEFT HUD CONTROLS ────────────────────────────────────────────── */}
      {selectedPlanetId && detailedPlanet ? (
        /* Focused Planet Mode: Left Quick Action Deck */
        <div className="fixed top-20 left-4 z-30 flex flex-col gap-2.5 p-4 rounded-[26px] bg-[#030712]/30 border border-slate-700/35 shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl font-mono text-xs max-w-xs animate-fade-in pointer-events-auto">
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest block">
              TARGET LOCK
            </span>
            <div className="flex items-center gap-2.5 mt-0.5">
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-white/60 shadow-sm">
                <img src={`/textures/planets/${detailedPlanet.id}.jpg`} alt={detailedPlanet.name} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-white font-sans">
                {detailedPlanet.name}
              </h2>
            </div>
            <p className="text-[10px] text-cyan-300 mt-0.5">
              {detailedPlanet.classification}
            </p>
          </div>

          {/* Go Back to Solar System Button */}
          <button
            onClick={handleDeselectPlanet}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>GO BACK // SYSTEM</span>
          </button>

          {/* Tactical Mode Toggle Buttons */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
            <button
              onClick={() => handleToggleOrbits()}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl border transition-all ${
                simulation.showOrbits
                  ? "bg-[#25324d]/80 text-cyan-300 border-cyan-500/50 shadow-sm"
                  : "bg-[#030712]/50 text-slate-400 border-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <Orbit className="w-4 h-4 text-cyan-400" />
                <span>ORBIT TRACK</span>
              </div>
              <span className="text-[9px]">{simulation.showOrbits ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Wide Solar System Mode: Left Planetary Quick Selector with Real Planet Photos */
        <div className="fixed top-20 left-4 z-30 hidden md:flex flex-col gap-1.5 p-3 rounded-[26px] bg-[#030712]/35 border border-slate-700/35 shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl font-mono text-[10px] max-h-[calc(100vh-140px)] overflow-y-auto pointer-events-auto">
          <span className="text-[9px] text-slate-400 font-bold px-2 py-1 uppercase tracking-wider block">
            CELESTIAL BODIES
          </span>

          {/* Sun with real photo thumbnail */}
          <button
            onClick={() => handlePlanetSelected("sun")}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl transition-all ${
              selectedPlanetId === "sun"
                ? "bg-amber-500/25 border border-amber-500/50 text-amber-300 font-bold shadow-sm"
                : "hover:bg-slate-800/50 text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                <img src="/textures/planets/sun.jpg" alt="Sun" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold">SUN (SOL)</span>
            </div>
            <span className="text-[9px] text-slate-400">STAR</span>
          </button>

          {/* Planets with real photographic round thumbnails */}
          {PLANET_DATA.map((planet) => (
            <button
              key={planet.id}
              onClick={() => handlePlanetSelected(planet.id)}
              className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl transition-all ${
                selectedPlanetId === planet.id
                  ? "bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 font-bold shadow-sm"
                  : "hover:bg-slate-800/50 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-white/40 shadow-sm">
                  <img
                    src={`/textures/planets/${planet.id}.jpg`}
                    alt={planet.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span>{planet.name.toUpperCase()}</span>
              </div>
              <span className="text-[9px] text-cyan-400 font-mono font-bold">
                {planet.realSemiMajorAxisAU >= 10
                  ? planet.realSemiMajorAxisAU.toFixed(1)
                  : planet.realSemiMajorAxisAU.toFixed(2)}{" "}
                AU
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── 4. RIGHT HUD: Direct Object Inspector & Astrophysical Telemetry ─── */}
      <PlanetInfoPanel
        selectedPlanetId={selectedPlanetId}
        onClose={handleDeselectPlanet}
      />

      {/* ── 5. Bottom Cockpit Control Toolbar Dock ─────────────────────────── */}
      <footer className="fixed bottom-4 left-0 right-0 z-30 px-4 pointer-events-none flex items-center justify-center">
        <div className="pointer-events-auto">
          <SceneToolbar
            simulationState={simulation}
            onTogglePause={handleTogglePause}
            onSpeedChange={handleSpeedChange}
            onToggleOrbits={handleToggleOrbits}
            onToggleLabels={handleToggleLabels}
            onResetCamera={handleResetCamera}
          />
        </div>
      </footer>
    </div>
  );
}
