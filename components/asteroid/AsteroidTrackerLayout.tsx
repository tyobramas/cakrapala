"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AsteroidNeoObject, AsteroidFeedSummary } from "@/lib/asteroid/types";
import { OPS, OPS_TYPE } from "@/lib/ui/opsTheme";
import { OpsModeProvider, useOpsMode } from "@/lib/ui/opsMode";
import ModeToggle from "@/components/ui/ModeToggle";
import Asteroid3DRadarScene from "./Asteroid3DRadarScene";
import AsteroidTelemetryHUD from "./AsteroidTelemetryHUD";
import AsteroidFeedPanel from "./AsteroidFeedPanel";
import AsteroidDetailModal from "./AsteroidDetailModal";
import ScaleRuler, { Landmark } from "./ScaleRuler";
import { ChevronLeft, RefreshCw } from "lucide-react";

export default function AsteroidTrackerLayout() {
  return (
    <OpsModeProvider>
      <TrackerShell />
    </OpsModeProvider>
  );
}

function TrackerShell() {
  const { isOps } = useOpsMode();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [asteroids, setAsteroids] = useState<AsteroidNeoObject[]>([]);
  const [summary, setSummary] = useState<AsteroidFeedSummary | null>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidNeoObject | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Fetch asteroid data from API
  const fetchAsteroids = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/asteroids?start_date=${date}&end_date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAsteroids(data.asteroids || []);
        setSummary(data.summary || null);
        setLastFetchedAt(new Date());
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
    <div
      className="h-screen w-screen overflow-hidden flex flex-col select-none font-mono"
      style={{ background: OPS.bg, color: OPS.text }}
    >
      {/* ── Top Master Header ──────────────────────────────────────────────── */}
      <header
        className="h-11 flex items-center justify-between px-3 z-30 shrink-0 border-b"
        style={{ background: OPS.panel, borderColor: OPS.line }}
      >
        {/* Left: Brand & Module Switcher */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 transition-colors duration-[120ms]"
            style={{ color: OPS.text }}
          >
            <span className="font-orbitron font-bold tracking-[0.28em] text-xs">
              CAKRAPALA
            </span>
          </Link>

          <div className="h-3 w-px" style={{ background: OPS.line }} />

          {/* Module Breadcrumb & Navigation */}
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 border text-[10px] font-semibold tracking-wider"
              style={{ borderColor: OPS.line, color: OPS.textDim }}
            >
              SYS-03
            </span>
            <span className={OPS_TYPE.label + " hidden sm:inline"} style={{ color: OPS.textDim }}>
              {isOps ? "PLANETARY DEFENSE & NEO RADAR" : "Near-Earth Asteroid Radar"}
            </span>
          </div>
        </div>

        {/* Right: Mode Toggle + Refresh Button + Exit Radar */}
        <div className="flex items-center gap-2">
          {/* OPS / PUBLIC Segmented Mode Toggle */}
          <ModeToggle />

          <button
            onClick={() => fetchAsteroids(selectedDate)}
            className="p-1 border transition-colors duration-[120ms] cursor-pointer"
            style={{ borderColor: OPS.line, color: OPS.textDim }}
            title="Refresh NASA Telemetry Feed"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              style={{ color: isLoading ? OPS.accent : "currentColor" }}
            />
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-2.5 py-1 border transition-colors duration-[120ms] text-[11px] font-medium"
            style={{ borderColor: OPS.line, color: OPS.textDim }}
          >
            <ChevronLeft className="w-3 h-3" style={{ color: OPS.accent }} />
            <span>BACK TO HOME</span>
          </Link>
        </div>
      </header>

      {/* ── Sub-Header Telemetry HUD Strip ─────────────────────────────────── */}
      <AsteroidTelemetryHUD
        summary={summary}
        isLoading={isLoading}
        lastFetchedAt={lastFetchedAt}
      />

      {/* ── Main Viewport Area (Flush Panels, 1px Hairline Divider) ─────────── */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Center: 3D Proximity Radar Canvas + Bottom Scale Ruler */}
        <div className="flex-1 h-full flex flex-col relative overflow-hidden">
          <div className="flex-1 w-full relative min-h-0">
            <Asteroid3DRadarScene
              asteroids={asteroids}
              selectedAsteroid={selectedAsteroid}
              onSelectAsteroid={(neo: AsteroidNeoObject) => {
                setSelectedAsteroid(neo);
              }}
              selectedLandmark={selectedLandmark}
              isLoading={isLoading}
            />
          </div>

          {/* Interactive Logarithmic Scale & Uncertainty Band Ruler */}
          <ScaleRuler
            selectedAsteroid={selectedAsteroid}
            selectedLandmark={selectedLandmark}
            onSelectLandmark={setSelectedLandmark}
          />
        </div>

        {/* Right: Permanent NEO Feed Deck */}
        <AsteroidFeedPanel
          asteroids={asteroids}
          selectedAsteroid={selectedAsteroid}
          onSelectAsteroid={(neo: AsteroidNeoObject) => setSelectedAsteroid(neo)}
          onOpenInspector={handleOpenInspector}
          selectedDate={selectedDate}
          onChangeDate={(d) => setSelectedDate(d)}
          isLoading={isLoading}
        />
      </div>

      {/* ── Deep Dive Asteroid Detail Modal (Preserved intact) ──────────────── */}
      <AsteroidDetailModal
        asteroid={selectedAsteroid}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </div>
  );
}
