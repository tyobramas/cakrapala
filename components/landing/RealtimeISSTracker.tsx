"use client";

/**
 * RealtimeSatelliteTracker
 *
 * Real-time orbital radar for artificial satellites (ISS, Tiangong CSS, Hubble, NOAA, Terra, Starlink).
 * Features:
 *   - SGP4 orbital propagator with CelesTrak TLE integration
 *   - Real authentic vector icon per satellite in both 2D Canvas overlay and 3D Cesium views
 *   - Instant satellite switching with dynamic telemetry (velocity, altitude, ground track, footprint)
 *   - 2D NASA Radar Map & 3D Photorealistic CesiumJS Globe
 */

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Radio,
  ArrowUpRight,
  Globe,
  Map,
  ChevronDown,
  Satellite as SatIcon,
} from "lucide-react";
import type { RealISSPayload } from "@/app/api/iss/route";
import { SATELLITE_CATALOG } from "@/lib/satellites/satelliteCatalog";

// CesiumJS 3D globe — dynamic import with SSR disabled
const CesiumISSGlobe = dynamic(
  () => import("@/components/cesium/CesiumISSGlobe"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#020713] font-mono text-cyan-400 text-xs gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        <span>INITIALIZING CESIUM 3D GLOBE...</span>
      </div>
    ),
  }
);

/**
 * Calculates Great-Circle distance between two coordinates in km using Haversine formula
 */
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

