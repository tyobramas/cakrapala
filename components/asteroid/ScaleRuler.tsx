"use client";

import React, { useState } from "react";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import { OPS, OPS_TYPE } from "@/lib/ui/opsTheme";
import { useOpsMode } from "@/lib/ui/opsMode";

export interface Landmark {
  id: string;
  m: number;
  label: string;
  shortLabel: string;
}

export const LANDMARKS: readonly Landmark[] = [
  { id: "bus", m: 12, label: "City bus", shortLabel: "12m Bus" },
  { id: "747", m: 76, label: "Boeing 747", shortLabel: "76m 747" },
  { id: "liberty", m: 93, label: "Statue of Liberty", shortLabel: "93m Liberty" },
  { id: "monas", m: 132, label: "Monas", shortLabel: "132m Monas" },
  { id: "eiffel", m: 330, label: "Eiffel Tower", shortLabel: "330m Eiffel" },
  { id: "empire", m: 443, label: "Empire State Bldg", shortLabel: "443m Empire" },
  { id: "burj", m: 828, label: "Burj Khalifa", shortLabel: "828m Burj" },
] as const;

const MIN_M = 5;
const MAX_M = 2000;

// Logarithmic scale mapping: 5 m -> 0%, 2000 m -> 100%
function toPercent(m: number): number {
  const clamped = Math.max(MIN_M, Math.min(MAX_M, m));
  return (
    ((Math.log10(clamped) - Math.log10(MIN_M)) /
      (Math.log10(MAX_M) - Math.log10(MIN_M))) *
    100
  );
}

interface ScaleRulerProps {
  selectedAsteroid: AsteroidNeoObject | null;
  selectedLandmark: Landmark | null;
  onSelectLandmark: (lm: Landmark | null) => void;
}

