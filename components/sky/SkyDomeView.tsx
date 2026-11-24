"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import * as THREE from "three";
import {
  ArrowLeft,
  Search,
  MapPin,
  Sparkles,
  Layers,
  Orbit,
  Radio,
  Compass,
  CloudSun,
  Mountain,
  Grid3x3,
  Eye,
  Rewind,
  FastForward,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Moon,
  Sun,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import {
  computeSunPosition,
  computeTopocentricStars,
  computeTopocentricBodies,
  computeIAUConstellations,
  computeTopocentricNebulae,
  createEqjToHorMatrix,
  createHorToGalMatrix,
  projectJ2000ToHorizontal,
  formatObserverClock,
  parseObserverLocalInput,
  getObserverLocalHourDate,
  getGMST,
  type ObserverLocation,
} from "@/lib/astronomy/topocentricSky";
import {
  computeTopocentricSatellites,
} from "@/lib/astronomy/topocentricSatellites";
import {
  getConstellationProfile,
  getArtworkMapper,
} from "@/lib/astronomy/constellationProfiles";
import type { ArtworkMapper } from "@/lib/astronomy/constellationArtworkSolver";
import SkyLocationModal from "./SkyLocationModal";
import SkySearchModal, { type SkySearchItem } from "./SkySearchModal";
import SkyTelemetryPanel, { type SelectedSkyTarget } from "./SkyTelemetryPanel";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & COORDINATE PROJECTION
// ═══════════════════════════════════════════════════════════════════════════════

const SKY_SPHERE_RADIUS = 900;
const GRID_LAYER_RADIUS = 496;
const STAR_LAYER_RADIUS = 490;
const NEBULA_LAYER_RADIUS = 486;
const CONSTELLATION_LAYER_RADIUS = 484;
const CONSTELLATION_ART_RADIUS = 478;
const BODY_LAYER_RADIUS = 474;
const SATELLITE_LAYER_RADIUS = 470;
const GROUND_RADIUS = 465;

const DEG2RAD = Math.PI / 180;

// Exact 360° treeline elevation profile (deg) extracted from official Stellarium Guereins alpha channel (5° azimuth bins)
const GUEREINS_HORIZON_ALT: readonly number[] = [
  1.7, 7.1, 4.0, 3.9, 6.2, 6.1, 4.6, 2.4, 2.3, 3.1, 3.1, 2.1,
  2.3, 2.0, 1.5, 1.5, 1.5, 1.3, 1.5, 2.0, 1.8, 1.8, 2.0, 1.8,
  2.9, 2.0, 2.9, 2.9, 2.9, 3.1, 2.1, 2.3, 3.1, 4.5, 3.2, 5.1,
  4.0, 5.3, 3.7, 4.6, 5.3, 5.0, 4.6, 5.1, 4.6, 6.1, 5.4, 6.1,
  5.6, 6.4, 5.1, 4.8, 7.3, 8.6, 9.0, 6.2, 6.5, 7.0, 17.3, 18.0,
  15.6, 5.9, 5.6, 5.6, 10.1, 6.8, 5.7, 5.9, 4.0, 3.7, 11.2, 10.4,
];

function getLandscapeHorizonAlt(azDeg: number): number {
  const norm = (((azDeg % 360) + 360) % 360) / 5;
  const i0 = Math.floor(norm) % 72;
  const i1 = (i0 + 1) % 72;
  const f = norm - Math.floor(norm);
  return GUEREINS_HORIZON_ALT[i0] * (1 - f) + GUEREINS_HORIZON_ALT[i1] * f;
}

/**
 * Right-handed interior celestial sphere projection (Stellarium convention):
 * Camera sits at origin (0,0,0) looking outward:
 *   North (Az=0°)   = +Z
 *   East  (Az=90°)  = -X  (to the RIGHT when facing North)
 *   South (Az=180°) = -Z
 *   West  (Az=270°) = +X  (to the LEFT when facing North)
 *   Zenith (Alt=90°)= +Y
 */
function azAltToVec3(azDeg: number, altDeg: number, r: number): THREE.Vector3 {
  const az = azDeg * DEG2RAD;
  const alt = altDeg * DEG2RAD;
  const ca = Math.cos(alt);
  return new THREE.Vector3(
    -r * ca * Math.sin(az),
    r * Math.sin(alt),
    r * ca * Math.cos(az),
  );
}

function compassLabel(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];
}

