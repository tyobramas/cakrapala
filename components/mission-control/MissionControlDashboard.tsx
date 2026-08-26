"use client";

/**
 * MissionControlDashboard — Master layout for AI Mission Control.
 *
 * 3-column layout:
 *   Left:   MissionBriefPanel (inputs & default scenario loader)
 *   Center: MissionTheater (3D viz & camera focus controls)
 *   Right:  DecisionPanel (results, delta-v, and AI mission analysis)
 *
 * Pure Demand-Driven Execution:
 *   - Starts in clean Pre-Flight Standby state.
 *   - 3D Trajectory & Decision Metrics are computed 100% dynamically upon clicking "RUN ANALYSIS".
 */

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type {
  MissionType,
  OptimizationObjective,
  MissionAnalysisResult,
  LaunchSite,
  VehiclePreset,
  Vec3,
  MissionPostAnalysis,
} from "@/lib/mission-control/types";
import {
  LAUNCH_SITES,
  VEHICLE_PRESETS,
  getDefaultSatelliteScenario,
  getDefaultLunarScenario,
} from "@/lib/mission-control/vehiclePresets";
import { planSatelliteLaunch } from "@/lib/mission-control/satelliteLaunchPlanner";
import { planLunarFreeReturn } from "@/lib/mission-control/lunarFreeReturnPlanner";
import { getMoonPositionEciKm } from "@/lib/mission-control/ephemeris";
import { validateTrajectory } from "@/lib/mission-control/trajectoryValidation";
import { generateDeterministicMissionAnalysis } from "@/lib/mission-control/aiMissionAnalysis";
import MissionBriefPanel from "./MissionBriefPanel";
import DecisionPanel from "./DecisionPanel";
import Link from "next/link";
import {
  Rocket,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowLeft,
  Home,
} from "lucide-react";

// Dynamic import for MissionTheater (Three.js WebGL — client only)
const MissionTheater = dynamic(() => import("./MissionTheater"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] rounded-2xl bg-[#020617] border border-slate-800/60 flex items-center justify-center">
      <div className="text-slate-600 font-mono text-xs animate-pulse">Loading 3D Astrodynamics Engine...</div>
    </div>
  ),
});

// ── Sequential Processing Animation ─────────────────────────────────────────

