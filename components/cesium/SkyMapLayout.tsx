"use client";

/**
 * SkyMapLayout — top-level layout for Cakrapala Milestone 3 (/sky).
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────────┐
 * │ Header: Cakrapala | Sky Map  (← links)                    │
 * ├────────────────────────────────────────────────────────────┤
 * │                                                            │
 * │   CESIUM GLOBE / SKY DOME (flex-1)                         │
 * │                                                            │
 * │  [Observer + Time overlay: bottom-left]   [CelestialInfo] │
 * ├────────────────────────────────────────────────────────────┤
 * │ SkyMapControls toolbar                                     │
 * ├────────────────────────────────────────────────────────────┤
 * │ HorizonEvents | ObserverPanel (collapsed on mobile)        │
 * └────────────────────────────────────────────────────────────┘
 *
 * STATE RULES:
 *   - Cesium objects are NEVER in React state.
 *   - React state: isPaused, speed, renderMode, show*, observer, currentDate, positions.
 *   - Camera actions forwarded via cesiumViewerRef (imperative, not React state).
 */

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import SkyMapControls from "@/components/cesium/SkyMapControls";
import SimulationTimePanel from "@/components/astronomy/SimulationTimePanel";
import ObserverPanel from "@/components/astronomy/ObserverPanel";
import CelestialInfoPanel from "@/components/astronomy/CelestialInfoPanel";
import HorizonEventsPanel from "@/components/astronomy/HorizonEventsPanel";

import { DEFAULT_OBSERVER } from "@/lib/astronomy/observer";
import type {
  CelestialBodyPosition,
  CesiumSpeedMultiplier,
  SkyRenderMode,
  ObserverLocation,
} from "@/lib/astronomy/types";
import { validateLatitudeInput, validateLongitudeInput, validateElevationInput } from "@/lib/astronomy/validation";

// ── Lazy-load CesiumViewerM3 ──────────────────────────────────────────────────

