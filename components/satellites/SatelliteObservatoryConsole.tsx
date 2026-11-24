"use client";

/**
 * SatelliteObservatoryConsole — Precision Full-Viewport SGP4 Satellite Observatory (/satellites).
 *
 * Scientific & Engineering Capabilities (Zero Gimmicks):
 *   - Live CelesTrak NORAD GP TLE fetch + continuous 1 Hz client-side SGP4 propagation (satellite.js)
 *   - Exact Earth cylindrical shadow eclipse detection (Sunlit vs Umbra via astronomy-engine Sun vector)
 *   - Exact Observer Topocentric Look Angles (Azimuth, Elevation, Slant Range km, 145.8 MHz Doppler kHz)
 *   - Deterministic 24-Hour SGP4 Overhead Pass Predictor (Optical Visible vs Radio Pass + 1-click Pass Preview)
 *   - Interactive SGP4 Time Scrubber (-45m to +90m or arbitrary pass epoch) with instant LIVE snap-back
 *   - Seamless 3D Photorealistic Earth Globe + 2D Curved Solar-Terminator Ground Track Map
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import * as satellite from "satellite.js";
import type { RealISSPayload } from "@/app/api/iss/route";
import { SATELLITE_CATALOG, type SatelliteInfo } from "@/lib/satellites/satelliteCatalog";
import { CURRENT_ISS_CREW } from "@/lib/iss/issService";
import {
  propagateSatelliteLive,
  generateSgp4GroundTrack,
  predictOverheadPasses,
  parseTleMetadata,
  azimuthToCompass,
  type TleMetadata,
} from "@/lib/satellites/sgp4Precision";
import ObservatoryLoader from "@/components/ui/ObservatoryLoader";
import SatelliteGroundTrack2D from "./SatelliteGroundTrack2D";
import {
  ArrowLeft,
  Globe2,
  Map,
  Radio,
  Sun,
  Moon,
  MapPin,
  Clock,
  Users,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Navigation,
  Sparkles,
  RotateCcw,
  Eye,
  Compass,
  Layers,
} from "lucide-react";

const CesiumISSGlobe = dynamic(() => import("@/components/cesium/CesiumISSGlobe"), {
  ssr: false,
  loading: () => (
    <ObservatoryLoader
      variant="container"
      title="CAKRAPALA"
      subtitle="Initializing 3D SGP4 orbital globe"
      className="h-full w-full"
    />
  ),
});

interface ObserverCoords {
  lat: number;
  lon: number;
  label: string;
  isGps: boolean;
}

const DEFAULT_OBSERVER: ObserverCoords = {
  lat: 40.7128,
  lon: -74.006,
  label: "New York",
  isGps: false,
};

type RightTab = "live" | "passes" | "craft";

function formatCoord(val: number, pos: string, neg: string): string {
  return `${Math.abs(val).toFixed(3)}° ${val >= 0 ? pos : neg}`;
}

function formatPassTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatPassDateShort(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function SatelliteObservatoryConsole() {
  const [selectedId, setSelectedId] = useState<string>("iss");
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [rightTab, setRightTab] = useState<RightTab>("live");
  const [isRightOpen, setIsRightOpen] = useState<boolean>(true);
  const [isFleetOpen, setIsFleetOpen] = useState<boolean>(true);
  const [copiedTle, setCopiedTle] = useState<boolean>(false);

  // Observer coordinates (auto-GPS on mount, New York fallback matching /sky)
  const [observer, setObserver] = useState<ObserverCoords>(DEFAULT_OBSERVER);

  // Live TLE record fetched from /api/iss (CelesTrak GP live with verified fallback)
  const currentCraft: SatelliteInfo = useMemo(
    () => SATELLITE_CATALOG.find((s) => s.id === selectedId) ?? SATELLITE_CATALOG[0],
    [selectedId],
  );

  const [tleState, setTleState] = useState<{
    satId: string;
    line1: string;
    line2: string;
    source: "celestrak_live" | "fallback_tle";
    keplerian: TleMetadata;
  }>(() => ({
    satId: SATELLITE_CATALOG[0].id,
    line1: SATELLITE_CATALOG[0].defaultTle.line1,
    line2: SATELLITE_CATALOG[0].defaultTle.line2,
    source: "fallback_tle",
    keplerian: parseTleMetadata(
      SATELLITE_CATALOG[0].defaultTle.line1,
      SATELLITE_CATALOG[0].defaultTle.line2,
    ),
  }));

  // 1 Hz live wall clock + interactive SGP4 time offset (minutes; 0 = real-time LIVE)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [scrubOffsetSec, setScrubOffsetSec] = useState<number>(0);

  // Collapse side panels cleanly on mobile & honor ?sat=<id> deep-links from /satellites/catalog
  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      if (window.innerWidth < 1024) {
        setIsRightOpen(false);
        setIsFleetOpen(false);
      }
      const satParam = new URLSearchParams(window.location.search).get("sat");
      if (satParam && SATELLITE_CATALOG.some((s) => s.id === satParam)) {
        setSelectedId(satParam);
      }
    });
  }, []);

  // 1. Auto-detect user GPS location on mount (fallback: New York)
  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        setObserver({ lat, lon, label: "My Location", isGps: true });
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
          );
          if (res.ok) {
            const g = (await res.json()) as {
              city?: string;
              locality?: string;
              principalSubdivision?: string;
            };
            const name = g.city || g.locality || g.principalSubdivision || "My Location";
            setObserver({ lat, lon, label: name, isGps: true });
          }
        } catch {
          // Keep GPS coordinates with "My Location"
        }
      },
      () => {
        // Keep New York default
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    queueMicrotask(requestGps);
  }, [requestGps]);

  // 2. Fetch live CelesTrak NORAD GP TLE whenever selected spacecraft changes
  useEffect(() => {
    let active = true;
    const craft = SATELLITE_CATALOG.find((s) => s.id === selectedId) ?? SATELLITE_CATALOG[0];

    // Immediately load bundled TLE so propagation is instant with zero blank frame
    queueMicrotask(() => {
      if (!active) return;
      setScrubOffsetSec(0);
      setTleState({
        satId: craft.id,
        line1: craft.defaultTle.line1,
        line2: craft.defaultTle.line2,
        source: "fallback_tle",
        keplerian: parseTleMetadata(craft.defaultTle.line1, craft.defaultTle.line2),
      });
    });

    const loadLiveTle = async () => {
      try {
        const res = await fetch(`/api/iss?id=${craft.id}`, { cache: "no-store" });
        if (!res.ok || !active) return;
        const data: RealISSPayload = await res.json();
        if (active && data.tle?.line1 && data.tle?.line2) {
          setTleState({
            satId: craft.id,
            line1: data.tle.line1,
            line2: data.tle.line2,
            source: data.tle.source,
            keplerian:
              data.keplerian ?? parseTleMetadata(data.tle.line1, data.tle.line2),
          });
        }
      } catch {
        // Keep fallback TLE seamlessly
      }
    };

    void loadLiveTle();
    return () => {
      active = false;
    };
  }, [selectedId]);

  // 3. Smooth 1 Hz clock tick for real-time SGP4 propagation
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Build reusable SGP4 SatRec from active TLE
  const satrec = useMemo(
    () => satellite.twoline2satrec(tleState.line1, tleState.line2),
    [tleState.line1, tleState.line2],
  );

  const simMs = nowMs + scrubOffsetSec * 1000;
  const isLive = scrubOffsetSec === 0;

  // Real-time 1 Hz SGP4 propagation + Eclipse + Observer Look Angles + Doppler
  const liveState = useMemo(
    () => propagateSatelliteLive(satrec, new Date(simMs), observer.lat, observer.lon, 0.02),
    [satrec, simMs, observer.lat, observer.lon],
  );

  // Ground track updated every 15s bucket (or immediately when scrubbing/switching) for zero wasted CPU
  const trackAnchorMs = Math.floor(simMs / 15000) * 15000;
  const groundTrack = useMemo(
    () => generateSgp4GroundTrack(satrec, trackAnchorMs, 45, 95, 60),
    [satrec, trackAnchorMs],
  );

  // Deterministic 24-hour SGP4 Overhead Pass Predictor (bucketed to 1-minute epochs)
  const passAnchorMs = Math.floor(nowMs / 60000) * 60000;
  const upcomingPasses = useMemo(
    () => predictOverheadPasses(satrec, observer.lat, observer.lon, passAnchorMs, 24, 10, 6),
    [satrec, observer.lat, observer.lon, passAnchorMs],
  );

  const handleCopyTle = useCallback(() => {
    const text = `${currentCraft.name}\n${tleState.line1}\n${tleState.line2}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedTle(true);
      setTimeout(() => setCopiedTle(false), 1800);
    });
  }, [currentCraft.name, tleState.line1, tleState.line2]);

  const handlePreviewPass = useCallback(
    (maxElMs: number) => {
      const deltaSec = Math.round((maxElMs - Date.now()) / 1000);
      setScrubOffsetSec(deltaSec);
    },
    [],
  );

  const lat = liveState?.latitude ?? 0;
  const lon = liveState?.longitude ?? 0;
  const altKm = liveState?.altitudeKm ?? currentCraft.avgAltitudeKm;
  const velKmh = liveState?.velocityKmh ?? 27580;
  const velKms = liveState?.velocityKms ?? 7.66;
  const lighting = liveState?.lighting ?? "sunlit";
  const footprintKm = liveState?.footprintKm ?? 4500;
  const obs = liveState?.observer;

  const isCrewedStation = selectedId === "iss" || selectedId === "tiangong";

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#02040a] font-sans text-slate-100 select-none">
      {/* ── Full-Viewport 3D Earth Globe OR 2D Real-Time Solar Terminator Map ── */}
      <div className="absolute inset-0">
        {viewMode === "3d" ? (
          <CesiumISSGlobe
            satelliteId={currentCraft.id}
            satelliteName={currentCraft.name}
            iconSvg={currentCraft.iconSvg}
            themeColor={currentCraft.themeColor}
            latitude={lat}
            longitude={lon}
            altitude={altKm}
            velocity={velKmh}
            orbitTrail={groundTrack.pastTrail}
            futureOrbit={groundTrack.futureOrbit}
            userLat={observer.lat}
            userLon={observer.lon}
            solarLatDeg={liveState?.solarLatDeg ?? 0}
            solarLonDeg={liveState?.solarLonDeg ?? 0}
          />
        ) : (
          <SatelliteGroundTrack2D
            satelliteName={currentCraft.name}
            iconSvg={currentCraft.iconSvg}
            themeColor={currentCraft.themeColor}
            latitude={lat}
            longitude={lon}
            altitudeKm={altKm}
            lighting={lighting}
            solarLatDeg={liveState?.solarLatDeg ?? 0}
            solarLonDeg={liveState?.solarLonDeg ?? 0}
            pastTrail={groundTrack.pastTrail}
            futureOrbit={groundTrack.futureOrbit}
            observerLat={observer.lat}
            observerLon={observer.lon}
            observerLabel={observer.label}
            isAboveHorizon={Boolean(obs?.isAboveHorizon)}
          />
        )}
      </div>

      {/* ── 1. Compact Corner-Pinned Top Header Bar ───────────────────────── */}
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
                SATELLITES
              </span>
            </div>
          </div>

          {/* Top-Center: Compact Mode Switcher (Focus Ops vs 1,000+ Orbital Catalog) + TLE Source */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-8 items-center rounded-full border border-white/[0.10] bg-[#030714]/72 p-0.5 font-mono text-[10px] backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.14] px-3 font-medium tracking-wider text-white uppercase">
                <Radio className="h-3 w-3 text-sky-300" />
                <span>Focus</span>
              </span>
              <Link
                href="/satellites/catalog"
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-medium tracking-wider text-slate-400 uppercase transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Layers className="h-3 w-3" />
                <span className="hidden sm:inline">Catalog 1,000+</span>
                <span className="sm:hidden">1k+</span>
              </Link>
            </div>

            <div
              className="hidden h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#030714]/65 px-3 font-mono text-[10px] text-slate-300 backdrop-blur-2xl xl:flex"
              title={`TLE Epoch: ${tleState.keplerian.epochIso}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  tleState.source === "celestrak_live"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]"
                    : "bg-amber-400"
                }`}
              />
              <span>
                {tleState.source === "celestrak_live" ? "CelesTrak Live" : "Bundled TLE"}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-slate-400 tabular-nums">
                {tleState.keplerian.ageHours < 48
                  ? `${tleState.keplerian.ageHours.toFixed(1)}h epoch`
                  : `${Math.round(tleState.keplerian.ageHours / 24)}d epoch`}
              </span>
            </div>
          </div>

          {/* Top-Right: 3D/2D Toggle + GPS Observer + Telemetry Drawer Toggle */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 3D Globe / 2D Ground Track Switch */}
            <div className="flex h-8 items-center rounded-full border border-white/[0.10] bg-[#030714]/72 p-0.5 font-mono text-[10px] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => setViewMode("3d")}
                className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 transition-all ${
                  viewMode === "3d"
                    ? "bg-white/[0.14] text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Globe2 className="h-3 w-3" />
                <span className="hidden sm:inline">3D</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("2d")}
                className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 transition-all ${
                  viewMode === "2d"
                    ? "bg-white/[0.14] text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Map className="h-3 w-3" />
                <span className="hidden sm:inline">2D</span>
              </button>
            </div>

            {/* Observer GPS Pill */}
            <button
              type="button"
              onClick={requestGps}
              title={`Observer: ${observer.label} (${observer.lat.toFixed(3)}°, ${observer.lon.toFixed(3)}°) — Click to re-acquire GPS`}
              className="hidden h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#030714]/72 px-2.5 font-mono text-[10px] text-slate-300 backdrop-blur-2xl transition-colors hover:border-sky-400/40 hover:text-white md:inline-flex"
            >
              <MapPin className={`h-3 w-3 ${observer.isGps ? "text-emerald-400" : "text-sky-400"}`} />
              <span className="max-w-[110px] truncate">{observer.label}</span>
            </button>

            {/* Telemetry Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsRightOpen((v) => !v)}
              title="Toggle Telemetry & Pass Predictor Panel"
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-medium tracking-wider uppercase backdrop-blur-2xl transition-all ${
                isRightOpen
                  ? "border-white/25 bg-white/[0.12] text-white"
                  : "border-white/[0.10] bg-[#030714]/72 text-slate-300 hover:border-white/25 hover:text-white"
              }`}
            >
              {isRightOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Telemetry</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Left Floating Compact Fleet Selector Rail ──────────────────── */}
      <aside className="fixed top-13 left-2.5 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setIsFleetOpen((v) => !v)}
          className="flex h-7 w-fit cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#030714]/72 px-2.5 font-mono text-[9.5px] tracking-[0.14em] text-slate-300 uppercase backdrop-blur-2xl transition-colors hover:border-white/25 hover:text-white lg:hidden"
        >
          <Navigation className="h-3 w-3 text-sky-300" />
          <span>{currentCraft.name}</span>
        </button>

        <div
          className={`w-[216px] overflow-hidden rounded-2xl border border-white/[0.10] bg-[#030714]/76 p-1.5 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-all ${
            isFleetOpen ? "block" : "hidden lg:block"
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
            <span>Flagship Fleet</span>
            <span className="text-slate-500">{SATELLITE_CATALOG.length} SGP4</span>
          </div>
          <div className="space-y-0.5">
            {SATELLITE_CATALOG.map((sat) => {
              const active = sat.id === selectedId;
              return (
                <button
                  key={sat.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(sat.id);
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setIsFleetOpen(false);
                    }
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-all ${
                    active
                      ? "bg-white/[0.12] text-white ring-1 ring-white/[0.14]"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sat.iconSvg}
                      alt={sat.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] font-semibold leading-tight text-white">
                      {sat.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-slate-400 tabular-nums">
                      <span>#{sat.noradId}</span>
                      <span className="text-white/20">·</span>
                      <span>{sat.avgAltitudeKm} km</span>
                    </div>
                  </div>
                  {active && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: sat.themeColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── 3. Bottom-Center Compact SGP4 Time Scrubber Pill ──────────────── */}
      <div
        className={`pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2 transition-all duration-200 ${
          isRightOpen ? "lg:-translate-x-[calc(50%+120px)]" : ""
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/[0.10] bg-[#030714]/78 px-3 py-1.5 font-mono text-[10px] backdrop-blur-2xl shadow-[0_14px_40px_rgba(0,0,0,0.65)]">
          <button
            type="button"
            onClick={() => setScrubOffsetSec(0)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold tracking-wider uppercase transition-all ${
              isLive
                ? "bg-emerald-500/18 text-emerald-300 ring-1 ring-emerald-400/35"
                : "bg-amber-500/18 text-amber-300 ring-1 ring-amber-400/35 hover:bg-amber-500/28"
            }`}
            title="Snap back to real-time LIVE SGP4 telemetry"
          >
            {isLive ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            ) : (
              <RotateCcw className="h-2.5 w-2.5" />
            )}
            <span>{isLive ? "Live" : "Reset Live"}</span>
          </button>

          <input
            type="range"
            min={-2700}
            max={5400}
            step={30}
            value={Math.max(-2700, Math.min(5400, scrubOffsetSec))}
            onChange={(e) => setScrubOffsetSec(Number(e.target.value))}
            aria-label="Scrub SGP4 orbital time"
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-300 sm:w-44"
          />

          <span className="min-w-[78px] text-right text-slate-200 tabular-nums">
            {new Date(simMs).toISOString().slice(11, 19)} UTC
          </span>
        </div>
      </div>

      {/* ── 4. Right Floating Frosted Obsidian Telemetry & Pass Drawer ────── */}
      <aside
        className={`fixed top-13 right-2.5 bottom-2.5 z-30 w-[calc(100vw-20px)] max-w-[348px] transition-all duration-200 ease-out ${
          isRightOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-[110%] opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#030714]/80 backdrop-blur-2xl shadow-[0_24px_68px_rgba(0,0,0,0.7)]">
          {/* Spacecraft Summary Header */}
          <div className="border-b border-white/[0.08] px-3.5 pt-3 pb-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-mono text-sm font-bold text-white">
                    {currentCraft.name}
                  </h1>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium uppercase ${
                      lighting === "sunlit"
                        ? "border border-amber-400/30 bg-amber-400/12 text-amber-200"
                        : "border border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
                    }`}
                  >
                    {lighting === "sunlit" ? (
                      <Sun className="h-2.5 w-2.5" />
                    ) : (
                      <Moon className="h-2.5 w-2.5" />
                    )}
                    {lighting === "sunlit" ? "Sunlit" : "Umbra"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {currentCraft.fullName} · NORAD {currentCraft.noradId}
                </p>
              </div>
            </div>

            {/* 3-Tab Switcher */}
            <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[10px]">
              {[
                { id: "live" as const, label: "Live SGP4" },
                { id: "passes" as const, label: `Passes (${upcomingPasses.length})` },
                { id: "craft" as const, label: isCrewedStation ? "Crew & TLE" : "Specs & TLE" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRightTab(t.id)}
                  className={`cursor-pointer rounded-lg py-1.5 font-medium tracking-wider uppercase transition-all ${
                    rightTab === t.id
                      ? "bg-white/[0.13] text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto p-3.5">
            {rightTab === "live" && (
              <div className="space-y-3 font-mono">
                {/* 4-Card Primary Real-Time Ephemeris */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Altitude
                    </div>
                    <div className="mt-1 text-base font-semibold text-white tabular-nums">
                      {altKm.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">km</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Velocity
                    </div>
                    <div className="mt-1 text-base font-semibold text-white tabular-nums">
                      {velKms.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">km/s</span>
                    </div>
                    <div className="text-[9px] text-slate-500 tabular-nums">
                      {Math.round(velKmh).toLocaleString()} km/h
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Latitude
                    </div>
                    <div className="mt-1 text-xs font-semibold text-white tabular-nums">
                      {formatCoord(lat, "N", "S")}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Longitude
                    </div>
                    <div className="mt-1 text-xs font-semibold text-white tabular-nums">
                      {formatCoord(lon, "E", "W")}
                    </div>
                  </div>
                </div>

                {/* Live Topocentric Observer Radar (Az/El/Slant/Doppler) */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                      <Compass className="h-3 w-3 text-sky-400" />
                      From {observer.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[8.5px] font-semibold uppercase ${
                        obs?.isAboveHorizon
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-white/[0.06] text-slate-400"
                      }`}
                    >
                      {obs?.isAboveHorizon ? "Above Horizon" : "Below Horizon"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Azimuth</span>
                      <span className="text-white tabular-nums">
                        {obs ? `${obs.azimuthDeg.toFixed(1)}° ${azimuthToCompass(obs.azimuthDeg)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Elevation</span>
                      <span
                        className={`tabular-nums ${
                          obs?.isAboveHorizon ? "font-semibold text-emerald-300" : "text-slate-300"
                        }`}
                      >
                        {obs ? `${obs.elevationDeg.toFixed(1)}°` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Slant Range</span>
                      <span className="text-white tabular-nums">
                        {obs ? `${Math.round(obs.slantRangeKm).toLocaleString()} km` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Doppler (VHF)</span>
                      <span className="text-sky-300 tabular-nums">
                        {obs
                          ? `${obs.dopplerKhz >= 0 ? "+" : ""}${obs.dopplerKhz.toFixed(2)} kHz`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Keplerian Elements from Active TLE */}
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02] text-[10.5px]">
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-slate-400">Apogee / Perigee</span>
                    <span className="text-white tabular-nums">
                      {tleState.keplerian.apogeeKm.toFixed(0)} × {tleState.keplerian.perigeeKm.toFixed(0)} km
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-slate-400">Inclination</span>
                    <span className="text-white tabular-nums">
                      {tleState.keplerian.inclinationDeg.toFixed(2)}°
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-slate-400">Orbital Period</span>
                    <span className="text-white tabular-nums">
                      {tleState.keplerian.periodMin.toFixed(2)} min ({tleState.keplerian.meanMotionRevPerDay.toFixed(2)} rev/d)
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-slate-400">Eccentricity</span>
                    <span className="text-white tabular-nums">
                      {tleState.keplerian.eccentricity.toFixed(5)}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-slate-400">Horizon Footprint</span>
                    <span className="text-white tabular-nums">
                      Ø {footprintKm.toLocaleString()} km
                    </span>
                  </div>
                </div>
              </div>
            )}

            {rightTab === "passes" && (
              <div className="space-y-2.5 font-mono">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Next 24h over {observer.label} (El ≥ 10°)</span>
                  <Clock className="h-3 w-3 text-slate-500" />
                </div>

                {upcomingPasses.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center text-[11px] text-slate-400">
                    No overhead passes ≥ 10° in the next 24 hours for {observer.label}.
                  </div>
                ) : (
                  upcomingPasses.map((pass) => {
                    const isVisible = pass.visibility === "visible";
                    const durMin = Math.floor(pass.durationSec / 60);
                    const durSec = pass.durationSec % 60;
                    return (
                      <div
                        key={pass.id}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 transition-colors hover:border-white/[0.16]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-white tabular-nums">
                              {formatPassDateShort(pass.aosMs)} · {formatPassTime(pass.aosMs)}–{formatPassTime(pass.losMs)}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold uppercase ${
                              isVisible
                                ? "border border-amber-400/35 bg-amber-400/15 text-amber-200"
                                : "border border-white/[0.08] bg-white/[0.05] text-slate-400"
                            }`}
                          >
                            {isVisible ? <Sparkles className="h-2.5 w-2.5" /> : <Radio className="h-2.5 w-2.5" />}
                            {isVisible ? "Visible" : "Radio"}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <div className="space-y-0.5 tabular-nums">
                            <div>
                              Max El <strong className="text-sky-300">{pass.maxElDeg.toFixed(1)}°</strong> ·{" "}
                              {durMin}m {durSec}s
                            </div>
                            <div className="text-[9.5px] text-slate-500">
                              {azimuthToCompass(pass.aosAzDeg)} ({pass.aosAzDeg}°) →{" "}
                              {azimuthToCompass(pass.maxAzDeg)} →{" "}
                              {azimuthToCompass(pass.losAzDeg)} ({pass.losAzDeg}°)
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePreviewPass(pass.maxElMs)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/12 px-2.5 py-1 text-[9.5px] font-medium text-sky-200 transition-colors hover:bg-sky-400/22 hover:text-white"
                          >
                            <Eye className="h-2.5 w-2.5" />
                            <span>Preview</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {rightTab === "craft" && (
              <div className="space-y-3.5 font-mono">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 font-sans">
                  <div className="flex items-center justify-between font-mono text-[9.5px] text-slate-400">
                    <span>{currentCraft.agency}</span>
                    <span>Launched {currentCraft.launchYear}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    {currentCraft.description}
                  </p>
                </div>

                {/* Active Expedition Crew (for ISS / Tiangong) */}
                {isCrewedStation && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                    <div className="mb-2 flex items-center justify-between text-[9.5px] tracking-[0.14em] text-slate-300 uppercase">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-sky-400" />
                        Orbital Expedition Crew
                      </span>
                      <span className="text-slate-500">{CURRENT_ISS_CREW.length} onboard</span>
                    </div>
                    <div className="divide-y divide-white/[0.06] text-[10.5px]">
                      {CURRENT_ISS_CREW.map((member) => (
                        <div key={member.name} className="flex items-center justify-between py-1.5">
                          <div>
                            <div className="font-sans text-xs font-medium text-white">
                              {member.name}
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              {member.role} · {member.agency}
                            </div>
                          </div>
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-sky-300">
                            {member.countryCode}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verified Raw NORAD TLE Block */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between text-[9.5px] text-slate-400">
                    <span className="tracking-[0.14em] uppercase">Live NORAD TLE</span>
                    <button
                      type="button"
                      onClick={handleCopyTle}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-300 hover:bg-white/[0.10] hover:text-white"
                    >
                      {copiedTle ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                      <span>{copiedTle ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-[8.5px] leading-relaxed text-slate-300">
                    {tleState.line1}
                    {"\n"}
                    {tleState.line2}
                  </pre>
                  <div className="mt-1.5 text-[9px] text-slate-500">
                    Epoch {tleState.keplerian.epochIso.replace("T", " ").slice(0, 19)} UTC
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
