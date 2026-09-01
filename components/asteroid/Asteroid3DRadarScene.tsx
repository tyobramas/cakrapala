"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import { OPS, OPS_TYPE } from "@/lib/ui/opsTheme";
import { useOpsMode } from "@/lib/ui/opsMode";
import {
  Compass,
  RefreshCw,
  Crosshair,
  Layers,
} from "lucide-react";

import {
  buildAsteroidMesh,
  ASTEROID_TAXONOMY,
} from "@/lib/asteroid/buildAsteroidMesh";
import { LD_TO_WORLD } from "@/lib/asteroid/asteroidMath";
import { Landmark } from "./ScaleRuler";

interface Asteroid3DRadarSceneProps {
  asteroids: AsteroidNeoObject[];
  selectedAsteroid: AsteroidNeoObject | null;
  onSelectAsteroid: (asteroid: AsteroidNeoObject) => void;
  selectedLandmark?: Landmark | null;
  isLoading?: boolean;
}

const SYMBOL_PX = {
  ops: { normal: 7, selected: 9 },
  public: { normal: 10, selected: 12 },
};

/**
 * 1-2-5 Round Scale Snapper
 */
function niceScale(targetLD: number): number {
  if (targetLD <= 0) return 1;
  const exp = Math.floor(Math.log10(targetLD));
  const f = targetLD / Math.pow(10, exp);
  const snap = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return snap * Math.pow(10, exp);
}

function formatKmWithThinSpaces(km: number): string {
  return km.toLocaleString("en-US").replace(/,/g, " ") + " km";
}

