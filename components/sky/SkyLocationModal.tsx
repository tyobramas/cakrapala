"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Search,
  LocateFixed,
  Loader2,
  MapPin,
  Telescope,
  Globe2,
  Sun,
  Moon,
  Check,
} from "lucide-react";
import {
  PRESET_CITIES,
  computeSunPosition,
  computeTerminatorCurve,
  formatObserverClock,
  type ObserverLocation,
} from "@/lib/astronomy/topocentricSky";

interface GeoSearchResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  location: ObserverLocation;
  observationDate: Date;
  onSelectLocation: (loc: ObserverLocation) => void;
}

export default function SkyLocationModal({
  isOpen,
  onClose,
  location,
  observationDate,
  onSelectLocation,
}: Props) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapImgRef = useRef<HTMLImageElement | null>(null);

  // Preload Earth equirectangular map texture
  useEffect(() => {
    if (!isOpen || mapImgRef.current) return;
    const img = new window.Image();
    img.src = "/textures/planets/earth.jpg";
    img.onload = () => {
      mapImgRef.current = img;
      setIsMapLoaded(true);
    };
  }, [isOpen]);

  // Debounced live global city search (Open-Meteo Geocoding API — free, global, returns exact IANA timezone + elevation)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          trimmed,
        )}&count=6&language=en&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { results?: GeoSearchResult[] };
          setSearchResults(data.results ?? []);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setSearchResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const solarState = useMemo(
    () => computeSunPosition(observationDate, location.latitude, location.longitude),
    [observationDate, location.latitude, location.longitude],
  );

  const localClock = useMemo(
    () => formatObserverClock(observationDate, location, false),
    [observationDate, location],
  );

  const terminatorPoints = useMemo(
    () => computeTerminatorCurve(observationDate),
    [observationDate],
  );

  // Render crisp interactive Day/Night Terminator Earth map
  useEffect(() => {
    if (!isOpen || !isMapLoaded) return;
    const canvas = canvasRef.current;
    const img = mapImgRef.current;
    if (!canvas || !img) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, rect.width);
    const h = Math.max(150, rect.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // 1. Base Earth texture
    ctx.drawImage(img, 0, 0, w, h);

    // 2. Subtle graticule lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 0.75;
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = ((lon + 180) / 360) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. Accurate Solar Night Shadow Mask using terminator curve
    const sunLat = solarState.solarSubpoint.lat;
    const sunLng = solarState.solarSubpoint.lng;

    if (terminatorPoints.length > 2) {
      ctx.beginPath();
      terminatorPoints.forEach((pt, i) => {
        const px = ((pt.lng + 180) / 360) * w;
        const py = ((90 - pt.lat) / 180) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      // Close polygon on the night pole side
      const nightPoleY = sunLat >= 0 ? h : 0;
      ctx.lineTo(w, nightPoleY);
      ctx.lineTo(0, nightPoleY);
      ctx.closePath();
      ctx.fillStyle = "rgba(2, 6, 20, 0.62)";
      ctx.fill();

      // Golden twilight terminator line
      ctx.beginPath();
      terminatorPoints.forEach((pt, i) => {
        const px = ((pt.lng + 180) / 360) * w;
        const py = ((90 - pt.lat) / 180) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Subsolar point marker
    const sunX = ((sunLng + 180) / 360) * w;
    const sunY = ((90 - sunLat) / 180) * h;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 1, sunX, sunY, 14);
    sunGrad.addColorStop(0, "rgba(254, 240, 138, 0.95)");
    sunGrad.addColorStop(0.45, "rgba(251, 191, 36, 0.45)");
    sunGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
    ctx.fill();

    // 5. Selected observer pin
    const locX = ((location.longitude + 180) / 360) * w;
    const locY = ((90 - location.latitude) / 180) * h;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(locX, 0);
    ctx.lineTo(locX, h);
    ctx.moveTo(0, locY);
    ctx.lineTo(w, locY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(locX, locY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(locX, locY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.restore();
  }, [isOpen, isMapLoaded, terminatorPoints, solarState, location]);

  // Reverse geocode a clicked map point or GPS fix
  const resolveAndApplyCoords = useCallback(
    async (lat: number, lng: number, explicitTimeZone?: string) => {
      setIsLocating(true);
      setStatusMsg("Resolving coordinates & timezone...");
      const fallbackOffset = Math.round(lng / 15);
      try {
        const res = await fetch(
          `/api/geocode/reverse?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const name =
            data.name ||
            `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
          const country =
            data.region && data.region !== data.name
              ? `${data.region}, ${data.country}`
              : data.country || "Custom Coordinates";
          onSelectLocation({
            name,
            country,
            latitude: Number(lat.toFixed(4)),
            longitude: Number(lng.toFixed(4)),
            timezoneOffsetHours:
              typeof data.timezoneOffsetHours === "number"
                ? data.timezoneOffsetHours
                : fallbackOffset,
            timeZone: explicitTimeZone || data.timezone || undefined,
            elevationMeters: typeof data.elevation === "number" ? data.elevation : 10,
          });
          setStatusMsg(`Locked to ${name}`);
        } else {
          onSelectLocation({
            name: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`,
            country: "Custom Coordinates",
            latitude: Number(lat.toFixed(4)),
            longitude: Number(lng.toFixed(4)),
            timezoneOffsetHours: fallbackOffset,
            timeZone: explicitTimeZone,
          });
          setStatusMsg("Coordinates locked");
        }
      } catch {
        onSelectLocation({
          name: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`,
          country: "Custom Coordinates",
          latitude: Number(lat.toFixed(4)),
          longitude: Number(lng.toFixed(4)),
          timezoneOffsetHours: fallbackOffset,
          timeZone: explicitTimeZone,
        });
        setStatusMsg("Coordinates locked");
      } finally {
        setIsLocating(false);
      }
    },
    [onSelectLocation],
  );

  // Browser GPS geolocation
  const handleUseMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatusMsg("Geolocation not supported by this browser.");
      return;
    }
    setIsLocating(true);
    setStatusMsg("Requesting GPS position...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        resolveAndApplyCoords(pos.coords.latitude, pos.coords.longitude, browserTz);
      },
      (err) => {
        setIsLocating(false);
        setStatusMsg(err.message || "Unable to access GPS location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [resolveAndApplyCoords]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const lng = Math.max(-180, Math.min(180, nx * 360 - 180));
    const lat = Math.max(-85, Math.min(85, 90 - ny * 180));
    resolveAndApplyCoords(lat, lng);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.12] bg-[#040916]/92 shadow-[0_32px_90px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-sky-300">
              <Globe2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">
                Observer Location &amp; Day/Night Map
              </h2>
              <p className="font-mono text-[10px] tracking-wider text-slate-400">
                {location.name} · {Math.abs(location.latitude).toFixed(3)}°
                {location.latitude >= 0 ? "N" : "S"},{" "}
                {Math.abs(location.longitude).toFixed(3)}°
                {location.longitude >= 0 ? "E" : "W"} · {localClock.time}{" "}
                {localClock.tzLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close location selector"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Search + GPS row */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuery(val);
                  if (val.trim().length < 2) {
                    setSearchResults([]);
                    setIsSearching(false);
                  }
                }}
                placeholder="Search any city worldwide (e.g. Surabaya, Bali, Paris, Seoul)..."
                className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] py-2.5 pr-9 pl-10 text-xs text-white placeholder-slate-500 outline-none transition-colors focus:border-sky-400/60 focus:bg-white/[0.06]"
              />
              {isSearching && (
                <Loader2 className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-sky-400" />
              )}
            </div>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-400/35 bg-sky-400/15 px-4 py-2.5 text-xs font-medium text-sky-200 transition-all hover:bg-sky-400/25 disabled:opacity-60"
            >
              {isLocating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LocateFixed className="h-3.5 w-3.5" />
              )}
              <span>Use My GPS</span>
            </button>
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#070f24]/90 divide-y divide-white/[0.06]">
              {searchResults.map((item) => {
                const region = [item.admin1, item.country].filter(Boolean).join(", ");
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectLocation({
                        name: item.name,
                        country: region || "Earth",
                        latitude: Number(item.latitude.toFixed(4)),
                        longitude: Number(item.longitude.toFixed(4)),
                        timezoneOffsetHours: Math.round(item.longitude / 15),
                        timeZone: item.timezone,
                        elevationMeters: item.elevation ?? 10,
                      });
                      setQuery("");
                      setSearchResults([]);
                      setStatusMsg(`Switched to ${item.name}`);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-medium text-white">
                        {item.name}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {region} {item.timezone ? `· ${item.timezone}` : ""}
                      </span>
                    </div>
                    <span className="ml-3 shrink-0 font-mono text-[10px] text-slate-400">
                      {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Interactive Day/Night Terminator Earth Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="uppercase tracking-[0.18em]">
                Click Anywhere on Earth to Pinpoint
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                {solarState.isDaylight ? (
                  <Sun className="h-3 w-3 text-amber-300" />
                ) : (
                  <Moon className="h-3 w-3 text-sky-300" />
                )}
                Sun Alt {solarState.altitudeDeg.toFixed(1)}°
              </span>
            </div>

            <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#020612]">
              <canvas
                ref={canvasRef}
                onClick={handleMapClick}
                className="h-full w-full cursor-crosshair block"
              />
              {statusMsg && (
                <div className="pointer-events-none absolute bottom-2.5 left-3 rounded-full border border-white/10 bg-[#030714]/80 px-3 py-1 font-mono text-[10px] text-sky-200 backdrop-blur-md">
                  {statusMsg}
                </div>
              )}
            </div>
          </div>

          {/* Curated World Observatories & Cities */}
          <div className="space-y-2.5">
            <span className="block font-mono text-[10px] tracking-[0.2em] text-slate-400 uppercase">
              Quick Stations &amp; Observatories
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESET_CITIES.map((city) => {
                const isSelected =
                  Math.abs(city.latitude - location.latitude) < 0.02 &&
                  Math.abs(city.longitude - location.longitude) < 0.02;
                const isObs = city.name.toLowerCase().includes("observatory") || city.name.toLowerCase().includes("bosscha") || city.name.toLowerCase().includes("roque");
                return (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      onSelectLocation(city);
                      setStatusMsg(`Locked to ${city.name}`);
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "border-sky-400/50 bg-sky-400/15 text-white"
                        : "border-white/[0.07] bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-[11px] font-medium">
                        {isObs ? (
                          <Telescope className="h-3 w-3 shrink-0 text-sky-400" />
                        ) : (
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        )}
                        <span className="truncate">{city.name}</span>
                      </span>
                      <span className="block truncate pl-4.5 text-[9.5px] text-slate-400">
                        {city.country}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-sky-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-white/[0.02] px-6 py-3.5">
          <span className="font-mono text-[10px] text-slate-400">
            IAU J2000 Precession + Atmospheric Refraction Active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-950 transition-all hover:bg-slate-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
