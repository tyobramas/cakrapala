"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Sun,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  Crosshair,
  Activity,
  Flame,
  Globe,
  Compass,
  Sparkles,
} from "lucide-react";
import {
  computeSunPosition,
  computeTopocentricStars,
  computeTopocentricBodies,
  computeIAUConstellations,
  computeMilkyWaySpline,
  getGMST,
  type ObserverLocation,
  type SolarState,
  type TopocentricStar,
  type TopocentricBody,
  type Constellation3D,
  type MilkyWayStreamPoint,
} from "@/lib/astronomy/topocentricSky";
import {
  STAR_PROFILES,
  BODY_PROFILES,
  type CelestialObjectInfo,
} from "@/lib/astronomy/celestialObjectProfiles";

interface Props {
  location: ObserverLocation;
  onBackToMap: () => void;
}

// Convert J2000 Galactic Coordinates (l, b) to Topocentric (Az, Alt) (IAU Standard)
function galacticToAzAlt(lDeg: number, bDeg: number, lstDeg: number, latDeg: number): { az: number; alt: number } {
  const lRad = (lDeg * Math.PI) / 180;
  const bRad = (bDeg * Math.PI) / 180;
  const latRad = (latDeg * Math.PI) / 180;

  const raNGP = (192.85948 * Math.PI) / 180;
  const decNGP = (27.12825 * Math.PI) / 180;
  const lCP = (122.93192 * Math.PI) / 180; // Galactic Longitude of NCP

  // Galactic (l, b) -> Equatorial (RA, Dec)
  const sinDec = Math.sin(decNGP) * Math.sin(bRad) + Math.cos(decNGP) * Math.cos(bRad) * Math.cos(lCP - lRad);
  const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const y = Math.cos(bRad) * Math.sin(lCP - lRad);
  const x = Math.cos(decNGP) * Math.sin(bRad) - Math.sin(decNGP) * Math.cos(bRad) * Math.cos(lCP - lRad);
  let raRad = raNGP + Math.atan2(y, x);
  if (raRad < 0) raRad += 2 * Math.PI;
  const raDeg = (raRad * 180) / Math.PI;

  const H = ((lstDeg - raDeg) % 360 + 360) % 360;
  const HRad = (H * Math.PI) / 180;

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altDeg = (altRad * 180) / Math.PI;

  const cosAlt = Math.cos(altRad);
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
  let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(HRad) > 0) azRad = 2 * Math.PI - azRad;
  const azDeg = (azRad * 180) / Math.PI;

  return { az: azDeg, alt: altDeg };
}

// Helper to convert hex string to normalized RGB array [0..1]
function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

