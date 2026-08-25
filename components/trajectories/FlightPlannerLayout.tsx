"use client";

/**
 * FlightPlannerLayout — Sequential 3-Phase Trajectory Planner.
 *
 * Flow:
 *   Phase A: User sees ONLY the INPUT form (mission, site, vehicle, orbit params).
 *   Phase B: User clicks "PROSES ALGORITMA" → animated computing stages play.
 *   Phase C: OUTPUT reveals — 3D trajectory visualization + analytic telemetry.
 *
 * Output is HIDDEN until user triggers computation.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/landing/Navbar";
import TrajectoryControlPanel from "./TrajectoryControlPanel";
import AlgorithmPipelineViewer from "./AlgorithmPipelineViewer";
import TelemetryHUD from "./TelemetryHUD";
import FlightTimeline from "./FlightTimeline";
import AiAdvisorModal from "./AiAdvisorModal";
import {
  AiOptimizationResult,
  FlightTelemetryState,
  LaunchSite,
  LaunchVehicle,
  ManeuverBurn,
  MissionPreset,
} from "@/lib/trajectories/types";
import {
  MISSION_PRESETS,
  LAUNCH_SITES,
  LAUNCH_VEHICLES,
} from "@/lib/trajectories/missionPresets";
import { runAiTrajectoryOptimization } from "@/lib/trajectories/aiTrajectoryOptimizer";
import {
  Rocket,
  Cpu,
  Sparkles,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  Loader2,
  Zap,
  Target,
  Activity,
  Radio,
} from "lucide-react";

// Dynamic Three.js — only loaded when output is shown
const OrbitalTrajectory3D = dynamic(() => import("./OrbitalTrajectory3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center rounded-3xl border border-slate-800 bg-[#020617]">
      <div className="text-cyan-400/70 font-mono text-xs animate-pulse tracking-widest flex items-center gap-2">
        <Sparkles className="w-4 h-4 animate-spin" />
        MEMUAT ENGINE 3D VISUALISASI ORBIT...
      </div>
    </div>
  ),
});

// ── Processing Stage Animation Definition ─────────────────────────────────
const PROCESSING_STAGES = [
  {
    label: "Propagasi Kepler 3D",
    formula: "r(ν) = a(1 − e²) / (1 + e·cos ν)",
    color: "cyan",
    durationMs: 900,
  },
  {
    label: "Hohmann Transfer & 3-Body RK4",
    formula: "Δv₁ = √(μ/r₁)[√(2r₂/(r₁+r₂)) − 1]",
    color: "amber",
    durationMs: 1100,
  },
  {
    label: "Azimuth & Rotasi Bumi",
    formula: "sin β = cos(i) / cos(φ)",
    color: "emerald",
    durationMs: 800,
  },
  {
    label: "Optimasi Δv & Neural Loss",
    formula: "Δv_total = Δv_orb + Δv_grav + Δv_drag + margin",
    color: "purple",
    durationMs: 1000,
  },
];

type PhaseState = "INPUT" | "PROCESSING" | "OUTPUT";

export default function FlightPlannerLayout() {
  // ── Input State ──────────────────────────────────────────────────────────
  const [selectedMission, setSelectedMission] = useState<MissionPreset>(MISSION_PRESETS[0]);
  const [selectedSite, setSelectedSite] = useState<LaunchSite>(LAUNCH_SITES[0]);
  const [selectedVehicle, setSelectedVehicle] = useState<LaunchVehicle>(LAUNCH_VEHICLES[0]);
  const [perigeeKm, setPerigeeKm] = useState<number>(MISSION_PRESETS[0].targetPerigeeKm);
  const [apogeeKm, setApogeeKm] = useState<number>(MISSION_PRESETS[0].targetApogeeKm);
  const [inclinationDeg, setInclinationDeg] = useState<number>(MISSION_PRESETS[0].targetInclinationDeg);
  const [payloadKg, setPayloadKg] = useState<number>(MISSION_PRESETS[0].defaultPayloadKg);

  // ── Phase State ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<PhaseState>("INPUT");
  const [processingStageIndex, setProcessingStageIndex] = useState<number>(-1);

  // ── Output State ─────────────────────────────────────────────────────────
  const [aiResult, setAiResult] = useState<AiOptimizationResult | null>(null);
  const [burnSchedule, setBurnSchedule] = useState<ManeuverBurn[]>([]);
  const [telemetry, setTelemetry] = useState<FlightTelemetryState | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [showAlgorithmDetail, setShowAlgorithmDetail] = useState<boolean>(false);

  // Refs for scrolling
  const outputRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);

  // ── Execute Computation with Staged Animation ───────────────────────────
  const executeComputation = useCallback(() => {
    setPhase("PROCESSING");
    setProcessingStageIndex(0);
    setAiResult(null);
    setBurnSchedule([]);
    setTelemetry(null);

    // Scroll to process section
    setTimeout(() => {
      processRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    // Animate through each processing stage
    let totalDelay = 0;
    PROCESSING_STAGES.forEach((stage, idx) => {
      totalDelay += stage.durationMs;
      setTimeout(() => {
        setProcessingStageIndex(idx + 1);
      }, totalDelay);
    });

    // After all stages complete, compute actual result and show output
    setTimeout(() => {
      const { result, burnSchedule: burns } = runAiTrajectoryOptimization(
        selectedMission,
        selectedSite,
        selectedVehicle,
        payloadKg,
        perigeeKm,
        apogeeKm,
        inclinationDeg
      );
      setAiResult(result);
      setBurnSchedule(burns);
      setPhase("OUTPUT");

      // Scroll to output
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }, totalDelay + 600);
  }, [selectedMission, selectedSite, selectedVehicle, payloadKg, perigeeKm, apogeeKm, inclinationDeg]);

  // ── Reset to Input ──────────────────────────────────────────────────────
  const resetToInput = useCallback(() => {
    setPhase("INPUT");
    setProcessingStageIndex(-1);
    setAiResult(null);
    setBurnSchedule([]);
    setTelemetry(null);
    setShowAlgorithmDetail(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Helper: color classes by stage color name ───────────────────────────
  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    cyan:    { bg: "bg-cyan-500/15",    border: "border-cyan-500/50",    text: "text-cyan-300",    glow: "shadow-[0_0_20px_rgba(6,182,212,0.3)]" },
    amber:   { bg: "bg-amber-500/15",   border: "border-amber-500/50",   text: "text-amber-300",   glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]" },
    emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/50", text: "text-emerald-300", glow: "shadow-[0_0_20px_rgba(52,211,153,0.3)]" },
    purple:  { bg: "bg-purple-500/15",  border: "border-purple-500/50",  text: "text-purple-300",  glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]" },
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <div className="pt-20 pb-16 px-3 sm:px-4 lg:px-6 max-w-[1400px] mx-auto font-mono">

        {/* ╔══════════════════════════════════════════════════════════════════╗
            ║  PROGRESS INDICATOR STRIP                                      ║
            ╚══════════════════════════════════════════════════════════════════╝ */}
        <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-[#080d1a]/90 border border-slate-800 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs">
            {/* Step 1 */}
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold shrink-0 transition-all duration-500 ${
              phase === "INPUT"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-105"
                : "bg-cyan-500/10 text-cyan-300/60 border border-cyan-500/30"
            }`}>
              {phase !== "INPUT" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-black">1</span>
              )}
              <span>INPUT</span>
            </div>

            <ArrowRight className={`w-4 h-4 shrink-0 transition-colors duration-500 ${
              phase !== "INPUT" ? "text-cyan-400" : "text-slate-700"
            }`} />

            {/* Step 2 */}
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold shrink-0 transition-all duration-500 ${
              phase === "PROCESSING"
                ? "bg-purple-500/20 text-purple-300 border border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-105"
                : phase === "OUTPUT"
                  ? "bg-purple-500/10 text-purple-300/60 border border-purple-500/30"
                  : "bg-slate-900/60 text-slate-600 border border-slate-800"
            }`}>
              {phase === "PROCESSING" ? (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              ) : phase === "OUTPUT" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-black">2</span>
              )}
              <span>PROSES ALGORITMA</span>
            </div>

            <ArrowRight className={`w-4 h-4 shrink-0 transition-colors duration-500 ${
              phase === "OUTPUT" ? "text-emerald-400" : "text-slate-700"
            }`} />

            {/* Step 3 */}
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold shrink-0 transition-all duration-500 ${
              phase === "OUTPUT"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] scale-105"
                : "bg-slate-900/60 text-slate-600 border border-slate-800"
            }`}>
              {phase === "OUTPUT" ? (
                <Eye className="w-4 h-4 text-emerald-400" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-black">3</span>
              )}
              <span>OUTPUT</span>
            </div>
          </div>
        </div>


        {/* ╔══════════════════════════════════════════════════════════════════╗
            ║  SECTION 1: INPUT PARAMETERS  (always visible)                 ║
            ╚══════════════════════════════════════════════════════════════════╝ */}
        <div className="max-w-2xl mx-auto mb-8">
          {/* Section Title */}
          <div className="mb-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40">
              <Rocket className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
                STEP 1 — INPUT PARAMETER MISI
              </h2>
              <p className="text-[10px] text-slate-400 font-sans">
                Tentukan profil misi, lokasi peluncuran, roket, dan parameter orbit target Anda.
              </p>
            </div>
          </div>

          <TrajectoryControlPanel
            selectedMission={selectedMission}
            onSelectMission={setSelectedMission}
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            perigeeKm={perigeeKm}
            setPerigeeKm={setPerigeeKm}
            apogeeKm={apogeeKm}
            setApogeeKm={setApogeeKm}
            inclinationDeg={inclinationDeg}
            setInclinationDeg={setInclinationDeg}
            payloadKg={payloadKg}
            setPayloadKg={setPayloadKg}
            onRunAiOptimization={executeComputation}
            isAiOptimizing={phase === "PROCESSING"}
          />
        </div>


        {/* ╔══════════════════════════════════════════════════════════════════╗
            ║  SECTION 2: PROCESSING ANIMATION (visible during/after process)║
            ╚══════════════════════════════════════════════════════════════════╝ */}
        {(phase === "PROCESSING" || phase === "OUTPUT") && (
          <div ref={processRef} className="max-w-3xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Section Title */}
            <div className="mb-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl border transition-all duration-500 ${
                phase === "PROCESSING"
                  ? "bg-purple-500/20 border-purple-500/40"
                  : "bg-emerald-500/20 border-emerald-500/40"
              }`}>
                {phase === "PROCESSING" ? (
                  <Cpu className="w-5 h-5 text-purple-400 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
                  STEP 2 — PROSES ALGORITMA FISIKA ORBITAL
                </h2>
                <p className="text-[10px] text-slate-400 font-sans">
                  {phase === "PROCESSING"
                    ? "Menghitung transformasi parameter input menjadi vektor lintasan 3D..."
                    : "Semua tahap kalkulasi telah selesai. Output siap ditampilkan."}
                </p>
              </div>
            </div>

            {/* 4-Stage Pipeline Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROCESSING_STAGES.map((stage, idx) => {
                const isCompleted = processingStageIndex > idx;
                const isActive = processingStageIndex === idx;
                const isPending = processingStageIndex < idx;
                const colors = colorMap[stage.color];

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all duration-500 ${
                      isCompleted
                        ? `${colors.bg} ${colors.border} ${colors.glow}`
                        : isActive
                          ? `${colors.bg} ${colors.border} ${colors.glow} animate-pulse`
                          : "bg-slate-900/40 border-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] font-bold uppercase flex items-center gap-1.5 ${
                        isCompleted || isActive ? colors.text : "text-slate-600"
                      }`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${
                          isCompleted ? "bg-emerald-400 text-black" : isActive ? `${colors.bg} ${colors.text}` : "bg-slate-800 text-slate-600"
                        }`}>
                          {isCompleted ? "✓" : idx + 1}
                        </span>
                        TAHAP {idx + 1}: {stage.label}
                      </span>
                      {isActive && <Loader2 className={`w-3 h-3 animate-spin ${colors.text}`} />}
                      {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>

                    <div className={`p-2 rounded-lg border text-[8px] font-mono transition-all duration-300 ${
                      isCompleted || isActive
                        ? `bg-black/40 ${colors.border} ${colors.text}`
                        : "bg-slate-900/60 border-slate-800 text-slate-700"
                    }`}>
                      {stage.formula}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completion Banner */}
            {phase === "OUTPUT" && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-between animate-in fade-in duration-300">
                <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Kalkulasi 4-tahap selesai — Output ditampilkan di bawah
                </span>
                <button
                  onClick={() => setShowAlgorithmDetail(!showAlgorithmDetail)}
                  className="text-[9px] px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold hover:bg-purple-500/30 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3" />
                  {showAlgorithmDetail ? "SEMBUNYIKAN DETAIL" : "LIHAT DETAIL ALGORITMA"}
                </button>
              </div>
            )}

            {/* Expandable Detailed Algorithm View */}
            {showAlgorithmDetail && phase === "OUTPUT" && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlgorithmPipelineViewer
                  mission={selectedMission}
                  launchSite={selectedSite}
                  vehicle={selectedVehicle}
                  perigeeKm={perigeeKm}
                  apogeeKm={apogeeKm}
                  inclinationDeg={inclinationDeg}
                  payloadKg={payloadKg}
                  aiResult={aiResult}
                />
              </div>
            )}
          </div>
        )}


        {/* ╔══════════════════════════════════════════════════════════════════╗
            ║  SECTION 3: OUTPUT (only visible after computation completes)  ║
            ╚══════════════════════════════════════════════════════════════════╝ */}
        {phase === "OUTPUT" && aiResult && (
          <div ref={outputRef} className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Output Section Title */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
                    STEP 3 — OUTPUT HASIL KALKULASI
                  </h2>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Visualisasi lintasan orbit 3D, telemetri penerbangan, dan analisis Δv.
                  </p>
                </div>
              </div>

              <button
                onClick={resetToInput}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-500/50 text-[10px] font-bold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                HITUNG ULANG
              </button>
            </div>

            {/* Output Grid: 3D + Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
              {/* 3D Visualization — Main Output */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 backdrop-blur-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[11px] font-extrabold text-emerald-300 tracking-wider uppercase">
                      OUTPUT 3D — LINTASAN ORBIT {selectedMission.name.split("/")[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[8px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 font-bold">
                    LIVE SIMULATION
                  </span>
                </div>

                <OrbitalTrajectory3D
                  mission={selectedMission}
                  launchSite={selectedSite}
                  perigeeKm={perigeeKm}
                  apogeeKm={apogeeKm}
                  inclinationDeg={inclinationDeg}
                  onTelemetryUpdate={setTelemetry}
                />

                <FlightTimeline
                  burnSchedule={burnSchedule}
                  currentProgressPercent={telemetry ? telemetry.orbitProgressPercent : 0}
                />
              </div>

              {/* Telemetry & Analytics — Right Panel */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <TelemetryHUD
                  telemetry={telemetry}
                  aiResult={aiResult}
                  launchSite={selectedSite}
                />

                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="w-full p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>LAPORAN LENGKAP AI FLIGHT DIRECTOR</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ╔══════════════════════════════════════════════════════════════════╗
            ║  PLACEHOLDER when output not yet computed                      ║
            ╚══════════════════════════════════════════════════════════════════╝ */}
        {phase === "INPUT" && (
          <div className="max-w-2xl mx-auto mt-4">
            <div className="p-8 sm:p-12 rounded-2xl border-2 border-dashed border-slate-800 bg-[#080d1a]/50 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-4 rounded-full bg-slate-900/80 border border-slate-800">
                <EyeOff className="w-8 h-8 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Output Belum Tersedia
                </p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-md font-sans">
                  Tentukan parameter input misi di atas, lalu klik tombol
                  <strong className="text-cyan-400"> &quot;▶ PROSES ALGORITMA &amp; KALKULASI ORBIT&quot; </strong>
                  untuk memulai kalkulasi dan menampilkan visualisasi lintasan orbit 3D.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-slate-600 mt-2">
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                <span>Hasil akan muncul di sini setelah proses selesai</span>
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Flight Director Modal ───────────────────────────────────────── */}
      <AiAdvisorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        aiResult={aiResult}
        mission={selectedMission}
        launchSite={selectedSite}
        vehicle={selectedVehicle}
      />
    </main>
  );
}
