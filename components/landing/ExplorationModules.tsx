"use client";

/**
 * ExplorationModules — Observatory Exploration Consoles with Frosted Glassmorphism Theme.
 */

import Link from "next/link";
import {
  Orbit,
  Sparkles,
  Globe,
  Radio,
  ArrowUpRight,
  Layers,
  Crosshair,
} from "lucide-react";

interface ModuleCard {
  id: string;
  mfdCode: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  badge: string;
  badgeColor: string;
  engine: string;
  icon: typeof Orbit;
  gradient: string;
  borderColor: string;
  telemetry: { label: string; value: string }[];
  features: string[];
}

const MODULES: ModuleCard[] = [
  {
    id: "orrery",
    mfdCode: "MODULE 01 // SOLAR SYSTEM",
    title: "3D Solar System Simulator",
    subtitle: "KEPLERIAN ORBITAL SIMULATOR",
    description: "Interactive real-time 3D planetary scale simulation with photorealistic NASA textures, Keplerian orbital mechanics, time dilation speed multiplier, and planetary physical telemetry.",
    href: "/solar-system",
    badge: "BABYLON.JS 3D",
    badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    engine: "Babylon.js WebGL 3D",
    icon: Orbit,
    gradient: "from-[#182037]/85 to-[#0d1425]/90",
    borderColor: "border-slate-700/50 hover:border-cyan-400",
    telemetry: [
      { label: "BODIES", value: "8 PLANETS + SUN" },
      { label: "PHYSICS", value: "J2000.0 HORIZONS" },
      { label: "WARP", value: "0.1x — 100,000x" },
    ],
    features: [
      "NASA High-Resolution Textures",
      "Keplerian Elliptical Path Vectors",
      "Interactive Planetary Telemetry HUD",
      "Free 360° Orbital Camera Navigation",
    ],
  },
  {
    id: "skymap",
    mfdCode: "MODULE 02 // SKY DOME",
    title: "IAU Celestial Sky Map",
    subtitle: "YALE BSC5 STAR CATALOGUE",
    description: "Virtual planetarium sky dome mapping 2,887 stars from the Yale Bright Star Catalogue (BSC5) and 89 official IAU constellations with topocentric horizon tracking.",
    href: "/sky",
    badge: "YALE BSC5 CATALOG",
    badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
    engine: "Three.js Sky Dome",
    icon: Sparkles,
    gradient: "from-[#182037]/85 to-[#0d1425]/90",
    borderColor: "border-slate-700/50 hover:border-indigo-400",
    telemetry: [
      { label: "STARS", value: "2,887 BSC5 OBJECTS" },
      { label: "CONSTELLATIONS", value: "89 IAU FIGURES" },
      { label: "LUNAR ILLUM", value: "TOPOCENTRIC PHASE" },
    ],
    features: [
      "Spectral Stellar Color Classifications",
      "Topocentric Azimuth & Altitude Lock",
      "Real-Time Ephemeris Horizon Line",
      "Interactive Celestial Target Inspector",
    ],
  },
  {
    id: "globe",
    mfdCode: "MODULE 03 // ASTEROID RADAR",
    title: "Asteroid Defense & NEOs",
    subtitle: "NASA JPL PLANETARY DEFENSE",
    description: "Real-time Near-Earth Object (NEO) proximity radar tracking active asteroids, impact hazard ratings (PHA), velocity vectors, and physical size comparisons against Earth landmarks.",
    href: "/explore",
    badge: "NASA NeoWs REAL-TIME",
    badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    engine: "NASA JPL NeoWs & Three.js",
    icon: Crosshair,
    gradient: "from-[#182037]/85 to-[#0d1425]/90",
    borderColor: "border-slate-700/50 hover:border-cyan-400",
    telemetry: [
      { label: "RADAR RANGE", value: "50 LUNAR DISTANCES" },
      { label: "DEFENSE", value: "DEFCON PHA MONITOR" },
      { label: "DATABASE", value: "NASA JPL SBDB FEED" },
    ],
    features: [
      "3D Lunar Distance Proximity Radar",
      "Potentially Hazardous Asteroids (PHA)",
      "Real-World Physical Scale Comparison",
      "Keplerian Orbital Flyby Trajectories",
    ],
  },
  {
    id: "satellites",
    mfdCode: "MODULE 04 // SATELLITES",
    title: "Satellite Operations Console",
    subtitle: "NORAD SGP4 FLEET RADAR",
    description: "Multi-satellite flight operations console tracking the ISS, Tiangong CSS, Hubble Space Telescope, NOAA-19, Terra, and Starlink with live SGP4 physics and 2D/3D CesiumJS globe.",
    href: "/iss",
    badge: "SGP4 NORAD FLEET",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    engine: "CesiumJS & SGP4 Propagator",
    icon: Radio,
    gradient: "from-[#182037]/85 to-[#0d1425]/90",
    borderColor: "border-slate-700/50 hover:border-amber-400",
    telemetry: [
      { label: "PROPAGATOR", value: "SGP4 CELESTRAK TLE" },
      { label: "ALTITUDE", value: "~420 KM (LEO)" },
      { label: "VELOCITY", value: "27,580 KM/H" },
    ],
    features: [
      "Multi-Satellite Selector & Telemetry",
      "Mathematically Exact Orbit Intersect",
      "Photorealistic 3D Globe & 2D Radar",
      "Active Astronaut Crew Manifest",
    ],
  },
];