export default function ScaleRuler({
  selectedAsteroid,
  selectedLandmark,
  onSelectLandmark,
}: ScaleRulerProps) {
  const { isOps } = useOpsMode();
  const [hoveredLandmark, setHoveredLandmark] = useState<Landmark | null>(null);

  // Derive min/max/avg diameters from selected asteroid
  const minM = Math.round(
    selectedAsteroid?.estimated_diameter?.meters?.estimated_diameter_min ||
      (selectedAsteroid?.avg_diameter_meters ? selectedAsteroid.avg_diameter_meters * 0.75 : 24)
  );
  const maxM = Math.round(
    selectedAsteroid?.estimated_diameter?.meters?.estimated_diameter_max ||
      (selectedAsteroid?.avg_diameter_meters ? selectedAsteroid.avg_diameter_meters * 1.35 : 54)
  );
  const avgM = Math.round(selectedAsteroid?.avg_diameter_meters || (minM + maxM) / 2);

  const leftPct = toPercent(minM);
  const rightPct = toPercent(maxM);
  const widthPct = Math.max(1.5, rightPct - leftPct);

  const isHazard = selectedAsteroid?.is_potentially_hazardous_asteroid;
  const bandColor = isHazard ? OPS.hazard : OPS.caution;

  // Decade ticks & minor grid
  const DECADES = [
    { m: 10, label: "10 m" },
    { m: 100, label: "100 m" },
    { m: 1000, label: "1 km" },
  ];

  const MINOR_TICKS = [5, 20, 50, 200, 500, 2000];

  const activeCompare = hoveredLandmark || selectedLandmark;
  const ratio = activeCompare && avgM ? (avgM / activeCompare.m).toFixed(1) : null;

  return (
    <div
      className="w-full h-[74px] shrink-0 border-t flex flex-col justify-between px-3.5 py-1.5 select-none font-mono relative z-20"
      style={{
        background: OPS.panel,
        borderColor: OPS.line,
        color: OPS.text,
      }}
    >
      {/* ── Top Micro Header: Provenance & Live Ratio Telemetry ─────────────── */}
      <div className="flex items-center justify-between text-[9px] tracking-wider leading-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase" style={{ color: OPS.textDim }}>
            {isOps ? "DIAMETER UNCERTAINTY RULER" : "Physical Size Comparison"}
          </span>
          <span style={{ color: OPS.textFaint }}>[5 m – 2 km LOG SCALE]</span>
        </div>

        <div className="flex items-center gap-2">
          {activeCompare ? (
            <div className="flex items-center gap-1.5">
              <span style={{ color: OPS.text }}>
                {selectedAsteroid?.name || "TARGET"} ({avgM}m) ≈{" "}
                <span className="font-bold" style={{ color: OPS.accent }}>
                  {ratio}× {activeCompare.label}
                </span>{" "}
                ({activeCompare.m}m)
              </span>
              {selectedLandmark?.id === activeCompare.id && (
                <span
                  className="px-1 py-0.2 border text-[8px] font-bold"
                  style={{ borderColor: OPS.accent, color: OPS.accent }}
                >
                  3D BENCHMARK ACTIVE
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: OPS.textFaint }}>
              {selectedAsteroid ? (
                <>
                  BAND: <span style={{ color: OPS.text }}>{minM}–{maxM} m</span> (est. span ±
                  {Math.round(((maxM - minM) / (2 * avgM)) * 100)}%) · CLICK LANDMARK FOR 3D SILHOUETTE
                </>
              ) : (
                "SELECT ASTEROID TO INSPECT BAND"
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Ruler Strip ─────────────────────────────────────────────────── */}
      <div className="relative w-full h-[44px] flex items-center">
        {/* Horizontal Axis Baseline (1px) */}
        <div
          className="absolute left-0 right-0 top-[26px] h-[1px]"
          style={{ background: OPS.line }}
        />

        {/* Minor Ticks */}
        {MINOR_TICKS.map((m) => (
          <div
            key={m}
            className="absolute top-[23px] w-[1px] h-[6px]"
            style={{
              left: `${toPercent(m)}%`,
              background: "#1E2A35",
            }}
          />
        ))}

        {/* Decade Ticks with Text Labels Below Axis */}
        {DECADES.map((dec) => {
          const x = toPercent(dec.m);
          return (
            <div
              key={dec.m}
              className="absolute flex flex-col items-center -translate-x-1/2"
              style={{ left: `${x}%`, top: "20px" }}
            >
              <div className="w-[1px] h-[10px]" style={{ background: OPS.textFaint }} />
              <span className="text-[9px] mt-0.5" style={{ color: OPS.textFaint }}>
                {dec.label}
              </span>
            </div>
          );
        })}

        {/* ── Asteroid Uncertainty Band (160ms Smooth CSS Animation) ─────────── */}
        {selectedAsteroid && (
          <div
            className="absolute top-[8px] h-[18px] flex items-center justify-center pointer-events-none"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: isHazard ? "rgba(194, 74, 62, 0.35)" : "rgba(200, 149, 46, 0.35)",
              borderLeft: `2px solid ${bandColor}`,
              borderRight: `2px solid ${bandColor}`,
              borderTop: `1px solid ${bandColor}40`,
              borderBottom: `1px solid ${bandColor}40`,
              transition:
                "left 160ms cubic-bezier(0.2, 0, 0.4, 1), width 160ms cubic-bezier(0.2, 0, 0.4, 1)",
            }}
          >
            {/* Top End Caps */}
            <div
              className="absolute -top-1 left-0 w-[4px] h-[2px] -translate-x-[1px]"
              style={{ background: bandColor }}
            />
            <div
              className="absolute -top-1 right-0 w-[4px] h-[2px] translate-x-[1px]"
              style={{ background: bandColor }}
            />

            {/* Centered Band Estimation Label */}
            <span
              className="text-[9px] font-bold tracking-tight px-1 whitespace-nowrap drop-shadow-sm select-none"
              style={{ color: OPS.text }}
            >
              {minM}–{maxM} m (est.)
            </span>
          </div>
        )}

        {/* ── Landmark Ticks & Interactive Pins (Above Axis) ─────────────────── */}
        {LANDMARKS.map((lm) => {
          const x = toPercent(lm.m);
          const isSelected = selectedLandmark?.id === lm.id;
          const isHovered = hoveredLandmark?.id === lm.id;

          return (
            <button
              key={lm.id}
              onClick={() => onSelectLandmark(isSelected ? null : lm)}
              onMouseEnter={() => setHoveredLandmark(lm)}
              onMouseLeave={() => setHoveredLandmark(null)}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center cursor-pointer group focus:outline-none z-10"
              style={{ left: `${x}%` }}
              title={`${lm.label} (${lm.m}m) — Click to project 3D comparison`}
            >
              {/* Landmark Label */}
              <span
                className={`text-[8px] font-mono whitespace-nowrap transition-colors duration-[120ms] ${
                  isSelected
                    ? "font-bold text-[#5A8FB8]"
                    : isHovered
                    ? "text-[#C9D4DF]"
                    : "text-[#7C8B99]"
                }`}
              >
                {lm.shortLabel}
              </span>

              {/* 6px Vertical Landmark Tick connecting to Axis */}
              <div
                className="w-[1.5px] h-[7px] mt-0.5 transition-colors duration-[120ms]"
                style={{
                  background: isSelected
                    ? OPS.accent
                    : isHovered
                    ? OPS.text
                    : OPS.textFaint,
                  boxShadow: isSelected ? `0 0 6px ${OPS.accent}` : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