// ═══════════════════════════════════════════════════════════════════════════════
// High-Resolution ESO 360 Milky Way & Atmosphere Sky Dome WebGL Renderer
// Matches ThreeGroundSkyView with 100% visual and mathematical coordinate parity
// ═══════════════════════════════════════════════════════════════════════════════
class WebGLSkyDomeRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;
  texture: WebGLTexture | null = null;
  posBuffer: WebGLBuffer | null = null;
  isReady: boolean = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return;
    this.gl = gl;
    this.initGL();
  }

  private initGL() {
    const gl = this.gl!;
    const vsSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform vec2 uResolution;
      uniform vec3 uCamForward;
      uniform vec3 uCamRight;
      uniform vec3 uCamUp;
      uniform float uTanHalfFov;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform float uSunAlt;
      uniform float uLstRad;
      uniform float uLatRad;
      uniform float uShowMilkyWay;
      uniform sampler2D uMilkyWayTex;

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        float aspect = uResolution.x / uResolution.y;

        float px = (2.0 * uv.x - 1.0) * uTanHalfFov * aspect;
        float py = (2.0 * uv.y - 1.0) * uTanHalfFov;

        vec3 n = normalize(uCamForward + px * uCamRight + py * uCamUp);
        float y = clamp(n.y, 0.0, 1.0);

        // 1. Ultra-Smooth Multi-Stop Atmosphere Gradient
        float yCurve = pow(y, 0.55);
        vec3 skyCol = mix(uHorizon, uMid, smoothstep(0.0, 0.4, yCurve));
        skyCol = mix(skyCol, uZenith, smoothstep(0.3, 0.95, yCurve));

        // 2. Solar Twilight Scattering & Dusk Belt
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

        // 3. Exact IAU Galactic Coordinate Mapping for 3D Milky Way Panorama
        if (uShowMilkyWay > 0.5 && n.y > -0.05) {
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
          float mwFade = smoothstep(-0.02, 0.18, n.y);

          float dayFactor = 1.0;
          if (uSunAlt > 0.0) {
            dayFactor = 0.28;
          } else if (uSunAlt > -18.0) {
            float t = (uSunAlt + 18.0) / 18.0;
            dayFactor = mix(1.0, 0.35, t);
          }

          skyCol += texColor.rgb * 0.95 * mwFade * dayFactor;
        }

        if (n.y < 0.0) skyCol *= 0.02;
        gl_FragColor = vec4(skyCol, 1.0);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    this.program = prog;

    // Fullscreen quad
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);

    // Texture
    const tex = gl.createTexture()!;
    this.texture = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Placeholder dark pixel
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 9, 18, 255]));

    const img = new Image();
    img.src = "/textures/milkyway.jpg";
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.isReady = true;
    };
  }

  render(
    width: number,
    height: number,
    camAzDeg: number,
    camAltDeg: number,
    camFovDeg: number,
    sunAzDeg: number,
    sunAltDeg: number,
    lstRad: number,
    latRad: number,
    showMilkyWay: boolean,
    zCol: [number, number, number],
    mCol: [number, number, number],
    hCol: [number, number, number]
  ) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.useProgram(this.program);

    const aPos = gl.getAttribLocation(this.program, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const camAz = (camAzDeg * Math.PI) / 180;
    const camAlt = (camAltDeg * Math.PI) / 180;
    const fovRad = (camFovDeg * Math.PI) / 180;

    const fX = Math.sin(camAz) * Math.cos(camAlt);
    const fY = Math.sin(camAlt);
    const fZ = Math.cos(camAz) * Math.cos(camAlt);

    const rX = Math.cos(camAz);
    const rY = 0;
    const rZ = -Math.sin(camAz);

    const uX = fY * rZ - fZ * rY;
    const uY = fZ * rX - fX * rZ;
    const uZ = fX * rY - fY * rX;

    const sunAz = (sunAzDeg * Math.PI) / 180;
    const sunAlt = (sunAltDeg * Math.PI) / 180;
    const sunDirX = Math.cos(sunAlt) * Math.sin(sunAz);
    const sunDirY = Math.sin(sunAlt);
    const sunDirZ = Math.cos(sunAlt) * Math.cos(sunAz);

    gl.uniform2f(gl.getUniformLocation(this.program, "uResolution"), width, height);
    gl.uniform3f(gl.getUniformLocation(this.program, "uCamForward"), fX, fY, fZ);
    gl.uniform3f(gl.getUniformLocation(this.program, "uCamRight"), rX, rY, rZ);
    gl.uniform3f(gl.getUniformLocation(this.program, "uCamUp"), uX, uY, uZ);
    gl.uniform1f(gl.getUniformLocation(this.program, "uTanHalfFov"), Math.tan(fovRad / 2));
    gl.uniform3f(gl.getUniformLocation(this.program, "uZenith"), zCol[0], zCol[1], zCol[2]);
    gl.uniform3f(gl.getUniformLocation(this.program, "uMid"), mCol[0], mCol[1], mCol[2]);
    gl.uniform3f(gl.getUniformLocation(this.program, "uHorizon"), hCol[0], hCol[1], hCol[2]);
    gl.uniform3f(gl.getUniformLocation(this.program, "uSunDir"), sunDirX, sunDirY, sunDirZ);
    gl.uniform1f(gl.getUniformLocation(this.program, "uSunAlt"), sunAltDeg);
    gl.uniform1f(gl.getUniformLocation(this.program, "uLstRad"), lstRad);
    gl.uniform1f(gl.getUniformLocation(this.program, "uLatRad"), latRad);
    gl.uniform1f(gl.getUniformLocation(this.program, "uShowMilkyWay"), showMilkyWay ? 1.0 : 0.0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "uMilkyWayTex"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

// Deep Field Stars (1,200 background stars)
function generateDeepFieldStars(count: number = 1200): { raDeg: number; decDeg: number; mag: number; color: string }[] {
  const stars = [];
  let seed = 98765;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < count; i++) {
    const ra = rng() * 360;
    const dec = (Math.asin(rng() * 2 - 1) * 180) / Math.PI;
    const mag = 3.8 + rng() * 3.2;
    const roll = rng();
    const color = roll > 0.85 ? "#ffd2a1" : roll > 0.6 ? "#bbccff" : roll > 0.35 ? "#ffffed" : "#f0f4ff";
    stars.push({ raDeg: ra, decDeg: dec, mag, color });
  }
  return stars;
}

const DEEP_FIELD_STARS = generateDeepFieldStars(1200);

interface SelectedTarget {
  id: string;
  name: string;
  type: "star" | "planet" | "moon" | "sun";
  azimuthDeg: number;
  altitudeDeg: number;
  mag: number;
  colorHex: string;
}

function pos3DtoAzAlt(p: { x: number; y: number; z: number }): { az: number; alt: number } | null {
  const R = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (R < 0.001) return null;

  const alt = Math.asin(Math.max(-1, Math.min(1, p.y / R))) * (180 / Math.PI);
  let az = Math.atan2(p.x, p.z) * (180 / Math.PI);
  az = ((az % 360) + 360) % 360;

  if (!isFinite(alt) || !isFinite(az)) return null;
  return { az, alt };
}

// Color interpolation helper
function lerpColor(c1: string, c2: string, t: number): string {
  t = Math.max(0, Math.min(1, t));
  const hex = (c: string) => {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = hex(c1);
  const [r2, g2, b2] = hex(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function GroundSkyCanvasBackup({ location, onBackToMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initial Camera Angles (Looking towards Sagittarius / Scorpius in Southeast)
  const [camAzimuthDeg, setCamAzimuthDeg] = useState<number>(145);
  const [camAltitudeDeg, setCamAltitudeDeg] = useState<number>(30);
  const [camFovDeg, setCamFovDeg] = useState<number>(70);

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);

  // Toggles
  const [showConstellations, setShowConstellations] = useState<boolean>(true);
  const [showConstellationNames, setShowConstellationNames] = useState<boolean>(true);
  const [showMilkyWay, setShowMilkyWay] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showBodies, setShowBodies] = useState<boolean>(true);
  const [showLandscape, setShowLandscape] = useState<boolean>(true);
  const [showDaylightStars, setShowDaylightStars] = useState<boolean>(true);
  const [timeOffsetHours, setTimeOffsetHours] = useState<number>(0);

  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => Date.now());

  const skyRendererRef = useRef<WebGLSkyDomeRenderer | null>(null);

  useEffect(() => {
    skyRendererRef.current = new WebGLSkyDomeRenderer();
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);

  // ── Astronomical Calculations ──────────────────────────────────────────────
  const observationDate = useMemo(() => {
    const d = new Date(currentTimeMs);
    d.setHours(d.getHours() + timeOffsetHours);
    return d;
  }, [currentTimeMs, timeOffsetHours]);

  const solarState: SolarState = useMemo(() => {
    return computeSunPosition(observationDate, location.latitude, location.longitude);
  }, [observationDate, location]);

  const topocentricStars: TopocentricStar[] = useMemo(() => {
    return computeTopocentricStars(observationDate, location.latitude, location.longitude, 500);
  }, [observationDate, location]);

  const { moon: topocentricMoon, planets: topocentricPlanets } = useMemo(() => {
    return computeTopocentricBodies(observationDate, location.latitude, location.longitude, 500);
  }, [observationDate, location]);

  const constellations: Constellation3D[] = useMemo(() => {
    return computeIAUConstellations(observationDate, location.latitude, location.longitude, 500);
  }, [observationDate, location]);

  // Target Inspector Info
  const targetInfo: CelestialObjectInfo | null = useMemo(() => {
    if (!selectedTarget) return null;

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
      description: profile.description || `The celestial object ${selectedTarget.name} is currently shining in the observer's sky dome.`,
      funFact: profile.funFact || "This celestial object radiates photons traversing across space into your eyes tonight.",
    };
  }, [selectedTarget]);

  // ── Render High-Precision Stellarium Sky Canvas ────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const isDay = solarState.isDaylight;
    const alt = solarState.altitudeDeg;

    // 1. Ultra-Smooth Multi-Stop Continuous Atmospheric Sky Gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);

    let colZ = "#050912";
    let colUM = "#09101d";
    let colM = "#0e1728";
    let colLM = "#101c2e";
    let colH = "#142236";

    if (alt <= -18) {
      // Night
      colZ = "#050912";
      colUM = "#080e1b";
      colM = "#0b1222";
      colLM = "#0e1728";
      colH = "#121d30";
    } else if (alt <= -12) {
      // Astronomical Twilight
      const t = (alt + 18) / 6;
      colZ = lerpColor("#050912", "#060c18", t);
      colUM = lerpColor("#080e1b", "#0b1426", t);
      colM = lerpColor("#0b1222", "#101c34", t);
      colLM = lerpColor("#0e1728", "#162440", t);
      colH = lerpColor("#121d30", "#1e2e4e", t);
    } else if (alt <= -6) {
      // Nautical Twilight (Deep Indigo & Violet-Mauve)
      const t = (alt + 12) / 6;
      colZ = lerpColor("#060c18", "#081224", t);
      colUM = lerpColor("#0b1426", "#121e3c", t);
      colM = lerpColor("#101c34", "#242548", t);
      colLM = lerpColor("#162440", "#48263e", t);
      colH = lerpColor("#1e2e4e", "#6b3226", t);
    } else if (alt <= 0) {
      // Civil Twilight (Vibrant Sunset/Sunrise Warm Glow)
      const t = (alt + 6) / 6;
      colZ = lerpColor("#081224", "#0d2854", t);
      colUM = lerpColor("#121e3c", "#183e78", t);
      colM = lerpColor("#242548", "#2d4886", t);
      colLM = lerpColor("#48263e", "#683b54", t);
      colH = lerpColor("#6b3226", "#d95f24", t);
    } else if (alt <= 12) {
      // Early Morning / Late Afternoon
      const t = alt / 12;
      colZ = lerpColor("#0d2854", "#0c3e7a", t);
      colUM = lerpColor("#183e78", "#1a58a2", t);
      colM = lerpColor("#2d4886", "#2172ca", t);
      colLM = lerpColor("#683b54", "#4895e6", t);
      colH = lerpColor("#d95f24", "#7ebefc", t);
    } else {
      // Bright Day
      colZ = "#0c3e7a";
      colUM = "#144e96";
      colM = "#1f6ec4";
      colLM = "#4396ee";
      colH = "#6cb2fc";
    }

    // 1. Calculate Greenwich Apparent Sidereal Time (LST)
    const gmst = getGMST(observationDate);
    const lstDeg = ((gmst + location.longitude) % 360 + 360) % 360;
    const lstRad = (lstDeg * Math.PI) / 180;
    const latRad = (location.latitude * Math.PI) / 180;

    // 2. High-Resolution ESO 360 Milky Way & Atmosphere WebGL Shader Pass
    let drewWebGLSky = false;
    if (skyRendererRef.current && skyRendererRef.current.gl) {
      skyRendererRef.current.render(
        Math.round(width * dpr),
        Math.round(height * dpr),
        camAzimuthDeg,
        camAltitudeDeg,
        camFovDeg,
        solarState.azimuthDeg,
        solarState.altitudeDeg,
        lstRad,
        latRad,
        showMilkyWay,
        hexToRgb01(colZ),
        hexToRgb01(colM),
        hexToRgb01(colH)
      );
      ctx.drawImage(skyRendererRef.current.canvas, 0, 0, width, height);
      drewWebGLSky = true;
    }

    if (!drewWebGLSky) {
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, colZ);
      skyGradient.addColorStop(0.3, colUM);
      skyGradient.addColorStop(0.6, colM);
      skyGradient.addColorStop(0.85, colLM);
      skyGradient.addColorStop(1, colH);
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);
    }

    // ── Projection Math ───────────────────────────────────────────────────────
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const fovRad = (camFovDeg * Math.PI) / 180;
    const scale = (width / 2) / Math.tan(fovRad / 2);

    const projectToScreen = (azDeg: number, altDeg: number): { x: number; y: number; visible: boolean } => {
      let dAzDeg = azDeg - camAzimuthDeg;
      while (dAzDeg > 180) dAzDeg -= 360;
      while (dAzDeg < -180) dAzDeg += 360;

      const dAzRad = (dAzDeg * Math.PI) / 180;
      const altRad = (altDeg * Math.PI) / 180;
      const camAltRad = (camAltitudeDeg * Math.PI) / 180;

      const objX = Math.cos(altRad) * Math.sin(dAzRad);
      const objY = Math.sin(altRad);
      const objZ = Math.cos(altRad) * Math.cos(dAzRad);

      const rotY = objY * Math.cos(camAltRad) - objZ * Math.sin(camAltRad);
      const rotZ = objY * Math.sin(camAltRad) + objZ * Math.cos(camAltRad);

      if (rotZ <= 0.05) return { x: 0, y: 0, visible: false };

      const screenX = halfWidth + (objX / rotZ) * scale;
      const screenY = halfHeight - (rotY / rotZ) * scale;

      return {
        x: screenX,
        y: screenY,
        visible: screenX >= -100 && screenX <= width + 100 && screenY >= -100 && screenY <= height + 100,
      };
    };

    // Twilight Sun Horizon Glow Scatter
    if (alt > -18 && alt < 12) {
      const sunProj = projectToScreen(solarState.azimuthDeg, Math.max(0, solarState.altitudeDeg));
      if (sunProj.visible || (sunProj.x >= -width && sunProj.x <= width * 2)) {
        const glowRadius = width * 0.75;
        const sunGlow = ctx.createRadialGradient(sunProj.x, sunProj.y, 0, sunProj.x, sunProj.y, glowRadius);
        const factor = Math.max(0, (alt + 18) / 24);
        sunGlow.addColorStop(0, `rgba(255, 180, 80, ${0.45 * factor})`);
        sunGlow.addColorStop(0.3, `rgba(235, 95, 30, ${0.25 * factor})`);
        sunGlow.addColorStop(0.7, `rgba(160, 45, 60, ${0.12 * factor})`);
        sunGlow.addColorStop(1, "transparent");

        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, width, height);
      }
    }


    // ── 3. DEEP FIELD BACKGROUND STARS ───────────────────────────────────────
    if (showDaylightStars || !isDay) {
      ctx.save();
      const latRad = location.latitude * (Math.PI / 180);

      for (const fs of DEEP_FIELD_STARS) {
        const decRad = (fs.decDeg * Math.PI) / 180;
        const H = ((lstDeg - fs.raDeg) % 360 + 360) % 360;
        const HRad = (H * Math.PI) / 180;

        const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
        if (sinAlt < 0) continue;
        const altRad = Math.asin(sinAlt);
        const altDeg = (altRad * 180) / Math.PI;

        const cosAlt = Math.cos(altRad);
        const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (cosAlt * Math.cos(latRad) || 0.0001);
        let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
        if (Math.sin(HRad) > 0) azRad = 2 * Math.PI - azRad;
        const azDeg = (azRad * 180) / Math.PI;

        const proj = projectToScreen(azDeg, altDeg);
        if (proj.visible) {
          const r = Math.max(0.6, (5.5 - fs.mag) * 0.4);
          ctx.fillStyle = fs.color;
          ctx.globalAlpha = isDay ? 0.25 : 0.65;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ── 4. AUTHENTIC IAU CONSTELLATION STICK FIGURES & NODE STARS ────────────
    if (showConstellations && (showDaylightStars || !isDay)) {
      ctx.save();
      ctx.strokeStyle = isDay ? "rgba(100, 152, 196, 0.40)" : "rgba(90, 144, 180, 0.65)"; // Ice Blue
      ctx.lineWidth = 1.2;

      for (const c of constellations) {
        if (!c.isVisible) continue;

        for (const seg of c.segments) {
          const aA = pos3DtoAzAlt(seg[0]);
          const aB = pos3DtoAzAlt(seg[1]);

          if (aA && aB) {
            const pA = projectToScreen(aA.az, aA.alt);
            const pB = projectToScreen(aB.az, aB.alt);

            if (pA.visible && pB.visible) {
              ctx.beginPath();
              ctx.moveTo(pA.x, pA.y);
              ctx.lineTo(pB.x, pB.y);
              ctx.stroke();

              // Star Junction Node Dots
              ctx.fillStyle = "#ffffff";
              ctx.globalAlpha = 0.9;
              ctx.beginPath();
              ctx.arc(pA.x, pA.y, 1.8, 0, Math.PI * 2);
              ctx.arc(pB.x, pB.y, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Letter-Spaced Constellation Names
        if (showConstellationNames) {
          const center = pos3DtoAzAlt(c.centerPos3D);
          if (center && center.alt > 0) {
            const pC = projectToScreen(center.az, center.alt);
            if (pC.visible) {
              ctx.font = "600 13px system-ui, -apple-system, sans-serif";
              ctx.fillStyle = isDay ? "rgba(186, 230, 253, 0.6)" : "rgba(135, 185, 215, 0.88)";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              const spacedName = c.name.split("").join(" ");
              ctx.fillText(spacedName, pC.x, pC.y);
            }
          }
        }
      }
      ctx.restore();
    }

    // ── 5. PHOTOMETRIC CATALOG STARS ─────────────────────────────────────────
    if (showDaylightStars || !isDay) {
      ctx.save();
      for (const star of topocentricStars) {
        if (!star.isVisibleAboveHorizon) continue;

        const proj = projectToScreen(star.azimuthDeg, star.altitudeDeg);
        if (!proj.visible) continue;

        const coreRadius = Math.max(1.2, (5.2 - star.mag) * 0.65);

        // Airy disk halo for bright stars
        if (star.mag <= 2.0) {
          const haloRadius = coreRadius * 3.5;
          const haloGrad = ctx.createRadialGradient(proj.x, proj.y, coreRadius * 0.5, proj.x, proj.y, haloRadius);
          haloGrad.addColorStop(0, star.colorHex);
          haloGrad.addColorStop(1, "transparent");

          ctx.fillStyle = haloGrad;
          ctx.globalAlpha = star.mag <= 0 ? 0.65 : 0.40;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, haloRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bright star labels
        if (showLabels && star.mag <= 1.2) {
          ctx.font = "500 11px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#e2e8f0";
          ctx.textAlign = "left";
          ctx.globalAlpha = 0.85;
          ctx.fillText(star.name, proj.x + coreRadius + 6, proj.y + 3);
        }
      }
      ctx.restore();
    }

    // ── 6. DRAW THE SUN, MOON & PLANETS ───────────────────────────────────────
    // The Sun
    if (solarState.altitudeDeg > -12) {
      const sunProj = projectToScreen(solarState.azimuthDeg, solarState.altitudeDeg);
      if (sunProj.visible) {
        const sunRadius = 14 * (70 / camFovDeg);
        const sunGlow = ctx.createRadialGradient(sunProj.x, sunProj.y, sunRadius * 0.5, sunProj.x, sunProj.y, sunRadius * 3.5);
        sunGlow.addColorStop(0, "rgba(255, 245, 180, 0.95)");
        sunGlow.addColorStop(0.4, "rgba(245, 158, 11, 0.45)");
        sunGlow.addColorStop(1, "transparent");
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunProj.x, sunProj.y, sunRadius * 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fffbeb";
        ctx.beginPath();
        ctx.arc(sunProj.x, sunProj.y, sunRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The Moon (with Realistic Phase)
    if (showBodies && topocentricMoon.isVisibleAboveHorizon && (showDaylightStars || !isDay)) {
      const moonProj = projectToScreen(topocentricMoon.azimuthDeg, topocentricMoon.altitudeDeg);
      if (moonProj.visible) {
        const moonRadius = 10 * (70 / camFovDeg);
        const illumFrac = topocentricMoon.illuminationFraction ?? 0.5;
        const phaseDeg = topocentricMoon.phaseDeg ?? 90;

        // Atmospheric halo glow (intensity based on illumination)
        const glowGrad = ctx.createRadialGradient(moonProj.x, moonProj.y, moonRadius, moonProj.x, moonProj.y, moonRadius * 3.5);
        glowGrad.addColorStop(0, `rgba(230, 240, 255, ${0.15 + illumFrac * 0.35})`);
        glowGrad.addColorStop(1, "transparent");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(moonProj.x, moonProj.y, moonRadius * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw lit portion (bright white)
        ctx.save();
        ctx.fillStyle = "#f0f4fc";
        ctx.beginPath();
        ctx.arc(moonProj.x, moonProj.y, moonRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw shadow overlay for phase
        // phaseDeg: 0=new(dark), 90=first quarter, 180=full(bright), 270=last quarter
        const isWaxing = phaseDeg < 180;
        // Terminator ellipse width: cos of phase mapped to [0, PI]
        const terminatorCos = Math.cos(phaseDeg * Math.PI / 180);

        ctx.fillStyle = "rgba(8, 12, 24, 0.92)"; // Dark shadow
        ctx.beginPath();

        if (phaseDeg <= 0.5 || phaseDeg >= 359.5) {
          // New moon: entirely dark
          ctx.arc(moonProj.x, moonProj.y, moonRadius, 0, Math.PI * 2);
        } else if (phaseDeg >= 179 && phaseDeg <= 181) {
          // Full moon: no shadow (skip)
        } else {
          // Draw the shadow half + terminator ellipse
          // Shadow covers the unlit half plus the terminator curve
          const startAngle = isWaxing ? -Math.PI / 2 : Math.PI / 2;
          const endAngle = isWaxing ? Math.PI / 2 : -Math.PI / 2;

          // Shadow semicircle (unlit side)
          ctx.arc(moonProj.x, moonProj.y, moonRadius, startAngle, endAngle, !isWaxing);

          // Terminator ellipse edge
          const ellipseRx = moonRadius * Math.abs(terminatorCos);
          for (let i = 0; i <= 32; i++) {
            const t = (isWaxing ? (32 - i) : i) / 32;
            const angle = -Math.PI / 2 + t * Math.PI;
            const ex = moonProj.x + ellipseRx * Math.cos(angle);
            const ey = moonProj.y + moonRadius * Math.sin(angle);
            ctx.lineTo(ex, ey);
          }
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();

        // Moon label with phase info
        const phaseLabel = illumFrac < 0.02 ? "New" : illumFrac > 0.98 ? "Full" : `${Math.round(illumFrac * 100)}%`;
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(`Moon (${phaseLabel})`, moonProj.x, moonProj.y - moonRadius - 8);
      }
    }

    // Planets
    if (showBodies && (showDaylightStars || !isDay)) {
      for (const planet of topocentricPlanets) {
        if (!planet.isVisibleAboveHorizon) continue;
        const pProj = projectToScreen(planet.azimuthDeg, planet.altitudeDeg);
        if (pProj.visible) {
          ctx.fillStyle = planet.colorHex;
          ctx.beginPath();
          ctx.arc(pProj.x, pProj.y, 3.5, 0, Math.PI * 2);
          ctx.fill();

          if (showLabels) {
            ctx.font = "500 11px system-ui, -apple-system, sans-serif";
            ctx.fillText(planet.name, pProj.x + 8, pProj.y + 3);
          }
        }
      }
    }

    // ── 7. PROMINENT REALISTIC LANDSCAPE & HORIZON SILHOUETTES ───────────────
    if (showLandscape) {
      ctx.save();

      // Determine ground color based on time of day
      const groundCol = isDay ? "#16381e" : (alt > -18 ? lerpColor("#09140c", "#241812", (alt + 18) / 18) : "#0a180f");
      const hillCol = isDay ? "#1d4726" : (alt > -18 ? lerpColor("#0c1c11", "#2e1e17", (alt + 18) / 18) : "#0d2215");
      const treeCol = isDay ? "#22562d" : (alt > -18 ? lerpColor("#0f2416", "#36241b", (alt + 18) / 18) : "#102a1a");

      // Draw Rolling Hills Horizon Line across Screen
      const hillPoints: { x: number; y: number }[] = [];
      const numSteps = 72;
      for (let i = 0; i <= numSteps; i++) {
        const stepAz = camAzimuthDeg - (camFovDeg / 2) + (i / numSteps) * camFovDeg;
        // Undulating wave for terrain
        const terrainAltDeg = 0.5 + Math.sin(stepAz * 0.08) * 0.8 + Math.cos(stepAz * 0.2) * 0.4;
        const p = projectToScreen(stepAz, terrainAltDeg);
        hillPoints.push({ x: p.x, y: Math.min(height + 100, Math.max(-50, p.y)) });
      }

      // Fill Ground Polygon below Hills
      if (hillPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(hillPoints[0].x, hillPoints[0].y);
        for (let i = 1; i < hillPoints.length; i++) {
          ctx.lineTo(hillPoints[i].x, hillPoints[i].y);
        }
        ctx.lineTo(width + 50, height + 50);
        ctx.lineTo(-50, height + 50);
        ctx.closePath();
        ctx.fillStyle = groundCol;
        ctx.fill();

        // Hill Crest Rim Stroke
        ctx.strokeStyle = hillCol;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw Organic Tree Silhouettes along the Horizon
      const treeSpacing = 2.5; // Every ~2.5 degrees of azimuth
      const startAz = Math.floor((camAzimuthDeg - camFovDeg / 2) / treeSpacing) * treeSpacing;
      const endAz = Math.ceil((camAzimuthDeg + camFovDeg / 2) / treeSpacing) * treeSpacing;

      for (let treeAz = startAz; treeAz <= endAz; treeAz += treeSpacing) {
        let seed = Math.abs(Math.sin(treeAz * 12.9898)) * 43758.5453;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        const terrainAltDeg = 0.5 + Math.sin(treeAz * 0.08) * 0.8 + Math.cos(treeAz * 0.2) * 0.4;
        const p = projectToScreen(treeAz, terrainAltDeg);

        if (p.visible && p.y > 0 && p.y < height + 50) {
          const treeH = (12 + rand() * 24) * (70 / camFovDeg);
          const treeW = treeH * (0.35 + rand() * 0.25);
          const isPine = rand() > 0.35;

          ctx.fillStyle = treeCol;
          ctx.beginPath();
          if (isPine) {
            // Pine conifer silhouette
            ctx.moveTo(p.x, p.y - treeH);
            ctx.lineTo(p.x + treeW * 0.4, p.y - treeH * 0.65);
            ctx.lineTo(p.x + treeW * 0.25, p.y - treeH * 0.65);
            ctx.lineTo(p.x + treeW * 0.5, p.y - treeH * 0.3);
            ctx.lineTo(p.x + treeW * 0.3, p.y - treeH * 0.3);
            ctx.lineTo(p.x + treeW * 0.6, p.y);
            ctx.lineTo(p.x - treeW * 0.6, p.y);
            ctx.lineTo(p.x - treeW * 0.3, p.y - treeH * 0.3);
            ctx.lineTo(p.x - treeW * 0.5, p.y - treeH * 0.3);
            ctx.lineTo(p.x - treeW * 0.25, p.y - treeH * 0.65);
            ctx.lineTo(p.x - treeW * 0.4, p.y - treeH * 0.65);
          } else {
            // Dome leafy tree silhouette
            ctx.arc(p.x, p.y - treeH * 0.55, treeW * 0.55, 0, Math.PI * 2);
          }
          ctx.closePath();
          ctx.fill();
        }
      }

      // Cardinal Directions Badges
      const cardinals = [
        { text: "N", az: 0, color: "#ef4444" },
        { text: "NE", az: 45, color: "#6498c4" },
        { text: "E", az: 90, color: "#f59e0b" },
        { text: "SE", az: 135, color: "#6498c4" },
        { text: "S", az: 180, color: "#ef4444" },
        { text: "SW", az: 225, color: "#6498c4" },
        { text: "W", az: 270, color: "#f59e0b" },
        { text: "NW", az: 315, color: "#6498c4" },
      ];

      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      for (const card of cardinals) {
        const p = projectToScreen(card.az, 1.2);
        if (p.visible && p.y > 0 && p.y < height) {
          ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
          const tw = ctx.measureText(card.text).width + 12;
          ctx.beginPath();
          ctx.roundRect(p.x - tw / 2, p.y - 10, tw, 20, 5);
          ctx.fill();

          ctx.fillStyle = card.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(card.text, p.x, p.y);
        }
      }
      ctx.restore();
    }

    // ── 8. SELECTED TARGET RETICLE ───────────────────────────────────────────
    if (selectedTarget) {
      const p = projectToScreen(selectedTarget.azimuthDeg, selectedTarget.altitudeDeg);
      if (p.visible) {
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;

        const s = 18;
        const cl = 6;
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
        ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    camAzimuthDeg,
    camAltitudeDeg,
    camFovDeg,
    solarState,
    topocentricStars,
    topocentricMoon,
    topocentricPlanets,
    constellations,
    showConstellations,
    showConstellationNames,
    showMilkyWay,
    showLabels,
    showBodies,
    showLandscape,
    showDaylightStars,
    selectedTarget,
    observationDate,
    location,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // ── Drag & Zoom Handlers ───────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;

    if (Math.hypot(dx, dy) > 3) hasDraggedRef.current = true;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    const sensitivity = (camFovDeg / 85) * 0.16;

    setCamAzimuthDeg((prev) => ((prev - dx * sensitivity) % 360 + 360) % 360);
    setCamAltitudeDeg((prev) => Math.max(-5, Math.min(90, prev + dy * sensitivity)));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDraggingRef.current && !hasDraggedRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        let bestDist = 36;
        let found: SelectedTarget | null = null;

        for (const star of topocentricStars) {
          if (!star.isVisibleAboveHorizon) continue;
          const dist = Math.hypot(star.altitudeDeg - camAltitudeDeg, star.azimuthDeg - camAzimuthDeg);
          if (dist < 15) {
            found = { id: star.id, name: star.name, type: "star", azimuthDeg: star.azimuthDeg, altitudeDeg: star.altitudeDeg, mag: star.mag, colorHex: star.colorHex };
            break;
          }
        }
        if (found) setSelectedTarget(found);
      }
    }
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setCamFovDeg((prev) => Math.max(30, Math.min(120, prev + (e.deltaY > 0 ? 4 : -4))));
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isDraggingRef.current = false; }}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#060a13] text-slate-100 font-sans overflow-hidden select-none cursor-crosshair active:cursor-grabbing"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Zoom Controls */}
      <div className="absolute right-4 top-20 z-20 flex flex-col gap-1.5 bg-slate-950/85 border border-slate-800 p-1 rounded-xl backdrop-blur-md pointer-events-auto">
        <button type="button" onClick={() => setCamFovDeg((prev) => Math.max(30, prev - 10))} className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-all" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
        <button type="button" onClick={() => setCamFovDeg((prev) => Math.min(120, prev + 10))} className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-all" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
      </div>

      {/* Object Inspector */}
      {targetInfo && (
        <div className="absolute top-20 left-4 z-30 w-80 md:w-96 rounded-2xl bg-slate-950/90 border border-cyan-500/40 backdrop-blur-2xl shadow-[0_0_40px_rgba(6,182,212,0.25)] text-slate-100 p-5 font-sans pointer-events-auto">
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono mb-1">
                <Sparkles className="w-3 h-3" />
                <span>{targetInfo.type.toUpperCase()}</span>
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">{targetInfo.name}</h3>
              <p className="text-xs text-slate-400 font-mono italic">{targetInfo.scientificName}</p>
            </div>
            <button type="button" onClick={() => setSelectedTarget(null)} className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all" title="Close"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2 my-3 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1"><Activity className="w-3 h-3 text-cyan-400" /><span>Apparent Mag (V)</span></div>
              <div className="text-sm font-bold text-white mt-0.5">{targetInfo.magnitude > 0 ? `+${targetInfo.magnitude.toFixed(2)}` : targetInfo.magnitude.toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1"><Compass className="w-3 h-3 text-amber-400" /><span>Altitude</span></div>
              <div className="text-sm font-bold text-amber-300 mt-0.5">{targetInfo.altitudeDeg.toFixed(1)}°</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1"><Globe className="w-3 h-3 text-blue-400" /><span>Azimuth</span></div>
              <div className="text-sm font-bold text-blue-300 mt-0.5">{targetInfo.azimuthDeg.toFixed(1)}°</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1"><Flame className="w-3 h-3 text-rose-400" /><span>Temp</span></div>
              <div className="text-xs font-bold text-rose-300 mt-0.5 truncate">{targetInfo.surfaceTemp}</div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs font-mono py-1 border-t border-slate-800/60 text-slate-300">
            <div className="flex justify-between"><span className="text-slate-500">Constellation:</span><span className="text-slate-200 font-bold">{targetInfo.constellation}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Distance:</span><span className="text-cyan-300 font-bold">{targetInfo.distanceLy}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Spectral:</span><span className="text-slate-200">{targetInfo.spectralType}</span></div>
          </div>

          <button type="button" onClick={() => { if (selectedTarget) { setCamAzimuthDeg(selectedTarget.azimuthDeg); setCamAltitudeDeg(Math.max(0, selectedTarget.altitudeDeg)); } }} className="w-full mt-4 py-2.5 rounded-xl font-mono text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 hover:border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2 transition-all">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <span>CENTER VIEW ON OBJECT</span>
          </button>
        </div>
      )}

      {/* Bottom HUD Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/90 border border-slate-700/60 backdrop-blur-2xl shadow-[0_0_30px_rgba(0,0,0,0.6)] pointer-events-auto">
        <button type="button" onClick={() => setShowConstellations((p) => !p)} title="Constellation Lines" className={`p-2.5 rounded-xl border transition-all duration-200 ${showConstellations ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)]" : "bg-slate-900/80 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="5" cy="5" r="1.5" fill="currentColor"/><circle cx="19" cy="4" r="1.5" fill="currentColor"/><circle cx="12" cy="11" r="1.5" fill="currentColor"/><circle cx="7" cy="19" r="1.5" fill="currentColor"/><circle cx="18" cy="17" r="1.5" fill="currentColor"/><line x1="5" y1="5" x2="12" y2="11"/><line x1="19" y1="4" x2="12" y2="11"/><line x1="12" y1="11" x2="7" y2="19"/><line x1="12" y1="11" x2="18" y2="17"/></svg></button>
        <button type="button" onClick={() => setShowConstellationNames((p) => !p)} title="Constellation Names" className={`p-2.5 rounded-xl border transition-all duration-200 ${showConstellationNames ? "bg-blue-500/20 border-blue-400/60 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.35)]" : "bg-slate-900/80 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h6M4 12h8M4 17h5"/><path d="M16 5l2 6 2-6" strokeLinejoin="round"/><circle cx="17" cy="17" r="3"/></svg></button>
        <button type="button" onClick={() => setShowMilkyWay((p) => !p)} title="Milky Way Galaxy" className={`p-2.5 rounded-xl border transition-all duration-200 ${showMilkyWay ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.35)]" : "bg-slate-900/80 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="6" ry="2" transform="rotate(-35 12 12)" opacity="0.5"/><circle cx="10" cy="10" r="0.8" fill="currentColor"/><circle cx="14" cy="13" r="0.6" fill="currentColor"/><circle cx="8" cy="12" r="0.5" fill="currentColor"/></svg></button>
        <button type="button" onClick={() => setShowBodies((p) => !p)} title="Moon & Planets" className={`p-2.5 rounded-xl border transition-all duration-200 ${showBodies ? "bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]" : "bg-slate-900/80 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="6"/><path d="M14 6a6 6 0 0 1 0 8" strokeDasharray="2 2"/><circle cx="19" cy="17" r="2.5"/><circle cx="19" cy="17" r="4" strokeDasharray="1.5 2" opacity="0.4"/></svg></button>
        <div className="w-px h-7 bg-slate-700/60 mx-1" />
        <div className="flex items-center gap-1.5 shrink-0">
          <input type="range" min="-12" max="12" step="1" value={timeOffsetHours} onChange={(e) => setTimeOffsetHours(parseInt(e.target.value, 10))} className="w-20 accent-cyan-400 cursor-pointer" />
          <span className="text-[11px] font-bold text-white min-w-[32px] text-center font-mono">{timeOffsetHours >= 0 ? `+${timeOffsetHours}h` : `${timeOffsetHours}h`}</span>
          {timeOffsetHours !== 0 && (
            <button type="button" onClick={() => setTimeOffsetHours(0)} className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700/50 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all" title="Reset to Live Time"><RotateCcw className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}
