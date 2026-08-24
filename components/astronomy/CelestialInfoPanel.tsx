"use client";

/**
 * CelestialInfoPanel — displays a list of celestial body positions.
 *
 * Shows Az/Alt for each tracked body, computed from the observer's location
 * and the current simulation time.  Bodies above the horizon are highlighted.
 *
 * Receives an array of CelestialBodyPosition from the parent (populated by
 * the Cesium tick callback).  No Cesium imports here.
 */

import { Star } from "lucide-react";
import { formatRa } from "@/lib/cesium/entityFactory";
import type { CelestialBodyPosition } from "@/lib/astronomy/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  positions: CelestialBodyPosition[];
  /** Optional: highlight this body id in the list. */
  selectedBodyId?: string | null;
  onSelectBody?: (id: string) => void;
};

// ── Colour badge map ───────────────────────────────────────────────────────────

const BODY_CSS_COLOR: Record<string, string> = {
  Sun:     "#FDB813",
  Moon:    "#C8C8C8",
  Mercury: "#B5B5B5",
  Venus:   "#E8C56C",
  Mars:    "#C1440E",
  Jupiter: "#C88B3A",
  Saturn:  "#E4D191",
  Uranus:  "#7DE8E8",
  Neptune: "#3F54BA",
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CelestialInfoPanel({
  positions,
  selectedBodyId,
  onSelectBody,
}: Props) {
  return (
    <aside
      className="
        flex flex-col bg-[#050c1a]/95 border-l border-[#1e3a5f]/50
        backdrop-blur-sm h-full overflow-y-auto min-w-[220px] max-w-[260px]
      "
      aria-label="Celestial body positions panel"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-[#1e3a5f]/40">
        <Star size={13} className="text-yellow-400" />
        <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">
          Sky Objects
        </span>
      </div>

      {/* ── Body list ───────────────────────────────────────────────────── */}
      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-8 text-center px-4">
          <p className="text-xs text-slate-500">
            Waiting for position data…
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[#1e3a5f]/20">
          {positions.map((pos) => (
            <BodyRow
              key={pos.id}
              pos={pos}
              isSelected={selectedBodyId === pos.id}
              onClick={onSelectBody ? () => onSelectBody(pos.id) : undefined}
            />
          ))}
        </ul>
      )}

      {/* ── Footer disclaimer ────────────────────────────────────────────── */}
      <p className="text-[9px] text-slate-600 leading-relaxed px-3 py-2 border-t border-[#1e3a5f]/30 mt-auto">
        ⚠️ Positions are visual approximations. Azimuth/Alt are astronomy-engine
        topocentric values. Refraction model: &quot;normal&quot;.
      </p>
    </aside>
  );
}

// ── Internal row ──────────────────────────────────────────────────────────────

function BodyRow({
  pos,
  isSelected,
  onClick,
}: {
  pos: CelestialBodyPosition;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const color = BODY_CSS_COLOR[pos.name] ?? "#ffffff";
  const altSign = pos.horizontal.altitudeDeg >= 0 ? "+" : "";

  return (
    <li>
      <button
        onClick={onClick}
        className={`
          w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors
          ${isSelected
            ? "bg-[#112240]"
            : "hover:bg-[#0a1628]"
          }
          ${!pos.isAboveHorizon ? "opacity-50" : ""}
        `}
        aria-pressed={isSelected}
        aria-label={`${pos.name} — altitude ${altSign}${pos.horizontal.altitudeDeg.toFixed(1)}°`}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Name + colour dot */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-slate-200">{pos.name}</span>
          </div>
          {/* Above/below horizon badge */}
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
              pos.isAboveHorizon
                ? "bg-green-900/60 text-green-400"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {pos.isAboveHorizon ? "ABOVE" : "BELOW"}
          </span>
        </div>

        {/* Az / Alt */}
        <div className="flex justify-between gap-2 pl-3.5">
          <span className="text-[9px] text-slate-500">
            Az {pos.horizontal.azimuthDeg.toFixed(1)}°
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            Alt {altSign}{pos.horizontal.altitudeDeg.toFixed(1)}°
          </span>
        </div>

        {/* RA / Dec */}
        <div className="flex justify-between gap-2 pl-3.5">
          <span className="text-[9px] text-slate-600">
            RA {formatRa(pos.equatorial.raHours)}
          </span>
          <span className="text-[9px] text-slate-600">
            Dec {pos.equatorial.decDeg.toFixed(1)}°
          </span>
        </div>
      </button>
    </li>
  );
}
