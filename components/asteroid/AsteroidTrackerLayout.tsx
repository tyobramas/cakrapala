"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { AsteroidNeoObject, AsteroidFeedSummary } from "@/lib/asteroid/types";
import { OpsModeProvider } from "@/lib/ui/opsMode";
import ObservatoryLoader from "@/components/ui/ObservatoryLoader";
import AsteroidFeedPanel from "./AsteroidFeedPanel";
import AsteroidDetailModal from "./AsteroidDetailModal";
import ScaleRuler, { type Landmark } from "./ScaleRuler";
import {
  ArrowLeft,
  RefreshCw,
  PanelRightClose,
  PanelRightOpen,
  Ruler,
  Maximize2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

const Asteroid3DRadarScene = dynamic(() => import("./Asteroid3DRadarScene"), {
  ssr: false,
  loading: () => (
    <ObservatoryLoader
      variant="container"
      title="CAKRAPALA"
      subtitle="Calibrating topocentric NEO radar"
      className="h-full w-full"
    />
  ),
});

export type ScanRangeDays = 1 | 3 | 7;

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export default function AsteroidTrackerLayout() {
  return (
    <OpsModeProvider>
      <TrackerShell />
    </OpsModeProvider>
  );
}

function TrackerShell() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [scanRange, setScanRange] = useState<ScanRangeDays>(1);
  const [asteroids, setAsteroids] = useState<AsteroidNeoObject[]>([]);
  const [summary, setSummary] = useState<AsteroidFeedSummary | null>(null);
  const [dataSource, setDataSource] = useState<string>("nasa_api");
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidNeoObject | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [showScaleBar, setShowScaleBar] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Fetch asteroid data from NASA JPL NeoWs API (supports 1D / 3D / 7D range)
  const fetchAsteroids = useCallback(async (startDate: string, rangeDays: ScanRangeDays) => {
    setIsLoading(true);
    try {
      const endDate = rangeDays === 1 ? startDate : addDaysIso(startDate, rangeDays - 1);
      const res = await fetch(`/api/asteroids?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        const list: AsteroidNeoObject[] = (data.asteroids || []).slice().sort(
          (a: AsteroidNeoObject, b: AsteroidNeoObject) =>
            (a.closest_miss_distance_ld ?? 999) - (b.closest_miss_distance_ld ?? 999),
        );
        setAsteroids(list);
        setSummary(data.summary || null);
        setDataSource(data.source || "nasa_api");
        setLastFetchedAt(new Date());
        setSelectedAsteroid((prev) => {
          if (prev && list.some((item) => item.id === prev.id)) {
            return list.find((item) => item.id === prev.id) || list[0] || null;
          }
          return list[0] || null;
        });
      }
    } catch (err) {
      console.error("Failed to load asteroids:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void fetchAsteroids(selectedDate, scanRange);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedDate, scanRange, fetchAsteroids]);

  // Collapse catalog by default on narrow viewports so 3D radar stays unobstructed
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      queueMicrotask(() => setIsCatalogOpen(false));
    }
  }, []);

  // Keyboard shortcuts: Up/Down cycle target, I inspect, S scale ruler, Esc close modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape" && isInspectorOpen) {
        setIsInspectorOpen(false);
        return;
      }
      if ((e.key === "i" || e.key === "I") && selectedAsteroid) {
        setIsInspectorOpen((v) => !v);
        return;
      }
      if (e.key === "s" || e.key === "S") {
        setShowScaleBar((v) => !v);
        return;
      }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && asteroids.length > 0) {
        e.preventDefault();
        const idx = selectedAsteroid
          ? asteroids.findIndex((a) => a.id === selectedAsteroid.id)
          : -1;
        const nextIdx =
          e.key === "ArrowDown"
            ? (idx + 1) % asteroids.length
            : (idx - 1 + asteroids.length) % asteroids.length;
        setSelectedAsteroid(asteroids[nextIdx]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [asteroids, selectedAsteroid, isInspectorOpen]);

  const handleOpenInspector = useCallback((asteroid: AsteroidNeoObject) => {
    setSelectedAsteroid(asteroid);
    setIsInspectorOpen(true);
  }, []);

  const closestAsteroid = useMemo(() => {
    if (asteroids.length === 0) return null;
    return asteroids.reduce((best, cur) =>
      (cur.closest_miss_distance_ld ?? 999) < (best.closest_miss_distance_ld ?? 999) ? cur : best,
    );
  }, [asteroids]);

  const isHazardPresent = (summary?.hazardousCount || 0) > 0;
  const isLiveNasa = dataSource === "nasa_api" || dataSource === "cache";

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#02040a] font-sans text-slate-100 select-none">
      {/* ── Full-Viewport Edge-to-Edge 3D NEO Proximity Radar ─────────────── */}
      <div className="absolute inset-0">
        <Asteroid3DRadarScene
          asteroids={asteroids}
          selectedAsteroid={selectedAsteroid}
          onSelectAsteroid={(neo: AsteroidNeoObject) => setSelectedAsteroid(neo)}
          onOpenInspector={handleOpenInspector}
          selectedLandmark={selectedLandmark}
          isLoading={isLoading}
          rightDrawerOpen={isCatalogOpen}
          scaleBarVisible={showScaleBar}
        />
      </div>

      {/* ── Compact Unified Top Header Bar (Corner-Pinned Glass Capsules) ─── */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-2 pt-2 sm:px-2.5 sm:pt-2.5">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-2">
          {/* Top-Left Corner: Ultra-Compact Unified Back + Brand Capsule */}
          <div className="flex h-8 shrink-0 items-center rounded-full border border-white/[0.10] bg-[#030714]/72 p-0.5 pr-3 backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
            <Link
              href="/"
              aria-label="Back to Home"
              title="Back to Home"
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.10] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            </Link>

            <span className="mx-1 h-3.5 w-px bg-white/[0.12]" />

            <div className="flex items-center gap-1.5 pl-1">
              <Image
                src="/cakrapala1.png"
                alt="Cakrapala"
                width={18}
                height={18}
                className="h-[18px] w-[18px] rounded-full object-contain opacity-95"
              />
              <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-medium tracking-[0.18em] text-white/95">
                NEO RADAR
              </span>
            </div>
          </div>

          {/* Top-Center: Compact Live NASA Telemetry Strip */}
          <div className="hidden h-8 items-center gap-2.5 rounded-full border border-white/[0.09] bg-[#030714]/65 px-3.5 font-mono text-[10px] backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.4)] lg:flex">
            <span className="flex items-center gap-1.5">
              {isHazardPresent ? (
                <AlertTriangle className="h-3 w-3 text-rose-400" />
              ) : (
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
              )}
              <span
                className={`font-semibold tracking-[0.14em] uppercase ${
                  isHazardPresent ? "text-rose-300" : "text-emerald-300"
                }`}
              >
                {isLoading ? "Scanning" : isHazardPresent ? `${summary?.hazardousCount} PHA` : "Nominal"}
              </span>
            </span>

            <span className="h-3 w-px bg-white/[0.10]" />

            <span className="text-slate-400">
              TRACKED{" "}
              <span className="font-semibold text-white tabular-nums">
                {isLoading ? "—" : summary?.totalTracked ?? 0}
              </span>
            </span>

            <span className="h-3 w-px bg-white/[0.10]" />

            <button
              type="button"
              disabled={!closestAsteroid}
              onClick={() => closestAsteroid && setSelectedAsteroid(closestAsteroid)}
              title="Lock onto closest approaching asteroid"
              className="cursor-pointer text-slate-400 transition-colors hover:text-sky-300 disabled:cursor-default"
            >
              CLOSEST{" "}
              <span className="font-semibold text-sky-300 tabular-nums">
                {isLoading
                  ? "—"
                  : summary?.closestObject
                    ? `${summary.closestObject.distanceLd.toFixed(2)} LD`
                    : "N/A"}
              </span>
            </button>

            <span className="hidden h-3 w-px bg-white/[0.10] xl:inline-block" />

            <span className="hidden text-slate-400 xl:inline">
              PEAK{" "}
              <span className="font-semibold text-white tabular-nums">
                {isLoading
                  ? "—"
                  : summary?.fastestObject
                    ? `${(summary.fastestObject.velocityKms || 0).toFixed(1)} km/s`
                    : "N/A"}
              </span>
            </span>

            <span className="hidden h-3 w-px bg-white/[0.10] 2xl:inline-block" />

            <span
              className="hidden items-center gap-1.5 text-[9px] tracking-[0.12em] text-slate-400 uppercase 2xl:inline-flex"
              title={lastFetchedAt ? `Updated ${lastFetchedAt.toUTCString()}` : "NASA JPL NeoWs"}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLiveNasa ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {isLiveNasa ? "NASA JPL NeoWs" : "Verified Archive"}
            </span>
          </div>

          {/* Top-Right: Multi-Day Scan Window + Scale Toggle + Refresh + Catalog Drawer */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Scan Window Selector (1D / 3D / 7D) */}
            <div className="hidden h-8 items-center rounded-full border border-white/[0.09] bg-[#030714]/65 p-0.5 font-mono text-[10px] backdrop-blur-2xl sm:flex">
              {([1, 3, 7] as ScanRangeDays[]).map((days) => {
                const active = scanRange === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setScanRange(days)}
                    title={`Scan ${days}-day NASA close-approach window`}
                    className={`h-7 cursor-pointer rounded-full px-2.5 font-medium tracking-wider transition-all ${
                      active
                        ? "bg-white/[0.14] text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {days}D
                  </button>
                );
              })}
            </div>

            {/* Scale Comparator Toggle */}
            <button
              type="button"
              onClick={() => setShowScaleBar((v) => !v)}
              title="Toggle Size Uncertainty & 3D Landmark Scale (S)"
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border backdrop-blur-2xl transition-all ${
                showScaleBar
                  ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                  : "border-white/[0.10] bg-[#030714]/65 text-slate-300 hover:border-white/25 hover:text-white"
              }`}
            >
              <Ruler className="h-3.5 w-3.5" />
            </button>

            {/* Refresh Feed */}
            <button
              type="button"
              onClick={() => fetchAsteroids(selectedDate, scanRange)}
              title="Refresh NASA JPL NeoWs Feed"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-[#030714]/65 text-slate-300 backdrop-blur-2xl transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-sky-300" : ""}`} />
            </button>

            {/* Collapsible Catalog Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsCatalogOpen((v) => !v)}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] font-medium tracking-[0.14em] uppercase backdrop-blur-2xl transition-all ${
                isCatalogOpen
                  ? "border-white/25 bg-white/[0.12] text-white"
                  : "border-white/[0.10] bg-[#030714]/65 text-slate-300 hover:border-white/25 hover:text-white"
              }`}
            >
              {isCatalogOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Catalog</span>
              <span className="rounded-full bg-white/[0.10] px-1.5 py-0.5 text-[9px] tabular-nums text-sky-200">
                {asteroids.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Bottom-Left Floating Target Summary + Logarithmic Scale Ruler ─── */}
      {showScaleBar && (
        <div
          className={`pointer-events-none fixed bottom-3 left-3 z-30 transition-all duration-200 ${
            isCatalogOpen ? "right-3 lg:right-[360px]" : "right-3"
          }`}
        >
          <div className="pointer-events-auto max-w-[660px]">
            <ScaleRuler
              selectedAsteroid={selectedAsteroid}
              selectedLandmark={selectedLandmark}
              onSelectLandmark={setSelectedLandmark}
              onOpenInspector={selectedAsteroid ? () => setIsInspectorOpen(true) : undefined}
            />
          </div>
        </div>
      )}

      {/* Quick Inspect Pill when Scale Bar is hidden & an asteroid is selected */}
      {!showScaleBar && selectedAsteroid && (
        <div className="fixed bottom-3 left-3 z-30">
          <button
            type="button"
            onClick={() => setIsInspectorOpen(true)}
            className="flex h-9 cursor-pointer items-center gap-2.5 rounded-full border border-white/[0.12] bg-[#030714]/78 px-3.5 font-mono text-[11px] text-slate-100 backdrop-blur-2xl shadow-[0_12px_36px_rgba(0,0,0,0.55)] transition-all hover:border-sky-400/45 hover:bg-[#061026]/90"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                selectedAsteroid.is_potentially_hazardous_asteroid
                  ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.85)]"
                  : "bg-sky-300"
              }`}
            />
            <span className="font-semibold text-white">{selectedAsteroid.name}</span>
            <span className="text-slate-400 tabular-nums">
              {(selectedAsteroid.closest_miss_distance_ld ?? 0).toFixed(2)} LD ·{" "}
              {selectedAsteroid.avg_diameter_meters ?? 0}m
            </span>
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] tracking-wider text-sky-200 uppercase">
              <Maximize2 className="h-2.5 w-2.5" />
              Inspect
            </span>
          </button>
        </div>
      )}

      {/* ── Right Floating Frosted Glass NEO Catalog Drawer ───────────────── */}
      <aside
        className={`fixed top-13 right-2.5 bottom-2.5 z-30 w-[calc(100vw-20px)] max-w-[344px] transition-all duration-200 ease-out sm:right-3 sm:bottom-3 ${
          isCatalogOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-[110%] opacity-0 pointer-events-none"
        }`}
      >
        <AsteroidFeedPanel
          asteroids={asteroids}
          selectedAsteroid={selectedAsteroid}
          onSelectAsteroid={(neo: AsteroidNeoObject) => setSelectedAsteroid(neo)}
          onOpenInspector={handleOpenInspector}
          selectedDate={selectedDate}
          onChangeDate={(d) => setSelectedDate(d)}
          scanRange={scanRange}
          onChangeScanRange={setScanRange}
          isLoading={isLoading}
        />
      </aside>

      {/* ── Deep-Dive 3D Asteroid Inspector & Impact Physics Simulator ────── */}
      <AsteroidDetailModal
        asteroid={selectedAsteroid}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </div>
  );
}
