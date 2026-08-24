"use client";

import { Rocket, Sparkles } from "lucide-react";

interface Mission {
  name: string;
  agency: string;
  destination: string;
  launchDate: string;
  status: string;
  distanceFromEarth: string;
  objective: string;
  highlightFact: string;
  gradient: string;
}

const MISSIONS: Mission[] = [
  {
    name: "James Webb Space Telescope",
    agency: "NASA / ESA / CSA",
    destination: "Sun-Earth L2 (Lagrange Point)",
    launchDate: "Dec 25, 2021",
    status: "Active Science Ops",
    distanceFromEarth: "1,500,000 km",
    objective: "Observing the cosmic dawn to detect light from the earliest post-Big Bang galaxies and characterize exoplanet atmospheres for bio-signatures.",
    highlightFact: "Features a 6.5-meter gold-plated beryllium primary mirror shielded by a tennis-court-sized sunshield.",
    gradient: "from-amber-950/40 via-slate-900/60 to-[#020617]",
  },
  {
    name: "Artemis Lunar Exploration",
    agency: "NASA / International",
    destination: "Lunar Surface & Gateway Orbit",
    launchDate: "Artemis I: 2022 (Next: Artemis II/III)",
    status: "Crewed Missions in Prep",
    distanceFromEarth: "384,400 km",
    objective: "Landing the first woman and person of color on the Moon to establish sustainable long-term human presence as a proving ground for Mars.",
    highlightFact: "Powered by the super heavy-lift Space Launch System (SLS) and deep space Orion spacecraft.",
    gradient: "from-blue-950/40 via-slate-900/60 to-[#020617]",
  },
  {
    name: "Voyager 1 & 2 Interstellar",
    agency: "NASA JPL",
    destination: "Interstellar Space",
    launchDate: "1977",
    status: "Interstellar Mission",
    distanceFromEarth: "> 24 Billion km (Voyager 1)",
    objective: "Humanity's most distant emissaries, crossing the solar heliopause into pristine interstellar space.",
    highlightFact: "Carries the Golden Record containing Earth's sounds, languages, and music for any discovering civilization.",
    gradient: "from-indigo-950/40 via-slate-900/60 to-[#020617]",
  },
  {
    name: "Mars Perseverance Rover",
    agency: "NASA JPL",
    destination: "Jezero Crater, Mars",
    launchDate: "July 30, 2020",
    status: "Active Astrobiology Ops",
    distanceFromEarth: "~225 Million km (average)",
    objective: "Searching for signs of ancient microbial biosignatures in Jezero's paleo-lakebed and collecting core rock samples for Earth return.",
    highlightFact: "Deployed the Ingenuity helicopter, achieving 72 powered flights across Mars' thin atmosphere.",
    gradient: "from-red-950/40 via-slate-900/60 to-[#020617]",
  },
];

export default function SpaceMissions() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-mono mb-4">
          <Rocket className="w-3.5 h-3.5 text-cyan-400" />
          <span>DEEP SPACE EXPEDITIONS</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
          Deep Space Mission Archives
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Landmark robotic and human space exploration programs expanding human understanding of the cosmos.
        </p>
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MISSIONS.map((mission) => (
          <div
            key={mission.name}
            className={`rounded-2xl bg-gradient-to-br ${mission.gradient} border border-slate-800 p-6 sm:p-8 flex flex-col justify-between hover:border-cyan-500/40 transition-all shadow-xl`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wider">
                  {mission.agency}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] font-mono text-emerald-400">
                  {mission.status}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {mission.name}
              </h3>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
                {mission.objective}
              </p>

              {/* Data Specs Grid */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs mb-6 border-t border-slate-800/80 pt-4">
                <div>
                  <div className="text-[10px] text-slate-500">DESTINATION</div>
                  <div className="text-slate-200 font-semibold">{mission.destination}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">DISTANCE FROM EARTH</div>
                  <div className="text-cyan-300 font-semibold">{mission.distanceFromEarth}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">LAUNCH EPOCH</div>
                  <div className="text-slate-300">{mission.launchDate}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">PAYLOAD FOCUS</div>
                  <div className="text-amber-300 truncate">Deep Space Telemetry</div>
                </div>
              </div>
            </div>

            {/* Highlight Fact Banner */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-400 font-sans flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Key Fact:</strong> {mission.highlightFact}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
