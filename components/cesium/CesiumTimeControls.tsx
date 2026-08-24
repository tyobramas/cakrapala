"use client";

/**
 * CesiumTimeControls — simulation time control bar for the Cesium globe view.
 *
 * Provides:
 *   - Play / Pause toggle
 *   - Speed multiplier selector (1×, 10×, 100×, 1000×, 10000×)
 *   - Reset to current wall-clock time
 *
 * All state is lifted to the parent (GlobeExplorerLayout) via callbacks.
 * This component is pure UI — no Cesium imports.
 */

import { Play, Pause, RotateCcw } from "lucide-react";
import {
  CESIUM_SPEED_MULTIPLIERS,
  type CesiumSpeedMultiplier,
} from "@/lib/astronomy/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  isPaused: boolean;
  speedMultiplier: CesiumSpeedMultiplier;
  /** UTC time currently displayed by the simulation. */
  currentUtcDate: Date;
  /** IANA timezone for local time display. */
  observerTimezone: string;
  onTogglePause: () => void;
  onSpeedChange: (speed: CesiumSpeedMultiplier) => void;
  onResetToNow: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CesiumTimeControls({
  isPaused,
  speedMultiplier,
  currentUtcDate,
  observerTimezone,
  onTogglePause,
  onSpeedChange,
  onResetToNow,
}: Props) {
  // Format UTC display.
  const utcStr = currentUtcDate.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // Format local time.
  let localStr = utcStr;
  try {
    localStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: observerTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(currentUtcDate);
  } catch {
    localStr = utcStr;
  }

  return (
    <div
      className="
        flex flex-wrap items-center justify-center gap-2 px-4 py-2
        bg-[#050c1a]/90 border-t border-[#1e3a5f]/50 backdrop-blur-sm
      "
      role="toolbar"
      aria-label="Simulation time controls"
    >
      {/* ── Play / Pause ─────────────────────────────────────────────────── */}
      <button
        onClick={onTogglePause}
        aria-label={isPaused ? "Resume simulation" : "Pause simulation"}
        aria-pressed={!isPaused}
        title={isPaused ? "Resume" : "Pause"}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
          transition-colors min-h-[36px]
          ${isPaused
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-[#112240] hover:bg-[#1a3560] text-slate-200"
          }
        `}
      >
        {isPaused ? <Play size={14} /> : <Pause size={14} />}
        <span>{isPaused ? "Resume" : "Pause"}</span>
      </button>

      {/* ── Speed ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="cesium-speed"
          className="text-xs text-slate-400 whitespace-nowrap"
        >
          Speed
        </label>
        <select
          id="cesium-speed"
          value={speedMultiplier}
          onChange={(e) =>
            onSpeedChange(Number(e.target.value) as CesiumSpeedMultiplier)
          }
          aria-label="Simulation speed multiplier"
          className="
            bg-[#112240] text-slate-200 text-xs rounded px-2 py-1.5
            border border-[#1e3a5f] focus:outline-none focus:ring-1
            focus:ring-blue-400 min-h-[36px] cursor-pointer
          "
        >
          {CESIUM_SPEED_MULTIPLIERS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>

      {/* ── Reset to now ─────────────────────────────────────────────────── */}
      <button
        onClick={onResetToNow}
        aria-label="Reset simulation to current real time"
        title="Reset to now"
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
          bg-transparent hover:bg-[#112240] text-slate-400 border border-[#1e3a5f]
          transition-colors min-h-[36px]
        "
      >
        <RotateCcw size={14} />
        <span>Reset to Now</span>
      </button>

      {/* ── Time display ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-end ml-auto text-right">
        <span className="font-mono text-[10px] text-blue-300">{utcStr}</span>
        <span className="font-mono text-[10px] text-slate-500">
          {localStr} ({observerTimezone})
        </span>
      </div>
    </div>
  );
}
