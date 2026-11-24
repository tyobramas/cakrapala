"use client";

import React, { useState } from "react";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import { Maximize2, X } from "lucide-react";

export interface Landmark {
  id: string;
  m: number;
  label: string;
  shortLabel: string;
}

export const LANDMARKS: readonly Landmark[] = [
  { id: "bus", m: 12, label: "City Bus", shortLabel: "12m Bus" },
  { id: "747", m: 76, label: "Boeing 747", shortLabel: "76m 747" },
  { id: "monas", m: 132, label: "Monas", shortLabel: "132m Monas" },
  { id: "eiffel", m: 330, label: "Eiffel Tower", shortLabel: "330m Eiffel" },
  { id: "empire", m: 443, label: "Empire State", shortLabel: "443m Empire" },
  { id: "burj", m: 828, label: "Burj Khalifa", shortLabel: "828m Burj" },
] as const;

const MIN_M = 5;
const MAX_M = 2000;

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
  onOpenInspector?: () => void;
}

export default function ScaleRuler({
  selectedAsteroid,
  selectedLandmark,
  onSelectLandmark,
  onOpenInspector,
}: ScaleRulerProps) {
  const [hoveredLandmark, setHoveredLandmark] = useState<Landmark | null>(null);

  const minM = Math.round(
    selectedAsteroid?.estimated_diameter?.meters?.estimated_diameter_min ||
      (selectedAsteroid?.avg_diameter_meters ? selectedAsteroid.avg_diameter_meters * 0.75 : 24),
  );
  const maxM = Math.round(
    selectedAsteroid?.estimated_diameter?.meters?.estimated_diameter_max ||
      (selectedAsteroid?.avg_diameter_meters ? selectedAsteroid.avg_diameter_meters * 1.35 : 54),
  );
  const avgM = Math.round(selectedAsteroid?.avg_diameter_meters || (minM + maxM) / 2);

  const leftPct = toPercent(minM);
  const rightPct = toPercent(maxM);
  const widthPct = Math.max(2, rightPct - leftPct);

  const isHazard = Boolean(selectedAsteroid?.is_potentially_hazardous_asteroid);
  const activeCompare = hoveredLandmark || selectedLandmark;
  const ratio = activeCompare && avgM ? (avgM / activeCompare.m).toFixed(1) : null;

  const DECADES = [
    { m: 10, label: "10m" },
    { m: 100, label: "100m" },
    { m: 1000, label: "1km" },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.10] bg-[#030714]/75 px-3.5 py-2.5 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
      {/* Compact Header Row: Target Identity + Live Ratio + Quick 3D Inspect */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              isHazard
                ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.85)]"
                : "bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.75)]"
            }`}
          />
          <span className="truncate font-semibold text-white">
            {selectedAsteroid ? selectedAsteroid.name : "Select NEO Target"}
          </span>
          {selectedAsteroid && (
            <span className="hidden text-slate-400 tabular-nums sm:inline">
              {minM}–{maxM} m
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCompare && selectedAsteroid ? (
            <span className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <span>
                ≈ <strong className="text-sky-300">{ratio}×</strong> {activeCompare.label}
              </span>
              {selectedLandmark && (
                <button
                  type="button"
                  onClick={() => onSelectLandmark(null)}
                  className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-white/[0.08] text-slate-400 hover:bg-white/[0.16] hover:text-white"
                  title="Clear 3D landmark silhouette"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ) : (
            <span className="hidden text-[9px] tracking-[0.12em] text-slate-500 uppercase md:inline">
              Click landmark for 3D scale
            </span>
          )}

          {selectedAsteroid && onOpenInspector && (
            <button
              type="button"
              onClick={onOpenInspector}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/12 px-2.5 py-0.5 text-[9.5px] font-medium tracking-[0.12em] text-sky-200 uppercase transition-all hover:border-sky-300/60 hover:bg-sky-400/20 hover:text-white"
            >
              <Maximize2 className="h-2.5 w-2.5" />
              <span>3D &amp; Impact Lab</span>
            </button>
          )}
        </div>
      </div>

      {/* Logarithmic Ruler Track (5m – 2km) */}
      <div className="relative h-9 w-full font-mono">
        {/* Hairline baseline */}
        <div className="absolute right-0 left-0 top-[21px] h-px bg-white/[0.12]" />

        {/* Decade Ticks */}
        {DECADES.map((dec) => (
          <div
            key={dec.m}
            className="pointer-events-none absolute top-[18px] flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${toPercent(dec.m)}%` }}
          >
            <div className="h-2 w-px bg-white/[0.22]" />
            <span className="mt-0.5 text-[8.5px] text-slate-500">{dec.label}</span>
          </div>
        ))}

        {/* Asteroid Diameter Uncertainty Band */}
        {selectedAsteroid && (
          <div
            className="pointer-events-none absolute top-[14px] h-[14px] rounded-full transition-all duration-200"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: isHazard
                ? "linear-gradient(90deg, rgba(244,63,94,0.35), rgba(251,113,133,0.55))"
                : "linear-gradient(90deg, rgba(56,189,248,0.28), rgba(125,211,252,0.52))",
              border: isHazard
                ? "1px solid rgba(251,113,133,0.8)"
                : "1px solid rgba(125,211,252,0.75)",
            }}
          />
        )}

        {/* Interactive Landmark Pins */}
        {LANDMARKS.map((lm) => {
          const isSelected = selectedLandmark?.id === lm.id;
          const isHovered = hoveredLandmark?.id === lm.id;
          return (
            <button
              key={lm.id}
              type="button"
              onClick={() => onSelectLandmark(isSelected ? null : lm)}
              onMouseEnter={() => setHoveredLandmark(lm)}
              onMouseLeave={() => setHoveredLandmark(null)}
              style={{ left: `${toPercent(lm.m)}%` }}
              title={`${lm.label} (${lm.m}m) — Project 3D comparison next to asteroid`}
              className="group absolute top-0 z-10 flex -translate-x-1/2 cursor-pointer flex-col items-center focus:outline-none"
            >
              <span
                className={`whitespace-nowrap text-[8.5px] transition-colors ${
                  isSelected
                    ? "font-semibold text-sky-300"
                    : isHovered
                      ? "text-white"
                      : "text-slate-400"
                }`}
              >
                {lm.shortLabel}
              </span>
              <span
                className={`mt-0.5 h-2 w-[1.5px] rounded-full transition-all ${
                  isSelected
                    ? "bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.9)]"
                    : isHovered
                      ? "bg-white/80"
                      : "bg-white/25"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
