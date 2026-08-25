"use client";

/**
 * HeroSection — ISS Command Center Tactical Dashboard.
 * Full-viewport immersive space command center with:
 *   - Center: Realistic 3D Earth globe with orbiting ISS
 *   - Left: Satellite telemetry + Solar System data panels
 *   - Right: Stellar catalog + Crew manifest + DSN health panels
 *   - Bottom: Floating module dock bar
 *   - Top status strip integrated with main content
 * All panels use glassmorphism floating HUD aesthetic.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Radio,
  Bot,
  Orbit,
  Sparkles,
  Satellite,
  ChevronRight,
  Users,
  Radar,
  Sparkle,
  Crosshair,
  BookOpen,
  Activity,
  Globe,
  Zap,
  Shield,
  Rocket,
} from "lucide-react";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";

// Dynamic import to avoid SSR issues with Three.js
const CommandCenterGlobe = dynamic(
  () => import("./CommandCenterGlobe"),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-cyan-400/60 font-mono text-xs animate-pulse tracking-widest">
        INITIALIZING EARTH VIEWPORT...
      </div>
    </div>
  )}
);

interface LiveTelemetry {
  satelliteId: string;
  name: string;
  noradId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  period: number;
  inclination: number;
}

export default function HeroSection() {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [selectedSatId, setSelectedSatId] = useState<string>("iss");
  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null);
  const [catalogCounts, setCatalogCounts] = useState({
    satellites: SATELLITE_CATALOG.length,
    planets: 8,
    stars: 2887,
    constellations: 89,
  });

  // Mouse parallax for background layers
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    setMousePos({ x, y });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Fetch live telemetry
  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/iss?id=${selectedSatId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.telemetry) {
          const satMeta =
            SATELLITE_CATALOG.find((s) => s.id === selectedSatId) ||
            SATELLITE_CATALOG[0];
          setTelemetry({
            satelliteId: data.telemetry.satelliteId || selectedSatId,
            name: data.telemetry.name || satMeta.name,
            noradId: satMeta.noradId,
            latitude: Number(data.telemetry.latitude.toFixed(2)),
            longitude: Number(data.telemetry.longitude.toFixed(2)),
            altitude: Math.round(data.telemetry.altitude),
            velocity: Math.round(data.telemetry.velocity),
            visibility: data.telemetry.visibility || "Daylight",
            period: satMeta.periodMin,
            inclination: satMeta.inclinationDeg,
          });
        }
      } catch {
        // graceful fallback
      }
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedSatId]);

  // Fetch star & constellation counts
  useEffect(() => {
    fetch("/data/stars-bsc5.json")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCatalogCounts((prev) => ({ ...prev, stars: data.length }));
        }
      })
      .catch(() => {});

    fetch("/data/constellations.json")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCatalogCounts((prev) => ({
            ...prev,
            constellations: data.length,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Live UTC Clock
  const [utcTime, setUtcTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().slice(11, 19)
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <section className="relative min-h-screen pt-20 pb-6 px-3 sm:px-4 lg:px-5 overflow-hidden">

      {/* ── Deep Space Ambient Background Lights ─────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${mousePos.x * -8}px, ${mousePos.y * -8}px)`,
          transition: "transform 0.3s ease-out",
        }}
      >
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-cyan-900/10 blur-[200px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[180px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-blue-950/15 blur-[250px]" />
      </div>

      {/* ── Top Mission Status Strip ─────────────────────────────────── */}
      <div className="relative z-20 max-w-[1600px] mx-auto mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-[#080d1a]/80 border border-slate-800/60 backdrop-blur-2xl font-mono text-[9px] sm:text-[10px] tracking-wider">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold">ALL SYSTEMS NOMINAL</span>
            </span>
            <span className="text-slate-600 hidden sm:inline">│</span>
            <span className="hidden sm:inline">DEEP SPACE COMMAND CENTER</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-slate-400">
            <span>SATS ONLINE: <strong className="text-cyan-300">{catalogCounts.satellites}</strong></span>
            <span className="text-slate-600">│</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">LOCKED</span>
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN COMMAND CENTER: LEFT DATA + CENTER GLOBE + RIGHT DATA
      ══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch" style={{ minHeight: "calc(100vh - 220px)" }}>

        {/* ── LEFT PANEL: SATELLITE TELEMETRY & SOLAR SYSTEM ─────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4 font-mono">

          {/* Card: Live SGP4 Satellite Telemetry */}
          <div className="hud-card flex-1">
            <div className="hud-card-header">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="hud-title">ORBITAL TELEMETRY</span>
              </div>
              <Link href="/iss" className="hud-action-btn" title="Launch Satellite Console">
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Satellite Switcher */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#030712]/90 border border-slate-800/80 mb-3 text-[9px]">
              {SATELLITE_CATALOG.slice(0, 6).map((sat) => (
                <button
                  key={sat.id}
                  onClick={() => setSelectedSatId(sat.id)}
                  className={`py-1 rounded-lg transition-all text-center uppercase font-bold truncate ${
                    selectedSatId === sat.id
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {sat.id.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Spacecraft ID */}
            <div className="mb-3">
              <span className="text-[8px] text-slate-500 block uppercase tracking-[0.2em]">SPACECRAFT ID</span>
              <div className="text-sm font-bold text-white tracking-wide truncate font-sans">
                {telemetry ? telemetry.name : "INTERNATIONAL SPACE STATION"}
              </div>
              <div className="text-[9px] text-cyan-400/80 font-mono">
                NORAD #{telemetry ? telemetry.noradId : "25544"}
              </div>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div className="hud-metric-cell">
                <span className="hud-metric-label">VELOCITY</span>
                <strong className="hud-metric-value text-white">
                  {telemetry ? `${telemetry.velocity.toLocaleString()}` : "27,580"} <span className="text-[7px] text-slate-500">km/h</span>
                </strong>
              </div>
              <div className="hud-metric-cell">
                <span className="hud-metric-label">ALTITUDE</span>
                <strong className="hud-metric-value text-cyan-300">
                  {telemetry ? `${telemetry.altitude}` : "418"} <span className="text-[7px] text-slate-500">km LEO</span>
                </strong>
              </div>
              <div className="hud-metric-cell">
                <span className="hud-metric-label">INCLINATION</span>
                <strong className="hud-metric-value text-slate-200">
                  {telemetry ? `${telemetry.inclination}°` : "51.64°"}
                </strong>
              </div>
              <div className="hud-metric-cell">
                <span className="hud-metric-label">PERIOD</span>
                <strong className="hud-metric-value text-amber-300">
                  {telemetry ? `${telemetry.period}` : "92.9"} <span className="text-[7px] text-slate-500">min</span>
                </strong>
              </div>
            </div>

            {/* Live Coordinates Strip */}
            <div className="flex items-center justify-between text-[9px] text-slate-400 mt-3 px-2 py-1.5 rounded-xl bg-[#030712]/90 border border-slate-800/60">
              <span>LAT <strong className="text-cyan-300">{telemetry ? `${telemetry.latitude}°` : "+14.28°"}</strong></span>
              <span>LON <strong className="text-cyan-300">{telemetry ? `${telemetry.longitude}°` : "-106.82°"}</strong></span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                {telemetry ? telemetry.visibility : "Daylight"}
              </span>
            </div>
          </div>

          {/* Card: Solar System Simulator */}
          <Link href="/solar-system" className="hud-card group hover:border-indigo-500/40 transition-all">
            <div className="hud-card-header">
              <div className="flex items-center gap-2">
                <Orbit className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform duration-500" />
                <span className="hud-title">SOLAR SYSTEM</span>
              </div>
              <span className="text-[9px] font-bold text-indigo-300">9 BODIES</span>
            </div>
            <div className="space-y-1 text-[9px] text-slate-400 mt-2">
              <div className="flex justify-between">
                <span>1 AU Distance:</span>
                <strong className="text-white font-mono">149,597,870 km</strong>
              </div>
              <div className="flex justify-between">
                <span>Time Warp Range:</span>
                <strong className="text-cyan-300 font-mono">0.1x — 100,000x</strong>
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] text-indigo-400 font-bold mt-3 pt-2 border-t border-slate-800/60">
              <span>LAUNCH 3D SIMULATOR</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card: Asteroid Defense */}
          <Link href="/explore" className="hud-card group hover:border-red-500/30 transition-all">
            <div className="hud-card-header">
              <div className="flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-red-400" />
                <span className="hud-title">ASTEROID RADAR</span>
              </div>
              <span className="text-[9px] font-bold text-red-300 flex items-center gap-1">
                <Activity className="w-3 h-3" /> NEOWs
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-2">
              NASA Planetary Defense Coordination Office — Near-Earth Object tracking
            </div>
            <div className="flex items-center justify-between text-[9px] text-red-400 font-bold mt-3 pt-2 border-t border-slate-800/60">
              <span>OPEN DEFENSE RADAR</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* ── CENTER: 3D EARTH GLOBE VIEWPORT ────────────────────────── */}
        <div className="lg:col-span-6 relative flex flex-col">

          {/* Globe Container */}
          <div className="flex-1 relative rounded-3xl overflow-hidden border border-slate-800/60 bg-[#020617]/70 shadow-[0_0_80px_rgba(6,182,212,0.1)] min-h-[480px] lg:min-h-[560px]">

            {/* Tactical Viewport corner markers */}
            <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-cyan-500/40 rounded-tl-md z-10 pointer-events-none" />
            <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-cyan-500/40 rounded-tr-md z-10 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-cyan-500/40 rounded-bl-md z-10 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-cyan-500/40 rounded-br-md z-10 pointer-events-none" />

            {/* 3D Realistic LEO Earth Viewport */}
            <CommandCenterGlobe />
          </div>

          {/* ── AI Terminal Launch + Module Dock ──────────────────────── */}
          <div className="mt-4 flex flex-col items-center gap-3">

            {/* AI Launch Button */}
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-indigo-500/15 to-cyan-500/15 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 font-mono font-bold text-xs shadow-[0_0_30px_rgba(6,182,212,0.2)] hover:shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-all group cursor-pointer"
            >
              <Bot className="w-4 h-4 text-cyan-400 animate-pulse group-hover:scale-110 transition-transform" />
              <span>LAUNCH AI ASTRO-TERMINAL</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                ONLINE
              </span>
            </button>

            {/* Module Quick-Access Dock */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#080d1a]/60 border border-slate-800/50 backdrop-blur-2xl">
              {[
                { icon: Orbit, label: "SOLAR", href: "/solar-system", color: "text-indigo-400 hover:text-indigo-300", glow: "hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]" },
                { icon: Rocket, label: "LAUNCH", href: "/trajectories", color: "text-amber-400 hover:text-amber-300", glow: "hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]" },
                { icon: Sparkles, label: "SKY", href: "/sky", color: "text-emerald-400 hover:text-emerald-300", glow: "hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]" },
                { icon: Crosshair, label: "NEO", href: "/explore", color: "text-red-400 hover:text-red-300", glow: "hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]" },
                { icon: Satellite, label: "SAT", href: "/iss", color: "text-cyan-400 hover:text-cyan-300", glow: "hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]" },
                { icon: BookOpen, label: "CODEX", href: "/codex", color: "text-blue-400 hover:text-blue-300", glow: "hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]" },
                { icon: Bot, label: "SYS-AI", href: "#", color: "text-purple-400 hover:text-purple-300", glow: "hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]", onClick: () => setIsAiModalOpen(true) },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={item.onClick ? (e) => { e.preventDefault(); item.onClick(); } : undefined}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-transparent hover:border-slate-700/60 hover:bg-slate-800/30 transition-all ${item.glow}`}
                  title={item.label}
                >
                  <item.icon className={`w-5 h-5 ${item.color} transition-colors`} />
                  <span className="text-[8px] font-mono font-bold text-slate-500 tracking-widest">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: STELLAR CATALOG, CREW & DSN ───────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4 font-mono">

          {/* Card: Yale BSC5 Star Catalog */}
          <Link href="/sky" className="hud-card group hover:border-emerald-500/40 transition-all">
            <div className="hud-card-header">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hud-title">STELLAR MATRIX</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-400">
                {catalogCounts.stars.toLocaleString()} STARS
              </span>
            </div>
            <div className="space-y-1.5 text-[9px] text-slate-400 mt-2">
              <div className="flex justify-between">
                <span>Limiting Magnitude:</span>
                <strong className="text-white font-mono">V ≤ 5.50</strong>
              </div>
              <div className="flex justify-between">
                <span>IAU Constellations:</span>
                <strong className="text-emerald-300 font-mono">{catalogCounts.constellations}</strong>
              </div>
              <div className="flex justify-between">
                <span>Galactic Core (Sgr A*):</span>
                <strong className="text-amber-300 font-mono">RA 17h 45m</strong>
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] text-emerald-400 font-bold mt-3 pt-2 border-t border-slate-800/60">
              <span>EXPLORE SKY DOME</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card: Humans in Orbit */}
          <div className="hud-card">
            <div className="hud-card-header">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="hud-title">HUMANS IN ORBIT</span>
              </div>
              <span className="text-[9px] font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25">
                10 CREW
              </span>
            </div>
            <div className="space-y-2 mt-2">
              <div className="hud-crew-cell">
                <div>
                  <strong className="text-white block font-sans text-[11px]">ISS Expedition 71</strong>
                  <span className="text-[8px] text-slate-500">NASA • Roscosmos • ESA</span>
                </div>
                <span className="text-[11px] font-bold text-cyan-300 font-sans">7</span>
              </div>
              <div className="hud-crew-cell">
                <div>
                  <strong className="text-white block font-sans text-[11px]">Tiangong Shenzhou-18</strong>
                  <span className="text-[8px] text-slate-500">CMSA Space Station</span>
                </div>
                <span className="text-[11px] font-bold text-amber-300 font-sans">3</span>
              </div>
            </div>
          </div>

          {/* Card: DSN Telemetry Health */}
          <div className="hud-card flex-1">
            <div className="hud-card-header">
              <div className="flex items-center gap-2">
                <Radar className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hud-title">DSN SYSTEM HEALTH</span>
              </div>
              <span className="text-emerald-400 font-bold text-[8px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                NOMINAL
              </span>
            </div>
            <div className="space-y-3 mt-3">
              {[
                { label: "Astrometric J2000.0", value: "100%", color: "from-emerald-500 to-cyan-400", width: "100%" },
                { label: "SGP4 Orbital Engine", value: "ACTIVE", color: "from-cyan-500 to-blue-400", width: "100%" },
                { label: "Deep Space AI Co-Pilot", value: "ONLINE", color: "from-indigo-500 to-purple-400", width: "100%" },
                { label: "NeoWs Asteroid Feed", value: "SYNCED", color: "from-amber-500 to-orange-400", width: "92%" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[8px] text-slate-500 mb-1">
                    <span>{item.label}</span>
                    <span className="text-emerald-400 font-bold">{item.value}</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`}
                      style={{ width: item.width }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-4 space-y-2">
              <Link
                href="/iss"
                className="flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 text-[9px] font-bold transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <Satellite className="w-3 h-3" />
                  3D SATELLITE RADAR
                </span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/codex"
                className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-[9px] font-bold transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" />
                  SPACE CODEX
                </span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Astronomy Terminal Modal ───────────────────────────────── */}
      <AstronomyTerminal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialPrompt=""
      />

      {/* ── HUD Card Styles ──────────────────────────────────────────── */}
      <style jsx>{`
        .hud-card {
          position: relative;
          padding: 16px;
          border-radius: 20px;
          background: linear-gradient(
            180deg,
            rgba(12, 18, 36, 0.85) 0%,
            rgba(6, 10, 22, 0.92) 100%
          );
          border: 1px solid rgba(51, 65, 85, 0.4);
          backdrop-filter: blur(40px);
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        .hud-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 20px;
          right: 20px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(6, 182, 212, 0.15),
            transparent
          );
        }
        .hud-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(30, 41, 59, 0.5);
        }
        .hud-title {
          font-size: 10px;
          font-weight: 700;
          color: white;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .hud-action-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(71, 85, 105, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(148, 163, 184, 0.8);
          transition: all 0.2s;
        }
        .hud-action-btn:hover {
          background: rgba(6, 182, 212, 0.15);
          border-color: rgba(6, 182, 212, 0.5);
          color: rgb(103, 232, 249);
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
        }
        .hud-metric-cell {
          padding: 6px 8px;
          border-radius: 10px;
          background: rgba(3, 7, 18, 0.8);
          border: 1px solid rgba(30, 41, 59, 0.5);
        }
        .hud-metric-label {
          display: block;
          font-size: 8px;
          color: rgba(100, 116, 139, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 2px;
        }
        .hud-metric-value {
          display: block;
          font-size: 12px;
          font-family: ui-monospace, monospace;
        }
        .hud-crew-cell {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: 12px;
          background: rgba(3, 7, 18, 0.8);
          border: 1px solid rgba(30, 41, 59, 0.4);
        }
      `}</style>
    </section>
  );
}
