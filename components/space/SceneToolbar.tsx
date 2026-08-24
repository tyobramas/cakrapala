"use client";

/**
 * SceneToolbar — Cockpit Flight Simulation Controls Dock.
 */

import { Play, Pause, Eye, EyeOff, Tag, RotateCcw, Orbit, Layers } from "lucide-react";
import { SIMULATION_SPEEDS, type SimulationSpeed, type SimulationState } from "@/lib/astronomy/types";

type Props = {
  simulationState: SimulationState;
  onTogglePause: () => void;
  onSpeedChange: (speed: SimulationSpeed) => void;
  onToggleOrbits: () => void;
  onToggleLabels: () => void;
  onResetCamera: () => void;
};

export default function SceneToolbar({
  simulationState,
  onTogglePause,
  onSpeedChange,
  onToggleOrbits,
  onToggleLabels,
  onResetCamera,
}: Props) {
  const { isPaused, simulationSpeed, showOrbits, showLabels } = simulationState;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 p-2 rounded-[24px] bg-gradient-to-b from-[#182037]/90 to-[#0d1425]/95 border border-slate-700/60 shadow-[0_12px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl font-mono text-xs"
      role="toolbar"
      aria-label="3D Orrery Simulation controls"
    >
      {/* ── Play / Pause Button ────────────────────────────────────────────── */}
      <button
        onClick={onTogglePause}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
          isPaused
            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
        }`}
        title={isPaused ? "Resume Simulation" : "Pause Simulation"}
      >
        {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
        <span>{isPaused ? "RESUME" : "PAUSE"}</span>
      </button>

      {/* ── Simulation Speed Multiplier Selector ────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#060a14]/80 border border-slate-800">
        <span className="text-[10px] text-slate-400 font-bold uppercase">SPEED:</span>
        <div className="flex items-center gap-1">
          {SIMULATION_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                simulationSpeed === s
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}&times;
            </button>
          ))}
        </div>
      </div>

      <div className="h-5 w-px bg-slate-800 hidden sm:block" />

      {/* ── Toggle Orbit Trajectories ───────────────────────────────────────── */}
      <button
        onClick={onToggleOrbits}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
          showOrbits
            ? "bg-[#25324d] border-cyan-500/40 text-cyan-300 shadow-sm"
            : "bg-[#060a14]/80 border-slate-800 text-slate-400 hover:text-slate-200"
        }`}
        title="Toggle Keplerian Orbit Lines"
      >
        <Orbit className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">ORBITS</span>
      </button>

      {/* ── Toggle Planet Labels ────────────────────────────────────────────── */}
      <button
        onClick={onToggleLabels}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
          showLabels
            ? "bg-[#25324d] border-cyan-500/40 text-cyan-300 shadow-sm"
            : "bg-[#060a14]/80 border-slate-800 text-slate-400 hover:text-slate-200"
        }`}
        title="Toggle Planetary HUD Labels"
      >
        <Tag className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">LABELS</span>
      </button>

      {/* ── Reset Camera to Heliocentric View ───────────────────────────────── */}
      <button
        onClick={onResetCamera}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#060a14]/80 hover:bg-[#182037] border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all"
        title="Reset Camera to Heliocentric Solar System View"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">RESET CAM</span>
      </button>
    </div>
  );
}
