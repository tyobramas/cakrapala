"use client";

/**
 * SkyMapControls — toolbar for Cakrapala Milestone 3 sky map view.
 *
 * Controls:
 *   - Globe / Sky Dome mode toggle
 *   - Play / Pause
 *   - Speed multiplier
 *   - Reset to now
 *   - Show/hide stars
 *   - Show/hide constellations
 *   - Show/hide horizon
 *   - Show/hide labels
 *   - Camera: Observer, Globe overview
 */

import { Play, Pause, RotateCcw, Globe, Eye, EyeOff, MapPin, Moon, Sun } from "lucide-react";
import { CESIUM_SPEED_MULTIPLIERS, type CesiumSpeedMultiplier, type SkyRenderMode } from "@/lib/astronomy/types";

type Props = {
  renderMode: SkyRenderMode;
  isPaused: boolean;
  speedMultiplier: CesiumSpeedMultiplier;
  showStars: boolean;
  showConstellations: boolean;
  showHorizon: boolean;
  showLabels: boolean;
  onToggleRenderMode: () => void;
  onTogglePause: () => void;
  onSpeedChange: (speed: CesiumSpeedMultiplier) => void;
  onResetToNow: () => void;
  onToggleStars: () => void;
  onToggleConstellations: () => void;
  onToggleHorizon: () => void;
  onToggleLabels: () => void;
  onFlyToObserver: () => void;
  onFlyToGlobeOverview: () => void;
};

export default function SkyMapControls({
  renderMode,
  isPaused,
  speedMultiplier,
  showStars,
  showConstellations,
  showHorizon,
  showLabels,
  onToggleRenderMode,
  onTogglePause,
  onSpeedChange,
  onResetToNow,
  onToggleStars,
  onToggleConstellations,
  onToggleHorizon,
  onToggleLabels,
  onFlyToObserver,
  onFlyToGlobeOverview,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#050c1a]/90 border-t border-[#1e3a5f]/50 backdrop-blur-sm"
      role="toolbar"
      aria-label="Sky map controls"
    >
      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <button
        onClick={onToggleRenderMode}
        aria-label={renderMode === "globe" ? "Switch to Sky Dome mode" : "Switch to Globe mode"}
        title={renderMode === "globe" ? "Sky Dome" : "Globe"}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
          transition-colors min-h-[36px]
          ${renderMode === "sky-dome"
            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
            : "bg-[#112240] hover:bg-[#1a3560] text-slate-200 border border-[#1e3a5f]"
          }
        `}
      >
        {renderMode === "globe" ? <Moon size={14} /> : <Globe size={14} />}
        <span>{renderMode === "globe" ? "Sky Dome" : "Globe"}</span>
      </button>

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
        <label htmlFor="sky-speed" className="text-xs text-slate-400 whitespace-nowrap">
          Speed
        </label>
        <select
          id="sky-speed"
          value={speedMultiplier}
          onChange={(e) => onSpeedChange(Number(e.target.value) as CesiumSpeedMultiplier)}
          aria-label="Simulation speed multiplier"
          className="bg-[#112240] text-slate-200 text-xs rounded px-2 py-1.5 border border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[36px] cursor-pointer"
        >
          {CESIUM_SPEED_MULTIPLIERS.map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>

      {/* ── Reset to now ─────────────────────────────────────────────────── */}
      <button
        onClick={onResetToNow}
        aria-label="Reset simulation to current real time"
        title="Reset to Now"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-transparent hover:bg-[#112240] text-slate-400 border border-[#1e3a5f] transition-colors min-h-[36px]"
      >
        <RotateCcw size={14} />
        <span>Now</span>
      </button>

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="w-px h-6 bg-[#1e3a5f]" aria-hidden="true" />

      {/* ── Stars toggle ─────────────────────────────────────────────────── */}
      <ToggleButton
        active={showStars}
        label={showStars ? "Hide stars" : "Show stars"}
        icon={<Sun size={14} />}
        text="Stars"
        onClick={onToggleStars}
      />

      {/* ── Constellations toggle ─────────────────────────────────────────── */}
      <ToggleButton
        active={showConstellations}
        label={showConstellations ? "Hide constellations" : "Show constellations"}
        icon={showConstellations ? <Eye size={14} /> : <EyeOff size={14} />}
        text="Constellations"
        onClick={onToggleConstellations}
      />

      {/* ── Horizon toggle ────────────────────────────────────────────────── */}
      <ToggleButton
        active={showHorizon}
        label={showHorizon ? "Hide horizon" : "Show horizon"}
        icon={showHorizon ? <Eye size={14} /> : <EyeOff size={14} />}
        text="Horizon"
        onClick={onToggleHorizon}
      />

      {/* ── Labels toggle ────────────────────────────────────────────────── */}
      <ToggleButton
        active={showLabels}
        label={showLabels ? "Hide labels" : "Show labels"}
        icon={showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
        text="Labels"
        onClick={onToggleLabels}
      />

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="w-px h-6 bg-[#1e3a5f]" aria-hidden="true" />

      {/* ── Camera controls ───────────────────────────────────────────────── */}
      <button
        onClick={onFlyToObserver}
        aria-label="Fly to observer location"
        title="Observer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#112240] hover:bg-[#1a3560] text-slate-200 border border-[#1e3a5f] transition-colors min-h-[36px]"
      >
        <MapPin size={14} />
        <span>Observer</span>
      </button>

      <button
        onClick={onFlyToGlobeOverview}
        aria-label="Globe overview"
        title="Globe"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-transparent hover:bg-[#112240] text-slate-400 border border-[#1e3a5f] transition-colors min-h-[36px]"
      >
        <Globe size={14} />
        <span>Globe</span>
      </button>
    </div>
  );
}

// ── Internal helper ───────────────────────────────────────────────────────────

function ToggleButton({
  active,
  label,
  icon,
  text,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
        transition-colors min-h-[36px]
        ${active
          ? "bg-[#112240] hover:bg-[#1a3560] text-blue-300 border border-[#1e3a5f]"
          : "bg-transparent hover:bg-[#112240] text-slate-500 border border-[#1e3a5f]"
        }
      `}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}
