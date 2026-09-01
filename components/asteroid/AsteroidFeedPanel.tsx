"use client";

import React, { useState, useMemo } from "react";
import { AsteroidNeoObject, AsteroidSortOption } from "@/lib/asteroid/types";
import { OPS, OPS_TYPE } from "@/lib/ui/opsTheme";
import { useOpsMode } from "@/lib/ui/opsMode";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ExternalLink,
  Info,
  Maximize2,
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
  const { isOps } = useOpsMode();
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
    <div
      className="w-full lg:w-[420px] xl:w-[460px] h-full flex flex-col font-mono select-none z-20 border-l"
      style={{
        background: OPS.panel,
        borderColor: OPS.line,
        color: OPS.text,
      }}
    >
      {/* ── Panel Header & Date Navigator ───────────────────────────────────── */}
      <div className="p-3 border-b space-y-2" style={{ background: OPS.panel, borderColor: OPS.line }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: OPS.accent }} />
            <span className={OPS_TYPE.label} style={{ color: OPS.text }}>
              {isOps ? "NEO EPHEMERIS DECK" : "Tracked Asteroids Feed"}
            </span>
          </div>
          <span className={OPS_TYPE.meta} style={{ color: OPS.textFaint }}>
            NASA JPL NeoWs
          </span>
        </div>

        {/* Date Selector Timeline Navigation */}
        <div
          className="flex items-center justify-between px-2 py-1 border text-xs"
          style={{ background: OPS.panelAlt, borderColor: OPS.line }}
        >
          <button
            onClick={() => handleShiftDay(-1)}
            title="Previous Day"
            className="p-1 transition-colors duration-[120ms] cursor-pointer"
            style={{ color: OPS.textDim }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" style={{ color: OPS.textDim }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onChangeDate(e.target.value)}
              className="bg-transparent font-mono font-medium text-xs focus:outline-none cursor-pointer"
              style={{ color: OPS.text }}
            />
          </div>

          <button
            onClick={() => handleShiftDay(1)}
            title="Next Day"
            className="p-1 transition-colors duration-[120ms] cursor-pointer"
            style={{ color: OPS.textDim }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3 h-3" style={{ color: OPS.textFaint }} />
          <input
            type="text"
            placeholder={isOps ? "FILTER BY NAME / ID..." : "Search asteroid by name..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1 border text-[11px] focus:outline-none"
            style={{
              background: OPS.bg,
              borderColor: OPS.line,
              color: OPS.text,
            }}
          />
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
          <button
            onClick={() => setFilterMode("all")}
            className="px-2 py-0.5 border transition-colors duration-[120ms] whitespace-nowrap cursor-pointer"
            style={{
              background: filterMode === "all" ? OPS.grid : OPS.panelAlt,
              borderColor: filterMode === "all" ? OPS.accent : OPS.line,
              color: filterMode === "all" ? OPS.text : OPS.textDim,
              fontWeight: filterMode === "all" ? 600 : 400,
            }}
          >
            ALL ({asteroids.length})
          </button>

          <button
            onClick={() => setFilterMode("pha")}
            className="px-2 py-0.5 border transition-colors duration-[120ms] whitespace-nowrap cursor-pointer"
            style={{
              background: filterMode === "pha" ? OPS.grid : OPS.panelAlt,
              borderColor: filterMode === "pha" ? OPS.hazard : OPS.line,
              color: filterMode === "pha" ? OPS.hazard : OPS.textDim,
              fontWeight: filterMode === "pha" ? 600 : 400,
            }}
          >
            {isOps ? "PHA" : "Hazard Alert"}
          </button>

          <button
            onClick={() => setFilterMode("close")}
            className="px-2 py-0.5 border transition-colors duration-[120ms] whitespace-nowrap cursor-pointer"
            style={{
              background: filterMode === "close" ? OPS.grid : OPS.panelAlt,
              borderColor: filterMode === "close" ? OPS.caution : OPS.line,
              color: filterMode === "close" ? OPS.caution : OPS.textDim,
              fontWeight: filterMode === "close" ? 600 : 400,
            }}
          >
            &lt; 5 LD
          </button>

          <button
            onClick={() => setFilterMode("large")}
            className="px-2 py-0.5 border transition-colors duration-[120ms] whitespace-nowrap cursor-pointer"
            style={{
              background: filterMode === "large" ? OPS.grid : OPS.panelAlt,
              borderColor: filterMode === "large" ? OPS.accent : OPS.line,
              color: filterMode === "large" ? OPS.text : OPS.textDim,
              fontWeight: filterMode === "large" ? 600 : 400,
            }}
          >
            &gt; 100m
          </button>
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between text-[10px] pt-0.5 border-t" style={{ borderColor: OPS.line, color: OPS.textDim }}>
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" style={{ color: OPS.textFaint }} />
            <span className={OPS_TYPE.label}>SORT:</span>
          </div>
          <div className="flex items-center gap-2">
            {(["distance", "velocity", "diameter", "name"] as AsteroidSortOption[]).map((option) => (
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
                className="uppercase tracking-wider transition-colors duration-[120ms] cursor-pointer"
                style={{
                  color: sortBy === option ? OPS.text : OPS.textFaint,
                  fontWeight: sortBy === option ? 600 : 400,
                  textDecoration: sortBy === option ? "underline" : "none",
                  textDecorationColor: OPS.accent,
                }}
              >
                {option} {sortBy === option && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Column Headers (OPS Mode) ─────────────────────────────────── */}
      {isOps ? (
        <div
          className="grid grid-cols-12 gap-1 px-3 py-1.5 border-b text-[10px] tracking-wider uppercase font-medium"
          style={{ background: OPS.panelAlt, borderColor: OPS.line, color: OPS.textDim }}
        >
          <div className="col-span-3">OBJECT</div>
          <div className="col-span-2 text-right">DIST</div>
          <div className="col-span-2 text-right">EST DIA</div>
          <div className="col-span-2 text-right">VEL</div>
          <div className="col-span-3 text-right">ACTION</div>
        </div>
      ) : (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b text-[10px] tracking-wider uppercase font-medium"
          style={{ background: OPS.panelAlt, borderColor: OPS.line, color: OPS.textDim }}
        >
          <span>ASTEROID &amp; PHYSICAL ESTIMATE</span>
          <span>FLYBY &amp; ACTION</span>
        </div>
      )}

      {/* ── Telemetry Rows ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: OPS.line }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-xs gap-2" style={{ color: OPS.textDim }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: OPS.accent, borderTopColor: "transparent" }} />
            <span className={OPS_TYPE.meta}>FETCHING NASA JPL TELEMETRY...</span>
          </div>
        ) : filteredAsteroids.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: OPS.textDim }}>
            <Info className="w-5 h-5 mx-auto mb-2" style={{ color: OPS.textFaint }} />
            <span>NO OBJECTS MATCH FILTER</span>
          </div>
        ) : (
          filteredAsteroids.map((neo, idx) => {
            const isSelected = selectedAsteroid?.id === neo.id;
            const isHazard = neo.is_potentially_hazardous_asteroid;
            const distanceLd = neo.closest_miss_distance_ld || 0;
            const isClose = distanceLd < 5;

            if (isOps) {
              /* ── OPS Row (Dense 44px, 4 right-aligned columns) ──────────── */
              return (
                <div
                  key={neo.id}
                  onClick={() => onSelectAsteroid(neo)}
                  className="min-h-[44px] grid grid-cols-12 gap-1 items-center px-3 py-1 cursor-pointer transition-colors duration-[120ms]"
                  style={{
                    background: isSelected ? OPS.grid : idx % 2 === 0 ? OPS.panel : OPS.panelAlt,
                    borderLeft: isSelected ? `2px solid ${OPS.accent}` : "2px solid transparent",
                  }}
                >
                  {/* Designation & ID */}
                  <div className="col-span-3 min-w-0">
                    <div className="text-[12px] font-mono font-medium truncate" style={{ color: OPS.text }}>
                      {neo.name}
                    </div>
                    <div className="text-[9px] font-mono truncate" style={{ color: OPS.textFaint }}>
                      ID {neo.id}
                    </div>
                  </div>

                  {/* Distance (LD) */}
                  <div className="col-span-2 text-right">
                    <div className="text-[12px] font-mono tabular-nums" style={{ color: OPS.text }}>
                      {distanceLd.toFixed(2)}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: OPS.textFaint }}>LD</div>
                  </div>

                  {/* Diameter (m) */}
                  <div className="col-span-2 text-right">
                    <div className="text-[12px] font-mono tabular-nums" style={{ color: OPS.text }}>
                      {neo.avg_diameter_meters}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: OPS.textFaint }}>m</div>
                  </div>

                  {/* Velocity (km/h) */}
                  <div className="col-span-2 text-right">
                    <div className="text-[12px] font-mono tabular-nums" style={{ color: OPS.text }}>
                      {Math.round(neo.velocity_kmh || 0).toLocaleString()}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: OPS.textFaint }}>km/h</div>
                  </div>

                  {/* Status & Clear Action Button */}
                  <div className="col-span-3 text-right flex items-center justify-end gap-1.5">
                    <span
                      className="text-[10px] font-mono font-medium"
                      style={{
                        color: isHazard ? OPS.hazard : isClose ? OPS.caution : OPS.safe,
                      }}
                    >
                      {isHazard ? "PHA" : isClose ? "CLOSE" : "SAFE"}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInspector(neo);
                      }}
                      title="Open Deep-Dive 3D Inspector"
                      className="px-1.5 py-0.5 border text-[9px] font-mono font-semibold flex items-center gap-1 transition-all duration-[120ms] cursor-pointer"
                      style={{
                        borderColor: isSelected ? OPS.accent : OPS.line,
                        background: isSelected ? "rgba(90, 143, 184, 0.25)" : OPS.panelAlt,
                        color: isSelected ? OPS.text : OPS.textDim,
                      }}
                    >
                      <Maximize2 className="w-2.5 h-2.5" />
                      <span>DETAIL</span>
                    </button>
                  </div>
                </div>
              );
            }

            /* ── PUBLIC Row (68px with Size Comparison & Phrasing) ────────── */
            return (
              <div
                key={neo.id}
                onClick={() => onSelectAsteroid(neo)}
                className="min-h-[66px] flex flex-col justify-center px-3 py-2 cursor-pointer transition-colors duration-[120ms]"
                style={{
                  background: isSelected ? OPS.grid : idx % 2 === 0 ? OPS.panel : OPS.panelAlt,
                  borderLeft: isSelected ? `2px solid ${OPS.accent}` : "2px solid transparent",
                }}
              >
                {/* Top Row: Name, Status, and Inspect Action */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs font-semibold" style={{ color: OPS.text }}>
                      {neo.name}
                    </span>
                    <span className="text-[10px]" style={{ color: OPS.textDim }}>
                      ({neo.avg_diameter_meters} m across)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10px] font-medium tracking-wide"
                      style={{
                        color: isHazard ? OPS.hazard : isClose ? OPS.caution : OPS.safe,
                      }}
                    >
                      {isHazard ? "Hazard alert" : isClose ? "Close approach" : "Safe pass"}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInspector(neo);
                      }}
                      title="View 3D Model & Scientific Details"
                      className="px-2 py-1 border text-[10px] font-medium flex items-center gap-1.5 transition-all duration-[120ms] cursor-pointer shadow-sm"
                      style={{
                        borderColor: isSelected ? OPS.accent : OPS.line,
                        background: isSelected ? "rgba(90, 143, 184, 0.25)" : OPS.panelAlt,
                        color: isSelected ? OPS.text : OPS.accent,
                      }}
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>3D Detail</span>
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Landmark Reference & Human Distance */}
                <div className="flex items-center justify-between text-[11px] mt-1" style={{ color: OPS.textDim }}>
                  <div className="truncate">
                    {neo.size_reference_name ? (
                      <span>≈ {neo.size_reference_name}</span>
                    ) : (
                      <span>Diameter {neo.avg_diameter_meters}m</span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span>
                      {distanceLd < 1
                        ? "Inside Moon's orbit"
                        : `${distanceLd.toFixed(1)}× farther than Moon`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
