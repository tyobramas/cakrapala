"use client";

/**
 * TelemetryHUD — STEP 3: Real-Time Avionics Flight Telemetry & Output Results.
 */

import React from "react";
import {
  AiOptimizationResult,
  FlightTelemetryState,
  LaunchSite,
} from "@/lib/trajectories/types";
import {
  Activity,
  Gauge,
  Compass,
  Flame,
  ShieldCheck,
  Zap,
  TrendingUp,
  Radio,
  CheckCircle2,
} from "lucide-react";

interface TelemetryHUDProps {
  telemetry: FlightTelemetryState | null;
  aiResult: AiOptimizationResult | null;
  launchSite: LaunchSite;
}

export default function TelemetryHUD({
  telemetry,
  aiResult,
  launchSite,
}: TelemetryHUDProps) {
  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* ── Output 1: Live Flight Telemetry ───────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              3.1 OUTPUT TELEMETRI WAHANA
            </span>
          </div>
          <span className="text-[8px] font-bold text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            {telemetry ? telemetry.formattedTime : "T+00:00:00"}
          </span>
        </div>

        {/* Current Flight Phase */}
        <div className="mb-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[8px] text-slate-500 block uppercase">STATUS FASE PENERBANGAN</span>
          <div className="flex items-center justify-between mt-0.5">
            <strong className="text-xs font-bold text-cyan-300">
              {telemetry ? telemetry.phase : "PRE-LAUNCH COUNTDOWN"}
            </strong>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              {telemetry ? telemetry.phaseCode : "T-0"}
            </span>
          </div>
        </div>

        {/* Telemetry Metric Grid */}
        <div className="grid grid-cols-2 gap-2 text-[9px]">
          <div className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60">
            <span className="text-[8px] text-slate-500 block uppercase">KECEPATAN (VELOCITY)</span>
            <strong className="text-xs font-bold text-white font-mono block mt-0.5">
              {telemetry ? telemetry.velocityKmS : "0.00"} <span className="text-[8px] text-slate-500">km/s</span>
            </strong>
            <span className="text-[8px] text-cyan-400">
              Mach {telemetry ? telemetry.machNumber : "0.0"} ({telemetry ? (telemetry.velocityKmS * 3600).toLocaleString() : 0} km/h)
            </span>
          </div>

          <div className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60">
            <span className="text-[8px] text-slate-500 block uppercase">KETINGGIAN (ALTITUDE)</span>
            <strong className="text-xs font-bold text-cyan-300 font-mono block mt-0.5">
              {telemetry ? telemetry.altitudeKm.toLocaleString() : "0"} <span className="text-[8px] text-slate-500">km</span>
            </strong>
            <span className="text-[8px] text-slate-400">
              Downrange: {telemetry ? `${telemetry.downrangeKm.toLocaleString()} km` : "0 km"}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60">
            <span className="text-[8px] text-slate-500 block uppercase">G-FORCE &amp; TEKANAN Q</span>
            <strong className="text-xs font-bold text-amber-300 font-mono block mt-0.5">
              {telemetry ? `${telemetry.gForce} G` : "1.0 G"}
            </strong>
            <span className="text-[8px] text-slate-400">
              Dynamic Q: {telemetry ? `${telemetry.dynamicPressureKPa} kPa` : "0 kPa"}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60">
            <span className="text-[8px] text-slate-500 block uppercase">SISA PROPELLANT</span>
            <strong className="text-xs font-bold text-emerald-400 font-mono block mt-0.5">
              {telemetry ? `${telemetry.propellantRemainingPercent}%` : "100%"}
            </strong>
            <span className="text-[8px] text-slate-400">
              Tangki Tingkat 1 &amp; 2
            </span>
          </div>
        </div>
      </div>

      {/* ── Output 2: AI Delta-V Budget ───────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              3.2 REKAPITULASI BUDGET &Delta;v
            </span>
          </div>
          <span className="text-[8px] font-bold text-indigo-300">
            TOTAL: {aiResult ? `${aiResult.totalDeltaVRequiredMS.toLocaleString()} m/s` : "9,420 m/s"}
          </span>
        </div>

        <div className="space-y-2 text-[8px]">
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Kecepatan Injeksi Orbit:</span>
              <strong className="text-cyan-300 font-mono">
                {aiResult ? `${aiResult.deltaVBreakdown.ascentOrbitalMS.toLocaleString()} m/s` : "7,780 m/s"}
              </strong>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full" style={{ width: "75%" }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Gravity Losses (Ascent):</span>
              <strong className="text-amber-300 font-mono">
                +{aiResult ? `${aiResult.deltaVBreakdown.gravityLossMS} m/s` : "+1,120 m/s"}
              </strong>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: "12%" }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Gesekan Atmosfer (Drag Loss):</span>
              <strong className="text-rose-300 font-mono">
                +{aiResult ? `${aiResult.deltaVBreakdown.atmosphericDragLossMS} m/s` : "+180 m/s"}
              </strong>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 rounded-full" style={{ width: "4%" }} />
            </div>
          </div>

          {aiResult && aiResult.deltaVBreakdown.transferBurn1MS > 0 && (
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Manuver Transfer / TLI Burn:</span>
                <strong className="text-purple-300 font-mono">
                  +{aiResult.deltaVBreakdown.transferBurn1MS.toLocaleString()} m/s
                </strong>
              </div>
              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full" style={{ width: "32%" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Output 3: Azimuth & Mission Reliability ───────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              3.3 AZIMUTH &amp; RELIABILITAS MISI
            </span>
          </div>
          <span className="text-[8px] font-bold text-emerald-400">
            {aiResult ? `${aiResult.successProbabilityPercent}%` : "98.5%"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[9px]">
          <div className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60">
            <span className="text-[8px] text-slate-500 block uppercase">SUDUT AZIMUTH (&beta;)</span>
            <strong className="text-sm font-bold text-emerald-300 font-mono block mt-0.5">
              {aiResult ? `${aiResult.launchAzimuthDeg}°` : "90.0°"}
            </strong>
            <span className="text-[8px] text-slate-400">
              Arah kompas peluncuran
            </span>
          </div>

          <div className="p-2 rounded-xl bg-[#030712]/90 border border-slate-800/60">
            <span className="text-[8px] text-slate-500 block uppercase">WAKTU TEMPUH (TOF)</span>
            <strong className="text-sm font-bold text-white font-mono block mt-0.5">
              {aiResult ? aiResult.timeOfFlightFormatted : "1.5 Jam"}
            </strong>
            <span className="text-[8px] text-cyan-400">
              Hingga orbit target
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
