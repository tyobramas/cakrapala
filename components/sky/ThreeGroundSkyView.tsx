"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import * as THREE from "three";
import * as Astronomy from "astronomy-engine";
import {
  Sparkles,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  Crosshair,
  Activity,
  Flame,
  Compass,
  Globe,
  Search,
  ArrowLeft,
  FastForward,
  Rewind,
  Play,
  Pause,
  ChevronRight,
  Disc,
  Home,
  Calendar,
  Clock,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Maximize2,
  ExternalLink,
  Camera,
  Layers,
  Radio,
} from "lucide-react";
import {
  computeSunPosition,
  computeTopocentricStars,
  computeTopocentricBodies,
  computeIAUConstellations,
  computeTopocentricNebulae,
  getGMST,
  type ObserverLocation,
  type SolarState,
  type TopocentricStar,
  type TopocentricBody,
  type TopocentricNebula,
  type Constellation3D,
} from "@/lib/astronomy/topocentricSky";
import {
  computeTopocentricSatellites,
  type TopocentricSatellite,
} from "@/lib/astronomy/topocentricSatellites";
import {
  STAR_PROFILES,
  BODY_PROFILES,
  type CelestialObjectInfo,
} from "@/lib/astronomy/celestialObjectProfiles";
import {
  CONSTELLATION_PROFILES,
  getConstellationProfile,
  type ConstellationProfile,
} from "@/lib/astronomy/constellationProfiles";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const DOME_RADIUS = 500;
const SKY_SPHERE_RADIUS = 900;
const STAR_LAYER_RADIUS = 490;
const NEBULA_LAYER_RADIUS = 486;
const CONSTELLATION_LAYER_RADIUS = 485;
const CONSTELLATION_ART_RADIUS = 478;
const BODY_LAYER_RADIUS = 475;
const SATELLITE_LAYER_RADIUS = 472;
const GROUND_RADIUS = 480;

// Coordinate conversion: Horizontal (Az, Alt) → Three.js Vector3
// Az=0° = North (+Z), Az=90° = East, Az=180° = South (-Z), Az=270° = West
// In Three.js with camera at origin looking toward +Z (North):
//   East must be on the RIGHT → negative X (viewer's perspective from inside the dome)
//   We NEGATE sin(az) to flip East/West so the sky matches real world (Stellarium reference).
function azAltToVec3(azDeg: number, altDeg: number, r: number): THREE.Vector3 {
  const az = (azDeg * Math.PI) / 180;
  const alt = (altDeg * Math.PI) / 180;
  const ca = Math.cos(alt);
  return new THREE.Vector3(
    -r * ca * Math.sin(az), // Negate: East (az=90°) → negative X → appears RIGHT on screen
    r * Math.sin(alt),
    r * ca * Math.cos(az)
  );
}

// Direct RA/Dec (J2000) to Topocentric Three.js Vector3 conversion
function raDecToTopocentricVec3(
  raDeg: number,
  decDeg: number,
  lstDeg: number,
  latRad: number,
  radius: number
): THREE.Vector3 {
  const decRad = decDeg * (Math.PI / 180);
  const H = ((lstDeg - raDeg) % 360 + 360) % 360;
  const HRad = H * (Math.PI / 180);

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAlt = Math.cos(altRad);
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
  let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(HRad) > 0) {
    azRad = 2 * Math.PI - azRad;
  }

  return new THREE.Vector3(
    -radius * cosAlt * Math.sin(azRad),
    radius * Math.sin(altRad),
    radius * cosAlt * Math.cos(azRad)
  );
}

interface Props {
  location: ObserverLocation;
  onBackToMap?: () => void;
}

export interface SelectedTarget {
  id: string;
  name: string;
  type: "star" | "planet" | "moon" | "sun" | "constellation" | "nebula" | "satellite";
  azimuthDeg: number;
  altitudeDeg: number;
  mag: number;
  colorHex: string;
  nebulaInfo?: TopocentricNebula;
  satelliteInfo?: TopocentricSatellite;
  constellationProfile?: ConstellationProfile;
}

interface SearchItem {
  id: string;
  name: string;
  category: "planet" | "constellation" | "nebula" | "star" | "satellite";
  categoryLabel: string;
  subtitle: string;
  azimuthDeg: number;
  altitudeDeg: number;
  mag?: number;
  colorHex?: string;
  isAboveHorizon: boolean;
  rawNebula?: TopocentricNebula;
  rawSatellite?: TopocentricSatellite;
}

// Helper to calculate exact Rise & Set times for any celestial object or constellation
function calculateRiseSetTimes(
  target: SelectedTarget,
  location: ObserverLocation,
  date: Date
): { riseTime: string; setTime: string } {
  try {
    const obs = new Astronomy.Observer(location.latitude, location.longitude, 0);
    const time = Astronomy.MakeTime(date);

    if (target.type === "sun" || target.id === "sun") {
      const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, 1, time, 1);
      const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, time, 1);
      return {
        riseTime: rise ? rise.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
        setTime: set ? set.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
      };
    } else if (target.type === "moon" || target.id === "moon") {
      const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, 1, time, 1);
      const set = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, -1, time, 1);
      return {
        riseTime: rise ? rise.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
        setTime: set ? set.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
      };
    } else if (target.type === "planet") {
      const bodyMap: Record<string, Astronomy.Body> = {
        mercury: Astronomy.Body.Mercury,
        venus: Astronomy.Body.Venus,
        mars: Astronomy.Body.Mars,
        jupiter: Astronomy.Body.Jupiter,
        saturn: Astronomy.Body.Saturn,
        uranus: Astronomy.Body.Uranus,
        neptune: Astronomy.Body.Neptune,
      };
      const b = bodyMap[target.id.toLowerCase()];
      if (b) {
        const rise = Astronomy.SearchRiseSet(b, obs, 1, time, 1);
        const set = Astronomy.SearchRiseSet(b, obs, -1, time, 1);
        return {
          riseTime: rise ? rise.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
          setTime: set ? set.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
        };
      }
    }

    // For Stars, Constellations, & Nebulae: Spherical hour angle formula
    const latRad = location.latitude * (Math.PI / 180);
    const altRad = target.altitudeDeg * (Math.PI / 180);
    const azRad = target.azimuthDeg * (Math.PI / 180);

    const sinDec = Math.sin(latRad) * Math.sin(altRad) + Math.cos(latRad) * Math.cos(altRad) * Math.cos(azRad);
    const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));

    const cosH_rise = -Math.tan(latRad) * Math.tan(decRad);
    if (cosH_rise > 1) return { riseTime: "Never Rises", setTime: "Never Sets" };
    if (cosH_rise < -1) return { riseTime: "Circumpolar", setTime: "Circumpolar" };

    const H_rise_deg = Math.acos(Math.max(-1, Math.min(1, cosH_rise))) * (180 / Math.PI);
    const sinH = -Math.cos(altRad) * Math.sin(azRad);
    const cosH = Math.cos(latRad) * Math.sin(altRad) - Math.sin(latRad) * Math.cos(altRad) * Math.cos(azRad);
    let currentH_deg = Math.atan2(sinH, cosH) * (180 / Math.PI);
    if (currentH_deg < 0) currentH_deg += 360;

    const hoursToRise = ((360 - H_rise_deg - currentH_deg + 720) % 360) / 15.041;
    const hoursToSet = ((H_rise_deg - currentH_deg + 720) % 360) / 15.041;

    const riseDate = new Date(date.getTime() + hoursToRise * 3600000);
    const setDate = new Date(date.getTime() + hoursToSet * 3600000);

    return {
      riseTime: riseDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      setTime: setDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  } catch {
    return { riseTime: "--:--", setTime: "--:--" };
  }
}

