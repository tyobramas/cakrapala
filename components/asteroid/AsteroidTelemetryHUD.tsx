"use client";

import React, { useEffect, useState } from "react";
import { AsteroidFeedSummary } from "@/lib/asteroid/types";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Target,
  Gauge,
  Clock,
  Radio,
  Sparkles,
} from "lucide-react";

interface AsteroidTelemetryHUDProps {
  summary: AsteroidFeedSummary | null;
  isLoading?: boolean;
}

export default function AsteroidTelemetryHUD({ summary, isLoading }: AsteroidTelemetryHUDProps) {
  const [utcTime, setUtcTime] = useState<string>("");
  const [gmstTime, setGmstTime] = useState<string>("");

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + " UTC");

      // Calculate Greenwich Mean Sidereal Time (GMST)
      const d = now.getTime() / 86400000 + 2440587.5 - 2451545.0;
      let gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
      if (gmstHours < 0) gmstHours += 24;
      const gh = String(Math.floor(gmstHours)).padStart(2, "0");
      const gm = String(Math.floor((gmstHours % 1) * 60)).padStart(2, "0");
      const gs = String(Math.floor(((gmstHours % 1) * 60 % 1) * 60)).padStart(2, "0");
      setGmstTime(`${gh}:${gm}:${gs} GMST`);
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const defcon = summary?.defconLevel || 5;
  const isHazardPresent = (summary?.hazardousCount || 0) > 0;

  return (
    <div className="w-full bg-[#050b18]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 font-mono">
        {/* Left: Planetary Defense Threat Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
              isHazardPresent
                ? "bg-red-500/15 border-red-500/50 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {isHazardPresent ? (
              <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <div className="text-[10px] text-slate-400 tracking-widest leading-none">
                PLANETARY DEFENSE
              </div>
              <div className="text-xs font-bold tracking-tight">
                {isLoading ? "CALCULATING THREAT..." : summary?.defconTitle || "DEFCON 5 — RADAR ACTIVE"}
              </div>
            </div>
          </div>

          {/* Time Sync Indicators */}
          <div className="hidden lg:flex items-center gap-2.5 text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{utcTime || "00:00:00 UTC"}</span>
            <span className="text-slate-600">|</span>
            <span className="text-indigo-300">{gmstTime || "00:00:00 GMST"}</span>
          </div>
        </div>

        {/* Right: Key Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          {/* Card 1: Active NEO Count */}
          <div className="bg-slate-900/70 border border-slate-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">TRACKED OBJECTS</div>
              <div className="text-xs font-bold text-white mt-0.5">
                {isLoading ? "..." : `${summary?.totalTracked || 0} NEOs`}
                {isHazardPresent && (
                  <span className="ml-1 text-[10px] text-red-400 font-normal">
                    ({summary?.hazardousCount} PHA)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Closest Flyby */}
          <div className="bg-slate-900/70 border border-slate-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Target className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">CLOSEST FLYBY</div>
              <div className="text-xs font-bold text-emerald-300 mt-0.5 truncate">
                {isLoading ? "..." : summary?.closestObject ? `${summary.closestObject.distanceLd.toFixed(2)} LD` : "N/A"}
                <span className="text-[9px] text-slate-400 ml-1 font-normal">
                  ({Math.round((summary?.closestObject?.distanceKm || 0) / 1000).toLocaleString()}k km)
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Fastest Velocity */}
          <div className="bg-slate-900/70 border border-slate-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">MAX VELOCITY</div>
              <div className="text-xs font-bold text-amber-300 mt-0.5">
                {isLoading ? "..." : summary?.fastestObject ? `${Math.round(summary.fastestObject.velocityKmh).toLocaleString()} km/h` : "N/A"}
              </div>
            </div>
          </div>

          {/* Card 4: Largest Object */}
          <div className="bg-slate-900/70 border border-slate-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">LARGEST DIAMETER</div>
              <div className="text-xs font-bold text-indigo-300 mt-0.5 truncate">
                {isLoading ? "..." : summary?.largestObject ? `${summary.largestObject.diameterMeters} meters` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
