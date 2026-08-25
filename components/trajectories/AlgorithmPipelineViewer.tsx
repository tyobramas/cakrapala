"use client";

/**
 * AlgorithmPipelineViewer — Interactive Mathematical & ML Computing Pipeline.
 * Explicitly illustrates how User Inputs are transformed into Orbital Outputs.
 */

import React from "react";
import {
  AiOptimizationResult,
  LaunchSite,
  LaunchVehicle,
  MissionPreset,
} from "@/lib/trajectories/types";
import {
  ASTRO_CONSTANTS,
  calculateLaunchAzimuth,
  getKeplerianElementsFromAltitudes,
} from "@/lib/trajectories/orbitalPhysics";
import {
  Cpu,
  Orbit,
  Zap,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Flame,
  Activity,
  Layers,
} from "lucide-react";

interface AlgorithmPipelineViewerProps {
  mission: MissionPreset;
  launchSite: LaunchSite;
  vehicle: LaunchVehicle;
  perigeeKm: number;
  apogeeKm: number;
  inclinationDeg: number;
  payloadKg: number;
  aiResult: AiOptimizationResult | null;
}

export default function AlgorithmPipelineViewer({
  mission,
  launchSite,
  vehicle,
  perigeeKm,
  apogeeKm,
  inclinationDeg,
  payloadKg,
  aiResult,
}: AlgorithmPipelineViewerProps) {
  const kepler = getKeplerianElementsFromAltitudes(perigeeKm, apogeeKm, inclinationDeg);
  const azimuthData = calculateLaunchAzimuth(launchSite.latitude, inclinationDeg);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#080d1a]/95 border border-purple-500/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_30px_rgba(168,85,247,0.15)] font-mono select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">
                PROSES ALGORITMA &amp; ENGINE FISIKA ORBITAL
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                100% CONVERGED
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-sans">
              Menghitung transformasi dari Parameter Input menuju Hasil Output Vektor 3D &amp; Telemetri
            </p>
          </div>
        </div>

        <div className="text-[9px] text-purple-300 px-2 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 font-bold">
          4-STAGE COMPUTATION PIPELINE
        </div>
      </div>

      {/* 4-Stage Computing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Stage 1: Keplerian State Vector */}
        <div className="p-3 rounded-xl bg-[#030712]/90 border border-slate-800/80">
          <div className="flex items-center justify-between text-[9px] mb-1.5">
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <Orbit className="w-3.5 h-3.5" />
              TAHAP 1: PROPAGASI KEPLER 3D
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> SELESAI
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[8px] mb-2 font-mono text-cyan-300">
            Formula: r(&nu;) = a(1 - e&sup2;) / (1 + e&middot;cos &nu;)
          </div>

          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between text-slate-400">
              <span>Semi-major axis (a):</span>
              <strong className="text-white font-mono">{kepler.semiMajorAxisKm.toLocaleString()} km</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Eksentrisitas (e):</span>
              <strong className="text-amber-300 font-mono">{kepler.eccentricity.toFixed(4)}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Periode Orbit (T):</span>
              <strong className="text-cyan-300 font-mono">{kepler.periodMinutes.toFixed(1)} Menit</strong>
            </div>
          </div>
        </div>

        {/* Stage 2: Hohmann / 3-Body Lunar Transfer */}
        <div className="p-3 rounded-xl bg-[#030712]/90 border border-slate-800/80">
          <div className="flex items-center justify-between text-[9px] mb-1.5">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              TAHAP 2: HOHMANN &amp; 3-BODY RK4
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> SELESAI
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[8px] mb-2 font-mono text-amber-300">
            Formula: &Delta;v&#8321; = &radic;(&mu;/r&#8321;)[&radic;(2r&#8322;/(r&#8321;+r&#8322;)) - 1]
          </div>

          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between text-slate-400">
              <span>Burn 1 (Injeksi Transfer):</span>
              <strong className="text-amber-300 font-mono">
                +{aiResult ? aiResult.deltaVBreakdown.transferBurn1MS.toLocaleString() : 0} m/s
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Burn 2 (Sirkularisasi/Capture):</span>
              <strong className="text-emerald-300 font-mono">
                +{aiResult ? aiResult.deltaVBreakdown.transferBurn2MS.toLocaleString() : 0} m/s
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Waktu Tempuh (TOF):</span>
              <strong className="text-white font-mono">{aiResult ? aiResult.timeOfFlightFormatted : "1.5h"}</strong>
            </div>
          </div>
        </div>

        {/* Stage 3: Launch Azimuth & Earth Boost */}
        <div className="p-3 rounded-xl bg-[#030712]/90 border border-slate-800/80">
          <div className="flex items-center justify-between text-[9px] mb-1.5">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              TAHAP 3: AZIMUTH &amp; BOOST BUMI
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> SELESAI
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[8px] mb-2 font-mono text-emerald-300">
            Formula: sin &beta; = cos(i) / cos(&phi;), v_boost = &omega;_E&middot;R_E&middot;cos(&phi;)
          </div>

          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between text-slate-400">
              <span>Sudut Azimuth Peluncuran (&beta;):</span>
              <strong className="text-emerald-300 font-mono">{azimuthData.azimuthDeg}&deg;</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Rotasi Bumi (Free Delta-V):</span>
              <strong className="text-cyan-300 font-mono">+{azimuthData.earthRotationalBoostMS} m/s</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Kelayakan Langsung:</span>
              <strong className="text-white font-mono">
                {azimuthData.isAchievableDirectly ? "DIRECT CORRIDOR" : "DOGLEG REQUIRED"}
              </strong>
            </div>
          </div>
        </div>

        {/* Stage 4: Neural/Loss Integration */}
        <div className="p-3 rounded-xl bg-[#030712]/90 border border-slate-800/80">
          <div className="flex items-center justify-between text-[9px] mb-1.5">
            <span className="text-indigo-400 font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              TAHAP 4: OPTIMASI &Delta;v &amp; LOSSES
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> SELESAI
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[8px] mb-2 font-mono text-indigo-300">
            Formula: &Delta;v_total = &Delta;v_orb + &Delta;v_grav + &Delta;v_drag + &Delta;v_steer + margin
          </div>

          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between text-slate-400">
              <span>Total Kebutuhan &Delta;v:</span>
              <strong className="text-indigo-300 font-mono">
                {aiResult ? aiResult.totalDeltaVRequiredMS.toLocaleString() : 0} m/s
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Margin Muatan Roket:</span>
              <strong className="text-emerald-300 font-mono">
                +{aiResult ? aiResult.payloadCapacityMarginPercent : 0}%
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Skor Reliabilitas Sukses:</span>
              <strong className="text-cyan-300 font-mono">
                {aiResult ? aiResult.successProbabilityPercent : 0}%
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-emerald-500/10 border border-slate-700 text-[9px] text-slate-300 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Hasil kalkulasi algoritma telah disinkronkan ke <strong>Visualisasi 3D</strong> dan <strong>Panel Output Telemetri</strong> di bawah.</span>
        </span>
        <span className="text-emerald-400 font-bold hidden sm:inline">OUTPUT READY &rarr;</span>
      </div>
    </div>
  );
}
