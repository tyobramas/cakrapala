"use client";

import { useState } from "react";
import Link from "next/link";
import { Orbit, Compass, ArrowRight, Thermometer, Clock, Ruler, Sparkles } from "lucide-react";

interface PlanetData {
  id: string;
  name: string;
  type: string;
  diameterKm: string;
  distanceFromSunAU: string;
  orbitalPeriod: string;
  rotationPeriod: string;
  avgTempC: string;
  moonsCount: number;
  atmosphere: string[];
  description: string;
  gradient: string;
  glowColor: string;
  ring?: boolean;
}

const PLANETS: PlanetData[] = [
  {
    id: "mercury",
    name: "Mercury",
    type: "Terrestrial Planet",
    diameterKm: "4,879 km",
    distanceFromSunAU: "0.39 AU (57.9M km)",
    orbitalPeriod: "88 days",
    rotationPeriod: "59 days",
    avgTempC: "167°C (-180°C to 430°C)",
    moonsCount: 0,
    atmosphere: ["Trace Oxygen", "Sodium", "Hydrogen", "Helium"],
    description: "The smallest planet in our solar system and closest to the Sun. Its cratered surface resembles Earth's Moon and experiences the most extreme temperature swings.",
    gradient: "from-stone-400 via-amber-700 to-stone-800",
    glowColor: "rgba(217, 119, 6, 0.4)",
  },
  {
    id: "venus",
    name: "Venus",
    type: "Terrestrial Planet",
    diameterKm: "12,104 km",
    distanceFromSunAU: "0.72 AU (108.2M km)",
    orbitalPeriod: "225 days",
    rotationPeriod: "243 days (retrograde)",
    avgTempC: "464°C",
    moonsCount: 0,
    atmosphere: ["96.5% Carbon Dioxide", "3.5% Nitrogen", "Sulfuric Acid Clouds"],
    description: "The hottest planet in the solar system due to a runaway greenhouse effect. Rotates retrograde (clockwise) and is perpetually blanketed by thick sulfuric acid clouds.",
    gradient: "from-amber-200 via-orange-500 to-amber-900",
    glowColor: "rgba(245, 158, 11, 0.45)",
  },
  {
    id: "earth",
    name: "Earth",
    type: "Terrestrial Planet",
    diameterKm: "12,742 km",
    distanceFromSunAU: "1.00 AU (149.6M km)",
    orbitalPeriod: "365.25 days",
    rotationPeriod: "23h 56m",
    avgTempC: "15°C",
    moonsCount: 1,
    atmosphere: ["78% Nitrogen", "21% Oxygen", "0.9% Argon", "0.04% CO2"],
    description: "Our home world and the only known planetary body in the cosmos harboring liquid water oceans, a protective magnetosphere, and diverse living biology.",
    gradient: "from-sky-400 via-blue-600 to-emerald-700",
    glowColor: "rgba(14, 165, 233, 0.5)",
  },
  {
    id: "mars",
    name: "Mars",
    type: "Terrestrial Planet",
    diameterKm: "6,779 km",
    distanceFromSunAU: "1.52 AU (227.9M km)",
    orbitalPeriod: "687 days",
    rotationPeriod: "24h 37m",
    avgTempC: "-63°C",
    moonsCount: 2,
    atmosphere: ["95% Carbon Dioxide", "2.6% Nitrogen", "1.9% Argon"],
    description: "The Red Planet hosting the solar system's tallest volcano (Olympus Mons) and deepest canyon (Valles Marineris). Primary destination for future human exploration.",
    gradient: "from-orange-400 via-red-600 to-stone-900",
    glowColor: "rgba(239, 68, 68, 0.45)",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    type: "Gas Giant",
    diameterKm: "139,820 km",
    distanceFromSunAU: "5.20 AU (778.6M km)",
    orbitalPeriod: "11.86 years",
    rotationPeriod: "9h 55m",
    avgTempC: "-110°C",
    moonsCount: 95,
    atmosphere: ["90% Hydrogen", "10% Helium", "Methane", "Ammonia"],
    description: "The king of planets with more than twice the mass of all other planets combined. Famous for its Great Red Spot super-storm and dynamic system of 95 known moons.",
    gradient: "from-amber-200 via-orange-400 to-stone-800",
    glowColor: "rgba(217, 119, 6, 0.45)",
  },
  {
    id: "saturn",
    name: "Saturn",
    type: "Gas Giant",
    diameterKm: "116,460 km",
    distanceFromSunAU: "9.58 AU (1.43B km)",
    orbitalPeriod: "29.45 years",
    rotationPeriod: "10h 33m",
    avgTempC: "-140°C",
    moonsCount: 146,
    atmosphere: ["96% Hydrogen", "3% Helium", "Methane"],
    description: "Adorned with thousands of dazzling ringlets made of ice and rock particles spanning over 282,000 km. Holds the record for the most moons (146 moons).",
    gradient: "from-amber-100 via-yellow-600 to-stone-700",
    glowColor: "rgba(234, 179, 8, 0.45)",
    ring: true,
  },
  {
    id: "uranus",
    name: "Uranus",
    type: "Ice Giant",
    diameterKm: "50,724 km",
    distanceFromSunAU: "19.22 AU (2.87B km)",
    orbitalPeriod: "84.01 years",
    rotationPeriod: "17h 14m (retrograde)",
    avgTempC: "-195°C",
    moonsCount: 28,
    atmosphere: ["83% Hydrogen", "15% Helium", "2% Methane"],
    description: "An ice giant with a unique 98-degree axial tilt, essentially orbiting the Sun on its side. Its cyan tint arises from atmospheric methane absorbing red light.",
    gradient: "from-cyan-200 via-teal-400 to-blue-900",
    glowColor: "rgba(6, 182, 212, 0.45)",
    ring: true,
  },
  {
    id: "neptune",
    name: "Neptune",
    type: "Ice Giant",
    diameterKm: "49,244 km",
    distanceFromSunAU: "30.05 AU (4.50B km)",
    orbitalPeriod: "164.8 years",
    rotationPeriod: "16h 06m",
    avgTempC: "-200°C",
    moonsCount: 16,
    atmosphere: ["80% Hydrogen", "19% Helium", "1.5% Methane"],
    description: "The most distant major planet in our solar system, shrouded in supersonic winds exceeding 2,100 km/h and rich blue celestial methane clouds.",
    gradient: "from-blue-400 via-indigo-600 to-slate-950",
    glowColor: "rgba(59, 130, 246, 0.45)",
  },
];

