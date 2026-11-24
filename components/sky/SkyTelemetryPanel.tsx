"use client";

import { useMemo } from "react";
import {
  X,
  Sunrise,
  Sunset,
  ArrowUp,
  Crosshair,
  Sparkles,
  ExternalLink,
  Clock,
} from "lucide-react";
import {
  computeRiseTransitSet,
  formatRaDec,
  formatObserverClock,
  type ObserverLocation,
  type TopocentricNebula,
} from "@/lib/astronomy/topocentricSky";
import type { TopocentricSatellite } from "@/lib/astronomy/topocentricSatellites";
import {
  STAR_PROFILES,
  BODY_PROFILES,
} from "@/lib/astronomy/celestialObjectProfiles";
import {
  getConstellationProfile,
  type ConstellationProfile,
} from "@/lib/astronomy/constellationProfiles";

export interface SelectedSkyTarget {
  id: string;
  name: string;
  type: "star" | "planet" | "moon" | "sun" | "constellation" | "nebula" | "satellite";
  azimuthDeg: number;
  altitudeDeg: number;
  raDeg?: number;
  decDeg?: number;
  mag: number;
  colorHex: string;
  phaseDeg?: number;
  illuminationFraction?: number;
  nebulaInfo?: TopocentricNebula;
  satelliteInfo?: TopocentricSatellite;
  constellationProfile?: ConstellationProfile;
}

interface NasaImageState {
  loading: boolean;
  imageUrl: string;
  title: string;
  photographer: string;
}

interface Props {
  target: SelectedSkyTarget | null;
  location: ObserverLocation;
  observationDate: Date;
  nasaImage: NasaImageState | null;
  onClose: () => void;
  onCenterCamera: (az: number, alt: number) => void;
  onJumpToRise: (hoursFromNow: number) => void;
}

function compassBearing(azDeg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16];
}

function moonPhaseName(phaseDeg: number): string {
  const p = ((phaseDeg % 360) + 360) % 360;
  if (p < 15 || p >= 345) return "New Moon";
  if (p < 75) return "Waxing Crescent";
  if (p < 105) return "First Quarter";
  if (p < 165) return "Waxing Gibbous";
  if (p < 195) return "Full Moon";
  if (p < 255) return "Waning Gibbous";
  if (p < 285) return "Last Quarter";
  return "Waning Crescent";
}

function MoonPhaseSvg({ phaseDeg }: { phaseDeg: number }) {
  // 0 = new, 90 = first quarter (right lit), 180 = full, 270 = last quarter (left lit)
  const rad = (phaseDeg * Math.PI) / 180;
  const rx = Math.abs(Math.cos(rad)) * 34;
  const waxing = phaseDeg < 180;
  const gibbous = phaseDeg > 90 && phaseDeg < 270;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = gibbous ? (waxing ? 1 : 0) : (waxing ? 0 : 1);

  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16 shrink-0">
      <circle cx="40" cy="40" r="34" fill="#0b1224" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
      {phaseDeg > 3 && phaseDeg < 357 && (
        <path
          d={`M 40 6 A 34 34 0 0 ${sweepOuter} 40 74 A ${rx} 34 0 0 ${sweepInner} 40 6 Z`}
          fill="#f1f5f9"
        />
      )}
    </svg>
  );
}

