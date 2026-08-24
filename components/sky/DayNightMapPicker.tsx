"use client";

/**
 * DayNightMapPicker — NASA Planetary Geospatial Command & Earth Observatory Locator.
 * Clean, elegant UI/UX focused on selecting observation stations across the globe.
 * Features:
 *   - Interactive Zoom & Pan WGS-84 Map (Mouse wheel, pinch, drag-to-pan, HUD controls)
 *   - Real-time Point-and-Click Reverse Geocoding (Detects City, Region, Country, Ocean)
 *   - Real-time Day/Night Solar Terminator Wave across NASA Earth Texture
 *   - Clean Categorized Grid for World-Class Observatories & Global Metropolises
 *   - Sleek Frosted Glassmorphism Telemetry Inspector & 3D Sky Dome Launch
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sun,
  Moon,
  ArrowRight,
  ArrowLeft,
  Globe2,
  Crosshair,
  Telescope,
  Building2,
  MapPin,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LocateFixed,
  Loader2,
  Search,
} from "lucide-react";
import {
  PRESET_CITIES,
  computeSunPosition,
  computeTerminatorCurve,
  type ObserverLocation,
  type SolarState,
} from "@/lib/astronomy/topocentricSky";

// Curated Major Observatories & Global Metropolitan Sites
const OBSERVATORY_SITES: (ObserverLocation & { category: "observatory" | "city"; description: string })[] = [
  {
    name: "Bogor (Bosscha Sector)",
    country: "Indonesia",
    latitude: -6.595,
    longitude: 106.8166,
    timezoneOffsetHours: 7,
    category: "observatory",
    description: "Equatorial Stargazing & Bosscha Baseline",
  },
  {
    name: "Special Capital Region of Jakarta",
    country: "Indonesia",
    latitude: -6.2088,
    longitude: 106.8456,
    timezoneOffsetHours: 7,
    category: "city",
    description: "Planetarium Jakarta & TIM Baseline",
  },
  {
    name: "Bandung",
    country: "Indonesia",
    latitude: -6.9175,
    longitude: 107.6191,
    timezoneOffsetHours: 7,
    category: "city",
    description: "Bosscha Observatory Perimeter • Lembang",
  },
  {
    name: "Mauna Kea Observatory",
    country: "Hawaii, USA",
    latitude: 19.8206,
    longitude: -155.4681,
    timezoneOffsetHours: -10,
    category: "observatory",
    description: "4,205m Summit • Keck & Subaru Telescopes",
  },
  {
    name: "Paranal Observatory (VLT)",
    country: "Atacama Desert, Chile",
    latitude: -24.6272,
    longitude: -70.4042,
    timezoneOffsetHours: -4,
    category: "observatory",
    description: "Very Large Telescope (ESO) • Pristine Dark Sky",
  },
  {
    name: "Roque de los Muchachos",
    country: "La Palma, Spain",
    latitude: 28.7567,
    longitude: -17.8819,
    timezoneOffsetHours: 0,
    category: "observatory",
    description: "Gran Telescopio Canarias (GTC)",
  },
  {
    name: "Reykjavik (Aurora Station)",
    country: "Iceland",
    latitude: 64.1466,
    longitude: -21.9426,
    timezoneOffsetHours: 0,
    category: "observatory",
    description: "Northern Lights & High-Latitude Magnetosphere",
  },
  {
    name: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
    timezoneOffsetHours: 9,
    category: "city",
    description: "National Astronomical Observatory of Japan",
  },
  {
    name: "London (Greenwich Prime)",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
    timezoneOffsetHours: 1,
    category: "city",
    description: "Royal Observatory Greenwich (0° Meridian)",
  },
  {
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    timezoneOffsetHours: -4,
    category: "city",
    description: "Hayden Planetarium & North American Hub",
  },
  {
    name: "Sydney",
    country: "Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    timezoneOffsetHours: 10,
    category: "city",
    description: "Southern Cross & Magellanic Clouds Hub",
  },
  {
    name: "Cairo",
    country: "Egypt",
    latitude: 30.0444,
    longitude: 31.2357,
    timezoneOffsetHours: 3,
    category: "city",
    description: "Kottamia Astronomical Observatory Baseline",
  },
  {
    name: "Rio de Janeiro",
    country: "Brazil",
    latitude: -22.9068,
    longitude: -43.1729,
    timezoneOffsetHours: -3,
    category: "city",
    description: "National Observatory of Brazil (ON)",
  },
];

interface Props {
  selectedLocation: ObserverLocation;
  onSelectLocation: (loc: ObserverLocation) => void;
  onEnterObservatory: () => void;
}

export default function DayNightMapPicker({
  selectedLocation,
  onSelectLocation,
  onEnterObservatory,
}: Props) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [gmst, setGmst] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<"all" | "observatory" | "city">("all");
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isResolvingGeo, setIsResolvingGeo] = useState<boolean>(false);
  const [resolvedStatus, setResolvedStatus] = useState<string>("");

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const hasDraggedRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Synchronize clock on mount
  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setCurrentDate(now);

    const updateTime = () => {
      const d = new Date();
      setCurrentDate(d);

      // Compute GMST
      const j2000 = d.getTime() / 86400000 + 2440587.5 - 2451545.0;
      let gmstHours = (18.697374558 + 24.06570982441908 * j2000) % 24;
      if (gmstHours < 0) gmstHours += 24;
      const gh = String(Math.floor(gmstHours)).padStart(2, "0");
      const gm = String(Math.floor((gmstHours % 1) * 60)).padStart(2, "0");
      const gs = String(Math.floor(((gmstHours % 1) * 60 % 1) * 60)).padStart(2, "0");
      setGmst(`${gh}:${gm}:${gs} GMST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Preload local high-res NASA equirectangular earth map
  useEffect(() => {
    const img = new window.Image();
    img.src = "/textures/planets/earth.jpg";
    img.onload = () => {
      mapImageRef.current = img;
      setIsMapLoaded(true);
    };
  }, []);

  // Compute Solar State & Terminator
  const solarState: SolarState = useMemo(() => {
    return computeSunPosition(
      currentDate,
      selectedLocation.latitude,
      selectedLocation.longitude
    );
  }, [currentDate, selectedLocation]);

  const terminatorPoints = useMemo(() => {
    return computeTerminatorCurve(currentDate);
  }, [currentDate]);

  // Observer Local Time calculations
  const observerLocalTime = useMemo(() => {
    const utcMs = currentDate.getTime() + currentDate.getTimezoneOffset() * 60000;
    const localMs = utcMs + selectedLocation.timezoneOffsetHours * 3600000;
    const localDate = new Date(localMs);
    const h = String(localDate.getHours()).padStart(2, "0");
    const m = String(localDate.getMinutes()).padStart(2, "0");
    const s = String(localDate.getSeconds()).padStart(2, "0");
    return {
      formatted: `${h}:${m}:${s}`,
      tzString:
        selectedLocation.timezoneOffsetHours >= 0
          ? `UTC+${selectedLocation.timezoneOffsetHours}`
          : `UTC${selectedLocation.timezoneOffsetHours}`,
    };
  }, [currentDate, selectedLocation]);

  // Helper: Clamp pan offset based on current zoom level
  const clampPan = useCallback((newPanX: number, newPanY: number, currentZoom: number) => {
    if (currentZoom <= 1) {
      return { x: 0, y: 0 };
    }
    const minX = 1 - currentZoom;
    const minY = 1 - currentZoom;
    return {
      x: Math.min(0, Math.max(minX, newPanX)),
      y: Math.min(0, Math.max(minY, newPanY)),
    };
  }, []);

  // Zoom controls
  const handleZoomChange = useCallback(
    (newZoomValue: number, clientCursor?: { x: number; y: number }) => {
      const clampedZoom = Math.min(8, Math.max(1, newZoomValue));
      if (clampedZoom === zoom) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        setZoom(clampedZoom);
        setPanOffset(clampPan(panOffset.x, panOffset.y, clampedZoom));
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const cursorNormX = clientCursor ? (clientCursor.x - rect.left) / rect.width : 0.5;
      const cursorNormY = clientCursor ? (clientCursor.y - rect.top) / rect.height : 0.5;

      const newPanX = cursorNormX - (cursorNormX - panOffset.x) * (clampedZoom / zoom);
      const newPanY = cursorNormY - (cursorNormY - panOffset.y) * (clampedZoom / zoom);

      setZoom(clampedZoom);
      setPanOffset(clampPan(newPanX, newPanY, clampedZoom));
    },
    [zoom, panOffset, clampPan]
  );

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleRecenterOnTarget = useCallback(() => {
    const currentZoom = Math.max(2, zoom);
    const nx = (selectedLocation.longitude + 180) / 360;
    const ny = (90 - selectedLocation.latitude) / 180;
    const newPanX = 0.5 - nx * currentZoom;
    const newPanY = 0.5 - ny * currentZoom;
    setZoom(currentZoom);
    setPanOffset(clampPan(newPanX, newPanY, currentZoom));
  }, [selectedLocation, zoom, clampPan]);

  // Reverse geocoding fetcher
  const resolveCoordinates = useCallback(
    async (lat: number, lng: number) => {
      setIsResolvingGeo(true);
      setResolvedStatus("Scanning satellite telemetry...");

      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`);
        if (res.ok) {
          const data = await res.json();
          const placeName = data.name || `Target (${lat >= 0 ? lat.toFixed(2) + "°N" : Math.abs(lat).toFixed(2) + "°S"}, ${lng >= 0 ? lng.toFixed(2) + "°E" : Math.abs(lng).toFixed(2) + "°W"})`;
          const countryName = data.region && data.region !== data.name ? `${data.region}, ${data.country}` : data.country || "Observation Point";

          onSelectLocation({
            name: placeName,
            country: countryName,
            latitude: parseFloat(lat.toFixed(4)),
            longitude: parseFloat(lng.toFixed(4)),
            timezoneOffsetHours:
              typeof data.timezoneOffsetHours === "number"
                ? data.timezoneOffsetHours
                : Math.round(lng / 15),
          });
          setResolvedStatus(`Station Locked: ${placeName}`);
        } else {
          setResolvedStatus("Station coordinates registered");
        }
      } catch {
        setResolvedStatus("Coordinates updated");
      } finally {
        setIsResolvingGeo(false);
      }
    },
    [onSelectLocation]
  );

  // Coordinate Conversion helper: Screen Pixel -> (Lat, Lng)
  const screenToGeo = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { lat: 0, lng: 0 };
      const rect = canvas.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width;
      const normY = (clientY - rect.top) / rect.height;

      const mapNormX = (normX - panOffset.x) / zoom;
      const mapNormY = (normY - panOffset.y) / zoom;

      const lng = Math.max(-180, Math.min(180, mapNormX * 360 - 180));
      const lat = Math.max(-90, Math.min(90, 90 - mapNormY * 180));

      return { lat, lng };
    },
    [panOffset, zoom]
  );

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
    handleZoomChange(zoom * zoomFactor, { x: e.clientX, y: e.clientY });
  };

  // Mouse Down (Start Drag / Pan)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    };
    hasDraggedRef.current = false;
    setIsDragging(true);
  };

  // Mouse Move (Pan or Hover Telemetry)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { lat, lng } = screenToGeo(e.clientX, e.clientY);
    setHoverCoords({
      lat: parseFloat(lat.toFixed(2)),
      lng: parseFloat(lng.toFixed(2)),
    });

    if (isDragging && dragStartRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - dragStartRef.current.clientX) / rect.width;
      const deltaY = (e.clientY - dragStartRef.current.clientY) / rect.height;

      if (Math.hypot(e.clientX - dragStartRef.current.clientX, e.clientY - dragStartRef.current.clientY) > 4) {
        hasDraggedRef.current = true;
      }

      const newPanX = dragStartRef.current.panX + deltaX;
      const newPanY = dragStartRef.current.panY + deltaY;
      setPanOffset(clampPan(newPanX, newPanY, zoom));
    }
  };

  // Mouse Up (End Drag or Handle Click)
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);

    // If mouse didn't drag more than 4px, treat as a precise click to select
    if (!hasDraggedRef.current) {
      const { lat, lng } = screenToGeo(e.clientX, e.clientY);

      // Check if clicked close to a preset observatory
      let nearestCity = OBSERVATORY_SITES[0];
      let minDistance = 999999;
      for (const site of OBSERVATORY_SITES) {
        const d = Math.hypot(site.latitude - lat, site.longitude - lng);
        if (d < minDistance) {
          minDistance = d;
          nearestCity = site;
        }
      }

      // If clicked near a curated site at low zoom, pick it directly
      if (minDistance < 3 / Math.sqrt(zoom)) {
        onSelectLocation(nearestCity);
        setResolvedStatus(`Station: ${nearestCity.name}`);
      } else {
        // Immediate provisional state while geocoding
        const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
        const lngStr = lng >= 0 ? `${lng.toFixed(2)}°E` : `${Math.abs(lng).toFixed(2)}°W`;
        onSelectLocation({
          name: `Station (${latStr}, ${lngStr})`,
          country: "Resolving Location...",
          latitude: parseFloat(lat.toFixed(4)),
          longitude: parseFloat(lng.toFixed(4)),
          timezoneOffsetHours: Math.round(lng / 15),
        });
        resolveCoordinates(lat, lng);
      }
    }

    dragStartRef.current = null;
    hasDraggedRef.current = false;
  };

  // Draw 2D Day/Night World Map on Canvas with Zoom & Pan Transforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // ── 1. Scaled & Panned Earth Texture & Geodetic System ────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    ctx.translate(panOffset.x * width, panOffset.y * height);
    ctx.scale(zoom, zoom);

    // Base World Map (NASA Equirectangular Earth Texture)
    if (mapImageRef.current) {
      ctx.drawImage(mapImageRef.current, 0, 0, width, height);
      // Dark aesthetic ocean tint
      ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = "#040814";
      ctx.fillRect(0, 0, width, height);
    }

    // Geodetic Grid Lines (30° intervals)
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.09)";
    ctx.lineWidth = Math.max(0.6, 1 / zoom);
    for (let lng = -180; lng <= 180; lng += 30) {
      const x = ((lng + 180) / 360) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const y = ((90 - lat) / 180) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Equator Line (Luminescent Cyan)
    const eqY = height / 2;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = Math.max(0.8, 1.2 / zoom);
    ctx.beginPath();
    ctx.moveTo(0, eqY);
    ctx.lineTo(width, eqY);
    ctx.stroke();
    ctx.restore();

    // Night-Time Shadow Overlay via Solar Terminator Curve
    ctx.save();
    if (terminatorPoints.length > 0) {
      ctx.beginPath();
      const firstPoint = terminatorPoints[0];
      const startX = ((firstPoint.lng + 180) / 360) * width;
      const startY = ((90 - firstPoint.lat) / 180) * height;
      ctx.moveTo(startX, startY);

      for (let i = 1; i < terminatorPoints.length; i++) {
        const pt = terminatorPoints[i];
        const px = ((pt.lng + 180) / 360) * width;
        const py = ((90 - pt.lat) / 180) * height;
        ctx.lineTo(px, py);
      }

      const sunLat = solarState.solarSubpoint?.lat ?? 0;
      if (sunLat >= 0) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
      } else {
        ctx.lineTo(width, 0);
        ctx.lineTo(0, 0);
      }
      ctx.closePath();

      // Translucent deep space night shadow
      ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
      ctx.fill();

      // Glowing golden terminator boundary line
      ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
      ctx.lineWidth = Math.max(1, 2 / zoom);
      ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
      ctx.shadowBlur = 10;
      ctx.stroke();
    }
    ctx.restore();

    // Sub-Solar Zenith Point (Direct Sunlight Spot)
    ctx.save();
    const sunLng = solarState.solarSubpoint?.lng ?? 0;
    const sunLat = solarState.solarSubpoint?.lat ?? 0;
    const sunScreenX = ((sunLng + 180) / 360) * width;
    const sunScreenY = ((90 - sunLat) / 180) * height;
    const sunGlowR = 24 / Math.sqrt(zoom);

    const sunGlow = ctx.createRadialGradient(
      sunScreenX,
      sunScreenY,
      2 / zoom,
      sunScreenX,
      sunScreenY,
      sunGlowR
    );
    sunGlow.addColorStop(0, "rgba(254, 240, 138, 1)");
    sunGlow.addColorStop(0.35, "rgba(234, 179, 8, 0.8)");
    sunGlow.addColorStop(1, "rgba(234, 179, 8, 0)");

    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunScreenX, sunScreenY, sunGlowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sunScreenX, sunScreenY, 3.5 / Math.sqrt(zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Curated Sites Small Dots on Map
    ctx.save();
    for (const site of OBSERVATORY_SITES) {
      if (site.name === selectedLocation.name) continue;
      const sx = ((site.longitude + 180) / 360) * width;
      const sy = ((90 - site.latitude) / 180) * height;
      ctx.fillStyle =
        site.category === "observatory" ? "rgba(34, 211, 238, 0.65)" : "rgba(148, 163, 184, 0.55)";
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5 / Math.sqrt(zoom), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // End transformed context
    ctx.restore();

    // ── 2. Vector Reticle & High-Resolution Labels (Un-transformed Space) ─────
    const obsLng = selectedLocation.longitude;
    const obsLat = selectedLocation.latitude;
    const normX = (obsLng + 180) / 360;
    const normY = (90 - obsLat) / 180;
    const obsScreenX = (normX * zoom + panOffset.x) * width;
    const obsScreenY = (normY * zoom + panOffset.y) * height;

    // Only render if reticle is on or near the visible canvas frame
    if (
      obsScreenX >= -60 &&
      obsScreenX <= width + 60 &&
      obsScreenY >= -60 &&
      obsScreenY <= height + 60
    ) {
      ctx.save();
      // Glowing target outer circle
      ctx.strokeStyle = isResolvingGeo ? "#eab308" : "#06b6d4";
      ctx.lineWidth = 1.6;
      ctx.shadowColor = isResolvingGeo ? "rgba(234, 179, 8, 0.8)" : "#06b6d4";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(obsScreenX, obsScreenY, 15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isResolvingGeo ? "rgba(234, 179, 8, 0.4)" : "rgba(6, 182, 212, 0.4)";
      ctx.beginPath();
      ctx.arc(obsScreenX, obsScreenY, 25, 0, Math.PI * 2);
      ctx.stroke();

      // Precision Crosshairs
      ctx.strokeStyle = isResolvingGeo ? "#facc15" : "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(obsScreenX - 22, obsScreenY);
      ctx.lineTo(obsScreenX + 22, obsScreenY);
      ctx.moveTo(obsScreenX, obsScreenY - 22);
      ctx.lineTo(obsScreenX, obsScreenY + 22);
      ctx.stroke();

      // Center Core Dot
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(obsScreenX, obsScreenY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Observer Label Pill with high contrast
      ctx.font = "bold 11px monospace";
      const labelText = isResolvingGeo ? "📍 RESOLVING LOCATION..." : selectedLocation.name;
      const textWidth = ctx.measureText(labelText).width;

      let boxX = obsScreenX + 12;
      let boxY = obsScreenY - 26;
      if (boxX + textWidth + 24 > width) boxX = obsScreenX - textWidth - 28;
      if (boxY < 8) boxY = obsScreenY + 12;

      ctx.fillStyle = "rgba(3, 7, 18, 0.94)";
      ctx.fillRect(boxX, boxY, textWidth + 18, 22);
      ctx.strokeStyle = isResolvingGeo ? "#eab308" : "#06b6d4";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, textWidth + 18, 22);

      ctx.fillStyle = isResolvingGeo ? "#fde047" : "#22d3ee";
      ctx.fillText(labelText, boxX + 9, boxY + 15);
      ctx.restore();
    }
  }, [
    selectedLocation,
    solarState,
    terminatorPoints,
    isMapLoaded,
    zoom,
    panOffset,
    isResolvingGeo,
  ]);

  const filteredObservatories = useMemo(() => {
    if (activeCategory === "all") return OBSERVATORY_SITES;
    return OBSERVATORY_SITES.filter((site) => site.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#020617] text-slate-100 font-sans select-none overflow-x-hidden">
      {/* ── 1. Top NASA Operations Header Bar ───────────────────────────────── */}
      <header className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/80 bg-[#030712]/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Emblem, Title & Return Link */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#060b18]/90 hover:bg-[#16233b] border border-slate-700/80 hover:border-cyan-400 text-xs font-mono text-cyan-300 font-bold transition-all shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl group shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>MAIN PORTAL</span>
            </Link>

            <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[#060b18]/90 border border-slate-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-900 border border-cyan-500/40 p-0.5">
                <Image
                  src="/cakrapala.png"
                  alt="Cakrapala Logo"
                  width={32}
                  height={32}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <span className="font-mono font-black tracking-widest text-sm text-white block">
                  EARTH OBSERVATORY MAP
                </span>
                <span className="text-[9px] font-mono text-cyan-400 block">
                  WGS-84 TOPOCENTRIC RADAR &bull; POINT-AND-CLICK GEOLOCATOR
                </span>
              </div>
            </div>
          </div>

          {/* Center: Tactical Target Lock Indicator with City & Country */}
          <div className="hidden md:flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-[#060b18]/90 border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.25)] backdrop-blur-2xl font-mono text-xs relative">
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-cyan-400" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-cyan-400" />
            <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-cyan-400" />
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-cyan-400" />

            {isResolvingGeo ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            )}

            <div className="flex items-baseline gap-1.5 truncate max-w-[320px]">
              <span className="text-white font-bold tracking-wider uppercase truncate">
                {selectedLocation.name}
              </span>
              {selectedLocation.country && (
                <span className="text-slate-400 text-[10px] truncate">
                  ({selectedLocation.country})
                </span>
              )}
            </div>

            <span className="text-slate-600">|</span>
            <span
              className={`text-[10px] font-bold ${
                solarState.isDaylight ? "text-amber-300" : "text-cyan-300"
              }`}
            >
              {solarState.isDaylight ? "DAYLIGHT ZONE" : "NIGHT SKY ZONE"}
            </span>
          </div>

          {/* Right: Dual Telemetry Flight Clock */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#060b18]/90 border border-slate-700/80 font-mono text-xs text-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-emerald-400 text-[10px]">LIVE</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-300 font-bold text-[11px]" suppressHydrationWarning>
                {isMounted ? currentDate.toUTCString().slice(17, 25) + " UTC" : "00:00:00 UTC"}
              </span>
            </div>
            <div className="text-[9px] text-slate-500 hidden lg:block">{gmst}</div>
          </div>
        </div>
      </header>

      {/* ── 2. Main Geospatial Map & Telemetry Dashboard ───────────────────── */}
      <main className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left 8 Cols: World Map Canvas with Zoom/Pan HUD & Presets */}
        <div className="lg:col-span-8 space-y-4">
          {/* Map Card (Translucent Glassmorphism) */}
          <div className="relative rounded-[28px] overflow-hidden bg-[#030712]/35 border border-slate-700/40 shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl p-4 sm:p-5 group">
            {/* Map Top Bar with Status & Coordinates */}
            <div className="flex items-center justify-between pb-3 px-1 font-mono text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-bold text-white uppercase tracking-wider text-xs hidden sm:inline">
                  WGS-84 TOPOCENTRIC RADAR &bull; CLICK TO DETECT LOCATION &bull; SCROLL TO ZOOM
                </span>
                <span className="font-bold text-white uppercase tracking-wider text-xs sm:hidden">
                  CLICK TO GEOLOCATE &bull; PINCH ZOOM
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isResolvingGeo && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>LOCATING...</span>
                  </span>
                )}
                <div className="font-mono text-[10px] text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30 font-bold">
                  {hoverCoords
                    ? `${hoverCoords.lat >= 0 ? hoverCoords.lat + "°N" : Math.abs(hoverCoords.lat) + "°S"}, ${hoverCoords.lng >= 0 ? hoverCoords.lng + "°E" : Math.abs(hoverCoords.lng) + "°W"}`
                    : "HOVER TO SCAN"}
                </div>
              </div>
            </div>

            {/* Interactive Canvas Overlay Container */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl bg-black">
              <canvas
                ref={canvasRef}
                width={1024}
                height={512}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  setHoverCoords(null);
                  setIsDragging(false);
                }}
                className={`w-full h-auto block relative z-10 select-none ${
                  isDragging
                    ? "cursor-grabbing"
                    : zoom > 1
                    ? "cursor-grab"
                    : "cursor-crosshair"
                }`}
                title="Click to place station • Scroll to zoom • Drag to pan"
              />

              {/* Floating Zoom & Pan Control HUD (Top Right) */}
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 p-1.5 rounded-2xl bg-[#030712]/90 border border-slate-700/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.7)]">
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom * 1.35)}
                  disabled={zoom >= 8}
                  className="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-950/80 active:bg-cyan-900 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="px-1 text-center font-mono text-[9px] font-bold text-cyan-400 py-0.5">
                  {zoom.toFixed(1)}x
                </div>

                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom * 0.74)}
                  disabled={zoom <= 1}
                  className="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-950/80 active:bg-cyan-900 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <div className="h-px bg-slate-800 my-0.5" />

                <button
                  type="button"
                  onClick={handleRecenterOnTarget}
                  className="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-950/80 active:bg-cyan-900 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition-all cursor-pointer"
                  title="Recenter View on Pin"
                >
                  <LocateFixed className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResetView}
                  disabled={zoom === 1 && panOffset.x === 0 && panOffset.y === 0}
                  className="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-950/80 active:bg-cyan-900 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Reset Zoom & Pan (1.0x)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Map Legend Floating HUD (Bottom Left) */}
              <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-xl bg-[#030712]/85 border border-slate-800/80 backdrop-blur-md font-mono text-[10px]">
                <div className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                  <span>Daylight Zenith</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                  <span>Night Sky</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Selected Station</span>
                </div>
              </div>

              {/* Zoom & Pan usage helper banner */}
              <div className="absolute bottom-3 right-3 z-20 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#030712]/85 border border-slate-800/80 backdrop-blur-md font-mono text-[10px] text-slate-400">
                <span>💡 Wheel: Zoom</span>
                <span>•</span>
                <span>Drag: Pan</span>
                <span>•</span>
                <span>Click: Reverse Geocode</span>
              </div>
            </div>
          </div>

          {/* Quick Observatory & Metropolis Presets Deck */}
          <div className="p-5 rounded-[28px] bg-[#030712]/35 border border-slate-700/40 shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl space-y-4 font-mono">
            {/* Header & Category Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <Telescope className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-white font-bold tracking-wider uppercase">
                  GLOBAL OBSERVATORIES &amp; METROPOLIS DISPATCH:
                </span>
              </div>

              <div className="flex items-center gap-1 bg-[#030712]/60 p-1 rounded-xl border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activeCategory === "all"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ALL ({OBSERVATORY_SITES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("observatory")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activeCategory === "observatory"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🌌 MAJOR TELESCOPES
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("city")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activeCategory === "city"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🏙️ GLOBAL CITIES
                </button>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredObservatories.map((site) => {
                const isSelected = selectedLocation.name.includes(site.name);
                const isSiteDaylight = computeSunPosition(
                  currentDate,
                  site.latitude,
                  site.longitude
                ).isDaylight;

                return (
                  <button
                    key={site.name}
                    type="button"
                    onClick={() => {
                      onSelectLocation(site);
                      setResolvedStatus(`Station Selected: ${site.name}`);
                    }}
                    className={`p-3 rounded-2xl text-left transition-all border group relative cursor-pointer ${
                      isSelected
                        ? "bg-[#0c1a30]/80 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                        : "bg-[#030712]/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-[#070e1e]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSiteDaylight
                              ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                              : "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                          }`}
                        />
                        <span className="text-xs font-bold truncate group-hover:text-cyan-300 transition-colors">
                          {site.name}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          isSiteDaylight
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-indigo-500/15 text-indigo-300"
                        }`}
                      >
                        {isSiteDaylight ? "DAY" : "NIGHT"}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 truncate mt-1">
                      {site.country}
                    </div>

                    <div className="text-[9px] text-slate-500 truncate mt-0.5">
                      {site.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Observer Telemetry Card & CTA */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-[28px] bg-[#030712]/30 border border-slate-700/35 shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl space-y-5 font-mono">
            {/* Header Telemetry */}
            <div className="border-b border-slate-800/80 pb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px]">
                  <Crosshair className="w-3 h-3 text-cyan-400" />
                  <span>OBSERVATION STATION LOCKED</span>
                </div>

                {isResolvingGeo && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Resolving...</span>
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-black text-white font-sans tracking-tight">
                {selectedLocation.name}
              </h2>

              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-sans mt-1 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{selectedLocation.country || "Earth Geodetic Surface"}</span>
              </div>

              <div className="text-xs text-slate-400 mt-1.5">
                {selectedLocation.latitude >= 0
                  ? `${selectedLocation.latitude.toFixed(4)}° N`
                  : `${Math.abs(selectedLocation.latitude).toFixed(4)}° S`},{" "}
                {selectedLocation.longitude >= 0
                  ? `${selectedLocation.longitude.toFixed(4)}° E`
                  : `${Math.abs(selectedLocation.longitude).toFixed(4)}° W`}
              </div>

              <div className="text-xs text-cyan-300 font-sans mt-2 flex items-center justify-between bg-[#060b18]/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[11px]">Station Time:</span>
                <span className="font-mono font-bold text-white">
                  {observerLocalTime.formatted}{" "}
                  <span className="text-cyan-400 text-[10px]">({observerLocalTime.tzString})</span>
                </span>
              </div>
            </div>

            {/* Day / Night Atmospheric Status Card */}
            <div
              className={`p-4 rounded-2xl border ${
                solarState.isDaylight
                  ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
                  : solarState.isTwilight
                  ? "bg-indigo-950/30 border-indigo-500/40 text-indigo-200"
                  : "bg-cyan-950/20 border-cyan-500/40 text-cyan-200"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    solarState.isDaylight
                      ? "bg-amber-500/20 text-yellow-400"
                      : solarState.isTwilight
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-cyan-500/20 text-cyan-400"
                  }`}
                >
                  {solarState.isDaylight ? (
                    <Sun className="w-6 h-6 animate-spin" style={{ animationDuration: "20s" }} />
                  ) : (
                    <Moon className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Atmospheric Horizon
                  </div>
                  <div className="text-sm font-bold text-white font-sans mt-0.5">
                    {solarState.isDaylight
                      ? "DAYLIGHT (Solar Visible)"
                      : solarState.isTwilight
                      ? "TWILIGHT (Dusk / Dawn)"
                      : "NIGHT-TIME (Clear Stargazing)"}
                  </div>
                  <div className="text-[10px] text-cyan-300 font-mono mt-0.5">
                    {solarState.isNight
                      ? "Bortle Class 2-3 • 2,887 Stars Visible"
                      : solarState.isTwilight
                      ? "Sky Brightness: Intermediate"
                      : "Daylight Solar Dominance"}
                  </div>
                </div>
              </div>
            </div>

            {/* Solar Elevation & Azimuth Micro-Metrics */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#030712]/60 border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block">Sun Elevation</span>
                <strong
                  className="text-sm text-white block mt-1"
                  suppressHydrationWarning
                >
                  {solarState.altitudeDeg >= 0
                    ? `+${solarState.altitudeDeg.toFixed(1)}° (Above)`
                    : `${solarState.altitudeDeg.toFixed(1)}° (Below)`}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#030712]/60 border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block">Sun Azimuth</span>
                <strong
                  className="text-sm text-cyan-300 block mt-1"
                  suppressHydrationWarning
                >
                  {solarState.azimuthDeg.toFixed(1)}°
                </strong>
              </div>
            </div>

            {/* Big Aerospace CTA Button: Enter 3D Sky Dome */}
            <button
              type="button"
              onClick={onEnterObservatory}
              className="
                w-full py-4 rounded-2xl font-mono font-bold text-xs tracking-wider uppercase
                bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 hover:from-cyan-300 hover:to-indigo-200
                text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.4)]
                hover:shadow-[0_0_40px_rgba(6,182,212,0.7)]
                flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] cursor-pointer
              "
            >
              <span>ENTER 3D SKY DOME OBSERVATORY</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
