"use client";

/**
 * ExplorationModules — Observatory Exploration Consoles with Symmetrical 3-Column HUD Grid.
 */

import Link from "next/link";
import {
  Orbit,
  Sparkles,
  Radio,
  ArrowUpRight,
  Crosshair,
  BookOpen,
  Rocket,
  Layers,
} from "lucide-react";

interface ModuleCard {
  id: string;
  sysCode: string;
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
    sysCode: "SYS-01 // SOLAR SYSTEM",
    title: "3D Solar System",
    subtitle: "KEPLERIAN ORBITAL SIMULATOR",
    description: "Photorealistic 3D planetary scale simulation with NASA textures, Keplerian mechanics, and time dilation warp.",
    href: "/solar-system",
    badge: "BABYLON.JS 3D",
    badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    engine: "Babylon.js WebGL",
    icon: Orbit,
    gradient: "from-[#141c33]/90 to-[#0b1222]/95",
    borderColor: "border-slate-800 hover:border-cyan-400",
    telemetry: [
      { label: "BODIES", value: "8 PLANETS + SUN" },
      { label: "PHYSICS", value: "J2000.0 HORIZONS" },
      { label: "WARP", value: "0.1x — 100kx" },
    ],
    features: [
      "Keplerian Elliptical Orbit Vectors",
      "Interactive Planetary Telemetry HUD",
    ],
  },
  {
    id: "skymap",
    sysCode: "SYS-02 // SKY DOME",
    title: "IAU Sky Dome",
    subtitle: "YALE BSC5 STAR CATALOGUE",
    description: "Virtual planetarium mapping 2,887 stars from the Yale BSC5 catalog and 89 official IAU constellations with horizon lock.",
    href: "/sky",
    badge: "YALE BSC5",
    badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
    engine: "Three.js Sky Dome",
    icon: Sparkles,
    gradient: "from-[#141c33]/90 to-[#0b1222]/95",
    borderColor: "border-slate-800 hover:border-indigo-400",
    telemetry: [
      { label: "STARS", value: "2,887 BSC5 STARS" },
      { label: "CONSTELLATIONS", value: "89 IAU FIGURES" },
      { label: "LUNAR ILLUM", value: "TOPOCENTRIC" },
    ],
    features: [
      "Spectral Stellar Color Classifications",
      "Real-Time Ephemeris Horizon Line",
    ],
  },
  {
    id: "globe",
    sysCode: "SYS-03 // ASTEROID RADAR",
    title: "Asteroid Defense",
    subtitle: "NASA JPL NEO RADAR",
    description: "Real-time Near-Earth Object proximity radar tracking active asteroids, PHA threat hazard ratings, and landmark scales.",
    href: "/explore",
    badge: "NASA NeoWs",
    badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    engine: "NASA JPL NeoWs",
    icon: Crosshair,
    gradient: "from-[#141c33]/90 to-[#0b1222]/95",
    borderColor: "border-slate-800 hover:border-cyan-400",
    telemetry: [
      { label: "RADAR RANGE", value: "50 LUNAR DIST" },
      { label: "DEFENSE", value: "PHA DEFCON ALERT" },
      { label: "DATABASE", value: "NASA JPL SBDB" },
    ],
    features: [
      "3D Lunar Distance Proximity Radar",
      "Real-World Physical Scale Comparison",
    ],
  },
  {
    id: "satellites",
    sysCode: "SYS-04 // SATELLITES",
    title: "Satellite Fleet",
    subtitle: "NORAD SGP4 FLEET RADAR",
    description: "Multi-satellite flight operations console tracking ISS, Hubble, Tiangong CSS, and Starlink with live SGP4 physics.",
    href: "/iss",
    badge: "SGP4 NORAD",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    engine: "CesiumJS & SGP4",
    icon: Radio,
    gradient: "from-[#141c33]/90 to-[#0b1222]/95",
    borderColor: "border-slate-800 hover:border-amber-400",
    telemetry: [
      { label: "PROPAGATOR", value: "SGP4 CELESTRAK" },
      { label: "ALTITUDE", value: "~420 KM (LEO)" },
      { label: "VELOCITY", value: "27,580 KM/H" },
    ],
    features: [
      "Multi-Satellite Real-Time Telemetry",
      "Photorealistic 3D Globe & 2D Radar",
    ],
  },
  {
    id: "mission-control",
    sysCode: "SYS-05 // MISSION CONTROL",
    title: "AI Mission Control",
    subtitle: "PHYSICS ASTRODYNAMICS SOLVER",
    description: "Physics-based satellite launch orbit planner and Apollo-style Lunar Free-Return trajectory explorer with 3D flight phase graphics.",
    href: "/mission-control",
    badge: "AI + ASTRODYNAMICS",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    engine: "Three.js & astronomy-engine",
    icon: Rocket,
    gradient: "from-[#141c33]/90 to-[#0b1222]/95",
    borderColor: "border-slate-800 hover:border-emerald-400",
    telemetry: [
      { label: "PLANNER A", value: "SATELLITE LAUNCH" },
      { label: "PLANNER B", value: "LUNAR FREE-RETURN" },
      { label: "SOLVER", value: "LAMBERT + CONIC" },
    ],
    features: [
      "Continuous Figure-8 Lunar Slingshot",
      "Dynamic Altitude Geometry Profile",
    ],
  },
  {
    id: "codex",
    sysCode: "SYS-06 // SPACE CODEX",
    title: "Universal Codex",
    subtitle: "ASTRONOMICAL ALMANAC & LEXICON",
    description: "Interactive astrophysics encyclopedia with certified IAU definitions, orbital formulas, and integrated SYS-AI terminal queries.",
    href: "/codex",
    badge: "IAU ENCYCLOPEDIA",
    badgeColor: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    engine: "Next.js & IAU Lexicon",
    icon: BookOpen,
    gradient: "from-[#141c33]/90 to-[#0b1222]/95",
    borderColor: "border-slate-800 hover:border-sky-400",
    telemetry: [
      { label: "ENTRIES", value: "50+ ASTRONOMY TERMS" },
      { label: "DOMAINS", value: "6 SCIENTIFIC FIELDS" },
      { label: "AI BRIDGE", value: "SYS-AI TERMINAL" },
    ],
    features: [
      "100% English Verified Definitions",
      "Direct 1-Click SYS-AI Query Bridge",
    ],
  },
];

