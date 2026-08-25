"use client";

/**
 * FlightTimeline — Interactive Mission Milestones & Maneuver Burn Schedule.
 */

import React from "react";
import { ManeuverBurn } from "@/lib/trajectories/types";
import { CheckCircle2, Circle, Flame, ArrowRight, Clock } from "lucide-react";

interface FlightTimelineProps {
  burnSchedule: ManeuverBurn[];
  currentProgressPercent: number;
}

export default function FlightTimeline({
  burnSchedule,
  currentProgressPercent,
}: FlightTimelineProps) {
  const MILESTONES = [
    { title: "Liftoff & Stage 1 Ignition", time: "T-00:00:00", progressThreshold: 0.01, code: "IGNITION" },
    { title: "Max Dynamic Pressure (Max-Q)", time: "T+00:01:12", progressThreshold: 0.04, code: "MAX-Q" },
    { title: "Main Engine Cutoff (MECO)", time: "T+00:02:42", progressThreshold: 0.08, code: "MECO" },
    { title: "Stage 2 Second Engine Start (SES-1)", time: "T+00:02:50", progressThreshold: 0.12, code: "SES-1" },
    { title: "Parking Orbit Insertion (SECO-1)", time: "T+00:08:45", progressThreshold: 0.20, code: "SECO-1" },
    { title: "Transfer / TLI Injection Burn", time: "T+00:54:00", progressThreshold: 0.45, code: "TLI/GTO" },
    { title: "Lunar Gravity / Target Intercept", time: "T+72:00:00", progressThreshold: 0.75, code: "RENDEZVOUS" },
    { title: "Target Orbital Capture / Final Orbit", time: "T+76:30:00", progressThreshold: 0.95, code: "INSERTION" },
  ];

  return (
    <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg font-mono select-none">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-bold text-white tracking-wider uppercase">
            FLIGHT MILESTONES & BURNS
          </span>
        </div>
        <span className="text-[8px] font-bold text-cyan-400">
          PROGRESS: {currentProgressPercent}%
        </span>
      </div>

      {/* Milestone List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {MILESTONES.map((m, idx) => {
          const isPassed = currentProgressPercent / 100 >= m.progressThreshold;
          const isCurrent =
            currentProgressPercent / 100 >= m.progressThreshold - 0.04 &&
            currentProgressPercent / 100 < m.progressThreshold + 0.06;

          return (
            <div
              key={m.code}
              className={`p-2.5 rounded-xl border transition-all ${
                isCurrent
                  ? "bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                  : isPassed
                  ? "bg-slate-900/60 border-slate-700/80 text-slate-300"
                  : "bg-slate-950/40 border-slate-850 text-slate-500 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between text-[8px] mb-1">
                <span className="font-bold text-slate-400">{m.time}</span>
                <span
                  className={`px-1 rounded text-[7px] font-bold ${
                    isCurrent
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse"
                      : isPassed
                      ? "bg-slate-800 text-slate-400"
                      : "text-slate-600"
                  }`}
                >
                  {m.code}
                </span>
              </div>
              <div className="text-[9px] font-bold text-slate-200 truncate font-sans">
                {m.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Maneuver Burns Sub-strip */}
      {burnSchedule && burnSchedule.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <span className="text-[8px] text-slate-500 uppercase tracking-wider block mb-1.5">
            CALCULATED ROCKET ENGINE BURNS (Δv)
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {burnSchedule.map((b) => (
              <div
                key={b.id}
                className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60 flex items-center justify-between text-[8px]"
              >
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                  <div>
                    <strong className="text-white block font-sans text-[9px] truncate">
                      {b.name.split("(")[0]}
                    </strong>
                    <span className="text-slate-500">{b.description}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <strong className="text-cyan-300 font-mono text-[10px] block">
                    +{b.deltaVMS.toLocaleString()} m/s
                  </strong>
                  <span className="text-slate-500">{b.durationSec}s burn</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
