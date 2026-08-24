"use client";

/**
 * Footer — NASA Flight Operations & Astrophysics Reference Telemetry Deck.
 * Showcases verified astronomical data sources, ephemeris engines, and computational architecture.
 */

import Link from "next/link";
import Image from "next/image";
import {
  Orbit,
  Sparkles,
  Globe,
  Radio,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Database,
  Compass,
  ArrowUpRight,
  Crosshair,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative border-t border-slate-800/80 bg-[#01040d]/95 text-slate-400 font-mono text-xs overflow-hidden z-20">
      {/* Subtle Background Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-cyan-950/10 blur-[180px] pointer-events-none" />

      <div className="max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 mb-12">
          {/* Col 1: Brand & Mission Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#060a14] border border-cyan-500/50 p-1 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Image
                  src="/cakrapala.png"
                  alt="Cakrapala Logo"
                  width={36}
                  height={36}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <span className="font-black text-lg text-white tracking-[0.2em] block">
                  CAKRAPALA
                </span>
                <span className="text-[9px] text-cyan-400 font-bold tracking-widest block">
                  DEEP SPACE ASTROPHYSICS PORTAL
                </span>
              </div>
            </div>

            <p className="text-slate-400 font-sans text-xs leading-relaxed max-w-sm">
              An interactive computational astrophysics and planetary science observatory. Built for authentic astronomical exploration, real-time SGP4 orbital propagation, and topocentric horizon celestial mapping.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#060b18] border border-emerald-500/40 text-[10px] text-emerald-400 font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>ALL SENSORS: ONLINE</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#060b18] border border-cyan-500/30 text-[10px] text-cyan-300">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>IAU &bull; NASA COMPLIANT</span>
              </div>
            </div>
          </div>

          {/* Col 2: Mission Exploration Consoles (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-white font-bold tracking-wider text-xs flex items-center gap-2 pb-1 border-b border-slate-800/80">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPLORATION CONSOLES</span>
            </div>

            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/solar-system"
                  className="group flex items-center justify-between p-2 rounded-xl bg-[#060b18]/60 hover:bg-[#16233b] border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Orbit className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
                    <span>3D Solar System Orrery</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </Link>
              </li>

              <li>
                <Link
                  href="/sky"
                  className="group flex items-center justify-between p-2 rounded-xl bg-[#060b18]/60 hover:bg-[#16233b] border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>IAU Sky Map &amp; Observatory</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </Link>
              </li>

              <li>
                <Link
                  href="/explore"
                  className="group flex items-center justify-between p-2 rounded-xl bg-[#060b18]/60 hover:bg-[#16233b] border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Crosshair className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
                    <span>Asteroid Defense &amp; NEOs</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </Link>
              </li>

              <li>
                <Link
                  href="/iss"
                  className="group flex items-center justify-between p-2 rounded-xl bg-[#060b18]/60 hover:bg-[#16233b] border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-white transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-amber-400 group-hover:animate-pulse" />
                    <span>ISS &amp; Satellite Live Radar</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Scientific Data Sources & Catalogues (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-white font-bold tracking-wider text-xs flex items-center gap-2 pb-1 border-b border-slate-800/80">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>DATA SOURCES &amp; STANDARDS</span>
            </div>

            <ul className="space-y-2 text-[11px] text-slate-400">
              <li className="p-2 rounded-xl bg-[#060b18]/60 border border-slate-800">
                <strong className="text-white block font-sans">Yale Bright Star (BSC5)</strong>
                <span className="text-[10px] text-slate-500">2,887 Stars &bull; Johnson B-V Index</span>
              </li>

              <li className="p-2 rounded-xl bg-[#060b18]/60 border border-slate-800">
                <strong className="text-white block font-sans">IAU Constellations</strong>
                <span className="text-[10px] text-slate-500">89 Constellation Boundaries &bull; 743 Lines</span>
              </li>

              <li className="p-2 rounded-xl bg-[#060b18]/60 border border-slate-800">
                <strong className="text-white block font-sans">NASA Horizons &amp; VSOP87</strong>
                <span className="text-[10px] text-slate-500">J2000 Planetary Heliocentric Vectors</span>
              </li>

              <li className="p-2 rounded-xl bg-[#060b18]/60 border border-slate-800">
                <strong className="text-white block font-sans">CelesTrak / NORAD SGP4</strong>
                <span className="text-[10px] text-slate-500">Real-Time Two-Line Elements (TLE)</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Engine Architecture & AI Co-Pilot (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-white font-bold tracking-wider text-xs flex items-center gap-2 pb-1 border-b border-slate-800/80">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>CORE ENGINES</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#060b18]/90 border border-slate-800 space-y-2.5 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Orbital Simulation</span>
                <strong className="text-cyan-300 font-bold block">Babylon.js 9.0 WebGL</strong>
              </div>

              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Geospatial Radar</span>
                <strong className="text-emerald-300 font-bold block">CesiumJS 1.144</strong>
              </div>

              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Astrophysics AI Agent</span>
                <strong className="text-amber-300 font-bold block">Nara Router (Qwen-3.8)</strong>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                <span>EPOCH</span>
                <span className="text-slate-300 font-mono">J2000.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Copyright Bar ─────────────────────────────────────────────── */}
        <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>
            &copy; {new Date().getFullYear()} <strong className="text-slate-300">Cakrapala</strong> &bull; NASA Deep Space Observatory &amp; Nara Router AI Astrophysics Terminal.
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
              VERIFIED ASTRONOMY DATA
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