function formatApproachUtc(dateStr?: string): string {
  if (!dateStr) return "N/A UTC";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const m = months[d.getUTCMonth()];
      const day = String(d.getUTCDate()).padStart(2, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${m} ${day}  ${hh}:${mm} UTC`;
    }
  } catch {
    // fallback
  }
  return dateStr.toUpperCase();
}

/**
 * Flat 2D radar symbology sprite texture
 */
function createSymbolTexture(
  type: "safe" | "caution" | "hazard",
  isSelected: boolean
): THREE.Texture {
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;

    // Corner Brackets for selected
    if (isSelected) {
      ctx.strokeStyle = OPS.accent;
      ctx.lineWidth = 2.0;
      const pad = 8;
      const arm = 11;

      ctx.beginPath();
      ctx.moveTo(pad, pad + arm);
      ctx.lineTo(pad, pad);
      ctx.lineTo(pad + arm, pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(size - pad - arm, pad);
      ctx.lineTo(size - pad, pad);
      ctx.lineTo(size - pad, pad + arm);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pad, size - pad - arm);
      ctx.lineTo(pad, size - pad);
      ctx.lineTo(pad + arm, size - pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(size - pad - arm, size - pad);
      ctx.lineTo(size - pad, size - pad);
      ctx.lineTo(size - pad, size - pad - arm);
      ctx.stroke();
    }

    // Symbol Shapes
    if (type === "safe") {
      ctx.strokeStyle = OPS.safe;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === "caution") {
      ctx.fillStyle = OPS.caution;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "hazard") {
      ctx.fillStyle = OPS.hazard;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 12, cy);
      ctx.lineTo(cx, cy + 12);
      ctx.lineTo(cx - 12, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Text Sprite Label for Tick / Longitude / Reticle
 */
function createTextSprite(text: string, color: string, fontSize = 20): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 160, 48);
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = color;
    ctx.shadowColor = "#0A0E13";
    ctx.shadowBlur = 3;
    ctx.fillText(text, 6, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.85,
    sizeAttenuation: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.045, 0.015, 1);
  return sprite;
}

/**
 * Minimalist radar callout label sprite
 */
function createCalloutLabelSprite(neo: AsteroidNeoObject, isOps: boolean): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = isOps ? 128 : 96;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, 384, canvas.height);

    ctx.shadowColor = "#0A0E13";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Line 1: (Name / Designation)
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = OPS.text;
    ctx.fillText(neo.name, 10, 30);

    const distLd = (neo.closest_miss_distance_ld || 0).toFixed(1);

    if (isOps) {
      const speed = Math.round(neo.velocity_kmh || 0).toLocaleString();
      ctx.font = "20px monospace";
      ctx.fillStyle = OPS.textDim;
      ctx.fillText(`${distLd} LD · ${speed} km/h`, 10, 62);

      const dateStr = neo.close_approach_data?.[0]?.close_approach_date_full || neo.close_approach_data?.[0]?.close_approach_date;
      const utcFormatted = formatApproachUtc(dateStr);
      ctx.font = "18px monospace";
      ctx.fillStyle = OPS.textFaint;
      ctx.fillText(utcFormatted, 10, 94);
    } else {
      ctx.font = "20px monospace";
      ctx.fillStyle = OPS.textDim;
      ctx.fillText(`${distLd}× Moon · ${neo.avg_diameter_meters}m`, 10, 62);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.95,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6.5, isOps ? 2.16 : 1.62, 1);
  sprite.position.set(3.4, 1.8, 0);
  return sprite;
}

/**
 * 3D Comparative Silhouette Sprite for Landmarks (True Relative Scale)
 */
function createLandmarkSilhouetteSprite(
  landmark: Landmark,
  asteroidAvgM: number
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 384);

    // Height comparison bracket line
    ctx.strokeStyle = OPS.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(32, 40);
    ctx.lineTo(32, 340);
    ctx.stroke();
    ctx.setLineDash([]);

    // End caps
    ctx.beginPath();
    ctx.moveTo(22, 40);
    ctx.lineTo(42, 40);
    ctx.moveTo(22, 340);
    ctx.lineTo(42, 340);
    ctx.stroke();

    // Geometric shape
    ctx.fillStyle = "rgba(90, 143, 184, 0.35)";
    ctx.strokeStyle = OPS.accent;
    ctx.lineWidth = 2;

    if (landmark.id === "eiffel") {
      ctx.beginPath();
      ctx.moveTo(128, 40);
      ctx.lineTo(110, 200);
      ctx.lineTo(80, 340);
      ctx.lineTo(128, 300);
      ctx.lineTo(176, 340);
      ctx.lineTo(146, 200);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (landmark.id === "burj" || landmark.id === "empire") {
      ctx.beginPath();
      ctx.moveTo(128, 40);
      ctx.lineTo(128, 90);
      ctx.lineTo(118, 90);
      ctx.lineTo(118, 180);
      ctx.lineTo(108, 180);
      ctx.lineTo(108, 340);
      ctx.lineTo(148, 340);
      ctx.lineTo(148, 180);
      ctx.lineTo(138, 180);
      ctx.lineTo(138, 90);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (landmark.id === "monas") {
      ctx.beginPath();
      ctx.moveTo(128, 40);
      ctx.lineTo(122, 70);
      ctx.lineTo(124, 230);
      ctx.lineTo(90, 250);
      ctx.lineTo(90, 270);
      ctx.lineTo(110, 270);
      ctx.lineTo(110, 340);
      ctx.lineTo(146, 340);
      ctx.lineTo(146, 270);
      ctx.lineTo(166, 270);
      ctx.lineTo(166, 250);
      ctx.lineTo(132, 230);
      ctx.lineTo(134, 70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (landmark.id === "747") {
      ctx.beginPath();
      ctx.moveTo(128, 60);
      ctx.lineTo(122, 140);
      ctx.lineTo(60, 200);
      ctx.lineTo(60, 220);
      ctx.lineTo(120, 210);
      ctx.lineTo(120, 310);
      ctx.lineTo(90, 340);
      ctx.lineTo(166, 340);
      ctx.lineTo(136, 310);
      ctx.lineTo(136, 210);
      ctx.lineTo(196, 220);
      ctx.lineTo(196, 200);
      ctx.lineTo(134, 140);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.strokeRect(80, 160, 96, 180);
      ctx.fillRect(80, 160, 96, 180);
    }

    // Top height text
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = OPS.accent;
    ctx.fillText(`${landmark.m}m`, 48, 28);

    // Bottom name text
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = OPS.text;
    ctx.fillText(landmark.label.toUpperCase(), 48, 368);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.95,
  });

  const sprite = new THREE.Sprite(mat);
  const relativeScale = Math.max(1.2, Math.min(12.0, (landmark.m / Math.max(10, asteroidAvgM)) * 3.5));
  sprite.scale.set(relativeScale * 0.65, relativeScale, 1);
  return sprite;
}

export default function Asteroid3DRadarScene({
  asteroids,
  selectedAsteroid,
  onSelectAsteroid,
  selectedLandmark,
  isLoading = false,
}: Asteroid3DRadarSceneProps) {
  const { isOps } = useOpsMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredAsteroid, setHoveredAsteroid] = useState<AsteroidNeoObject | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [cameraViewMode, setCameraViewMode] = useState<"free" | "top" | "target">("free");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Dynamic Scale Bar State
  const [scaleBarLD, setScaleBarLD] = useState<number>(10);
  const [scaleBarKmStr, setScaleBarKmStr] = useState<string>("3 844 000 km");
  const [scaleBarPx, setScaleBarPx] = useState<number>(140);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sweepMeshRef = useRef<THREE.Mesh | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const moonPivotRef = useRef<THREE.Group | null>(null);
  const selectedAsteroidMeshRef = useRef<THREE.Mesh | null>(null);
  const selectedAsteroidDisposeRef = useRef<(() => void) | null>(null);
  const landmarkSilhouetteRef = useRef<THREE.Sprite | null>(null);
  const asteroidMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const trajectoryLinesRef = useRef<THREE.Line[]>([]);

  // Smooth Camera Fly-To Tracking Animation State
  const cameraAnimationRef = useRef<{
    active: boolean;
    startCamPos: THREE.Vector3;
    endCamPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null>(null);

  const flyToTarget = useCallback((targetPos: THREE.Vector3, cameraPos: THREE.Vector3, duration = 650) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    cameraAnimationRef.current = {
      active: true,
      startCamPos: camera.position.clone(),
      endCamPos: cameraPos.clone(),
      startTarget: controls.target.clone(),
      endTarget: targetPos.clone(),
      startTime: performance.now(),
      duration,
    };
  }, []);

  // Graticule References for Glancing Angle Fade
  const graticuleGroupRef = useRef<THREE.Group | null>(null);
  const graticuleMaterialsRef = useRef<THREE.Material[]>([]);

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // ── Setup Three.js Scene ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(OPS.bg);
    scene.fog = new THREE.FogExp2(0x0a0e13, 0.0006); // Lower density for linear outer view
    sceneRef.current = scene;

    // 2. Camera (telephoto elevation ~31°, azimuth 45°)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 4000);
    camera.position.set(52, 45, 52);
    cameraRef.current = camera;

    // 3. Renderer with ACES Filmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls (Clamped polar angle to prevent edge-on collapse)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 800;
    controls.minPolarAngle = THREE.MathUtils.degToRad(12);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
    controls.addEventListener("start", () => {
      if (cameraAnimationRef.current) {
        cameraAnimationRef.current.active = false;
      }
      setCameraViewMode("free");
    });
    controlsRef.current = controls;

    // 5. Realistic Space Lighting with Balanced Fill for Surface Topology
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.6);
    sunLight.position.set(120, 45, 140);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x22303c, 0.42); // Clear visible ambient fill
    scene.add(ambientLight);

    const softFillLight = new THREE.DirectionalLight(0x4a6d8c, 0.65);
    softFillLight.position.set(-100, -40, -100);
    scene.add(softFillLight);

    const textureLoader = new THREE.TextureLoader();

    // ── 6. Subtle Starfield Graticule ────────────────────────────────────────
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = THREE.MathUtils.randFloat(350, 900);
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.0,
      color: 0x475569,
      transparent: true,
      opacity: 0.55,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── 7. Earth Mesh & Atmosphere ───────────────────────────────────────────
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthRadius = 2.2;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 48, 48);
    const earthTex = textureLoader.load("/textures/planets/earth.jpg");
    earthTex.colorSpace = THREE.SRGBColorSpace;

    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.75,
      metalness: 0.05,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.z = THREE.MathUtils.degToRad(23.44);
    earthGroup.add(earthMesh);
    earthMeshRef.current = earthMesh;

    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.04, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x5a8fb8,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmoMesh);

    // ── 8. Moon & Lunar Orbit (1 LD = 1 * LD_TO_WORLD = 6.0) ─────────────────
    const lunarRadius3D = 1 * LD_TO_WORLD;
    const moonPivot = new THREE.Group();
    earthGroup.add(moonPivot);
    moonPivotRef.current = moonPivot;

    const moonGeo = new THREE.SphereGeometry(0.55, 24, 24);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0x8a94a0,
      roughness: 0.9,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(lunarRadius3D, 0, 0);
    moonPivot.add(moonMesh);

    // ── 9. Ecliptic Graticule (Range Rings, Spokes, Longitude Labels, Reticle) ─
    const graticuleGroup = new THREE.Group();
    scene.add(graticuleGroup);
    graticuleGroupRef.current = graticuleGroup;
    graticuleMaterialsRef.current = [];

    // A. Center Reticle (Permanent — NOT in graticuleMaterialsRef)
    const reticleGeo = new THREE.BufferGeometry();
    const reticlePts: THREE.Vector3[] = [
      new THREE.Vector3(-2.2, 0, 0), new THREE.Vector3(-0.6, 0, 0),
      new THREE.Vector3(0.6, 0, 0), new THREE.Vector3(2.2, 0, 0),
      new THREE.Vector3(0, 0, -2.2), new THREE.Vector3(0, 0, -0.6),
      new THREE.Vector3(0, 0, 0.6), new THREE.Vector3(0, 0, 2.2),
    ];
    reticleGeo.setFromPoints(reticlePts);
    const reticleMat = new THREE.LineBasicMaterial({
      color: 0x5a8fb8,
      transparent: true,
      opacity: 0.75,
    });
    const reticleLine = new THREE.LineSegments(reticleGeo, reticleMat);
    scene.add(reticleLine);

    // Center Label: EARTH · WGS-84 (Permanent)
    const centerReticleLabel = createTextSprite("EARTH · WGS-84", OPS.textDim, 18);
    centerReticleLabel.position.set(2.4, 0.3, 0);
    scene.add(centerReticleLabel);

    // B. Moon Orbit Ring at 1 LD (Dashed, OPS.moon, Brighter)
    const moonRingGeo = new THREE.BufferGeometry();
    const moonPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      moonPts.push(new THREE.Vector3(Math.cos(angle) * lunarRadius3D, 0, Math.sin(angle) * lunarRadius3D));
    }
    moonRingGeo.setFromPoints(moonPts);
    const moonRingMat = new THREE.LineDashedMaterial({
      color: 0x8a94a0,
      dashSize: 0.6,
      gapSize: 0.4,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const moonRingLine = new THREE.Line(moonRingGeo, moonRingMat);
    moonRingLine.computeLineDistances();
    moonRingLine.renderOrder = -10;
    graticuleGroup.add(moonRingLine);
    graticuleMaterialsRef.current.push(moonRingMat);

    // Moon Ring 4px Tick + Label at +X
    const moonTickGeo = new THREE.BufferGeometry();
    moonTickGeo.setFromPoints([
      new THREE.Vector3(lunarRadius3D - 0.8, 0, 0),
      new THREE.Vector3(lunarRadius3D + 0.8, 0, 0),
    ]);
    const moonTickMat = new THREE.LineBasicMaterial({ color: 0x8a94a0, transparent: true, opacity: 0.7 });
    const moonTick = new THREE.Line(moonTickGeo, moonTickMat);
    graticuleGroup.add(moonTick);
    graticuleMaterialsRef.current.push(moonTickMat);

    const moonRingLabel = createTextSprite("1 LD (MOON)", OPS.moon, 18);
    moonRingLabel.position.set(lunarRadius3D + 1.6, 0.2, 0);
    graticuleGroup.add(moonRingLabel);
    graticuleMaterialsRef.current.push(moonRingLabel.material);

    // C. Linear Range Rings in Ecliptic Plane: 5, 10, 20, 50 LD
    const RANGE_RINGS = [5, 10, 20, 50].map((ld) => ({
      ld,
      radius: ld * LD_TO_WORLD,
      label: `${ld} LD`,
    }));

    RANGE_RINGS.forEach((ring) => {
      const ringGeo = new THREE.BufferGeometry();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const theta = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * ring.radius, 0, Math.sin(theta) * ring.radius));
      }
      ringGeo.setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({
        color: 0x3a4a57, // Legible slate-steel
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const line = new THREE.Line(ringGeo, ringMat);
      line.renderOrder = -10;
      graticuleGroup.add(line);
      graticuleMaterialsRef.current.push(ringMat);

      // 4px radial tick cutting the ring at the label position (+X axis)
      const tickGeo = new THREE.BufferGeometry();
      tickGeo.setFromPoints([
        new THREE.Vector3(ring.radius - 0.8, 0, 0),
        new THREE.Vector3(ring.radius + 0.8, 0, 0),
      ]);
      const tickMat = new THREE.LineBasicMaterial({
        color: 0x5a8fb8,
        transparent: true,
        opacity: 0.7,
      });
      const tickLine = new THREE.Line(tickGeo, tickMat);
      graticuleGroup.add(tickLine);
      graticuleMaterialsRef.current.push(tickMat);

      // Tick label sprite attached to right edge
      const tickSprite = createTextSprite(ring.label, OPS.textFaint, 18);
      tickSprite.position.set(ring.radius + 1.6, 0.2, 0);
      graticuleGroup.add(tickSprite);
      graticuleMaterialsRef.current.push(tickSprite.material);
    });

    // D. Radial Spokes every 30° from 1 LD to 50 LD (maxRadius = 300.0)
    const maxRadius = 50 * LD_TO_WORLD;
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = THREE.MathUtils.degToRad(deg);
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const spokeGeo = new THREE.BufferGeometry();
      spokeGeo.setFromPoints([
        new THREE.Vector3(cosA * lunarRadius3D, 0, sinA * lunarRadius3D),
        new THREE.Vector3(cosA * maxRadius, 0, sinA * maxRadius),
      ]);
      const spokeMat = new THREE.LineBasicMaterial({
        color: 0x2a3945,
        transparent: true,
        opacity: 0.25,
      });
      const spokeLine = new THREE.Line(spokeGeo, spokeMat);
      graticuleGroup.add(spokeLine);
      graticuleMaterialsRef.current.push(spokeMat);

      // Skip 0° for longitude labels so it never collides with +X distance labels
      if (deg > 0) {
        const longSprite = createTextSprite(`${deg}°`, OPS.textFaint, 16);
        longSprite.position.set(cosA * (maxRadius + 6.0), 0.2, sinA * (maxRadius + 6.0));
        graticuleGroup.add(longSprite);
        graticuleMaterialsRef.current.push(longSprite.material);
      }
    }

    // ── 10. Radar Conical Sweep Beam (Spanning Linear Range) ──────────────────
    const sweepGeo = new THREE.RingGeometry(0.1, maxRadius + 10, 48, 1, 0, Math.PI / 4);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x5a8fb8,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    sweepMesh.rotation.x = Math.PI / 2;
    scene.add(sweepMesh);
    sweepMeshRef.current = sweepMesh;

    // ── 11. Animation Loop & Glancing Angle Fade ─────────────────────────────
    let animationFrameId: number;
    const clock = new THREE.Clock();
    const camDir = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Earth rotation
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += delta * 0.08;
      }

      // Moon revolution
      if (moonPivotRef.current) {
        moonPivotRef.current.rotation.y += delta * 0.04;
      }

      // Radar sweep
      if (sweepMeshRef.current) {
        sweepMeshRef.current.rotation.z -= delta * 0.6;
      }

      // Tumbling rotation for selected 3D realistic asteroid mesh (0.06 rad/s)
      if (selectedAsteroidMeshRef.current) {
        selectedAsteroidMeshRef.current.rotation.x += delta * 0.04;
        selectedAsteroidMeshRef.current.rotation.y += delta * 0.06;
        selectedAsteroidMeshRef.current.rotation.z += delta * 0.02;
      }

      // Glancing Angle Graticule Fade: opacity *= smoothstep(0.06, 0.35, |dot(camDir, planeNormal)|)
      if (cameraRef.current) {
        cameraRef.current.getWorldDirection(camDir);
        const glanceFactor = THREE.MathUtils.smoothstep(Math.abs(camDir.y), 0.06, 0.35);

        graticuleMaterialsRef.current.forEach((mat) => {
          if ("opacity" in mat) {
            const baseOp = (mat.userData?.baseOpacity as number) || mat.opacity;
            if (!mat.userData?.baseOpacity) {
              mat.userData = { baseOpacity: mat.opacity };
            }
            mat.opacity = baseOp * glanceFactor;
          }
        });

        // 1-2-5 Dynamic Scale Bar Calculation (Linear LD_TO_WORLD)
        if (controlsRef.current && containerRef.current) {
          const dist = cameraRef.current.position.distanceTo(controlsRef.current.target);
          const fovRad = (cameraRef.current.fov * Math.PI) / 180;
          const hWorld = 2 * dist * Math.tan(fovRad / 2);
          const unitsPerPx = hWorld / containerRef.current.clientHeight;

          // Target ~140px on screen
          const targetUnits = 140 * unitsPerPx;
          const targetLD = targetUnits / LD_TO_WORLD;
          const snappedLD = niceScale(Math.max(0.1, targetLD));
          const actualUnits = snappedLD * LD_TO_WORLD;
          const actualPx = Math.max(30, Math.min(260, actualUnits / unitsPerPx));

          setScaleBarLD(snappedLD);
          setScaleBarPx(actualPx);
          setScaleBarKmStr(formatKmWithThinSpaces(Math.round(snappedLD * 384400)));
        }
      }

      // Smooth Camera Fly-To Tracking Interpolation
      if (cameraAnimationRef.current?.active && cameraRef.current && controlsRef.current) {
        const anim = cameraAnimationRef.current;
        const elapsed = performance.now() - anim.startTime;
        const progress = Math.min(1, elapsed / anim.duration);
        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        cameraRef.current.position.lerpVectors(anim.startCamPos, anim.endCamPos, ease);
        controlsRef.current.target.lerpVectors(anim.startTarget, anim.endTarget, ease);

        if (progress >= 1) {
          anim.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // ── Resize Handler ───────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // ── Mode-driven Graticule Visibility ───────────────────────────────────────
  useEffect(() => {
    if (graticuleGroupRef.current) {
      graticuleGroupRef.current.visible = true;
    }
  }, [isOps]);

  // ── Render Flat Sprites, Detailed Selected 3D Mesh & Trajectories ──────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Clean up previously mounted selected 3D realistic asteroid mesh and silhouette (Memory Disposal)
    if (selectedAsteroidMeshRef.current) {
      scene.remove(selectedAsteroidMeshRef.current);
      selectedAsteroidDisposeRef.current?.();
      selectedAsteroidMeshRef.current = null;
      selectedAsteroidDisposeRef.current = null;
    }
    if (landmarkSilhouetteRef.current) {
      scene.remove(landmarkSilhouetteRef.current);
      landmarkSilhouetteRef.current.material.dispose();
      landmarkSilhouetteRef.current = null;
    }

    // 2. Clear old asteroid sprite groups and trajectories
    asteroidMeshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
    });
    asteroidMeshesRef.current.clear();

    trajectoryLinesRef.current.forEach((line) => {
      scene.remove(line);
    });
    trajectoryLinesRef.current = [];

    // 3. Mount Realistic 3D Displaced Mesh for Selected Asteroid
    if (selectedAsteroid?.radar_coord_3d) {
      const sCoord = selectedAsteroid.radar_coord_3d;
      const meshResult = buildAsteroidMesh(selectedAsteroid.id, 4);
      const { mesh, dispose } = meshResult;
      mesh.position.set(sCoord.x, sCoord.y, sCoord.z);
      scene.add(mesh);
      selectedAsteroidMeshRef.current = mesh;
      selectedAsteroidDisposeRef.current = dispose;

      // If active landmark benchmark selected, project 3D silhouette beside target
      if (selectedLandmark) {
        const avgM = selectedAsteroid.avg_diameter_meters || 50;
        const silhouette = createLandmarkSilhouetteSprite(selectedLandmark, avgM);
        silhouette.position.set(sCoord.x + 3.8, sCoord.y + 1.2, sCoord.z);
        scene.add(silhouette);
        landmarkSilhouetteRef.current = silhouette;
      }
    }

    // 4. Rebuild Asteroid Radar Sprites & Precision HUD
    asteroids.forEach((neo: AsteroidNeoObject) => {
      const coord = neo.radar_coord_3d;
      if (!coord) return;

      const group = new THREE.Group();
      group.position.set(coord.x, coord.y, coord.z);
      group.userData = { asteroid: neo };

      const isHazard = neo.is_potentially_hazardous_asteroid;
      const isSelected = selectedAsteroid?.id === neo.id;
      const isHovered = hoveredAsteroid?.id === neo.id;
      const distanceLd = neo.closest_miss_distance_ld || 50;

      const symbolType: "safe" | "caution" | "hazard" = isHazard
        ? "hazard"
        : distanceLd < 5
        ? "caution"
        : "safe";

      // Flat 2D Radar Sprite (Fixed size, sizeAttenuation: false)
      const symbolTexture = createSymbolTexture(symbolType, isSelected);
      const symbolMaterial = new THREE.SpriteMaterial({
        map: symbolTexture,
        sizeAttenuation: false,
        depthWrite: false,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      });

      const symbolSprite = new THREE.Sprite(symbolMaterial);
      const spriteScale = isOps
        ? isSelected
          ? 0.032
          : 0.024
        : isSelected
        ? 0.042
        : 0.034;
      symbolSprite.scale.set(spriteScale, spriteScale, 1.0);
      group.add(symbolSprite);

      // Raycast Hit Sphere
      const hitGeo = new THREE.SphereGeometry(1.6, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { asteroid: neo };
      group.add(hitMesh);

      // Callout Labels (In OPS: selected/hovered only; in PUBLIC: all)
      const shouldShowLabel = isOps ? isSelected || isHovered : true;

      if (shouldShowLabel) {
        // Leader Line (1px, OPS.line)
        const leaderGeo = new THREE.BufferGeometry();
        const leaderPts = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.5, 1.0, 0),
          new THREE.Vector3(3.2, 1.0, 0),
        ];
        leaderGeo.setFromPoints(leaderPts);
        const leaderMat = new THREE.LineBasicMaterial({
          color: 0x1e2a35,
          transparent: true,
          opacity: 0.75,
        });
        const leaderLine = new THREE.Line(leaderGeo, leaderMat);
        group.add(leaderLine);

        // Callout Label Sprite
        const calloutSprite = createCalloutLabelSprite(neo, isOps);
        group.add(calloutSprite);
      }

      // Dropdown Stalk Line to floor plane (y=0)
      const stalkGeo = new THREE.BufferGeometry();
      stalkGeo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -coord.y, 0)]);
      const stalkMat = new THREE.LineBasicMaterial({
        color: 0x1e2a35,
        transparent: true,
        opacity: isOps ? 0.35 : 0.2,
      });
      const stalkLine = new THREE.Line(stalkGeo, stalkMat);
      group.add(stalkLine);

      // Floor plane hairline anchor dot
      const floorDotGeo = new THREE.RingGeometry(0.1, 0.3, 12);
      const floorDotMat = new THREE.MeshBasicMaterial({
        color: 0x1e2a35,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const floorDot = new THREE.Mesh(floorDotGeo, floorDotMat);
      floorDot.position.set(0, -coord.y, 0);
      floorDot.rotation.x = Math.PI / 2;
      group.add(floorDot);

      // Orbit Trail
      if (showOrbits) {
        const angleRad = THREE.MathUtils.degToRad(coord.approachAngleDeg);
        const tangentX = -Math.sin(angleRad);
        const tangentZ = Math.cos(angleRad);
        const trajSpan = 140;
        const trajPts: THREE.Vector3[] = [];
        const steps = 80;
        const bendStrength = Math.max(1.8, 16.0 / Math.sqrt(distanceLd));

        for (let s = -steps; s <= steps; s++) {
          const t = s / steps;
          const distAlongTangent = t * trajSpan;
          const normalToEarth = new THREE.Vector3(-coord.x, 0, -coord.z).normalize();
          const hyperBend = (1 / Math.sqrt(1 + (t * 6) ** 2) - 0.05) * bendStrength;

          const px = coord.x + tangentX * distAlongTangent + normalToEarth.x * hyperBend;
          const py = coord.y + t * 2.5;
          const pz = coord.z + tangentZ * distAlongTangent + normalToEarth.z * hyperBend;

          trajPts.push(new THREE.Vector3(px, py, pz));
        }

        const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
        const trajMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0x5a8fb8 : 0x16212b,
          transparent: true,
          opacity: isSelected ? 0.65 : isOps ? 0.22 : 0.15,
        });
        const trajLine = new THREE.Line(trajGeo, trajMat);
        scene.add(trajLine);
        trajectoryLinesRef.current.push(trajLine);
      }

      scene.add(group);
      asteroidMeshesRef.current.set(neo.id, group);
    });
  }, [asteroids, selectedAsteroid, hoveredAsteroid, showOrbits, isOps, selectedLandmark]);

  // ── Raycasting for Mouse Hover & Selection ─────────────────────────────────
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!container || !camera || !scene) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      const targetGroups = Array.from(asteroidMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(targetGroups, true);

      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current && !current.userData.asteroid && current.parent) {
          current = current.parent;
        }

        if (current && current.userData.asteroid) {
          setHoveredAsteroid(current.userData.asteroid);
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          container.style.cursor = "pointer";
          return;
        }
      }

      setHoveredAsteroid(null);
      setTooltipPos(null);
      container.style.cursor = "grab";
    },
    []
  );

  const handleClick = useCallback(() => {
    if (hoveredAsteroid) {
      onSelectAsteroid(hoveredAsteroid);
    }
  }, [hoveredAsteroid, onSelectAsteroid]);

  // ── Auto-Track Selected Asteroid (Smooth Fly-To Tracking) ──────────────────
  useEffect(() => {
    if (!selectedAsteroid?.radar_coord_3d) return;
    const coord = selectedAsteroid.radar_coord_3d;
    const targetPos = new THREE.Vector3(coord.x, coord.y, coord.z);

    // Compute viewing angle relative to radial line from Earth
    const dirFromCenter = new THREE.Vector3(coord.x, 0, coord.z).normalize();
    if (dirFromCenter.lengthSq() < 0.001) dirFromCenter.set(1, 0, 1).normalize();

    // Framing distance calibrated to asteroid size & radar scale
    const offsetDist = Math.max(14, Math.min(26, (selectedAsteroid.avg_diameter_meters || 50) / 15 + 12));

    const endCamPos = new THREE.Vector3(
      coord.x + dirFromCenter.x * offsetDist + 6,
      coord.y + offsetDist * 0.65,
      coord.z + dirFromCenter.z * offsetDist + 6
    );

    flyToTarget(targetPos, endCamPos, 750);
    setCameraViewMode("target");
  }, [selectedAsteroid?.id, flyToTarget]);

  // ── Camera Preset Controls (Smooth Fly-To Interpolated) ─────────────────────
  const setCameraTopView = () => {
    flyToTarget(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 320, 0.01), 700);
    setCameraViewMode("top");
  };

  const resetCameraFreeView = () => {
    flyToTarget(new THREE.Vector3(0, 0, 0), new THREE.Vector3(52, 45, 52), 700);
    setCameraViewMode("free");
  };

  const focusSelectedTarget = () => {
    if (!selectedAsteroid?.radar_coord_3d) return;
    const coord = selectedAsteroid.radar_coord_3d;
    const targetPos = new THREE.Vector3(coord.x, coord.y, coord.z);

    const dirFromCenter = new THREE.Vector3(coord.x, 0, coord.z).normalize();
    if (dirFromCenter.lengthSq() < 0.001) dirFromCenter.set(1, 0, 1).normalize();

    const offsetDist = Math.max(14, Math.min(26, (selectedAsteroid.avg_diameter_meters || 50) / 15 + 12));
    const endCamPos = new THREE.Vector3(
      coord.x + dirFromCenter.x * offsetDist + 6,
      coord.y + offsetDist * 0.65,
      coord.z + dirFromCenter.z * offsetDist + 6
    );

    flyToTarget(targetPos, endCamPos, 700);
    setCameraViewMode("target");
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden" style={{ background: OPS.bg }}>
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* ── Dynamic 1-2-5 SI Scale Bar (Bottom-Left) ────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none select-none font-mono">
        <div className="relative mb-1" style={{ width: `${scaleBarPx}px` }}>
          {/* Horizontal Line */}
          <div className="h-[1px] w-full" style={{ background: OPS.textDim }} />
          {/* Left Vertical Endcap */}
          <div className="absolute left-0 -top-1 w-[1px] h-[7px]" style={{ background: OPS.textDim }} />
          {/* Right Vertical Endcap */}
          <div className="absolute right-0 -top-1 w-[1px] h-[7px]" style={{ background: OPS.textDim }} />
        </div>
        {/* Metric Readouts */}
        <div className="text-[11px] font-mono tabular-nums leading-none" style={{ color: OPS.text }}>
          {scaleBarLD} LD
        </div>
        {isOps && (
          <>
            <div className="text-[9px] font-mono tabular-nums mt-0.5 leading-none" style={{ color: OPS.textFaint }}>
              {scaleBarKmStr}
            </div>
            <div className="text-[8px] tracking-[0.1em] uppercase mt-1 leading-none" style={{ color: OPS.textFaint }}>
              AT FOCUS PLANE
            </div>
          </>
        )}
      </div>

      {/* ── Overlay Radar HUD Orientation & Controls ────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5">
        {/* Top Radar Orientation Bar */}
        <div
          className="flex items-center gap-3 px-3 py-1.5 border w-fit pointer-events-auto backdrop-blur-sm"
          style={{ background: `${OPS.panel}E6`, borderColor: OPS.line }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: OPS.accent }} />
            <span className={OPS_TYPE.label} style={{ color: OPS.text }}>
              {isOps ? "TOPOCENTRIC NEO RADAR (WGS-84)" : "3D Asteroid Orbit Radar"}
            </span>
          </div>
          <div className="h-3 w-px" style={{ background: OPS.line }} />
          <div className={OPS_TYPE.meta} style={{ color: OPS.textDim }}>
            RANGE: <span style={{ color: OPS.text, fontWeight: 600 }}>50 LD (~19.2M KM)</span>
          </div>
          <div className="h-3 w-px" style={{ background: OPS.line }} />
          <div className={OPS_TYPE.meta} style={{ color: OPS.textDim }}>
            OBJECTS: <span style={{ color: OPS.safe, fontWeight: 600 }}>{asteroids.length} ACTIVE</span>
          </div>
        </div>

        {/* Floating View Controls & Symbology Legend */}
        <div className="flex items-center justify-end pointer-events-auto gap-3">
          {/* Legend */}
          <div
            className="flex items-center gap-4 px-3 py-1.5 border text-[10px] font-mono backdrop-blur-sm"
            style={{ background: `${OPS.panel}F2`, borderColor: OPS.line, color: OPS.textDim }}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: OPS.safe }} />
              <span>Safe (&gt;10 LD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: OPS.caution }} />
              <span>Close Pass (&lt;5 LD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rotate-45" style={{ background: OPS.hazard }} />
              <span style={{ color: OPS.hazard }}>PHA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: OPS.moon }} />
              <span>Moon (1 LD)</span>
            </div>
          </div>

          {/* Camera Controls */}
          <div
            className="flex items-center gap-1 p-1 border backdrop-blur-sm"
            style={{ background: `${OPS.panel}F2`, borderColor: OPS.line }}
          >
            <button
              onClick={resetCameraFreeView}
              title="Reset 3D Perspective View"
              className="px-2.5 py-1 text-[11px] font-mono transition-colors duration-[120ms] flex items-center gap-1.5 cursor-pointer"
              style={{
                background: cameraViewMode === "free" ? OPS.grid : "transparent",
                color: cameraViewMode === "free" ? OPS.text : OPS.textDim,
                border: cameraViewMode === "free" ? `1px solid ${OPS.accent}` : "1px solid transparent",
              }}
            >
              <RefreshCw className="w-3 h-3" />
              <span>3D ORBIT</span>
            </button>

            <button
              onClick={setCameraTopView}
              title="Polar Top-Down Radar View"
              className="px-2.5 py-1 text-[11px] font-mono transition-colors duration-[120ms] flex items-center gap-1.5 cursor-pointer"
              style={{
                background: cameraViewMode === "top" ? OPS.grid : "transparent",
                color: cameraViewMode === "top" ? OPS.text : OPS.textDim,
                border: cameraViewMode === "top" ? `1px solid ${OPS.accent}` : "1px solid transparent",
              }}
            >
              <Compass className="w-3 h-3" />
              <span>POLAR 2D</span>
            </button>

            {selectedAsteroid && (
              <button
                onClick={focusSelectedTarget}
                title="Lock Camera on Target Asteroid"
                className="px-2.5 py-1 text-[11px] font-mono border transition-colors duration-[120ms] flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: OPS.grid,
                  borderColor: OPS.accent,
                  color: OPS.accent,
                }}
              >
                <Crosshair className="w-3 h-3" />
                <span>LOCK TARGET</span>
              </button>
            )}

            <button
              onClick={() => setShowOrbits(!showOrbits)}
              title="Toggle Extended Flyby Trajectories"
              className="px-2.5 py-1 text-[11px] font-mono transition-colors duration-[120ms] flex items-center gap-1.5 cursor-pointer"
              style={{
                background: showOrbits ? OPS.grid : "transparent",
                color: showOrbits ? OPS.text : OPS.textFaint,
                border: showOrbits ? `1px solid ${OPS.line}` : "1px solid transparent",
              }}
            >
              <Layers className="w-3 h-3" />
              <span>ORBITS</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive Hover Tooltip (Clamped to viewport) ────────────────── */}
      {hoveredAsteroid && tooltipPos && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full border p-3 text-xs font-mono min-w-[220px] backdrop-blur-md"
          style={{
            left: Math.max(120, Math.min((containerRef.current?.clientWidth || 800) - 120, tooltipPos.x)),
            top: Math.max(20, tooltipPos.y - 15),
            background: `${OPS.panel}F5`,
            borderColor: OPS.line,
            color: OPS.text,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-1.5" style={{ borderColor: OPS.line }}>
            <span className="font-semibold" style={{ color: OPS.text }}>
              {hoveredAsteroid.name}
            </span>
            {hoveredAsteroid.is_potentially_hazardous_asteroid ? (
              <span className="text-[9px] font-bold tracking-wider" style={{ color: OPS.hazard }}>
                PHA
              </span>
            ) : (hoveredAsteroid.closest_miss_distance_ld || 99) < 5 ? (
              <span className="text-[9px] font-medium tracking-wider" style={{ color: OPS.caution }}>
                CLOSE PASS
              </span>
            ) : (
              <span className="text-[9px] font-medium tracking-wider" style={{ color: OPS.safe }}>
                SAFE
              </span>
            )}
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span style={{ color: OPS.textDim }}>Miss Distance:</span>
              <span className="font-mono tabular-nums" style={{ color: OPS.text }}>
                {hoveredAsteroid.closest_miss_distance_ld?.toFixed(2)} LD
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: OPS.textDim }}>Est. Diameter:</span>
              <span className="font-mono tabular-nums" style={{ color: OPS.text }}>
                {hoveredAsteroid.avg_diameter_meters} m
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: OPS.textDim }}>Velocity:</span>
              <span className="font-mono tabular-nums" style={{ color: OPS.text }}>
                {Math.round(hoveredAsteroid.velocity_kmh || 0).toLocaleString()} km/h
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
