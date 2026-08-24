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
  STAR_PROFILES,
  BODY_PROFILES,
  type CelestialObjectInfo,
} from "@/lib/astronomy/celestialObjectProfiles";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const DOME_RADIUS = 500;
const SKY_SPHERE_RADIUS = 900;
const STAR_LAYER_RADIUS = 490;
const NEBULA_LAYER_RADIUS = 486;
const CONSTELLATION_LAYER_RADIUS = 485;
const BODY_LAYER_RADIUS = 475;
const GROUND_RADIUS = 480;

// Coordinate conversion: Horizontal (Az, Alt) → Three.js Vector3
function azAltToVec3(azDeg: number, altDeg: number, r: number): THREE.Vector3 {
  const az = (azDeg * Math.PI) / 180;
  const alt = (altDeg * Math.PI) / 180;
  const ca = Math.cos(alt);
  return new THREE.Vector3(
    r * ca * Math.sin(az),
    r * Math.sin(alt),
    r * ca * Math.cos(az)
  );
}

interface Props {
  location: ObserverLocation;
  onBackToMap?: () => void;
}

export interface SelectedTarget {
  id: string;
  name: string;
  type: "star" | "planet" | "moon" | "sun" | "constellation" | "nebula";
  azimuthDeg: number;
  altitudeDeg: number;
  mag: number;
  colorHex: string;
  nebulaInfo?: TopocentricNebula;
}

interface SearchItem {
  id: string;
  name: string;
  category: "planet" | "constellation" | "nebula" | "star";
  categoryLabel: string;
  subtitle: string;
  azimuthDeg: number;
  altitudeDeg: number;
  mag?: number;
  colorHex?: string;
  isAboveHorizon: boolean;
  rawNebula?: TopocentricNebula;
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

