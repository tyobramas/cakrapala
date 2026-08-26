"use client";

/**
 * DecisionPanel — Right panel: Feasibility, Delta-V budget, Risk, and AI Mission Analysis.
 * Strictly verifies candidate validity before displaying positive feasibility states.
 * Features a high-tech Standby state when analysis has not yet been executed.
 */

import React, { useState } from "react";
import type {
  MissionCandidate,
  MissionAnalysisResult,
  MissionPostAnalysis,
  MissionType,
  VehiclePreset,
  LaunchSite,
} from "@/lib/mission-control/types";
import {
  formatDeltaV,
  formatDurationHours,
  formatDistanceKm,
} from "@/lib/mission-control/formatters";
import ModelLimitationsNotice from "./ModelLimitationsNotice";
import FlightPhaseGraphic from "./FlightPhaseGraphic";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Zap,
  Clock,
  Target,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  Route,
  Activity,
  Cpu,
  Play,
  Rocket,
  Globe,
  Radio,
  Layers,
} from "lucide-react";

interface DecisionPanelProps {
  result: MissionAnalysisResult | null;
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  postAnalysis?: MissionPostAnalysis | null;
  missionType?: MissionType;
  vehicle?: VehiclePreset;
  launchSite?: LaunchSite;
  payloadMassKg?: number;
  targetAltitudeKm?: number;
  targetPeriluneAltitudeKm?: number;
  launchDateUtc?: string;
  onRunAnalysis?: () => void;
  isAnalyzing?: boolean;
}

const FEASIBILITY_CONFIG = {
  feasible: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/50", label: "FEASIBLE" },
  marginal: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/50", label: "MARGINAL" },
  infeasible: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15 border-red-500/50", label: "INFEASIBLE" },
  no_solution: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15 border-red-500/50", label: "NO SOLUTION" },
};

const RISK_CONFIG = {
  low: { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "LOW RISK" },
  medium: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10", label: "MEDIUM RISK" },
  high: { icon: ShieldX, color: "text-red-400", bg: "bg-red-500/10", label: "HIGH RISK" },
};