export default function PlanetShowcase() {
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData>(PLANETS[2]); // Earth default

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-4">
          <Orbit className="w-3.5 h-3.5" />
          <span>SOLAR SYSTEM ARCHIVE</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
          Planetary Science Deep Dive
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Select any planet to inspect physical dimensions, Keplerian orbital periods, atmospheric composition, and telemetry metrics.
        </p>
      </div>

      {/* Planet Selector Bar */}
      <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
        {PLANETS.map((planet) => {
          const isSelected = selectedPlanet.id === planet.id;
          return (
            <button
              key={planet.id}
              type="button"
              onClick={() => setSelectedPlanet(planet)}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap flex items-center gap-2 border ${
                isSelected
                  ? "bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full bg-gradient-to-r ${planet.gradient}`}
              />
              <span>{planet.name}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Planet Feature Card */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900/90 via-[#050c1c]/95 to-[#020617] border border-cyan-500/20 p-6 sm:p-12 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Glow backdrop */}
        <div
          className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-700"
          style={{ backgroundColor: selectedPlanet.glowColor }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Planet 3D-styled Representation */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Outer Orbit Halo */}
              <div className="absolute inset-0 rounded-full border border-cyan-500/20 border-dashed animate-spin-slow" />
              
              {/* Planetary Sphere */}
              <div
                className={`w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br ${selectedPlanet.gradient} shadow-2xl relative transition-all duration-700 overflow-hidden`}
                style={{
                  boxShadow: `0 0 50px ${selectedPlanet.glowColor}, inset -15px -15px 30px rgba(0,0,0,0.8), inset 15px 15px 30px rgba(255,255,255,0.2)`,
                }}
              >
                {/* Texture Map Overlay */}
                <img
                  src={`/textures/planets/${selectedPlanet.id}.jpg`}
                  alt={selectedPlanet.name}
                  className="w-full h-full object-cover opacity-85 mix-blend-luminosity"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />

                {/* Ring if applicable */}
                {selectedPlanet.ring && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[35%] rounded-full border-[6px] border-amber-200/40 rotate-[-25deg] pointer-events-none shadow-[0_0_20px_rgba(251,191,36,0.3)]" />
                )}
              </div>
            </div>

            <div className="mt-4 text-center">
              <span className="text-[11px] font-mono text-cyan-400 tracking-wider">
                {selectedPlanet.type.toUpperCase()}
              </span>
              <h3 className="text-2xl font-bold text-white tracking-wide">
                {selectedPlanet.name}
              </h3>
            </div>
          </div>

          {/* Planet Telemetry Info */}
          <div className="lg:col-span-7 space-y-6">
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {selectedPlanet.description}
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 font-mono text-left">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                  <Ruler className="w-3 h-3 text-cyan-400" />
                  <span>DIAMETER</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {selectedPlanet.diameterKm}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                  <Orbit className="w-3 h-3 text-cyan-400" />
                  <span>DISTANCE TO SUN</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white truncate" title={selectedPlanet.distanceFromSunAU}>
                  {selectedPlanet.distanceFromSunAU}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>ORBITAL PERIOD</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {selectedPlanet.orbitalPeriod}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                  <Thermometer className="w-3 h-3 text-cyan-400" />
                  <span>MEAN TEMP</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {selectedPlanet.avgTempC}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>NATURAL MOONS</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {selectedPlanet.moonsCount} Moons
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                  <Compass className="w-3 h-3 text-cyan-400" />
                  <span>ROTATIONAL DAY</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {selectedPlanet.rotationPeriod}
                </div>
              </div>
            </div>

            {/* Atmosphere Pills */}
            <div>
              <div className="text-[11px] font-mono text-slate-400 mb-2">
                PRIMARY ATMOSPHERIC SIGNATURES:
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPlanet.atmosphere.map((gas) => (
                  <span
                    key={gas}
                    className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-cyan-300 text-xs font-mono"
                  >
                    {gas}
                  </span>
                ))}
              </div>
            </div>

            {/* Launch CTA */}
            <div className="pt-2">
              <Link
                href="/solar-system"
                className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] group"
              >
                <span>Explore {selectedPlanet.name} in 3D Orrery Simulator</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
