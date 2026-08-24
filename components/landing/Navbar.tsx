"use client";

/**
 * Navbar — NASA Flight Deck Aerospace Tactical HUD Navigation Bar.
 * Fully responsive across all devices (Mobile, Tablet, Laptop, Ultrawide).
 * Features:
 *   - Clean non-truncated wide navigation tabs on desktop
 *   - Adaptive layout with automatic space conservation on medium screens
 *   - Aerospace Tactical Mobile Drawer with system icons and status for small screens
 *   - Live Mission Telemetry Clock (UTC & GMST)
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
  Globe,
  Satellite,
  Radio,
  ChevronRight,
  Crosshair,
  Terminal,
  Bot,
} from "lucide-react";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

export default function Navbar() {
  const pathname = usePathname();
  const [timeUtc, setTimeUtc] = useState<string>("");
  const [gmst, setGmst] = useState<string>("");
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
      shortLabel: "SOLAR 3D",
      href: "/solar-system",
      code: "SYS-01",
      icon: Orbit,
      desc: "3D Keplerian Planetary Orrery",
    },
    {
      id: "sky",
      label: "SKY MAP",
      shortLabel: "SKY DOME",
      href: "/sky",
      code: "SYS-02",
      icon: Sparkles,
      desc: "IAU Sky Dome & Earth Observatory",
    },
    {
      id: "globe",
      label: "ASTEROID RADAR",
      shortLabel: "ASTEROIDS",
      href: "/explore",
      code: "SYS-03",
      icon: Crosshair,
      desc: "NASA NeoWs Planetary Defense Radar",
    },
    {
      id: "satellites",
      label: "SATELLITES",
      shortLabel: "SATELLITES",
      href: "/iss",
      code: "SYS-04",
      icon: Satellite,
      desc: "Real-Time SGP4 Orbital Fleet Tracker",
    },
  ];

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + " UTC");

      // Calculate Greenwich Mean Sidereal Time (GMST)
      const d = now.getTime() / 86400000 + 2440587.5 - 2451545.0;
      let gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
      if (gmstHours < 0) gmstHours += 24;
      const gh = String(Math.floor(gmstHours)).padStart(2, "0");
      const gm = String(Math.floor((gmstHours % 1) * 60)).padStart(2, "0");
      const gs = String(Math.floor(((gmstHours % 1) * 60 % 1) * 60)).padStart(2, "0");
      setGmst(`${gh}:${gm}:${gs} GMST`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-5 lg:px-7 pt-2.5 pb-2 transition-all select-none bg-gradient-to-b from-[#020617]/95 via-[#020617]/80 to-transparent backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* ── Left: Prominent Official Cakrapala Logo & Brand ───────────────── */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden bg-[#060a14]/95 border border-cyan-500/50 p-1 shadow-[0_0_20px_rgba(6,182,212,0.35)] group-hover:border-cyan-300 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all flex items-center justify-center">
            <Image
              src="/cakrapala.png"
              alt="Cakrapala Aerospace Logo"
              width={48}
              height={48}
              className="object-contain w-full h-full group-hover:scale-105 transition-transform drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-mono font-black tracking-[0.2em] text-base sm:text-lg text-white uppercase bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-200">
                CAKRAPALA
              </span>
              <span className="text-[8px] sm:text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold hidden md:inline-block">
                NASA &bull; FLIGHT DECK
              </span>
            </div>
            <p className="text-[9px] font-mono text-slate-400 tracking-wider uppercase hidden xl:block">
              Deep Space Planetary Operations Console
            </p>
          </div>
        </Link>

        {/* ── Center: Desktop / Laptop Navigation HUD (Clean, No Truncation) ── */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-[#060b18]/90 border border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl font-mono shrink-0">
          {NAV_ITEMS.map((item) => {
            const isCurrent =
              item.id === "overview" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`relative group px-3 xl:px-4 py-1.5 rounded-xl text-[11px] font-bold tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isCurrent
                    ? "bg-[#16233b] text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)]"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent hover:border-slate-700"
                }`}
              >
                {/* NASA Tactical Corner Bracket Reticles on Active */}
                {isCurrent && (
                  <>
                    <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                    <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />
                  </>
                )}

                {/* Status Dot */}
                {isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
                ) : (
                  <span className="text-[9px] text-slate-600 group-hover:text-cyan-400 transition-colors font-mono hidden xl:inline shrink-0">
                    {item.code}
                  </span>
                )}

                {/* System Label (Full on XL, compact on LG) */}
                <span className="hidden xl:inline">{item.label}</span>
                <span className="inline xl:hidden">{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Right: AI Terminal, Telemetry Clock & Mobile Drawer Toggle ─── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono text-xs">
          {/* AI Terminal Trigger Button */}
          <button
            type="button"
            onClick={() => setIsAiTerminalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl sm:rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 hover:border-cyan-300 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all font-mono font-bold text-[10px] sm:text-[11px] cursor-pointer"
            title="Open AI Astro-Terminal"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">AI TERMINAL</span>
            <span className="inline sm:hidden">AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          </button>

          {/* Live Telemetry Clock Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl sm:rounded-2xl bg-[#060b18]/90 border border-slate-700/80 text-slate-300 shadow-md backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 tracking-wider hidden md:inline">
                LIVE
              </span>
              <span className="text-slate-600 hidden md:inline">|</span>
              <span className="text-cyan-300 text-[10px] sm:text-[11px] font-bold tracking-tight">
                {timeUtc || "00:00:00 UTC"}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono hidden 2xl:block">
              {gmst}
            </div>
          </div>

          {/* Mobile Menu Button (Visible < lg) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#060b18]/90 hover:bg-[#16233b] border border-slate-700/80 text-cyan-300 hover:text-white transition-all shadow-md cursor-pointer"
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
