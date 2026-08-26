"use client";

/**
 * MissionBriefPanel — Left panel: mission inputs and scenario presets.
 * Supports Scenario A (Satellite Launch Orbit) and Scenario B (Lunar Free Return).
 */

import React from "react";
import type {
  MissionType,
  OptimizationObjective,
  LaunchSite,
  VehiclePreset,
} from "@/lib/mission-control/types";
import { LAUNCH_SITES, VEHICLE_PRESETS } from "@/lib/mission-control/vehiclePresets";
import {
  Rocket,
  Moon,
  MapPin,
  Calendar,
  Weight,
  Target,
  Gauge,
  Play,
  Loader2,
  Zap,
  RotateCcw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface MissionBriefPanelProps {
  missionType: MissionType;
  onMissionTypeChange: (t: MissionType) => void;

  // Satellite inputs
  launchSite: LaunchSite;
  onLaunchSiteChange: (s: LaunchSite) => void;
  vehicle: VehiclePreset;
  onVehicleChange: (v: VehiclePreset) => void;
  launchDateUtc: string;
  onLaunchDateChange: (d: string) => void;
  payloadMassKg: number;
  onPayloadChange: (kg: number) => void;
  targetAltitudeKm: number;
  onAltitudeChange: (km: number) => void;
  targetInclinationDeg: number;
  onInclinationChange: (deg: number) => void;
  objective: OptimizationObjective;
  onObjectiveChange: (o: OptimizationObjective) => void;

  // Lunar inputs
  searchWindowHours: number;
  onSearchWindowChange: (h: number) => void;
  parkingOrbitAltitudeKm: number;
  onParkingAltChange: (km: number) => void;
  minFlightTimeHours: number;
  onMinFlightChange: (h: number) => void;
  maxFlightTimeHours: number;
  onMaxFlightChange: (h: number) => void;
  targetPeriluneAltitudeKm: number;
  onPeriluneChange: (km: number) => void;

  // Custom lat/lon for custom site
  customLat: number;
  onCustomLatChange: (v: number) => void;
  customLon: number;
  onCustomLonChange: (v: number) => void;

  // Actions
  onRunAnalysis: () => void;
  onLoadDefaultScenario: () => void;
  isAnalyzing: boolean;
}

const selectClass =
  "w-full p-2.5 rounded-lg bg-[#030712] border border-slate-700/60 text-slate-200 text-xs font-mono focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none appearance-none cursor-pointer";
const labelClass = "text-[9px] text-slate-500 uppercase tracking-wider font-bold block mb-1";
const inputClass =
  "w-full p-2.5 rounded-lg bg-[#030712] border border-slate-700/60 text-slate-200 text-xs font-mono focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none";

export default function MissionBriefPanel(props: MissionBriefPanelProps) {
  const {
    missionType,
    onMissionTypeChange,
    launchSite,
    onLaunchSiteChange,
    vehicle,
    onVehicleChange,
    launchDateUtc,
    onLaunchDateChange,
    payloadMassKg,
    onPayloadChange,
    targetAltitudeKm,
    onAltitudeChange,
    targetInclinationDeg,
    onInclinationChange,
    objective,
    onObjectiveChange,
    searchWindowHours,
    onSearchWindowChange,
    parkingOrbitAltitudeKm,
    onParkingAltChange,
    minFlightTimeHours,
    onMinFlightChange,
    maxFlightTimeHours,
    onMaxFlightChange,
    targetPeriluneAltitudeKm,
    onPeriluneChange,
    customLat,
    onCustomLatChange,
    customLon,
    onCustomLonChange,
    onRunAnalysis,
    onLoadDefaultScenario,
    isAnalyzing,
  } = props;

  return (
    <div className="flex flex-col gap-3 font-mono select-none h-full overflow-y-auto pr-1 custom-scrollbar">
      {/* ── Mission Type Tabs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#030712] border border-slate-800">
        <button
          onClick={() => onMissionTypeChange("satellite_launch")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            missionType === "satellite_launch"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          SATELLITE LAUNCH
        </button>
        <button
          onClick={() => onMissionTypeChange("lunar_free_return")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            missionType === "lunar_free_return"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.15)]"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          LUNAR FREE RETURN
          <span className="text-[7px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            EXP
          </span>
        </button>
      </div>

      {/* ── Default Scenario Banner ────────────────────────────────────────── */}
      <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-2 text-[9px]">
        <div className="flex items-center gap-1.5 text-cyan-300">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
          <span>Demonstration scenario loaded</span>
        </div>
        <button
          onClick={onLoadDefaultScenario}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40 transition-all cursor-pointer text-[8px]"
          title="Reset all fields to verified demonstration scenario"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          RESET DEFAULTS
        </button>
      </div>

      {/* ── Common Inputs ─────────────────────────────────────────────────── */}
      <div className="p-3 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-bold text-white uppercase">
            {missionType === "satellite_launch" ? "Launch Site & Vehicle" : "Departure & Vehicle"}
          </span>
        </div>

        {/* Launch Site */}
        <div>
          <label className={labelClass}>
            {missionType === "satellite_launch" ? "Launch Site" : "Departure Context"}
          </label>
          <select
            className={selectClass}
            value={launchSite.id}
            onChange={(e) => {
              const site = LAUNCH_SITES.find((s) => s.id === e.target.value);
              if (site) onLaunchSiteChange(site);
            }}
          >
            {LAUNCH_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.latitudeDeg}°)
              </option>
            ))}
          </select>
        </div>

        {/* Custom lat/lon */}
        {launchSite.id === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Latitude (°)</label>
              <input
                type="number"
                className={inputClass}
                value={customLat}
                onChange={(e) => onCustomLatChange(Number(e.target.value))}
                min={-90}
                max={90}
                step={0.1}
              />
            </div>
            <div>
              <label className={labelClass}>Longitude (°)</label>
              <input
                type="number"
                className={inputClass}
                value={customLon}
                onChange={(e) => onCustomLonChange(Number(e.target.value))}
                min={-180}
                max={180}
                step={0.1}
              />
            </div>
          </div>
        )}

        {/* Vehicle */}
        <div>
          <label className={labelClass}>Launch Vehicle</label>
          <select
            className={selectClass}
            value={vehicle.id}
            onChange={(e) => {
              const v = VEHICLE_PRESETS.find((vp) => vp.id === e.target.value);
              if (v) onVehicleChange(v);
            }}
          >
            {VEHICLE_PRESETS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (Payload: {v.payloadCapacityKg.toLocaleString()} kg)
              </option>
            ))}
          </select>
        </div>

        {/* Launch Date */}
        <div>
          <label className={labelClass}>
            {missionType === "satellite_launch" ? "Launch Date/Time (UTC)" : "Departure Date/Time (UTC)"}
          </label>
          <div className="relative">
            <input
              type="datetime-local"
              className={inputClass}
              value={launchDateUtc ? launchDateUtc.slice(0, 16) : ""}
              onChange={(e) => {
                if (e.target.value) {
                  onLaunchDateChange(new Date(e.target.value).toISOString());
                }
              }}
            />
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Payload mass */}
        <div>
          <label className={labelClass}>
            Payload Mass (kg) — Max: {vehicle.payloadCapacityKg.toLocaleString()} kg
          </label>
          <input
            type="number"
            className={inputClass}
            value={payloadMassKg}
            onChange={(e) => onPayloadChange(Math.max(0, Number(e.target.value)))}
            min={1}
            max={vehicle.payloadCapacityKg}
          />
        </div>
      </div>

      {/* ── Mode-Specific Inputs ──────────────────────────────────────────── */}
      {missionType === "satellite_launch" ? (
        <div className="p-3 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-white uppercase">Target Orbit</span>
          </div>

          {/* Altitude */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={labelClass}>Target Altitude (km) [160–2,000]</label>
              <span className="text-xs text-cyan-300 font-bold">{targetAltitudeKm} km</span>
            </div>
            <input
              type="range"
              min={160}
              max={2000}
              step={10}
              value={targetAltitudeKm}
              onChange={(e) => onAltitudeChange(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Inclination */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={labelClass}>Target Inclination (°) [0–98]</label>
              <span className="text-xs text-cyan-300 font-bold">{targetInclinationDeg}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={98}
              step={0.5}
              value={targetInclinationDeg}
              onChange={(e) => onInclinationChange(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
            <Target className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-bold text-white uppercase">Lunar Transfer Parameters</span>
          </div>

          {/* Search window */}
          <div>
            <label className={labelClass}>Search Window</label>
            <select
              className={selectClass}
              value={searchWindowHours}
              onChange={(e) => onSearchWindowChange(Number(e.target.value))}
            >
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={120}>120 hours</option>
              <option value={168}>7 days</option>
            </select>
          </div>

          {/* Parking orbit altitude */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={labelClass}>Parking Orbit Altitude (km) [160–500]</label>
              <span className="text-xs text-purple-300 font-bold">{parkingOrbitAltitudeKm} km</span>
            </div>
            <input
              type="range"
              min={160}
              max={500}
              step={10}
              value={parkingOrbitAltitudeKm}
              onChange={(e) => onParkingAltChange(Number(e.target.value))}
              className="w-full accent-purple-400"
            />
          </div>

          {/* Flight time range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Min Flight (hrs)</label>
              <input
                type="number"
                className={inputClass}
                value={minFlightTimeHours}
                onChange={(e) => onMinFlightChange(Number(e.target.value))}
                min={48}
                max={maxFlightTimeHours - 6}
              />
            </div>
            <div>
              <label className={labelClass}>Max Flight (hrs)</label>
              <input
                type="number"
                className={inputClass}
                value={maxFlightTimeHours}
                onChange={(e) => onMaxFlightChange(Number(e.target.value))}
                min={minFlightTimeHours + 6}
                max={240}
              />
            </div>
          </div>

          {/* Target perilune */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={labelClass}>Target Perilune Altitude (km) [100–10,000]</label>
              <span className="text-xs text-purple-300 font-bold">{targetPeriluneAltitudeKm} km</span>
            </div>
            <input
              type="range"
              min={100}
              max={10000}
              step={50}
              value={targetPeriluneAltitudeKm}
              onChange={(e) => onPeriluneChange(Number(e.target.value))}
              className="w-full accent-purple-400"
            />
          </div>
        </div>
      )}

      {/* ── Optimization Objective (Single Profile: Shortest Time) ────────── */}
      <div className="p-3 rounded-xl bg-[#080d1a]/90 border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold text-white uppercase">Optimization Objective</span>
          </div>
          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
            ACTIVE
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200">
          <div className="flex items-center gap-2">
            <Rocket className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <span className="text-[10px] font-bold block text-white">Fastest Feasible</span>
              <span className="text-[8px] text-amber-300/80 font-mono">Optimized for shortest flight time</span>
            </div>
          </div>
          <span className="text-[8px] text-amber-400 font-mono font-bold uppercase tracking-wider">
            Shortest Time
          </span>
        </div>
      </div>

      {/* ── Run Analysis Button ───────────────────────────────────────────── */}
      <button
        onClick={onRunAnalysis}
        disabled={isAnalyzing}
        className={`w-full py-3.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
          isAnalyzing
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : missionType === "satellite_launch"
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold shadow-cyan-500/25 active:scale-[0.98]"
              : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold shadow-purple-500/25 active:scale-[0.98]"
        }`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            <span>SOLVING ASTRODYNAMICS...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" />
            <span>RUN ANALYSIS</span>
          </>
        )}
      </button>
    </div>
  );
}
