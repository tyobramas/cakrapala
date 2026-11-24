"use client";

/**
 * SpaceExplorerLayout — Luxury Minimalist VSOP87 3D Solar System Orrery Workspace.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import SceneToolbar from "./SceneToolbar";
import PlanetInfoPanel from "./PlanetInfoPanel";
import type {
  SolarSystemSceneHandle,
  EphemerisSnapshot,
} from "./SolarSystemScene";
import type { PlanetId } from "@/lib/astronomy/types";
import { PLANET_DATA } from "@/lib/astronomy/planetData";
import { DETAILED_PLANET_DATA } from "@/lib/astronomy/planetDetailedData";
import {
  SOLAR_TIME_PRESETS,
  type SolarTimePresetId,
  type LivePlanetTelemetry,
} from "@/lib/astronomy/solarSystemPhysics";
import { ArrowLeft, HelpCircle, X } from "lucide-react";
import ObservatoryLoader from "@/components/ui/ObservatoryLoader";

const SolarSystemScene = dynamic(() => import("./SolarSystemScene"), {
  ssr: false,
  loading: () => (
    <ObservatoryLoader
      variant="container"
      title="CAKRAPALA"
      subtitle="Initializing VSOP87 planetary orrery"
      className="h-full w-full"
    />
  ),
});

function formatSimDate(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export default function SpaceExplorerLayout() {
  const [simDateStr, setSimDateStr] = useState<string>("");
  const [liveTelemetry, setLiveTelemetry] = useState<
    Record<string, LivePlanetTelemetry>
  >({});
  const [showControlsHint, setShowControlsHint] = useState(false);

  const [isPaused, setIsPaused] = useState(false);
  const [timePresetId, setTimePresetId] = useState<SolarTimePresetId>("3d");
  const overviewPresetRef = useRef<SolarTimePresetId>("3d");
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const [selectedPlanetId, setSelectedPlanetId] = useState<PlanetId | null>(
    null
  );
  const sceneRef = useRef<SolarSystemSceneHandle | null>(null);

  const activePreset =
    SOLAR_TIME_PRESETS.find((p) => p.id === timePresetId) ??
    SOLAR_TIME_PRESETS[2];

  const handleEphemerisUpdate = useCallback((snapshot: EphemerisSnapshot) => {
    setSimDateStr(formatSimDate(snapshot.simDate));
    setLiveTelemetry(snapshot.telemetry);
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleTimePresetChange = useCallback(
    (presetId: SolarTimePresetId) => {
      setTimePresetId(presetId);
      if (!selectedPlanetId) {
        overviewPresetRef.current = presetId;
      }
      if (presetId === "live") {
        sceneRef.current?.syncToNow();
        setIsPaused(false);
      }
    },
    [selectedPlanetId]
  );

  const handleSyncToNow = useCallback(() => {
    setTimePresetId("live");
    overviewPresetRef.current = "live";
    setIsPaused(false);
    sceneRef.current?.syncToNow();
  }, []);

  const handleToggleOrbits = useCallback(() => {
    setShowOrbits((prev) => !prev);
  }, []);

  const handleToggleLabels = useCallback(() => {
    setShowLabels((prev) => !prev);
  }, []);

  const handleResetCamera = useCallback(() => {
    setSelectedPlanetId(null);
    setTimePresetId(overviewPresetRef.current);
    sceneRef.current?.resetCamera();
  }, []);

  const handlePlanetSelected = useCallback((planetId: PlanetId | null) => {
    setSelectedPlanetId((prev) => {
      if (planetId && !prev) {
        // Automatically slow down to calm 1 H/s when focusing a planet for inspection
        // (Earth spins 1 rev / 24s — 100% physically exact at 1 H/s!)
        setTimePresetId((cur) => {
          overviewPresetRef.current = cur;
          return cur === "live" ? "live" : "1h";
        });
      } else if (!planetId && prev) {
        setTimePresetId(overviewPresetRef.current);
      }
      return planetId;
    });
  }, []);

  const handleDeselectPlanet = useCallback(() => {
    setSelectedPlanetId(null);
    setTimePresetId(overviewPresetRef.current);
    sceneRef.current?.deselectPlanet();
  }, []);

  const handleZoomIn = useCallback(() => {
    sceneRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    sceneRef.current?.zoomOut();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Escape") {
        setShowControlsHint(false);
        handleDeselectPlanet();
      } else if (e.code === "Space") {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key === "r" || e.key === "R") {
        handleResetCamera();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleDeselectPlanet,
    handleTogglePause,
    handleZoomIn,
    handleZoomOut,
    handleResetCamera,
  ]);

  const detailedPlanet = selectedPlanetId
    ? DETAILED_PLANET_DATA[selectedPlanetId]
    : null;
  const activeTelemetry = selectedPlanetId
    ? liveTelemetry[selectedPlanetId] ?? null
    : null;

  return (
    <div className="relative flex h-screen w-screen flex-col justify-between overflow-hidden bg-[#01030a] font-sans text-slate-100 select-none">
      {/* ── 1. Compact Corner-Pinned Luxury Top Header Bar ────────────────── */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-2 pt-2 sm:px-2.5 sm:pt-2.5">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-2">
          {/* Top-Left Corner: Ultra-Compact Unified Back + Brand Capsule */}
          <div className="flex h-8 shrink-0 items-center rounded-full border border-white/[0.10] bg-[#030714]/70 p-0.5 pr-3 backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
            <Link
              href="/"
              aria-label="Back to Home"
              title="Back to Home"
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.10] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            </Link>

            <span className="mx-1 h-3.5 w-px bg-white/[0.12]" />

            <div className="flex items-center gap-1.5 pl-1">
              <Image
                src="/cakrapala1.png"
                alt="Cakrapala"
                width={18}
                height={18}
                className="h-[18px] w-[18px] rounded-full object-contain opacity-95"
              />
              <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-medium tracking-[0.18em] text-white/95">
                SOLAR SYSTEM
              </span>
            </div>
          </div>

          {/* Center: Quiet Focus Status Pill */}
          <div className="hidden h-8 items-center gap-2 rounded-full border border-white/[0.09] bg-[#030714]/55 px-3.5 backdrop-blur-2xl md:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                detailedPlanet
                  ? "bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.85)]"
                  : "bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              }`}
            />
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-white/90 uppercase">
              {detailedPlanet ? detailedPlanet.name : "Heliocentric Orrery"}
            </span>
            <span className="text-white/20">·</span>
            <span className="font-mono text-[10px] tracking-[0.12em] text-slate-400 uppercase">
              {detailedPlanet
                ? activeTelemetry
                  ? `${activeTelemetry.distanceAU.toFixed(3)} AU · ${activeTelemetry.velocityKmS.toFixed(2)} km/s`
                  : detailedPlanet.classification
                : "VSOP87 · J2000"}
            </span>
          </div>

          {/* Right: Live Ephemeris Date Clock + Sync Now + Controls Guide */}
          <div className="flex items-center gap-1.5">
            <div className="hidden h-8 items-center gap-2 rounded-full border border-white/[0.09] bg-[#030714]/55 pr-1.5 pl-3 font-mono text-[10px] tracking-[0.08em] text-slate-300 backdrop-blur-2xl sm:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  timePresetId === "live"
                    ? "bg-emerald-400"
                    : "bg-sky-300/80"
                }`}
              />
              <span className="text-white/90 tabular-nums">
                {simDateStr || "Syncing Epoch..."}
              </span>
              {timePresetId !== "live" && (
                <button
                  type="button"
                  onClick={handleSyncToNow}
                  className="ml-0.5 cursor-pointer rounded-full border border-white/15 bg-white/[0.07] px-2 py-0.5 text-[9px] tracking-[0.14em] text-sky-200 uppercase transition-colors hover:bg-white/15 hover:text-white"
                  title="Jump back to current real-time UTC"
                >
                  Now
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowControlsHint((v) => !v)}
              aria-label="Navigation Controls Guide"
              title="Camera & Gesture Controls"
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border backdrop-blur-2xl transition-all ${
                showControlsHint
                  ? "border-white/35 bg-white/15 text-white"
                  : "border-white/[0.10] bg-[#030714]/60 text-slate-300 hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
              }`}
            >
              {showControlsHint ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <HelpCircle className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Controls Guide Popover */}
        {showControlsHint && (
          <div className="pointer-events-auto absolute top-12 right-3 z-50 w-72 rounded-2xl border border-white/12 bg-[#040814]/88 p-4 text-xs backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
            <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-mono text-[10px] font-medium tracking-[0.22em] text-white/90 uppercase">
                Camera Controls
              </span>
              <span className="font-mono text-[9px] text-slate-400">
                MOUSE · TOUCH
              </span>
            </div>
            <ul className="space-y-2 text-[11px] text-slate-300">
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Orbit / Rotate</span>
                <span className="font-mono text-white/90">Left Drag · 1 Finger</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Zoom</span>
                <span className="font-mono text-white/90">Scroll · Pinch</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Pan / Move</span>
                <span className="font-mono text-white/90">Right Drag · 2 Fingers</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Focus World</span>
                <span className="font-mono text-white/90">Click / Tap Planet</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Shortcuts</span>
                <span className="font-mono text-white/90">Space · R · Esc</span>
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ── 2. Full-Viewport 3D Babylon.js Solar System Canvas ───────────── */}
      <div className="absolute inset-0 z-0">
        <SolarSystemScene
          ref={sceneRef}
          isPaused={isPaused}
          daysPerSecond={activePreset.daysPerSec}
          showOrbits={showOrbits}
          showLabels={showLabels}
          selectedPlanetId={selectedPlanetId}
          onPlanetSelected={handlePlanetSelected}
          onEphemerisUpdate={handleEphemerisUpdate}
        />
      </div>

      {/* ── 3A. Mobile Horizontal Quick Planet Strip (< md) ──────────────── */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex px-3 md:hidden">
        <div className="pointer-events-auto flex w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/[0.08] bg-[#030714]/55 p-1.5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => handlePlanetSelected("sun")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium tracking-wider uppercase transition-all ${
              selectedPlanetId === "sun"
                ? "bg-white/15 text-white"
                : "text-slate-300"
            }`}
          >
            <img
              src="/textures/planets/sun.jpg"
              alt="Sun"
              className="h-3.5 w-3.5 rounded-full object-cover"
            />
            <span>Sun</span>
          </button>
          {PLANET_DATA.map((planet) => (
            <button
              key={planet.id}
              type="button"
              onClick={() => handlePlanetSelected(planet.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium tracking-wider uppercase transition-all ${
                selectedPlanetId === planet.id
                  ? "bg-white/15 text-white"
                  : "text-slate-300"
              }`}
            >
              <img
                src={`/textures/planets/${planet.id}.jpg`}
                alt={planet.name}
                className="h-3.5 w-3.5 rounded-full object-cover"
              />
              <span>{planet.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3B. Desktop Left Celestial Selector Rail (md+) ───────────────── */}
      <aside
        aria-label="Celestial Bodies Navigation"
        className="pointer-events-auto fixed top-20 left-5 z-30 hidden max-h-[calc(100vh-156px)] w-56 flex-col overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#030714]/42 p-2.5 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.45)] md:flex"
      >
        <div className="mb-1.5 flex items-center justify-between px-2.5 pt-0.5 pb-1">
          <span className="font-mono text-[9px] font-medium tracking-[0.24em] text-slate-400 uppercase">
            Celestial Bodies
          </span>
          {selectedPlanetId && (
            <button
              type="button"
              onClick={handleDeselectPlanet}
              className="cursor-pointer font-mono text-[9px] tracking-[0.14em] text-sky-300/90 uppercase transition-colors hover:text-white"
            >
              Overview
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          {/* Sun */}
          <button
            type="button"
            onClick={() => handlePlanetSelected("sun")}
            className={`group flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
              selectedPlanetId === "sun"
                ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                : "text-slate-300/85 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-amber-300/50 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                <img
                  src="/textures/planets/sun.jpg"
                  alt="Sun"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-[11px] font-medium tracking-[0.06em]">
                Sun
              </span>
            </div>
            <span className="font-mono text-[9px] tracking-wider text-amber-300/75 uppercase">
              G2V
            </span>
          </button>

          {/* 8 Planets with live VSOP87 distance in AU */}
          {PLANET_DATA.map((planet) => {
            const active = selectedPlanetId === planet.id;
            const liveAu = liveTelemetry[planet.id]?.distanceAU;
            const displayAu = liveAu ?? planet.realSemiMajorAxisAU;
            return (
              <button
                key={planet.id}
                type="button"
                onClick={() => handlePlanetSelected(planet.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition-all ${
                  active
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                    : "text-slate-300/85 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/25">
                    <img
                      src={`/textures/planets/${planet.id}.jpg`}
                      alt={planet.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-medium tracking-[0.04em]">
                    {planet.name}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-slate-400 transition-colors group-hover:text-slate-200">
                  {displayAu >= 10
                    ? displayAu.toFixed(2)
                    : displayAu.toFixed(3)}{" "}
                  AU
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── 4. Right Object Inspector with Live Vis-Viva Ephemeris ────────── */}
      <PlanetInfoPanel
        selectedPlanetId={selectedPlanetId}
        liveTelemetry={activeTelemetry}
        onClose={handleDeselectPlanet}
      />

      {/* ── 5. Bottom Minimal Simulation & Camera Dock ───────────────────── */}
      <footer className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex items-center justify-center px-4 sm:bottom-5">
        <div className="pointer-events-auto">
          <SceneToolbar
            isPaused={isPaused}
            timePresetId={timePresetId}
            showOrbits={showOrbits}
            showLabels={showLabels}
            onTogglePause={handleTogglePause}
            onTimePresetChange={handleTimePresetChange}
            onToggleOrbits={handleToggleOrbits}
            onToggleLabels={handleToggleLabels}
            onResetCamera={handleResetCamera}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </div>
      </footer>
    </div>
  );
}
