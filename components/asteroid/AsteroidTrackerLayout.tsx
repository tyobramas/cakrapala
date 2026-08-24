"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AsteroidNeoObject, AsteroidFeedSummary } from "@/lib/asteroid/types";
import Asteroid3DRadarScene from "./Asteroid3DRadarScene";
import AsteroidTelemetryHUD from "./AsteroidTelemetryHUD";
import AsteroidFeedPanel from "./AsteroidFeedPanel";
import AsteroidDetailModal from "./AsteroidDetailModal";
import {
  ChevronLeft,
  RefreshCw,
} from "lucide-react";

export default function AsteroidTrackerLayout() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [asteroids, setAsteroids] = useState<AsteroidNeoObject[]>([]);
  const [summary, setSummary] = useState<AsteroidFeedSummary | null>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidNeoObject | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch asteroid data from API
  const fetchAsteroids = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      // Fetch 1 day or range
      const res = await fetch(`/api/asteroids?start_date=${date}&end_date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAsteroids(data.asteroids || []);
        setSummary(data.summary || null);
        if (data.asteroids && data.asteroids.length > 0) {
          setSelectedAsteroid(data.asteroids[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load asteroids:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAsteroids(selectedDate);
  }, [selectedDate, fetchAsteroids]);

  const handleOpenInspector = (asteroid: AsteroidNeoObject) => {
    setSelectedAsteroid(asteroid);
    setIsInspectorOpen(true);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#020617] text-white select-none font-mono">
      {/* ── Top Master Header ──────────────────────────────────────────────── */}
      <header className="h-12 bg-[#050b18] border-b border-slate-800 flex items-center justify-between px-4 z-30 shrink-0">
        {/* Left: Brand & Module Switcher */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span className="font-bold tracking-widest text-sm bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              CAKRAPALA
            </span>
          </Link>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Module Breadcrumb & Navigation */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[10px]">
              SYS-03
            </span>
            <span className="font-bold text-white tracking-wider hidden md:inline">
              ASTEROID DEFENSE &amp; NEO RADAR
            </span>
          </div>
        </div>

        {/* Right: Back to Home + Refresh Button */}
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all text-xs font-bold group"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>BACK TO HOME</span>
          </Link>

          <button
            onClick={() => fetchAsteroids(selectedDate)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Refresh NASA Telemetry Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* ── Sub-Header Telemetry HUD Bar ───────────────────────────────────── */}
      <AsteroidTelemetryHUD summary={summary} isLoading={isLoading} />

      {/* ── Main Viewport Area ─────────────────────────────────────────────── */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Center: 3D Proximity Radar Canvas */}
        <div className="flex-1 h-full relative">
          <Asteroid3DRadarScene
            asteroids={asteroids}
            selectedAsteroid={selectedAsteroid}
            onSelectAsteroid={(neo) => {
              setSelectedAsteroid(neo);
            }}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Permanent NEO Feed Deck */}
        <AsteroidFeedPanel
          asteroids={asteroids}
          selectedAsteroid={selectedAsteroid}
          onSelectAsteroid={(neo) => setSelectedAsteroid(neo)}
          onOpenInspector={handleOpenInspector}
          selectedDate={selectedDate}
          onChangeDate={(d) => setSelectedDate(d)}
          isLoading={isLoading}
        />
      </div>

      {/* ── Deep Dive Asteroid Detail Modal ─────────────────────────────────── */}
      <AsteroidDetailModal
        asteroid={selectedAsteroid}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </div>
  );
}