export default function ExplorationModules() {
  return (
    <section className="py-14 px-3 sm:px-6 lg:px-8 max-w-[1580px] mx-auto">
      {/* ── Section Cockpit Header ─────────────────────────────────────────── */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#182037]/90 border border-slate-700/60 text-cyan-300 text-xs font-mono mb-3 shadow-lg">
          <Layers className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>PRIMARY OBSERVATORY INSTRUMENTS</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-3 font-sans">
          Observatory Mission Consoles
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Four integrated aerospace instruments designed for scientific astrophysics exploration, orbital physics simulation, and education.
        </p>
      </div>

      {/* ── Grid of 4 Cockpit MFD Consoles ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.id}
              href={module.href}
              className={`group relative rounded-[26px] bg-gradient-to-b ${module.gradient} border ${module.borderColor} p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 hover:scale-[1.015] shadow-[0_12px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl overflow-hidden`}
            >
              <div>
                {/* MFD Header Strip */}
                <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[11px] font-mono font-bold text-slate-300 tracking-wider">
                      {module.mfdCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${module.badgeColor}`}>
                      {module.badge}
                    </span>
                  </div>
                </div>

                {/* Console Title & Icon */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mb-1">
                      {module.subtitle}
                    </div>
                    <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2 font-sans">
                      <span>{module.title}</span>
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center justify-center group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all shadow-inner shrink-0">
                    <Icon className="w-6 h-6 text-slate-300 group-hover:text-cyan-300 transition-colors" />
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 font-sans">
                  {module.description}
                </p>

                {/* Telemetry Gauge Grid */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#060a14]/90 border border-slate-800/90 mb-5 font-mono text-[10px]">
                  {module.telemetry.map((tel) => (
                    <div key={tel.label}>
                      <span className="text-slate-500 block text-[9px]">{tel.label}</span>
                      <strong className="text-slate-200 block truncate">{tel.value}</strong>
                    </div>
                  ))}
                </div>

                {/* Key Features Bullet Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 text-xs font-mono text-slate-300">
                  {module.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Console Launch Button */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/15 group-hover:bg-cyan-500 group-hover:text-slate-950 text-cyan-300 text-xs font-mono font-bold transition-all border border-cyan-500/30 group-hover:border-cyan-400 shadow-md">
                  <span>ENGAGE FLIGHT CONSOLE</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  SYS // READY
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
