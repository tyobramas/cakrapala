"use client";

import React, { useState, useMemo } from "react";
import { AsteroidNeoObject, AsteroidSortOption } from "@/lib/asteroid/types";
import {
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ArrowUpDown,
  Zap,
  Info,
  Layers,
} from "lucide-react";

interface AsteroidFeedPanelProps {
  asteroids: AsteroidNeoObject[];
  selectedAsteroid: AsteroidNeoObject | null;
  onSelectAsteroid: (asteroid: AsteroidNeoObject) => void;
  onOpenInspector: (asteroid: AsteroidNeoObject) => void;
  selectedDate: string;
  onChangeDate: (newDate: string) => void;
  isLoading?: boolean;
}

export default function AsteroidFeedPanel({
  asteroids,
  selectedAsteroid,
  onSelectAsteroid,
  onOpenInspector,
  selectedDate,
  onChangeDate,
  isLoading,
}: AsteroidFeedPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pha" | "close" | "large">("all");
  const [sortBy, setSortBy] = useState<AsteroidSortOption>("distance");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Date manipulation helpers
  const handleShiftDay = (offsetDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    onChangeDate(current.toISOString().split("T")[0]);
  };

  // Filtered & Sorted list
  const filteredAsteroids = useMemo(() => {
    return asteroids
      .filter((neo) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = neo.name.toLowerCase().includes(q);
          const matchId = neo.id.includes(q);
          if (!matchName && !matchId) return false;
        }

        // Quick filter mode
        if (filterMode === "pha" && !neo.is_potentially_hazardous_asteroid) {
          return false;
        }
        if (filterMode === "close" && (neo.closest_miss_distance_ld || 99) > 5) {
          return false;
        }
        if (filterMode === "large" && (neo.avg_diameter_meters || 0) < 100) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;

        switch (sortBy) {
          case "distance":
            valA = a.closest_miss_distance_ld || 0;
            valB = b.closest_miss_distance_ld || 0;
            break;
          case "velocity":
            valA = a.velocity_kmh || 0;
            valB = b.velocity_kmh || 0;
            break;
          case "diameter":
            valA = a.avg_diameter_meters || 0;
            valB = b.avg_diameter_meters || 0;
            break;
          case "name":
            return sortOrder === "asc"
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          default:
            valA = a.closest_miss_distance_ld || 0;
            valB = b.closest_miss_distance_ld || 0;
        }

        return sortOrder === "asc" ? valA - valB : valB - valA;
      });
  }, [asteroids, searchQuery, filterMode, sortBy, sortOrder]);

  return (
    <div className="w-full lg:w-[390px] xl:w-[430px] h-full flex flex-col bg-[#050c1e]/95 backdrop-blur-2xl border-l border-slate-800/80 font-mono text-white select-none z-20">
      {/* ── Panel Header & Date Navigator ───────────────────────────────────── */}
      <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>NEO EPHEMERIS DECK</span>
          </div>
          <div className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
            NASA JPL NeoWs
          </div>
        </div>

        {/* Date Selector Timeline Navigation */}
        <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-2 py-1.5 rounded-xl text-xs">
          <button
            onClick={() => handleShiftDay(-1)}
            title="Previous Day"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onChangeDate(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => handleShiftDay(1)}
            title="Next Day"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by name (e.g. Apophis, 2024)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap ${
              filterMode === "all"
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All ({asteroids.length})
          </button>

          <button
            onClick={() => setFilterMode("pha")}
            className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
              filterMode === "pha"
                ? "bg-red-500/20 border-red-500/50 text-red-300 font-bold"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400"
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span>Hazardous (PHA)</span>
          </button>

          <button
            onClick={() => setFilterMode("close")}
            className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap ${
              filterMode === "close"
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400"
            }`}
          >
            &lt; 5 LD Closest
          </button>

          <button
            onClick={() => setFilterMode("large")}
            className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap ${
              filterMode === "large"
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-indigo-400"
            }`}
          >
            &gt; 100m Large
          </button>
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-cyan-400" />
            <span>Sort by:</span>
          </div>
          <div className="flex items-center gap-2">
            {(["distance", "velocity", "diameter"] as AsteroidSortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => {
                  if (sortBy === option) {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy(option);
                    setSortOrder(option === "velocity" || option === "diameter" ? "desc" : "asc");
                  }
                }}
                className={`uppercase tracking-wider transition-colors ${
                  sortBy === option ? "text-cyan-300 font-bold underline decoration-cyan-500" : "hover:text-slate-200"
                }`}
              >
                {option} {sortBy === option && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Asteroid Cards List ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs gap-2">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span>Fetching NASA NeoWs telemetry...</span>
          </div>
        ) : filteredAsteroids.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Info className="w-6 h-6 mx-auto mb-2 text-slate-600" />
            <span>No near-Earth objects match this filter criteria.</span>
          </div>
        ) : (
          filteredAsteroids.map((neo) => {
            const isSelected = selectedAsteroid?.id === neo.id;
            const isHazard = neo.is_potentially_hazardous_asteroid;
            const distanceLd = neo.closest_miss_distance_ld || 0;

            return (
              <div
                key={neo.id}
                onClick={() => onSelectAsteroid(neo)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? "bg-cyan-950/40 border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.25)]"
                    : isHazard
                    ? "bg-red-950/20 border-red-900/50 hover:border-red-500/60"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                }`}
              >
                {/* Top Row: Name + Hazard Badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                      <span>{neo.name}</span>
                      {neo.is_sentry_object && (
                        <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1 rounded">
                          SENTRY
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">ID: {neo.id}</div>
                  </div>

                  {isHazard ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-bold shrink-0">
                      <ShieldAlert className="w-2.5 h-2.5" />
                      <span>PHA HAZARD</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] shrink-0">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>SAFE</span>
                    </span>
                  )}
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 mb-2">
                  <div>
                    <div className="text-slate-500 text-[9px]">MISS DISTANCE</div>
                    <div className="font-bold text-cyan-300">{distanceLd.toFixed(2)} LD</div>
                    <div className="text-[8px] text-slate-400 truncate">
                      {Math.round(neo.closest_miss_distance_km || 0).toLocaleString()} km
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 text-[9px]">EST. DIAMETER</div>
                    <div className="font-bold text-white">{neo.avg_diameter_meters} m</div>
                    <div className="text-[8px] text-slate-400 truncate">
                      ≈ {neo.size_reference_name?.split("(")[0]}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 text-[9px]">VELOCITY</div>
                    <div className="font-bold text-amber-300">
                      {Math.round(neo.velocity_kmh || 0).toLocaleString()}
                    </div>
                    <div className="text-[8px] text-slate-400">km/h</div>
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="text-slate-400">
                    Flyby:{" "}
                    <span className="text-slate-300">
                      {neo.close_approach_data?.[0]?.close_approach_date_full || selectedDate}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInspector(neo);
                    }}
                    className="px-2 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold transition-all flex items-center gap-1"
                  >
                    <span>INSPECT 3D</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