// Helper to calculate exact hours until an object rises above horizon
function calculateHoursUntilRise(
  target: SelectedTarget,
  location: ObserverLocation,
  date: Date
): number | null {
  try {
    const obs = new Astronomy.Observer(location.latitude, location.longitude, 0);
    const time = Astronomy.MakeTime(date);

    if (target.type === "sun" || target.id === "sun") {
      const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, 1, time, 1);
      if (rise) return Math.max(0.1, (rise.date.getTime() - date.getTime()) / 3600000);
    } else if (target.type === "moon" || target.id === "moon") {
      const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, 1, time, 1);
      if (rise) return Math.max(0.1, (rise.date.getTime() - date.getTime()) / 3600000);
    } else if (target.type === "planet") {
      const bodyMap: Record<string, Astronomy.Body> = {
        mercury: Astronomy.Body.Mercury,
        venus: Astronomy.Body.Venus,
        mars: Astronomy.Body.Mars,
        jupiter: Astronomy.Body.Jupiter,
        saturn: Astronomy.Body.Saturn,
        uranus: Astronomy.Body.Uranus,
        neptune: Astronomy.Body.Neptune,
      };
      const b = bodyMap[target.id.toLowerCase()];
      if (b) {
        const rise = Astronomy.SearchRiseSet(b, obs, 1, time, 1);
        if (rise) return Math.max(0.1, (rise.date.getTime() - date.getTime()) / 3600000);
      }
    }

    // For Stars, Constellations, & Nebulae: Spherical hour angle formula
    const latRad = location.latitude * (Math.PI / 180);
    const altRad = target.altitudeDeg * (Math.PI / 180);
    const azRad = target.azimuthDeg * (Math.PI / 180);

    const sinDec = Math.sin(latRad) * Math.sin(altRad) + Math.cos(latRad) * Math.cos(altRad) * Math.cos(azRad);
    const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));

    const cosH_rise = -Math.tan(latRad) * Math.tan(decRad);
    if (cosH_rise > 1) return null; // Circumpolar below horizon
    if (cosH_rise < -1) return 0;   // Never sets

    const H_rise_deg = Math.acos(Math.max(-1, Math.min(1, cosH_rise))) * (180 / Math.PI);
    const sinH = -Math.cos(altRad) * Math.sin(azRad);
    const cosH = Math.cos(latRad) * Math.sin(altRad) - Math.sin(latRad) * Math.cos(altRad) * Math.cos(azRad);
    let currentH_deg = Math.atan2(sinH, cosH) * (180 / Math.PI);
    if (currentH_deg < 0) currentH_deg += 360;

    const riseH_deg = (360 - H_rise_deg) % 360;
    let dH = (riseH_deg - currentH_deg + 360) % 360;
    const hours = dH / 15.041;
    return Math.max(0.1, Math.round(hours * 10) / 10);
  } catch {
    return 3.5;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D SCI-FI NEUMORPHIC CHAMFERED BUTTON (SKEUOMORPHIC DEPTH, BEVEL & EXTRUSION)
// ─────────────────────────────────────────────────────────────────────────────
interface SciFi3DButtonProps {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  variant?: "blue" | "green" | "amber" | "rose" | "slate";
  icon?: React.ReactNode;
  label?: string;
  badge?: string | number;
  subLabel?: string;
  className?: string;
  minWidth?: string;
  children?: React.ReactNode;
}

function SciFi3DButton({
  onClick,
  title,
  isActive = false,
  variant = "blue",
  icon,
  label,
  badge,
  subLabel,
  className = "",
  minWidth = "min-w-[58px]",
  children,
}: SciFi3DButtonProps) {
  // Chamfer geometries (45° cut corners)
  const CLIP_FRAME = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
  const CLIP_PLATE = "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
  const CLIP_GLOSS = "polygon(7px 0, 100% 0, 100% 100%, 0 100%, 0 7px)";

  const isGreen = isActive && variant === "green";
  const isAmber = isActive && variant === "amber";
  const isRose = isActive && variant === "rose";
  const isBlue = isActive && (variant === "blue" || (!isGreen && !isAmber && !isRose));

  // Outer extruded frame gradient & thick 3D extrusion
  let frameGradient = "bg-gradient-to-b from-[#475569] via-[#1e293b] to-[#090d16] border-t-2 border-l-2 border-[#94a3b8]/80 border-b-4 border-r-2 border-[#020509]";
  let plateGradient = "bg-gradient-to-b from-[#334155] via-[#1e293b] to-[#090d16] border-2 border-[#64748b] shadow-[inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-4px_8px_rgba(0,0,0,0.9)] text-slate-300";
  let filterShadow = "drop-shadow(0px 5px 0px #040810) drop-shadow(0px 8px 14px rgba(0,0,0,0.9))";

  if (isGreen) {
    frameGradient = "bg-gradient-to-b from-[#65a30d] via-[#1f340b] to-[#0a1404] border-t-2 border-l-2 border-[#bef264] border-b-4 border-r-2 border-[#050a02]";
    plateGradient = "bg-gradient-to-b from-[#84cc16] via-[#4d7c0f] to-[#1e3a09] border-2 border-[#bef264] shadow-[inset_0_3px_5px_rgba(255,255,255,0.7),inset_0_-5px_10px_rgba(0,0,0,0.85)] text-white";
    filterShadow = "drop-shadow(0px 5px 0px #060c04) drop-shadow(0px 8px 16px rgba(0,0,0,0.95)) drop-shadow(0px 0px 10px rgba(163,230,53,0.4))";
  } else if (isBlue) {
    frameGradient = "bg-gradient-to-b from-[#0284c7] via-[#0b2b42] to-[#041019] border-t-2 border-l-2 border-[#7dd3fc] border-b-4 border-r-2 border-[#02080d]";
    plateGradient = "bg-gradient-to-b from-[#0ea5e9] via-[#0284c7] to-[#034066] border-2 border-[#67e8f9] shadow-[inset_0_3px_5px_rgba(255,255,255,0.7),inset_0_-5px_10px_rgba(0,0,0,0.85)] text-white";
    filterShadow = "drop-shadow(0px 5px 0px #030a10) drop-shadow(0px 8px 16px rgba(0,0,0,0.95)) drop-shadow(0px 0px 10px rgba(6,182,212,0.4))";
  } else if (isAmber) {
    frameGradient = "bg-gradient-to-b from-[#d97706] via-[#451a03] to-[#170600] border-t-2 border-l-2 border-[#fde047] border-b-4 border-r-2 border-[#0f0400]";
    plateGradient = "bg-gradient-to-b from-[#f59e0b] via-[#b45309] to-[#78350f] border-2 border-[#fde047] shadow-[inset_0_3px_5px_rgba(255,255,255,0.7),inset_0_-5px_10px_rgba(0,0,0,0.85)] text-white";
    filterShadow = "drop-shadow(0px 5px 0px #0c0400) drop-shadow(0px 8px 16px rgba(0,0,0,0.95)) drop-shadow(0px 0px 10px rgba(245,158,11,0.4))";
  } else if (isRose) {
    frameGradient = "bg-gradient-to-b from-[#e11d48] via-[#4c0519] to-[#190208] border-t-2 border-l-2 border-[#fda4af] border-b-4 border-r-2 border-[#100105]";
    plateGradient = "bg-gradient-to-b from-[#f43f5e] via-[#be123c] to-[#881337] border-2 border-[#fda4af] shadow-[inset_0_3px_5px_rgba(255,255,255,0.7),inset_0_-5px_10px_rgba(0,0,0,0.85)] text-white";
    filterShadow = "drop-shadow(0px 5px 0px #0e0104) drop-shadow(0px 8px 16px rgba(0,0,0,0.95)) drop-shadow(0px 0px 12px rgba(244,63,94,0.5))";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`group relative cursor-pointer select-none transition-transform duration-75 active:translate-y-1 active:[filter:drop-shadow(0_1px_0_#020617)_drop-shadow(0_2px_4px_rgba(0,0,0,0.9))] ${className}`}
      style={{ filter: filterShadow }}
    >
      {/* OUTER 3D BEVEL FRAME */}
      <div
        className={`h-[52px] ${minWidth} p-[2.5px] transition-all flex flex-col justify-between ${frameGradient}`}
        style={{ clipPath: CLIP_FRAME }}
      >
        {/* INNER EMBOSSED LASER PLATE */}
        <div
          className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden transition-all ${plateGradient}`}
          style={{
            clipPath: CLIP_PLATE,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='24.25' viewBox='0 0 14 24.25'%3E%3Cpath d='M7 0l7 4.04v8.08L7 16.16 0 12.12V4.04L7 0zm0 24.25l7-4.04v-8.08L7 8.09 0 12.13v8.08l7 4.04z' fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='0.8'/%3E%3C/svg%3E\")",
          }}
        >
          {/* Top 3D Specular Gloss Sheen */}
          <div
            className="absolute top-0 left-0 right-0 h-[46%] bg-gradient-to-b from-white/45 via-white/12 to-transparent pointer-events-none"
            style={{ clipPath: CLIP_GLOSS }}
          />

          {/* Bottom Inset Shadow */}
          <div className="absolute bottom-0 left-0 right-0 h-[24%] bg-black/45 pointer-events-none" />

          {/* Foreground Content */}
          <div className="relative z-10 flex flex-col items-center justify-center px-1">
            {children || (
              <>
                <div className="flex items-center gap-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                  {icon}
                  {badge !== undefined && (
                    <span className="text-[11px] font-orbitron font-black text-white tracking-wider">
                      {badge}
                    </span>
                  )}
                </div>
                {label && (
                  <span className="text-[9px] font-orbitron font-black tracking-widest mt-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
                    {label}
                  </span>
                )}
                {subLabel && (
                  <span className="text-[8px] font-mono font-bold text-cyan-200/90 leading-none">
                    {subLabel}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ThreeGroundSkyView({ location, onBackToMap }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial Camera Angles (Looking towards Sagittarius / Scorpius in Southeast)
  const camAzRef = useRef(145);
  const camAltRef = useRef(30);
  const camFovRef = useRef(70);

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const selectedTargetRef = useRef<SelectedTarget | null>(null);
  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
  }, [selectedTarget]);

  // NASA Image State for Active Target
  const [nasaImage, setNasaImage] = useState<{
    loading: boolean;
    imageUrl: string;
    thumbnailUrl: string;
    title: string;
    photographer: string;
    description: string;
  } | null>(null);
  const [isFullscreenImageOpen, setIsFullscreenImageOpen] = useState(false);

  // Fetch NASA Imagery when selectedTarget changes
  useEffect(() => {
    if (!selectedTarget) {
      setNasaImage(null);
      return;
    }

    let isMounted = true;
    setNasaImage({
      loading: true,
      imageUrl: "",
      thumbnailUrl: "",
      title: selectedTarget.name,
      photographer: "NASA / Space Telescope Science Institute",
      description: "",
    });

    // For Moon: skip NASA static image, use real-time phase SVG instead
    if (selectedTarget.id === "moon" || selectedTarget.type === "moon") {
      setNasaImage(null);
      return;
    }

    // For planets/sun: use the id for precise curated image lookup
    const searchQuery =
      selectedTarget.nebulaInfo?.name ||
      (selectedTarget.type === "planet" || selectedTarget.type === "sun"
        ? selectedTarget.id.toLowerCase()
        : selectedTarget.name.replace(/\(.*?\)/g, "").trim());

    fetch(`/api/nasa/image?q=${encodeURIComponent(searchQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && data.imageUrl) {
          setNasaImage({
            loading: false,
            imageUrl: data.imageUrl,
            thumbnailUrl: data.thumbnailUrl || data.imageUrl,
            title: data.title || selectedTarget.name,
            photographer: data.photographer || "NASA / STScI / JWST",
            description: data.description || "",
          });
        } else {
          setNasaImage({
            loading: false,
            imageUrl: "",
            thumbnailUrl: "",
            title: selectedTarget.name,
            photographer: "NASA Deep Space Network",
            description: "",
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("NASA image fetch error:", err);
        setNasaImage({
          loading: false,
          imageUrl: "",
          thumbnailUrl: "",
          title: selectedTarget.name,
          photographer: "NASA Deep Space Network",
          description: "",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTarget]);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilterCategory, setSearchFilterCategory] = useState<"all" | "planet" | "constellation" | "nebula" | "star" | "satellite">("all");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Camera Animation Ref for Smooth Interpolated Fly-To
  const cameraAnimRef = useRef<{
    startAz: number;
    targetAz: number;
    startAlt: number;
    targetAlt: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // Ground Opacity Ref for Smooth X-Ray Transparency Transition
  const groundOpacityRef = useRef(1.0);

  // Toggles
  const [showConstellations, setShowConstellations] = useState(true);
  const [showConstellationNames, setShowConstellationNames] = useState(true);
  const [showConstellationArt, setShowConstellationArt] = useState(true);
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showBodies, setShowBodies] = useState(true);
  const [showNebulae, setShowNebulae] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  // Temporal & Time Warp States
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState(0);
  const [timePlaybackSpeed, setTimePlaybackSpeed] = useState<number>(0); // 0 = realtime, 1 = 10m/sec, 6 = 1h/sec, etc.
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  // Live 1-second clock
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setCurrentTimeMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Time Warp continuous playback loop
  useEffect(() => {
    if (timePlaybackSpeed === 0) return;
    const interval = setInterval(() => {
      setTimeOffsetMinutes((prev) => prev + timePlaybackSpeed);
    }, 100);
    return () => clearInterval(interval);
  }, [timePlaybackSpeed]);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const togglesRef = useRef({
    showConstellations: true,
    showConstellationNames: true,
    showConstellationArt: true,
    showMilkyWay: true,
    showLabels: true,
    showBodies: true,
    showNebulae: true,
    showSatellites: true,
  });

  useEffect(() => {
    togglesRef.current = {
      showConstellations,
      showConstellationNames,
      showConstellationArt,
      showMilkyWay,
      showLabels,
      showBodies,
      showNebulae,
      showSatellites,
    };
  }, [showConstellations, showConstellationNames, showConstellationArt, showMilkyWay, showLabels, showBodies, showNebulae, showSatellites]);

  // ── Astronomical Calculations ──────────────────────────────────────────────
  const observationDate = useMemo(() => {
    const d = new Date(currentTimeMs + timeOffsetMinutes * 60000);
    return d;
  }, [currentTimeMs, timeOffsetMinutes]);

  const solarState = useMemo(
    () => computeSunPosition(observationDate, location.latitude, location.longitude),
    [observationDate, location]
  );

  const topoStars = useMemo(
    () => computeTopocentricStars(observationDate, location.latitude, location.longitude, DOME_RADIUS),
    [observationDate, location]
  );

  const { moon: topoMoon, planets: topoPlanets } = useMemo(
    () => computeTopocentricBodies(observationDate, location.latitude, location.longitude, DOME_RADIUS),
    [observationDate, location]
  );

  // Live moon phase degrees for real-time phase image (must come after topoMoon)
  const liveMoonPhaseDeg = useMemo(() => topoMoon.phaseDeg ?? 0, [topoMoon]);
  const liveMoonIllumination = useMemo(() => topoMoon.illuminationFraction ?? 0, [topoMoon]);

  const constellations = useMemo(
    () => computeIAUConstellations(observationDate, location.latitude, location.longitude, DOME_RADIUS),
    [observationDate, location]
  );

  const topoNebulae = useMemo(
    () => computeTopocentricNebulae(observationDate, location.latitude, location.longitude, NEBULA_LAYER_RADIUS),
    [observationDate, location]
  );

  const topoSats = useMemo(
    () => computeTopocentricSatellites(observationDate, location.latitude, location.longitude, 260, DOME_RADIUS, selectedTarget?.id),
    [observationDate, location, selectedTarget?.id]
  );

  const astroRef = useRef({
    solarState,
    topoStars,
    topoMoon,
    topoPlanets,
    constellations,
    topoNebulae,
    topoSats,
    observationDate,
    location,
  });

  useEffect(() => {
    astroRef.current = { solarState, topoStars, topoMoon, topoPlanets, constellations, topoNebulae, topoSats, observationDate, location };
  }, [solarState, topoStars, topoMoon, topoPlanets, constellations, topoNebulae, topoSats, observationDate, location]);

  // ── Universal Celestial Search Index ───────────────────────────────────────
  const searchIndex: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];

    // 1. Sun & Moon
    items.push({
      id: "sun",
      name: "Sun (Matahari)",
      category: "planet",
      categoryLabel: "Solar System Star",
      subtitle: "The Solar System Central G-Type Star",
      azimuthDeg: solarState.azimuthDeg,
      altitudeDeg: solarState.altitudeDeg,
      mag: -26.74,
      colorHex: "#fffbeb",
      isAboveHorizon: solarState.altitudeDeg >= 0,
    });

    items.push({
      id: "moon",
      name: "Moon (Bulan)",
      category: "planet",
      categoryLabel: "Natural Satellite",
      subtitle: `Lunar Phase: ${Math.round((topoMoon.illuminationFraction ?? 0.5) * 100)}% Illuminated`,
      azimuthDeg: topoMoon.azimuthDeg,
      altitudeDeg: topoMoon.altitudeDeg,
      mag: -12.7,
      colorHex: "#f8fafc",
      isAboveHorizon: topoMoon.altitudeDeg >= 0,
    });

    // 2. Planets
    for (const p of topoPlanets) {
      items.push({
        id: p.id,
        name: p.name,
        category: "planet",
        categoryLabel: "Solar System Planet",
        subtitle: `Planet | Mag: ${p.mag.toFixed(1)}`,
        azimuthDeg: p.azimuthDeg,
        altitudeDeg: p.altitudeDeg,
        mag: p.mag,
        colorHex: p.colorHex,
        isAboveHorizon: p.altitudeDeg >= 0,
      });
    }

    // 3. Nebulae & Deep Sky Objects (DSO)
    for (const neb of topoNebulae) {
      items.push({
        id: neb.id,
        name: `${neb.name} (${neb.messierNgc})`,
        category: "nebula",
        categoryLabel: neb.typeLabel,
        subtitle: `${neb.constellation} • ${neb.distanceLy} • Mag: ${neb.mag.toFixed(1)}`,
        azimuthDeg: neb.azimuthDeg,
        altitudeDeg: neb.altitudeDeg,
        mag: neb.mag,
        colorHex: neb.colorHex,
        isAboveHorizon: neb.altitudeDeg >= 0,
        rawNebula: neb,
      });
    }

    // 4. 89 IAU Constellations
    const gmst = getGMST(observationDate);
    const lstDeg = ((gmst + location.longitude) % 360 + 360) % 360;
    const latRad = (location.latitude * Math.PI) / 180;

    for (const c of constellations) {
      const prof = getConstellationProfile(c.abbreviation || c.name);
      let center: { az: number; alt: number } | null = null;
      if (prof) {
        const cVec = raDecToTopocentricVec3(prof.raHours * 15, prof.decDeg, lstDeg, latRad, DOME_RADIUS);
        center = pos3DtoAzAlt(cVec);
      } else {
        center = pos3DtoAzAlt(c.centerPos3D);
      }

      if (center) {
        items.push({
          id: c.abbreviation.toLowerCase(),
          name: c.name,
          category: "constellation",
          categoryLabel: "IAU Constellation",
          subtitle: `Constellation (${c.abbreviation}) • ${prof?.englishName || `${c.segments.length} Lines`}`,
          azimuthDeg: center.az,
          altitudeDeg: center.alt,
          isAboveHorizon: center.alt >= 0,
        });
      }
    }

    // 5. Named Visible Stars
    for (const star of topoStars) {
      if (!star.name.startsWith("HR ")) {
        items.push({
          id: star.id,
          name: star.name,
          category: "star",
          categoryLabel: "Galactic Star",
          subtitle: `${star.constellation ? `${star.constellation} • ` : ""}Mag: ${star.mag.toFixed(2)}`,
          azimuthDeg: star.azimuthDeg,
          altitudeDeg: star.altitudeDeg,
          mag: star.mag,
          colorHex: star.colorHex,
          isAboveHorizon: star.altitudeDeg >= 0,
        });
      }
    }

    // 6. Active Orbital Satellites (Above Horizon)
    for (const sat of topoSats.satellites) {
      items.push({
        id: sat.id,
        name: `🛰️ ${sat.name}`,
        category: "satellite",
        categoryLabel: sat.categoryLabel,
        subtitle: `${sat.categoryLabel} • Alt: ${sat.altitudeDeg.toFixed(1)}° • ${sat.altitudeKm}km • ${sat.speedKmH.toLocaleString()} km/h`,
        azimuthDeg: sat.azimuthDeg,
        altitudeDeg: sat.altitudeDeg,
        mag: 2.0,
        colorHex: sat.colorHex,
        isAboveHorizon: sat.altitudeDeg >= 0,
        rawSatellite: sat,
      });
    }

    return items;
  }, [solarState, topoMoon, topoPlanets, topoNebulae, constellations, topoStars, topoSats]);

  // Filtered search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return searchIndex
      .filter((item) => {
        if (searchFilterCategory !== "all" && item.category !== searchFilterCategory) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
        );
      })
      .slice(0, 15);
  }, [searchIndex, searchQuery, searchFilterCategory]);

  // Target Inspector Info
  const targetInfo: CelestialObjectInfo | null = useMemo(() => {
    if (!selectedTarget) return null;

    const riseSet = calculateRiseSetTimes(selectedTarget, location, observationDate);

    if (selectedTarget.type === "constellation") {
      const cProfile = getConstellationProfile(selectedTarget.id || selectedTarget.name);
      const fam = cProfile?.family ? `${cProfile.family} Constellation` : "IAU Modern Constellation";
      const zod = cProfile?.zodiacSign ? ` • ${cProfile.zodiacSign}` : "";
      return {
        id: selectedTarget.id,
        name: cProfile?.name || selectedTarget.name,
        scientificName: cProfile
          ? `${cProfile.genitive} (${cProfile.abbreviation}) • ${cProfile.englishName}`
          : `${selectedTarget.name} Constellation (IAU)`,
        type: `${fam}${zod}`,
        constellation: cProfile ? `Quadrant: ${cProfile.quadrant} • Best in ${cProfile.monthBestSeen}` : "IAU Celestial Sphere",
        magnitude: cProfile?.brightestStarMag ?? 2.0,
        distanceLy: cProfile ? `Area: ${cProfile.areaSqDeg} sq° (Rank #${cProfile.areaRank} of 88)` : "Deep Sky Constellation",
        spectralType: cProfile ? `Brightest: ${cProfile.brightestStar} (Mag ${cProfile.brightestStarMag > 0 ? '+' : ''}${cProfile.brightestStarMag.toFixed(2)})` : "Multiple Stars",
        surfaceTemp: cProfile?.zodiacSign ? `Zodiac: ${cProfile.zodiacSign}` : "Stellar Pattern",
        massRadius: cProfile ? `Centroid: RA ${cProfile.raHours}h / Dec ${cProfile.decDeg > 0 ? '+' : ''}${cProfile.decDeg}°` : "Celestial Map",
        altitudeDeg: selectedTarget.altitudeDeg,
        azimuthDeg: selectedTarget.azimuthDeg,
        raDec: cProfile ? `${cProfile.raHours.toFixed(1)}h RA / ${cProfile.decDeg > 0 ? '+' : ''}${cProfile.decDeg.toFixed(1)}° Dec` : `${selectedTarget.azimuthDeg.toFixed(1)}° Az / ${selectedTarget.altitudeDeg.toFixed(1)}° Alt`,
        description: cProfile?.mythology || `The constellation ${selectedTarget.name} is one of the 88 modern constellations officially recognized by the International Astronomical Union (IAU).`,
        funFact: cProfile?.astronomicalHighlights?.[0] || `Constellation ${selectedTarget.name} forms an iconic pattern in the night sky.`,
        constellationProfile: cProfile || undefined,
        riseTime: riseSet.riseTime,
        setTime: riseSet.setTime,
      };
    }

    if (selectedTarget.type === "satellite" && selectedTarget.satelliteInfo) {
      const sat = selectedTarget.satelliteInfo;
      return {
        id: sat.id,
        name: sat.name,
        scientificName: `NORAD #${sat.noradId} • ${sat.intlDesig || "LEO Satellite"}`,
        type: `${sat.categoryLabel} (${sat.category.toUpperCase()})`,
        constellation: `Altitude: ${sat.altitudeKm.toLocaleString()} km`,
        magnitude: 2.0,
        distanceLy: `${sat.rangeKm.toLocaleString()} km (Slant Range)`,
        spectralType: `Orbital Speed: ${sat.speedKmH.toLocaleString()} km/h (${sat.speedKmS} km/s)`,
        surfaceTemp: sat.isSunlit ? "Sunlit Orbital State" : "Earth Eclipse Shadow",
        massRadius: `NORAD Catalog ID ${sat.noradId}`,
        altitudeDeg: selectedTarget.altitudeDeg,
        azimuthDeg: selectedTarget.azimuthDeg,
        raDec: `${selectedTarget.azimuthDeg.toFixed(1)}° Az / ${selectedTarget.altitudeDeg.toFixed(1)}° Alt`,
        description: `${sat.name} (NORAD ID ${sat.noradId}) is an active ${sat.categoryLabel.toLowerCase()} satellite tracked via SGP4 topocentric mechanics, currently at ${sat.altitudeKm} km altitude with a ground range of ${sat.rangeKm} km.`,
        funFact: sat.category === "station"
          ? "Conducts microgravity science and human spaceflight operations at ~27,600 km/h."
          : `Live SGP4 topocentric line-of-sight tracking above observer horizon.`,
        riseTime: riseSet.riseTime,
        setTime: riseSet.setTime,
      };
    }

    if (selectedTarget.type === "nebula" && selectedTarget.nebulaInfo) {
      const neb = selectedTarget.nebulaInfo;
      return {
        id: neb.id,
        name: `${neb.name} (${neb.messierNgc})`,
        scientificName: `${neb.messierNgc} • ${neb.typeLabel}`,
        type: neb.typeLabel,
        constellation: neb.constellation,
        magnitude: neb.mag,
        distanceLy: neb.distanceLy,
        spectralType: neb.type === "planetary_nebula" ? "O-III Ionized Oxygen Shell" : "H-alpha / Cosmic Dust Cloud",
        surfaceTemp: neb.type === "planetary_nebula" ? "Central Star > 100,000 K" : "T-Tauri Protostellar Nursery",
        massRadius: "Deep Space Cosmic Nebula",
        altitudeDeg: selectedTarget.altitudeDeg,
        azimuthDeg: selectedTarget.azimuthDeg,
        raDec: `${selectedTarget.azimuthDeg.toFixed(1)}° Az / ${selectedTarget.altitudeDeg.toFixed(1)}° Alt`,
        description: neb.description,
        funFact: neb.funFact,
        riseTime: riseSet.riseTime,
        setTime: riseSet.setTime,
      };
    }

    let profile: Partial<CelestialObjectInfo> = {};
    if (selectedTarget.type === "star") {
      profile = STAR_PROFILES[selectedTarget.name] || STAR_PROFILES[selectedTarget.id] || {};
    } else {
      profile = BODY_PROFILES[selectedTarget.id.toLowerCase()] || {};
    }

    return {
      id: selectedTarget.id,
      name: selectedTarget.name,
      scientificName: profile.scientificName || `${selectedTarget.name} (Yale BSC5 / IAU)`,
      type: profile.type || (selectedTarget.type === "star" ? "Galactic Spectroscopic Star" : "Solar System Celestial Body"),
      constellation: profile.constellation || "Deep Sky",
      magnitude: selectedTarget.mag,
      distanceLy: profile.distanceLy || "Milky Way Galaxy Star",
      spectralType: profile.spectralType || "Standard Stellar Spectrum",
      surfaceTemp: profile.surfaceTemp || "5,800 K (Estimated)",
      massRadius: profile.massRadius || "Standard Stellar Dimension",
      altitudeDeg: selectedTarget.altitudeDeg,
      azimuthDeg: selectedTarget.azimuthDeg,
      raDec: profile.raDec || `${selectedTarget.azimuthDeg.toFixed(1)}° Az / ${selectedTarget.altitudeDeg.toFixed(1)}° Alt`,
      description: profile.description || `The celestial object ${selectedTarget.name} is currently mapped in the observer's sky dome.`,
      funFact: profile.funFact || "This celestial object radiates photons traversing across deep space into your telescope tonight.",
      riseTime: riseSet.riseTime,
      setTime: riseSet.setTime,
    };
  }, [selectedTarget, location, observationDate]);

  // Hours until target rises (if below horizon)
  const hoursUntilRise = useMemo(() => {
    if (!selectedTarget || selectedTarget.altitudeDeg >= 0) return null;
    return calculateHoursUntilRise(selectedTarget, location, observationDate);
  }, [selectedTarget, location, observationDate]);

  // ── Smooth Camera Fly-To Function ──────────────────────────────────────────
  const flyToTarget = useCallback((targetAz: number, targetAlt: number) => {
    let startAz = camAzRef.current;
    let dAz = targetAz - startAz;
    while (dAz > 180) dAz -= 360;
    while (dAz < -180) dAz += 360;

    cameraAnimRef.current = {
      startAz,
      targetAz: startAz + dAz,
      startAlt: camAltRef.current,
      targetAlt: targetAlt,
      startTime: performance.now(),
      duration: 800, // 800ms smooth glide
    };
  }, []);

  const handleSelectSearchItem = (item: SearchItem) => {
    const targetType: SelectedTarget["type"] =
      item.category === "satellite"
        ? "satellite"
        : item.category === "planet"
        ? item.id === "sun"
          ? "sun"
          : item.id === "moon"
          ? "moon"
          : "planet"
        : item.category === "nebula"
        ? "nebula"
        : item.category === "constellation"
        ? "constellation"
        : "star";

    setSelectedTarget({
      id: item.id,
      name: item.name,
      type: targetType,
      azimuthDeg: item.azimuthDeg,
      altitudeDeg: item.altitudeDeg,
      mag: item.mag ?? 0,
      colorHex: item.colorHex ?? "#ffffff",
      nebulaInfo: item.rawNebula,
      satelliteInfo: item.rawSatellite,
    });

    flyToTarget(item.azimuthDeg, item.altitudeDeg);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleCenterTarget = () => {
    if (!selectedTarget) return;
    flyToTarget(selectedTarget.azimuthDeg, selectedTarget.altitudeDeg);
  };

  const handleFastForwardToRise = () => {
    if (hoursUntilRise !== null) {
      const addedHours = Math.ceil(hoursUntilRise * 10) / 10 + 0.3;
      setTimeOffsetMinutes((prev) => Math.round(prev + addedHours * 60));
    }
  };

  // Keyboard shortcut listener for Search (Cmd+K or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isSearchOpen && (e.target as HTMLElement).tagName !== "INPUT")) {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (selectedTarget) {
          setSelectedTarget(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, selectedTarget]);

  // ── Unified Three.js Scene Lifecycle & Single Persistent Render Loop ───────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(camFovRef.current, width / height, 0.1, 2000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Load High-Resolution ESO 360-Degree Milky Way Panorama Texture
    const textureLoader = new THREE.TextureLoader();
    const mwTexture = textureLoader.load("/textures/milkyway.jpg");
    mwTexture.colorSpace = THREE.SRGBColorSpace;
    mwTexture.wrapS = THREE.RepeatWrapping;
    mwTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Load High-Resolution Photorealistic Planetary Textures
    const planetTextures: Record<string, THREE.Texture> = {
      sun: textureLoader.load("/textures/planets/sun.jpg"),
      moon: textureLoader.load("/textures/planets/moon.jpg"),
      mercury: textureLoader.load("/textures/planets/mercury.jpg"),
      venus: textureLoader.load("/textures/planets/venus.jpg"),
      mars: textureLoader.load("/textures/planets/mars.jpg"),
      jupiter: textureLoader.load("/textures/planets/jupiter.jpg"),
      saturn: textureLoader.load("/textures/planets/saturn.jpg"),
      saturn_ring: textureLoader.load("/textures/planets/saturn_ring.png"),
      uranus: textureLoader.load("/textures/planets/uranus.jpg"),
      neptune: textureLoader.load("/textures/planets/neptune.jpg"),
    };
    for (const key of Object.keys(planetTextures)) {
      planetTextures[key].colorSpace = THREE.SRGBColorSpace;
    }

    // ── Atmospheric Sky Dome with High-Resolution ESO 3D Milky Way ───────────
    const skyGeom = new THREE.SphereGeometry(SKY_SPHERE_RADIUS, 96, 96);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color("#070b14") },
        uMid: { value: new THREE.Color("#0b1220") },
        uHorizon: { value: new THREE.Color("#101c2e") },
        uSunDir: { value: new THREE.Vector3(0, -1, 0) },
        uSunAlt: { value: -30.0 },
        uLstRad: { value: 0.0 },
        uLatRad: { value: 0.0 },
        uShowMilkyWay: { value: 1.0 },
        uMilkyWayTex: { value: mwTexture },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform float uSunAlt;
        uniform float uLstRad;
        uniform float uLatRad;
        uniform float uShowMilkyWay;
        uniform sampler2D uMilkyWayTex;
        varying vec3 vWorldPos;

        void main() {
          vec3 n = normalize(vWorldPos);
          float y = clamp(n.y, 0.0, 1.0);

          // 1. Multi-Stop Atmospheric Scattering Gradient
          float yCurve = pow(y, 0.55);
          vec3 skyCol = mix(uHorizon, uMid, smoothstep(0.0, 0.4, yCurve));
          skyCol = mix(skyCol, uZenith, smoothstep(0.3, 0.95, yCurve));

          // 2. Solar Twilight Glow & Dusk Belt
          if (uSunAlt > -18.0) {
            float sunDot = max(dot(n, normalize(uSunDir)), 0.0);
            float wideGlow = pow(sunDot, 2.5) * 0.35;
            float midGlow = pow(sunDot, 8.0) * 0.45;
            float coreGlow = pow(sunDot, 32.0) * 0.65;
            float altFactor = clamp((uSunAlt + 18.0) / 28.0, 0.0, 1.0);

            vec3 duskColor = mix(vec3(0.45, 0.16, 0.18), vec3(0.95, 0.48, 0.15), clamp((uSunAlt + 10.0) / 10.0, 0.0, 1.0));
            duskColor = mix(duskColor, vec3(1.0, 0.85, 0.5), clamp(uSunAlt / 8.0, 0.0, 1.0));

            float horizScatter = exp(-pow(y * 4.5, 2.0)) * (wideGlow + 0.1) * altFactor * 0.4;
            skyCol += (duskColor * (wideGlow + midGlow + coreGlow) + vec3(0.8, 0.35, 0.15) * horizScatter) * altFactor;
          }

          // 3. Exact IAU Galactic Coordinate Mapping for Realistic ESO Photographic Milky Way Panorama
          if (uShowMilkyWay > 0.5) {
            float alt = asin(clamp(n.y, -1.0, 1.0));
            // n.x is negated (East=-X) after coordinate fix; negate back to get true azimuth
            float az = atan(-n.x, n.z);
            float cosAlt = cos(alt);

            float sinDec = sin(uLatRad) * sin(alt) + cos(uLatRad) * cosAlt * cos(az);
            float dec = asin(clamp(sinDec, -1.0, 1.0));
            float cosDec = cos(dec);

            float sinH = -cosAlt * sin(az);
            float cosH = (cos(uLatRad) * sin(alt) - sin(uLatRad) * cosAlt * cos(az));
            float H = atan(sinH, cosH);
            float ra = uLstRad - H;

            // (RA, Dec) -> Galactic Coordinates (l, b) (IAU J2000 Standard)
            float raNGP = 3.366033;   // 192.85948 deg
            float decNGP = 0.473477;  // 27.12825 deg
            float lCP = 2.145567;     // 122.93192 deg (Galactic Longitude of NCP)

            float sinB = sin(decNGP) * sin(dec) + cos(decNGP) * cosDec * cos(ra - raNGP);
            float b = asin(clamp(sinB, -1.0, 1.0));

            float y_gal = cosDec * sin(ra - raNGP);
            float x_gal = cos(decNGP) * sin(dec) - sin(decNGP) * cosDec * cos(ra - raNGP);
            float l = lCP - atan(y_gal, x_gal);

            float u = fract(l / 6.2831853 + 0.5);
            float v = clamp(b / 3.1415926 + 0.5, 0.001, 0.999);

            vec4 texColor = texture2D(uMilkyWayTex, vec2(u, v));
            float mwFade = smoothstep(-0.35, 0.15, n.y);

            // In planetarium simulator mode, keep photographic Milky Way clearly visible at all times
            float dayFactor = 1.0;
            if (uSunAlt > 0.0) {
              dayFactor = 0.85;
            } else if (uSunAlt > -18.0) {
              float t = (uSunAlt + 18.0) / 18.0;
              dayFactor = mix(1.0, 0.85, t);
            }

            // Photorealistic ESO Milky Way Panorama with Rich Cosmic Dust Lanes & Stellar Clouds
            vec3 mwRGB = pow(texColor.rgb, vec3(0.95)) * 1.85;
            skyCol += mwRGB * mwFade * dayFactor;
          }

          if (n.y < 0.0) {
            vec3 nadirSpace = vec3(0.015, 0.025, 0.045);
            skyCol = mix(skyCol * 0.35, nadirSpace, clamp(-n.y * 1.5, 0.0, 1.0));
          }
          gl_FragColor = vec4(skyCol, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(skyGeom, skyMat);
    skyMesh.name = "skyDome";
    scene.add(skyMesh);

    // ── Ground Disc Mask at Y=0 (Semi-Transparent X-Ray Capable) ────────────
    const groundGeom = new THREE.CircleGeometry(GROUND_RADIUS * 2, 96);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x163820,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.position.y = -0.5;
    groundMesh.name = "ground";
    scene.add(groundMesh);

    // ── Glowing Cyan Horizon Boundary Reference Ring at Alt=0 (Y=0) ──────────
    const horizonRingGeom = new THREE.BufferGeometry();
    const ringPts: number[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ringPts.push(GROUND_RADIUS * Math.sin(a), 0, GROUND_RADIUS * Math.cos(a));
    }
    horizonRingGeom.setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3));
    const horizonRingMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      linewidth: 1.5,
    });
    const horizonRing = new THREE.LineLoop(horizonRingGeom, horizonRingMat);
    horizonRing.name = "horizonRing";
    scene.add(horizonRing);

    // ── 360-Degree Seamless Rolling Hills Horizon Ring ──────────────────────
    const hillsGroup = new THREE.Group();
    hillsGroup.name = "landscapeHills";
    const hillSegments = 128;
    const hillRadius = GROUND_RADIUS - 6;

    const hillGeom = new THREE.BufferGeometry();
    const hillPositions: number[] = [];
    for (let i = 0; i <= hillSegments; i++) {
      const angle = (i / hillSegments) * Math.PI * 2;
      const wave = Math.sin(angle * 3.0) * 8.0 + Math.sin(angle * 7.0 + 1.2) * 5.0 + Math.cos(angle * 12.0) * 3.0;
      const height = Math.max(6.0, 16.0 + wave);

      const x = hillRadius * Math.sin(angle);
      const z = hillRadius * Math.cos(angle);

      hillPositions.push(x, 0, z);
      hillPositions.push(x, height, z);
    }

    const hillIndices: number[] = [];
    for (let i = 0; i < hillSegments; i++) {
      const base = i * 2;
      hillIndices.push(base, base + 1, base + 2);
      hillIndices.push(base + 1, base + 3, base + 2);
    }
    hillGeom.setAttribute("position", new THREE.Float32BufferAttribute(hillPositions, 3));
    hillGeom.setIndex(hillIndices);
    hillGeom.computeVertexNormals();

    const hillMat = new THREE.MeshBasicMaterial({
      color: 0x1a4226,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const hillMesh = new THREE.Mesh(hillGeom, hillMat);
    hillMesh.name = "hillsMesh";
    hillsGroup.add(hillMesh);
    scene.add(hillsGroup);

    // ── Majestic 360-Degree Horizon Tree Line (280 Rich Vector Trees) ────────
    const treeGroup = new THREE.Group();
    treeGroup.name = "treeSilhouettes";
    const treeCount = 280;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      let seed2 = i * 7919;
      const rng = () => {
        seed2 = (seed2 * 16807) % 2147483647;
        return (seed2 - 1) / 2147483646;
      };

      const treeR = GROUND_RADIUS - 24 + rng() * 32;
      const treeH = 16 + rng() * 32; // Taller, majestic trees (16 - 48 units)
      const treeW = 8 + rng() * 18;  // Lush, broad crowns (8 - 26 units)
      const treeType = rng();

      const shape = new THREE.Shape();
      const tw = treeW;
      const th = treeH;

      if (treeType > 0.6) {
        // 1. Spreading Majestic Oak / Deciduous Tree (billowing multi-lobed crown)
        shape.moveTo(-tw * 0.12, 0);
        shape.lineTo(tw * 0.12, 0);
        shape.lineTo(tw * 0.1, th * 0.28);
        shape.lineTo(tw * 0.45, th * 0.32);
        shape.lineTo(tw * 0.58, th * 0.48);
        shape.lineTo(tw * 0.48, th * 0.65);
        shape.lineTo(tw * 0.52, th * 0.78);
        shape.lineTo(tw * 0.32, th * 0.92);
        shape.lineTo(0, th);
        shape.lineTo(-tw * 0.32, th * 0.92);
        shape.lineTo(-tw * 0.52, th * 0.78);
        shape.lineTo(-tw * 0.48, th * 0.65);
        shape.lineTo(-tw * 0.58, th * 0.48);
        shape.lineTo(-tw * 0.45, th * 0.32);
        shape.lineTo(-tw * 0.1, th * 0.28);
        shape.lineTo(-tw * 0.12, 0);
      } else if (treeType > 0.3) {
        // 2. Layered Conifer / Evergreen Pine Tree (tiered evergreen boughs)
        shape.moveTo(-tw * 0.08, 0);
        shape.lineTo(tw * 0.08, 0);
        shape.lineTo(tw * 0.08, th * 0.15);
        shape.lineTo(tw * 0.5, th * 0.2);
        shape.lineTo(tw * 0.38, th * 0.35);
        shape.lineTo(tw * 0.42, th * 0.38);
        shape.lineTo(tw * 0.30, th * 0.55);
        shape.lineTo(tw * 0.32, th * 0.58);
        shape.lineTo(tw * 0.20, th * 0.75);
        shape.lineTo(tw * 0.22, th * 0.78);
        shape.lineTo(0, th);
        shape.lineTo(-tw * 0.22, th * 0.78);
        shape.lineTo(-tw * 0.20, th * 0.75);
        shape.lineTo(-tw * 0.32, th * 0.58);
        shape.lineTo(-tw * 0.30, th * 0.55);
        shape.lineTo(-tw * 0.42, th * 0.38);
        shape.lineTo(-tw * 0.38, th * 0.35);
        shape.lineTo(-tw * 0.5, th * 0.2);
        shape.lineTo(-tw * 0.08, th * 0.15);
        shape.lineTo(-tw * 0.08, 0);
      } else {
        // 3. Dense Clustered Woodland Grove (multiple natural tree crowns)
        shape.moveTo(-tw * 0.45, 0);
        shape.lineTo(tw * 0.45, 0);
        shape.lineTo(tw * 0.5, th * 0.3);
        shape.lineTo(tw * 0.4, th * 0.65);
        shape.lineTo(tw * 0.28, th * 0.78);
        shape.lineTo(tw * 0.15, th * 0.95);
        shape.lineTo(0, th * 0.88);
        shape.lineTo(-tw * 0.18, th * 0.98);
        shape.lineTo(-tw * 0.35, th * 0.82);
        shape.lineTo(-tw * 0.48, th * 0.58);
        shape.lineTo(-tw * 0.5, th * 0.25);
        shape.lineTo(-tw * 0.45, 0);
      }

      const treeGeom2 = new THREE.ShapeGeometry(shape);
      const treeMat2 = new THREE.MeshBasicMaterial({
        color: 0x1d4a2c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      });
      const treeMesh2 = new THREE.Mesh(treeGeom2, treeMat2);
      treeMesh2.position.set(treeR * Math.sin(angle), -0.5, treeR * Math.cos(angle));
      treeMesh2.lookAt(0, treeH * 0.3, 0);
      treeGroup.add(treeMesh2);
    }
    scene.add(treeGroup);

    // ── Persistent Dynamic Container Groups (Strict Cleanup Guarantee) ────
    const starsGroup = new THREE.Group();
    starsGroup.name = "dynamicStars";
    scene.add(starsGroup);

    const constelArtGroup = new THREE.Group();
    constelArtGroup.name = "dynamicConstelArt";
    scene.add(constelArtGroup);

    const constelGroup = new THREE.Group();
    constelGroup.name = "dynamicConstellations";
    scene.add(constelGroup);

    const nebulaeGroup = new THREE.Group();
    nebulaeGroup.name = "dynamicNebulae";
    scene.add(nebulaeGroup);

    const bodiesGroup = new THREE.Group();
    bodiesGroup.name = "dynamicBodies";
    scene.add(bodiesGroup);

    const constelTextureMap: Record<string, THREE.Texture> = {};
    function getConstelTexture(file: string): THREE.Texture {
      if (!constelTextureMap[file]) {
        const tex = textureLoader.load(`/textures/constellations/${file}`);
        tex.colorSpace = THREE.SRGBColorSpace;
        constelTextureMap[file] = tex;
      }
      return constelTextureMap[file];
    }

    // ── Persistent High-Fidelity Celestial Bodies (Photorealistic Textures & Shaders) ──
    // 1. Sun Photosphere & Glowing Solar Corona
    const sunGroup = new THREE.Group();
    sunGroup.name = "sunGroup";
    const sunInnerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(256, "#fff3d1", "#f59e0b"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
    }));
    sunInnerGlow.scale.set(50, 50, 1);
    sunGroup.add(sunInnerGlow);

    const sunOuterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(256, "#f59e0b", "#d97706"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }));
    sunOuterGlow.scale.set(90, 90, 1);
    sunGroup.add(sunOuterGlow);

    const sunSphere = new THREE.Mesh(
      new THREE.SphereGeometry(14, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.sun })
    );
    sunGroup.add(sunSphere);
    bodiesGroup.add(sunGroup);

    // 2. Moon with Photorealistic Texture & Physical 3D Sun-Ray Ephemeris Phase Shader
    const moonGroup = new THREE.Group();
    moonGroup.name = "moonGroup";
    const moonGlowMat = new THREE.SpriteMaterial({
      map: createRadialGlowTexture(256, "#ffffff", "#8ab4f8"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    const moonGlow = new THREE.Sprite(moonGlowMat);
    moonGlow.position.set(0, 0, -1.0); // Place behind sphere so dark side stays crisp
    moonGlow.scale.set(34, 34, 1);
    moonGroup.add(moonGlow);

    const moonShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uMoonTex: { value: planetTextures.moon },
        uSunDir: { value: new THREE.Vector3(0, -1, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMoonTex;
        uniform vec3 uSunDir;
        varying vec2 vUv;
        varying vec3 vWorldNormal;

        void main() {
          vec4 texCol = texture2D(uMoonTex, vUv);
          
          // True physical sunlight vector in world space
          float NdotL = dot(vWorldNormal, uSunDir);
          
          // Crisp astronomical lunar terminator
          float illum = smoothstep(-0.015, 0.035, NdotL);
          
          // Faint Earthshine on night side (craters faintly visible like in real telescope)
          vec3 darkSide = texCol.rgb * 0.045 + vec3(0.005, 0.007, 0.010);
          
          // Enhanced bright sunlit regolith with brilliant silver-white lunar radiance
          float diffuse = clamp(NdotL, 0.25, 1.0);
          vec3 litSide = texCol.rgb * (1.50 + 0.45 * diffuse) + vec3(0.08, 0.09, 0.11);
          
          vec3 finalColor = mix(darkSide, litSide, illum);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
    });
    const moonSphere = new THREE.Mesh(
      new THREE.SphereGeometry(9.2, 32, 32),
      moonShaderMat
    );
    moonGroup.add(moonSphere);
    bodiesGroup.add(moonGroup);

    // 3. Solar System Planets with Photorealistic Surface Maps & Atmospheric Halos
    const planetGroups: Record<string, THREE.Group> = {};

    // Mercury
    const mercuryGroup = new THREE.Group();
    const mercuryGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#cbd5e1", "#cbd5e1"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    }));
    mercuryGlow.scale.set(16, 16, 1);
    mercuryGroup.add(mercuryGlow);
    const mercurySphere = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.mercury })
    );
    mercuryGroup.add(mercurySphere);
    bodiesGroup.add(mercuryGroup);
    planetGroups["mercury"] = mercuryGroup;

    // Venus
    const venusGroup = new THREE.Group();
    const venusGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#fef08a", "#fef08a"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }));
    venusGlow.scale.set(22, 22, 1);
    venusGroup.add(venusGlow);
    const venusSphere = new THREE.Mesh(
      new THREE.SphereGeometry(5.4, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.venus })
    );
    venusGroup.add(venusSphere);
    bodiesGroup.add(venusGroup);
    planetGroups["venus"] = venusGroup;

    // Mars
    const marsGroup = new THREE.Group();
    const marsGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#f87171", "#f87171"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    }));
    marsGlow.scale.set(18, 18, 1);
    marsGroup.add(marsGlow);
    const marsSphere = new THREE.Mesh(
      new THREE.SphereGeometry(4.8, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.mars })
    );
    marsGroup.add(marsSphere);
    bodiesGroup.add(marsGroup);
    planetGroups["mars"] = marsGroup;

    // Jupiter
    const jupiterGroup = new THREE.Group();
    const jupiterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#fcd34d", "#fcd34d"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    }));
    jupiterGlow.scale.set(28, 28, 1);
    jupiterGroup.add(jupiterGlow);
    const jupiterSphere = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.jupiter })
    );
    jupiterGroup.add(jupiterSphere);
    bodiesGroup.add(jupiterGroup);
    planetGroups["jupiter"] = jupiterGroup;

    // Saturn (Sphere + Iconic Photorealistic 3D Ring Annulus)
    const saturnGroup = new THREE.Group();
    const saturnGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#fed7aa", "#fed7aa"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }));
    saturnGlow.scale.set(30, 30, 1);
    saturnGroup.add(saturnGlow);

    const saturnInner = new THREE.Group();
    saturnInner.rotation.z = THREE.MathUtils.degToRad(26.7);
    saturnInner.rotation.x = THREE.MathUtils.degToRad(18.0);

    const saturnSphere = new THREE.Mesh(
      new THREE.SphereGeometry(6.0, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.saturn })
    );
    saturnInner.add(saturnSphere);

    const saturnRing = new THREE.Mesh(
      createSaturnRingGeometry(7.2, 15.0, 64),
      new THREE.MeshBasicMaterial({
        map: planetTextures.saturn_ring,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    saturnInner.add(saturnRing);

    saturnGroup.add(saturnInner);
    bodiesGroup.add(saturnGroup);
    planetGroups["saturn"] = saturnGroup;

    // Uranus
    const uranusGroup = new THREE.Group();
    const uranusGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#7dd3fc", "#7dd3fc"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }));
    uranusGlow.scale.set(20, 20, 1);
    uranusGroup.add(uranusGlow);
    const uranusSphere = new THREE.Mesh(
      new THREE.SphereGeometry(5.0, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.uranus })
    );
    uranusGroup.add(uranusSphere);
    bodiesGroup.add(uranusGroup);
    planetGroups["uranus"] = uranusGroup;

    // Neptune
    const neptuneGroup = new THREE.Group();
    const neptuneGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createRadialGlowTexture(128, "#818cf8", "#818cf8"),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }));
    neptuneGlow.scale.set(20, 20, 1);
    neptuneGroup.add(neptuneGlow);
    const neptuneSphere = new THREE.Mesh(
      new THREE.SphereGeometry(5.0, 32, 32),
      new THREE.MeshBasicMaterial({ map: planetTextures.neptune })
    );
    neptuneGroup.add(neptuneSphere);
    bodiesGroup.add(neptuneGroup);
    planetGroups["neptune"] = neptuneGroup;

    // 4. Dynamic Orbital Satellites & Space Stations Group
    const satellitesGroup = new THREE.Group();
    satellitesGroup.name = "dynamicSatellites";
    scene.add(satellitesGroup);

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER FRAME LOOP
    // ═════════════════════════════════════════════════════════════════════════
    const renderFrame = () => {
      const {
        solarState: sol,
        topoStars: stars,
        topoMoon: moon,
        topoPlanets: planets,
        constellations: cstl,
        topoNebulae: nebs,
        observationDate: obsDate,
        location: obsLoc,
      } = astroRef.current;

      const toggles = togglesRef.current;
      const currentTarget = selectedTargetRef.current;
      const isDay = sol.isDaylight;

      // ── 0. Camera Fly-To Animation ─────────────────────────────────────────
      if (cameraAnimRef.current) {
        const anim = cameraAnimRef.current;
        const now = performance.now();
        const elapsed = now - anim.startTime;
        const progress = Math.min(1, elapsed / anim.duration);
        const ease = 1 - Math.pow(1 - progress, 3);

        camAzRef.current = ((anim.startAz + (anim.targetAz - anim.startAz) * ease) % 360 + 360) % 360;
        camAltRef.current = anim.startAlt + (anim.targetAlt - anim.startAlt) * ease;

        if (progress >= 1) {
          cameraAnimRef.current = null;
        }
      }

      // ── Ground X-Ray Semi-Transparency Transition ──────────────────────────
      const isSubHorizonTargetActive = currentTarget !== null && currentTarget.altitudeDeg < -2;
      const isCameraLookingBelow = camAltRef.current < -4;
      const targetGroundOpacity = isCameraLookingBelow || (isSubHorizonTargetActive && camAltRef.current < 15) ? 0.22 : 1.0;
      groundOpacityRef.current += (targetGroundOpacity - groundOpacityRef.current) * 0.1;

      // ── Dynamic Day / Twilight / Night Ground & Trees Lighting ────────────
      const sunAlt = sol.altitudeDeg;
      let groundCol: THREE.Color;
      let hillCol: THREE.Color;
      let treeCol: THREE.Color;

      if (sunAlt > 0) {
        // Daylight: vibrant lush meadow and trees
        const dayT = Math.min(1, sunAlt / 25);
        groundCol = new THREE.Color("#184224").lerp(new THREE.Color("#245c32"), dayT);
        hillCol = new THREE.Color("#1c4c2a").lerp(new THREE.Color("#2b6838"), dayT);
        treeCol = new THREE.Color("#225932").lerp(new THREE.Color("#327844"), dayT);
      } else if (sunAlt > -12) {
        // Twilight: warm golden hour dusk / sunset glow
        const twiT = (sunAlt + 12) / 12;
        const duskG = new THREE.Color("#2e241c");
        const duskH = new THREE.Color("#38291e");
        const duskT = new THREE.Color("#443224");
        const nightG = new THREE.Color("#0c1c14");
        const nightH = new THREE.Color("#102419");
        const nightT = new THREE.Color("#142c20");

        groundCol = nightG.clone().lerp(duskG, twiT);
        hillCol = nightH.clone().lerp(duskH, twiT);
        treeCol = nightT.clone().lerp(duskT, twiT);
      } else {
        // Nocturnal Night: moonlight / starlight deep forest green
        groundCol = new THREE.Color("#0c1c14");
        hillCol = new THREE.Color("#102419");
        treeCol = new THREE.Color("#142c20");
      }

      const ground = scene.getObjectByName("ground") as THREE.Mesh | undefined;
      if (ground) {
        const mat = ground.material as THREE.MeshBasicMaterial;
        mat.color.copy(groundCol);
        mat.opacity = groundOpacityRef.current;
      }

      const hillsMesh = scene.getObjectByName("hillsMesh") as THREE.Mesh | undefined;
      if (hillsMesh) {
        const mat = hillsMesh.material as THREE.MeshBasicMaterial;
        mat.color.copy(hillCol);
        mat.opacity = groundOpacityRef.current;
      }

      const treeSil = scene.getObjectByName("treeSilhouettes") as THREE.Group | undefined;
      if (treeSil) {
        treeSil.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshBasicMaterial;
            mat.color.copy(treeCol);
            mat.opacity = groundOpacityRef.current;
          }
        });
      }

      const horizonRing = scene.getObjectByName("horizonRing") as THREE.LineLoop | undefined;
      if (horizonRing) {
        (horizonRing.material as THREE.LineBasicMaterial).opacity = groundOpacityRef.current < 0.9 ? 0.75 : 0.35;
      }

      // ── Sidereal Coordinates & Atmosphere Sky Dome ────────────────────────
      const gmst = getGMST(obsDate);
      const lstDeg = ((gmst + obsLoc.longitude) % 360 + 360) % 360;
      const lstRad = (lstDeg * Math.PI) / 180;
      const latRad = (obsLoc.latitude * Math.PI) / 180;

      const skyDome = scene.getObjectByName("skyDome") as THREE.Mesh | undefined;
      if (skyDome) {
        const mat = skyDome.material as THREE.ShaderMaterial;
        const alt = sol.altitudeDeg;

        const colNightZenith = new THREE.Color("#050912");
        const colNightMid = new THREE.Color("#09101d");
        const colNightHorizon = new THREE.Color("#0e1728");

        const colAstroZenith = new THREE.Color("#060c18");
        const colAstroMid = new THREE.Color("#0e172e");
        const colAstroHorizon = new THREE.Color("#18233c");

        const colNauticalZenith = new THREE.Color("#081224");
        const colNauticalMid = new THREE.Color("#142246");
        const colNauticalHorizon = new THREE.Color("#36253c");

        const colCivilZenith = new THREE.Color("#0d2854");
        const colCivilMid = new THREE.Color("#1a488a");
        const colCivilHorizon = new THREE.Color("#7e3828");

        const colDayZenith = new THREE.Color("#0c3e7a");
        const colDayMid = new THREE.Color("#1f6ec4");
        const colDayHorizon = new THREE.Color("#6cb2fc");

        const zCol = new THREE.Color();
        const mCol = new THREE.Color();
        const hCol = new THREE.Color();

        if (alt <= -18) {
          zCol.copy(colNightZenith);
          mCol.copy(colNightMid);
          hCol.copy(colNightHorizon);
        } else if (alt <= -12) {
          const t = (alt + 18) / 6;
          zCol.copy(colNightZenith).lerp(colAstroZenith, t);
          mCol.copy(colNightMid).lerp(colAstroMid, t);
          hCol.copy(colNightHorizon).lerp(colAstroHorizon, t);
        } else if (alt <= -6) {
          const t = (alt + 12) / 6;
          zCol.copy(colAstroZenith).lerp(colNauticalZenith, t);
          mCol.copy(colAstroMid).lerp(colNauticalMid, t);
          hCol.copy(colAstroHorizon).lerp(colNauticalHorizon, t);
        } else if (alt <= 0) {
          const t = (alt + 6) / 6;
          zCol.copy(colNauticalZenith).lerp(colCivilZenith, t);
          mCol.copy(colNauticalMid).lerp(colCivilMid, t);
          hCol.copy(colNauticalHorizon).lerp(colCivilHorizon, t);
        } else if (alt <= 10) {
          const t = alt / 10;
          zCol.copy(colCivilZenith).lerp(colDayZenith, t);
          mCol.copy(colCivilMid).lerp(colDayMid, t);
          hCol.copy(colDayHorizon).lerp(colDayHorizon, t);
        } else {
          zCol.copy(colDayZenith);
          mCol.copy(colDayMid);
          hCol.copy(colDayHorizon);
        }

        mat.uniforms.uZenith.value.copy(zCol);
        mat.uniforms.uMid.value.copy(mCol);
        mat.uniforms.uHorizon.value.copy(hCol);

        const sunVec = azAltToVec3(sol.azimuthDeg, sol.altitudeDeg, 1).normalize();
        mat.uniforms.uSunDir.value.copy(sunVec);
        mat.uniforms.uSunAlt.value = sol.altitudeDeg;
        mat.uniforms.uLstRad.value = lstRad;
        mat.uniforms.uLatRad.value = latRad;
        mat.uniforms.uShowMilkyWay.value = toggles.showMilkyWay ? 1.0 : 0.0;
      }

      // ── Clean All Dynamic Container Groups Before Rebuilding ──────────────
      while (starsGroup.children.length > 0) {
        const obj = starsGroup.children[0] as THREE.Points;
        starsGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
      }
      while (constelGroup.children.length > 0) {
        const obj = constelGroup.children[0] as THREE.LineSegments | THREE.Points;
        constelGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
      }
      while (constelArtGroup.children.length > 0) {
        const obj = constelArtGroup.children[0] as THREE.Mesh;
        constelArtGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
      }
      while (nebulaeGroup.children.length > 0) {
        const obj = nebulaeGroup.children[0];
        nebulaeGroup.remove(obj);
      }

      // ── 1. PHOTOMETRIC CATALOG STARS (Authentic 2,887 Stars from Yale BSC5) ──
      const positions: number[] = [];
      const colors: number[] = [];
      const mags: number[] = [];

      for (const star of stars) {
        const p = azAltToVec3(star.azimuthDeg, star.altitudeDeg, STAR_LAYER_RADIUS);
        positions.push(p.x, p.y, p.z);
        const c = new THREE.Color(star.colorHex);
        colors.push(c.r, c.g, c.b);
        mags.push(star.mag);
      }

      if (positions.length > 0) {
        const sGeom = new THREE.BufferGeometry();
        sGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        sGeom.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
        sGeom.setAttribute("aMag", new THREE.Float32BufferAttribute(mags, 1));

        const sMat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uBright: { value: isDay ? 0.65 : 1.0 },
          },
          vertexShader: `
            attribute float aMag;
            attribute vec3 aColor;
            varying vec3 vColor;
            varying float vMag;
            uniform float uBright;
            void main() {
              vColor = aColor;
              vMag = aMag;
              // True astronomical point sizing: Betelgeuse (~18px), Rigel (~20px), Aldebaran (~16px), Orion belt (~12px), Mag 4-5 (~6-8px)
              float b = max(0.0, 5.5 - aMag);
              float ptSize = 5.5 + pow(b, 1.35) * 1.85;
              gl_PointSize = clamp(ptSize, 4.0, 26.0);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            varying float vMag;
            void main() {
              vec2 c = gl_PointCoord - vec2(0.5);
              float d = length(c);
              if (d > 0.5) discard;

              // Solid brilliant white star center with sharp optical diffraction falloff
              float core = smoothstep(0.48, 0.05, d);
              float centerGlow = exp(-d * d * 18.0);
              float halo = exp(-d * 4.5) * (vMag < 2.0 ? 0.65 : 0.25);
              float alpha = clamp(core * 0.95 + centerGlow * 0.45 + halo, 0.0, 1.0);

              // Brilliant luminous core blending to spectral Johnson B-V star color
              vec3 finalCol = mix(vColor, vec3(1.0), smoothstep(0.35, 0.0, d) * 0.92);
              gl_FragColor = vec4(finalCol, alpha);
            }
          `,
        });

        const starPoints = new THREE.Points(sGeom, sMat);
        starsGroup.add(starPoints);
      }

      // ── 2. IAU CONSTELLATION STICK FIGURES & 3D CELESTIAL ARTWORK OVERLAYS ──
      if (toggles.showConstellations) {
        const normalLinePos: number[] = [];
        const highlightedLinePos: number[] = [];

        const sel = selectedTargetRef.current;
        const isConstelSelected = sel?.type === "constellation";

        for (const con of cstl) {
          const isThisSelected = isConstelSelected && (
            sel?.id.toLowerCase() === con.abbreviation.toLowerCase() ||
            sel?.name.toLowerCase() === con.name.toLowerCase()
          );

          for (const seg of con.segments) {
            const aA = pos3DtoAzAlt(seg[0]);
            const aB = pos3DtoAzAlt(seg[1]);

            if (aA && aB) {
              const pA = azAltToVec3(aA.az, aA.alt, CONSTELLATION_LAYER_RADIUS);
              const pB = azAltToVec3(aB.az, aB.alt, CONSTELLATION_LAYER_RADIUS);
              if (isThisSelected) {
                highlightedLinePos.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
              } else {
                normalLinePos.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
              }
            }
          }

          // ── 3D Tangential Celestial Mythological Artwork Projection ──
          if (isThisSelected || toggles.showConstellationArt) {
            const prof = getConstellationProfile(con.abbreviation || con.name);
            const artFile = prof?.artworkFile || `${con.name.toLowerCase().replace(/\s+/g, "-")}.webp`;

            const artTex = getConstelTexture(artFile);
            if (artTex) {
              let raDeg = prof ? prof.raHours * 15 : 0;
              let decDeg = prof ? prof.decDeg : 0;

              if (!prof) {
                const rawAzAlt = pos3DtoAzAlt(con.centerPos3D);
                if (rawAzAlt) {
                  const sinDec = Math.sin(latRad) * Math.sin((rawAzAlt.alt * Math.PI) / 180) + Math.cos(latRad) * Math.cos((rawAzAlt.alt * Math.PI) / 180) * Math.cos((rawAzAlt.az * Math.PI) / 180);
                  decDeg = Math.asin(Math.max(-1, Math.min(1, sinDec))) * (180 / Math.PI);
                }
              }

              // Exact topocentric centroid on the celestial sphere
              const centerVec = raDecToTopocentricVec3(raDeg, decDeg, lstDeg, latRad, CONSTELLATION_ART_RADIUS);
              const northPt = raDecToTopocentricVec3(raDeg, decDeg + 2.0, lstDeg, latRad, CONSTELLATION_ART_RADIUS);
              const cosDec = Math.max(0.08, Math.cos((decDeg * Math.PI) / 180));
              const eastPt = raDecToTopocentricVec3(raDeg + 2.0 / cosDec, decDeg, lstDeg, latRad, CONSTELLATION_ART_RADIUS);

              // Inward normal (from sphere surface pointing to observer at origin)
              const normal = centerVec.clone().negate().normalize();

              // Up vector (towards Celestial North on sky)
              let up = northPt.clone().sub(centerVec).normalize();
              // Right vector on texture (+X): points Celestial WEST (-RA) for standard skyculture charts
              let right = new THREE.Vector3().crossVectors(up, normal).normalize();
              up = new THREE.Vector3().crossVectors(normal, right).normalize();

              // Apply fine-tuned artwork rotation offset if specified
              const rotDeg = prof?.artworkRotationDeg || 0;
              if (rotDeg !== 0) {
                const rotRad = (rotDeg * Math.PI) / 180;
                const cosR = Math.cos(rotRad);
                const sinR = Math.sin(rotRad);
                const rNew = right.clone().multiplyScalar(cosR).add(up.clone().multiplyScalar(sinR)).normalize();
                const uNew = right.clone().multiplyScalar(-sinR).add(up.clone().multiplyScalar(cosR)).normalize();
                right.copy(rNew);
                up.copy(uNew);
              }

              // Angular scale in sky dome
              const scaleDeg = prof?.artworkScaleDeg || 38;
              const scaleRad = (scaleDeg * Math.PI) / 180;
              const quadSize = 2 * CONSTELLATION_ART_RADIUS * Math.tan(scaleRad / 2);

              const geom = new THREE.PlaneGeometry(quadSize, quadSize);
              const opacity = isThisSelected ? (isDay ? 0.75 : 0.95) : (isDay ? 0.20 : 0.38);
              const mat = new THREE.MeshBasicMaterial({
                map: artTex,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                opacity,
                color: isThisSelected ? new THREE.Color(0x38bdf8) : new THREE.Color(0x7dd3fc),
                side: THREE.DoubleSide,
              });

              const mesh = new THREE.Mesh(geom, mat);
              const mat4 = new THREE.Matrix4();
              mat4.makeBasis(right, up, normal);
              mat4.setPosition(centerVec);
              mesh.matrix.copy(mat4);
              mesh.matrixAutoUpdate = false;
              constelArtGroup.add(mesh);
            }
          }
        }

        if (normalLinePos.length > 0) {
          const lGeom = new THREE.BufferGeometry();
          lGeom.setAttribute("position", new THREE.Float32BufferAttribute(normalLinePos, 3));
          const lMat = new THREE.LineBasicMaterial({
            color: isDay ? 0x93c5fd : 0x7dd3fc,
            transparent: true,
            opacity: isDay ? 0.55 : 0.42,
            linewidth: 1,
          });
          const constelLines = new THREE.LineSegments(lGeom, lMat);
          constelGroup.add(constelLines);
        }

        if (highlightedLinePos.length > 0) {
          const hlGeom = new THREE.BufferGeometry();
          hlGeom.setAttribute("position", new THREE.Float32BufferAttribute(highlightedLinePos, 3));
          const hlMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.95,
            linewidth: 2,
          });
          const hlLines = new THREE.LineSegments(hlGeom, hlMat);
          constelGroup.add(hlLines);
        }
      }

      // ── 4. NEBULAE & DEEP SKY OBJECTS (Photometric Cosmic Gas Sprites) ──────
      if (toggles.showNebulae) {
        for (const neb of nebs) {
          const nP = azAltToVec3(neb.azimuthDeg, neb.altitudeDeg, NEBULA_LAYER_RADIUS);
          const glowTex = createNebulaGlowTexture(128, neb.colorHex, neb.secondaryColorHex, neb.type);
          const nMat = new THREE.SpriteMaterial({
            map: glowTex,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: isDay ? 0.45 : 0.85,
          });
          const nSprite = new THREE.Sprite(nMat);
          nSprite.position.copy(nP);
          const scale = neb.type === "galaxy" ? 38 : neb.type === "planetary_nebula" ? 22 : 32;
          nSprite.scale.set(scale, scale, 1);
          nebulaeGroup.add(nSprite);
        }
      }

      // ── 5. CELESTIAL BODIES (Photorealistic Moon Phase Shader, Sun Corona, Real Planet Textures & Saturn Rings) ──
      if (toggles.showBodies) {
        bodiesGroup.visible = true;

        // 1. Moon: Position & True Physical Sunlight Vector
        const moonP = azAltToVec3(moon.azimuthDeg, moon.altitudeDeg, BODY_LAYER_RADIUS);
        moonGroup.position.copy(moonP);
        moonGroup.lookAt(0, 0, 0);
        const sunDirVec = azAltToVec3(sol.azimuthDeg, sol.altitudeDeg, 1).normalize();
        moonShaderMat.uniforms.uSunDir.value.copy(sunDirVec);
        moonGlow.material.opacity = Math.max(0.12, (moon.illuminationFraction ?? 0.5) * 0.65);

        // 2. Sun: Position & Photosphere Corona
        const sunP = azAltToVec3(sol.azimuthDeg, sol.altitudeDeg, BODY_LAYER_RADIUS);
        sunGroup.position.copy(sunP);
        sunGroup.lookAt(0, 0, 0);

        // 3. Solar System Planets: Real High-Resolution Textures & Tilted Rings
        for (const planet of planets) {
          const pGroup = planetGroups[planet.id];
          if (pGroup) {
            const pP = azAltToVec3(planet.azimuthDeg, planet.altitudeDeg, BODY_LAYER_RADIUS);
            pGroup.position.copy(pP);
            pGroup.lookAt(0, 0, 0);
            pGroup.visible = true;
          }
        }
      } else {
        bodiesGroup.visible = false;
      }

      // ── 5.5 TOPOCENTRIC SATELLITES (Live SGP4 Orbiters & Space Stations) ───
      while (satellitesGroup.children.length > 0) {
        const obj = satellitesGroup.children[0];
        satellitesGroup.remove(obj);
        if ((obj as THREE.Line).geometry) (obj as THREE.Line).geometry.dispose();
      }

      if (toggles.showSatellites && astroRef.current.topoSats) {
        satellitesGroup.visible = true;
        for (const sat of astroRef.current.topoSats.satellites) {
          const sP = azAltToVec3(sat.azimuthDeg, sat.altitudeDeg, SATELLITE_LAYER_RADIUS);
          const isStation = sat.category === "station";
          const isTelescope = sat.category === "telescope";
          const isTargeted = currentTarget && currentTarget.id === sat.id;

          // Glowing satellite marker sprite
          const sGlowMat = new THREE.SpriteMaterial({
            map: createRadialGlowTexture(128, sat.colorHex, sat.colorHex),
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: isStation ? 0.95 : isTelescope ? 0.9 : 0.75,
          });
          const sGlow = new THREE.Sprite(sGlowMat);
          sGlow.position.copy(sP);
          const sz = isStation ? 20 : isTelescope ? 15 : isTargeted ? 18 : 10;
          sGlow.scale.set(sz, sz, 1);
          satellitesGroup.add(sGlow);

          // Center bright satellite core
          const sCoreGeom = new THREE.SphereGeometry(isStation ? 1.6 : isTelescope ? 1.3 : 0.8, 8, 8);
          const sCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const sCoreMesh = new THREE.Mesh(sCoreGeom, sCoreMat);
          sCoreMesh.position.copy(sP);
          satellitesGroup.add(sCoreMesh);

          // Render Orbital Pass Track Line if trail data is present
          if (sat.trail && sat.trail.length >= 2) {
            const linePositions: number[] = [];
            for (let tIdx = 0; tIdx < sat.trail.length - 1; tIdx++) {
              const pA = sat.trail[tIdx];
              const pB = sat.trail[tIdx + 1];
              linePositions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
            }
            if (linePositions.length > 0) {
              const tGeom = new THREE.BufferGeometry();
              tGeom.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
              const tMat = new THREE.LineBasicMaterial({
                color: new THREE.Color(sat.colorHex),
                transparent: true,
                opacity: isStation || isTargeted ? 0.55 : 0.28,
                linewidth: 1,
              });
              const trailLine = new THREE.LineSegments(tGeom, tMat);
              satellitesGroup.add(trailLine);
            }
          }
        }
      } else {
        satellitesGroup.visible = false;
      }

      // ── Update Camera Orbit ────────────────────────────────────────────────
      const azRad = (camAzRef.current * Math.PI) / 180;
      const altRad = (camAltRef.current * Math.PI) / 180;
      const targetVec = new THREE.Vector3(
        -Math.cos(altRad) * Math.sin(azRad), // Negate: matches azAltToVec3 East=-X convention
        Math.sin(altRad),
        Math.cos(altRad) * Math.cos(azRad)
      );
      camera.fov = camFovRef.current;
      camera.updateProjectionMatrix();
      camera.lookAt(targetVec);

      // Render 3D Scene
      renderer.render(scene, camera);

      // ── 6. 2D OVERLAY CANVAS FOR RAZOR-SHARP TYPOGRAPHY & NEBULA ICONS ─────
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = overlay.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) {
          overlay.width = Math.round(w * dpr);
          overlay.height = Math.round(h * dpr);
        }

        ctx.save();
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.scale(dpr, dpr);

        const project = (azDeg: number, altDeg: number, r: number) => {
          const v3 = azAltToVec3(azDeg, altDeg, r);
          v3.project(camera);
          if (v3.z > 1.0) return null;
          const sx = ((v3.x + 1) / 2) * w;
          const sy = ((-v3.y + 1) / 2) * h;
          if (sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100) return null;
          return { x: sx, y: sy };
        };

        // A0. 2D Refined Constellation Stick Figures (30% Thinner & Elegant)
        if (toggles.showConstellations) {
          ctx.save();
          ctx.lineWidth = isDay ? 1.4 : 1.0; // 30% thinner
          ctx.strokeStyle = isDay ? "rgba(147, 197, 253, 0.60)" : "rgba(125, 211, 252, 0.45)"; // 30% subtler
          if (isDay) {
            ctx.shadowColor = "rgba(3, 105, 161, 0.6)";
            ctx.shadowBlur = 4;
          } else {
            ctx.shadowColor = "rgba(56, 189, 248, 0.25)";
            ctx.shadowBlur = 2;
          }

          ctx.beginPath();
          for (const con of cstl) {
            for (const seg of con.segments) {
              const aA = pos3DtoAzAlt(seg[0]);
              const aB = pos3DtoAzAlt(seg[1]);
              if (aA && aB) {
                const pA = project(aA.az, aA.alt, CONSTELLATION_LAYER_RADIUS);
                const pB = project(aB.az, aB.alt, CONSTELLATION_LAYER_RADIUS);
                if (pA && pB) {
                  ctx.moveTo(pA.x, pA.y);
                  ctx.lineTo(pB.x, pB.y);
                }
              }
            }
          }
          ctx.stroke();
          ctx.restore();
        }

        // A. Constellation Names
        if (toggles.showConstellationNames) {
          ctx.save();
          ctx.font = isDay ? "bold 13px system-ui, -apple-system, sans-serif" : "600 13px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = isDay ? "rgba(255, 255, 255, 0.98)" : "rgba(165, 215, 245, 0.90)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          if (isDay) {
            ctx.shadowColor = "rgba(2, 6, 23, 0.85)";
            ctx.shadowBlur = 5;
          }

          for (const con of cstl) {
            const prof = getConstellationProfile(con.abbreviation || con.name);
            let center: { az: number; alt: number } | null = null;
            if (prof) {
              const cVec = raDecToTopocentricVec3(prof.raHours * 15, prof.decDeg, lstDeg, latRad, CONSTELLATION_LAYER_RADIUS);
              center = pos3DtoAzAlt(cVec);
            } else {
              center = pos3DtoAzAlt(con.centerPos3D);
            }
            if (!center) continue;
            const p = project(center.az, center.alt, CONSTELLATION_LAYER_RADIUS);
            if (p) {
              const spacedName = con.name.split("").join(" ");
              ctx.fillText(spacedName, p.x, p.y);
            }
          }
          ctx.restore();
        }

        // B. Nebulae & Deep Sky Markers (Non-Star Astronomical Symbols)
        if (toggles.showNebulae) {
          for (const neb of nebs) {
            const p = project(neb.azimuthDeg, neb.altitudeDeg, NEBULA_LAYER_RADIUS);
            if (!p) continue;

            ctx.save();
            // Draw Distinct Non-Star Astronomical Symbol based on DSO Type
            if (neb.type === "emission_nebula" || neb.type === "supernova_remnant") {
              // 🔲 Dashed Cosmic Box with 4 Corner Accents
              ctx.strokeStyle = neb.colorHex;
              ctx.lineWidth = 1.4;
              ctx.setLineDash([3, 2]);
              ctx.strokeRect(p.x - 9, p.y - 9, 18, 18);
              ctx.setLineDash([]);

              // Inner gas glow dot
              ctx.fillStyle = neb.colorHex;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
              ctx.fill();
            } else if (neb.type === "planetary_nebula") {
              // ⌖ Crosshair Target Ring
              ctx.strokeStyle = "#2dd4bf";
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(p.x - 12, p.y); ctx.lineTo(p.x - 8, p.y);
              ctx.moveTo(p.x + 8, p.y); ctx.lineTo(p.x + 12, p.y);
              ctx.moveTo(p.x, p.y - 12); ctx.lineTo(p.x, p.y - 8);
              ctx.moveTo(p.x, p.y + 8); ctx.lineTo(p.x, p.y + 12);
              ctx.stroke();
            } else if (neb.type === "galaxy") {
              // ⬭ Tilted Spiral Oval
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(-0.55);
              ctx.strokeStyle = "#fef08a";
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(0, 0, 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else {
              // ◌ Stardust Dotted Cluster Ring
              ctx.strokeStyle = "#67e8f9";
              ctx.lineWidth = 1.4;
              ctx.setLineDash([2, 3]);
              ctx.beginPath();
              ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Nebula Label
            if (toggles.showLabels) {
              ctx.font = "600 11px system-ui, -apple-system, sans-serif";
              ctx.fillStyle = neb.colorHex;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillText(neb.name, p.x + 14, p.y - 4);
              ctx.font = "500 9px monospace";
              ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
              ctx.fillText(neb.messierNgc, p.x + 14, p.y + 7);
            }

            ctx.restore();
          }
        }

        // C. Bright Star & Planet Labels
        if (toggles.showLabels) {
          ctx.font = "500 11px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";

          for (const star of stars) {
            if (star.mag > 1.3) continue;
            const p = project(star.azimuthDeg, star.altitudeDeg, STAR_LAYER_RADIUS);
            if (p) {
              ctx.fillStyle = "#e2e8f0";
              ctx.fillText(star.name, p.x + 8, p.y + 2);
            }
          }

          if (toggles.showBodies) {
            for (const pl of planets) {
              const p = project(pl.azimuthDeg, pl.altitudeDeg, BODY_LAYER_RADIUS);
              if (p) {
                ctx.fillStyle = pl.colorHex;
                ctx.fillText(pl.name, p.x + 10, p.y + 2);
              }
            }

            const pm = project(moon.azimuthDeg, moon.altitudeDeg, BODY_LAYER_RADIUS);
            if (pm) {
              ctx.fillStyle = "#ffffff";
              ctx.fillText("Moon", pm.x + 12, pm.y + 2);
            }

            const ps = project(sol.azimuthDeg, sol.altitudeDeg, BODY_LAYER_RADIUS);
            if (ps) {
              ctx.fillStyle = "#fffbeb";
              ctx.fillText("Sun", ps.x + 16, ps.y + 2);
            }
          }

          // Satellites Live HUD Labels
          if (toggles.showSatellites && astroRef.current.topoSats) {
            for (const sat of astroRef.current.topoSats.satellites) {
              if (sat.category !== "station" && sat.category !== "telescope" && sat.altitudeDeg < 12 && (!currentTarget || currentTarget.id !== sat.id)) continue;
              const p = project(sat.azimuthDeg, sat.altitudeDeg, SATELLITE_LAYER_RADIUS);
              if (p) {
                ctx.font = "bold 10px font-mono, system-ui, monospace";
                ctx.fillStyle = sat.colorHex;
                ctx.fillText(`🛰️ ${sat.name}`, p.x + 8, p.y - 3);
                ctx.font = "500 8.5px font-mono, monospace";
                ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
                ctx.fillText(`${sat.altitudeKm}km · ${(sat.speedKmH / 1000).toFixed(1)}k km/h`, p.x + 8, p.y + 7);
              }
            }
          }
        }

        // D. Cardinal Compass Headings
        ctx.font = "bold 13px font-mono, system-ui, monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const cardinals = [
          { az: 0, t: "N" },
          { az: 45, t: "NE" },
          { az: 90, t: "E" },
          { az: 135, t: "SE" },
          { az: 180, t: "S" },
          { az: 225, t: "SW" },
          { az: 270, t: "W" },
          { az: 315, t: "NW" },
        ];

        for (const c of cardinals) {
          const p = project(c.az, 0.5, GROUND_RADIUS - 2);
          if (p) ctx.fillText(c.t, p.x, p.y);
        }

        // E. Selected Target Reticle (HUD Brackets)
        if (currentTarget) {
          const p = project(currentTarget.azimuthDeg, currentTarget.altitudeDeg, BODY_LAYER_RADIUS);
          if (p) {
            ctx.save();
            const isSub = currentTarget.altitudeDeg < 0;
            ctx.strokeStyle = isSub ? "#f43f5e" : currentTarget.type === "nebula" ? "#ec4899" : "#38bdf8";
            ctx.lineWidth = 1.6;
            ctx.shadowColor = isSub ? "#f43f5e" : currentTarget.type === "nebula" ? "#ec4899" : "#38bdf8";
            ctx.shadowBlur = 10;

            const s = currentTarget.type === "nebula" ? 22 : 18;
            const cl = 7;
            const corners = [
              [p.x - s, p.y - s, p.x - s + cl, p.y - s, p.x - s, p.y - s + cl],
              [p.x + s - cl, p.y - s, p.x + s, p.y - s, p.x + s, p.y - s + cl],
              [p.x - s, p.y + s - cl, p.x - s, p.y + s, p.x - s + cl, p.y + s],
              [p.x + s - cl, p.y + s, p.x + s, p.y + s, p.x + s, p.y + s - cl],
            ];
            for (const [x1, y1, x2, y2, x3, y3] of corners) {
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.lineTo(x3, y3);
              ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, s + 6, 0, Math.PI * 2);
            ctx.strokeStyle = isSub ? "rgba(244, 63, 94, 0.4)" : currentTarget.type === "nebula" ? "rgba(236, 72, 153, 0.4)" : "rgba(56, 189, 248, 0.35)";
            ctx.stroke();

            ctx.font = "bold 10px monospace";
            ctx.fillStyle = isSub ? "#fda4af" : currentTarget.type === "nebula" ? "#fbcfe8" : "#bae6fd";
            ctx.textAlign = "center";
            ctx.fillText(
              `${currentTarget.name} [${currentTarget.azimuthDeg.toFixed(1)}° / ${currentTarget.altitudeDeg.toFixed(1)}°]`,
              p.x,
              p.y - s - 12
            );

            ctx.restore();
          }
        }

        ctx.restore();
      }
    }

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Mouse & Touch Event Handlers ───────────────────────────────────────────
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const mouseDownPos = useRef({ x: 0, y: 0 });

  const handleClick = (e: React.MouseEvent) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const {
      solarState: sol,
      topoStars: stars,
      topoMoon: moon,
      topoPlanets: planets,
      constellations: cstl,
      topoNebulae: nebs,
      topoSats: sats,
    } = astroRef.current;

    const project = (azDeg: number, altDeg: number, r: number) => {
      const v3 = azAltToVec3(azDeg, altDeg, r);
      v3.project(camera);
      if (v3.z > 1.0) return null;
      const sx = ((v3.x + 1) / 2) * w;
      const sy = ((-v3.y + 1) / 2) * h;
      return { x: sx, y: sy };
    };

    let bestTarget: SelectedTarget | null = null;
    let bestDist = 32;

    // 0. Check Active Orbital Satellites
    if (togglesRef.current.showSatellites && sats) {
      for (const sat of sats.satellites) {
        const p = project(sat.azimuthDeg, sat.altitudeDeg, SATELLITE_LAYER_RADIUS);
        if (p) {
          const d = Math.hypot(clickX - p.x, clickY - p.y);
          if (d < 28 && d < bestDist) {
            bestDist = d;
            bestTarget = {
              id: sat.id,
              name: `🛰️ ${sat.name}`,
              type: "satellite",
              azimuthDeg: sat.azimuthDeg,
              altitudeDeg: sat.altitudeDeg,
              mag: 2.0,
              colorHex: sat.colorHex,
              satelliteInfo: sat,
            };
          }
        }
      }
    }

    // 1. Check Nebulae & DSO
    for (const neb of nebs) {
      const p = project(neb.azimuthDeg, neb.altitudeDeg, NEBULA_LAYER_RADIUS);
      if (p) {
        const d = Math.hypot(clickX - p.x, clickY - p.y);
        if (d < 30 && d < bestDist) {
          bestDist = d;
          bestTarget = {
            id: neb.id,
            name: `${neb.name} (${neb.messierNgc})`,
            type: "nebula",
            azimuthDeg: neb.azimuthDeg,
            altitudeDeg: neb.altitudeDeg,
            mag: neb.mag,
            colorHex: neb.colorHex,
            nebulaInfo: neb,
          };
        }
      }
    }

    // 2. Check Moon
    const pm = project(moon.azimuthDeg, moon.altitudeDeg, BODY_LAYER_RADIUS);
    if (pm) {
      const d = Math.hypot(clickX - pm.x, clickY - pm.y);
      if (d < 36 && d < bestDist) {
        bestDist = d;
        bestTarget = {
          id: "moon",
          name: "Moon (Bulan)",
          type: "moon",
          azimuthDeg: moon.azimuthDeg,
          altitudeDeg: moon.altitudeDeg,
          mag: -12.7,
          colorHex: "#ffffff",
        };
      }
    }

    // 3. Check Sun
    const ps = project(sol.azimuthDeg, sol.altitudeDeg, BODY_LAYER_RADIUS);
    if (ps) {
      const d = Math.hypot(clickX - ps.x, clickY - ps.y);
      if (d < 40 && d < bestDist) {
        bestDist = d;
        bestTarget = {
          id: "sun",
          name: "Sun (Matahari)",
          type: "sun",
          azimuthDeg: sol.azimuthDeg,
          altitudeDeg: sol.altitudeDeg,
          mag: -26.74,
          colorHex: "#fffbeb",
        };
      }
    }

    // 4. Check Planets
    for (const pl of planets) {
      const p = project(pl.azimuthDeg, pl.altitudeDeg, BODY_LAYER_RADIUS);
      if (p) {
        const d = Math.hypot(clickX - p.x, clickY - p.y);
        if (d < 28 && d < bestDist) {
          bestDist = d;
          bestTarget = {
            id: pl.id,
            name: pl.name,
            type: "planet",
            azimuthDeg: pl.azimuthDeg,
            altitudeDeg: pl.altitudeDeg,
            mag: pl.mag,
            colorHex: pl.colorHex,
          };
        }
      }
    }

    // 5. Check Stars
    for (const star of stars) {
      const p = project(star.azimuthDeg, star.altitudeDeg, STAR_LAYER_RADIUS);
      if (p) {
        const d = Math.hypot(clickX - p.x, clickY - p.y);
        const hitRadius = Math.max(16, (5.5 - star.mag) * 4.5);
        if (d < hitRadius && d < bestDist) {
          bestDist = d;
          bestTarget = {
            id: star.id,
            name: star.name,
            type: "star",
            azimuthDeg: star.azimuthDeg,
            altitudeDeg: star.altitudeDeg,
            mag: star.mag,
            colorHex: star.colorHex,
          };
        }
      }
    }

    // 6. Check Constellations (Center Label & Line Segments)
    if (!bestTarget) {
      const gmst = getGMST(observationDate);
      const lstDeg = ((gmst + location.longitude) % 360 + 360) % 360;
      const latRad = (location.latitude * Math.PI) / 180;

      for (const con of cstl) {
        const prof = getConstellationProfile(con.abbreviation || con.name);
        let center: { az: number; alt: number } | null = null;
        if (prof) {
          const cVec = raDecToTopocentricVec3(prof.raHours * 15, prof.decDeg, lstDeg, latRad, CONSTELLATION_LAYER_RADIUS);
          center = pos3DtoAzAlt(cVec);
        } else {
          center = pos3DtoAzAlt(con.centerPos3D);
        }
        if (!center) continue;

        let hit = false;
        let minD = 9999;

        // Check constellation center
        const p = project(center.az, center.alt, CONSTELLATION_LAYER_RADIUS);
        if (p) {
          const d = Math.hypot(clickX - p.x, clickY - p.y);
          if (d < 60) {
            hit = true;
            minD = Math.min(minD, d);
          }
        }

        // Check constellation line segments
        if (!hit) {
          for (const seg of con.segments) {
            const aA = pos3DtoAzAlt(seg[0]);
            const aB = pos3DtoAzAlt(seg[1]);
            if (aA && aB) {
              const pA = project(aA.az, aA.alt, CONSTELLATION_LAYER_RADIUS);
              const pB = project(aB.az, aB.alt, CONSTELLATION_LAYER_RADIUS);
              if (pA && pB) {
                const l2 = (pB.x - pA.x) ** 2 + (pB.y - pA.y) ** 2;
                if (l2 > 0) {
                  const t = Math.max(0, Math.min(1, ((clickX - pA.x) * (pB.x - pA.x) + (clickY - pA.y) * (pB.y - pA.y)) / l2));
                  const projX = pA.x + t * (pB.x - pA.x);
                  const projY = pA.y + t * (pB.y - pA.y);
                  const dSeg = Math.hypot(clickX - projX, clickY - projY);
                  if (dSeg < 30) {
                    hit = true;
                    minD = Math.min(minD, dSeg);
                    break;
                  }
                }
              }
            }
          }
        }

        if (hit && minD < bestDist) {
          bestDist = minD;
          bestTarget = {
            id: con.abbreviation.toLowerCase(),
            name: con.name,
            type: "constellation",
            azimuthDeg: center.az,
            altitudeDeg: center.alt,
            mag: 2.0,
            colorHex: "#38bdf8",
          };
        }
      }
    }

    if (bestTarget) {
      setSelectedTarget(bestTarget);
      flyToTarget(bestTarget.azimuthDeg, bestTarget.altitudeDeg);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    cameraAnimRef.current = null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    const sens = 0.22 * (camFovRef.current / 70);
    // Natural Drag Controls: Drag Right -> Pan Right, Drag Up/Down natural grab
    camAzRef.current = ((camAzRef.current - dx * sens) % 360 + 360) % 360;
    camAltRef.current = Math.max(-85, Math.min(90, camAltRef.current + dy * sens));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDragging.current = false;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx < 6 && dy < 6) {
      handleClick(e);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      mouseDownPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      cameraAnimRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastMousePos.current.x;
    const dy = e.touches[0].clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const sens = 0.22 * (camFovRef.current / 70);
    camAzRef.current = ((camAzRef.current - dx * sens) % 360 + 360) % 360;
    camAltRef.current = Math.max(-85, Math.min(90, camAltRef.current + dy * sens));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    camFovRef.current = Math.max(30, Math.min(110, camFovRef.current + e.deltaY * 0.05));
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isDragging.current = false; }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#060a13] text-slate-100 font-sans overflow-hidden select-none cursor-crosshair active:cursor-grabbing"
    >
      {/* 2D Overlay Canvas for Typography & Non-Star Nebula Symbols */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* ── 1. Top NASA Operations Header Bar ───────────────────────────────── */}
      {/* ── 1. Top NASA Operations Header Bar (Unified Compact Flight Deck) ─ */}
      <header
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-4 pt-2.5 pointer-events-none"
      >
        <div className="max-w-[1680px] mx-auto pointer-events-auto">
          {/* Unified Compact Glassmorphic Aerospace Deck */}
          <div className="h-11 px-3 rounded-2xl bg-[#030712]/92 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.8),0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-between gap-3 text-xs font-mono">
            
            {/* Left: Return to Portal & Brand Badge */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/"
                className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-[#060b18]/80 hover:bg-[#16233b] border border-slate-700/80 hover:border-cyan-400 text-cyan-300 font-bold transition-all group"
                title="Return to Main Portal"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-[11px] tracking-wider">PORTAL</span>
              </Link>

              <div className="h-4 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#060b18]/60 border border-slate-800">
                <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-900 border border-cyan-500/40 p-0.5 shrink-0">
                  <Image
                    src="/cakrapala.png"
                    alt="Cakrapala"
                    width={20}
                    height={20}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-orbitron font-black text-white tracking-[0.2em] text-xs">
                      CAKRAPALA
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                      IAU SKY DOME
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Sector Observation Target & Compact Search */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Clickable Location Chip */}
              {onBackToMap && (
                <button
                  type="button"
                  onClick={onBackToMap}
                  className="h-8 hidden md:flex items-center gap-2 px-3 rounded-xl bg-[#060b18]/90 hover:bg-[#16233b] border border-cyan-500/40 hover:border-cyan-400 text-slate-200 transition-all cursor-pointer group shadow-sm shrink-0"
                  title="Click to Switch Location or View Day/Night World Map"
                >
                  <Compass className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-45 transition-transform" />
                  <span className="text-white font-bold tracking-wider uppercase text-[11px] truncate max-w-[140px] xl:max-w-[200px]">
                    {location.name}
                  </span>
                  <span className="text-slate-600 hidden lg:inline">|</span>
                  <span className="text-[10px] text-cyan-300 hidden lg:inline">
                    {location.latitude >= 0 ? `${location.latitude.toFixed(1)}°N` : `${Math.abs(location.latitude).toFixed(1)}°S`},{" "}
                    {location.longitude >= 0 ? `${location.longitude.toFixed(1)}°E` : `${Math.abs(location.longitude).toFixed(1)}°W`}
                  </span>
                  <span className="text-[9px] text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded font-bold">
                    CHANGE ▾
                  </span>
                </button>
              )}

              {/* Universal Compact Search Bar */}
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="h-8 flex items-center gap-2 px-3 rounded-xl bg-[#060b18]/90 hover:bg-[#16233b] border border-slate-700/80 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 text-xs transition-all shadow-sm shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-sans font-medium hidden xl:inline text-[11px]">Search Stars, Nebulae, Planets...</span>
                <span className="font-sans font-medium xl:hidden text-[11px]">Search...</span>
                <span className="hidden sm:inline-block px-1 py-0.5 rounded text-[9px] bg-slate-800/90 text-slate-400 font-mono border border-slate-700">⌘K</span>
              </button>
            </div>

            {/* Right: Day/Night Radar & Live Chronometer */}
            <div className="flex items-center gap-2 shrink-0">
              {onBackToMap && (
                <button
                  type="button"
                  onClick={onBackToMap}
                  className="h-8 hidden sm:flex items-center gap-1.5 px-3 rounded-xl bg-[#060b18]/80 hover:bg-[#16233b] border border-slate-700/80 hover:border-cyan-400 text-cyan-300 font-bold transition-all text-[11px]"
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>DAY/NIGHT</span>
                </button>
              )}

              {/* Live UTC Chronometer HUD */}
              <button
                type="button"
                onClick={() => setIsTimePickerOpen(true)}
                className="h-8 flex items-center gap-2 px-3 rounded-xl bg-[#060b18]/90 hover:bg-[#0c1a30] border border-cyan-500/40 hover:border-cyan-400 text-slate-300 transition-all cursor-pointer group shadow-sm"
                title="Click to Set Date & Time"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Calendar className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-cyan-300 font-bold text-[11px] font-mono">
                  {observationDate.toUTCString().slice(17, 25)} UTC
                </span>
                <span className="text-[9px] text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                  TIME ▾
                </span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* ── 2. Temporal Date & Time Flight Controller Modal ─────────────────── */}
      {isTimePickerOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-black/60 backdrop-blur-md pointer-events-auto p-4"
        >
          <div className="w-full max-w-lg rounded-[28px] bg-[#030712]/95 border border-cyan-500/50 shadow-[0_0_60px_rgba(6,182,212,0.35)] overflow-hidden font-mono text-xs text-slate-200 animate-fade-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#060e22]/80">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white tracking-widest text-xs uppercase">
                  TEMPORAL SKY DOME CHRONO-DECK
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTimePickerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              
              {/* Active Time Readout */}
              <div className="p-4 rounded-2xl bg-[#060c1d] border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    CURRENT OBSERVATION TIME
                  </span>
                  <div className="text-lg font-black text-white font-sans mt-0.5">
                    {observationDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-cyan-300 font-mono mt-0.5">
                    {observationDate.toUTCString().slice(17, 25)} UTC &bull; {solarState.isDaylight ? "☀️ Daylight" : solarState.isTwilight ? "🌅 Twilight" : "🌌 Night Stargazing"}
                  </div>
                </div>

                {timeOffsetMinutes !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTimeOffsetMinutes(0);
                      setTimePlaybackSpeed(0);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 text-[10px] font-bold transition-all shrink-0"
                  >
                    RESET TO LIVE
                  </button>
                )}
              </div>

              {/* Direct Datetime-Local Picker Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  CHOOSE EXACT DATE &amp; TIME:
                </label>
                <input
                  type="datetime-local"
                  value={new Date(observationDate.getTime() - (observationDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const selectedMs = new Date(e.target.value).getTime();
                    const nowMs = Date.now();
                    setTimeOffsetMinutes(Math.round((selectedMs - nowMs) / 60000));
                    setTimePlaybackSpeed(0);
                  }}
                  className="w-full bg-[#060c1d] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* Stepper Buttons (±Year, ±Month, ±Day, ±Hour) */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  TEMPORAL STEPPERS:
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTimeOffsetMinutes((p) => p - 60)}
                    className="p-2 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-slate-700 transition-all text-slate-200"
                  >
                    -1 HOUR
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeOffsetMinutes((p) => p + 60)}
                    className="p-2 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-slate-700 transition-all text-slate-200"
                  >
                    +1 HOUR
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeOffsetMinutes((p) => p - 1440)}
                    className="p-2 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-slate-700 transition-all text-slate-200"
                  >
                    -1 DAY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeOffsetMinutes((p) => p + 1440)}
                    className="p-2 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-slate-700 transition-all text-slate-200"
                  >
                    +1 DAY
                  </button>
                </div>
              </div>

              {/* Notable Celestial Events Jump */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  JUMP TO CELESTIAL PHENOMENA &amp; EVENTS:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const eventDate = new Date("2026-08-12T17:45:00Z");
                      setTimeOffsetMinutes(Math.round((eventDate.getTime() - Date.now()) / 60000));
                      setTimePlaybackSpeed(0);
                    }}
                    className="p-2.5 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
                  >
                    <strong className="text-white group-hover:text-cyan-300 block">Total Solar Eclipse</strong>
                    <span className="text-[9px] text-slate-400">12 August 2026 • Arctic/Europe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const eventDate = new Date("2026-08-12T22:00:00Z");
                      setTimeOffsetMinutes(Math.round((eventDate.getTime() - Date.now()) / 60000));
                      setTimePlaybackSpeed(0);
                    }}
                    className="p-2.5 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
                  >
                    <strong className="text-white group-hover:text-cyan-300 block">Perseids Meteor Shower Peak</strong>
                    <span className="text-[9px] text-slate-400">12 August 2026 • 100 Meteors/hr</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const eventDate = new Date("2020-12-21T18:30:00Z");
                      setTimeOffsetMinutes(Math.round((eventDate.getTime() - Date.now()) / 60000));
                      setTimePlaybackSpeed(0);
                    }}
                    className="p-2.5 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
                  >
                    <strong className="text-white group-hover:text-cyan-300 block">Great Planetary Conjunction</strong>
                    <span className="text-[9px] text-slate-400">21 Dec 2020 • Jupiter &amp; Saturn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const eventDate = new Date("2026-06-21T02:46:00Z");
                      setTimeOffsetMinutes(Math.round((eventDate.getTime() - Date.now()) / 60000));
                      setTimePlaybackSpeed(0);
                    }}
                    className="p-2.5 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
                  >
                    <strong className="text-white group-hover:text-cyan-300 block">Summer Solstice</strong>
                    <span className="text-[9px] text-slate-400">21 June 2026 • Maximum Sun Altitude</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#060e22]/80 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTimePickerOpen(false)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                APPLY &amp; VIEW SKY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search Modal / Flyout ────────────────────────────────────────────── */}
      {isSearchOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm pointer-events-auto"
        >
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden font-sans">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-900/60">
              <Search className="w-5 h-5 text-cyan-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nebulae, stars, constellations (e.g. Orion, Carina, Sirius)..."
                className="w-full bg-transparent text-white placeholder-slate-500 outline-none text-sm font-sans"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="px-2 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-400 hover:text-white"
              >
                ESC
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800/80 bg-slate-950 text-xs font-mono overflow-x-auto">
              <button
                type="button"
                onClick={() => setSearchFilterCategory("all")}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${searchFilterCategory === "all" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold" : "text-slate-400 hover:text-slate-200"}`}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setSearchFilterCategory("satellite")}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${searchFilterCategory === "satellite" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold" : "text-slate-400 hover:text-slate-200"}`}
              >
                🛰️ SATELLITES ({topoSats.satellites.length})
              </button>
              <button
                type="button"
                onClick={() => setSearchFilterCategory("nebula")}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${searchFilterCategory === "nebula" ? "bg-pink-500/20 text-pink-300 border border-pink-400/40 font-bold" : "text-slate-400 hover:text-slate-200"}`}
              >
                ✨ NEBULAE & DSO (15)
              </button>
              <button
                type="button"
                onClick={() => setSearchFilterCategory("planet")}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${searchFilterCategory === "planet" ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold" : "text-slate-400 hover:text-slate-200"}`}
              >
                🪐 SOLAR SYSTEM
              </button>
              <button
                type="button"
                onClick={() => setSearchFilterCategory("constellation")}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${searchFilterCategory === "constellation" ? "bg-blue-500/20 text-blue-300 border border-blue-400/40 font-bold" : "text-slate-400 hover:text-slate-200"}`}
              >
                🌌 CONSTELLATIONS
              </button>
              <button
                type="button"
                onClick={() => setSearchFilterCategory("star")}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${searchFilterCategory === "star" ? "bg-purple-500/20 text-purple-300 border border-purple-400/40 font-bold" : "text-slate-400 hover:text-slate-200"}`}
              >
                🌟 STARS
              </button>
            </div>

            {/* Search Results List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/40">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No celestial objects found matching "{searchQuery}"
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={`${item.category}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectSearchItem(item)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-cyan-500/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-base group-hover:border-cyan-400/60 transition-all">
                        {item.category === "satellite" ? "🛰️" : item.category === "nebula" ? "✨" : item.category === "planet" ? "🪐" : item.category === "constellation" ? "🌌" : "🌟"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.isAboveHorizon ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          +{item.altitudeDeg.toFixed(1)}°
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          {item.altitudeDeg.toFixed(1)}°
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-4 top-20 z-20 flex flex-col gap-1.5 bg-[#030712]/40 border border-slate-700/40 p-1 rounded-2xl backdrop-blur-2xl shadow-xl pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => { camFovRef.current = Math.max(30, camFovRef.current - 10); }}
          className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-900/60 rounded-xl transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { camFovRef.current = Math.min(110, camFovRef.current + 10); }}
          className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-900/60 rounded-xl transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* ── Target Inspector Card (NASA Astrophotography Dossier) ─────────── */}
      {targetInfo && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed top-16 left-3 sm:left-4 z-30 w-[calc(100vw-24px)] sm:w-[410px] max-w-[430px] max-h-[calc(100vh-80px)] overflow-y-auto rounded-[24px] bg-[#030712]/94 border border-cyan-500/35 backdrop-blur-2xl shadow-[0_16px_60px_rgba(0,0,0,0.85),0_0_25px_rgba(6,182,212,0.15)] text-slate-100 p-4 font-sans pointer-events-auto animate-fade-in custom-scrollbar"
        >
          {/* Top Bar Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                  {targetInfo.type.toUpperCase()}
                </span>
                {targetInfo.altitudeDeg >= 0 ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    VISIBLE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    BELOW HORIZON
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white tracking-tight leading-snug">
                {targetInfo.name}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono italic truncate max-w-[280px]">
                {targetInfo.scientificName}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTarget(null)}
              className="w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer"
              title="Close Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Image Banner: Constellation Artwork OR Real-time Moon Phase OR NASA Archive Photo */}
          {selectedTarget?.type === "constellation" ? (
            /* ── CONSTELLATION MYTHOLOGICAL ARTWORK BANNER ───────────────────── */
            (() => {
              const prof = targetInfo.constellationProfile || getConstellationProfile(selectedTarget.id || selectedTarget.name);
              let artFile = prof?.artworkFile || `${targetInfo.name.toLowerCase().replace(/\s+/g, "-")}.webp`;
              if (targetInfo.name.toLowerCase() === "virgo") artFile = "virgo.jpg";
              else if (targetInfo.name.toLowerCase() === "taurus") artFile = "taurus.jpg";

              return (
                <div className="mt-3 relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#060e22] via-[#020510] to-[#010309] border border-cyan-500/40 shadow-inner group">
                  <div className="relative h-52 sm:h-56 w-full flex items-center justify-center p-2 bg-black/40">
                    {/* Glowing radial backdrop */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/textures/constellations/${artFile}`}
                      alt={targetInfo.name}
                      className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(56,189,248,0.5)] group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Badge Top Left */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-cyan-500/50 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 font-bold shadow-md">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>CELESTIAL ARTWORK</span>
                    </div>

                    {/* Badge Top Right */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-emerald-500/40 text-[9px] font-mono text-emerald-300 flex items-center gap-1 font-bold shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>3D SKY PROJECTED</span>
                    </div>

                    {/* Bottom Label */}
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-slate-800 text-cyan-200">
                        {prof?.englishName || "Mythological Figure"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        IAU: {prof?.abbreviation || selectedTarget.id.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (selectedTarget?.id === "moon" || selectedTarget?.type === "moon") ? (
            /* ── REAL-TIME MOON PHASE VISUALIZER ─────────────────────────── */
            <div className="mt-3 relative rounded-2xl overflow-hidden bg-black border border-slate-700/50 shadow-inner">
              <div className="h-52 w-full flex flex-col items-center justify-center bg-gradient-to-b from-[#050912] to-[#020510] relative p-3">
                {/* Stars background */}
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full bg-white"
                    style={{
                      width: Math.random() > 0.7 ? "2px" : "1px",
                      height: Math.random() > 0.7 ? "2px" : "1px",
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                      opacity: 0.3 + Math.random() * 0.5,
                    }}
                  />
                ))}

                {/* Moon Phase SVG (120x120) */}
                <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-[0_0_20px_rgba(200,200,220,0.5)]">
                  <defs>
                    <clipPath id="moonClip">
                      <circle cx="60" cy="60" r="56" />
                    </clipPath>
                    <radialGradient id="moonGrad" cx="40%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#f0f0e8" />
                      <stop offset="40%" stopColor="#d8d8cc" />
                      <stop offset="100%" stopColor="#888880" />
                    </radialGradient>
                    <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#060a14" />
                      <stop offset="100%" stopColor="#03060e" />
                    </radialGradient>
                  </defs>

                  {/* Outer glow ring */}
                  <circle cx="60" cy="60" r="58" fill="none" stroke="rgba(200,210,240,0.15)" strokeWidth="2" />

                  {/* Moon disc */}
                  <circle cx="60" cy="60" r="56" fill="url(#moonGrad)" clipPath="url(#moonClip)" />

                  {/* Crater details */}
                  <g clipPath="url(#moonClip)" opacity="0.25">
                    <circle cx="45" cy="50" r="6" fill="none" stroke="#666" strokeWidth="1" />
                    <circle cx="75" cy="40" r="4" fill="none" stroke="#666" strokeWidth="1" />
                    <circle cx="55" cy="70" r="8" fill="none" stroke="#666" strokeWidth="1" />
                    <circle cx="80" cy="65" r="5" fill="none" stroke="#666" strokeWidth="1" />
                    <circle cx="35" cy="72" r="3" fill="none" stroke="#666" strokeWidth="0.8" />
                    <ellipse cx="60" cy="55" rx="14" ry="10" fill="#b8b8a8" opacity="0.3" />
                  </g>

                  {/* Shadow overlay — uses phase angle to draw accurate terminator */}
                  {(() => {
                    // phaseDeg: 0=New, 90=Q1, 180=Full, 270=Q3
                    const ph = liveMoonPhaseDeg;
                    const r = 56;
                    const cx = 60, cy = 60;

                    // Determine lit fraction & shadow side
                    const illum = liveMoonIllumination; // 0..1
                    const isWaxing = ph < 180;

                    // The terminator x-offset from center (positive = terminator on right side)
                    // At New (ph=0): illum=0, full dark. At Full (ph=180): illum=1, no dark.
                    // Shadow is on left for waxing (ph 0→180), right for waning (ph 180→360)
                    const terminatorX = cx + r * Math.cos(ph * Math.PI / 180);

                    if (illum < 0.02) {
                      // New Moon: completely dark
                      return <circle cx={cx} cy={cy} r={r} fill="url(#shadowGrad)" clipPath="url(#moonClip)" />;
                    }
                    if (illum > 0.98) {
                      // Full Moon: no shadow
                      return null;
                    }

                    // Draw shadow as: dark hemisphere + elliptical terminator
                    // shadow covers the "dark half"
                    const ellipseRx = Math.abs(r * Math.cos(ph * Math.PI / 180));
                    const shadowPath = isWaxing
                      // Waxing: dark on left, lit on right
                      ? `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${ellipseRx} ${r} 0 0 1 ${cx} ${cy - r} Z`
                      // Waning: dark on right, lit on left
                      : `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${ellipseRx} ${r} 0 0 0 ${cx} ${cy - r} Z`;

                    return (
                      <path
                        d={shadowPath}
                        fill="url(#shadowGrad)"
                        opacity="0.92"
                        clipPath="url(#moonClip)"
                      />
                    );
                  })()}
                </svg>

                {/* Phase Info Row */}
                <div className="mt-3 flex flex-col items-center gap-1">
                  <div className="text-white font-bold text-sm">
                    {liveMoonIllumination < 0.05 ? "🌑 New Moon" :
                     liveMoonIllumination < 0.45 && liveMoonPhaseDeg < 180 ? "🌒 Waxing Crescent" :
                     liveMoonIllumination < 0.55 && liveMoonPhaseDeg < 180 ? "🌓 First Quarter" :
                     liveMoonIllumination < 0.95 && liveMoonPhaseDeg < 180 ? "🌔 Waxing Gibbous" :
                     liveMoonIllumination >= 0.95 ? "🌕 Full Moon" :
                     liveMoonIllumination < 0.55 ? "🌗 Last Quarter" :
                     liveMoonIllumination < 0.45 ? "🌘 Waning Crescent" :
                     "🌖 Waning Gibbous"}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span className="text-slate-300">
                      <span className="text-cyan-300 font-bold">{Math.round(liveMoonIllumination * 100)}%</span> Illuminated
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>Phase {liveMoonPhaseDeg.toFixed(1)}°</span>
                  </div>
                </div>

                {/* Real-time badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-emerald-500/40 text-[9px] font-mono text-emerald-300 flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE EPHEMERIS
                </div>
              </div>
            </div>
          ) : (
            /* ── NASA ARCHIVE IMAGE (non-Moon objects) ─────────────────────── */
            <div className="mt-3 relative rounded-2xl overflow-hidden bg-black border border-cyan-500/30 shadow-inner group">
              {nasaImage?.loading ? (
                <div className="h-48 sm:h-52 w-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#060e22] to-[#020612] relative overflow-hidden">
                  {/* Shimmer sweep */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-pulse" />
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2.5 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                  <span className="text-[10px] font-mono text-cyan-300 tracking-widest block font-bold">
                    RETRIEVING NASA MISSION IMAGERY...
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 mt-1 block">
                    HUBBLE &bull; JWST &bull; SDO ARCHIVE
                  </span>
                </div>
              ) : nasaImage?.imageUrl ? (
                <div
                  className="relative h-48 sm:h-56 w-full flex items-center justify-center bg-black cursor-pointer group"
                  onClick={() => setIsFullscreenImageOpen(true)}
                  title="Click to expand high-resolution image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={nasaImage.thumbnailUrl || nasaImage.imageUrl}
                    alt={targetInfo.name}
                    className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                  {/* NASA Archive Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-cyan-500/40 text-[9px] font-mono text-cyan-300 flex items-center gap-1 font-bold shadow-md">
                    <Camera className="w-3 h-3 text-cyan-400" />
                    <span>NASA ARCHIVE</span>
                  </div>

                  {/* Click to expand overlay */}
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/85 backdrop-blur-md border border-slate-700 text-slate-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-[9px] font-mono">
                    <Maximize2 className="w-3 h-3 text-cyan-400" />
                    <span>FULL VIEW</span>
                  </div>

                  {/* Photographer / Mission Credit */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[9px] font-mono text-slate-300">
                    <span className="truncate max-w-[280px] bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-800/80">
                      {nasaImage.photographer || "NASA / Space Telescope Science Institute"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-28 w-full flex flex-col items-center justify-center p-3 text-center bg-[#060e22]">
                  <Sparkles className="w-6 h-6 text-cyan-400 mb-1.5" />
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">
                    SPECTROSCOPIC TELEMETRY LOCKED
                  </span>
                </div>
              )}
            </div>
          )}


          {/* 4 Compact Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-[#060b18]/80 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>{selectedTarget?.type === "constellation" ? "Brightest Mag" : "Apparent Mag (V)"}</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {targetInfo.magnitude > 0 ? `+${targetInfo.magnitude.toFixed(2)}` : targetInfo.magnitude.toFixed(2)}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#060b18]/80 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-400" />
                <span>Altitude</span>
              </div>
              <div className={`text-sm font-bold mt-1 ${targetInfo.altitudeDeg >= 0 ? "text-amber-300" : "text-rose-400"}`}>
                {targetInfo.altitudeDeg.toFixed(1)}°
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#060b18]/80 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Globe className="w-3 h-3 text-blue-400" />
                <span>Azimuth</span>
              </div>
              <div className="text-sm font-bold text-blue-300 mt-1">{targetInfo.azimuthDeg.toFixed(1)}°</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#060b18]/80 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>Visibility</span>
              </div>
              <div className="text-xs font-bold text-emerald-300 mt-1 truncate" title={`Rise: ${targetInfo.riseTime || '--'} | Set: ${targetInfo.setTime || '--'}`}>
                {targetInfo.riseTime ? `Rise: ${targetInfo.riseTime}` : targetInfo.surfaceTemp}
              </div>
            </div>
          </div>

          {/* Scientific Metadata Key-Values (Responsive & Clean Wrapping) */}
          <div className="space-y-2 text-xs font-mono py-2 mt-2 border-t border-slate-800/60 text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 shrink-0">Coordinates (RA/Dec):</span>
              <span className="text-cyan-300 font-bold text-right">{targetInfo.raDec}</span>
            </div>
            {targetInfo.riseTime && targetInfo.setTime && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Daily Rise / Set:</span>
                <span className="text-emerald-300 font-bold text-right">
                  {targetInfo.riseTime} &bull; {targetInfo.setTime}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 shrink-0">Constellation / Sky Area:</span>
              <span className="text-slate-200 font-bold text-right">{targetInfo.constellation}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 shrink-0">Classification:</span>
              <span className="text-cyan-300 font-bold text-left sm:text-right break-words">{targetInfo.distanceLy}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 shrink-0">Key Feature:</span>
              <span className="text-slate-200 text-left sm:text-right break-words text-[11px] leading-tight">{targetInfo.spectralType}</span>
            </div>
          </div>

          {/* Sub-Horizon Notice */}
          {targetInfo.altitudeDeg < 0 && (
            <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <div className="text-xs text-rose-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Below Horizon (X-Ray Ground Active)</span>
              </div>
              {hoursUntilRise !== null && (
                <button
                  type="button"
                  onClick={handleFastForwardToRise}
                  className="w-full mt-2 py-1.5 rounded-lg font-mono text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-rose-400" />
                  <span>FAST-FORWARD TO RISE (+{hoursUntilRise.toFixed(1)}h)</span>
                </button>
              )}
            </div>
          )}

          {/* Astrophysical Dossier Description & Mythology */}
          <div className="mt-2 p-3 rounded-xl bg-[#060b18]/60 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>{selectedTarget?.type === "constellation" ? "Mythology & Observational Lore" : "Astrophysical Dossier"}</span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans">{targetInfo.description}</p>
            {targetInfo.funFact && (
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300/95 font-sans flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-400 mt-0.5" />
                <span>{targetInfo.funFact}</span>
              </div>
            )}

            {/* Constellation Highlights List */}
            {targetInfo.constellationProfile?.astronomicalHighlights && targetInfo.constellationProfile.astronomicalHighlights.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase">
                  Astronomical Highlights:
                </div>
                <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                  {targetInfo.constellationProfile.astronomicalHighlights.map((hl, idx) => (
                    <li key={idx} className="leading-snug">{hl}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Button: Center View on Object */}
          <button
            type="button"
            onClick={handleCenterTarget}
            className="w-full mt-3 py-2.5 rounded-xl font-mono text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 hover:border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <Crosshair className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform" />
            <span>CENTER VIEW ON OBJECT</span>
          </button>
        </div>
      )}

      {/* ── Fullscreen NASA Imagery Modal ────────────────────────────────────── */}
      {isFullscreenImageOpen && nasaImage?.imageUrl && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={() => setIsFullscreenImageOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 sm:p-8 animate-fade-in pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-[#020612] border border-cyan-500/40 rounded-3xl overflow-hidden p-2 flex flex-col items-center justify-center shadow-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={nasaImage.imageUrl}
              alt={targetInfo?.name || "NASA Astrophotography"}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl"
            />
            <div className="mt-2 text-center text-xs font-mono text-slate-300">
              <span className="text-cyan-400 font-bold">{nasaImage.title || targetInfo?.name}</span> &bull; {nasaImage.photographer || "NASA Archive"}
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenImageOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom HUD Dock (3D Sci-Fi Neumorphic Beveled Command Deck) ──── */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[98vw] overflow-x-auto custom-scrollbar flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-[#020612]/95 border-2 border-slate-700/60 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_25px_rgba(6,182,212,0.15)] pointer-events-auto select-none"
      >
        {/* Left: 3D Tactical Layer Toggle Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Constellation Lines */}
          <SciFi3DButton
            onClick={() => setShowConstellations((p) => !p)}
            title="Toggle Constellation Lines (IAU Boundaries)"
            isActive={showConstellations}
            variant="blue"
            icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="5" r="1.5" fill="currentColor"/><circle cx="19" cy="4" r="1.5" fill="currentColor"/><circle cx="12" cy="11" r="1.5" fill="currentColor"/><circle cx="7" cy="19" r="1.5" fill="currentColor"/><circle cx="18" cy="17" r="1.5" fill="currentColor"/><line x1="5" y1="5" x2="12" y2="11"/><line x1="19" y1="4" x2="12" y2="11"/><line x1="12" y1="11" x2="7" y2="19"/><line x1="12" y1="11" x2="18" y2="17"/></svg>}
            label="CSTL"
          />

          {/* Star & Constellation Names */}
          <SciFi3DButton
            onClick={() => setShowConstellationNames((p) => !p)}
            title="Toggle Star & Constellation Names"
            isActive={showConstellationNames}
            variant="blue"
            icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h6M4 12h8M4 17h5"/><path d="M16 5l2 6 2-6" strokeLinejoin="round"/><circle cx="17" cy="17" r="2.5"/></svg>}
            label="NAME"
          />

          {/* Constellation Mythological Artwork Overlays */}
          <SciFi3DButton
            onClick={() => setShowConstellationArt((p) => !p)}
            title="Toggle Celestial Constellation Artwork Overlays (Stellarium / Star Walk)"
            isActive={showConstellationArt}
            variant="blue"
            icon={<Layers className="w-4 h-4" />}
            label="ART"
          />

          {/* Milky Way Galaxy */}
          <SciFi3DButton
            onClick={() => setShowMilkyWay((p) => !p)}
            title="Toggle ESO Photometric Milky Way Galaxy"
            isActive={showMilkyWay}
            variant="blue"
            icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>}
            label="GALAXY"
          />

          {/* Nebulae & DSO */}
          <SciFi3DButton
            onClick={() => setShowNebulae((p) => !p)}
            title="Toggle Nebulae & Deep Sky Objects"
            isActive={showNebulae}
            variant="blue"
            icon={<Sparkles className="w-4 h-4" />}
            label="DSO"
          />

          {/* Celestial Bodies */}
          <SciFi3DButton
            onClick={() => setShowBodies((p) => !p)}
            title="Toggle Solar System Planets, Sun & Moon"
            isActive={showBodies}
            variant="blue"
            icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="5"/><path d="M14 6a5 5 0 0 1 0 8" strokeDasharray="2 2"/><circle cx="18" cy="16" r="2.5"/></svg>}
            label="SOLAR"
          />

          {/* Active Satellites (Cyber Green Theme like RESUME in reference image) */}
          <SciFi3DButton
            onClick={() => setShowSatellites((p) => !p)}
            title={`Toggle SGP4 Satellites (${topoSats.satellites.length} Visible)`}
            isActive={showSatellites}
            variant="green"
            minWidth="min-w-[66px] sm:min-w-[72px]"
            icon={<Radio className="w-4 h-4" />}
            badge={topoSats.satellites.length}
            label="SATS"
          />
        </div>

        {/* 3D Beveled Telemetry Separator Pillar */}
        <div className="h-10 w-1.5 bg-gradient-to-b from-[#334155] via-[#0f172a] to-[#020617] border-l border-r border-slate-700/50 shadow-[inset_0_0_2px_rgba(0,0,0,0.9)] shrink-0 mx-0.5 sm:mx-1 rounded" />

        {/* Right: 3D Chronometer Flight Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Step -1h */}
          <SciFi3DButton
            onClick={() => setTimeOffsetMinutes((p) => p - 60)}
            title="Rewind 1 Hour (-60m)"
            isActive={false}
            minWidth="min-w-[48px] sm:min-w-[54px]"
            icon={<Rewind className="w-4 h-4 text-cyan-400" />}
            label="-1H"
          />

          {/* 3D WARP Button */}
          <SciFi3DButton
            onClick={() => setTimePlaybackSpeed((p) => (p === 0 ? 6 : p === 6 ? 60 : 0))}
            title="Cycle Warp Playback: Realtime -> 1h/sec -> 10h/sec -> Pause"
            isActive={timePlaybackSpeed !== 0}
            variant={timePlaybackSpeed === 60 ? "rose" : timePlaybackSpeed === 6 ? "amber" : "blue"}
            minWidth="min-w-[76px] sm:min-w-[84px]"
            icon={timePlaybackSpeed !== 0 ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-cyan-400" />}
            label="WARP"
            subLabel={timePlaybackSpeed === 6 ? "1H/S" : timePlaybackSpeed === 60 ? "10H/S" : "LIVE 1X"}
          />

          {/* Step +1h */}
          <SciFi3DButton
            onClick={() => setTimeOffsetMinutes((p) => p + 60)}
            title="Advance 1 Hour (+60m)"
            isActive={false}
            minWidth="min-w-[48px] sm:min-w-[54px]"
            icon={<FastForward className="w-4 h-4 text-cyan-400" />}
            label="+1H"
          />

          {/* Date & Time Calendar Trigger */}
          <SciFi3DButton
            onClick={() => setIsTimePickerOpen(true)}
            title="Open Mission Ephemeris Calendar & Chronometer"
            isActive={true}
            variant="blue"
            minWidth="min-w-[84px] sm:min-w-[96px]"
            icon={<Calendar className="w-4 h-4 text-cyan-200" />}
            label="EPOCH"
            subLabel={`${observationDate.toUTCString().slice(17, 22)} UTC`}
          />

          {/* Reset Clock Button */}
          {timeOffsetMinutes !== 0 && (
            <SciFi3DButton
              onClick={() => {
                setTimeOffsetMinutes(0);
                setTimePlaybackSpeed(0);
              }}
              title="Reset to Real-Time Synchronized Clock"
              isActive={false}
              minWidth="min-w-[48px] sm:min-w-[56px]"
              icon={<RotateCcw className="w-3.5 h-3.5 text-cyan-400" />}
              label="SYNC"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Convert pos3D to Topocentric Azimuth & Altitude
// ═══════════════════════════════════════════════════════════════════════════════
function pos3DtoAzAlt(p: { x: number; y: number; z: number }): { az: number; alt: number } | null {
  const R = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (R < 0.001) return null;

  const alt = Math.asin(Math.max(-1, Math.min(1, p.y / R))) * (180 / Math.PI);
  let az = Math.atan2(p.x, p.z) * (180 / Math.PI);
  az = ((az % 360) + 360) % 360;

  if (!isFinite(alt) || !isFinite(az)) return null;
  return { az, alt };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Generate Saturn Photorealistic 3D Ring Annulus Geometry
// ═══════════════════════════════════════════════════════════════════════════════
function createSaturnRingGeometry(innerRadius: number, outerRadius: number, segments: number = 64): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Inner radius vertex (u = 0)
    positions.push(cos * innerRadius, 0, sin * innerRadius);
    uvs.push(0, i / segments);

    // Outer radius vertex (u = 1)
    positions.push(cos * outerRadius, 0, sin * outerRadius);
    uvs.push(1, i / segments);
  }

  for (let i = 0; i < segments; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = (i + 1) * 2;
    const i3 = (i + 1) * 2 + 1;

    indices.push(i0, i1, i2);
    indices.push(i1, i3, i2);
    // Double side faces
    indices.push(i2, i1, i0);
    indices.push(i2, i3, i1);
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Generate Radial Glow Texture (Cached)
// ═══════════════════════════════════════════════════════════════════════════════
const glowTextureCache = new Map<string, THREE.Texture>();

function createRadialGlowTexture(size: number, centerColor: string, edgeColor: string): THREE.Texture {
  const key = `${size}_${centerColor}_${edgeColor}`;
  if (glowTextureCache.has(key)) return glowTextureCache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, centerColor);
  grad.addColorStop(0.25, centerColor + "bb");
  grad.addColorStop(0.6, edgeColor + "44");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  glowTextureCache.set(key, tex);
  return tex;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Generate Nebula Volumetric Glow Texture (Organic Gas Wisps - Cached)
// ═══════════════════════════════════════════════════════════════════════════════
const nebulaGlowCache = new Map<string, THREE.Texture>();

function createNebulaGlowTexture(size: number, primaryColor: string, secondaryColor: string, type: string): THREE.Texture {
  const key = `${size}_${primaryColor}_${secondaryColor}_${type}`;
  if (nebulaGlowCache.has(key)) return nebulaGlowCache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;

  if (type === "galaxy") {
    // Spiral Galaxy Core + Elliptical Disk
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(0.25, secondaryColor + "99");
    grad.addColorStop(0.6, primaryColor + "33");
    grad.addColorStop(1, "transparent");

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.55);
    ctx.scale(1.4, 0.65);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (type === "planetary_nebula") {
    // Planetary Ring Shroud
    const grad = ctx.createRadialGradient(cx, cy, size * 0.15, cx, cy, size * 0.45);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, primaryColor + "bb");
    grad.addColorStop(0.8, secondaryColor + "55");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Central white dwarf
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Diffuse / Emission Nebula (Organic Wispy Gas)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
    grad.addColorStop(0, primaryColor + "ee");
    grad.addColorStop(0.35, secondaryColor + "88");
    grad.addColorStop(0.7, primaryColor + "33");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
