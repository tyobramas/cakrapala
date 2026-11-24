"use client";

import React, { useState, useMemo } from "react";
import { AsteroidNeoObject, AsteroidSortOption } from "@/lib/asteroid/types";
import { formatApproachCountdown } from "@/lib/asteroid/asteroidMath";
import type { ScanRangeDays } from "./AsteroidTrackerLayout";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Info,
  Zap,
} from "lucide-react";

type ExtendedSortOption = AsteroidSortOption | "energy";

interface AsteroidFeedPanelProps {
  asteroids: AsteroidNeoObject[];
  selectedAsteroid: AsteroidNeoObject | null;
  onSelectAsteroid: (asteroid: AsteroidNeoObject) => void;
  onOpenInspector: (asteroid: AsteroidNeoObject) => void;
  selectedDate: string;
  onChangeDate: (newDate: string) => void;
  scanRange: ScanRangeDays;
  onChangeScanRange: (days: ScanRangeDays) => void;
  isLoading?: boolean;
}

export default function AsteroidFeedPanel({
  asteroids,
  selectedAsteroid,
  onSelectAsteroid,
  onOpenInspector,
  selectedDate,
  onChangeDate,
  scanRange,
  onChangeScanRange,
  isLoading,
}: AsteroidFeedPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pha" | "close" | "large">("all");
  const [sortBy, setSortBy] = useState<ExtendedSortOption>("distance");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleShiftDay = (offsetDays: number) => {
    const current = new Date(`${selectedDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + offsetDays);
    onChangeDate(current.toISOString().split("T")[0]);
  };

  const counts = useMemo(() => {
    let pha = 0;
    let close = 0;
    let large = 0;
    for (const neo of asteroids) {
      if (neo.is_potentially_hazardous_asteroid) pha++;
      if ((neo.closest_miss_distance_ld ?? 99) < 5) close++;
      if ((neo.avg_diameter_meters ?? 0) >= 100) large++;
    }
    return { pha, close, large };
  }, [asteroids]);

  const filteredAsteroids = useMemo(() => {
    return asteroids
      .filter((neo) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!neo.name.toLowerCase().includes(q) && !neo.id.includes(q)) return false;
        }
        if (filterMode === "pha" && !neo.is_potentially_hazardous_asteroid) return false;
        if (filterMode === "close" && (neo.closest_miss_distance_ld ?? 99) >= 5) return false;
        if (filterMode === "large" && (neo.avg_diameter_meters ?? 0) < 100) return false;
        return true;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;
        switch (sortBy) {
          case "distance":
            valA = a.closest_miss_distance_ld ?? 999;
            valB = b.closest_miss_distance_ld ?? 999;
            break;
          case "velocity":
            valA = a.velocity_kms ?? 0;
            valB = b.velocity_kms ?? 0;
            break;
          case "diameter":
            valA = a.avg_diameter_meters ?? 0;
            valB = b.avg_diameter_meters ?? 0;
            break;
          case "energy":
            valA = a.kinetic_energy_megatons ?? 0;
            valB = b.kinetic_energy_megatons ?? 0;
            break;
          case "name":
            return sortOrder === "asc"
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          default:
            valA = a.closest_miss_distance_ld ?? 999;
            valB = b.closest_miss_distance_ld ?? 999;
        }
        return sortOrder === "asc" ? valA - valB : valB - valA;
      });
  }, [asteroids, searchQuery, filterMode, sortBy, sortOrder]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#030714]/78 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
      {/* ── Compact Header + Date & Range Controls ───────────────────────── */}
      <div className="space-y-2 border-b border-white/[0.08] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.85)]" />
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-white/90 uppercase">
              NEO Ephemeris
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono text-[9.5px]">
            {selectedDate !== todayIso && (
              <button
                type="button"
                onClick={() => onChangeDate(todayIso)}
                className="cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[9px] tracking-wider text-sky-200 uppercase transition-colors hover:bg-white/[0.14]"
              >
                Today
              </button>
            )}
            <div className="flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 sm:hidden">
              {([1, 3, 7] as ScanRangeDays[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChangeScanRange(d)}
                  className={`cursor-pointer rounded-full px-1.5 py-0.5 text-[9px] ${
                    scanRange === d ? "bg-white/15 text-white" : "text-slate-400"
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sleek Date Stepper */}
        <div className="flex h-8 items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => handleShiftDay(-1)}
            title="Previous day"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onChangeDate(e.target.value)}
              className="cursor-pointer bg-transparent font-mono text-[11px] font-medium text-white/95 focus:outline-none"
            />
            {scanRange > 1 && (
              <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] text-sky-300">
                +{scanRange - 1}d
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleShiftDay(1)}
            title="Next day"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Compact Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search designation or NASA ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pr-7 pl-8 font-mono text-[11px] text-white placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 font-mono text-[9.5px]">
          {[
            { id: "all", label: `All ${asteroids.length}`, activeClass: "border-white/25 bg-white/[0.12] text-white" },
            { id: "pha", label: `PHA ${counts.pha}`, activeClass: "border-rose-400/45 bg-rose-500/18 text-rose-200" },
            { id: "close", label: `<5 LD ${counts.close}`, activeClass: "border-amber-400/45 bg-amber-500/18 text-amber-200" },
            { id: "large", label: `>100m ${counts.large}`, activeClass: "border-sky-400/45 bg-sky-500/18 text-sky-200" },
          ].map((chip) => {
            const active = filterMode === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterMode(chip.id as typeof filterMode)}
                className={`flex-1 cursor-pointer rounded-lg border py-1 text-center font-medium transition-all ${
                  active
                    ? chip.activeClass
                    : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.15] hover:text-slate-200"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Compact Sort Pills */}
        <div className="flex items-center justify-between pt-0.5 font-mono text-[9.5px] text-slate-500">
          <span className="tracking-[0.14em] uppercase">Sort</span>
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "distance", label: "Dist" },
                { id: "diameter", label: "Size" },
                { id: "velocity", label: "Vel" },
                { id: "energy", label: "Mt" },
              ] as { id: ExtendedSortOption; label: string }[]
            ).map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (sortBy === opt.id) {
                      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
                    } else {
                      setSortBy(opt.id);
                      setSortOrder(opt.id === "distance" ? "asc" : "desc");
                    }
                  }}
                  className={`cursor-pointer rounded-md px-1.5 py-0.5 uppercase transition-colors ${
                    active
                      ? "bg-white/[0.10] font-semibold text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {opt.label}
                  {active ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrollable Compact NEO List ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2.5 font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
            <div className="h-5 w-5 animate-spin rounded-full border border-white/15 border-t-sky-300" />
            <span>Syncing JPL NeoWs...</span>
          </div>
        ) : filteredAsteroids.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 font-mono text-[11px] text-slate-500">
            <Info className="mb-2 h-4 w-4 text-slate-600" />
            <span>No objects match filter</span>
          </div>
        ) : (
          filteredAsteroids.map((neo) => {
            const isSelected = selectedAsteroid?.id === neo.id;
            const isHazard = neo.is_potentially_hazardous_asteroid;
            const distLd = neo.closest_miss_distance_ld ?? 0;
            const isClose = distLd < 5;
            const epoch = neo.close_approach_data?.[0]?.epoch_date_close_approach;
            const countdown = formatApproachCountdown(epoch);
            const orbitType = neo.orbital_data?.orbit_class?.orbit_class_type;
            const energyMt = neo.kinetic_energy_megatons ?? 0;

            return (
              <div
                key={neo.id}
                onClick={() => onSelectAsteroid(neo)}
                className={`group relative flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                  isSelected
                    ? "bg-sky-400/[0.11]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                {/* Left Threat Accent Bar */}
                <span
                  className={`absolute top-1.5 bottom-1.5 left-0 w-[2.5px] rounded-r-full transition-opacity ${
                    isHazard
                      ? "bg-rose-400"
                      : isClose
                        ? "bg-amber-400"
                        : isSelected
                          ? "bg-sky-300"
                          : "bg-emerald-400/50 opacity-50 group-hover:opacity-100"
                  }`}
                />

                {/* Left: Name + Badges + Countdown */}
                <div className="min-w-0 flex-1 pl-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-[12px] font-semibold text-white">
                      {neo.name}
                    </span>
                    {isHazard && (
                      <span className="shrink-0 rounded bg-rose-500/20 px-1 py-0.5 font-mono text-[8.5px] font-bold tracking-wider text-rose-300 uppercase">
                        PHA
                      </span>
                    )}
                    {orbitType && (
                      <span className="hidden shrink-0 rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[8.5px] text-slate-400 sm:inline">
                        {orbitType}
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-slate-400 tabular-nums">
                    <span>{neo.avg_diameter_meters ?? 0}m</span>
                    <span className="text-white/20">·</span>
                    <span>{(neo.velocity_kms ?? 0).toFixed(1)} km/s</span>
                    {energyMt >= 1 && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="inline-flex items-center gap-0.5 text-amber-300/85">
                          <Zap className="h-2.5 w-2.5" />
                          {energyMt >= 100 ? Math.round(energyMt) : energyMt.toFixed(1)} Mt
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Miss Distance + Countdown + Quick Inspect */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-[12px] font-semibold leading-tight ${
                        isHazard
                          ? "text-rose-300"
                          : isClose
                            ? "text-amber-300"
                            : "text-slate-100"
                      }`}
                    >
                      {distLd.toFixed(2)} <span className="text-[9px] font-normal text-slate-400">LD</span>
                    </div>
                    <div className="mt-0.5 text-[9px] text-slate-500">{countdown}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInspector(neo);
                    }}
                    title="Open 3D Inspector & Impact Physics Lab"
                    className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border transition-all ${
                      isSelected
                        ? "border-sky-400/40 bg-sky-400/15 text-sky-200 hover:bg-sky-400/25"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Subtle Footer Keyboard Hint */}
      <div className="flex items-center justify-between border-t border-white/[0.07] bg-white/[0.02] px-3 py-1.5 font-mono text-[9px] text-slate-500">
        <span>↑/↓ Cycle target · I Inspect</span>
        <span className="tabular-nums">{filteredAsteroids.length} shown</span>
      </div>
    </div>
  );
}
