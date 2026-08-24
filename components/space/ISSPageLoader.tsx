"use client";

import { useState, useEffect } from "react";
import { Satellite } from "lucide-react";

interface ISSPageLoaderProps {
  onReady: () => void;
}

export default function ISSPageLoader({ onReady }: ISSPageLoaderProps) {
  const [progress, setProgress] = useState(10);
  const [status, setStatus] = useState("ACQUIRING NORAD UPLINK...");

  useEffect(() => {
    const stages = [
      { delay: 80,  progress: 28, status: "LOCKING TLE ORBITAL ELEMENTS..." },
      { delay: 180, progress: 48, status: "CALIBRATING GROUND TRACK ENGINE..." },
      { delay: 320, progress: 65, status: "LOADING EARTH SATELLITE MAP..." },
      { delay: 480, progress: 80, status: "SYNCHRONISING ISS TELEMETRY STREAM..." },
      { delay: 640, progress: 94, status: "MISSION CONSOLE INITIALIZING..." },
      { delay: 820, progress: 100, status: "SYSTEMS NOMINAL — GO FOR LAUNCH" },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const stage of stages) {
      timers.push(
        setTimeout(() => {
          setProgress(stage.progress);
          setStatus(stage.status);
        }, stage.delay)
      );
    }

    // Trigger ready after last stage settles
    timers.push(setTimeout(onReady, 1050));

    return () => timers.forEach(clearTimeout);
  }, [onReady]);

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col items-center justify-center">
      {/* Deep-space subtle gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,18,50,0.9)_0%,_rgba(2,6,23,1)_80%)]" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">

        {/* ── Orbital Spinner System ──────────────────────────────────────────── */}
        <div className="relative w-32 h-32 flex items-center justify-center mb-2">
          {/* Outermost slow dotted ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20 animate-[spin_18s_linear_infinite]" />
          {/* Mid counter-rotating ring */}
          <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-cyan-400 border-b-amber-400 animate-[spin_3.5s_linear_infinite_reverse]" />
          {/* Inner ping */}
          <div className="absolute inset-7 rounded-full border border-cyan-300/35 animate-ping opacity-25" />
          {/* ISS icon center */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-cyan-500/40 shadow-[0_0_28px_rgba(6,182,212,0.55)] flex items-center justify-center">
            <Satellite className="w-5 h-5 text-cyan-300" />
          </div>
        </div>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-mono tracking-[0.22em] text-cyan-500 uppercase font-semibold">
            Cakrapala Mission Control
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white">
            ISS Flight Operations Console
          </h1>
          <p className="text-[11px] font-mono text-slate-500 mt-1">
            NORAD 25544 · Inclination 51.64° · Altitude ~418 km
          </p>
        </div>

        {/* ── Progress Bar ────────────────────────────────────────────────────── */}
        <div className="w-72 sm:w-96 bg-slate-900/80 rounded-full p-1 border border-cyan-500/25 shadow-[0_0_18px_rgba(6,182,212,0.12)]">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-400 to-amber-400 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.55)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Status Text ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between w-72 sm:w-96 text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5 truncate pr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
            {status}
          </span>
          <span className="text-cyan-300 font-bold shrink-0">{progress}%</span>
        </div>

        {/* ── Telemetry grid decoration ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 text-[10px] font-mono mt-2 w-72 sm:w-96">
          {[
            { label: "ORBIT", value: "LEO" },
            { label: "PERIOD", value: "92.68 min" },
            { label: "VELOCITY", value: "~27,580 km/h" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-center"
            >
              <div className="text-slate-500 mb-0.5">{item.label}</div>
              <div className="text-cyan-300 font-bold">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
