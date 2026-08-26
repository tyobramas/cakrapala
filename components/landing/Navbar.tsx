"use client";

/**
 * Navbar — NASA Flight Deck Aerospace Tactical HUD Navigation Bar.
 * 100% Responsive across all devices (Mobile, Tablet, Laptop, Desktop, Ultrawide).
 * Features:
 *   - Auto-scaling compact/full system labels with adaptive padding
 *   - Zero horizontal overflow / clipping on 1024px–1440px laptops
 *   - Live Mission Telemetry Clock (UTC)
 *   - Tactical Mobile & Tablet Drawer with system codes & status
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Menu,
  X,
  Compass,
  Orbit,
  Sparkles,
  Satellite,
  ChevronRight,
  Crosshair,
  Terminal,
  BookOpen,
  Rocket,
} from "lucide-react";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

export default function Navbar() {
  const pathname = usePathname();
  const [timeUtc, setTimeUtc] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isAiTerminalOpen, setIsAiTerminalOpen] = useState<boolean>(false);

  const NAV_ITEMS = [
    {
      id: "overview",
      label: "OVERVIEW",
      shortLabel: "OVERVIEW",
      href: "/",
      code: "SYS-00",
      icon: Compass,
      desc: "Deep Space Master Operations Deck",
    },
    {
      id: "solar",
      label: "SOLAR SYSTEM",
      shortLabel: "SOLAR",
      href: "/solar-system",
      code: "SYS-01",
      icon: Orbit,
      desc: "3D Keplerian Planetary Orrery",
    },
    {
      id: "mission-control",
      label: "AI MISSION CONTROL",
      shortLabel: "MISSION",
      href: "/mission-control",
      code: "SYS-02",
      icon: Rocket,
      desc: "AI-Assisted Mission Planning & Analysis",
    },
    {
      id: "sky",
      label: "SKY MAP",
      shortLabel: "SKY DOME",
      href: "/sky",
      code: "SYS-03",
      icon: Sparkles,
      desc: "IAU Sky Dome & Earth Observatory",
    },
    {
      id: "globe",
      label: "ASTEROID RADAR",
      shortLabel: "ASTEROIDS",
      href: "/explore",
      code: "SYS-04",
      icon: Crosshair,
      desc: "NASA NeoWs Planetary Defense Radar",
    },
    {
      id: "satellites",
      label: "SATELLITES",
      shortLabel: "SATS",
      href: "/iss",
      code: "SYS-05",
      icon: Satellite,
      desc: "Real-Time SGP4 Orbital Fleet Tracker",
    },
    {
      id: "codex",
      label: "SPACE CODEX",
      shortLabel: "CODEX",
      href: "/codex",
      code: "SYS-06",
      icon: BookOpen,
      desc: "Universal Astronomical Encyclopedia",
    },
  ];

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // UTC clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-2 sm:px-4 lg:px-6 pt-2 pb-1.5 transition-all select-none bg-gradient-to-b from-[#020617]/95 via-[#020617]/85 to-transparent backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
        
        {/* ── Left: Official Cakrapala Brand Logo ───────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-[#060a14]/95 border border-cyan-500/50 p-1 shadow-[0_0_15px_rgba(6,182,212,0.35)] group-hover:border-cyan-300 transition-all flex items-center justify-center">
            <Image
              src="/cakrapala.png"
              alt="Cakrapala Aerospace Logo"
              width={40}
              height={40}
              className="object-contain w-full h-full group-hover:scale-105 transition-transform drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-orbitron font-black tracking-[0.22em] text-sm sm:text-base text-white uppercase bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                CAKRAPALA
              </span>
              <span className="text-[8px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold hidden xl:inline-block">
                FLIGHT DECK
              </span>
            </div>
            <p className="text-[8px] font-mono text-slate-400 tracking-wider uppercase hidden 2xl:block">
              Deep Space Operations Console
            </p>
          </div>
        </Link>

        {/* ── Center: Desktop Navigation HUD (Adaptive Scaled) ─────────────── */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 p-1 rounded-2xl bg-[#060b18]/90 border border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl font-mono shrink-0">
          {NAV_ITEMS.map((item) => {
            const isCurrent =
              item.id === "overview" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`relative group px-2.5 xl:px-3.5 py-1.5 rounded-xl text-[10px] xl:text-[11px] font-bold tracking-wider transition-all flex items-center gap-1 whitespace-nowrap ${
                  isCurrent
                    ? "bg-[#16233b] text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)]"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent hover:border-slate-700/60"
                }`}
              >
                {/* Tactical Corner Bracket Reticles on Active */}
                {isCurrent && (
                  <>
                    <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                    <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />
                  </>
                )}

                {/* Status Indicator */}
                {isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
                ) : null}

                {/* System Label (Adaptive text on medium vs large screens) */}
                <span className="hidden 2xl:inline">{item.label}</span>
                <span className="inline 2xl:hidden">{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Right: AI Terminal, Telemetry Clock & Mobile Drawer Toggle ───── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 font-mono">
          {/* AI Terminal Trigger Button */}
          <button
            type="button"
            onClick={() => setIsAiTerminalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 hover:border-cyan-300 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:shadow-[0_0_18px_rgba(6,182,212,0.4)] transition-all font-bold text-[10px] sm:text-[11px] cursor-pointer shrink-0"
            title="Open AI Astro-Terminal"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden md:inline">AI TERMINAL</span>
            <span className="inline md:hidden">AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          </button>

          {/* Live Telemetry Clock Pill */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#060b18]/90 border border-slate-700/80 text-slate-300 shadow-md backdrop-blur-xl shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="text-[9px] font-bold text-emerald-400 tracking-wider hidden lg:inline">
              LIVE
            </span>
            <span className="text-slate-600 hidden lg:inline">│</span>
            <span className="text-cyan-300 text-[10px] sm:text-[11px] font-bold tracking-tight">
              {timeUtc || "00:00:00 UTC"}
            </span>
          </div>

          {/* Mobile Menu Button (Visible on < lg) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl bg-[#060b18]/90 hover:bg-[#16233b] border border-slate-700/80 text-cyan-300 hover:text-white transition-all shadow-md cursor-pointer shrink-0"
            aria-label="Toggle Mission Systems Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile & Tablet Aerospace Tactical Dropdown Drawer ──────────────── */}
      {isMobileMenuOpen && (
        <div className="lg:hidden mt-2 p-3 rounded-2xl bg-[#060b18]/95 border border-cyan-500/40 shadow-[0_16px_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl font-mono animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="text-[10px] text-slate-400 px-2 pb-2 mb-1 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-cyan-400 uppercase tracking-widest">
              MISSION SYSTEMS DIRECTORY
            </span>
            <span className="text-[9px] text-emerald-400 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
          </div>

          {/* AI Terminal Quick Launcher in Mobile Drawer */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsAiTerminalOpen(true);
            }}
            className="w-full mb-2 p-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/50 text-cyan-200 font-bold text-xs flex items-center justify-between shadow-[0_0_15px_rgba(6,182,212,0.25)]"
          >
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>LAUNCH AI ASTRO-TERMINAL</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              SYS-AI
            </span>
          </button>

          <div className="grid grid-cols-1 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isCurrent =
                item.id === "overview" ? pathname === "/" : pathname.startsWith(item.href);
              const ItemIcon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    isCurrent
                      ? "bg-[#16233b] text-cyan-300 border border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        isCurrent
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      <ItemIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-slate-500">{item.code}</span>
                        <span className="font-bold tracking-wider">{item.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isCurrent ? "text-cyan-400 translate-x-0.5" : "text-slate-600"
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Global Astronomy Terminal Modal ───────────────────────────────── */}
      <AstronomyTerminal
        isOpen={isAiTerminalOpen}
        onClose={() => setIsAiTerminalOpen(false)}
      />
    </header>
  );
}
