"use client";

/**
 * TrajectoryControlPanel — STEP 1: Input Parameters Configuration Deck.
 */

import React from "react";
import {
  LaunchSite,
  LaunchVehicle,
  MissionPreset,
} from "@/lib/trajectories/types";
import {
  MISSION_PRESETS,
  LAUNCH_SITES,
  LAUNCH_VEHICLES,
} from "@/lib/trajectories/missionPresets";
import {
  Rocket,
  Compass,
  Layers,
  Sparkles,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
} from "lucide-react";

interface TrajectoryControlPanelProps {
  selectedMission: MissionPreset;
  onSelectMission: (mission: MissionPreset) => void;
  selectedSite: LaunchSite;
  onSelectSite: (site: LaunchSite) => void;
  selectedVehicle: LaunchVehicle;
  onSelectVehicle: (vehicle: LaunchVehicle) => void;
  perigeeKm: number;
  setPerigeeKm: (val: number) => void;
  apogeeKm: number;
  setApogeeKm: (val: number) => void;
  inclinationDeg: number;
  setInclinationDeg: (val: number) => void;
  payloadKg: number;
  setPayloadKg: (val: number) => void;
  onRunAiOptimization: () => void;
  isAiOptimizing?: boolean;
}

export default function TrajectoryControlPanel({
  selectedMission,
  onSelectMission,
  selectedSite,
  onSelectSite,
  selectedVehicle,
  onSelectVehicle,
  perigeeKm,
  setPerigeeKm,
  apogeeKm,
  setApogeeKm,
  inclinationDeg,
  setInclinationDeg,
  payloadKg,
  setPayloadKg,
  onRunAiOptimization,
  isAiOptimizing = false,
}: TrajectoryControlPanelProps) {
  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* ── 1. Preset Mission Selector ────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Rocket className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              1.1 PILIH PROFIL MISI (TARGET ORBIT)
            </span>
          </div>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            {selectedMission.code}
          </span>
        </div>

        {/* Mission Grid Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
          {MISSION_PRESETS.map((preset) => {
            const isSelected = selectedMission.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  onSelectMission(preset);
                  setPerigeeKm(preset.targetPerigeeKm);
                  setApogeeKm(preset.targetApogeeKm);
                  setInclinationDeg(preset.targetInclinationDeg);
                  setPayloadKg(preset.defaultPayloadKg);

                  const matchingSite = LAUNCH_SITES.find((s) => s.id === preset.defaultLaunchSiteId);
                  if (matchingSite) onSelectSite(matchingSite);

                  const matchingVeh = LAUNCH_VEHICLES.find((v) => v.id === preset.defaultVehicleId);
                  if (matchingVeh) onSelectVehicle(matchingVeh);
                }}
                className={`p-2 rounded-xl text-left transition-all relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/20 border border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                    : "bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center justify-between text-[8px] mb-1">
                  <span className={`font-bold uppercase ${isSelected ? "text-cyan-300" : "text-slate-500"}`}>
                    {preset.id.replace("_", " ")}
                  </span>
                  {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />}
                </div>
                <div className="text-[10px] font-bold text-slate-200 truncate font-sans">
                  {preset.name.split("/")[0]}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[9px] text-slate-400 font-sans leading-relaxed">
          {selectedMission.summary}
        </p>
      </div>

      {/* ── 2. Spaceport Launch Site & Vehicle Selector ─────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              1.2 LOKASI PELUNCURAN &amp; ARMADA ROKET
            </span>
          </div>
          <span className="text-[8px] font-bold text-amber-400">VEHICLE</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[8px] text-slate-400 block uppercase mb-1">
              LOKASI KOSMODROM / KORIDOR PELUNCURAN:
            </label>
            <select
              value={selectedSite.id}
              onChange={(e) => {
                const site = LAUNCH_SITES.find((s) => s.id === e.target.value);
                if (site) onSelectSite(site);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-cyan-300 text-[10px] font-bold outline-none cursor-pointer"
            >
              {LAUNCH_SITES.map((site) => (
                <option key={site.id} value={site.id} className="bg-slate-900 text-white">
                  {site.name} ({site.latitude >= 0 ? `${site.latitude}°N` : `${Math.abs(site.latitude)}°S`})
                </option>
              ))}
            </select>
            <span className="text-[8px] text-slate-500 mt-1 block">
              {selectedSite.description}
            </span>
          </div>

          <div>
            <label className="text-[8px] text-slate-400 block uppercase mb-1">
              ROKET PELUNCUR (LAUNCH VEHICLE):
            </label>
            <select
              value={selectedVehicle.id}
              onChange={(e) => {
                const veh = LAUNCH_VEHICLES.find((v) => v.id === e.target.value);
                if (veh) onSelectVehicle(veh);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-emerald-300 text-[10px] font-bold outline-none cursor-pointer"
            >
              {LAUNCH_VEHICLES.map((veh) => (
                <option key={veh.id} value={veh.id} className="bg-slate-900 text-white">
                  {veh.name} • {veh.agency} (Kapasitas LEO: {(veh.maxPayloadLeoKg / 1000).toFixed(0)}t)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── 3. Orbital Parameters & Sliders ────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              1.3 KUSTOMISASI PARAMETER ORBIT &amp; MUATAN
            </span>
          </div>
          <span className="text-[8px] font-bold text-indigo-300">CUSTOM</span>
        </div>

        <div className="space-y-3 text-[9px]">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Ketinggian Perigee (h_p):</span>
              <strong className="text-cyan-300 font-mono">{perigeeKm.toLocaleString()} km</strong>
            </div>
            <input
              type="range"
              min="150"
              max="2000"
              step="10"
              value={perigeeKm}
              onChange={(e) => setPerigeeKm(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Ketinggian Apogee (h_a):</span>
              <strong className="text-amber-300 font-mono">{apogeeKm.toLocaleString()} km</strong>
            </div>
            <input
              type="range"
              min="200"
              max="384400"
              step="100"
              value={apogeeKm}
              onChange={(e) => setApogeeKm(Number(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Kemiringan Inklinasi (i):</span>
              <strong className="text-slate-200 font-mono">{inclinationDeg.toFixed(1)}°</strong>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              step="0.5"
              value={inclinationDeg}
              onChange={(e) => setInclinationDeg(Number(e.target.value))}
              className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Massa Muatan Satelit (Payload):</span>
              <strong className="text-emerald-300 font-mono">{payloadKg.toLocaleString()} kg</strong>
            </div>
            <input
              type="range"
              min="100"
              max={selectedVehicle.maxPayloadLeoKg}
              step="100"
              value={payloadKg}
              onChange={(e) => setPayloadKg(Number(e.target.value))}
              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ── 4. Trigger Calculation Button ─────────────────────────────────── */}
      <button
        onClick={onRunAiOptimization}
        disabled={isAiOptimizing}
        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-xs shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" />
        <span>
          {isAiOptimizing
            ? "SEDANG MENGHITUNG ALGORITMA FISIKA..."
            : "▶ PROSES ALGORITMA & KALKULASI ORBIT"}
        </span>
        <ArrowRight className="w-4 h-4 text-cyan-200" />
      </button>
    </div>
  );
}
