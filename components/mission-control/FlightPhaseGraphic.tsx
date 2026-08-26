"use client";

import React from "react";
import type { MissionType, MissionCandidate } from "@/lib/mission-control/types";
import { Zap, Route, ShieldCheck, Compass, Activity, ArrowRight } from "lucide-react";

interface FlightPhaseGraphicProps {
  missionType: MissionType;
  candidate: MissionCandidate;
  routeExplanation?: string[];
}

interface ParsedPhase {
  title: string;
  colorName: string;
  hex: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
  description: string;
  durationPercent: number;
}

export default function FlightPhaseGraphic({
  missionType,
  candidate,
  routeExplanation = [],
}: FlightPhaseGraphicProps) {
  // Parse phase explanations or fallback to default phases
  const phases: ParsedPhase[] = React.useMemo(() => {
    if (missionType === "lunar_free_return") {
      const defaultLunarPhases: ParsedPhase[] = [
        {
          title: "Outbound TLI Transfer",
          colorName: "Orange",
          hex: "#f97316",
          bgHex: "rgba(249, 115, 22, 0.12)",
          borderHex: "rgba(249, 115, 22, 0.35)",
          textHex: "text-orange-400",
          description:
            "Trans-Lunar Injection burn departing low Earth parking orbit on a prograde transfer ellipse toward the Moon.",
          durationPercent: 55,
        },
        {
          title: "Lunar Perilune Flyby",
          colorName: "Violet",
          hex: "#c084fc",
          bgHex: "rgba(192, 132, 252, 0.12)",
          borderHex: "rgba(192, 132, 252, 0.35)",
          textHex: "text-purple-300",
          description: `Passive gravity-assist hyperbola swinging behind the Moon at ${candidate.periluneAltitudeKm || 200} km altitude.`,
          durationPercent: 15,
        },
        {
          title: "Earth Free-Return Leg",
          colorName: "Blue",
          hex: "#38bdf8",
          bgHex: "rgba(56, 189, 248, 0.12)",
          borderHex: "rgba(56, 189, 248, 0.35)",
          textHex: "text-sky-400",
          description:
            "Deflected trajectory returning ballistically toward Earth's atmospheric entry interface (120 km).",
          durationPercent: 30,
        },
      ];

      if (routeExplanation.length > 0) {
        return routeExplanation.map((text, idx) => {
          const match = text.match(/^(.*?)\s*\((.*?)\):\s*(.*)$/);
          if (match) {
            const title = match[1].trim();
            const colorName = match[2].trim();
            const desc = match[3].trim();
            const fallback = defaultLunarPhases[idx] || defaultLunarPhases[0];
            return {
              title,
              colorName,
              hex: fallback.hex,
              bgHex: fallback.bgHex,
              borderHex: fallback.borderHex,
              textHex: fallback.textHex,
              description: desc,
              durationPercent: fallback.durationPercent,
            };
          }
          return defaultLunarPhases[idx] || defaultLunarPhases[0];
        });
      }
      return defaultLunarPhases;
    } else {
      // Satellite launch phases
      const defaultSatPhases: ParsedPhase[] = [
        {
          title: "Pad Liftoff & Ascent",
          colorName: "Red",
          hex: "#ef4444",
          bgHex: "rgba(239, 68, 68, 0.12)",
          borderHex: "rgba(239, 68, 68, 0.35)",
          textHex: "text-red-400",
          description:
            "Initial vertical liftoff from launch pad penetrating through the dense lower atmosphere.",
          durationPercent: 20,
        },
        {
          title: "Gravity Turn Pitch",
          colorName: "Amber",
          hex: "#f59e0b",
          bgHex: "rgba(245, 158, 11, 0.12)",
          borderHex: "rgba(245, 158, 11, 0.35)",
          textHex: "text-amber-400",
          description:
            "Pitch-over maneuver transitioning to horizontal velocity through upper atmosphere.",
          durationPercent: 45,
        },
        {
          title: "Circular Insertion Orbit",
          colorName: "Cyan",
          hex: "#06b6d4",
          bgHex: "rgba(6, 182, 212, 0.12)",
          borderHex: "rgba(6, 182, 212, 0.35)",
          textHex: "text-cyan-300",
          description:
            `Target circular orbit ring at ${candidate.trajectory?.[candidate.trajectory.length - 1]?.altitudeKm || 550} km altitude maintaining continuous orbital speed.`,
          durationPercent: 35,
        },
      ];

      if (routeExplanation.length > 0) {
        return routeExplanation.map((text, idx) => {
          const match = text.match(/^(.*?)\s*\((.*?)\):\s*(.*)$/);
          if (match) {
            const title = match[1].trim();
            const colorName = match[2].trim();
            const desc = match[3].trim();
            const fallback = defaultSatPhases[idx] || defaultSatPhases[0];
            return {
              title,
              colorName,
              hex: fallback.hex,
              bgHex: fallback.bgHex,
              borderHex: fallback.borderHex,
              textHex: fallback.textHex,
              description: desc,
              durationPercent: fallback.durationPercent,
            };
          }
          return defaultSatPhases[idx] || defaultSatPhases[0];
        });
      }
      return defaultSatPhases;
    }
  }, [missionType, candidate, routeExplanation]);

  return (
    <div className="space-y-3 font-mono">
      {/* ── Visual Multi-Phase Progression Bar ────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Route className="w-2.5 h-2.5 text-cyan-400" />
            Flight Phase Timeline Profile
          </span>
          <span className="text-slate-500 font-mono">
            {missionType === "lunar_free_return" ? "Earth ⇄ Moon Free Return" : "Launch ➔ Orbit Insertion"}
          </span>
        </div>

        {/* Horizontal Colored Phase Segment Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden flex gap-0.5 bg-slate-900/80 p-0.5 border border-slate-800">
          {phases.map((p, i) => (
            <div
              key={i}
              className="h-full rounded-sm transition-all duration-500 relative group"
              style={{
                width: `${p.durationPercent}%`,
                backgroundColor: p.hex,
                boxShadow: `0 0 8px ${p.hex}60`,
              }}
              title={`${p.title} (${p.colorName})`}
            />
          ))}
        </div>

        {/* Phase Color Badges Legend */}
        <div className="flex flex-wrap gap-2 text-[8px]">
          {phases.map((p, i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: p.hex, boxShadow: `0 0 4px ${p.hex}` }}
              />
              <span className={p.textHex}>{p.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Phase Detail Graphic Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-2 pt-1">
        {phases.map((p, i) => (
          <div
            key={i}
            className="p-2.5 rounded-xl border transition-all duration-300 relative overflow-hidden"
            style={{
              backgroundColor: p.bgHex,
              borderColor: p.borderHex,
            }}
          >
            {/* Top Accent Line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: p.hex }}
            />

            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.hex }}
                />
                <span className={`text-[10px] font-bold ${p.textHex}`}>{p.title}</span>
              </div>
              <span
                className="text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  backgroundColor: `${p.hex}25`,
                  color: p.hex,
                  border: `1px solid ${p.hex}50`,
                }}
              >
                {p.colorName} Trajectory
              </span>
            </div>

            <p className="text-[9px] text-slate-300/90 leading-relaxed font-sans pl-3.5">
              {p.description}
            </p>
          </div>
        ))}
      </div>

      {/* ── Altitude & Velocity Trajectory Sparkline Graphic ───────────────── */}
      <div className="p-2.5 rounded-xl bg-[#030712]/80 border border-slate-800/80 space-y-1.5">
        <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1 text-slate-400">
            <Activity className="w-2.5 h-2.5 text-cyan-400" />
            Altitude Geometry Graph
          </span>
          <span className="text-cyan-400 font-mono">
            {missionType === "lunar_free_return" ? "Max: ~384,400 km" : `Target: ${candidate.trajectory?.[candidate.trajectory.length - 1]?.altitudeKm || 550} km`}
          </span>
        </div>

        {/* SVG Curve Graph */}
        <div className="w-full h-12 relative flex items-center justify-center">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 300 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lunarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
                <stop offset="45%" stopColor="#f97316" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#c084fc" stopOpacity="1" />
                <stop offset="75%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="lunarFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="satGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="satFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid baseline */}
            <line x1="0" y1="44" x2="300" y2="44" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="0" y1="24" x2="300" y2="24" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />

            {missionType === "lunar_free_return" ? (
              <>
                {/* Free Return Arc */}
                <path
                  d="M 10 42 Q 100 4 165 10 Q 185 14 205 10 Q 260 20 290 42"
                  fill="none"
                  stroke="url(#lunarGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 42 Q 100 4 165 10 Q 185 14 205 10 Q 260 20 290 42 L 290 44 L 10 44 Z"
                  fill="url(#lunarFill)"
                />
                {/* Node Points */}
                <circle cx="10" cy="42" r="2.5" fill="#f97316" />
                <circle cx="185" cy="12" r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                <circle cx="290" cy="42" r="2.5" fill="#38bdf8" />
              </>
            ) : (
              <>
                {/* Satellite Ascent Curve */}
                <path
                  d="M 10 42 Q 40 40 80 26 Q 140 12 290 12"
                  fill="none"
                  stroke="url(#satGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 42 Q 40 40 80 26 Q 140 12 290 12 L 290 44 L 10 44 Z"
                  fill="url(#satFill)"
                />
                <circle cx="10" cy="42" r="2.5" fill="#ef4444" />
                <circle cx="80" cy="26" r="2.5" fill="#f59e0b" />
                <circle cx="290" cy="12" r="3" fill="#06b6d4" />
              </>
            )}
          </svg>
        </div>

        {/* Labels below graph */}
        <div className="flex justify-between text-[7px] text-slate-500 font-mono">
          <span>{missionType === "lunar_free_return" ? "LEO TLI (200km)" : "Pad Liftoff (0km)"}</span>
          <span className="text-purple-300 font-bold">
            {missionType === "lunar_free_return" ? "Moon Perilune (200km)" : "MECO Pitch (120km)"}
          </span>
          <span>{missionType === "lunar_free_return" ? "Reentry (120km)" : "Circular Orbit"}</span>
        </div>
      </div>
    </div>
  );
}