    const searchQuery = selectedTarget.nebulaInfo?.name || selectedTarget.name.replace(/\(.*?\)/g, "").trim();

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
  const [searchFilterCategory, setSearchFilterCategory] = useState<"all" | "planet" | "constellation" | "nebula" | "star">("all");
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
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showBodies, setShowBodies] = useState(true);
  const [showNebulae, setShowNebulae] = useState(true);
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
    showMilkyWay: true,
    showLabels: true,
    showBodies: true,
    showNebulae: true,
  });

  useEffect(() => {
    togglesRef.current = {
      showConstellations,
      showConstellationNames,
      showMilkyWay,
      showLabels,
      showBodies,
      showNebulae,
    };
  }, [showConstellations, showConstellationNames, showMilkyWay, showLabels, showBodies, showNebulae]);

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

  const constellations = useMemo(
    () => computeIAUConstellations(observationDate, location.latitude, location.longitude, DOME_RADIUS),
    [observationDate, location]
  );

  const topoNebulae = useMemo(
    () => computeTopocentricNebulae(observationDate, location.latitude, location.longitude, NEBULA_LAYER_RADIUS),
    [observationDate, location]
  );

  const astroRef = useRef({
    solarState,
    topoStars,
    topoMoon,
    topoPlanets,
    constellations,
    topoNebulae,
    observationDate,
    location,
  });

  useEffect(() => {
    astroRef.current = { solarState, topoStars, topoMoon, topoPlanets, constellations, topoNebulae, observationDate, location };
  }, [solarState, topoStars, topoMoon, topoPlanets, constellations, topoNebulae, observationDate, location]);

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
    for (const c of constellations) {
      const center = pos3DtoAzAlt(c.centerPos3D);
      if (center) {
        items.push({
          id: c.abbreviation.toLowerCase(),
          name: c.name,
          category: "constellation",
          categoryLabel: "IAU Constellation",
          subtitle: `Constellation (${c.abbreviation}) • ${c.segments.length} Lines`,
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

    return items;
  }, [solarState, topoMoon, topoPlanets, topoNebulae, constellations, topoStars]);

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
    };
  }, [selectedTarget]);

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
      item.category === "planet"
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
            float az = atan(n.x, n.z);
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

            // Photorealistic ESO Milky Way panorama with rich exposure and high dynamic range
            vec3 mwRGB = pow(texColor.rgb, vec3(0.92)) * 2.2;
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

    const constelGroup = new THREE.Group();
    constelGroup.name = "dynamicConstellations";
    scene.add(constelGroup);

    const nebulaeGroup = new THREE.Group();
    nebulaeGroup.name = "dynamicNebulae";
    scene.add(nebulaeGroup);

    const bodiesGroup = new THREE.Group();
    bodiesGroup.name = "dynamicBodies";
    scene.add(bodiesGroup);

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
      while (nebulaeGroup.children.length > 0) {
        const obj = nebulaeGroup.children[0];
        nebulaeGroup.remove(obj);
      }
      while (bodiesGroup.children.length > 0) {
        const obj = bodiesGroup.children[0];
        bodiesGroup.remove(obj);
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

      // ── 2. IAU CONSTELLATION STICK FIGURES (30% Thinner & Elegant) ────────
      if (toggles.showConstellations) {
        const linePos: number[] = [];

        for (const con of cstl) {
          for (const seg of con.segments) {
            const aA = pos3DtoAzAlt(seg[0]);
            const aB = pos3DtoAzAlt(seg[1]);

            if (aA && aB) {
              const pA = azAltToVec3(aA.az, aA.alt, CONSTELLATION_LAYER_RADIUS);
              const pB = azAltToVec3(aB.az, aB.alt, CONSTELLATION_LAYER_RADIUS);
              linePos.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
            }
          }
        }

        if (linePos.length > 0) {
          const lGeom = new THREE.BufferGeometry();
          lGeom.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
          const lMat = new THREE.LineBasicMaterial({
            color: isDay ? 0x93c5fd : 0x7dd3fc,
            transparent: true,
            opacity: isDay ? 0.55 : 0.42, // 30% subtler and thinner
            linewidth: 1,
          });
          const constelLines = new THREE.LineSegments(lGeom, lMat);
          constelGroup.add(constelLines);
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

      // ── 5. CELESTIAL BODIES (Moon with Phase Shader, Sun, Planets) ────────
      if (toggles.showBodies) {
        // Moon
        const moonP = azAltToVec3(moon.azimuthDeg, moon.altitudeDeg, BODY_LAYER_RADIUS);
        const moonGlowMat = new THREE.SpriteMaterial({
          map: createRadialGlowTexture(256, "#ffffff", "#8ab4f8"),
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.55 * (moon.illuminationFraction ?? 0.5),
        });
        const moonGlow = new THREE.Sprite(moonGlowMat);
        moonGlow.position.copy(moonP);
        moonGlow.scale.set(36, 36, 1);
        bodiesGroup.add(moonGlow);

        const moonGeom = new THREE.SphereGeometry(8, 32, 32);
        const moonTex = new THREE.TextureLoader().load("/textures/moons/moon.jpg");
        moonTex.colorSpace = THREE.SRGBColorSpace;
        const phaseDeg = moon.phaseDeg ?? 180;
        const phaseRad = phaseDeg * (Math.PI / 180);

        const moonMat = new THREE.ShaderMaterial({
          uniforms: {
            uMoonTex: { value: moonTex },
            uPhaseAngle: { value: phaseRad },
          },
          vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D uMoonTex;
            uniform float uPhaseAngle;
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vec4 texCol = texture2D(uMoonTex, vUv);
              float cosPhase = cos(uPhaseAngle);
              float sinPhase = sin(uPhaseAngle);
              vec3 lightDir = normalize(vec3(sinPhase, 0.0, cosPhase));
              float NdotL = dot(normalize(vNormal), lightDir);
              float illum = smoothstep(-0.03, 0.06, NdotL);
              vec3 darkSide = texCol.rgb * 0.04;
              vec3 litSide = texCol.rgb * 1.1;
              vec3 finalColor = mix(darkSide, litSide, illum);
              gl_FragColor = vec4(finalColor, 1.0);
            }
          `,
          transparent: false,
        });
        const moonMesh = new THREE.Mesh(moonGeom, moonMat);
        moonMesh.position.copy(moonP);
        moonMesh.lookAt(0, 0, 0);
        bodiesGroup.add(moonMesh);

        // Sun
        const sunP = azAltToVec3(sol.azimuthDeg, sol.altitudeDeg, BODY_LAYER_RADIUS);
        const sunGlowMat = new THREE.SpriteMaterial({
          map: createRadialGlowTexture(256, "#fff3d1", "#f59e0b"),
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.95,
        });
        const sunGlow = new THREE.Sprite(sunGlowMat);
        sunGlow.position.copy(sunP);
        sunGlow.scale.set(70, 70, 1);
        bodiesGroup.add(sunGlow);

        const sunCoreGeom = new THREE.SphereGeometry(12, 32, 32);
        const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
        const sunCoreMesh = new THREE.Mesh(sunCoreGeom, sunCoreMat);
        sunCoreMesh.position.copy(sunP);
        bodiesGroup.add(sunCoreMesh);

        // Planets
        for (const planet of planets) {
          const pP = azAltToVec3(planet.azimuthDeg, planet.altitudeDeg, BODY_LAYER_RADIUS);
          const pGlowMat = new THREE.SpriteMaterial({
            map: createRadialGlowTexture(128, planet.colorHex, planet.colorHex),
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.8,
          });
          const pGlow = new THREE.Sprite(pGlowMat);
          pGlow.position.copy(pP);
          const sz = Math.max(14, (4.5 - planet.mag) * 4.5);
          pGlow.scale.set(sz, sz, 1);
          bodiesGroup.add(pGlow);

          const pGeom = new THREE.SphereGeometry(3.5, 16, 16);
          const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(planet.colorHex) });
          const pMesh = new THREE.Mesh(pGeom, pMat);
          pMesh.position.copy(pP);
          bodiesGroup.add(pMesh);
        }
      }

      // ── Update Camera Orbit ────────────────────────────────────────────────
      const azRad = (camAzRef.current * Math.PI) / 180;
      const altRad = (camAltRef.current * Math.PI) / 180;
      const targetVec = new THREE.Vector3(
        Math.cos(altRad) * Math.sin(azRad),
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
            const center = pos3DtoAzAlt(con.centerPos3D);
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

    // 6. Check Constellations
    if (!bestTarget) {
      for (const con of cstl) {
        const center = pos3DtoAzAlt(con.centerPos3D);
        if (!center) continue;
        const p = project(center.az, center.alt, CONSTELLATION_LAYER_RADIUS);
        if (p) {
          const d = Math.hypot(clickX - p.x, clickY - p.y);
          if (d < 45 && d < bestDist) {
            bestDist = d;
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
    camAzRef.current = ((camAzRef.current + dx * sens) % 360 + 360) % 360;
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
                    <span className="font-black text-white tracking-widest text-xs">
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
                        {item.category === "nebula" ? "✨" : item.category === "planet" ? "🪐" : item.category === "constellation" ? "🌌" : "🌟"}
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

          {/* NASA Mission Imagery Showcase Banner (Responsive Fit & Pure Space Black Backdrop) */}
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

          {/* 4 Compact Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-[#060b18]/80 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>Apparent Mag (V)</span>
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
                <Flame className="w-3 h-3 text-rose-400" />
                <span>Classification</span>
              </div>
              <div className="text-xs font-bold text-rose-300 mt-1 truncate" title={targetInfo.surfaceTemp}>
                {targetInfo.surfaceTemp}
              </div>
            </div>
          </div>

          {/* Scientific Metadata Key-Values (Responsive & Clean Wrapping) */}
          <div className="space-y-2 text-xs font-mono py-2 mt-2 border-t border-slate-800/60 text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 shrink-0">Constellation:</span>
              <span className="text-slate-200 font-bold text-right">{targetInfo.constellation}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 shrink-0">Distance:</span>
              <span className="text-cyan-300 font-bold text-left sm:text-right break-words">{targetInfo.distanceLy}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 shrink-0">Spectral Profile:</span>
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

          {/* Astrophysical Dossier Description & Fun Fact */}
          <div className="mt-2 p-3 rounded-xl bg-[#060b18]/60 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
            <p className="text-[11px] text-slate-300 font-sans">{targetInfo.description}</p>
            {targetInfo.funFact && (
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300/95 font-sans flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-400 mt-0.5" />
                <span>{targetInfo.funFact}</span>
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
            className="relative max-w-4xl w-full max-h-[90vh] rounded-[28px] overflow-hidden bg-[#030712] border border-cyan-500/50 shadow-[0_0_80px_rgba(6,182,212,0.3)] flex flex-col font-mono text-xs text-slate-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#060e22]/90">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-xs tracking-wider">
                  {nasaImage.title || targetInfo?.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  NASA / ESA / JWST
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreenImageOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="relative flex-1 min-h-[300px] max-h-[65vh] overflow-hidden bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nasaImage.imageUrl}
                alt={targetInfo?.name || "NASA Astrophotography"}
                className="w-full h-full object-contain max-h-[65vh]"
              />
            </div>

            {/* Modal Footer Caption */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#060e22]/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400">
              <div>
                <strong className="text-slate-200">Credit: </strong>
                <span>{nasaImage.photographer || "NASA / Space Telescope Science Institute"}</span>
              </div>
              <a
                href={nasaImage.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline font-bold"
              >
                <span>Open Original High-Res (NASA Archive)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom HUD Dock (Frosted Velvet Glassmorphism) ───────────────────── */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#030712]/35 border border-slate-700/40 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] pointer-events-auto"
      >
        {/* Constellation Lines */}
        <button
          type="button"
          onClick={() => setShowConstellations((p) => !p)}
          title="Constellation Lines"
          className={`p-2.5 rounded-xl border transition-all duration-200 ${
            showConstellations
              ? "bg-cyan-500/25 border-cyan-400/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
              : "bg-[#030712]/50 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="5" cy="5" r="1.5" fill="currentColor"/><circle cx="19" cy="4" r="1.5" fill="currentColor"/><circle cx="12" cy="11" r="1.5" fill="currentColor"/><circle cx="7" cy="19" r="1.5" fill="currentColor"/><circle cx="18" cy="17" r="1.5" fill="currentColor"/><line x1="5" y1="5" x2="12" y2="11"/><line x1="19" y1="4" x2="12" y2="11"/><line x1="12" y1="11" x2="7" y2="19"/><line x1="12" y1="11" x2="18" y2="17"/></svg>
        </button>

        {/* Constellation Names */}
        <button
          type="button"
          onClick={() => setShowConstellationNames((p) => !p)}
          title="Constellation Names"
          className={`p-2.5 rounded-xl border transition-all duration-200 ${
            showConstellationNames
              ? "bg-blue-500/25 border-blue-400/60 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.35)]"
              : "bg-[#030712]/50 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h6M4 12h8M4 17h5"/><path d="M16 5l2 6 2-6" strokeLinejoin="round"/><circle cx="17" cy="17" r="3"/></svg>
        </button>

        {/* Milky Way */}
        <button
          type="button"
          onClick={() => setShowMilkyWay((p) => !p)}
          title="Milky Way Galaxy"
          className={`p-2.5 rounded-xl border transition-all duration-200 ${
            showMilkyWay
              ? "bg-indigo-500/25 border-indigo-400/60 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.35)]"
              : "bg-[#030712]/50 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="6" ry="2" transform="rotate(-35 12 12)" opacity="0.5"/><circle cx="10" cy="10" r="0.8" fill="currentColor"/><circle cx="14" cy="13" r="0.6" fill="currentColor"/><circle cx="8" cy="12" r="0.5" fill="currentColor"/></svg>
        </button>

        {/* Nebulae & Deep Sky (DSO) Toggle */}
        <button
          type="button"
          onClick={() => setShowNebulae((p) => !p)}
          title="Nebulae & Deep Sky (DSO)"
          className={`p-2.5 rounded-xl border transition-all duration-200 ${
            showNebulae
              ? "bg-pink-500/25 border-pink-400/60 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.35)]"
              : "bg-[#030712]/50 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600"
          }`}
        >
          <Sparkles className="w-5 h-5" />
        </button>

        {/* Celestial Bodies */}
        <button
          type="button"
          onClick={() => setShowBodies((p) => !p)}
          title="Moon & Planets"
          className={`p-2.5 rounded-xl border transition-all duration-200 ${
            showBodies
              ? "bg-amber-500/25 border-amber-400/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
              : "bg-[#030712]/50 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="6"/><path d="M14 6a6 6 0 0 1 0 8" strokeDasharray="2 2"/><circle cx="19" cy="17" r="2.5"/><circle cx="19" cy="17" r="4" strokeDasharray="1.5 2" opacity="0.4"/></svg>
        </button>

        <div className="w-px h-7 bg-slate-700/40 mx-1" />

        {/* Temporal Stepper & Time Controls */}
        <div className="flex items-center gap-1 shrink-0 font-mono text-xs">
          <button
            type="button"
            onClick={() => setTimeOffsetMinutes((p) => p - 60)}
            className="p-1.5 px-2 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-700/60 text-slate-300 hover:text-white text-[10px] transition-all"
            title="Rewind 1 Hour"
          >
            <Rewind className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={() => setTimePlaybackSpeed((p) => (p === 0 ? 6 : p === 6 ? 60 : 0))}
            className={`p-1.5 px-2.5 rounded-xl border font-bold text-[10px] flex items-center gap-1 transition-all ${
              timePlaybackSpeed !== 0
                ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "bg-[#060c1d] text-cyan-300 border-cyan-500/40 hover:bg-[#0c1a30]"
            }`}
            title="Toggle Continuous Time Warp Orbit"
          >
            {timePlaybackSpeed !== 0 ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{timePlaybackSpeed === 6 ? "1h/s" : timePlaybackSpeed === 60 ? "10h/s" : "WARP"}</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeOffsetMinutes((p) => p + 60)}
            className="p-1.5 px-2 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-slate-700/60 text-slate-300 hover:text-white text-[10px] transition-all"
            title="Advance 1 Hour"
          >
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={() => setIsTimePickerOpen(true)}
            className="p-1.5 px-2.5 rounded-xl bg-[#060c1d] hover:bg-[#0c1a30] border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1.5 transition-all ml-0.5"
            title="Pick Exact Date & Time"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DATE/TIME</span>
          </button>

          {timeOffsetMinutes !== 0 && (
            <button
              type="button"
              onClick={() => {
                setTimeOffsetMinutes(0);
                setTimePlaybackSpeed(0);
              }}
              className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
              title="Reset to Realtime Synchronized Clock"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
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
// HELPER: Generate Radial Glow Texture
// ═══════════════════════════════════════════════════════════════════════════════
function createRadialGlowTexture(size: number, centerColor: string, edgeColor: string): THREE.Texture {
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
  return tex;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Generate Nebula Volumetric Glow Texture (Organic Gas Wisps)
// ═══════════════════════════════════════════════════════════════════════════════
function createNebulaGlowTexture(size: number, primaryColor: string, secondaryColor: string, type: string): THREE.Texture {
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