function ProcessingOverlay({ missionType }: { missionType: MissionType }) {
  const stages =
    missionType === "satellite_launch"
      ? [
          { label: "Validating Mission Constraints", formula: "Payload, Site Lat, Orbit Range" },
          { label: "Tsiolkovsky Δv Analysis", formula: "Δv = Isp · g₀ · ln(m₀/mf)" },
          { label: "Circular Orbit Speed & Rotation", formula: "v = √(μ/r), v_rot = ω·R·cos(φ)" },
          { label: "Sampling 3D Trajectory Points", formula: "Ascent spline + continuous LEO ring" },
          { label: "Generating AI Mission Analysis", formula: "Grounded post-analysis synthesis" },
        ]
      : [
          { label: "Ephemeris: JPL Moon Vector", formula: "astronomy-engine → ECI coordinates" },
          { label: "Universal-Variable Lambert Solver", formula: "Stumpff C₂(z), C₃(z) Newton iterations" },
          { label: "Patched-Conic Hyperbolic Flyby", formula: "δ = 2·arcsin(1 / (1 + rp·v∞²/μ))" },
          { label: "Return Corridor Verification", formula: "Perigee ∈ [80, 300] km screening" },
          { label: "Generating AI Mission Analysis", formula: "Grounded post-analysis synthesis" },
        ];

  const [currentStage, setCurrentStage] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => Math.min(prev + 1, stages.length - 1));
    }, 450);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020617]/90 backdrop-blur-sm rounded-2xl">
      <div className="text-center max-w-sm space-y-4 p-6 bg-[#030712]/90 border border-slate-800 rounded-2xl shadow-2xl">
        <Cpu className="w-10 h-10 text-cyan-400 mx-auto animate-spin" style={{ animationDuration: "3s" }} />
        <div>
          <p className="text-xs text-white font-bold font-mono uppercase tracking-wider">SOLVING ASTRODYNAMICS</p>
          <p className="text-[9px] text-slate-500 mt-0.5">Propagating state vectors and flight paths...</p>
        </div>

        <div className="space-y-2 text-left">
          {stages.map((stage, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-2 rounded-lg transition-all duration-300 ${
                i < currentStage
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  : i === currentStage
                    ? "bg-cyan-500/10 border border-cyan-500/40 text-cyan-200 animate-pulse"
                    : "bg-slate-900/50 border border-slate-800/30 opacity-30 text-slate-500"
              }`}
            >
              <span className="text-[8px] font-mono mt-0.5">
                {i < currentStage ? "✓" : i === currentStage ? "▶" : "○"}
              </span>
              <div>
                <span className="text-[9px] font-bold block">{stage.label}</span>
                <code className="text-[8px] opacity-70">{stage.formula}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export default function MissionControlDashboard() {
  // ── Mission type ────────────────────────────────────────────────────────
  const [missionType, setMissionType] = useState<MissionType>("satellite_launch");

  // ── Default Scenario A: Satellite Launch ────────────────────────────────
  const defaultSat = getDefaultSatelliteScenario();
  const [launchSite, setLaunchSite] = useState<LaunchSite>(defaultSat.launchSite);
  const [vehicle, setVehicle] = useState<VehiclePreset>(defaultSat.vehicle);
  const [launchDateUtc, setLaunchDateUtc] = useState<string>(defaultSat.launchDateUtc);
  const [payloadMassKg, setPayloadMassKg] = useState<number>(defaultSat.payloadMassKg);
  const [targetAltitudeKm, setTargetAltitudeKm] = useState<number>(defaultSat.targetAltitudeKm);
  const [targetInclinationDeg, setTargetInclinationDeg] = useState<number>(defaultSat.targetInclinationDeg);
  const [objective, setObjective] = useState<OptimizationObjective>(defaultSat.objective);

  // ── Default Scenario B: Lunar Free Return ───────────────────────────────
  const defaultLunar = getDefaultLunarScenario();
  const [searchWindowHours, setSearchWindowHours] = useState<number>(defaultLunar.searchWindowHours);
  const [parkingOrbitAltitudeKm, setParkingOrbitAltitudeKm] = useState<number>(defaultLunar.parkingOrbitAltitudeKm);
  const [minFlightTimeHours, setMinFlightTimeHours] = useState<number>(defaultLunar.minFlightTimeHours);
  const [maxFlightTimeHours, setMaxFlightTimeHours] = useState<number>(defaultLunar.maxFlightTimeHours);
  const [targetPeriluneAltitudeKm, setTargetPeriluneAltitudeKm] = useState<number>(defaultLunar.targetPeriluneAltitudeKm);

  // ── Custom site ─────────────────────────────────────────────────────────
  const [customLat, setCustomLat] = useState(0);
  const [customLon, setCustomLon] = useState(0);

  // ── Analysis state (Initially Standby / Null) ────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MissionAnalysisResult | null>(null);
  const [postAnalysis, setPostAnalysis] = useState<MissionPostAnalysis | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [moonPositionKm, setMoonPositionKm] = useState<Vec3 | undefined>();

  // ── Mobile panel state ──────────────────────────────────────────────────
  const [showMobileInputs, setShowMobileInputs] = useState(true);
  const [showMobileResults, setShowMobileResults] = useState(false);

  // Parameter change resets result to Standby mode so UI reflects exact current params
  const handleParamChange = useCallback(() => {
    setResult(null);
    setPostAnalysis(null);
    setSelectedCandidateId(null);
  }, []);

  // ── Load Default Scenario ───────────────────────────────────────────────
  const handleLoadDefaultScenario = useCallback(() => {
    if (missionType === "satellite_launch") {
      const def = getDefaultSatelliteScenario();
      setLaunchSite(def.launchSite);
      setVehicle(def.vehicle);
      setLaunchDateUtc(def.launchDateUtc);
      setPayloadMassKg(def.payloadMassKg);
      setTargetAltitudeKm(def.targetAltitudeKm);
      setTargetInclinationDeg(def.targetInclinationDeg);
      setObjective(def.objective);
    } else {
      const def = getDefaultLunarScenario();
      setLaunchSite(def.departureSite);
      setVehicle(def.vehicle);
      setLaunchDateUtc(def.departureDateUtc);
      setPayloadMassKg(def.payloadMassKg);
      setParkingOrbitAltitudeKm(def.parkingOrbitAltitudeKm);
      setSearchWindowHours(def.searchWindowHours);
      setMinFlightTimeHours(def.minFlightTimeHours);
      setMaxFlightTimeHours(def.maxFlightTimeHours);
      setTargetPeriluneAltitudeKm(def.targetPeriluneAltitudeKm);
      setObjective(def.objective);

      const moonPosKm = getMoonPositionEciKm(def.departureDateUtc);
      setMoonPositionKm(moonPosKm);
    }
    setResult(null);
    setPostAnalysis(null);
    setSelectedCandidateId(null);
  }, [missionType]);

  // ── Mission Type Switcher with Standby Reset ────────────────────────────
  const handleMissionTypeChange = useCallback(
    (type: MissionType) => {
      setMissionType(type);

      if (type === "satellite_launch") {
        const def = getDefaultSatelliteScenario();
        setLaunchSite(def.launchSite);
        setVehicle(def.vehicle);
        setLaunchDateUtc(def.launchDateUtc);
        setPayloadMassKg(def.payloadMassKg);
        setTargetAltitudeKm(def.targetAltitudeKm);
        setTargetInclinationDeg(def.targetInclinationDeg);
        setObjective(def.objective);
      } else {
        const def = getDefaultLunarScenario();
        setLaunchSite(def.departureSite);
        setVehicle(def.vehicle);
        setLaunchDateUtc(def.departureDateUtc);
        setPayloadMassKg(def.payloadMassKg);
        setParkingOrbitAltitudeKm(def.parkingOrbitAltitudeKm);
        setSearchWindowHours(def.searchWindowHours);
        setMinFlightTimeHours(def.minFlightTimeHours);
        setMaxFlightTimeHours(def.maxFlightTimeHours);
        setTargetPeriluneAltitudeKm(def.targetPeriluneAltitudeKm);
        setObjective(def.objective);

        const moonPosKm = getMoonPositionEciKm(def.departureDateUtc);
        setMoonPositionKm(moonPosKm);
      }

      setResult(null);
      setPostAnalysis(null);
      setSelectedCandidateId(null);
    },
    []
  );

  // ── Run Astrodynamics Analysis (On-Demand Execution) ────────────────────
  const handleRunAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setResult(null);
    setPostAnalysis(null);
    setSelectedCandidateId(null);

    // Realistic astrodynamics solver delay for UI animation
    await new Promise((resolve) => setTimeout(resolve, 2200));

    try {
      let analysisResult: MissionAnalysisResult;
      const effectiveSite: LaunchSite =
        launchSite.id === "custom"
          ? { ...launchSite, latitudeDeg: customLat, longitudeDeg: customLon }
          : launchSite;

      if (missionType === "satellite_launch") {
        const satInput = {
          missionType: "satellite_launch" as const,
          launchDateUtc,
          launchSite: effectiveSite,
          vehicle,
          payloadMassKg,
          targetAltitudeKm,
          targetInclinationDeg,
          objective,
        };

        analysisResult = planSatelliteLaunch(satInput);
        const topCandidate =
          analysisResult.candidates.find(
            (c) => c.id === analysisResult.recommendedCandidateId
          ) || analysisResult.candidates[0];

        if (topCandidate) {
          const validation = validateTrajectory(topCandidate, "satellite_launch");
          const analysis = generateDeterministicMissionAnalysis(
            satInput,
            analysisResult,
            topCandidate,
            validation
          );
          setPostAnalysis(analysis);
        }
      } else {
        const moonPosKm = getMoonPositionEciKm(launchDateUtc);
        setMoonPositionKm(moonPosKm);

        const lunarInput = {
          missionType: "lunar_free_return" as const,
          departureDateUtc: launchDateUtc,
          departureSite: effectiveSite,
          searchWindowHours,
          departureStepHours: 6,
          parkingOrbitAltitudeKm,
          vehicle,
          payloadMassKg,
          minFlightTimeHours,
          maxFlightTimeHours,
          flightTimeStepHours: 12,
          targetPeriluneAltitudeKm,
          objective,
        };

        analysisResult = planLunarFreeReturn(lunarInput);
        const topCandidate =
          analysisResult.candidates.find(
            (c) => c.id === analysisResult.recommendedCandidateId
          ) || analysisResult.candidates[0];

        if (topCandidate) {
          const validation = validateTrajectory(topCandidate, "lunar_free_return");
          const analysis = generateDeterministicMissionAnalysis(
            lunarInput,
            analysisResult,
            topCandidate,
            validation
          );
          setPostAnalysis(analysis);
        }
      }

      setResult(analysisResult);

      if (analysisResult.recommendedCandidateId) {
        setSelectedCandidateId(analysisResult.recommendedCandidateId);
      } else if (analysisResult.candidates.length > 0) {
        setSelectedCandidateId(analysisResult.candidates[0].id);
      }

      setShowMobileInputs(false);
      setShowMobileResults(true);
    } catch (error) {
      console.error("[MissionControl] Analysis error:", error);
      setResult({
        missionType,
        generatedAtUtc: new Date().toISOString(),
        modelVersion: "error",
        candidates: [],
        globalWarnings: [
          `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    missionType,
    launchSite,
    vehicle,
    launchDateUtc,
    payloadMassKg,
    targetAltitudeKm,
    targetInclinationDeg,
    objective,
    searchWindowHours,
    parkingOrbitAltitudeKm,
    minFlightTimeHours,
    maxFlightTimeHours,
    targetPeriluneAltitudeKm,
    customLat,
    customLon,
  ]);

  const selectedCandidate =
    result?.candidates.find((c) => c.id === selectedCandidateId) ||
    result?.candidates[0] ||
    null;

  const effectiveLaunchSite =
    launchSite.id === "custom"
      ? { ...launchSite, latitudeDeg: customLat, longitudeDeg: customLon }
      : launchSite;

  return (
    <div className="min-h-screen bg-[#030712] text-white font-mono select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#030712]/95 backdrop-blur-xl border-b border-slate-800/60 px-4 py-3">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back to Home Button */}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all text-[11px] font-bold shadow-sm group cursor-pointer"
              title="Return to Main Observatory Home"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Home</span>
            </Link>

            <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/40">
              <Rocket className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-300">SYS-05</span>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                <span>AI MISSION CONTROL</span>
              </h1>
              <p className="text-[9px] text-slate-500">
                Physics-Based Decision-Support Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>Model: cakrapala-mc-1.0-simplified</span>
            </div>
            {result ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <Layers className="w-3 h-3" />
                <span>Optimal Solution Solved</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>Pre-Flight Standby</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile Navigation Tabs ──────────────────────────────────────── */}
      <div className="lg:hidden flex border-b border-slate-800 bg-[#080d1a] text-xs">
        <button
          onClick={() => {
            setShowMobileInputs(true);
            setShowMobileResults(false);
          }}
          className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all cursor-pointer ${
            showMobileInputs
              ? "border-cyan-400 text-cyan-300 bg-cyan-500/10"
              : "border-transparent text-slate-400"
          }`}
        >
          Mission Brief
        </button>
        <button
          onClick={() => {
            setShowMobileInputs(false);
            setShowMobileResults(false);
          }}
          className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all cursor-pointer ${
            !showMobileInputs && !showMobileResults
              ? "border-cyan-400 text-cyan-300 bg-cyan-500/10"
              : "border-transparent text-slate-400"
          }`}
        >
          3D Theater
        </button>
        <button
          onClick={() => {
            setShowMobileInputs(false);
            setShowMobileResults(true);
          }}
          className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all cursor-pointer ${
            showMobileResults
              ? "border-cyan-400 text-cyan-300 bg-cyan-500/10"
              : "border-transparent text-slate-400"
          }`}
        >
          Decision Panel
        </button>
      </div>

      {/* ── 3-Column Main Workspace ───────────────────────────────────────── */}
      <main className="max-w-[1920px] mx-auto p-2 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-60px)]">
        {/* Left Column: Mission Brief Panel (3 cols) */}
        <div
          className={`lg:col-span-3 h-full overflow-hidden ${
            showMobileInputs ? "block" : "hidden lg:block"
          }`}
        >
          <MissionBriefPanel
            missionType={missionType}
            onMissionTypeChange={handleMissionTypeChange}
            launchSite={launchSite}
            onLaunchSiteChange={(s) => { setLaunchSite(s); handleParamChange(); }}
            vehicle={vehicle}
            onVehicleChange={(v) => { setVehicle(v); handleParamChange(); }}
            launchDateUtc={launchDateUtc}
            onLaunchDateChange={(d) => { setLaunchDateUtc(d); handleParamChange(); }}
            payloadMassKg={payloadMassKg}
            onPayloadChange={(kg) => { setPayloadMassKg(kg); handleParamChange(); }}
            targetAltitudeKm={targetAltitudeKm}
            onAltitudeChange={(km) => { setTargetAltitudeKm(km); handleParamChange(); }}
            targetInclinationDeg={targetInclinationDeg}
            onInclinationChange={(deg) => { setTargetInclinationDeg(deg); handleParamChange(); }}
            objective={objective}
            onObjectiveChange={(obj) => { setObjective(obj); handleParamChange(); }}
            searchWindowHours={searchWindowHours}
            onSearchWindowChange={(h) => { setSearchWindowHours(h); handleParamChange(); }}
            parkingOrbitAltitudeKm={parkingOrbitAltitudeKm}
            onParkingAltChange={(km) => { setParkingOrbitAltitudeKm(km); handleParamChange(); }}
            minFlightTimeHours={minFlightTimeHours}
            onMinFlightChange={(h) => { setMinFlightTimeHours(h); handleParamChange(); }}
            maxFlightTimeHours={maxFlightTimeHours}
            onMaxFlightChange={(h) => { setMaxFlightTimeHours(h); handleParamChange(); }}
            targetPeriluneAltitudeKm={targetPeriluneAltitudeKm}
            onPeriluneChange={(km) => { setTargetPeriluneAltitudeKm(km); handleParamChange(); }}
            customLat={customLat}
            onCustomLatChange={(lat) => { setCustomLat(lat); handleParamChange(); }}
            customLon={customLon}
            onCustomLonChange={(lon) => { setCustomLon(lon); handleParamChange(); }}
            onRunAnalysis={handleRunAnalysis}
            onLoadDefaultScenario={handleLoadDefaultScenario}
            isAnalyzing={isAnalyzing}
          />
        </div>

        {/* Center Column: 3D Mission Theater (6 cols) */}
        <div
          className={`lg:col-span-6 h-full relative ${
            !showMobileInputs && !showMobileResults ? "block" : "hidden lg:block"
          }`}
        >
          <MissionTheater
            candidate={selectedCandidate}
            missionType={missionType}
            moonPositionKm={moonPositionKm}
            launchSite={effectiveLaunchSite}
            targetAltitudeKm={targetAltitudeKm}
            targetInclinationDeg={targetInclinationDeg}
            targetPeriluneAltitudeKm={targetPeriluneAltitudeKm}
            launchDateUtc={launchDateUtc}
          />
          {isAnalyzing && <ProcessingOverlay missionType={missionType} />}
        </div>

        {/* Right Column: Decision Panel (3 cols) */}
        <div
          className={`lg:col-span-3 h-full overflow-hidden ${
            showMobileResults ? "block" : "hidden lg:block"
          }`}
        >
          <DecisionPanel
            result={result}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={setSelectedCandidateId}
            postAnalysis={postAnalysis}
            missionType={missionType}
            vehicle={vehicle}
            launchSite={effectiveLaunchSite}
            payloadMassKg={payloadMassKg}
            targetAltitudeKm={targetAltitudeKm}
            targetPeriluneAltitudeKm={targetPeriluneAltitudeKm}
            launchDateUtc={launchDateUtc}
            onRunAnalysis={handleRunAnalysis}
            isAnalyzing={isAnalyzing}
          />
        </div>
      </main>

      {/* ── Bottom Disclaimer ────────────────────────────────────────────── */}
      <footer className="fixed bottom-1 left-4 right-4 z-20 pointer-events-none text-center">
        <ModelLimitationsNotice />
      </footer>
    </div>
  );
}
