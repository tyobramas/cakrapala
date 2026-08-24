"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Radio, ArrowUpRight, Users, Globe2 } from "lucide-react";
import { fetchLiveISSTelemetry, type ISSTelemetry, CURRENT_ISS_CREW } from "@/lib/iss/issService";

export default function ISSTrackerWidget() {
  const [telemetry, setTelemetry] = useState<ISSTelemetry | null>(null);

  useEffect(() => {
    let isMounted = true;

    const update = async () => {
      const data = await fetchLiveISSTelemetry();
      if (isMounted) {
        setTelemetry(data);
      }
    };

    update();
    const interval = setInterval(update, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getMapPercent = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(4, Math.min(96, y)) };
  };

  const currentPos = telemetry
    ? getMapPercent(telemetry.latitude, telemetry.longitude)
    : { x: 50, y: 50 };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#09152b]/90 via-[#060e1d]/95 to-[#020617] border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.15)] p-6 sm:p-10">
        {/* Background Radar Grid */}
        <div className="absolute inset-0 space-grid-pattern opacity-40 pointer-events-none" />

        {/* Header telemetry badge */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.25)]">
              <Radio className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  International Space Station (ISS)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                NORAD ID: 25544 // INCLINATION: 51.64&deg; // ORBIT: LOW EARTH ORBIT (LEO)
              </p>
            </div>
          </div>

          <Link
            href="/iss"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-mono transition-all group"
          >
            <span>FULL MISSION CONSOLE</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* 2D Orbital Map & Telemetry Dashboard */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Mini World Map Projection */}
          <div className="lg:col-span-7 bg-[#030914] rounded-2xl border border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between min-h-[300px] sm:min-h-[360px]">
            <div className="relative w-full h-full flex-1 flex items-center justify-center">
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full opacity-35 filter drop-shadow-[0_0_10px_rgba(56,189,248,0.2)]"
              >
                <line x1="0" y1="250" x2="1000" y2="250" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4 4" />
                <line x1="500" y1="0" x2="500" y2="500" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4 4" />
                
                <path
                  d="M150,120 Q180,100 230,130 Q270,180 250,220 Q220,240 180,200 Z M220,260 Q270,280 280,360 Q240,440 210,380 Q190,300 220,260 Z M460,110 Q520,90 560,140 Q530,200 480,180 Z M470,210 Q540,220 560,320 Q500,420 460,330 Z M560,120 Q700,90 820,160 Q860,260 740,240 Q620,220 560,120 Z M750,320 Q840,310 860,390 Q780,430 730,370 Z"
                  fill="rgba(56, 189, 248, 0.12)"
                  stroke="rgba(56, 189, 248, 0.4)"
                  strokeWidth="1.2"
                />
              </svg>

              {/* Real-time ISS Position Indicator */}
              {telemetry && (
                <div
                  className="absolute transition-all duration-1000 ease-linear -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                  style={{
                    left: `${currentPos.x}%`,
                    top: `${currentPos.y}%`,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-amber-400/20 animate-ping absolute" />
                    <div className="w-5 h-5 rounded-full bg-amber-500/40 border border-amber-300 flex items-center justify-center shadow-[0_0_15px_#f59e0b]">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </div>
                  <div className="mt-1.5 px-2 py-0.5 rounded bg-black/90 border border-amber-400/50 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-lg">
                    ISS ({(telemetry.latitude > 0 ? "+" : "") + telemetry.latitude}&deg;,{" "}
                    {(telemetry.longitude > 0 ? "+" : "") + telemetry.longitude}&deg;)
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-slate-800/80 pt-2.5 mt-2">
              <span className="flex items-center gap-1 text-slate-400">
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                EQUIRECTANGULAR GROUND TRACK
              </span>
              <span>UPDATE STREAM: 1Hz</span>
            </div>
          </div>

          {/* Telemetry Metrics Columns */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5 font-mono">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">LATITUDE</div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {telemetry ? `${telemetry.latitude}°` : "..."}
              </div>
              <div className="text-[10px] text-cyan-400 mt-1">
                {telemetry && telemetry.latitude >= 0 ? "Northern Hemisphere" : "Southern Hemisphere"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">LONGITUDE</div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {telemetry ? `${telemetry.longitude}°` : "..."}
              </div>
              <div className="text-[10px] text-cyan-400 mt-1">
                {telemetry && telemetry.longitude >= 0 ? "East" : "West"} Prime Meridian
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">ALTITUDE</div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {telemetry ? `${telemetry.altitudeKm} km` : "..."}
              </div>
              <div className="text-[10px] text-amber-400 mt-1">Low Earth Orbit (LEO)</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">ORBITAL VELOCITY</div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {telemetry ? `${telemetry.velocityKmh.toLocaleString()} ` : "..."}
                <span className="text-xs font-normal text-slate-400">km/h</span>
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">~7.66 km/second</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">SOLAR LIGHTING</div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    telemetry?.visibility === "daylight"
                      ? "bg-amber-400 shadow-[0_0_10px_#f59e0b]"
                      : "bg-indigo-400 shadow-[0_0_10px_#818cf8]"
                  }`}
                />
                <span className="capitalize">{telemetry?.visibility || "Daylight"}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {telemetry?.visibility === "daylight" ? "Solar array generation" : "Earth shadow transit"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">ACTIVE CREW</div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>{CURRENT_ISS_CREW.length} Astronauts</span>
              </div>
              <div className="text-[10px] text-cyan-400 mt-1">Expedition 72 / 73</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