export default function DecisionPanel({
  result,
  selectedCandidateId,
  onSelectCandidate,
  postAnalysis,
  missionType = "satellite_launch",
  vehicle,
  launchSite,
  payloadMassKg,
  targetAltitudeKm,
  targetPeriluneAltitudeKm,
  launchDateUtc,
  onRunAnalysis,
  isAnalyzing,
}: DecisionPanelProps) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(true);

  // ── Standby State (Before Running Analysis) ──────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col gap-3 font-mono select-none h-full overflow-y-auto pr-1 custom-scrollbar">
        {/* Standby Header Card */}
        <div className="p-4 rounded-xl bg-[#080d1a]/95 border border-cyan-500/30 text-center relative overflow-hidden shadow-xl">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <Radio className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-pulse" />
          <p className="text-xs font-bold text-cyan-300 tracking-wider uppercase">
            MISSION SOLVER // STANDBY
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Astrodynamics engines calibrated. Awaiting mission execution command.
          </p>
        </div>

        {/* Pre-Flight Brief Parameters Summary */}
        <div className="p-3.5 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-2.5 shadow-lg">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-white uppercase">
              Configured Mission Brief
            </span>
          </div>

          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Mission Profile:</span>
              <span className="text-cyan-300 font-bold">
                {missionType === "satellite_launch" ? "Satellite LEO Launch" : "Lunar Free-Return"}
              </span>
            </div>

            {vehicle && (
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle Class:</span>
                <span className="text-slate-200 font-medium truncate max-w-[150px]">{vehicle.name}</span>
              </div>
            )}

            {launchSite && (
              <div className="flex justify-between">
                <span className="text-slate-500">Launch Site:</span>
                <span className="text-slate-200 font-medium truncate max-w-[150px]">
                  {launchSite.name} ({launchSite.latitudeDeg.toFixed(1)}°)
                </span>
              </div>
            )}

            {payloadMassKg !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-500">Payload Mass:</span>
                <span className="text-slate-200 font-medium">{payloadMassKg.toLocaleString()} kg</span>
              </div>
            )}

            {missionType === "satellite_launch" && targetAltitudeKm !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-500">Target Altitude:</span>
                <span className="text-emerald-400 font-bold">{targetAltitudeKm} km</span>
              </div>
            )}

            {missionType === "lunar_free_return" && targetPeriluneAltitudeKm !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-500">Target Perilune:</span>
                <span className="text-purple-400 font-bold">{targetPeriluneAltitudeKm} km</span>
              </div>
            )}

            {launchDateUtc && (
              <div className="flex justify-between">
                <span className="text-slate-500">Departure (UTC):</span>
                <span className="text-slate-300">{new Date(launchDateUtc).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Engine Readiness Indicators */}
        <div className="p-3 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800/60">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-white uppercase">Physics Subsystems</span>
          </div>

          <div className="space-y-1 text-[9px]">
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/50 border border-slate-800/50">
              <span className="text-slate-400">Tsiolkovsky Δv Solver</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> READY
              </span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/50 border border-slate-800/50">
              <span className="text-slate-400">Atmospheric Drag / Gravity Loss</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> READY
              </span>
            </div>
            {missionType === "lunar_free_return" && (
              <>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/50 border border-slate-800/50">
                  <span className="text-slate-400">JPL Moon Ephemeris Propagator</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> ONLINE
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/50 border border-slate-800/50">
                  <span className="text-slate-400">Universal-Variable Lambert Solver</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> READY
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Prompt */}
        {onRunAnalysis && (
          <button
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            className="w-full py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>SOLVE TRAJECTORY (RUN ANALYSIS)</span>
          </button>
        )}

        <ModelLimitationsNotice compact />
      </div>
    );
  }

  // ── No Solutions Found ───────────────────────────────────────────────────
  if (result.candidates.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-1 font-mono">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-xs text-red-300 font-bold">NO FEASIBLE SOLUTION</p>
          <p className="text-[10px] text-red-300/70 mt-1">
            No feasible candidate found under the selected simplified model.
          </p>
        </div>
        {result.globalWarnings.map((w, i) => (
          <div key={i} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-300/80">
            {w}
          </div>
        ))}
        <ModelLimitationsNotice compact />
      </div>
    );
  }

  // ── Render Active Candidate Results ──────────────────────────────────────
  const selectedCandidate =
    result.candidates.find((c) => c.id === selectedCandidateId) ||
    result.candidates.find((c) => c.id === result.recommendedCandidateId) ||
    result.candidates[0];

  const fConf = FEASIBILITY_CONFIG[selectedCandidate.feasibility];
  const rConf = RISK_CONFIG[selectedCandidate.risk];
  const FIcon = fConf.icon;
  const RIcon = rConf.icon;

  return (
    <div className="flex flex-col gap-3 font-mono select-none h-full overflow-y-auto pr-1 custom-scrollbar">
      {/* ── Feasibility & Risk Badges ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-2">
        <div className={`p-3 rounded-xl border flex items-center justify-between ${fConf.bg}`}>
          <div className="flex items-center gap-2.5">
            <FIcon className={`w-5 h-5 ${fConf.color}`} />
            <div>
              <span className={`text-xs font-black tracking-wider ${fConf.color}`}>{fConf.label}</span>
              <p className="text-[9px] text-slate-400">{selectedCandidate.label}</p>
            </div>
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between ${rConf.bg}`}>
          <div className="flex items-center gap-2">
            <RIcon className={`w-4 h-4 ${rConf.color}`} />
            <span className={`text-[10px] font-bold ${rConf.color}`}>{rConf.label}</span>
          </div>
        </div>
      </div>

      {/* ── Delta-V Budget Breakdown ────────────────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-2.5">
        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-bold text-white uppercase">Delta-V Budget</span>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Available</span>
            <span className="font-bold text-white">{formatDeltaV(selectedCandidate.deltaV.availableMps)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Required</span>
            <span className="font-bold text-amber-300">{formatDeltaV(selectedCandidate.deltaV.requiredMps)}</span>
          </div>

          <div className="pt-1">
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  selectedCandidate.deltaV.marginMps >= 500
                    ? "bg-emerald-400"
                    : selectedCandidate.deltaV.marginMps >= 0
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      5,
                      (selectedCandidate.deltaV.availableMps /
                        (selectedCandidate.deltaV.requiredMps || 1)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="flex justify-between text-[11px] font-bold pt-1">
            <span className="text-slate-400">Margin</span>
            <span
              className={
                selectedCandidate.deltaV.marginMps >= 500
                  ? "text-emerald-400"
                  : selectedCandidate.deltaV.marginMps >= 0
                    ? "text-amber-400"
                    : "text-red-400"
              }
            >
              {selectedCandidate.deltaV.marginMps >= 0 ? "+" : ""}
              {formatDeltaV(selectedCandidate.deltaV.marginMps)}
            </span>
          </div>
        </div>

        {/* Delta-V Breakdown items */}
        {selectedCandidate.deltaV.components.length > 0 && (
          <div className="pt-2 border-t border-slate-800/60 space-y-1 text-[9px]">
            {selectedCandidate.deltaV.components.map((c, i) => (
              <div key={i} className="flex justify-between text-slate-500">
                <span>{c.label}</span>
                <span className={c.valueMps < 0 ? "text-emerald-400/80 font-bold" : "text-slate-300"}>
                  {c.valueMps > 0 ? "+" : ""}
                  {c.valueMps.toLocaleString()} m/s
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mission Summary ─────────────────────────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-2">
        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-bold text-white uppercase">Mission Summary</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[8px] text-slate-500 uppercase block">Departure</span>
            <span className="font-bold text-slate-200">
              {new Date(selectedCandidate.departureUtc).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="text-[8px] text-cyan-400 block font-mono">
              {new Date(selectedCandidate.departureUtc).toISOString().slice(11, 19)} UTC
            </span>
          </div>
          <div>
            <span className="text-[8px] text-slate-500 uppercase block">Duration</span>
            <span className="font-bold text-slate-200">
              {formatDurationHours(selectedCandidate.durationHours)}
            </span>
          </div>

          {selectedCandidate.closestMoonApproachUtc && (
            <div>
              <span className="text-[8px] text-slate-500 uppercase block">Moon Approach</span>
              <span className="font-bold text-purple-300">
                {new Date(selectedCandidate.closestMoonApproachUtc).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}

          {selectedCandidate.returnEarthUtc && (
            <div>
              <span className="text-[8px] text-slate-500 uppercase block">Earth Return</span>
              <span className="font-bold text-blue-300">
                {new Date(selectedCandidate.returnEarthUtc).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}

          {selectedCandidate.arrivalVInfinityMps !== undefined && (
            <div>
              <span className="text-[8px] text-slate-500 uppercase block">Arrival v∞</span>
              <span className="font-bold text-slate-300">
                {(selectedCandidate.arrivalVInfinityMps / 1000).toFixed(2)} km/s
              </span>
            </div>
          )}

          {selectedCandidate.periluneAltitudeKm !== undefined && (
            <div>
              <span className="text-[8px] text-slate-500 uppercase block">Perilune Alt</span>
              <span className="font-bold text-slate-300">
                {formatDistanceKm(selectedCandidate.periluneAltitudeKm)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── AI Mission Analysis (Grounded Synthesis) ────────────────────── */}
      <div className="p-3.5 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-white uppercase">AI Mission Analysis</span>
          </div>
          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            {postAnalysis?.generatedBy === "ai" ? "GEMINI AI" : "DETERMINISTIC"}
          </span>
        </div>

        {postAnalysis ? (
          <div className="space-y-3 text-[9px] leading-relaxed text-slate-300">
            <p className="font-bold text-cyan-200">{postAnalysis.headline || postAnalysis.summary}</p>
            
            {/* Visual Flight Phase & Trajectory Progression Graphic */}
            <FlightPhaseGraphic
              missionType={missionType}
              candidate={selectedCandidate}
              routeExplanation={postAnalysis.routeExplanation}
            />

            {postAnalysis.keyEvents && postAnalysis.keyEvents.length > 0 && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <span className="text-[8px] text-slate-500 font-bold uppercase block">Key Events (UTC):</span>
                {postAnalysis.keyEvents.map((evt, idx) => (
                  <div key={idx} className="flex justify-between text-slate-400">
                    <span className="text-cyan-300">{evt.label}</span>
                    <span className="font-mono text-slate-500">{new Date(evt.timestampUtc).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[9px] text-slate-500">Analysis generated from astrodynamic solver.</p>
        )}
      </div>

      {/* ── Assumptions & Limitations Accordion ─────────────────────────── */}
      <div className="rounded-xl border border-slate-800/80 bg-[#080d1a]/60 overflow-hidden">
        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          className="w-full p-2.5 flex items-center justify-between text-[9px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3 text-slate-500" />
            <span>Model Assumptions & Constraints ({selectedCandidate.assumptions.length})</span>
          </div>
          {showAssumptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showAssumptions && (
          <div className="p-3 border-t border-slate-800/60 space-y-1.5 text-[8px] text-slate-400">
            {selectedCandidate.assumptions.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-cyan-500 mt-0.5">•</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModelLimitationsNotice compact />
    </div>
  );
}
