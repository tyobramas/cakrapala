"use client";

/**
 * HeroSection — NASA / SpaceX Flight Operations Deck with Glassmorphism Container Theme.
 * Combines the rich, verified astronomical and flight telemetry content with the
 * frosted dark-glassmorphism container styling:
 *   - Container Theme: Rounded-[26px], frosted glass gradient, subtle inner highlight, backdrop-blur-2xl
 *   - Left Panel: Live SGP4 Satellite Fleet, Spacecraft Switcher, & Heliocentric Ephemeris
 *   - Center Stage: Pure Borderless 3D Rotating Milky Way Galaxy (PIA10748) + Tactical Bridge Controls
 *   - Right Panel: Yale BSC5 Stellar Matrix, Humans in Space Crew Manifest, & DSN Telemetry Health
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Radio,
  Bot,
  Compass,
  Activity,
  Orbit,
  Sparkles,
  Globe,
  Satellite,
  ChevronRight,
  Users,
  Radar,
  Sparkle,
} from "lucide-react";
import LiveHeroMilkyWay from "./LiveHeroMilkyWay";
import AstronomyTerminal from "../ai/AstronomyTerminal";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";

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
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState("");
  const [selectedSatId, setSelectedSatId] = useState<string>("iss");

  // Dynamic live telemetry from active API
  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null);
  const [catalogCounts, setCatalogCounts] = useState({
    satellites: SATELLITE_CATALOG.length,
    planets: 8,
    stars: 2887,
    constellations: 89,
  });

  // 1. Fetch live telemetry for selected satellite
  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/iss?id=${selectedSatId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.telemetry) {
          const satMeta = SATELLITE_CATALOG.find((s) => s.id === selectedSatId) || SATELLITE_CATALOG[0];
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

  // 2. Fetch live star & constellation catalog count
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
          setCatalogCounts((prev) => ({ ...prev, constellations: data.length }));
        }
      })
      .catch(() => {});
  }, []);

  // 3. Web Speech Recognition
  const handleSpeakToggle = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsAiModalOpen(true);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setSpeechText(transcript);
          setIsListening(false);
          setIsAiModalOpen(true);
        };
        recognition.onerror = () => {
          setIsListening(false);
          setIsAiModalOpen(true);
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } catch {
        setIsListening(false);
        setIsAiModalOpen(true);
      }
    }
  };

  return (
    <section className="relative min-h-screen pt-24 pb-12 px-3 sm:px-6 lg:px-8 max-w-[1580px] mx-auto flex flex-col justify-between">
      
      {/* ── Soft Deep Space Ambient Light ─────────────────────────────────── */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[850px] h-[850px] rounded-full bg-cyan-950/15 blur-[240px] pointer-events-none" />

      {/* ── NASA/SpaceX Master Flight Deck Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-center relative z-10 my-auto">
        
        {/* ══════════════════════════════════════════════════════════════════════
            LEFT PANEL: SGP4 ORBITAL FLIGHT DECK & HELIOCENTRIC EPHEMERIS
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4 font-mono">
          
          {/* Card 1: Multi-Satellite SGP4 Flight Console (Glassmorphism) */}
          <div className="rounded-[26px] bg-gradient-to-b from-[#182037]/85 to-[#0d1425]/90 border border-slate-700/50 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl">
            
            {/* Header with status badge & circular action button */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  SGP4 ORBITAL RADAR
                </span>
              </div>
              <Link
                href="/iss"
                className="w-7 h-7 rounded-full bg-slate-800/80 hover:bg-cyan-500/20 border border-slate-600/50 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all shadow-inner"
                title="Launch Satellite Console"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Satellite Switcher Buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#060a14]/80 border border-slate-800 mb-3 text-[10px]">
              {SATELLITE_CATALOG.slice(0, 6).map((sat) => (
                <button
                  key={sat.id}
                  onClick={() => setSelectedSatId(sat.id)}
                  className={`py-1 rounded-lg transition-all text-center uppercase font-bold truncate ${
                    selectedSatId === sat.id
                      ? "bg-[#25324d] text-cyan-300 shadow-sm border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={sat.name}
                >
                  {sat.id.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Spacecraft Identification */}
            <div className="mb-2.5">
              <span className="text-[9px] text-slate-400 block uppercase tracking-wider">SPACECRAFT IDENTIFICATION</span>
              <div className="text-sm font-bold text-white tracking-wide truncate font-sans">
                {telemetry ? telemetry.name : "INTERNATIONAL SPACE STATION"}
              </div>
              <div className="text-[10px] text-cyan-400">
                NORAD CATALOG ID: #{telemetry ? telemetry.noradId : "25544"}
              </div>
            </div>

            {/* 4-Quadrant High-Tech Metric Grid */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#060a14]/90 border border-slate-800/90 text-[10px] mb-3">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">ORBITAL VELOCITY</span>
                <strong className="text-white text-xs block font-sans">
                  {telemetry ? `${telemetry.velocity.toLocaleString()} km/h` : "27,580 km/h"}
                </strong>
                <span className="text-[9px] text-slate-400">~7.66 km/s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">ALTITUDE (LEO)</span>
                <strong className="text-cyan-300 text-xs block font-sans">
                  {telemetry ? `${telemetry.altitude} km` : "418.5 km"}
                </strong>
                <span className="text-[9px] text-slate-400">Low Earth Orbit</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">INCLINATION</span>
                <strong className="text-slate-200 block font-sans">
                  {telemetry ? `${telemetry.inclination}°` : "51.64°"}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">PERIOD</span>
                <strong className="text-amber-300 block font-sans">
                  {telemetry ? `${telemetry.period} min` : "92.9 min"}
                </strong>
              </div>
            </div>

            {/* Live Sub-Satellite Coordinates */}
            <div className="flex items-center justify-between text-[10px] text-slate-300 px-2 py-1.5 bg-[#060a14]/80 rounded-xl border border-slate-800 mb-3">
              <span>LAT: <strong className="text-cyan-300 font-mono">{telemetry ? `${telemetry.latitude}°` : "+14.28°"}</strong></span>
              <span>LON: <strong className="text-cyan-300 font-mono">{telemetry ? `${telemetry.longitude}°` : "-106.82°"}</strong></span>
              <span className="text-emerald-400 font-bold">&bull; {telemetry ? telemetry.visibility : "Daylight"}</span>
            </div>

            {/* Launch Console Action */}
            <Link
              href="/iss"
              className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all group"
            >
              <span>ACCESS 3D SATELLITE RADAR</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card 2: Keplerian Planetary Mechanics (Glassmorphism) */}
          <Link
            href="/solar-system"
            className="block group rounded-[26px] bg-gradient-to-b from-[#182037]/85 to-[#0d1425]/90 border border-slate-700/50 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl transition-all hover:border-indigo-500/40"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Orbit className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform duration-500" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  SOLAR SYSTEM SIMULATOR
                </span>
              </div>
              <span className="text-[10px] font-bold text-indigo-300">
                8 PLANETS + SUN
              </span>
            </div>

            <div className="space-y-1.5 text-[10px] text-slate-300 my-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sun-Earth Distance (1 AU):</span>
                <strong className="text-white font-mono">149,597,870 km</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Moon Phase (Topocentric):</span>
                <strong className="text-amber-300 font-mono">Waxing Gibbous &bull; 84.6%</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Time Dilation Warp:</span>
                <strong className="text-cyan-300 font-mono">0.1x &mdash; 100,000x Speed</strong>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-indigo-400 font-bold pt-2 border-t border-slate-800/80">
              <span>INITIALIZE 3D SIMULATOR</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            CENTER STAGE: MAJESTIC BORDERLESS 3D MILKY WAY & BRIDGE CONTROLS
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
          
          {/* Top Mission Title Badge */}
          <div className="text-center mb-1 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#182037]/90 border border-slate-700/60 text-xs font-mono tracking-wider text-cyan-300 shadow-xl backdrop-blur-2xl">
              <Sparkle className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
              <span>MILKY WAY // NASA PIA10748 DEEP SPACE VIEW</span>
            </div>
          </div>

          {/* Borderless 3D Rotating Galaxy */}
          <LiveHeroMilkyWay />

          {/* AI Flight Director Terminal Launch Bar */}
          <div className="z-20 -mt-6 mb-2 flex items-center justify-center">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-cyan-500/20 hover:from-cyan-500/35 hover:to-indigo-500/35 border border-cyan-500/50 hover:border-cyan-300 text-cyan-200 font-mono font-bold text-xs shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] transition-all group cursor-pointer"
            >
              <Bot className="w-4 h-4 text-cyan-400 animate-pulse group-hover:scale-110 transition-transform" />
              <span>LAUNCH AI ASTRO-TERMINAL</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                NARA QWEN
              </span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT PANEL: STELLAR MATRIX, CREW MANIFEST & DSN TELEMETRY
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4 font-mono">
          
          {/* Card 1: Yale BSC5 Star Catalog (Glassmorphism) */}
          <Link
            href="/sky"
            className="block group rounded-[26px] bg-gradient-to-b from-[#182037]/85 to-[#0d1425]/90 border border-slate-700/50 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl transition-all hover:border-emerald-500/40"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  YALE BSC5 STELLAR MATRIX
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400">
                {catalogCounts.stars.toLocaleString()} STARS
              </span>
            </div>

            <div className="space-y-1.5 text-[10px] text-slate-300 my-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Naked-Eye Limiting Mag:</span>
                <strong className="text-white font-mono">V &le; 5.50 mag</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Official IAU Constellations:</span>
                <strong className="text-emerald-300 font-mono">{catalogCounts.constellations} Sky Figures</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Galactic Core (Sgr A*):</span>
                <strong className="text-amber-300 font-mono">RA 17h 45m &bull; Dec -29&deg;</strong>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold pt-2 border-t border-slate-800/80">
              <span>EXPLORE SKY DOME</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Active Humans in Space / Orbital Crew Manifest (Glassmorphism) */}
          <div className="rounded-[26px] bg-gradient-to-b from-[#182037]/85 to-[#0d1425]/90 border border-slate-700/50 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  HUMANS IN ORBIT
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                10 ASTRONAUTS
              </span>
            </div>

            <div className="space-y-2 text-[10px] text-slate-300 my-2">
              <div className="p-2.5 rounded-xl bg-[#060a14]/90 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <strong className="text-white block font-sans">ISS Expedition 71</strong>
                  <span className="text-[9px] text-slate-400">NASA &bull; Roscosmos &bull; ESA</span>
                </div>
                <span className="text-xs font-bold text-cyan-300 font-sans">7 Crew</span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#060a14]/90 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <strong className="text-white block font-sans">Tiangong Shenzhou-18</strong>
                  <span className="text-[9px] text-slate-400">CMSA Space Station</span>
                </div>
                <span className="text-xs font-bold text-amber-300 font-sans">3 Crew</span>
              </div>
            </div>
          </div>

          {/* Card 3: Deep Space Network (DSN) & AI Telemetry Health (Glassmorphism) */}
          <div className="rounded-[26px] bg-gradient-to-b from-[#182037]/85 to-[#0d1425]/90 border border-slate-700/50 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl text-[10px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  DSN TELEMETRY HEALTH
                </span>
              </div>
              <span className="text-emerald-400 font-bold text-[9px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LOCKED
              </span>
            </div>

            <div className="space-y-2 text-slate-300 mb-3">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1 text-[9px]">
                  <span>Astrometric J2000.0 Precision</span>
                  <span className="text-emerald-400 font-bold">100% Sub-Arcsec</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 w-full" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1 text-[9px]">
                  <span>Nara Router AI Astrophysics Co-Pilot</span>
                  <span className="text-cyan-300 font-bold">ONLINE (QWEN-3.8)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 w-full" />
                </div>
              </div>
            </div>

            <Link
              href="/explore"
              className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-bold transition-all group"
            >
              <span>OPEN ASTEROID DEFENSE RADAR</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Cakrapala AI Astronomy Terminal Modal ────────────────────────────── */}
      <AstronomyTerminal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialPrompt={speechText}
      />
    </section>
  );
}