function formatLST(date: Date, lonDeg: number): string {
  const gmstDeg = getGMST(date);
  const lstHours = ((((gmstDeg + lonDeg) % 360) + 360) % 360) / 15;
  const h = Math.floor(lstHours);
  const m = Math.floor((lstHours - h) * 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

// Cached radial glow textures (zero per-frame allocations)
const glowTexCache = new Map<string, THREE.CanvasTexture>();
function getRadialGlowTexture(colorA: string, colorB: string, size = 128): THREE.CanvasTexture {
  const key = `${colorA}|${colorB}|${size}`;
  const cached = glowTexCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, colorA);
  grad.addColorStop(0.28, colorA + "aa");
  grad.addColorStop(0.65, colorB + "33");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  glowTexCache.set(key, tex);
  return tex;
}

function createBillboardSphereMaterial(
  tex: THREE.Texture,
  options: {
    size: number;
    glowColor: string;
    mode: "sun" | "moon" | "planet" | "saturn";
    glowStrength?: number;
  },
): THREE.ShaderMaterial {
  const modeVal =
    options.mode === "sun"
      ? 0.0
      : options.mode === "moon"
        ? 1.0
        : options.mode === "saturn"
          ? 3.0
          : 2.0;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: tex },
      uSize: { value: options.size },
      uGlowColor: { value: new THREE.Color(options.glowColor) },
      uGlowStrength: { value: options.glowStrength ?? 0.55 },
      uMode: { value: modeVal },
      uPhaseRad: { value: Math.PI }, // Moon phase (PI = full)
      uDayFade: { value: 1.0 },
    },
    vertexShader: `
      uniform float uSize;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // View-space billboarding: guarantees 1:1 circular projection even at extreme screen corners
        vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mvCenter.xy += position.xy * uSize;
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uGlowColor;
      uniform float uGlowStrength;
      uniform float uMode;
      uniform float uPhaseRad;
      uniform float uDayFade;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        // Disc radius inside quad (rest of quad is seamless radial halo/corona or Saturn rings)
        float discR = (uMode < 0.5) ? 0.22 : (uMode > 2.5 ? 0.24 : 0.30);

        vec3 outCol = vec3(0.0);
        float outAlpha = 0.0;

        // 1. Soft radial optical glow / solar corona
        if (uMode < 0.5) {
          // Sun: seamless luminous white-gold corona
          float dOut = max(0.0, (r - discR) / (1.0 - discR));
          float corona = exp(-dOut * 4.2) * 0.85 + exp(-dOut * 1.8) * 0.25;
          float edgeFade = smoothstep(1.0, 0.55, r);
          vec3 coronaCol = mix(vec3(1.0, 0.96, 0.84), vec3(1.0, 0.72, 0.30), smoothstep(0.0, 0.7, dOut));
          outCol = coronaCol;
          outAlpha = corona * edgeFade * uGlowStrength;
        } else {
          float halo = exp(-r * 3.8) * uGlowStrength * uDayFade * smoothstep(1.0, 0.45, r);
          outCol = uGlowColor;
          outAlpha = halo;
        }

        // 2. Saturn tilted rings (behind sphere when ry > 0, in front when ry < 0)
        float ringAlpha = 0.0;
        vec3 ringCol = vec3(0.90, 0.83, 0.69);
        bool ringInFront = false;
        if (uMode > 2.5) {
          float ang = 0.32;
          float ca = cos(ang), sa = sin(ang);
          vec2 rp = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
          float ringR = length(vec2(rp.x, rp.y * 2.75));
          if (ringR > discR * 1.28 && ringR < discR * 2.45) {
            float band = smoothstep(discR * 1.28, discR * 1.42, ringR) * smoothstep(discR * 2.45, discR * 2.25, ringR);
            float cassini = 1.0 - 0.55 * exp(-pow((ringR - discR * 1.92) / (discR * 0.08), 2.0));
            ringAlpha = band * cassini * 0.82 * uDayFade;
            ringCol = mix(vec3(0.82, 0.74, 0.58), vec3(0.96, 0.91, 0.80), cassini);
            ringInFront = rp.y < 0.0;
          }
          if (!ringInFront && ringAlpha > 0.01) {
            outCol = mix(outCol, ringCol, ringAlpha);
            outAlpha = max(outAlpha, ringAlpha);
          }
        }

        // 3. Analytic 3D Sphere Surface inside discR
        if (r <= discR * 1.03) {
          vec2 sp = p / discR;
          float sr2 = dot(sp, sp);
          float edgeAA = smoothstep(1.03, 0.94, sqrt(sr2));
          if (sr2 < 1.04) {
            float z = sqrt(max(0.0, 1.0 - min(sr2, 1.0)));
            vec3 N = normalize(vec3(sp.x, sp.y, z));
            vec2 sphUv = vec2(atan(N.x, N.z) / 6.2831853 + 0.5, asin(clamp(N.y, -1.0, 1.0)) / 3.1415926 + 0.5);
            vec3 texCol = texture2D(uMap, sphUv).rgb;

            vec3 surfCol;
            if (uMode < 0.5) {
              // Sun photosphere: luminous white-gold center with subtle granulation + warm limb darkening
              float limb = pow(z, 0.42);
              vec3 hotSun = mix(vec3(1.0, 0.74, 0.32), vec3(1.0, 0.99, 0.94), limb);
              surfCol = mix(hotSun, hotSun * (0.82 + texCol * 0.45), 0.35);
            } else if (uMode < 1.5) {
              // Moon: exact astronomical phase shading
              vec3 sunL = normalize(vec3(sin(uPhaseRad), 0.06, -cos(uPhaseRad)));
              float ndl = dot(N, sunL);
              float lit = smoothstep(-0.08, 0.14, ndl);
              surfCol = texCol * mix(0.06, 1.22, lit);
            } else {
              // Planets: soft 3D shading + crisp texture
              vec3 keyLight = normalize(vec3(0.45, 0.35, 0.82));
              float diff = 0.35 + 0.75 * max(dot(N, keyLight), 0.0);
              float rim = pow(1.0 - z, 2.5) * 0.18;
              surfCol = texCol * diff + uGlowColor * rim;
            }

            outCol = mix(outCol, surfCol, edgeAA);
            outAlpha = max(outAlpha, edgeAA);
          }
        }

        // Front arc of Saturn's ring over the planet disc
        if (uMode > 2.5 && ringInFront && ringAlpha > 0.01) {
          outCol = mix(outCol, ringCol, ringAlpha);
          outAlpha = max(outAlpha, ringAlpha);
        }

        if (outAlpha < 0.005) discard;
        gl_FragColor = vec4(outCol, clamp(outAlpha, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPS & COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  location: ObserverLocation;
  onSelectLocation: (loc: ObserverLocation) => void;
}

export default function ThreeGroundSkyView({ location, onSelectLocation }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // Camera state (Azimuth 0=N, 90=E, 180=S, 270=W; Altitude -85..89; FOV 12..86)
  const camAzRef = useRef(135); // Southeast sky
  const camAltRef = useRef(26);
  const camFovRef = useRef(56);
  const camVelRef = useRef({ az: 0, alt: 0 });
  const cameraAnimRef = useRef<{
    startAz: number;
    targetAz: number;
    startAlt: number;
    targetAlt: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // UI readout state (throttled updates for bottom-left HUD)
  const [hudTelemetry, setHudTelemetry] = useState({ az: 135, alt: 26, fov: 56 });

  // Modals & Selection
  const [selectedTarget, setSelectedTarget] = useState<SelectedSkyTarget | null>(null);
  const selectedTargetRef = useRef<SelectedSkyTarget | null>(null);
  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
  }, [selectedTarget]);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<
    "all" | "constellation" | "planet" | "star" | "nebula" | "satellite"
  >("all");

  // NASA imagery for selected target (keyed by targetId to avoid synchronous setState in effect)
  const [nasaImage, setNasaImage] = useState<{
    targetId: string;
    loading: boolean;
    imageUrl: string;
    title: string;
    photographer: string;
  } | null>(null);

  // Layer toggles
  const [showConstellations, setShowConstellations] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [showArt, setShowArt] = useState(false);
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [showGround, setShowGround] = useState(true);
  const [showAzimuthGrid, setShowAzimuthGrid] = useState(false);
  const [showEquatorialGrid, setShowEquatorialGrid] = useState(false);
  const [showNebulae, setShowNebulae] = useState(true);
  const [showBodies, setShowBodies] = useState(true);
  const [showSatellites, setShowSatellites] = useState(false);
  const [nightVision, setNightVision] = useState(false);

  const togglesRef = useRef({
    showConstellations: true,
    showNames: true,
    showArt: false,
    showMilkyWay: true,
    showAtmosphere: true,
    showGround: true,
    showAzimuthGrid: false,
    showEquatorialGrid: false,
    showNebulae: true,
    showBodies: true,
    showSatellites: false,
  });

  useEffect(() => {
    togglesRef.current = {
      showConstellations,
      showNames,
      showArt,
      showMilkyWay,
      showAtmosphere,
      showGround,
      showAzimuthGrid,
      showEquatorialGrid,
      showNebulae,
      showBodies,
      showSatellites,
    };
  }, [
    showConstellations,
    showNames,
    showArt,
    showMilkyWay,
    showAtmosphere,
    showGround,
    showAzimuthGrid,
    showEquatorialGrid,
    showNebulae,
    showBodies,
    showSatellites,
  ]);

  // Temporal engine: 0 = realtime, else minutes per 100ms tick
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState(0);
  const [warpSpeed, setWarpSpeed] = useState<number>(0); // 0, 1 (10m/s), 6 (1h/s), 36 (6h/s)
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (warpSpeed === 0) return;
    const id = setInterval(() => {
      setTimeOffsetMinutes((prev) => prev + warpSpeed);
    }, 100);
    return () => clearInterval(id);
  }, [warpSpeed]);

  const observationDate = useMemo(
    () => new Date(nowMs + timeOffsetMinutes * 60000),
    [nowMs, timeOffsetMinutes],
  );

  // ── Exact IAU Topocentric Ephemeris ────────────────────────────────────────
  const elev = location.elevationMeters ?? 10;

  const solarState = useMemo(
    () => computeSunPosition(observationDate, location.latitude, location.longitude),
    [observationDate, location.latitude, location.longitude],
  );

  const eqjToHorRot = useMemo(
    () => createEqjToHorMatrix(observationDate, location.latitude, location.longitude, elev),
    [observationDate, location.latitude, location.longitude, elev],
  );

  const horToGalRot = useMemo(
    () => createHorToGalMatrix(observationDate, location.latitude, location.longitude, elev),
    [observationDate, location.latitude, location.longitude, elev],
  );

  const topoStars = useMemo(
    () => computeTopocentricStars(observationDate, location.latitude, location.longitude, STAR_LAYER_RADIUS, elev),
    [observationDate, location.latitude, location.longitude, elev],
  );

  const { moon: topoMoon, planets: topoPlanets } = useMemo(
    () => computeTopocentricBodies(observationDate, location.latitude, location.longitude, BODY_LAYER_RADIUS, elev),
    [observationDate, location.latitude, location.longitude, elev],
  );

  const constellations = useMemo(
    () => computeIAUConstellations(observationDate, location.latitude, location.longitude, CONSTELLATION_LAYER_RADIUS, elev),
    [observationDate, location.latitude, location.longitude, elev],
  );

  const topoNebulae = useMemo(
    () => computeTopocentricNebulae(observationDate, location.latitude, location.longitude, NEBULA_LAYER_RADIUS, elev),
    [observationDate, location.latitude, location.longitude, elev],
  );

  const topoSats = useMemo(
    () =>
      computeTopocentricSatellites(
        observationDate,
        location.latitude,
        location.longitude,
        elev,
        SATELLITE_LAYER_RADIUS,
        selectedTarget?.id,
      ),
    [observationDate, location.latitude, location.longitude, elev, selectedTarget?.id],
  );

  // Keep selectedTarget live coordinates synchronized as time advances
  const liveSelectedTarget = useMemo<SelectedSkyTarget | null>(() => {
    if (!selectedTarget) return null;
    if (selectedTarget.type === "sun") {
      return { ...selectedTarget, azimuthDeg: solarState.azimuthDeg, altitudeDeg: solarState.altitudeDeg };
    }
    if (selectedTarget.type === "moon") {
      return {
        ...selectedTarget,
        azimuthDeg: topoMoon.azimuthDeg,
        altitudeDeg: topoMoon.altitudeDeg,
        raDeg: topoMoon.raDeg,
        decDeg: topoMoon.decDeg,
        phaseDeg: topoMoon.phaseDeg,
        illuminationFraction: topoMoon.illuminationFraction,
      };
    }
    if (selectedTarget.type === "planet") {
      const p = topoPlanets.find((x) => x.id === selectedTarget.id);
      if (p) {
        return { ...selectedTarget, azimuthDeg: p.azimuthDeg, altitudeDeg: p.altitudeDeg, raDeg: p.raDeg, decDeg: p.decDeg, mag: p.mag };
      }
    }
    if (selectedTarget.type === "constellation") {
      const c = constellations.find(
        (x) =>
          x.abbreviation.toLowerCase() === selectedTarget.id.toLowerCase() ||
          x.name.toLowerCase() === selectedTarget.name.toLowerCase(),
      );
      if (c) {
        return {
          ...selectedTarget,
          azimuthDeg: c.centerAzDeg,
          altitudeDeg: c.centerAltDeg,
          raDeg: c.centerRaDeg,
          decDeg: c.centerDecDeg,
        };
      }
    }
    if (selectedTarget.type === "star") {
      const s = topoStars.find((x) => x.id === selectedTarget.id);
      if (s) {
        return { ...selectedTarget, azimuthDeg: s.azimuthDeg, altitudeDeg: s.altitudeDeg, raDeg: s.raDeg, decDeg: s.decDeg };
      }
    }
    if (selectedTarget.type === "nebula") {
      const n = topoNebulae.find((x) => x.id === selectedTarget.id);
      if (n) {
        return { ...selectedTarget, azimuthDeg: n.azimuthDeg, altitudeDeg: n.altitudeDeg, raDeg: n.raDeg, decDeg: n.decDeg, nebulaInfo: n };
      }
    }
    if (selectedTarget.type === "satellite") {
      const s = topoSats.satellites.find((x) => x.id === selectedTarget.id);
      if (s) {
        return { ...selectedTarget, azimuthDeg: s.azimuthDeg, altitudeDeg: s.altitudeDeg, satelliteInfo: s };
      }
    }
    return selectedTarget;
  }, [selectedTarget, solarState, topoMoon, topoPlanets, constellations, topoStars, topoNebulae, topoSats]);

  // Ref for RAF loop + dirty version counter (zero per-frame allocations!)
  const skyDataVersionRef = useRef(0);
  const astroRef = useRef({
    solarState,
    eqjToHorRot,
    horToGalRot,
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
    astroRef.current = {
      solarState,
      eqjToHorRot,
      horToGalRot,
      topoStars,
      topoMoon,
      topoPlanets,
      constellations,
      topoNebulae,
      topoSats,
      observationDate,
      location,
    };
    skyDataVersionRef.current += 1;
  }, [
    solarState,
    eqjToHorRot,
    horToGalRot,
    topoStars,
    topoMoon,
    topoPlanets,
    constellations,
    topoNebulae,
    topoSats,
    observationDate,
    location,
    showConstellations,
    showArt,
    showMilkyWay,
    showAtmosphere,
    showGround,
    showAzimuthGrid,
    showEquatorialGrid,
    showNebulae,
    showBodies,
    showSatellites,
    selectedTarget,
  ]);

  // Fetch NASA imagery when selected target changes
  useEffect(() => {
    if (
      !selectedTarget ||
      selectedTarget.type === "moon" ||
      selectedTarget.type === "constellation" ||
      selectedTarget.type === "satellite"
    ) {
      return;
    }

    let active = true;
    const targetId = selectedTarget.id;
    const targetName = selectedTarget.name;
    const q =
      selectedTarget.nebulaInfo?.name ||
      (selectedTarget.type === "planet" || selectedTarget.type === "sun"
        ? selectedTarget.id
        : selectedTarget.name.replace(/\(.*?\)/g, "").trim());

    fetch(`/api/nasa/image?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setNasaImage(
          d?.imageUrl
            ? {
                targetId,
                loading: false,
                imageUrl: d.imageUrl,
                title: d.title || targetName,
                photographer: d.photographer || "NASA / STScI",
              }
            : null,
        );
      })
      .catch(() => {
        if (active) setNasaImage(null);
      });

    return () => {
      active = false;
    };
  }, [selectedTarget]);

  // ── Camera Smooth Fly-To Helper ────────────────────────────────────────────
  const flyCameraTo = useCallback((targetAz: number, targetAlt: number, duration = 850) => {
    const startAz = camAzRef.current;
    let deltaAz = ((((targetAz - startAz) % 360) + 540) % 360) - 180;
    if (Math.abs(deltaAz) < 0.01) deltaAz = 0;

    camVelRef.current = { az: 0, alt: 0 };
    cameraAnimRef.current = {
      startAz,
      targetAz: startAz + deltaAz,
      startAlt: camAltRef.current,
      targetAlt: Math.max(-80, Math.min(88, targetAlt)),
      startTime: performance.now(),
      duration,
    };
  }, []);

  // ── Search Index ───────────────────────────────────────────────────────────
  const searchResults = useMemo<SkySearchItem[]>(() => {
    const items: SkySearchItem[] = [
      {
        id: "sun",
        name: "Sun",
        category: "planet",
        categoryLabel: "Star",
        subtitle: "Solar System Central Star · Mag -26.7",
        azimuthDeg: solarState.azimuthDeg,
        altitudeDeg: solarState.altitudeDeg,
        mag: -26.74,
        colorHex: "#fef08a",
        isAboveHorizon: solarState.altitudeDeg >= 0,
      },
      {
        id: "moon",
        name: "Moon",
        category: "planet",
        categoryLabel: "Natural Satellite",
        subtitle: `${Math.round((topoMoon.illuminationFraction ?? 0.5) * 100)}% Illuminated`,
        azimuthDeg: topoMoon.azimuthDeg,
        altitudeDeg: topoMoon.altitudeDeg,
        raDeg: topoMoon.raDeg,
        decDeg: topoMoon.decDeg,
        mag: topoMoon.mag,
        colorHex: "#f8fafc",
        isAboveHorizon: topoMoon.altitudeDeg >= 0,
      },
    ];

    for (const p of topoPlanets) {
      items.push({
        id: p.id,
        name: p.name,
        category: "planet",
        categoryLabel: "Planet",
        subtitle: `Solar System Planet · Mag ${p.mag.toFixed(1)}`,
        azimuthDeg: p.azimuthDeg,
        altitudeDeg: p.altitudeDeg,
        raDeg: p.raDeg,
        decDeg: p.decDeg,
        mag: p.mag,
        colorHex: p.colorHex,
        isAboveHorizon: p.altitudeDeg >= 0,
      });
    }

    for (const c of constellations) {
      const prof = getConstellationProfile(c.abbreviation || c.name);
      items.push({
        id: c.abbreviation.toLowerCase(),
        name: c.name,
        category: "constellation",
        categoryLabel: "IAU Constellation",
        subtitle: `${c.abbreviation} · ${prof?.englishName || `${c.segments.length} segments`}`,
        azimuthDeg: c.centerAzDeg,
        altitudeDeg: c.centerAltDeg,
        raDeg: c.centerRaDeg,
        decDeg: c.centerDecDeg,
        isAboveHorizon: c.centerAltDeg >= 0,
      });
    }

    for (const neb of topoNebulae) {
      items.push({
        id: neb.id,
        name: `${neb.name} (${neb.messierNgc})`,
        category: "nebula",
        categoryLabel: neb.typeLabel,
        subtitle: `${neb.constellation} · ${neb.distanceLy} · Mag ${neb.mag.toFixed(1)}`,
        azimuthDeg: neb.azimuthDeg,
        altitudeDeg: neb.altitudeDeg,
        raDeg: neb.raDeg,
        decDeg: neb.decDeg,
        mag: neb.mag,
        colorHex: neb.colorHex,
        isAboveHorizon: neb.altitudeDeg >= 0,
      });
    }

    for (const star of topoStars) {
      if (star.mag <= 3.5 || star.constellation) {
        items.push({
          id: star.id,
          name: star.name,
          category: "star",
          categoryLabel: "Star",
          subtitle: `${star.constellation ? `${star.constellation} · ` : ""}Mag ${star.mag.toFixed(2)}`,
          azimuthDeg: star.azimuthDeg,
          altitudeDeg: star.altitudeDeg,
          raDeg: star.raDeg,
          decDeg: star.decDeg,
          mag: star.mag,
          colorHex: star.colorHex,
          isAboveHorizon: star.altitudeDeg >= 0,
        });
      }
    }

    for (const sat of topoSats.satellites.slice(0, 60)) {
      items.push({
        id: sat.id,
        name: sat.name,
        category: "satellite",
        categoryLabel: sat.categoryLabel,
        subtitle: `Alt ${Math.round(sat.altitudeKm)} km · ${sat.speedKmS.toFixed(1)} km/s`,
        azimuthDeg: sat.azimuthDeg,
        altitudeDeg: sat.altitudeDeg,
        colorHex: sat.colorHex,
        isAboveHorizon: sat.altitudeDeg >= 0,
      });
    }

    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((it) => searchCategory === "all" || it.category === searchCategory)
      .filter(
        (it) =>
          !q ||
          it.name.toLowerCase().includes(q) ||
          it.subtitle.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q),
      )
      .sort((a, b) => Number(b.isAboveHorizon) - Number(a.isAboveHorizon));
  }, [
    solarState,
    topoMoon,
    topoPlanets,
    constellations,
    topoNebulae,
    topoStars,
    topoSats,
    searchQuery,
    searchCategory,
  ]);

  const handleSelectSearchItem = useCallback(
    (item: SkySearchItem) => {
      setIsSearchOpen(false);
      if (item.altitudeDeg < 0) {
        setShowGround(false);
      }

      if (item.id === "sun") {
        setSelectedTarget({
          id: "sun",
          name: "Sun",
          type: "sun",
          azimuthDeg: item.azimuthDeg,
          altitudeDeg: item.altitudeDeg,
          mag: -26.74,
          colorHex: "#fef08a",
        });
      } else if (item.id === "moon") {
        setSelectedTarget({
          id: "moon",
          name: "Moon",
          type: "moon",
          azimuthDeg: item.azimuthDeg,
          altitudeDeg: item.altitudeDeg,
          raDeg: item.raDeg,
          decDeg: item.decDeg,
          mag: topoMoon.mag,
          colorHex: "#f8fafc",
          phaseDeg: topoMoon.phaseDeg,
          illuminationFraction: topoMoon.illuminationFraction,
        });
      } else if (item.category === "constellation") {
        const prof = getConstellationProfile(item.id || item.name) ?? undefined;
        setSelectedTarget({
          id: item.id,
          name: item.name,
          type: "constellation",
          azimuthDeg: item.azimuthDeg,
          altitudeDeg: item.altitudeDeg,
          raDeg: item.raDeg,
          decDeg: item.decDeg,
          mag: NaN,
          colorHex: "#38bdf8",
          constellationProfile: prof,
        });
      } else if (item.category === "nebula") {
        const neb = topoNebulae.find((n) => n.id === item.id);
        setSelectedTarget({
          id: item.id,
          name: neb?.name || item.name,
          type: "nebula",
          azimuthDeg: item.azimuthDeg,
          altitudeDeg: item.altitudeDeg,
          raDeg: item.raDeg,
          decDeg: item.decDeg,
          mag: item.mag ?? 5,
          colorHex: item.colorHex ?? "#ec4899",
          nebulaInfo: neb,
        });
      } else if (item.category === "satellite") {
        const sat = topoSats.satellites.find((s) => s.id === item.id);
        setSelectedTarget({
          id: item.id,
          name: item.name,
          type: "satellite",
          azimuthDeg: item.azimuthDeg,
          altitudeDeg: item.altitudeDeg,
          mag: 1,
          colorHex: item.colorHex ?? "#10b981",
          satelliteInfo: sat,
        });
      } else {
        setSelectedTarget({
          id: item.id,
          name: item.name,
          type: item.category === "planet" ? "planet" : "star",
          azimuthDeg: item.azimuthDeg,
          altitudeDeg: item.altitudeDeg,
          raDeg: item.raDeg,
          decDeg: item.decDeg,
          mag: item.mag ?? 1,
          colorHex: item.colorHex ?? "#ffffff",
        });
      }

      flyCameraTo(item.azimuthDeg, item.altitudeDeg);
    },
    [flyCameraTo, topoMoon, topoNebulae, topoSats],
  );

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") {
          setIsSearchOpen(false);
          setIsLocationModalOpen(false);
          setIsTimeModalOpen(false);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((p) => !p);
      } else if (e.key === "/") {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsLocationModalOpen(false);
        setIsTimeModalOpen(false);
        setSelectedTarget(null);
      } else if (e.key.toLowerCase() === "a") {
        setShowAtmosphere((p) => !p);
      } else if (e.key.toLowerCase() === "c") {
        setShowConstellations((p) => !p);
      } else if (e.key.toLowerCase() === "g") {
        setShowGround((p) => !p);
      } else if (e.key.toLowerCase() === "z") {
        setShowAzimuthGrid((p) => !p);
      } else if (e.key.toLowerCase() === "e") {
        setShowEquatorialGrid((p) => !p);
      } else if (e.key === " ") {
        e.preventDefault();
        setWarpSpeed((p) => (p === 0 ? 6 : 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENT THREE.JS WEBGL OBSERVATORY SCENE (ZERO PER-FRAME LEAKS)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(camFovRef.current, width / height, 0.1, 2200);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    const texLoader = new THREE.TextureLoader();

    // 1. 8K ESO Milky Way Panorama + Physical Atmospheric Scattering Sky Dome
    const mwTex = texLoader.load("/textures/milkyway_8k.webp");
    mwTex.colorSpace = THREE.SRGBColorSpace;
    mwTex.wrapS = THREE.RepeatWrapping;
    mwTex.wrapT = THREE.ClampToEdgeWrapping;
    mwTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const skyDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color("#02050d") },
        uMid: { value: new THREE.Color("#050b18") },
        uHorizon: { value: new THREE.Color("#0c1528") },
        uSunDir: { value: new THREE.Vector3(0, -1, 0) },
        uSunAlt: { value: -30.0 },
        uEclipseTotality: { value: 0.0 },
        uShowAtmosphere: { value: 1.0 },
        uShowMilkyWay: { value: 1.0 },
        uHorToGal: { value: new THREE.Matrix3() },
        uMilkyWayTex: { value: mwTex },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform float uSunAlt;
        uniform float uEclipseTotality;
        uniform float uShowAtmosphere;
        uniform float uShowMilkyWay;
        uniform mat3 uHorToGal;
        uniform sampler2D uMilkyWayTex;
        varying vec3 vDir;

        void main() {
          vec3 n = normalize(vDir);
          float y = clamp(n.y, 0.0, 1.0);

          // Linear deep-space baseline sky
          vec3 deepCol = mix(vec3(0.0018, 0.0038, 0.011), vec3(0.0005, 0.0012, 0.0035), pow(y, 0.6));

          // Physical atmospheric scattering gradient when Atmosphere is ON
          vec3 skyCol = deepCol;
          if (uShowAtmosphere > 0.5) {
            float yCurve = pow(y, 0.52);
            skyCol = mix(uHorizon, uMid, smoothstep(0.0, 0.40, yCurve));
            skyCol = mix(skyCol, uZenith, smoothstep(0.30, 0.96, yCurve));

            // Soft natural Rayleigh / Mie atmospheric solar scattering (no blown-out glare circle)
            if (uSunAlt > -18.0) {
              float sunDot = max(dot(n, normalize(uSunDir)), 0.0);
              float wideGlow = pow(sunDot, 3.2) * 0.14;
              float midGlow = pow(sunDot, 16.0) * 0.10;
              float altFactor = clamp((uSunAlt + 18.0) / 26.0, 0.0, 1.0);
              float twilightFactor = 1.0 - clamp(uSunAlt / 14.0, 0.0, 1.0);

              vec3 duskCol = mix(vec3(0.18, 0.03, 0.04), vec3(0.85, 0.24, 0.06), clamp((uSunAlt + 10.0) / 10.0, 0.0, 1.0));
              duskCol = mix(duskCol, vec3(0.92, 0.96, 1.0), clamp(uSunAlt / 12.0, 0.0, 1.0));

              float horizBelt = exp(-pow(y * 5.2, 2.0)) * (wideGlow + 0.08) * twilightFactor * 0.55;
              skyCol += (duskCol * (wideGlow + midGlow) * (1.0 - uEclipseTotality * 0.85) + vec3(0.85, 0.25, 0.06) * horizBelt) * altFactor;
            }

            // Total Solar Eclipse twilight darkening (360-degree sunset horizon glow + deep indigo zenith)
            if (uEclipseTotality > 0.01) {
              vec3 eclZenith = vec3(0.004, 0.010, 0.032);
              vec3 eclHorizon = vec3(0.16, 0.07, 0.05);
              vec3 eclSky = mix(eclHorizon, eclZenith, smoothstep(0.0, 0.35, y));
              skyCol = mix(skyCol, eclSky, uEclipseTotality);
            }
          }

          // Exact 8K ESO Milky Way via precessed IAU HOR -> GAL 3x3 matrix
          if (uShowMilkyWay > 0.5) {
            // Three.js interior dome (North=+Z, West=+X, Up=+Y) -> astronomy-engine HOR (x=North, y=West, z=Up)
            vec3 vHor = vec3(n.z, n.x, n.y);
            vec3 vGal = normalize(uHorToGal * vHor);

            float l = atan(vGal.y, vGal.x); // [-PI, PI], Galactic Center at l = 0
            float b = asin(clamp(vGal.z, -1.0, 1.0));

            // ESO panorama: Galactic Center at u=0.5, longitude l increases LEFTWARD
            float u = fract(0.5 - l / 6.28318530718);
            float v = clamp(b / 3.14159265359 + 0.5, 0.001, 0.999);

            vec3 mwTex = texture2D(uMilkyWayTex, vec2(u, v)).rgb;
            vec3 mwRGB = pow(mwTex, vec3(1.12)) * 0.88;

            // Fade Milky Way realistically in bright daytime when Atmosphere is ON (reappears in eclipse totality)
            float dayVis = 1.0;
            if (uShowAtmosphere > 0.5) {
              if (uSunAlt > 0.0) {
                dayVis = uEclipseTotality * 0.55;
              } else if (uSunAlt > -16.0) {
                dayVis = mix(1.0, 0.0, clamp((uSunAlt + 16.0) / 16.0, 0.0, 1.0));
              }
            }
            skyCol += mwRGB * dayVis;
          }

          // Subtle nadir tone below horizon when Ground is OFF
          if (n.y < 0.0) {
            skyCol = mix(skyCol, vec3(0.001, 0.002, 0.006), clamp(-n.y * 0.75, 0.0, 0.75));
          }

          gl_FragColor = vec4(skyCol, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_SPHERE_RADIUS, 64, 48), skyDomeMat);
    scene.add(skyMesh);

    // 2. Seamless 360° Stellarium Guereins Landscape (Crisp Native Horizon Band + Full Nadir Ground Cap)
    const landscapeGroup = new THREE.Group();
    const horizonTex = texLoader.load("/textures/guereins_horizon.webp");
    horizonTex.colorSpace = THREE.SRGBColorSpace;
    horizonTex.wrapS = THREE.RepeatWrapping;
    horizonTex.wrapT = THREE.ClampToEdgeWrapping;
    // LinearFilter without mipmaps guarantees zero branch-cut seam artifact at any azimuth
    horizonTex.generateMipmaps = false;
    horizonTex.minFilter = THREE.LinearFilter;
    horizonTex.magFilter = THREE.LinearFilter;

    const groundCapTex = texLoader.load("/textures/guereins_ground.webp");
    groundCapTex.colorSpace = THREE.SRGBColorSpace;
    groundCapTex.wrapS = THREE.ClampToEdgeWrapping;
    groundCapTex.wrapT = THREE.ClampToEdgeWrapping;
    groundCapTex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    const landscapeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uHorizonMap: { value: horizonTex },
        uGroundMap: { value: groundCapTex },
        uSunAlt: { value: 30.0 },
        uEclipseTotality: { value: 0.0 },
        uShowAtmosphere: { value: 1.0 },
        uHorizonCol: { value: new THREE.Color("#b8ddff") },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uHorizonMap;
        uniform sampler2D uGroundMap;
        uniform float uSunAlt;
        uniform float uEclipseTotality;
        uniform float uShowAtmosphere;
        uniform vec3 uHorizonCol;
        varying vec3 vWorldDir;

        const float PI = 3.14159265359;
        const float TWO_PI = 6.28318530718;

        void main() {
          vec3 d = normalize(vWorldDir);
          float altDeg = degrees(asin(clamp(d.y, -1.0, 1.0)));
          if (altDeg > 18.6) discard;

          // Exact Stellarium Guereins azimuth mapping:
          // North (Az=0°, +Z) -> u = 0.738, Barn at NNE, Tall Oak & Village at WNW/W
          float azRad = atan(-d.x, d.z);
          float u = fract(azRad / TWO_PI + 0.738);

          // 40° high-resolution horizon band: -21.4° (v=0) to +18.6° (v=1)
          float v = (altDeg + 21.4) / 40.0;
          vec4 stripSample = texture2D(uHorizonMap, vec2(u, clamp(v, 0.004, 0.996)));

          vec3 baseRgb = stripSample.rgb;
          float alpha = stripSample.a;

          // Seamless polar ground floor from -18.2° down to -90° nadir (zero cutoff!)
          if (altDeg < -18.2) {
            float r = clamp((90.0 + altDeg) / (90.0 - 21.4), 0.0, 1.0);
            float gAz = azRad + 0.78539816; // +45° ground_angle_rotatez
            vec2 gUv = vec2(0.5 + 0.48 * r * sin(gAz), 0.5 + 0.48 * r * cos(gAz));
            vec3 groundRgb = texture2D(uGroundMap, clamp(gUv, 0.01, 0.99)).rgb;
            float groundBlend = 1.0 - smoothstep(-21.4, -18.2, altDeg);
            baseRgb = mix(baseRgb, groundRgb, groundBlend);
            alpha = max(alpha, groundBlend);
            if (altDeg <= -21.35) alpha = 1.0;
          }

          if (alpha < 0.02) discard;

          // Realistic solar illumination tied to true Sun altitude (independent of Atmosphere toggle,
          // so daytime remains bright & natural even when Hide Atmosphere is active, matching Stellarium).
          float dayFactor = smoothstep(-5.0, 7.0, uSunAlt);
          float twilightFactor = smoothstep(-14.0, -3.0, uSunAlt) * (1.0 - smoothstep(2.0, 12.0, uSunAlt));
          float eclipseDim = 1.0 - uEclipseTotality * 0.78;

          float exposure = mix(0.24, 1.08, dayFactor) * eclipseDim;
          vec3 nightTint = vec3(0.56, 0.70, 0.96);
          vec3 goldenTint = vec3(1.12, 0.88, 0.72);
          vec3 dayTint = vec3(1.02, 1.02, 0.99);

          vec3 lightTint = mix(nightTint, dayTint, dayFactor);
          lightTint = mix(lightTint, goldenTint, twilightFactor * 0.42);

          vec3 col = baseRgb * lightTint * exposure;

          // Subtle aerial perspective haze along distant skyline ONLY when Atmosphere is ON
          float ridgeBand = smoothstep(-2.0, 8.0, altDeg) * (1.0 - smoothstep(10.0, 18.0, altDeg));
          float hazeAmt = uShowAtmosphere * ridgeBand * mix(0.04, 0.14, dayFactor) * eclipseDim;
          col = mix(col, uHorizonCol, hazeAmt);

          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const landscapeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GROUND_RADIUS, 128, 64),
      landscapeMat,
    );
    landscapeMesh.renderOrder = 25;
    landscapeGroup.add(landscapeMesh);

    // Hairline Horizon Ring at exact Alt = 0° (visible when Ground is OFF or Azimuth grid is ON)
    const horizPts: number[] = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      horizPts.push(GROUND_RADIUS * Math.sin(a), 0, GROUND_RADIUS * Math.cos(a));
    }
    const horizGeom = new THREE.BufferGeometry();
    horizGeom.setAttribute("position", new THREE.Float32BufferAttribute(horizPts, 3));
    const horizRingMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 });
    const horizRing = new THREE.LineLoop(horizGeom, horizRingMat);
    scene.add(horizRing);
    scene.add(landscapeGroup);

    // 3A. Precision Azimuthal (Horizontal Az/Alt) Coordinate Grid + Local Meridian
    const azimuthGridGroup = new THREE.Group();
    azimuthGridGroup.visible = false;
    {
      const azGridPts: number[] = [];
      const meridianPts: number[] = [];
      // Altitude parallels every 15° from -75° to +75°
      for (let alt = -75; alt <= 75; alt += 15) {
        if (alt === 0) continue;
        for (let az = 0; az < 360; az += 3) {
          const p1 = azAltToVec3(az, alt, GRID_LAYER_RADIUS);
          const p2 = azAltToVec3(az + 3, alt, GRID_LAYER_RADIUS);
          azGridPts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
      }
      // Azimuth meridians every 15° (North-South Local Meridian 0°/180° highlighted separately)
      for (let az = 0; az < 360; az += 15) {
        const isLocalMeridian = az === 0 || az === 180;
        const target = isLocalMeridian ? meridianPts : azGridPts;
        for (let alt = -87; alt < 87; alt += 3) {
          const p1 = azAltToVec3(az, alt, GRID_LAYER_RADIUS);
          const p2 = azAltToVec3(az, alt + 3, GRID_LAYER_RADIUS);
          target.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
      }
      const gGeom = new THREE.BufferGeometry();
      gGeom.setAttribute("position", new THREE.Float32BufferAttribute(azGridPts, 3));
      azimuthGridGroup.add(
        new THREE.LineSegments(
          gGeom,
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.20 }),
        ),
      );

      const mGeom = new THREE.BufferGeometry();
      mGeom.setAttribute("position", new THREE.Float32BufferAttribute(meridianPts, 3));
      azimuthGridGroup.add(
        new THREE.LineSegments(
          mGeom,
          new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 }),
        ),
      );
    }
    scene.add(azimuthGridGroup);

    // 3B. Precision Equatorial (RA/Dec) Coordinate Grid + Celestial Equator + Golden Ecliptic
    const equatorialGridGroup = new THREE.Group();
    equatorialGridGroup.visible = false;
    const eqGridGeom = new THREE.BufferGeometry();
    equatorialGridGroup.add(
      new THREE.LineSegments(
        eqGridGeom,
        new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.24 }),
      ),
    );
    const eqEquatorGeom = new THREE.BufferGeometry();
    equatorialGridGroup.add(
      new THREE.LineLoop(
        eqEquatorGeom,
        new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.72 }),
      ),
    );
    const eclipticGeom = new THREE.BufferGeometry();
    equatorialGridGroup.add(
      new THREE.LineLoop(
        eclipticGeom,
        new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.62 }),
      ),
    );
    scene.add(equatorialGridGroup);

    // 4. Persistent Yale BSC5 Starfield (2,887 Stars — updated in-place, zero GC)
    const starGeom = new THREE.BufferGeometry();
    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBright: { value: 1.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float aMag;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vMag;
        uniform float uBright;
        uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          vMag = aMag;
          float b = max(0.0, 5.8 - aMag);
          float ptSize = (3.0 + pow(b, 1.38) * 1.48) * uPixelRatio;
          gl_PointSize = clamp(ptSize, 2.6 * uPixelRatio, 22.0 * uPixelRatio);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vMag;
        uniform float uBright;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float core = smoothstep(0.42, 0.04, d);
          float pinpoint = exp(-d * d * 24.0);
          float halo = exp(-d * 5.0) * (vMag < 2.2 ? 0.58 : 0.22);
          // In daytime Atmosphere mode (uBright < 0.7), keep bright stars (mag < 3.6) crisp & legible on blue sky
          float dayMagMask = (uBright < 0.7) ? smoothstep(4.2, 1.6, vMag) : 1.0;
          float effectiveBright = mix(uBright * 0.45, max(uBright, 0.88), dayMagMask);
          float alpha = clamp((core * 0.90 + pinpoint * 0.62 + halo) * effectiveBright, 0.0, 1.0);
          vec3 col = mix(vColor, vec3(1.0), smoothstep(0.36, 0.0, d) * 0.92);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const starPoints = new THREE.Points(starGeom, starMat);
    starPoints.frustumCulled = false;
    scene.add(starPoints);

    // 5. Persistent Constellation Lines (Normal + Highlighted)
    const normalLineGeom = new THREE.BufferGeometry();
    const normalLineMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.36,
    });
    const normalLines = new THREE.LineSegments(normalLineGeom, normalLineMat);
    normalLines.frustumCulled = false;
    scene.add(normalLines);

    const hlLineGeom = new THREE.BufferGeometry();
    const hlLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
    });
    const hlLines = new THREE.LineSegments(hlLineGeom, hlLineMat);
    hlLines.frustumCulled = false;
    scene.add(hlLines);

    // 6. Cached Constellation Mythological Artworks (Exact Precessed J2000 -> HOR)
    const artGroup = new THREE.Group();
    scene.add(artGroup);
    const artCache = new Map<
      string,
      {
        mesh: THREE.Mesh;
        geom: THREE.BufferGeometry;
        mat: THREE.MeshBasicMaterial;
        grid: { ra: number; dec: number }[];
      }
    >();
    const ART_SEGS = 10;

    function getOrCreateArtEntry(key: string, file: string, mapper: ArtworkMapper) {
      const existing = artCache.get(key);
      if (existing) return existing;
      const grid: { ra: number; dec: number }[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let j = 0; j <= ART_SEGS; j++) {
        const v = j / ART_SEGS;
        for (let i = 0; i <= ART_SEGS; i++) {
          const u = i / ART_SEGS;
          grid.push(mapper.toRaDec(u, v));
          // Anchor UVs already use WebGL bottom-up convention (v = 1 - y/512)
          uvs.push(u, v);
        }
      }
      const stride = ART_SEGS + 1;
      for (let j = 0; j < ART_SEGS; j++) {
        for (let i = 0; i < ART_SEGS; i++) {
          const a = j * stride + i;
          const b = a + 1;
          const c = a + stride;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(grid.length * 3), 3));
      geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);

      const tex = texLoader.load(`/textures/constellations/${file}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: 0x7dd3fc,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.frustumCulled = false;
      const entry = { mesh, geom, mat, grid };
      artCache.set(key, entry);
      return entry;
    }

    // 7. Persistent Deep Sky Nebulae Group
    const nebulaeGroup = new THREE.Group();
    scene.add(nebulaeGroup);
    const nebulaSpriteMap = new Map<string, THREE.Sprite>();

    // 8. Persistent Distortion-Free Billboarded Solar System Bodies (1:1 Circle Everywhere)
    const bodiesGroup = new THREE.Group();
    scene.add(bodiesGroup);
    const unitPlane = new THREE.PlaneGeometry(1, 1);

    // Sun (unified photosphere + soft seamless corona — rendered behind Moon during eclipses)
    const sunTex = texLoader.load("/textures/planets/hd/sun.webp");
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const sunMat = createBillboardSphereMaterial(sunTex, {
      size: 62,
      glowColor: "#fde68a",
      mode: "sun",
      glowStrength: 0.85,
    });
    const sunMesh = new THREE.Mesh(unitPlane, sunMat);
    sunMesh.frustumCulled = false;
    sunMesh.renderOrder = 10;
    bodiesGroup.add(sunMesh);

    // Moon (real-time phase shader on distortion-free view-space billboard — renders IN FRONT of Sun for true eclipses!)
    // Angular disc parity: Sun 62 * 0.22 = 13.64 vs Moon 46 * 0.30 = 13.80 (matching ~0.52° real sky diameter)
    const moonTex = texLoader.load("/textures/planets/hd/moon.webp");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMat = createBillboardSphereMaterial(moonTex, {
      size: 46,
      glowColor: "#e2e8f0",
      mode: "moon",
      glowStrength: 0.42,
    });
    const moonMesh = new THREE.Mesh(unitPlane, moonMat);
    moonMesh.frustumCulled = false;
    moonMesh.renderOrder = 12;
    bodiesGroup.add(moonMesh);

    // 7 Planets (+10% enlarged, distortion-free 3D shaded billboards — zero stretching at screen edges!)
    const planetSpecs: Record<string, { size: number; tex: string; glow: string; saturn?: boolean }> = {
      mercury: { size: 15.4, tex: "/textures/planets/hd/mercury.webp", glow: "#cbd5e1" },
      venus: { size: 22.0, tex: "/textures/planets/hd/venus.webp", glow: "#fef08a" },
      mars: { size: 18.7, tex: "/textures/planets/hd/mars.webp", glow: "#f87171" },
      jupiter: { size: 26.4, tex: "/textures/planets/hd/jupiter.webp", glow: "#fcd34d" },
      saturn: { size: 33.0, tex: "/textures/planets/hd/saturn.webp", glow: "#fed7aa", saturn: true },
      uranus: { size: 17.6, tex: "/textures/planets/hd/uranus.webp", glow: "#7dd3fc" },
      neptune: { size: 17.6, tex: "/textures/planets/hd/neptune.webp", glow: "#818cf8" },
    };
    const planetMeshes: Record<string, { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; baseSize: number }> = {};
    for (const [id, spec] of Object.entries(planetSpecs)) {
      const pTex = texLoader.load(spec.tex);
      pTex.colorSpace = THREE.SRGBColorSpace;
      const pMat = createBillboardSphereMaterial(pTex, {
        size: spec.size,
        glowColor: spec.glow,
        mode: spec.saturn ? "saturn" : "planet",
        glowStrength: 0.42,
      });
      const pMesh = new THREE.Mesh(unitPlane, pMat);
      pMesh.frustumCulled = false;
      bodiesGroup.add(pMesh);
      planetMeshes[id] = { mesh: pMesh, mat: pMat, baseSize: spec.size };
    }

    // 9. Persistent Live Satellites Group (Crisp Tilted Spacecraft Icon Shader w/ Solar Panels + Glowing Core)
    const satellitesGroup = new THREE.Group();
    scene.add(satellitesGroup);
    const satPointsGeom = new THREE.BufferGeometry();
    const satPointsMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          gl_PointSize = aSize * uPixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        // Signed distance to a rounded box
        float sdRoundBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + r;
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          // Rotate 45 deg so solar panels span top-left to bottom-right cleanly
          float c = 0.70710678;
          vec2 p = vec2(uv.x * c + uv.y * c, -uv.x * c + uv.y * c);

          // Central spacecraft bus (rounded diamond/square)
          float dBus = sdRoundBox(p, vec2(0.115, 0.115), 0.032);
          // Left & right solar panel wings separated cleanly from center bus
          float dWingL = sdRoundBox(p - vec2(-0.275, 0.0), vec2(0.125, 0.068), 0.025);
          float dWingR = sdRoundBox(p - vec2( 0.275, 0.0), vec2(0.125, 0.068), 0.025);
          float dBody = min(dBus, min(dWingL, dWingR));

          float shapeAlpha = smoothstep(0.022, -0.014, dBody);
          // Soft outer glow around the spacecraft
          float glow = exp(-max(dBody, 0.0) * 14.0) * 0.28;
          float totalAlpha = clamp(max(shapeAlpha * 0.96, glow), 0.0, 1.0);
          if (totalAlpha < 0.015) discard;

          // Bright white circular core inside the central bus
          float core = smoothstep(0.068, 0.028, length(p));
          vec3 col = mix(vColor, vec3(1.0), core * 0.98);
          gl_FragColor = vec4(col, totalAlpha);
        }
      `,
    });
    const satPoints = new THREE.Points(satPointsGeom, satPointsMat);
    satPoints.frustumCulled = false;
    satellitesGroup.add(satPoints);

    const satTrailsGeom = new THREE.BufferGeometry();
    const satTrailsMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.35,
    });
    const satTrails = new THREE.LineSegments(satTrailsGeom, satTrailsMat);
    satTrails.frustumCulled = false;
    satellitesGroup.add(satTrails);

    // ── Sync Function (runs ONLY when skyDataVersionRef changes, NEVER 60x/s!) ──
    let lastSyncedVersion = -1;

    const syncSkyGeometry = () => {
      const {
        solarState: sol,
        eqjToHorRot: rot,
        horToGalRot: h2g,
        topoStars: stars,
        topoMoon: moon,
        topoPlanets: planets,
        constellations: cstl,
        topoNebulae: nebs,
        topoSats: sats,
      } = astroRef.current;
      const t = togglesRef.current;
      const sel = selectedTargetRef.current;

      // Sky dome uniforms (true sRGB colors converted to linear by THREE.Color & gamma-encoded in shader)
      const alt = sol.altitudeDeg;
      const zCol = new THREE.Color();
      const mCol = new THREE.Color();
      const hCol = new THREE.Color();

      if (alt <= -18) {
        zCol.set("#030712");
        mCol.set("#070f21");
        hCol.set("#0c172b");
      } else if (alt <= -12) {
        const k = (alt + 18) / 6;
        zCol.set("#030712").lerp(new THREE.Color("#071126"), k);
        mCol.set("#070f21").lerp(new THREE.Color("#102042"), k);
        hCol.set("#0c172b").lerp(new THREE.Color("#223257"), k);
      } else if (alt <= -6) {
        const k = (alt + 12) / 6;
        zCol.set("#071126").lerp(new THREE.Color("#0e2554"), k);
        mCol.set("#102042").lerp(new THREE.Color("#244c8a"), k);
        hCol.set("#223257").lerp(new THREE.Color("#734254"), k);
      } else if (alt <= 0) {
        const k = (alt + 6) / 6;
        zCol.set("#0e2554").lerp(new THREE.Color("#1a4c9c"), k);
        mCol.set("#244c8a").lerp(new THREE.Color("#3c82d4"), k);
        hCol.set("#734254").lerp(new THREE.Color("#e08b5a"), k);
      } else if (alt <= 12) {
        const k = alt / 12;
        zCol.set("#1a4c9c").lerp(new THREE.Color("#1b60c2"), k);
        mCol.set("#3c82d4").lerp(new THREE.Color("#4ca0ee"), k);
        hCol.set("#e08b5a").lerp(new THREE.Color("#b8ddff"), k);
      } else {
        zCol.set("#1b60c2");
        mCol.set("#4ca0ee");
        hCol.set("#b8ddff");
      }

      // Real-time Total Solar Eclipse detection from exact topocentric Sun–Moon separation
      const dAltSm = sol.altitudeDeg - moon.altitudeDeg;
      const dAzSm = ((((sol.azimuthDeg - moon.azimuthDeg + 540) % 360) - 180)) * Math.cos(sol.altitudeDeg * DEG2RAD);
      const sunMoonSepDeg = Math.hypot(dAltSm, dAzSm);
      const eclipseTotality =
        sol.altitudeDeg > -1 && sunMoonSepDeg < 0.5
          ? Math.max(0, Math.min(1, (0.5 - sunMoonSepDeg) / 0.42))
          : 0;

      skyDomeMat.uniforms.uZenith.value.copy(zCol);
      skyDomeMat.uniforms.uMid.value.copy(mCol);
      skyDomeMat.uniforms.uHorizon.value.copy(hCol);
      skyDomeMat.uniforms.uSunDir.value.copy(azAltToVec3(sol.azimuthDeg, sol.altitudeDeg, 1).normalize());
      skyDomeMat.uniforms.uSunAlt.value = sol.altitudeDeg;
      skyDomeMat.uniforms.uEclipseTotality.value = eclipseTotality;
      skyDomeMat.uniforms.uShowAtmosphere.value = t.showAtmosphere ? 1.0 : 0.0;
      skyDomeMat.uniforms.uShowMilkyWay.value = t.showMilkyWay ? 1.0 : 0.0;
      // astronomy-engine RotationMatrix applies rot^T * v, so transpose into Matrix3.set (row-major)
      skyDomeMat.uniforms.uHorToGal.value.set(
        h2g[0][0], h2g[1][0], h2g[2][0],
        h2g[0][1], h2g[1][1], h2g[2][1],
        h2g[0][2], h2g[1][2], h2g[2][2],
      );

      // Landscape lighting (bright sunlit daytime even with Atmosphere OFF) & Dual Coordinate Grids visibility
      landscapeGroup.visible = t.showGround;
      landscapeMat.uniforms.uSunAlt.value = sol.altitudeDeg;
      landscapeMat.uniforms.uEclipseTotality.value = eclipseTotality;
      landscapeMat.uniforms.uShowAtmosphere.value = t.showAtmosphere ? 1.0 : 0.0;
      landscapeMat.uniforms.uHorizonCol.value.copy(hCol);
      horizRing.visible = !t.showGround;
      horizRingMat.opacity = 0.28;
      azimuthGridGroup.visible = t.showAzimuthGrid;
      equatorialGridGroup.visible = t.showEquatorialGrid;

      // Update Precision Equatorial Grid (RA/Dec + Celestial Equator + Golden Ecliptic) via exact Rotation_EQJ_HOR
      if (t.showEquatorialGrid) {
        const eqPts: number[] = [];
        // Declination parallels every 15° (-75°..+75°, excluding 0° Celestial Equator drawn separately)
        for (let dec = -75; dec <= 75; dec += 15) {
          if (dec === 0) continue;
          for (let ra = 0; ra < 360; ra += 4) {
            const p1 = projectJ2000ToHorizontal(ra, dec, rot, GRID_LAYER_RADIUS, true);
            const p2 = projectJ2000ToHorizontal(ra + 4, dec, rot, GRID_LAYER_RADIUS, true);
            eqPts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
          }
        }
        // Right Ascension hour circles every 1h (15°), from -84° to +84°
        for (let ra = 0; ra < 360; ra += 15) {
          for (let dec = -84; dec < 84; dec += 4) {
            const p1 = projectJ2000ToHorizontal(ra, dec, rot, GRID_LAYER_RADIUS, true);
            const p2 = projectJ2000ToHorizontal(ra, dec + 4, rot, GRID_LAYER_RADIUS, true);
            eqPts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
          }
        }
        eqGridGeom.setAttribute("position", new THREE.Float32BufferAttribute(eqPts, 3));

        // Highlighted Celestial Equator (Dec = 0°)
        const eqRingPts: number[] = [];
        for (let ra = 0; ra < 360; ra += 2) {
          const p = projectJ2000ToHorizontal(ra, 0, rot, GRID_LAYER_RADIUS, true);
          eqRingPts.push(p.x, p.y, p.z);
        }
        eqEquatorGeom.setAttribute("position", new THREE.Float32BufferAttribute(eqRingPts, 3));

        // Golden Ecliptic Plane (obliquity 23.439291° in J2000 -> HOR)
        const eps = 23.439291 * DEG2RAD;
        const eclPts: number[] = [];
        for (let lamDeg = 0; lamDeg < 360; lamDeg += 3) {
          const lam = lamDeg * DEG2RAD;
          const x = Math.cos(lam);
          const y = Math.sin(lam) * Math.cos(eps);
          const z = Math.sin(lam) * Math.sin(eps);
          const ra = (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
          const dec = (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI;
          const p = projectJ2000ToHorizontal(ra, dec, rot, GRID_LAYER_RADIUS, true);
          eclPts.push(p.x, p.y, p.z);
        }
        eclipticGeom.setAttribute("position", new THREE.Float32BufferAttribute(eclPts, 3));
      }

      // Daylight star dimming when atmosphere is enabled (bright constellation stars remain clearly visible!)
      const isBrightDay = t.showAtmosphere && sol.altitudeDeg > 0 && eclipseTotality < 0.7;
      starMat.uniforms.uBright.value = isBrightDay
        ? 0.52
        : t.showAtmosphere && sol.altitudeDeg > -12 && eclipseTotality < 0.7
          ? 0.78
          : 1.0;

      // Update Stars buffer in-place
      const sPos = new Float32Array(stars.length * 3);
      const sCol = new Float32Array(stars.length * 3);
      const sMag = new Float32Array(stars.length);
      const tmpColor = new THREE.Color();
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        sPos[i * 3] = st.pos3D.x;
        sPos[i * 3 + 1] = st.pos3D.y;
        sPos[i * 3 + 2] = st.pos3D.z;
        tmpColor.set(st.colorHex);
        sCol[i * 3] = tmpColor.r;
        sCol[i * 3 + 1] = tmpColor.g;
        sCol[i * 3 + 2] = tmpColor.b;
        sMag[i] = st.mag;
      }
      starGeom.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
      starGeom.setAttribute("aColor", new THREE.BufferAttribute(sCol, 3));
      starGeom.setAttribute("aMag", new THREE.BufferAttribute(sMag, 1));

      // Update Constellation Stick Figures (single clean 3D pass!) & Artworks
      artGroup.clear();
      if (t.showConstellations) {
        const normArr: number[] = [];
        const hlArr: number[] = [];
        const isSelConstel = sel?.type === "constellation";

        for (const con of cstl) {
          const isThisSel =
            isSelConstel &&
            (sel?.id.toLowerCase() === con.abbreviation.toLowerCase() ||
              sel?.name.toLowerCase() === con.name.toLowerCase());

          for (const seg of con.segments) {
            const targetArr = isThisSel ? hlArr : normArr;
            targetArr.push(
              seg[0].x, seg[0].y, seg[0].z,
              seg[1].x, seg[1].y, seg[1].z,
            );
          }

          // Constellation Artwork aligned via exact precessed J2000 -> HOR
          const isArgoSub = con.abbreviation === "Pup" || con.abbreviation === "Vel";
          if ((t.showArt || isThisSel) && (!isArgoSub || isThisSel)) {
            const artKey = isArgoSub ? "Car" : con.abbreviation || con.name;
            const prof = getConstellationProfile(artKey);
            const mapper = getArtworkMapper(artKey, prof);
            const artFile =
              prof?.artworkFile ||
              (isArgoSub ? "argonavis.webp" : `${con.name.toLowerCase().replace(/\s+/g, "-")}.webp`);
            if (mapper) {
              const entry = getOrCreateArtEntry(artKey.toLowerCase(), artFile, mapper);
              const posAttr = entry.geom.getAttribute("position") as THREE.BufferAttribute;
              for (let k = 0; k < entry.grid.length; k++) {
                const g = entry.grid[k];
                const p = projectJ2000ToHorizontal(g.ra, g.dec, rot, CONSTELLATION_ART_RADIUS, true);
                posAttr.setXYZ(k, p.x, p.y, p.z);
              }
              posAttr.needsUpdate = true;
              entry.mat.opacity = isThisSel ? 0.85 : isBrightDay ? 0.14 : 0.34;
              entry.mat.color.set(isThisSel ? 0x38bdf8 : 0x7dd3fc);
              artGroup.add(entry.mesh);
            }
          }
        }

        normalLineGeom.setAttribute("position", new THREE.Float32BufferAttribute(normArr, 3));
        hlLineGeom.setAttribute("position", new THREE.Float32BufferAttribute(hlArr, 3));
        normalLineMat.color.set(isBrightDay ? 0xe0f2fe : 0x7dd3fc);
        normalLineMat.opacity = isBrightDay ? 0.44 : 0.38;
        normalLines.visible = true;
        hlLines.visible = hlArr.length > 0;
      } else {
        normalLines.visible = false;
        hlLines.visible = false;
      }

      // Update Deep Sky Nebulae sprites (reused from map!)
      nebulaeGroup.visible = t.showNebulae;
      if (t.showNebulae) {
        for (const neb of nebs) {
          let spr = nebulaSpriteMap.get(neb.id);
          if (!spr) {
            spr = new THREE.Sprite(
              new THREE.SpriteMaterial({
                map: getRadialGlowTexture(neb.colorHex, neb.secondaryColorHex),
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                opacity: 0.78,
              }),
            );
            const sc = neb.type === "galaxy" ? 34 : neb.type === "planetary_nebula" ? 20 : 28;
            spr.scale.set(sc, sc, 1);
            nebulaeGroup.add(spr);
            nebulaSpriteMap.set(neb.id, spr);
          }
          spr.position.set(neb.pos3D.x, neb.pos3D.y, neb.pos3D.z);
          (spr.material as THREE.SpriteMaterial).opacity = isBrightDay ? 0.2 : 0.78;
        }
      }

      // Update Solar System Bodies (distortion-free 1:1 circular billboards)
      bodiesGroup.visible = t.showBodies;
      if (t.showBodies) {
        moonMesh.position.set(moon.pos3D.x, moon.pos3D.y, moon.pos3D.z);
        moonMat.uniforms.uPhaseRad.value = ((moon.phaseDeg ?? 180) * DEG2RAD);
        moonMat.uniforms.uGlowStrength.value = Math.max(0.15, (moon.illuminationFraction ?? 0.5) * 0.55);
        moonMat.uniforms.uDayFade.value = isBrightDay ? 0.45 : 1.0;

        const sunPos = azAltToVec3(sol.azimuthDeg, sol.altitudeDeg, BODY_LAYER_RADIUS);
        sunMesh.position.copy(sunPos);
        sunMat.uniforms.uGlowStrength.value = t.showAtmosphere ? 0.92 : 0.72;

        for (const p of planets) {
          const entry = planetMeshes[p.id];
          if (entry) {
            entry.mesh.position.set(p.pos3D.x, p.pos3D.y, p.pos3D.z);
            entry.mat.uniforms.uDayFade.value = isBrightDay ? 0.35 : 1.0;
          }
        }
      }

      // Update Live Satellites
      satellitesGroup.visible = t.showSatellites;
      if (t.showSatellites && sats.satellites.length > 0) {
        const satPos = new Float32Array(sats.satellites.length * 3);
        const satCol = new Float32Array(sats.satellites.length * 3);
        const satSizes = new Float32Array(sats.satellites.length);
        const trailPos: number[] = [];
        const cTmp = new THREE.Color();

        for (let i = 0; i < sats.satellites.length; i++) {
          const s = sats.satellites[i];
          const v = azAltToVec3(s.azimuthDeg, s.altitudeDeg, SATELLITE_LAYER_RADIUS);
          satPos[i * 3] = v.x;
          satPos[i * 3 + 1] = v.y;
          satPos[i * 3 + 2] = v.z;
          // Crisp emerald-green spacecraft tint matching user's preferred icon, keeping telescope/station distinction
          const iconColor = s.category === "telescope" ? "#38bdf8" : "#4ade80";
          cTmp.set(iconColor);
          satCol[i * 3] = cTmp.r;
          satCol[i * 3 + 1] = cTmp.g;
          satCol[i * 3 + 2] = cTmp.b;
          satSizes[i] =
            s.category === "station"
              ? 28
              : s.category === "telescope"
                ? 24
                : sel?.id === s.id
                  ? 26
                  : 18;

          if (s.trail && s.trail.length >= 2) {
            for (let k = 0; k < s.trail.length - 1; k++) {
              const pA = azAltToVec3(s.trail[k].az, s.trail[k].alt, SATELLITE_LAYER_RADIUS);
              const pB = azAltToVec3(s.trail[k + 1].az, s.trail[k + 1].alt, SATELLITE_LAYER_RADIUS);
              trailPos.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
            }
          }
        }

        satPointsGeom.setAttribute("position", new THREE.BufferAttribute(satPos, 3));
        satPointsGeom.setAttribute("aColor", new THREE.BufferAttribute(satCol, 3));
        satPointsGeom.setAttribute("aSize", new THREE.BufferAttribute(satSizes, 1));
        satTrailsGeom.setAttribute("position", new THREE.Float32BufferAttribute(trailPos, 3));
      }
    };

    // ── Pointer Drag / Pinch / Wheel / Click Picking ─────────────────────────
    const dom = renderer.domElement;
    let isDragging = false;
    let movedDist = 0;
    let lastX = 0;
    let lastY = 0;
    let pinchDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      movedDist = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      cameraAnimRef.current = null;
      camVelRef.current = { az: 0, alt: 0 };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      movedDist += Math.hypot(dx, dy);

      // Natural grab-the-sky Stellarium sensitivity scaled by FOV
      const sens = (camFovRef.current / 70) * 0.16;
      const dAz = -dx * sens;
      const dAlt = dy * sens;

      camAzRef.current = (((camAzRef.current + dAz) % 360) + 360) % 360;
      const minAlt = togglesRef.current.showGround ? -22 : -88;
      camAltRef.current = Math.max(minAlt, Math.min(89, camAltRef.current + dAlt));
      camVelRef.current = { az: dAz * 0.65, alt: dAlt * 0.65 };
    };

    const pickTargetAt = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const w = rect.width;
      const h = rect.height;

      const project = (az: number, alt: number, r: number) => {
        const v = azAltToVec3(az, alt, r);
        v.project(camera);
        if (v.z > 1) return null;
        return { x: ((v.x + 1) / 2) * w, y: ((-v.y + 1) / 2) * h };
      };

      const { solarState: sol, topoMoon: moon, topoPlanets: planets, topoStars: stars, topoNebulae: nebs, constellations: cstl, topoSats: sats } =
        astroRef.current;
      const t = togglesRef.current;

      let bestDist = 30;
      let best: SelectedSkyTarget | null = null;

      // 1. Sun & Moon & Planets (highest priority)
      if (t.showBodies) {
        const pSun = project(sol.azimuthDeg, sol.altitudeDeg, BODY_LAYER_RADIUS);
        if (pSun) {
          const d = Math.hypot(pSun.x - sx, pSun.y - sy);
          if (d < bestDist) {
            bestDist = d;
            best = { id: "sun", name: "Sun", type: "sun", azimuthDeg: sol.azimuthDeg, altitudeDeg: sol.altitudeDeg, mag: -26.74, colorHex: "#fef08a" };
          }
        }
        const pMoon = project(moon.azimuthDeg, moon.altitudeDeg, BODY_LAYER_RADIUS);
        if (pMoon) {
          const d = Math.hypot(pMoon.x - sx, pMoon.y - sy);
          if (d < bestDist) {
            bestDist = d;
            best = {
              id: "moon",
              name: "Moon",
              type: "moon",
              azimuthDeg: moon.azimuthDeg,
              altitudeDeg: moon.altitudeDeg,
              raDeg: moon.raDeg,
              decDeg: moon.decDeg,
              mag: moon.mag,
              colorHex: "#f8fafc",
              phaseDeg: moon.phaseDeg,
              illuminationFraction: moon.illuminationFraction,
            };
          }
        }
        for (const p of planets) {
          const pp = project(p.azimuthDeg, p.altitudeDeg, BODY_LAYER_RADIUS);
          if (!pp) continue;
          const d = Math.hypot(pp.x - sx, pp.y - sy);
          if (d < bestDist) {
            bestDist = d;
            best = { id: p.id, name: p.name, type: "planet", azimuthDeg: p.azimuthDeg, altitudeDeg: p.altitudeDeg, raDeg: p.raDeg, decDeg: p.decDeg, mag: p.mag, colorHex: p.colorHex };
          }
        }
      }

      // 2. Satellites
      if (t.showSatellites && !best) {
        for (const sat of sats.satellites) {
          const ps = project(sat.azimuthDeg, sat.altitudeDeg, SATELLITE_LAYER_RADIUS);
          if (!ps) continue;
          const d = Math.hypot(ps.x - sx, ps.y - sy);
          if (d < 20 && d < bestDist) {
            bestDist = d;
            best = { id: sat.id, name: sat.name, type: "satellite", azimuthDeg: sat.azimuthDeg, altitudeDeg: sat.altitudeDeg, mag: 1, colorHex: sat.colorHex, satelliteInfo: sat };
          }
        }
      }

      // 3. Nebulae / Deep Sky
      if (t.showNebulae && !best) {
        for (const neb of nebs) {
          const pn = project(neb.azimuthDeg, neb.altitudeDeg, NEBULA_LAYER_RADIUS);
          if (!pn) continue;
          const d = Math.hypot(pn.x - sx, pn.y - sy);
          if (d < 24 && d < bestDist) {
            bestDist = d;
            best = { id: neb.id, name: neb.name, type: "nebula", azimuthDeg: neb.azimuthDeg, altitudeDeg: neb.altitudeDeg, raDeg: neb.raDeg, decDeg: neb.decDeg, mag: neb.mag, colorHex: neb.colorHex, nebulaInfo: neb };
          }
        }
      }

      // 4. Bright Stars
      if (!best) {
        for (const st of stars) {
          if (st.mag > 3.8) continue;
          const ps = project(st.azimuthDeg, st.altitudeDeg, STAR_LAYER_RADIUS);
          if (!ps) continue;
          const d = Math.hypot(ps.x - sx, ps.y - sy);
          if (d < 18 && d < bestDist) {
            bestDist = d;
            best = { id: st.id, name: st.name, type: "star", azimuthDeg: st.azimuthDeg, altitudeDeg: st.altitudeDeg, raDeg: st.raDeg, decDeg: st.decDeg, mag: st.mag, colorHex: st.colorHex };
          }
        }
      }

      // 5. Constellations (label center or stick segments)
      if (t.showConstellations && !best) {
        let bestConDist = 34;
        for (const con of cstl) {
          const pc = project(con.centerAzDeg, con.centerAltDeg, CONSTELLATION_LAYER_RADIUS);
          if (pc) {
            const d = Math.hypot(pc.x - sx, pc.y - sy);
            if (d < bestConDist) {
              bestConDist = d;
              const prof = getConstellationProfile(con.abbreviation || con.name) ?? undefined;
              best = {
                id: con.abbreviation.toLowerCase(),
                name: con.name,
                type: "constellation",
                azimuthDeg: con.centerAzDeg,
                altitudeDeg: con.centerAltDeg,
                raDeg: con.centerRaDeg,
                decDeg: con.centerDecDeg,
                mag: NaN,
                colorHex: "#38bdf8",
                constellationProfile: prof,
              };
            }
          }
        }
      }

      setSelectedTarget(best);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragging && movedDist < 6) {
        pickTargetAt(e.clientX, e.clientY);
      }
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camFovRef.current = Math.max(12, Math.min(86, camFovRef.current + e.deltaY * 0.04));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const factor = pinchDist / Math.max(1, d);
        camFovRef.current = Math.max(12, Math.min(86, camFovRef.current * factor));
        pinchDist = d;
      }
    };

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    dom.addEventListener("touchmove", onTouchMove, { passive: true });

    const onResize = () => {
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // ── Main 60 FPS Render Loop ──────────────────────────────────────────────
    let rafId = 0;
    let lastHudUpdate = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // Sync heavy astronomical geometry ONLY when data/toggles changed
      if (lastSyncedVersion !== skyDataVersionRef.current) {
        syncSkyGeometry();
        lastSyncedVersion = skyDataVersionRef.current;
      }

      // Smooth Fly-To Animation OR Inertial Damping
      if (cameraAnimRef.current) {
        const a = cameraAnimRef.current;
        const p = Math.min(1, (performance.now() - a.startTime) / a.duration);
        const ease = 1 - Math.pow(1 - p, 3);
        camAzRef.current = (((a.startAz + (a.targetAz - a.startAz) * ease) % 360) + 360) % 360;
        camAltRef.current = a.startAlt + (a.targetAlt - a.startAlt) * ease;
        if (p >= 1) cameraAnimRef.current = null;
      } else if (!isDragging && (Math.abs(camVelRef.current.az) > 0.004 || Math.abs(camVelRef.current.alt) > 0.004)) {
        camAzRef.current = (((camAzRef.current + camVelRef.current.az) % 360) + 360) % 360;
        const minAlt = togglesRef.current.showGround ? -22 : -88;
        camAltRef.current = Math.max(minAlt, Math.min(89, camAltRef.current + camVelRef.current.alt));
        camVelRef.current.az *= 0.88;
        camVelRef.current.alt *= 0.88;
      }

      // Update Three.js camera
      const lookTarget = azAltToVec3(camAzRef.current, camAltRef.current, 1);
      camera.fov = camFovRef.current;
      camera.updateProjectionMatrix();
      camera.lookAt(lookTarget);

      renderer.render(scene, camera);

      // Throttled HUD telemetry update (~10 Hz)
      const nowPerf = performance.now();
      if (nowPerf - lastHudUpdate > 100) {
        lastHudUpdate = nowPerf;
        setHudTelemetry({
          az: Math.round(camAzRef.current) % 360,
          alt: Math.round(camAltRef.current * 10) / 10,
          fov: Math.round(camFovRef.current),
        });
      }

      // ── 2D Crisp Overlay Canvas (Typography, Compass, Reticle) ─────────────
      const ov = overlayRef.current;
      if (!ov) return;
      const ctx = ov.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = ov.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) {
        ov.width = Math.round(w * dpr);
        ov.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.clearRect(0, 0, ov.width, ov.height);
      ctx.scale(dpr, dpr);

      const proj = (az: number, alt: number, r: number) => {
        const v = azAltToVec3(az, alt, r);
        v.project(camera);
        if (v.z > 1) return null;
        const x = ((v.x + 1) / 2) * w;
        const y = ((-v.y + 1) / 2) * h;
        if (x < -80 || x > w + 80 || y < -80 || y > h + 80) return null;
        return { x, y };
      };

      const t = togglesRef.current;
      const {
        solarState: sol,
        topoMoon: moon,
        topoPlanets: planets,
        topoStars: stars,
        constellations: cstl,
        topoNebulae: nebs,
        topoSats: sats,
      } = astroRef.current;
      const sel = selectedTargetRef.current;

      // 1. Cardinal & Intercardinal Compass Markers along Horizon
      const cardinals = [
        { az: 0, label: "N", primary: true },
        { az: 45, label: "NE", primary: false },
        { az: 90, label: "E", primary: true },
        { az: 135, label: "SE", primary: false },
        { az: 180, label: "S", primary: true },
        { az: 225, label: "SW", primary: false },
        { az: 270, label: "W", primary: true },
        { az: 315, label: "NW", primary: false },
      ];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const c of cardinals) {
        const p = proj(c.az, 0.8, GROUND_RADIUS);
        if (!p) continue;
        ctx.font = c.primary
          ? "700 13px ui-monospace, SFMono-Regular, monospace"
          : "600 10px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = c.az === 0 ? "rgba(248, 113, 113, 0.98)" : c.primary ? "rgba(248, 250, 252, 0.95)" : "rgba(226, 232, 240, 0.78)";
        ctx.shadowColor = "rgba(0,0,0,0.95)";
        ctx.shadowBlur = 5;
        ctx.fillText(c.label, p.x, p.y);
      }

      // 1B. Precision Azimuthal Grid Labels (Degrees & Zenith)
      if (t.showAzimuthGrid) {
        ctx.font = "500 9px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = "rgba(56, 189, 248, 0.78)";
        ctx.textAlign = "center";
        for (let az = 0; az < 360; az += 30) {
          const p = proj(az, 2.6, GRID_LAYER_RADIUS);
          if (p) ctx.fillText(`${az}°`, p.x, p.y);
        }
        for (let alt = 15; alt <= 75; alt += 15) {
          for (const az of [0, 90, 180, 270]) {
            const p = proj(az, alt, GRID_LAYER_RADIUS);
            if (p) ctx.fillText(`+${alt}°`, p.x, p.y);
          }
        }
        const pZen = proj(0, 89.9, GRID_LAYER_RADIUS);
        if (pZen) {
          ctx.fillStyle = "rgba(34, 211, 238, 0.95)";
          ctx.fillText("ZENITH +90°", pZen.x, pZen.y);
        }
      }

      // 1C. Precision Equatorial Grid Labels (RA Hours, Celestial Equator, Dec, NCP/SCP)
      if (t.showEquatorialGrid) {
        const rot = astroRef.current.eqjToHorRot;
        ctx.font = "500 9px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "center";
        for (let hr = 0; hr < 24; hr += 2) {
          const eqPt = projectJ2000ToHorizontal(hr * 15, 0, rot, GRID_LAYER_RADIUS, true);
          if (t.showGround && eqPt.altDeg < 0) continue;
          const p = proj(eqPt.azDeg, eqPt.altDeg, GRID_LAYER_RADIUS);
          if (p) {
            ctx.fillStyle = "rgba(96, 165, 250, 0.92)";
            ctx.fillText(`${hr}h`, p.x, p.y - 6);
          }
        }
        for (const dec of [-60, -30, 30, 60]) {
          for (let hr = 0; hr < 24; hr += 6) {
            const eqPt = projectJ2000ToHorizontal(hr * 15, dec, rot, GRID_LAYER_RADIUS, true);
            if (t.showGround && eqPt.altDeg < 0) continue;
            const p = proj(eqPt.azDeg, eqPt.altDeg, GRID_LAYER_RADIUS);
            if (p) {
              ctx.fillStyle = "rgba(129, 140, 248, 0.78)";
              ctx.fillText(`${dec > 0 ? "+" : ""}${dec}°`, p.x, p.y);
            }
          }
        }
        for (const [label, dec] of [["NCP +90°", 89.95], ["SCP -90°", -89.95]] as const) {
          const pole = projectJ2000ToHorizontal(0, dec, rot, GRID_LAYER_RADIUS, true);
          if (t.showGround && pole.altDeg < -2) continue;
          const p = proj(pole.azDeg, pole.altDeg, GRID_LAYER_RADIUS);
          if (p) {
            ctx.fillStyle = "rgba(165, 180, 252, 0.96)";
            ctx.fillText(label, p.x, p.y);
          }
        }
      }

      // 2. Constellation Labels
      if (t.showConstellations && t.showNames) {
        ctx.font = "500 10.5px system-ui, -apple-system, sans-serif";
        ctx.shadowColor = "rgba(2, 6, 23, 0.92)";
        ctx.shadowBlur = 4;
        for (const con of cstl) {
          if (t.showGround && con.centerAltDeg < -2) continue;
          const p = proj(con.centerAzDeg, con.centerAltDeg, CONSTELLATION_LAYER_RADIUS);
          if (!p) continue;
          const isSel =
            sel?.type === "constellation" &&
            sel.id.toLowerCase() === con.abbreviation.toLowerCase();
          ctx.fillStyle = isSel ? "rgba(56, 189, 248, 0.98)" : "rgba(148, 197, 240, 0.68)";
          ctx.fillText(con.name.toUpperCase(), p.x, p.y);
        }
      }

      // 3. Bright Named Star Labels (decluttered by FOV & occluded cleanly behind landscape treeline)
      if (t.showNames) {
        const magCutoff = camFovRef.current < 35 ? 2.8 : camFovRef.current < 60 ? 1.8 : 1.1;
        ctx.font = "500 10px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        for (const st of stars) {
          if (st.mag > magCutoff || !st.constellation) continue;
          if (t.showGround && st.altitudeDeg < getLandscapeHorizonAlt(st.azimuthDeg) - 0.5) continue;
          const p = proj(st.azimuthDeg, st.altitudeDeg, STAR_LAYER_RADIUS);
          if (!p) continue;
          ctx.fillStyle = "rgba(226, 232, 240, 0.86)";
          ctx.fillText(st.name.split(" (")[0], p.x + 7, p.y - 2);
        }
      }

      // 4. Deep Sky Symbols & Labels (Circular / Elliptical Astronomical Markers — Zero Squares)
      if (t.showNebulae && t.showNames) {
        ctx.font = "500 9.5px ui-monospace, monospace";
        ctx.textAlign = "left";
        for (const neb of nebs) {
          if (t.showGround && neb.altitudeDeg < getLandscapeHorizonAlt(neb.azimuthDeg) - 0.5) continue;
          const p = proj(neb.azimuthDeg, neb.altitudeDeg, NEBULA_LAYER_RADIUS);
          if (!p) continue;
          ctx.strokeStyle = neb.colorHex;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          if (neb.type === "galaxy") {
            ctx.ellipse(p.x, p.y, 7, 3.5, -0.45, 0, Math.PI * 2);
          } else {
            ctx.setLineDash([2.5, 2.5]);
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(244, 180, 230, 0.82)";
          ctx.fillText(neb.name, p.x + 9, p.y + 1);
        }
      }

      // 5. Solar System Body Labels (occluded cleanly behind landscape treeline so no orphaned text sits on trees)
      if (t.showBodies && t.showNames) {
        ctx.font = "600 10.5px ui-monospace, monospace";
        ctx.textAlign = "left";

        const drawBodyLabel = (name: string, az: number, alt: number, col: string) => {
          if (t.showGround && alt < getLandscapeHorizonAlt(az) - 0.6) return;
          const p = proj(az, alt, BODY_LAYER_RADIUS);
          if (!p) return;
          ctx.fillStyle = col;
          ctx.fillText(name, p.x + 12, p.y);
        };

        drawBodyLabel("Sun", sol.azimuthDeg, sol.altitudeDeg, "#fef08a");
        drawBodyLabel("Moon", moon.azimuthDeg, moon.altitudeDeg, "#f8fafc");
        for (const pl of planets) {
          drawBodyLabel(pl.name, pl.azimuthDeg, pl.altitudeDeg, pl.colorHex);
        }
      }

      // 6. Major Space Stations & Telescopes Labels
      if (t.showSatellites && t.showNames) {
        ctx.font = "600 9.5px ui-monospace, monospace";
        ctx.textAlign = "left";
        for (const sat of sats.satellites) {
          if (sat.category !== "station" && sat.category !== "telescope" && sel?.id !== sat.id) continue;
          const p = proj(sat.azimuthDeg, sat.altitudeDeg, SATELLITE_LAYER_RADIUS);
          if (!p) continue;
          ctx.fillStyle = sat.colorHex;
          ctx.fillText(sat.name, p.x + 8, p.y);
        }
      }

      // 7. Selected Target Precision Reticle
      if (sel) {
        const p = proj(sel.azimuthDeg, sel.altitudeDeg, BODY_LAYER_RADIUS);
        if (p) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.4;
          ctx.shadowColor = "rgba(56, 189, 248, 0.8)";
          ctx.shadowBlur = 8;
          const r = 15;
          const tick = 5;
          // Four precision corner arcs/ticks
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x - r - tick, p.y); ctx.lineTo(p.x - r + 2, p.y);
          ctx.moveTo(p.x + r - 2, p.y); ctx.lineTo(p.x + r + tick, p.y);
          ctx.moveTo(p.x, p.y - r - tick); ctx.lineTo(p.x, p.y - r + 2);
          ctx.moveTo(p.x, p.y + r - 2); ctx.lineTo(p.x, p.y + r + tick);
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onTouchStart);
      dom.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, []);

  // ── Formatted Observer Local Clock ─────────────────────────────────────────
  const localClock = useMemo(
    () => formatObserverClock(observationDate, location, true),
    [observationDate, location],
  );

  const skyPhaseLabel = solarState.isDaylight
    ? "Daylight"
    : solarState.isCivilTwilight
      ? "Civil Twilight"
      : solarState.isNauticalTwilight
        ? "Nautical Twilight"
        : solarState.isAstronomicalTwilight
          ? "Astro Twilight"
          : "Night Sky";

  const handleJumpTonight = useCallback(() => {
    const tonight = getObserverLocalHourDate(observationDate, location, 21);
    setTimeOffsetMinutes(Math.round((tonight.getTime() - Date.now()) / 60000));
    setWarpSpeed(0);
  }, [observationDate, location]);

  const handleJumpToRise = useCallback(
    (hoursFromNow: number) => {
      setTimeOffsetMinutes((prev) => prev + Math.round(hoursFromNow * 60));
      setWarpSpeed(0);
      if (liveSelectedTarget) {
        setTimeout(() => flyCameraTo(liveSelectedTarget.azimuthDeg, 12), 120);
      }
    },
    [flyCameraTo, liveSelectedTarget],
  );

  const isLive = timeOffsetMinutes === 0 && warpSpeed === 0;

  return (
    <div
      className={`relative h-[100dvh] w-screen overflow-hidden bg-[#01030a] font-sans text-slate-100 select-none ${
        nightVision ? "sepia saturate-[400%] hue-rotate-[-50deg] brightness-[0.82]" : ""
      }`}
    >
      {/* ── Full-Viewport 3D WebGL Celestial Dome ─────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* ── Crisp 2D Typography & Reticle Overlay ─────────────────────────── */}
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* ── 1. Compact Corner-Pinned Luxury Top Header Bar ────────────────── */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-2 pt-2 sm:px-2.5 sm:pt-2.5">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-2">
          {/* Top-Left Corner: Ultra-Compact Unified Back + Brand Capsule */}
          <div className="flex h-8 shrink-0 items-center rounded-full border border-white/[0.10] bg-[#040916]/72 p-0.5 pr-3 backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
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
                SKY MAP
              </span>
            </div>
          </div>

          {/* Center: Interactive Observer Location & Local Clock Pills */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="group flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#040916]/72 px-3 text-[11px] backdrop-blur-2xl transition-all hover:border-sky-400/45 hover:bg-white/[0.08]"
              title="Change Observer Location or Use GPS"
            >
              <MapPin className="h-3 w-3 shrink-0 text-sky-400" />
              <span className="max-w-[120px] truncate font-medium text-white sm:max-w-[190px]">
                {location.name}
              </span>
              <span className="hidden font-mono text-[10px] text-slate-400 lg:inline tabular-nums">
                {Math.abs(location.latitude).toFixed(2)}°
                {location.latitude >= 0 ? "N" : "S"},{" "}
                {Math.abs(location.longitude).toFixed(2)}°
                {location.longitude >= 0 ? "E" : "W"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsTimeModalOpen(true)}
              className="hidden h-8 cursor-pointer items-center gap-2 rounded-full border border-white/[0.09] bg-[#040916]/68 px-3 font-mono text-[10.5px] backdrop-blur-2xl transition-all hover:border-white/25 hover:bg-white/[0.08] sm:flex"
              title="Open Date & Time Controls"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-white tabular-nums">{localClock.time}</span>
              <span className="text-[10px] text-slate-400">{localClock.tzLabel}</span>
              <span className="hidden text-white/20 xl:inline">·</span>
              <span className="hidden items-center gap-1 text-[10px] text-sky-300/90 xl:inline-flex">
                {solarState.isDaylight ? (
                  <Sun className="h-3 w-3 text-amber-300" />
                ) : (
                  <Moon className="h-3 w-3 text-sky-300" />
                )}
                {skyPhaseLabel}
              </span>
            </button>
          </div>

          {/* Right: Compact Search Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#040916]/72 px-3 text-[11px] text-slate-200 backdrop-blur-2xl transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
            title="Search Constellations, Stars, Planets, Deep Sky (⌘K)"
          >
            <Search className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-slate-400 md:inline">
              ⌘K
            </kbd>
          </button>
        </div>
      </header>

      {/* ── Daytime Helper Pill (Only when Daylight + Atmosphere ON) ──────── */}
      {solarState.isDaylight && showAtmosphere && !liveSelectedTarget && (
        <div className="pointer-events-auto fixed top-18 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.11] bg-[#040916]/78 py-1.5 pr-2 pl-3.5 text-[11px] text-slate-200 shadow-lg backdrop-blur-xl">
            <Sun className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden whitespace-nowrap sm:inline">
              Daylight at {location.name}
            </span>
            <button
              type="button"
              onClick={handleJumpTonight}
              className="cursor-pointer rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-950 transition-colors hover:bg-slate-200"
            >
              Tonight 21:00
            </button>
            <button
              type="button"
              onClick={() => setShowAtmosphere(false)}
              className="cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] text-slate-200 transition-colors hover:bg-white/15"
            >
              Hide Atmosphere
            </button>
          </div>
        </div>
      )}

      {/* ── Left Quick Compass & Zoom Rail (Desktop) ──────────────────────── */}
      <div className="pointer-events-auto fixed top-1/2 left-4 z-20 hidden -translate-y-1/2 flex-col gap-1.5 rounded-2xl border border-white/[0.09] bg-[#040916]/68 p-1.5 backdrop-blur-xl sm:left-6 md:flex">
        {[
          { label: "N", az: 0, alt: 24, red: true },
          { label: "E", az: 90, alt: 24 },
          { label: "S", az: 180, alt: 24 },
          { label: "W", az: 270, alt: 24 },
          { label: "Z", az: hudTelemetry.az, alt: 86 },
        ].map((dir) => (
          <button
            key={dir.label}
            type="button"
            onClick={() => flyCameraTo(dir.az, dir.alt)}
            title={dir.label === "Z" ? "Look at Zenith (90°)" : `Face ${dir.label}`}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl font-mono text-[10px] font-semibold transition-colors hover:bg-white/12 ${
              dir.red ? "text-rose-400" : "text-slate-300 hover:text-white"
            }`}
          >
            {dir.label}
          </button>
        ))}

        <div className="my-0.5 h-px bg-white/10" />

        <button
          type="button"
          onClick={() => {
            camFovRef.current = Math.max(12, camFovRef.current - 12);
          }}
          title="Zoom In"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            camFovRef.current = Math.min(86, camFovRef.current + 10);
          }}
          title="Zoom Out"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Bottom-Left Live Coordinate Telemetry Strip ───────────────────── */}
      <div className="pointer-events-none fixed bottom-20 left-4 z-20 hidden items-center gap-3 rounded-full border border-white/[0.08] bg-[#040916]/62 px-3.5 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur-xl sm:left-6 lg:flex">
        <span>
          AZ{" "}
          <strong className="text-slate-200">
            {hudTelemetry.az}° {compassLabel(hudTelemetry.az)}
          </strong>
        </span>
        <span className="text-white/15">·</span>
        <span>
          ALT{" "}
          <strong className="text-slate-200">
            {hudTelemetry.alt >= 0 ? "+" : ""}
            {hudTelemetry.alt.toFixed(1)}°
          </strong>
        </span>
        <span className="text-white/15">·</span>
        <span>
          FOV <strong className="text-slate-200">{hudTelemetry.fov}°</strong>
        </span>
        <span className="text-white/15">·</span>
        <span>
          LST{" "}
          <strong className="text-sky-300">
            {formatLST(observationDate, location.longitude)}
          </strong>
        </span>
      </div>

      {/* ── 2. Luxury Floating Bottom Observatory Dock ────────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3">
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.12] bg-[#040916]/82 px-2 py-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
        >
          {/* Sky Layers */}
          <DockToggle
            active={showConstellations}
            onClick={() => setShowConstellations((p) => !p)}
            icon={<Compass className="h-3.5 w-3.5" />}
            label="Lines"
            title="Constellation Lines (C)"
          />
          <DockToggle
            active={showNames}
            onClick={() => setShowNames((p) => !p)}
            icon={<span className="font-mono text-[10px] font-bold">Aa</span>}
            label="Names"
            title="Star & Constellation Labels"
          />
          <DockToggle
            active={showArt}
            onClick={() => setShowArt((p) => !p)}
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Art"
            title="Constellation Mythological Artwork"
          />
          <DockToggle
            active={showMilkyWay}
            onClick={() => setShowMilkyWay((p) => !p)}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Galaxy"
            title="8K ESO Milky Way Panorama"
          />
          <DockToggle
            active={showAtmosphere}
            onClick={() => setShowAtmosphere((p) => !p)}
            icon={<CloudSun className="h-3.5 w-3.5" />}
            label="Atmos"
            title="Atmospheric Daylight Scattering (A)"
          />
          <DockToggle
            active={showGround}
            onClick={() => setShowGround((p) => !p)}
            icon={<Mountain className="h-3.5 w-3.5" />}
            label="Ground"
            title="Horizon Landscape (G)"
          />
          <DockToggle
            active={showAzimuthGrid}
            onClick={() => setShowAzimuthGrid((p) => !p)}
            icon={<Grid3x3 className="h-3.5 w-3.5" />}
            label="Azimuth"
            title="Azimuth / Altitude Grid & Local Meridian (Z)"
          />
          <DockToggle
            active={showEquatorialGrid}
            onClick={() => setShowEquatorialGrid((p) => !p)}
            icon={<GlobeIcon />}
            label="Equator"
            title="Equatorial Grid (RA/Dec), Celestial Equator & Ecliptic (E)"
          />
          <DockToggle
            active={showBodies}
            onClick={() => setShowBodies((p) => !p)}
            icon={<Orbit className="h-3.5 w-3.5" />}
            label="Planets"
            title="Sun, Moon & Planets"
          />
          <DockToggle
            active={showNebulae}
            onClick={() => setShowNebulae((p) => !p)}
            icon={<Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />}
            label="DSO"
            title="Deep Sky Nebulae & Galaxies"
          />
          <DockToggle
            active={showSatellites}
            onClick={() => setShowSatellites((p) => !p)}
            icon={<Radio className="h-3.5 w-3.5" />}
            label={`Sats (${topoSats.satellites.length})`}
            title="Live SGP4 Satellites"
            accent="emerald"
          />
          <DockToggle
            active={nightVision}
            onClick={() => setNightVision((p) => !p)}
            icon={<Eye className="h-3.5 w-3.5" />}
            label="Red"
            title="Astronomer Night Vision Mode"
            accent="rose"
          />

          <div className="mx-1 h-6 w-px shrink-0 bg-white/12" />

          {/* Compact Chronometer Controls */}
          <button
            type="button"
            onClick={() => setTimeOffsetMinutes((p) => p - 60)}
            title="Rewind 1 Hour"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Rewind className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setWarpSpeed((p) => (p === 0 ? 1 : p === 1 ? 6 : p === 6 ? 36 : 0))
            }
            title="Cycle Time Warp (Space)"
            className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 font-mono text-[10.5px] font-medium transition-all ${
              warpSpeed !== 0
                ? "bg-sky-400 text-slate-950"
                : "bg-white/[0.07] text-slate-200 hover:bg-white/[0.14]"
            }`}
          >
            {warpSpeed !== 0 ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            <span>
              {warpSpeed === 0
                ? "1x"
                : warpSpeed === 1
                  ? "10m/s"
                  : warpSpeed === 6
                    ? "1h/s"
                    : "6h/s"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTimeOffsetMinutes((p) => p + 60)}
            title="Advance 1 Hour"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <FastForward className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsTimeModalOpen(true)}
            title="Date & Time Picker"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Calendar className="h-3.5 w-3.5" />
          </button>

          {!isLive && (
            <button
              type="button"
              onClick={() => {
                setTimeOffsetMinutes(0);
                setWarpSpeed(0);
              }}
              title="Return to Live Real-Time"
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 font-mono text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Live</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Telemetry Inspector Drawer (Right) ─────────────────────────── */}
      <SkyTelemetryPanel
        target={liveSelectedTarget}
        location={location}
        observationDate={observationDate}
        nasaImage={
          nasaImage && liveSelectedTarget && nasaImage.targetId === liveSelectedTarget.id
            ? nasaImage
            : null
        }
        onClose={() => setSelectedTarget(null)}
        onCenterCamera={(az, alt) => {
          if (alt < 0) setShowGround(false);
          flyCameraTo(az, alt);
        }}
        onJumpToRise={handleJumpToRise}
      />

      {/* ── 4. Observer Location & Day/Night Map Modal ────────────────────── */}
      <SkyLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        location={location}
        observationDate={observationDate}
        onSelectLocation={onSelectLocation}
      />

      {/* ── 5. Universal Celestial Search Modal (⌘K) ──────────────────────── */}
      <SkySearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        category={searchCategory}
        onCategoryChange={setSearchCategory}
        results={searchResults}
        onSelect={handleSelectSearchItem}
      />

      {/* ── 6. Observer-Local Date & Time Modal ───────────────────────────── */}
      {isTimeModalOpen && (
        <div
          onClick={() => setIsTimeModalOpen(false)}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.12] bg-[#040916]/94 shadow-[0_32px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Observation Date &amp; Time
                </h2>
                <p className="font-mono text-[10px] text-slate-400">
                  {location.name} Local Time ({localClock.tzLabel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTimeModalOpen(false)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Current Readout */}
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <div>
                  <div className="font-mono text-lg font-semibold text-white">
                    {localClock.time}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {localClock.dateStr} · {localClock.tzLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTimeOffsetMinutes(0);
                    setWarpSpeed(0);
                  }}
                  className="cursor-pointer rounded-full border border-emerald-400/35 bg-emerald-400/15 px-3 py-1.5 font-mono text-[10px] font-medium text-emerald-200 hover:bg-emerald-400/25"
                >
                  Sync Live
                </button>
              </div>

              {/* Exact Observer-Local Datetime Input (TRUE IANA Timezone!) */}
              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] tracking-[0.16em] text-slate-400 uppercase">
                  Set Local Date &amp; Time ({location.name})
                </label>
                <input
                  type="datetime-local"
                  value={localClock.isoLocalInput}
                  onChange={(e) => {
                    const parsed = parseObserverLocalInput(e.target.value, location);
                    if (!parsed) return;
                    setTimeOffsetMinutes(Math.round((parsed.getTime() - Date.now()) / 60000));
                    setWarpSpeed(0);
                  }}
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-sky-400/60"
                />
              </div>

              {/* Quick Time-of-Night Presets */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Dusk 19:00", hour: 19 },
                  { label: "Tonight 21:00", hour: 21 },
                  { label: "Midnight 00:00", hour: 0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const d = getObserverLocalHourDate(observationDate, location, preset.hour);
                      setTimeOffsetMinutes(Math.round((d.getTime() - Date.now()) / 60000));
                      setWarpSpeed(0);
                    }}
                    className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 font-mono text-[10.5px] text-slate-200 transition-colors hover:border-sky-400/40 hover:bg-sky-400/15 hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Step Buttons */}
              <div className="grid grid-cols-4 gap-2 font-mono text-[10.5px]">
                {[
                  { label: "-1 Day", delta: -1440 },
                  { label: "-1 Hr", delta: -60 },
                  { label: "+1 Hr", delta: 60 },
                  { label: "+1 Day", delta: 1440 },
                ].map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => setTimeOffsetMinutes((p) => p + step.delta)}
                    className="cursor-pointer rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 text-slate-300 transition-colors hover:bg-white/[0.09] hover:text-white"
                  >
                    {step.label}
                  </button>
                ))}
              </div>

              {/* Verified Real Total Solar Eclipse Presets (Location + Exact UTC + Auto-Center Sun) */}
              <div className="space-y-1.5 border-t border-white/[0.08] pt-3.5">
                <span className="block font-mono text-[9.5px] tracking-[0.18em] text-slate-400 uppercase">
                  Verify Real Total Solar Eclipses
                </span>
                <div className="space-y-1.5">
                  {[
                    {
                      title: "Total Solar Eclipse · 2 Aug 2027",
                      subtitle: "Luxor, Egypt · 13:05 EEST (6m 22s Totality)",
                      isoUtc: "2027-08-02T10:05:08Z",
                      loc: {
                        name: "Luxor (Eclipse Path)",
                        country: "Egypt",
                        latitude: 25.6872,
                        longitude: 32.6396,
                        timezoneOffsetHours: 3,
                        timeZone: "Africa/Cairo",
                        elevationMeters: 80,
                      },
                    },
                    {
                      title: "Total Solar Eclipse · 12 Aug 2026",
                      subtitle: "Reykjavik, Iceland · 17:48 GMT",
                      isoUtc: "2026-08-12T17:48:37Z",
                      loc: {
                        name: "Reykjavik",
                        country: "Iceland",
                        latitude: 64.1466,
                        longitude: -21.9426,
                        timezoneOffsetHours: 0,
                        timeZone: "Atlantic/Reykjavik",
                        elevationMeters: 15,
                      },
                    },
                    {
                      title: "Historical Total Eclipse · 9 Mar 2016",
                      subtitle: "Palu, Indonesia · 08:38 WITA",
                      isoUtc: "2016-03-09T00:38:50Z",
                      loc: {
                        name: "Palu",
                        country: "Indonesia",
                        latitude: -0.8917,
                        longitude: 119.8707,
                        timezoneOffsetHours: 8,
                        timeZone: "Asia/Makassar",
                        elevationMeters: 20,
                      },
                    },
                  ].map((ecl) => (
                    <button
                      key={ecl.title}
                      type="button"
                      onClick={() => {
                        const targetDate = new Date(ecl.isoUtc);
                        onSelectLocation(ecl.loc);
                        setTimeOffsetMinutes(Math.round((targetDate.getTime() - Date.now()) / 60000));
                        setWarpSpeed(0);
                        setShowAtmosphere(true);
                        const sunPos = computeSunPosition(targetDate, ecl.loc.latitude, ecl.loc.longitude);
                        flyCameraTo(sunPos.azimuthDeg, sunPos.altitudeDeg, 700);
                        setIsTimeModalOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-left transition-colors hover:border-amber-400/45 hover:bg-amber-400/15"
                    >
                      <div>
                        <span className="block text-[11px] font-medium text-amber-100">
                          {ecl.title}
                        </span>
                        <span className="block font-mono text-[9.5px] text-slate-400">
                          {ecl.subtitle}
                        </span>
                      </div>
                      <span className="font-mono text-[9.5px] text-amber-300">VIEW ↗</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Minimal Equatorial Globe Icon ────────────────────────────────────────────
function GlobeIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-23.4 12 12)" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

// ── Clean Minimal Dock Toggle Button ─────────────────────────────────────────
function DockToggle({
  active,
  onClick,
  icon,
  label,
  title,
  accent = "sky",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
  accent?: "sky" | "emerald" | "rose";
}) {
  const activeStyle =
    accent === "emerald"
      ? "bg-emerald-400/18 text-emerald-200 border-emerald-400/35"
      : accent === "rose"
        ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
        : "bg-white/[0.13] text-white border-white/20";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-medium transition-all ${
        active
          ? activeStyle
          : "border-transparent text-slate-400 hover:bg-white/[0.07] hover:text-slate-200"
      }`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