export default function RealtimeSatelliteTracker() {
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>("iss");
  const [telemetry, setTelemetry] = useState<RealISSPayload | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; city: string }>({
    lat: -6.2088,
    lon: 106.8456,
    city: "Jakarta, ID",
  });
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentSat = SATELLITE_CATALOG.find((s) => s.id === selectedSatelliteId) || SATELLITE_CATALOG[0];

  // 1. Detect user geolocation
  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setUserLocation({
            lat,
            lon,
            city: `Observer (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
          });
        },
        () => {},
        { timeout: 8000 }
      );
    }
  }, []);

  // 2. Fetch live real-time satellite telemetry from Next.js proxy route
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/iss?id=${selectedSatelliteId}`, { cache: "no-store" });
        if (res.ok) {
          const data: RealISSPayload = await res.json();
          if (isMounted) {
            setTelemetry(data);
            setIsLoading(false);
            setLastFetched(new Date(data.timestamp).toLocaleTimeString());
            const dist = getHaversineDistanceKm(
              userLocation.lat,
              userLocation.lon,
              data.latitude,
              data.longitude
            );
            setDistanceKm(dist);
          }
        }
      } catch (err) {
        console.warn("Satellite live telemetry polling error:", err);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000); // 5s live update

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userLocation, selectedSatelliteId]);

  // 3. Render 2D NASA Ground Track Map (Event-driven, Zero CPU overhead)
  useEffect(() => {
    if (viewMode !== "2d") return;

    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const earthMapImg = new Image();
    earthMapImg.src = "/textures/planets/earth.jpg";

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Draw Satellite World Map Texture
      if (earthMapImg.complete && earthMapImg.naturalWidth > 0) {
        ctx.drawImage(earthMapImg, 0, 0, width, height);
        const mapShade = ctx.createLinearGradient(0, 0, 0, height);
        mapShade.addColorStop(0, "rgba(2, 6, 23, 0.4)");
        mapShade.addColorStop(0.5, "rgba(2, 6, 23, 0.15)");
        mapShade.addColorStop(1, "rgba(2, 6, 23, 0.4)");
        ctx.fillStyle = mapShade;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = "#03142e";
        ctx.fillRect(0, 0, width, height);
      }

      // Equirectangular Grid Overlay
      ctx.strokeStyle = "rgba(56, 189, 248, 0.18)";
      ctx.lineWidth = 0.6;
      for (let x = 0; x <= width; x += width / 12) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += height / 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Lat/Lon labels
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
      const lonLabels = [-180, -120, -60, 0, 60, 120, 180];
      lonLabels.forEach((l) => {
        const x = ((l + 180) / 360) * width;
        ctx.fillText(`${l}°`, Math.min(width - 24, Math.max(4, x + 2)), height - 5);
      });
      const latLabels = [-60, -30, 0, 30, 60];
      latLabels.forEach((l) => {
        const y = ((90 - l) / 180) * height;
        ctx.fillText(`${l}°`, 4, Math.min(height - 4, Math.max(12, y - 3)));
      });

      const toXY = (lat: number, lon: number) => ({
        x: ((lon + 180) / 360) * width,
        y: ((90 - lat) / 180) * height,
      });

      if (telemetry) {
        // ── 1. Green Past Orbit Ground Track ──────────────────────────────────
        if (telemetry.orbitTrail && telemetry.orbitTrail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = "#84cc16"; // Lime Green
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.shadowBlur = 6;
          ctx.shadowColor = "#84cc16";

          let isFirst = true;
          let prevX = 0;

          telemetry.orbitTrail.forEach((pt) => {
            const { x, y } = toXY(pt.lat, pt.lon);
            if (isFirst || Math.abs(x - prevX) > width * 0.4) {
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(x, y);
              isFirst = false;
            } else {
              ctx.lineTo(x, y);
            }
            prevX = x;
          });
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // ── 2. Orange Future Orbit Ground Track ───────────────────────────────
        if (telemetry.futureOrbit && telemetry.futureOrbit.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = "#f97316"; // Amber Orange
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.shadowBlur = 6;
          ctx.shadowColor = "#f97316";

          let isFirst = true;
          let prevX = 0;

          telemetry.futureOrbit.forEach((pt) => {
            const { x, y } = toXY(pt.lat, pt.lon);
            if (isFirst || Math.abs(x - prevX) > width * 0.4) {
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(x, y);
              isFirst = false;
            } else {
              ctx.lineTo(x, y);
            }
            prevX = x;
          });
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // ── 3. Observer Location Marker ──────────────────────────────────────
        const userPt = toXY(userLocation.lat, userLocation.lon);
        ctx.beginPath();
        ctx.arc(userPt.x, userPt.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#38bdf8";
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    };

    earthMapImg.onload = draw;
    draw();

    const resizeObserver = new ResizeObserver(() => {
      draw();
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [telemetry, userLocation, viewMode]);

  // Compute percentage coordinates for 2D satellite marker overlay
  const satLeftPercent = telemetry ? ((telemetry.longitude + 180) / 360) * 100 : 50;
  const satTopPercent = telemetry ? ((90 - telemetry.latitude) / 180) * 100 : 50;

  return (
    <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>REAL-TIME SATELLITE ORBITAL TELEMETRY</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Live Satellite Tracker</span>
            <span className="text-xs font-mono font-normal px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
              {currentSat.categoryLabel}
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Real satellite orbital ephemeris with live sinusoidal ground track (🟢 Past Pass / 🟠 Next Pass).
          </p>
        </div>

        {/* ── Control Toolbar: Satellite Selector + 2D/3D Toggle ─────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Satellite Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-400 text-xs font-mono text-white transition-all shadow-lg"
            >
              <SatIcon className="w-4 h-4 text-cyan-400" />
              <span className="font-bold">{currentSat.name}</span>
              <span className="text-[10px] text-slate-400">({currentSat.agency})</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#040a17]/95 border border-cyan-500/30 shadow-2xl backdrop-blur-xl z-50 p-2 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Select Orbital Spacecraft
                </div>
                {SATELLITE_CATALOG.map((sat) => (
                  <button
                    key={sat.id}
                    onClick={() => {
                      setSelectedSatelliteId(sat.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
                      selectedSatelliteId === sat.id
                        ? "bg-cyan-500/20 border border-cyan-500/40 text-white"
                        : "hover:bg-slate-800/60 text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-slate-900 border border-slate-700 flex items-center justify-center p-1">
                        <img src={sat.iconSvg} alt={sat.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <div className="text-xs font-mono font-bold leading-none">{sat.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{sat.agency} &bull; {sat.categoryLabel}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                      #{sat.noradId}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2D / 3D Mode Toggle Switch */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-700 shadow-inner">
            <button
              onClick={() => setViewMode("2d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                viewMode === "2d"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>2D MAP</span>
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                viewMode === "3d"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D GLOBE</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Radar Container (NASA Flight Display Style) ───────────────── */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-[#020713] border border-cyan-500/30 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)]">
        
        {/* ── 4 Corner Aerospace HUD Badges ─────────────────────────────────── */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 shadow-xl font-mono text-[11px] sm:text-xs">
          <span className="text-slate-400">longitude</span>
          <span className="px-1.5 py-0.5 rounded bg-orange-600/90 text-white font-bold">
            {telemetry ? telemetry.longitude.toFixed(6) : "..."}
          </span>
        </div>

        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 shadow-xl font-mono text-[11px] sm:text-xs">
          <span className="text-slate-400">latitude</span>
          <span className="px-1.5 py-0.5 rounded bg-orange-600/90 text-white font-bold">
            {telemetry ? telemetry.latitude.toFixed(6) : "..."}
          </span>
        </div>

        <div className="absolute bottom-14 left-3 sm:bottom-16 sm:left-4 z-20 flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 shadow-xl font-mono text-[11px] sm:text-xs">
          <span className="text-slate-400">altitude (km)</span>
          <span className="px-1.5 py-0.5 rounded bg-orange-600/90 text-white font-bold">
            {telemetry ? telemetry.altitude.toFixed(2) : "..."}
          </span>
        </div>

        <div className="absolute bottom-14 right-3 sm:bottom-16 sm:right-4 z-20 flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 shadow-xl font-mono text-[11px] sm:text-xs">
          <span className="text-slate-400">velocity (km/h)</span>
          <span className="px-1.5 py-0.5 rounded bg-orange-600/90 text-white font-bold">
            {telemetry ? telemetry.velocity.toLocaleString() : "..."}
          </span>
        </div>

        {/* ── Main Radar Canvas / 3D Globe ────────────────────────────── */}
        <div className="w-full h-[400px] sm:h-[500px] lg:h-[580px] relative">
          {/* 2D Map Canvas */}
          <canvas
            ref={mapCanvasRef}
            className={`absolute inset-0 w-full h-full ${viewMode === "2d" ? "block" : "hidden"}`}
          />

          {/* 2D Satellite Real Vector Marker (DOM Overlay for 100% Guaranteed Crisp Rendering) */}
          {viewMode === "2d" && telemetry && (
            <div
              className="absolute pointer-events-none z-10 transition-all duration-700 ease-out flex flex-col items-center"
              style={{
                left: `${satLeftPercent}%`,
                top: `${satTopPercent}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {/* Telemetry Callout Top Badge */}
              <div className="mb-1.5 px-2.5 py-1 rounded-md bg-slate-950/95 border border-cyan-500/60 shadow-xl flex items-center gap-2 font-mono text-[10px] whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-cyan-300">{telemetry.name.toUpperCase()}</span>
                <span className="text-slate-400">NORAD #{telemetry.noradId}</span>
                <span className="text-amber-400">{telemetry.altitude} km</span>
              </div>

              {/* Satellite Icon with Glow Halo */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-400/25 blur-md scale-150 animate-pulse" />
                <img
                  src={currentSat.iconSvg}
                  alt={currentSat.name}
                  className="w-14 sm:w-16 h-8 sm:h-10 object-contain drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]"
                />
              </div>

              {/* Distance from Observer Bottom Badge */}
              {distanceKm !== null && (
                <div className="mt-1.5 px-2 py-0.5 rounded bg-slate-950/90 border border-amber-500/50 text-[9px] font-mono text-amber-300 shadow-lg whitespace-nowrap">
                  ↕ {distanceKm.toLocaleString()} km from you
                </div>
              )}
            </div>
          )}

          {/* 3D Globe — CesiumJS */}
          {viewMode === "3d" && telemetry && (
            <div className="absolute inset-0 w-full h-full">
              <CesiumISSGlobe
                satelliteId={currentSat.id}
                satelliteName={currentSat.name}
                iconSvg={currentSat.iconSvg}
                themeColor={currentSat.themeColor}
                latitude={telemetry.latitude}
                longitude={telemetry.longitude}
                altitude={telemetry.altitude}
                velocity={telemetry.velocity}
                orbitTrail={telemetry.orbitTrail}
                futureOrbit={telemetry.futureOrbit}
                userLat={userLocation.lat}
                userLon={userLocation.lon}
              />
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-30 font-mono text-cyan-400 text-xs">
              <span className="animate-spin mr-2">⟳</span>
              <span>ACQUIRING {currentSat.name.toUpperCase()} SGP4 TELEMETRY SIGNAL...</span>
            </div>
          )}
        </div>

        {/* ── Bottom Telemetry Footer Strip ─────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#030919] border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3 sm:gap-4 text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              SGP4 SIGNAL: 100% REAL
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span>
              INCLINATION: <strong className="text-white">{currentSat.inclinationDeg}°</strong>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span>
              ORBITAL PERIOD: <strong className="text-white">{currentSat.periodMin} MIN</strong>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span>
              DISTANCE:{" "}
              <strong className="text-amber-400">
                {distanceKm !== null ? `${distanceKm.toLocaleString()} KM` : "CALCULATING..."}
              </strong>
            </span>
          </div>

          <Link
            href="/iss"
            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors group"
          >
            <span>OPEN DEDICATED MISSION CONSOLE</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
