"use client";

/**
 * SceneToolbar — Floating Physical-Time Simulation & Camera Control Dock.
 */

import {
  Play,
  Pause,
  Tag,
  RotateCcw,
  Orbit,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  SOLAR_TIME_PRESETS,
  type SolarTimePresetId,
} from "@/lib/astronomy/solarSystemPhysics";

type Props = {
  isPaused: boolean;
  timePresetId: SolarTimePresetId;
  showOrbits: boolean;
  showLabels: boolean;
  onTogglePause: () => void;
  onTimePresetChange: (presetId: SolarTimePresetId) => void;
  onToggleOrbits: () => void;
  onToggleLabels: () => void;
  onResetCamera: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
};

export default function SceneToolbar({
  isPaused,
  timePresetId,
  showOrbits,
  showLabels,
  onTogglePause,
  onTimePresetChange,
  onToggleOrbits,
  onToggleLabels,
  onResetCamera,
  onZoomIn,
  onZoomOut,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/[0.11] bg-[#030714]/58 p-1.5 font-mono text-[11px] backdrop-blur-2xl shadow-[0_14px_44px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]"
      role="toolbar"
      aria-label="3D Solar System Simulation Controls"
    >
      {/* Play / Pause */}
      <button
        type="button"
        onClick={onTogglePause}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-all ${
          isPaused
            ? "bg-amber-400/90 text-slate-950 hover:bg-amber-300"
            : "bg-white/92 text-slate-950 hover:bg-white"
        }`}
        title={isPaused ? "Resume Simulation (Space)" : "Pause Simulation (Space)"}
      >
        {isPaused ? (
          <Play className="h-3 w-3 fill-current" />
        ) : (
          <Pause className="h-3 w-3 fill-current" />
        )}
        <span className="hidden sm:inline">{isPaused ? "Play" : "Pause"}</span>
      </button>

      {/* Physical Ephemeris Time Rate Presets */}
      <div className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5">
        {SOLAR_TIME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onTimePresetChange(preset.id)}
            className={`cursor-pointer rounded-full px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-all ${
              timePresetId === preset.id
                ? "bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                : "text-slate-400 hover:text-white"
            }`}
            title={`Simulate at ${preset.label}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="hidden h-4 w-px bg-white/10 sm:block" />

      {/* Toggle Orbits */}
      <button
        type="button"
        onClick={onToggleOrbits}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] uppercase transition-all ${
          showOrbits
            ? "bg-white/12 text-white"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
        }`}
        title="Toggle Elliptical VSOP87 Orbits"
      >
        <Orbit className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Orbits</span>
      </button>

      {/* Toggle Labels */}
      <button
        type="button"
        onClick={onToggleLabels}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] uppercase transition-all ${
          showLabels
            ? "bg-white/12 text-white"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
        }`}
        title="Toggle Planet Labels"
      >
        <Tag className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Labels</span>
      </button>

      {/* Smooth Zoom Out / In */}
      {(onZoomIn || onZoomOut) && (
        <>
          <div className="hidden h-4 w-px bg-white/10 sm:block" />
          <div className="flex items-center gap-0.5">
            {onZoomOut && (
              <button
                type="button"
                onClick={onZoomOut}
                aria-label="Zoom out"
                title="Zoom Out (-)"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
            )}
            {onZoomIn && (
              <button
                type="button"
                onClick={onZoomIn}
                aria-label="Zoom in"
                title="Zoom In (+)"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Reset Camera */}
      <button
        type="button"
        onClick={onResetCamera}
        className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] text-slate-300 uppercase transition-all hover:bg-white/10 hover:text-white"
        title="Reset Camera to Heliocentric Overview (R)"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}