export default function SkyTelemetryPanel({
  target,
  location,
  observationDate,
  nasaImage,
  onClose,
  onCenterCamera,
  onJumpToRise,
}: Props) {
  const ephemeris = useMemo(() => {
    if (!target || target.type === "satellite") return null;
    return computeRiseTransitSet(target, location, observationDate);
  }, [target, location, observationDate]);

  const raDecFormatted = useMemo(() => {
    if (!target || typeof target.raDeg !== "number" || typeof target.decDeg !== "number") {
      return null;
    }
    return formatRaDec(target.raDeg, target.decDeg);
  }, [target]);

  const tzLabel = useMemo(
    () => formatObserverClock(observationDate, location, false).tzLabel,
    [observationDate, location],
  );

  if (!target) return null;

  const isAbove = target.altitudeDeg >= 0;
  const cProfile =
    target.type === "constellation"
      ? target.constellationProfile || getConstellationProfile(target.id || target.name)
      : null;

  const starProfile =
    target.type === "star"
      ? STAR_PROFILES[target.id] ||
        Object.values(STAR_PROFILES).find(
          (p) => p.name?.toLowerCase() === target.name.toLowerCase(),
        )
      : null;

  const bodyProfile =
    target.type === "planet" || target.type === "moon" || target.type === "sun"
      ? BODY_PROFILES[target.id.toLowerCase()]
      : null;

  const description =
    cProfile?.mythology ||
    target.nebulaInfo?.description ||
    starProfile?.description ||
    bodyProfile?.description ||
    (target.type === "satellite" && target.satelliteInfo
      ? `${target.satelliteInfo.categoryLabel} actively tracked via real-time SGP4 orbital propagation.`
      : `Recognized IAU celestial object observed from ${location.name}.`);

  const funFact =
    target.nebulaInfo?.funFact ||
    starProfile?.funFact ||
    bodyProfile?.funFact ||
    null;

  const distanceLabel =
    target.nebulaInfo?.distanceLy ||
    starProfile?.distanceLy ||
    bodyProfile?.distanceLy ||
    (target.satelliteInfo ? `${Math.round(target.satelliteInfo.rangeKm).toLocaleString()} km slant` : null);

  const artFile = cProfile?.artworkFile || null;

  return (
    <aside
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed top-20 right-4 bottom-24 z-30 flex w-[calc(100vw-2rem)] max-w-[340px] flex-col overflow-hidden rounded-3xl border border-white/[0.12] bg-[#040916]/86 shadow-[0_24px_72px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl sm:right-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 pt-4 pb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] font-medium tracking-[0.22em] text-sky-300 uppercase">
              {target.type === "constellation"
                ? `IAU Constellation${cProfile?.abbreviation ? ` · ${cProfile.abbreviation}` : ""}`
                : target.type === "nebula"
                  ? target.nebulaInfo?.messierNgc || "Deep Sky"
                  : target.type === "satellite"
                    ? `NORAD ${target.satelliteInfo?.noradId ?? ""}`
                    : target.type}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-medium ${
                isAbove
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-slate-700/60 text-slate-400"
              }`}
            >
              {isAbove ? "Visible" : "Below Horizon"}
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold tracking-tight text-white">
            {target.name}
          </h3>
          {cProfile?.englishName && (
            <p className="text-[11px] text-slate-400">{cProfile.englishName}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close telemetry panel"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {/* Visual Banner: Moon Phase OR Constellation Art OR NASA Imagery */}
        {target.type === "moon" && typeof target.phaseDeg === "number" && (
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
            <MoonPhaseSvg phaseDeg={target.phaseDeg} />
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white">
                {moonPhaseName(target.phaseDeg)}
              </div>
              <div className="font-mono text-[11px] text-sky-300">
                {Math.round((target.illuminationFraction ?? 0.5) * 100)}% Illuminated
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                Phase Angle {target.phaseDeg.toFixed(1)}°
              </div>
            </div>
          </div>
        )}

        {target.type === "constellation" && artFile && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#020612]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/textures/constellations/${artFile}`}
              alt={target.name}
              className="h-36 w-full object-contain p-2 opacity-90"
            />
            {cProfile?.monthBestSeen && (
              <span className="absolute right-2.5 bottom-2 rounded-full border border-white/10 bg-black/70 px-2.5 py-0.5 font-mono text-[9.5px] text-sky-200 backdrop-blur-md">
                Best: {cProfile.monthBestSeen}
              </span>
            )}
          </div>
        )}

        {target.type !== "moon" &&
          target.type !== "constellation" &&
          target.type !== "satellite" &&
          nasaImage?.imageUrl && (
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nasaImage.imageUrl}
                alt={nasaImage.title}
                className="h-36 w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 py-1.5 font-mono text-[9px] text-slate-300">
                {nasaImage.photographer}
              </div>
            </div>
          )}

        {/* Topocentric Coordinates Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
              Azimuth
            </span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-white">
              {target.azimuthDeg.toFixed(1)}°{" "}
              <span className="text-sky-300">{compassBearing(target.azimuthDeg)}</span>
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
              Altitude
            </span>
            <span
              className={`mt-0.5 block font-mono text-xs font-semibold ${
                isAbove ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              {target.altitudeDeg >= 0 ? "+" : ""}
              {target.altitudeDeg.toFixed(2)}°
            </span>
          </div>

          {raDecFormatted && (
            <>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
                  RA (J2000)
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-200">
                  {raDecFormatted.raStr}
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
                  Dec (J2000)
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-200">
                  {raDecFormatted.decStr}
                </span>
              </div>
            </>
          )}

          {target.type === "satellite" && target.satelliteInfo ? (
            <>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
                  Orbit Alt
                </span>
                <span className="mt-0.5 block font-mono text-xs text-emerald-300">
                  {Math.round(target.satelliteInfo.altitudeKm).toLocaleString()} km
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
                  Velocity
                </span>
                <span className="mt-0.5 block font-mono text-xs text-white">
                  {target.satelliteInfo.speedKmS.toFixed(2)} km/s
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
                  Magnitude
                </span>
                <span className="mt-0.5 block font-mono text-xs text-white">
                  {Number.isFinite(target.mag) ? `${target.mag.toFixed(2)} V` : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="block font-mono text-[9px] tracking-[0.16em] text-slate-400 uppercase">
                  Distance
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-200">
                  {distanceLabel || (cProfile?.quadrant ? `Quad ${cProfile.quadrant}` : "—")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Observer-Local Rise / Transit / Set Schedule */}
        {ephemeris && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5">
            <div className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-slate-400 uppercase">
              <span>Local Schedule ({location.name})</span>
              <span className="text-slate-500">{tzLabel}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.03] py-2">
                <Sunrise className="mx-auto h-3.5 w-3.5 text-amber-300" />
                <span className="mt-1 block font-mono text-[9px] text-slate-400">
                  RISE
                </span>
                <span className="block font-mono text-[11px] font-semibold text-white">
                  {ephemeris.riseTime}
                </span>
              </div>
              <div className="rounded-xl bg-white/[0.03] py-2">
                <ArrowUp className="mx-auto h-3.5 w-3.5 text-sky-300" />
                <span className="mt-1 block font-mono text-[9px] text-slate-400">
                  TRANSIT
                </span>
                <span className="block font-mono text-[11px] font-semibold text-white">
                  {ephemeris.transitTime}
                </span>
              </div>
              <div className="rounded-xl bg-white/[0.03] py-2">
                <Sunset className="mx-auto h-3.5 w-3.5 text-rose-300" />
                <span className="mt-1 block font-mono text-[9px] text-slate-400">
                  SET
                </span>
                <span className="block font-mono text-[11px] font-semibold text-white">
                  {ephemeris.setTime}
                </span>
              </div>
            </div>
            {ephemeris.maxAltitudeDeg !== null && (
              <p className="mt-2 text-center font-mono text-[9.5px] text-slate-400">
                Max Culmination Altitude:{" "}
                <span className="text-slate-200">
                  {Math.min(90, ephemeris.maxAltitudeDeg).toFixed(1)}°
                </span>
              </p>
            )}
          </div>
        )}

        {/* Description & Fun Fact */}
        <p className="text-xs leading-relaxed text-slate-300">{description}</p>

        {funFact && (
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-[11px] leading-relaxed text-sky-100/90">
            <span className="mb-1 inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.18em] text-sky-300 uppercase">
              <Sparkles className="h-3 w-3" />
              Astrophysics Note
            </span>
            <p>{funFact}</p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center gap-2 border-t border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <button
          type="button"
          onClick={() => onCenterCamera(target.azimuthDeg, target.altitudeDeg)}
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.06] py-2 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.12]"
        >
          <Crosshair className="h-3.5 w-3.5 text-sky-300" />
          <span>Center</span>
        </button>

        {!isAbove && ephemeris && ephemeris.hoursUntilRise && ephemeris.hoursUntilRise > 0 && (
          <button
            type="button"
            onClick={() => onJumpToRise(ephemeris.hoursUntilRise! + 0.25)}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-sky-400 py-2 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-sky-300"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Jump to Rise</span>
          </button>
        )}

        {target.type === "constellation" && (
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(target.name)}_(constellation)`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[11px] text-slate-300 hover:bg-white/[0.1] hover:text-white"
            title="Read IAU reference on Wikipedia"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </aside>
  );
}