const CesiumViewerM3 = dynamic(
  () => import("@/components/cesium/CesiumViewerM3"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#020617]">
        <p className="text-slate-400 text-sm animate-pulse">Loading sky map…</p>
      </div>
    ),
  }
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function SkyMapLayout() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<CesiumSpeedMultiplier>(1);
  const [renderMode, setRenderMode] = useState<SkyRenderMode>("globe");
  const [showStars, setShowStars] = useState(true);
  const [showConstellations, setShowConstellations] = useState(true);
  const [showHorizon, setShowHorizon] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [currentUtcDate, setCurrentUtcDate] = useState<Date>(new Date());
  const [positions, setPositions] = useState<CelestialBodyPosition[]>([]);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [observer, setObserver] = useState<ObserverLocation>(DEFAULT_OBSERVER);
  const [showObserverPanel, setShowObserverPanel] = useState(false);
  const [showHorizonPanel, setShowHorizonPanel] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cesiumViewerRef = useRef<any>(null);

  // ── Stable callbacks ─────────────────────────────────────────────────────────
  const handleTimeChange = useCallback((d: Date) => setCurrentUtcDate(d), []);
  const handlePositionsChange = useCallback((p: CelestialBodyPosition[]) => setPositions(p), []);

  const handleTogglePause = useCallback(() => setIsPaused((p) => !p), []);
  const handleSpeedChange = useCallback((s: CesiumSpeedMultiplier) => setSpeedMultiplier(s), []);
  const handleToggleRenderMode = useCallback(() => {
    setRenderMode((m) => (m === "globe" ? "sky-dome" : "globe"));
  }, []);
  const handleResetToNow = useCallback(() => setCurrentUtcDate(new Date()), []);

  const handleToggleStars = useCallback(() => setShowStars((s) => !s), []);
  const handleToggleConstellations = useCallback(() => setShowConstellations((s) => !s), []);
  const handleToggleHorizon = useCallback(() => setShowHorizon((s) => !s), []);
  const handleToggleLabels = useCallback(() => setShowLabels((s) => !s), []);

  const handleFlyToObserver = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    import("cesium").then(({ Cartesian3 }) => {
      viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(observer.longitude, observer.latitude, 5e5), duration: 1.5 });
    }).catch(() => {/* ignore */});
  }, [observer]);

  const handleFlyToGlobeOverview = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    import("cesium").then(({ Cartesian3 }) => {
      viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(observer.longitude, observer.latitude, 1.5e7), duration: 1.5 });
    }).catch(() => {/* ignore */});
  }, [observer]);

  // Observer form state.
  const [latInput, setLatInput] = useState(String(DEFAULT_OBSERVER.latitude));
  const [lonInput, setLonInput] = useState(String(DEFAULT_OBSERVER.longitude));
  const [elevInput, setElevInput] = useState(String(DEFAULT_OBSERVER.elevationMeters));
  const [observerError, setObserverError] = useState<string | null>(null);

  const handleApplyObserver = useCallback(() => {
    const latResult = validateLatitudeInput(latInput);
    const lonResult = validateLongitudeInput(lonInput);
    const elevResult = validateElevationInput(elevInput);
    if (!latResult.ok) { setObserverError(latResult.error); return; }
    if (!lonResult.ok) { setObserverError(lonResult.error); return; }
    if (!elevResult.ok) { setObserverError(elevResult.error); return; }
    setObserverError(null);
    setObserver({
      latitude: latResult.value,
      longitude: lonResult.value,
      elevationMeters: elevResult.value,
      timezone: "UTC",
      displayName: `${latResult.value.toFixed(4)}°, ${lonResult.value.toFixed(4)}°`,
    });
  }, [latInput, lonInput, elevInput]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setObserverError("Geolocation is not available in this browser.");
      return;
    }
    setObserverError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, altitude } = pos.coords;
        setLatInput(latitude.toFixed(6));
        setLonInput(longitude.toFixed(6));
        setElevInput(String(altitude ?? 0));
        setObserver({
          latitude,
          longitude,
          elevationMeters: altitude ?? 0,
          timezone: "UTC",
          displayName: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
        });
      },
      (err) => {
        setObserverError(`Location denied: ${err.message}. Please enter manually.`);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 bg-[#020617] text-slate-100">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e3a5f]/40 bg-[#050c1a]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-colors"
          >
            <span>&larr;</span>
            <span>MAIN PORTAL</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
              Cakrapala
              <span className="text-[10px] font-mono font-normal text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800">
                IAU SKY MAP &amp; STARS
              </span>
            </h1>
          </div>
        </div>
      </header>

      {/* ── Main scene ───────────────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0 flex-col md:flex-row relative">
        <section className="relative flex-1 min-h-0" aria-label="Sky map viewer">
          <CesiumViewerM3
            observer={observer}
            speedMultiplier={speedMultiplier}
            isPaused={isPaused}
            renderMode={renderMode}
            showStars={showStars}
            showConstellations={showConstellations}
            showHorizon={showHorizon}
            showLabels={showLabels}
            onTimeChange={handleTimeChange}
            onPositionsChange={handlePositionsChange}
          />

          {/* ── Bottom-left overlay: time + observer ───────────────────────── */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
            <div className="pointer-events-auto">
              <SimulationTimePanel currentUtcDate={currentUtcDate} observerTimezone={observer.timezone} />
            </div>
            <div className="pointer-events-auto">
              <ObserverPanel observer={observer} />
            </div>
          </div>

          {/* ── Mode badge ────────────────────────────────────────────────── */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <span className={`
              text-[10px] font-mono px-2 py-0.5 rounded border
              ${renderMode === "sky-dome"
                ? "bg-indigo-900/80 text-indigo-300 border-indigo-700"
                : "bg-[#112240]/80 text-slate-400 border-[#1e3a5f]"
              }
            `}>
              {renderMode === "sky-dome" ? "Sky Dome — Observer Local Frame" : "Globe — Earth ECEF Frame"}
            </span>
          </div>
        </section>

        {/* ── Desktop side panel ───────────────────────────────────────────── */}
        <div className="hidden md:flex flex-col shrink-0 w-64 lg:w-72 overflow-y-auto border-l border-[#1e3a5f]/40">
          <CelestialInfoPanel
            positions={positions}
            selectedBodyId={selectedBodyId}
            onSelectBody={setSelectedBodyId}
          />
          <div className="p-3 border-t border-[#1e3a5f]/30">
            <HorizonEventsPanel observer={observer} utcDate={currentUtcDate} />
          </div>
        </div>
      </main>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <SkyMapControls
        renderMode={renderMode}
        isPaused={isPaused}
        speedMultiplier={speedMultiplier}
        showStars={showStars}
        showConstellations={showConstellations}
        showHorizon={showHorizon}
        showLabels={showLabels}
        onToggleRenderMode={handleToggleRenderMode}
        onTogglePause={handleTogglePause}
        onSpeedChange={handleSpeedChange}
        onResetToNow={handleResetToNow}
        onToggleStars={handleToggleStars}
        onToggleConstellations={handleToggleConstellations}
        onToggleHorizon={handleToggleHorizon}
        onToggleLabels={handleToggleLabels}
        onFlyToObserver={handleFlyToObserver}
        onFlyToGlobeOverview={handleFlyToGlobeOverview}
      />

      {/* ── Mobile bottom panels ──────────────────────────────────────────── */}
      <div className="md:hidden border-t border-[#1e3a5f]/40">
        {/* Quick toggle row */}
        <div className="flex border-b border-[#1e3a5f]/30">
          <button
            onClick={() => setShowObserverPanel((s) => !s)}
            className="flex-1 py-2 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-[#112240] transition-colors"
          >
            Observer {showObserverPanel ? "▲" : "▼"}
          </button>
          <button
            onClick={() => setShowHorizonPanel((s) => !s)}
            className="flex-1 py-2 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-[#112240] transition-colors border-l border-[#1e3a5f]/30"
          >
            Events {showHorizonPanel ? "▲" : "▼"}
          </button>
        </div>

        {showObserverPanel && (
          <div className="max-h-52 overflow-y-auto p-3 space-y-2">
            <ObserverInputForm
              latInput={latInput} onLatChange={setLatInput}
              lonInput={lonInput} onLonChange={setLonInput}
              elevInput={elevInput} onElevChange={setElevInput}
              error={observerError}
              onApply={handleApplyObserver}
              onUseLocation={handleUseCurrentLocation}
            />
          </div>
        )}
        {showHorizonPanel && (
          <div className="max-h-52 overflow-y-auto p-3">
            <HorizonEventsPanel observer={observer} utcDate={currentUtcDate} />
          </div>
        )}
        <div className="max-h-40 overflow-y-auto">
          <CelestialInfoPanel positions={positions} selectedBodyId={selectedBodyId} onSelectBody={setSelectedBodyId} />
        </div>
      </div>

      {/* ── Desktop observer input (floating) ────────────────────────────── */}
      <div className="hidden md:block">
        <ObserverInputBar
          latInput={latInput} onLatChange={setLatInput}
          lonInput={lonInput} onLonChange={setLonInput}
          elevInput={elevInput} onElevChange={setElevInput}
          error={observerError}
          onApply={handleApplyObserver}
          onUseLocation={handleUseCurrentLocation}
        />
      </div>
    </div>
  );
}

// ── Observer input components ─────────────────────────────────────────────────

type ObserverInputProps = {
  latInput: string; onLatChange: (v: string) => void;
  lonInput: string; onLonChange: (v: string) => void;
  elevInput: string; onElevChange: (v: string) => void;
  error: string | null;
  onApply: () => void;
  onUseLocation: () => void;
};

function ObserverInputBar(props: ObserverInputProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[#030a17]/80 border-t border-[#1e3a5f]/30 text-xs">
      <span className="text-slate-500 text-[10px]">Observer:</span>
      <LabelledInput id="obs-lat" label="Lat" value={props.latInput} onChange={props.onLatChange} placeholder="-6.595" />
      <LabelledInput id="obs-lon" label="Lon" value={props.lonInput} onChange={props.onLonChange} placeholder="106.816" />
      <LabelledInput id="obs-elev" label="Elev (m)" value={props.elevInput} onChange={props.onElevChange} placeholder="250" />
      <button onClick={props.onApply} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs min-h-[28px]">
        Apply
      </button>
      <button
        onClick={props.onUseLocation}
        title="Request current GPS location. Requires browser permission."
        className="px-2 py-1 bg-[#112240] hover:bg-[#1a3560] text-slate-300 rounded text-xs border border-[#1e3a5f] min-h-[28px]"
      >
        Use GPS
      </button>
      {props.error && <span className="text-red-400 text-[10px]">{props.error}</span>}
      <span className="text-[9px] text-slate-600 ml-auto">⚠ Default: demo location (Bogor, not GPS)</span>
    </div>
  );
}

function ObserverInputForm(props: ObserverInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <LabelledInput id="m-obs-lat" label="Latitude" value={props.latInput} onChange={props.onLatChange} placeholder="-6.595" />
      <LabelledInput id="m-obs-lon" label="Longitude" value={props.lonInput} onChange={props.onLonChange} placeholder="106.816" />
      <LabelledInput id="m-obs-elev" label="Elevation (m)" value={props.elevInput} onChange={props.onElevChange} placeholder="250" />
      {props.error && <span className="text-red-400 text-[10px]">{props.error}</span>}
      <div className="flex gap-2">
        <button onClick={props.onApply} className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">Apply</button>
        <button onClick={props.onUseLocation} className="flex-1 px-2 py-1.5 bg-[#112240] hover:bg-[#1a3560] text-slate-300 rounded text-xs border border-[#1e3a5f]">Use GPS</button>
      </div>
      <p className="text-[9px] text-slate-600">⚠ Default: demo location (Bogor, Indonesia). Not GPS-derived.</p>
    </div>
  );
}

function LabelledInput({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="text-[10px] text-slate-500 whitespace-nowrap">{label}</label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step="any"
        className="w-20 bg-[#112240] text-slate-200 text-[11px] rounded px-1.5 py-1 border border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}
