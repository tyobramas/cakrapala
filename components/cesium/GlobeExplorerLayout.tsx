"use client";

/**
 * GlobeExplorerLayout — top-level layout for Cakrapala Milestone 2 (/explore).
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────────┐
 * │ Header: Cakrapala | Explore  (← Solar System nav link)    │
 * ├────────────────────────────────────────────────────────────┤
 * │                                                            │
 * │   CESIUM GLOBE (flex-1, fills remaining height)            │
 * │                                                            │
 * │  [Observer + Time badge: bottom-left overlay]              │
 * │                                        [CelestialInfoPanel]│
 * ├────────────────────────────────────────────────────────────┤
 * │ CesiumTimeControls | CesiumCameraController                │
 * └────────────────────────────────────────────────────────────┘
 *
 * STATE RULES:
 *   - Cesium objects are NEVER stored in React state (stored as refs in CesiumViewer).
 *   - React state holds only primitive UI values: currentUtcDate, positions[],
 *     isPaused, speedMultiplier, selectedBodyId.
 *   - Camera actions are forwarded via imperative refs on the CesiumViewer.
 *   - onTimeChange and onPositionsChange callbacks are stable (useCallback).
 */

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import CesiumTimeControls from "@/components/cesium/CesiumTimeControls";
import CesiumCameraController from "@/components/cesium/CesiumCameraController";
import ObserverPanel from "@/components/astronomy/ObserverPanel";
import SimulationTimePanel from "@/components/astronomy/SimulationTimePanel";
import CelestialInfoPanel from "@/components/astronomy/CelestialInfoPanel";

import { DEFAULT_OBSERVER } from "@/lib/astronomy/observer";
import type {
  CelestialBodyPosition,
  CesiumSpeedMultiplier,
} from "@/lib/astronomy/types";

// ── Lazy-load CesiumViewer (Cesium must only run client-side) ─────────────────

const CesiumViewer = dynamic(
  () => import("@/components/cesium/CesiumViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#020617]">
        <p className="text-slate-400 text-sm animate-pulse">
          Loading Cesium globe…
        </p>
      </div>
    ),
  }
);

// ── Component ──────────────────────────────────────────────────────────────────

export default function GlobeExplorerLayout() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<CesiumSpeedMultiplier>(1);
  const [currentUtcDate, setCurrentUtcDate] = useState<Date>(new Date());
  const [positions, setPositions] = useState<CelestialBodyPosition[]>([]);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);

  // Observer is fixed at the demo location for Milestone 2.
  const observer = DEFAULT_OBSERVER;

  // ── Ref for imperative camera calls into CesiumViewer ───────────────────────
  // We communicate via a shared ref object rather than forwardRef because
  // CesiumViewer is loaded via dynamic() and doesn't expose a ref handle.
  // Camera actions are passed as callbacks from the parent to CesiumViewer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cesiumViewerRef = useRef<any>(null);

  // ── Stable callbacks for CesiumViewer ───────────────────────────────────────

  const handleTimeChange = useCallback((utcDate: Date) => {
    setCurrentUtcDate(utcDate);
  }, []);

  const handlePositionsChange = useCallback((p: CelestialBodyPosition[]) => {
    setPositions(p);
  }, []);

  // ── Toolbar handlers ─────────────────────────────────────────────────────────

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleSpeedChange = useCallback((speed: CesiumSpeedMultiplier) => {
    setSpeedMultiplier(speed);
  }, []);

  const handleResetToNow = useCallback(() => {
    setCurrentUtcDate(new Date());
    // The CesiumViewer syncs its clock.currentTime via the isPaused/speed
    // effect.  For a hard reset we'd need an imperative call — deferred to
    // a future milestone.
  }, []);

  // ── Camera handlers ───────────────────────────────────────────────────────
  // These will call methods on the internal Cesium viewer when wired up.
  // For now they are no-ops at the layout level — CesiumViewer handles them
  // internally on mount.  Future: expose via a handle ref.

  const handleFlyToObserver = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    import("cesium").then(({ Cartesian3 }) => {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          observer.longitude,
          observer.latitude,
          5e5 // 500 km altitude
        ),
        duration: 2.0,
      });
    }).catch(() => {/* ignore */});
  }, [observer]);

  const handleFlyToGlobeOverview = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    import("cesium").then(({ Cartesian3 }) => {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          observer.longitude,
          observer.latitude,
          1.5e7 // 15,000 km
        ),
        duration: 2.0,
      });
    }).catch(() => {/* ignore */});
  }, [observer]);

  const handleFlyToHome = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyHome(2.0);
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
              <span className="text-[10px] font-mono font-normal text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                EARTH CELESTIAL GLOBE
              </span>
            </h1>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0 flex-col md:flex-row relative">
        {/* ── Cesium globe ────────────────────────────────────────────────── */}
        <section className="relative flex-1 min-h-0" aria-label="Cesium 3D globe">
          <CesiumViewer
            observer={observer}
            speedMultiplier={speedMultiplier}
            isPaused={isPaused}
            onTimeChange={handleTimeChange}
            onPositionsChange={handlePositionsChange}
          />

          {/* ── Observer + time overlay (bottom-left) ─────────────────────── */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
            <div className="pointer-events-auto">
              <SimulationTimePanel
                currentUtcDate={currentUtcDate}
                observerTimezone={observer.timezone}
              />
            </div>
            <div className="pointer-events-auto">
              <ObserverPanel observer={observer} />
            </div>
          </div>
        </section>

        {/* ── Celestial info panel (side) ──────────────────────────────────── */}
        <div className="hidden md:flex flex-col shrink-0">
          <CelestialInfoPanel
            positions={positions}
            selectedBodyId={selectedBodyId}
            onSelectBody={setSelectedBodyId}
          />
        </div>
      </main>

      {/* ── Bottom toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-0 px-1 border-t border-[#1e3a5f]/50 bg-[#050c1a]/90 shrink-0">
        <CesiumTimeControls
          isPaused={isPaused}
          speedMultiplier={speedMultiplier}
          currentUtcDate={currentUtcDate}
          observerTimezone={observer.timezone}
          onTogglePause={handleTogglePause}
          onSpeedChange={handleSpeedChange}
          onResetToNow={handleResetToNow}
        />
        <CesiumCameraController
          onFlyToObserver={handleFlyToObserver}
          onFlyToGlobeOverview={handleFlyToGlobeOverview}
          onFlyToHome={handleFlyToHome}
        />
      </div>

      {/* ── Mobile celestial panel (below toolbar) ────────────────────────── */}
      <div className="md:hidden border-t border-[#1e3a5f]/40 max-h-40 overflow-y-auto">
        <CelestialInfoPanel
          positions={positions}
          selectedBodyId={selectedBodyId}
          onSelectBody={setSelectedBodyId}
        />
      </div>
    </div>
  );
}