export default function ExplorationModules() {
  return (
    <section className="py-10 px-3 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
      {/* ── Section Cockpit Header ─────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0b1222]/90 border border-slate-700/60 text-cyan-300 text-xs font-mono mb-2.5 shadow-md">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>PRIMARY OBSERVATORY INSTRUMENTS</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2 font-orbitron">
          Observatory Mission Consoles
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
          Six integrated aerospace flight instruments designed for scientific astrophysics exploration, orbital mechanics simulation, and education.
        </p>
      </div>

      {/* ── Symmetrical 3-Column Grid of 6 Cockpit Consoles (2 rows × 3 cols) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.id}
              href={module.href}
              className={`group relative rounded-2xl bg-gradient-to-b ${module.gradient} border ${module.borderColor} p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_25px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl overflow-hidden`}
            >
              <div>
                {/* MFD Header Strip */}
                <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-slate-300 tracking-wider">
                      {module.sysCode}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-mono font-bold border ${module.badgeColor}`}>
                    {module.badge}
                  </span>
                </div>

                {/* Console Title & Icon */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-mono tracking-widest text-slate-400 uppercase mb-0.5 truncate">
                      {module.subtitle}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors font-orbitron truncate">
                      {module.title}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all shadow-inner shrink-0">
                    <Icon className="w-4.5 h-4.5 text-slate-300 group-hover:text-cyan-300 transition-colors" />
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-300 text-xs leading-relaxed mb-3.5 line-clamp-2">
                  {module.description}
                </p>

                {/* Telemetry Gauge Grid (Compact) */}
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-[#060a14]/90 border border-slate-800/90 mb-3 font-mono text-[9px]">
                  {module.telemetry.map((tel) => (
                    <div key={tel.label} className="min-w-0">
                      <span className="text-slate-500 block text-[8px] truncate">{tel.label}</span>
                      <strong className="text-slate-200 block truncate font-bold">{tel.value}</strong>
                    </div>
                  ))}
                </div>

                {/* Key Features Bullet List (Compact 2 bullets) */}
                <div className="space-y-1 mb-4 text-[11px] font-mono text-slate-300">
                  {module.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-1.5 truncate">
                      <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Console Launch Button */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 group-hover:bg-cyan-500 group-hover:text-slate-950 text-cyan-300 text-[11px] font-mono font-bold transition-all border border-cyan-500/30 group-hover:border-cyan-400 shadow-sm">
                  <span>ENGAGE CONSOLE</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </span>
                <span className="text-[9px] font-mono text-slate-500">
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

