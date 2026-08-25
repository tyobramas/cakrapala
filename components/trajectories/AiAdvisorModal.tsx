"use client";

/**
 * AiAdvisorModal — Deep Space AI Flight Director Analysis Modal.
 */

import React from "react";
import { AiOptimizationResult, LaunchSite, LaunchVehicle, MissionPreset } from "@/lib/trajectories/types";
import {
  Sparkles,
  X,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Cpu,
  Orbit,
  Zap,
} from "lucide-react";

interface AiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiResult: AiOptimizationResult | null;
  mission: MissionPreset;
  launchSite: LaunchSite;
  vehicle: LaunchVehicle;
}

export default function AiAdvisorModal({
  isOpen,
  onClose,
  aiResult,
  mission,
  launchSite,
  vehicle,
}: AiAdvisorModalProps) {
  if (!isOpen || !aiResult) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-mono">
      <div className="relative w-full max-w-3xl rounded-3xl bg-[#060b18]/95 border border-cyan-500/50 shadow-[0_16px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(6,182,212,0.2)] p-5 sm:p-6 text-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">
                  AI FLIGHT DIRECTOR BRIEFING
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  RELIABILITY {aiResult.successProbabilityPercent}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Algorithmic Trajectory Synthesis • Astrodynamic Flight Analysis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Executive Summary */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 mb-4 text-xs font-sans leading-relaxed">
          <strong className="text-cyan-300 font-mono text-[10px] block uppercase mb-1">
            EXECUTIVE FLIGHT REPORT
          </strong>
          {aiResult.aiFlightDirectorAnalysis}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[10px]">
          <div className="p-2.5 rounded-xl bg-[#030712]/90 border border-slate-800">
            <span className="text-[8px] text-slate-500 block uppercase">TOTAL MISSION Δv</span>
            <strong className="text-sm font-bold text-white font-mono block mt-0.5">
              {aiResult.totalDeltaVRequiredMS.toLocaleString()} m/s
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-[#030712]/90 border border-slate-800">
            <span className="text-[8px] text-slate-500 block uppercase">LAUNCH AZIMUTH</span>
            <strong className="text-sm font-bold text-emerald-400 font-mono block mt-0.5">
              {aiResult.launchAzimuthDeg}°
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-[#030712]/90 border border-slate-800">
            <span className="text-[8px] text-slate-500 block uppercase">TIME OF FLIGHT</span>
            <strong className="text-sm font-bold text-cyan-300 font-mono block mt-0.5">
              {aiResult.timeOfFlightFormatted}
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-[#030712]/90 border border-slate-800">
            <span className="text-[8px] text-slate-500 block uppercase">PAYLOAD MARGIN</span>
            <strong className="text-sm font-bold text-amber-300 font-mono block mt-0.5">
              +{aiResult.payloadCapacityMarginPercent}%
            </strong>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-4">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
            AI OPTIMIZATION RECOMMENDATIONS
          </span>
          <div className="space-y-2">
            {aiResult.recommendations.map((rec, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2 text-[10px] font-sans"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Factors */}
        <div className="mb-4">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
            MISSION RISK MATRIX
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {aiResult.riskFactors.map((r, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[9px]"
              >
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-white font-sans text-[10px]">{r.name}</strong>
                  <span
                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                      r.level === "LOW"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {r.level}
                  </span>
                </div>
                <p className="text-slate-400 font-sans">{r.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-bold text-xs transition-all cursor-pointer"
        >
          ACKNOWLEDGE & CLOSE BRIEFING
        </button>
      </div>
    </div>
  );
}
