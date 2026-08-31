"use client";

/**
 * MissionTheater — Ultra-HD Astrodynamics 3D Visualization Deck.
 * Photorealistic Earth, Moon, and Physics-Based Luminous Trajectory Splines.
 *
 * Guaranteed Crisp Visuals & Rock-Solid DOM Isolation:
 *   1. Isolated Canvas Container: Three.js canvas mounts in a dedicated child div, completely isolated from React UI reconciliation.
 *   2. Ultra-HD Single-Layer Photorealistic Earth: 4K NASA day map, bump terrain, specular ocean reflections, and night city lights (zero ghosting/double layers).
 *   3. Rayleigh atmospheric blue limb along the curved horizon.
 *   4. Clean Standby State: Before running analysis, only the pristine rotating Earth (and Moon in Lunar mode) is displayed without premature lines.
 *   5. Active Trajectory: Continuous glowing 3D Catmull-Rom spline tubes (TubeGeometry) + luminous core lines generated 100% on-demand.
 *   6. Animated 3D Satellite / Spacecraft Probe with real-time flight trajectory tracking & velocity vector.
 *   7. Cinematic camera framing with 6 quick-focus perspectives.
 */

import React, { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  MissionCandidate,
  MissionType,
  Vec3,
  LaunchSite,
} from "@/lib/mission-control/types";
import { eciKmToRendererPosition, RENDERER_SCALE } from "@/lib/mission-control/coordinateTransforms";
import { summarizeTrajectory, type TrajectorySummary } from "@/lib/mission-control/trajectoryValidation";
import {
  Maximize2,
  Globe,
  Moon as MoonIcon,
  Compass,
  Play,
  Pause,
  RotateCcw,
  Activity,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Layers,
} from "lucide-react";
import { gmstRad, launchSiteEciM } from "@/lib/mission-control/ascentModel";
import { moonOrbitPathEciKm } from "@/lib/mission-control/moonOrbitPath";
import { getMoonPositionEciM } from "@/lib/mission-control/ephemeris";



interface MissionTheaterProps {
  candidate: MissionCandidate | null;
  missionType: MissionType;
  moonPositionKm?: Vec3;
  launchSite?: LaunchSite;
  targetAltitudeKm?: number;
  targetInclinationDeg?: number;
  targetPeriluneAltitudeKm?: number;
  launchDateUtc?: string;
}

// ── Color map by trajectory phase ────────────────────────────────────────────
interface PhaseStyle {
  color: number;
  hex: string;
  label: string;
}

const PHASE_COLORS: Record<string, PhaseStyle> = {
  launch: { color: 0xef4444, hex: "#ef4444", label: "Pad Liftoff & Atmospheric Ascent" },
  ascent: { color: 0xf59e0b, hex: "#f59e0b", label: "Gravity Turn Pitch" },
  parking_orbit: { color: 0x06b6d4, hex: "#06b6d4", label: "Circular Orbit (Parking / Target)" },
  tli: { color: 0xf97316, hex: "#f97316", label: "TLI Burn" },
  outbound: { color: 0xf97316, hex: "#f97316", label: "Outbound TLI Transfer" },
  lunar_flyby: { color: 0xc084fc, hex: "#c084fc", label: "Perilune Lunar Flyby" },
  return: { color: 0x38bdf8, hex: "#38bdf8", label: "Earth Free-Return Leg" },
  reentry_interface: { color: 0x60a5fa, hex: "#60a5fa", label: "Reentry Corridor" },
};

/**
 * Satellite missions reuse the "outbound" phase for the Hohmann transfer
 * ellipse. Orange would be nearly indistinguishable from the amber gravity
 * turn, so the coast arc is rendered green and labelled for what it is.
 */
const SATELLITE_PHASE_OVERRIDES: Record<string, PhaseStyle> = {
  outbound: { color: 0x22c55e, hex: "#22c55e", label: "Hohmann Transfer Ellipse" },
};

const PHASE_FALLBACK: PhaseStyle = { color: 0x00f0ff, hex: "#00f0ff", label: "Coast Arc" };

/** Single source of truth for phase colors — used by both renderer and legend. */
function resolvePhaseStyle(phase: string, type: MissionType): PhaseStyle {
  if (type === "satellite_launch" && SATELLITE_PHASE_OVERRIDES[phase]) {
    return SATELLITE_PHASE_OVERRIDES[phase];
  }
  return PHASE_COLORS[phase] ?? PHASE_FALLBACK;
}

const EARTH_RADIUS_VIS = 6.378137; // 6,378 km in Scene units (1 unit = 1,000 km)

// ── Sun Direction in ECI from calendar date (low-precision solar ephemeris) ─
function getSunDirectionECI(dateUtc?: string): THREE.Vector3 {
  const date = dateUtc ? new Date(dateUtc) : new Date();
  const JD = date.getTime() / 86400000 + 2440587.5;
  const n = JD - 2451545.0; // days since J2000.0
  const L = ((280.46 + 0.9856474 * n) % 360) * (Math.PI / 180);
  const g = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  const lambda = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);
  const epsilon = 23.439 * (Math.PI / 180); // mean obliquity
  return new THREE.Vector3(
    Math.cos(lambda),
    Math.sin(lambda) * Math.cos(epsilon),
    Math.sin(lambda) * Math.sin(epsilon)
  ).normalize();
}

// ── Moon ShaderMaterial — visualization mode: always bright, sun affects terminator shape ─
// In a space mission visualizer, the Moon must ALWAYS be visible regardless of phase.
// We use a dual-light model:
//   - Primary: sun direction (controls lit vs shadow terminator)
//   - Minimum: camera-facing ambient so Moon is never invisible in visualization
const MOON_VISUAL_RADIUS = 1.737 * 2.8; // ≈ 4.86 scene-units, clearly smaller than Earth (6.378)

function createPhaseMoonMaterial(moonTexture: THREE.Texture, sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      moonTexture: { value: moonTexture },
      sunDirection: { value: sunDir.clone() },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D moonTexture;
      uniform vec3 sunDirection;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vec4 texColor = texture2D(moonTexture, vUv);
        vec3 norm = normalize(vWorldNormal);
        vec3 sun  = normalize(sunDirection);

        // Realistic solar terminator
        float cosTheta = dot(norm, sun);
        float terminator = smoothstep(-0.05, 0.12, cosTheta);
        float solarLight = max(0.0, cosTheta) * terminator;

        // Visualization fill light: always illuminate the Moon enough to be seen.
        // Uses a soft top-front key light (camera-general direction) to ensure
        // the Moon is NEVER invisible even at new moon phase.
        float fillLight = max(0.0, dot(norm, normalize(vec3(0.3, 0.5, 1.0)))) * 0.55;

        // Combine: solar light dominates lit side, fill ensures visibility everywhere
        float light = max(solarLight * 1.4, fillLight) + 0.08; // 0.08 = earthshine base

        // Subtle cool earthshine on shadow side
        vec3 earthshine = vec3(0.08, 0.15, 0.40) * (1.0 - terminator) * 0.20;

        vec3 color = texColor.rgb * clamp(light, 0.0, 1.6) + earthshine;
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `,
  });
}

export default function MissionTheater({
  candidate,
  missionType,
  moonPositionKm,
  launchSite,
  launchDateUtc,
}: MissionTheaterProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number>(0);
  const trajectoryGroupRef = useRef<THREE.Group | null>(null);
  const probeGroupRef = useRef<THREE.Group | null>(null);
  const probeHaloRef = useRef<THREE.Mesh | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const moonGroupRef = useRef<THREE.Group | null>(null);

  // States
  const [isPlaying, setIsPlaying] = useState(true);
  const [animProgress, setAnimProgress] = useState(0);
  const [cameraMode, setCameraMode] = useState<string>("Fit Full Trajectory");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrajectorySummary | null>(null);

  const animProgressRef = useRef(0);
  const isPlayingRef = useRef(true);
  const trajectoryCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const pulseMarkersRef = useRef<THREE.Mesh[]>([]);
  // Ref so renderMissionTrajectory (memoized) always reads the current launch date
  const launchDateUtcRef = useRef<string | undefined>(launchDateUtc);
  launchDateUtcRef.current = launchDateUtc; // sync on every render
  const earthSpinRef = useRef(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ── Camera Positioning Helper ──────────────────────────────────────────
  const applyCameraFraming = useCallback(
    (mode: string, cand: MissionCandidate | null, type: MissionType, moonKm?: Vec3) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      setCameraMode(mode);

      if (mode === "Focus Earth") {
        camera.position.set(0, 12, 18);
        controls.target.set(0, 0, 0);
      } else if (mode === "Focus Launch" && cand && cand.trajectory.length > 0) {
        const p0 = eciKmToRendererPosition(cand.trajectory[0].positionEciKm);
        const vDir = new THREE.Vector3(p0.x, p0.y, p0.z).normalize();
        camera.position.set(p0.x + vDir.x * 5, p0.y + 3.5, p0.z + vDir.z * 5);
        controls.target.set(p0.x, p0.y, p0.z);
      } else if (mode === "Focus Orbit") {
        camera.position.set(0, 20, 8);
        controls.target.set(0, 0, 0);
      } else if (mode === "Focus Polar") {
        if (type === "satellite_launch") {
          camera.position.set(0, 26, 0.1);
          controls.target.set(0, 0, 0);
        } else {
          // Lunar polar view — look straight down (+Y) over the entire Earth–Moon plane
          const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
          if (cand && cand.trajectory.length > 0) {
            const step = Math.max(1, Math.floor(cand.trajectory.length / 500));
            for (let i = 0; i < cand.trajectory.length; i += step) {
              const rp = eciKmToRendererPosition(cand.trajectory[i].positionEciKm);
              pts.push(new THREE.Vector3(rp.x, rp.y, rp.z));
            }
          }
          if (moonGroupRef.current) pts.push(moonGroupRef.current.position.clone());
          else if (moonKm) {
            const mp = eciKmToRendererPosition(moonKm);
            pts.push(new THREE.Vector3(mp.x, mp.y, mp.z));
          }
          const box = new THREE.Box3().setFromPoints(pts);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          // FOV-based height for top-down view (use XZ plane dimensions)
          const halfFovRad = (camera.fov * Math.PI) / 180 / 2;
          const halfXZ = Math.sqrt((size.x / 2) ** 2 + (size.z / 2) ** 2);
          const tanH = Math.tan(halfFovRad);
          const tanW = tanH * camera.aspect;
          const fovFactor = Math.min(tanH, tanW);
          const height = (halfXZ / fovFactor) * 1.4;
          camera.position.set(center.x, center.y + height, center.z + 0.1);
          controls.target.copy(center);
        }
      } else if (mode === "Focus Moon Encounter") {
        // Zoom into Moon — get Moon position from ref or prop
        let mPos: THREE.Vector3 | null = null;
        if (moonGroupRef.current) {
          mPos = moonGroupRef.current.position.clone();
        } else if (moonKm) {
          const mp = eciKmToRendererPosition(moonKm);
          mPos = new THREE.Vector3(mp.x, mp.y, mp.z);
        }
        if (mPos) {
          // Pull back ~30 scene units from Moon (≈ 30,000 km, fills ~40% of screen)
          const halfFovRad = (camera.fov * Math.PI) / 180 / 2;
          const moonRad = MOON_VISUAL_RADIUS;
          const moonDist = moonRad / Math.tan(halfFovRad) * 2.8;
          const viewDir = new THREE.Vector3(0.4, 0.3, 1.0).normalize();
          camera.position.copy(mPos).addScaledVector(viewDir, moonDist);
          controls.target.copy(mPos);
        } else {
          // fallback if moon not yet in scene
          camera.position.set(250, 100, 300);
          controls.target.set(200, 50, 250);
        }
      } else {
        // Default "Fit Full Trajectory"
        if (type === "satellite_launch") {
          if (cand && cand.trajectory.length > 0) {
            const p0 = eciKmToRendererPosition(cand.trajectory[0].positionEciKm);
            const midIndex = Math.min(Math.floor(cand.trajectory.length * 0.4), cand.trajectory.length - 1);
            const pMid = eciKmToRendererPosition(cand.trajectory[midIndex].positionEciKm);

            const vCenter = new THREE.Vector3(
              (p0.x + pMid.x) * 0.5,
              (p0.y + pMid.y) * 0.5,
              (p0.z + pMid.z) * 0.5
            ).normalize();
            if (vCenter.lengthSq() < 0.01) vCenter.set(1, 0.4, 0.3).normalize();

            const camPos = vCenter.clone().multiplyScalar(20).add(new THREE.Vector3(0, 8, 0));
            camera.position.copy(camPos);
          } else {
            camera.position.set(14, 11, 16);
          }
          controls.target.set(0, 0, 0);
        } else {
          // ── Lunar "Fit All" — robustly frames Earth, Moon & Full Trajectory Loop ──
          let moonPos: THREE.Vector3 | null = null;
          if (moonGroupRef.current) {
            moonPos = moonGroupRef.current.position.clone();
          } else if (cand?.moonPositionAtPeriluneKm) {
            const mp = eciKmToRendererPosition(cand.moonPositionAtPeriluneKm);
            moonPos = new THREE.Vector3(mp.x, mp.y, mp.z);
          } else if (moonKm) {
            const mp = eciKmToRendererPosition(moonKm);
            moonPos = new THREE.Vector3(mp.x, mp.y, mp.z);
          }

          const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
          if (moonPos) pts.push(moonPos);
          if (cand && cand.trajectory && cand.trajectory.length > 0) {
            const step = Math.max(1, Math.floor(cand.trajectory.length / 300));
            for (let i = 0; i < cand.trajectory.length; i += step) {
              const rp = eciKmToRendererPosition(cand.trajectory[i].positionEciKm);
              pts.push(new THREE.Vector3(rp.x, rp.y, rp.z));
            }
          }

          const box = new THREE.Box3().setFromPoints(pts);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);

          const halfFovRad = (camera.fov * Math.PI) / 180 / 2;
          const maxDim = Math.max(size.x, size.y, size.z, 200);
          const tanH = Math.tan(halfFovRad);
          const tanW = tanH * camera.aspect;
          const fovFactor = Math.min(tanH, tanW);
          const camDist = (maxDim / 2 / fovFactor) * 1.35;

          const camDir = new THREE.Vector3(0.08, 0.45, 0.89).normalize();
          camera.position.copy(center).addScaledVector(camDir, camDist);
          controls.target.copy(center);
        }
      }

      camera.updateProjectionMatrix();
      controls.update();
    },
    []
  );


  // ── Trajectory & Scene Builder ─────────────────────────────────────────
  const renderMissionTrajectory = useCallback(
    (cand: MissionCandidate | null, type: MissionType, moonKm?: Vec3, site?: LaunchSite) => {
      const scene = sceneRef.current;
      const trajGroup = trajectoryGroupRef.current;
      if (!scene || !trajGroup) return;

      // 1. Clear previous trajectory objects
      pulseMarkersRef.current = [];
      while (trajGroup.children.length > 0) {
        const child = trajGroup.children[0];
        trajGroup.remove(child);
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      }

      // Remove existing moon mesh if any
      const existingMoon = scene.getObjectByName("moonGroup");
      if (existingMoon) scene.remove(existingMoon);
      moonGroupRef.current = null;

      // 1.5 Render Dedicated 3D Launch Site / Departure Pad Surface Beacon
      if (site) {
        // Must use the SAME epoch the planner used for trajectory[0], otherwise
        // the beacon and the trajectory separate by the GMST difference.
        const epochUtc = launchDateUtcRef.current ?? new Date().toISOString();
        earthSpinRef.current = gmstRad(epochUtc);

        const siteM = launchSiteEciM(site.latitudeDeg, site.longitudeDeg, epochUtc);
        const siteEciKm = { x: siteM.x / 1000, y: siteM.y / 1000, z: siteM.z / 1000 };

        const sPos = eciKmToRendererPosition(siteEciKm);
        const sVec = new THREE.Vector3(sPos.x, sPos.y, sPos.z);
        const sNorm = sVec.clone().normalize();

        // A. Surface Pad Ring Target
        const padRingGeo = new THREE.RingGeometry(0.12, 0.32, 32);
        const padRingMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        });
        const padRing = new THREE.Mesh(padRingGeo, padRingMat);
        padRing.position.copy(sVec.clone().add(sNorm.clone().multiplyScalar(0.03)));
        padRing.lookAt(sVec.clone().add(sNorm));
        trajGroup.add(padRing);

        // B. Glowing Vertical Departure Beacon Beam
        const beamLen = 0.85;
        const beamGeo = new THREE.CylinderGeometry(0.02, 0.04, beamLen, 16);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.copy(sVec.clone().add(sNorm.clone().multiplyScalar(beamLen * 0.5)));
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sNorm);
        trajGroup.add(beam);

        // C. Top Pulsing Beacon Tip
        const tipGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.copy(sVec.clone().add(sNorm.clone().multiplyScalar(beamLen)));
        trajGroup.add(tip);

        const tipAuraGeo = new THREE.SphereGeometry(0.22, 16, 16);
        const tipAuraMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
        });
        const tipAura = new THREE.Mesh(tipAuraGeo, tipAuraMat);
        tipAura.position.copy(tip.position);
        trajGroup.add(tipAura);
        pulseMarkersRef.current.push(tipAura);
      }

      // ── CLEAN STANDBY STATE (Before Running Analysis) ─────────────────────
      if (!cand || cand.trajectory.length < 2) {
        trajectoryCurveRef.current = null;
        if (probeGroupRef.current) probeGroupRef.current.visible = false;
        setSummary(null);

        // Standby Moon in Lunar Mode at true astronomical position
        if (type === "lunar_free_return" && moonKm) {
          const textureLoader = new THREE.TextureLoader();
          // Moon radius: visually ~2.2× real to stay legible at 384-unit distance,
          // but still clearly smaller than Earth (6.378 units) at 3.82 units.
          const moonRadius = MOON_VISUAL_RADIUS;
          const moonGroup = new THREE.Group();
          moonGroup.name = "moonGroup";

          const moonTex = textureLoader.load("/textures/planets/moon.jpg");
          moonTex.colorSpace = THREE.SRGBColorSpace;
          moonTex.anisotropy = 8;
          const sunDir = getSunDirectionECI(launchDateUtcRef.current);
          const moonMat = createPhaseMoonMaterial(moonTex, sunDir);
          const moonGeo = new THREE.SphereGeometry(moonRadius, 48, 48);
          const moon = new THREE.Mesh(moonGeo, moonMat);
          moonGroup.add(moon);

          // Bright corona / glow halo around the Moon so it pops against space
          const moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(moonRadius * 1.18, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 0xd4c8b0,
              transparent: true,
              opacity: 0.28,
              side: THREE.BackSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          );
          moonGroup.add(moonGlow);

          const mPos = eciKmToRendererPosition(moonKm);
          moonGroup.position.set(mPos.x, mPos.y, mPos.z);
          scene.add(moonGroup);
          moonGroupRef.current = moonGroup;

          // Moon Orbit Ring
          const orbitPath = moonOrbitPathEciKm(
            launchDateUtcRef.current ?? new Date().toISOString()
          );
          const ringPoints = orbitPath.points.map((p) => {
            const rp = eciKmToRendererPosition(p);
            return new THREE.Vector3(rp.x, rp.y, rp.z);
          });

          const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
          // Very faint ring: only a subtle reference, must NOT dominate the view
          const ringMat = new THREE.LineBasicMaterial({
            color: 0x334155,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
          });
          trajGroup.add(new THREE.Line(ringGeo, ringMat));
        }

        applyCameraFraming("Fit Full Trajectory", null, type, moonKm);
        return;
      }

      // ── ACTIVE TRAJECTORY RENDERING (On-Demand Execution) ────────────────
      const points = cand.trajectory;
      setRenderError(null);

      try {
        // Trajectory Diagnostic Summary
        const diagSummary = summarizeTrajectory(cand, type);
        setSummary(diagSummary);

        // 2. Render Moon for Lunar Missions (Positioned at True Ephemeris Center)
        if (type === "lunar_free_return") {
          const textureLoader = new THREE.TextureLoader();
          // Moon radius: visually ~2.2× real to stay legible at 384-unit distance,
          // but still clearly smaller than Earth (6.378 units) at 3.82 units.
          const moonRadius = MOON_VISUAL_RADIUS;
          const moonGroup = new THREE.Group();
          moonGroup.name = "moonGroup";

          const moonTex = textureLoader.load("/textures/planets/moon.jpg");
          moonTex.colorSpace = THREE.SRGBColorSpace;
          moonTex.anisotropy = 8;
          const sunDir = getSunDirectionECI(launchDateUtcRef.current);
          const moonMat = createPhaseMoonMaterial(moonTex, sunDir);
          const moonGeo = new THREE.SphereGeometry(moonRadius, 64, 64);
          const moon = new THREE.Mesh(moonGeo, moonMat);
          moonGroup.add(moon);

          // Warm corona glow aura
          const moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(moonRadius * 1.18, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 0xd4c8a8,
              transparent: true,
              opacity: 0.28,
              side: THREE.BackSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          );
          moonGroup.add(moonGlow);

          // Exact Moon ephemeris center position at arrival / perilune epoch
          let moonCenterKm: Vec3;
          if (cand.moonPositionAtPeriluneKm) {
            moonCenterKm = cand.moonPositionAtPeriluneKm;
          } else if (cand.closestMoonApproachUtc) {
            const mM = getMoonPositionEciM(new Date(cand.closestMoonApproachUtc));
            moonCenterKm = { x: mM.x / 1000, y: mM.y / 1000, z: mM.z / 1000 };
          } else {
            const periluneEvt = cand.events.find((e) => e.type === "lunar_closest_approach");
            if (periluneEvt) {
              moonCenterKm = periluneEvt.positionEciKm;
            } else {
              moonCenterKm = moonKm || { x: 384400, y: 0, z: 0 };
            }
          }
          const mPos = eciKmToRendererPosition(moonCenterKm);
          moonGroup.position.set(mPos.x, mPos.y, mPos.z);
          scene.add(moonGroup);
          moonGroupRef.current = moonGroup;

          // Moon Orbit Ring around Earth
          const orbitPath = moonOrbitPathEciKm(
            launchDateUtcRef.current ?? new Date().toISOString()
          );
          const ringPoints = orbitPath.points.map((p) => {
            const rp = eciKmToRendererPosition(p);
            return new THREE.Vector3(rp.x, rp.y, rp.z);
          });
          const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
          // Very faint ring: only a subtle reference, must NOT dominate the view
          const ringMat = new THREE.LineBasicMaterial({
            color: 0x334155,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
          });
          trajGroup.add(new THREE.Line(ringGeo, ringMat));
        }

        // 3. Build Continuous 3D Trajectory Splines & Compact Luminous Tubes
        const all3DPoints: THREE.Vector3[] = [];
        const tubeRadius = type === "satellite_launch" ? 0.035 : 0.12;

        let segStart = 0;
        while (segStart < points.length) {
          const currentPhase = points[segStart].phase;
          let segEnd = segStart;
          while (segEnd < points.length - 1 && points[segEnd + 1].phase === currentPhase) {
            segEnd++;
          }

          const segPoints: THREE.Vector3[] = [];
          // Prepend last point from previous segment to eliminate visual gaps
          if (segStart > 0) {
            const prevRPos = eciKmToRendererPosition(points[segStart - 1].positionEciKm);
            segPoints.push(new THREE.Vector3(prevRPos.x, prevRPos.y, prevRPos.z));
          }
          for (let i = segStart; i <= segEnd; i++) {
            const rPos = eciKmToRendererPosition(points[i].positionEciKm);
            const v = new THREE.Vector3(rPos.x, rPos.y, rPos.z);
            segPoints.push(v);
            all3DPoints.push(v);
          }

          // Clean duplicate consecutive points
          const cleanSegPoints: THREE.Vector3[] = [segPoints[0]];
          for (let i = 1; i < segPoints.length; i++) {
            if (segPoints[i].distanceTo(cleanSegPoints[cleanSegPoints.length - 1]) > 0.0001) {
              cleanSegPoints.push(segPoints[i]);
            }
          }

          if (cleanSegPoints.length >= 2) {
            const conf = resolvePhaseStyle(currentPhase, type);


            // A. Sharp high-intensity core line overlay
            const lineGeo = new THREE.BufferGeometry().setFromPoints(cleanSegPoints);
            const lineMat = new THREE.LineBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.95,
            });
            const lineMesh = new THREE.Line(lineGeo, lineMat);
            lineMesh.renderOrder = 910;
            trajGroup.add(lineMesh);

            // B. 3D Spline Curve
            const curve =
              cleanSegPoints.length === 2
                ? new THREE.LineCurve3(cleanSegPoints[0], cleanSegPoints[1])
                : new THREE.CatmullRomCurve3(cleanSegPoints, false, "centripetal");

            const segments = Math.max(cleanSegPoints.length * 3, 32);

            // C. Primary Sleek Luminous Solid Tube (Compact)
            const tubeGeo = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);
            const tubeMat = new THREE.MeshBasicMaterial({
              color: conf.color,
            });
            const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
            tubeMesh.renderOrder = 900;
            trajGroup.add(tubeMesh);

            // D. Outer Glowing Aura Tube (Slim Glow)
            const auraGeo = new THREE.TubeGeometry(curve, segments, tubeRadius * 1.8, 6, false);
            const auraMat = new THREE.MeshBasicMaterial({
              color: conf.color,
              transparent: true,
              opacity: 0.32,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const auraMesh = new THREE.Mesh(auraGeo, auraMat);
            auraMesh.renderOrder = 890;
            trajGroup.add(auraMesh);
          }

          segStart = segEnd + 1;
        }

        // 4. Build Complete Trajectory Curve for Animated Probe
        if (all3DPoints.length >= 2) {
          const cleanAll: THREE.Vector3[] = [all3DPoints[0]];
          for (let k = 1; k < all3DPoints.length; k++) {
            if (all3DPoints[k].distanceTo(cleanAll[cleanAll.length - 1]) > 0.001) {
              cleanAll.push(all3DPoints[k]);
            }
          }
          if (cleanAll.length >= 2) {
            trajectoryCurveRef.current = new THREE.CatmullRomCurve3(cleanAll, false, "centripetal");
            if (probeGroupRef.current) probeGroupRef.current.visible = true;
          }
        }

        // 5. Aerospace Event Markers (Compact & Sleek)
        for (const event of cand.events) {
          const rPos = eciKmToRendererPosition(event.positionEciKm);
          const markerPos = new THREE.Vector3(rPos.x, rPos.y, rPos.z);

          const markerColor =
            event.type === "liftoff"
              ? 0x00f0ff
              : event.type === "pitch_over"
                ? 0x38bdf8
                : event.type === "orbit_insertion"
                  ? 0x22c55e
                  : event.type === "tli_burn"
                    ? 0xf59e0b
                    : event.type === "lunar_closest_approach"
                      ? 0xd946ef
                      : 0x38bdf8;

          const markerRadius =
            event.type === "lunar_closest_approach"
              ? 0.45
              : type === "satellite_launch"
                ? 0.09
                : 0.14;

          // Inner Solid Core Sphere
          const markerGeo = new THREE.SphereGeometry(markerRadius, 16, 16);
          const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const marker = new THREE.Mesh(markerGeo, markerMat);
          marker.position.copy(markerPos);
          marker.renderOrder = 960;
          trajGroup.add(marker);

          // Pulsing Aura Ring
          const auraGeo = new THREE.SphereGeometry(markerRadius * 1.8, 16, 16);
          const auraMat = new THREE.MeshBasicMaterial({
            color: markerColor,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const aura = new THREE.Mesh(auraGeo, auraMat);
          aura.position.copy(markerPos);
          aura.renderOrder = 955;
          trajGroup.add(aura);
          pulseMarkersRef.current.push(aura);
        }

        // 6. Automatically adjust camera to frame active trajectory
        applyCameraFraming("Fit Full Trajectory", cand, type, moonKm);
      } catch (err: unknown) {
        console.error("[MissionTheater] Rendering error:", err);
        setRenderError(err instanceof Error ? err.message : "Unknown render error");
      }
    },
    [applyCameraFraming]
  );

  // ── Initialize Scene & Lifecycles ──────────────────────────────────────
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500000);
    camera.position.set(14, 11, 16);
    cameraRef.current = camera;
    scene.add(camera);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Clear any previous child in canvas container ONLY
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);

    // 4. OrbitControls — natural "push the globe" feel
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6.8;
    controls.maxDistance = 50000;
    // rotateSpeed = -1: drag right → globe rotates right ("push the globe" / grab-and-spin feel)
    controls.rotateSpeed = -1;
    controlsRef.current = controls;

    // 5. Omnidirectional Daylight Illumination (100% Daylight Everywhere — Zero Dark Spots)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbcd4f0, 1.15);
    scene.add(hemiLight);

    // 4-point balanced daylight key lights to ensure all hemispheres are clearly visible
    const sun1 = new THREE.DirectionalLight(0xfffaee, 1.2);
    sun1.position.set(100, 60, 100);
    scene.add(sun1);

    const sun2 = new THREE.DirectionalLight(0xf0f6ff, 1.2);
    sun2.position.set(-100, 60, -100);
    scene.add(sun2);

    const sun3 = new THREE.DirectionalLight(0xeef4ff, 0.9);
    sun3.position.set(100, -50, -100);
    scene.add(sun3);

    const sun4 = new THREE.DirectionalLight(0xeef4ff, 0.9);
    sun4.position.set(-100, -50, 100);
    scene.add(sun4);

    // 6. Photorealistic Ultra-HD Earth Surface (100% Daytime NASA 4K Blue Marble)
    const textureLoader = new THREE.TextureLoader();
    const dayMap = textureLoader.load("/textures/planets/earth_4k.jpg");
    dayMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = maxAniso;

    const bumpMap = textureLoader.load("/textures/planets/earth_bump.jpg");
    bumpMap.anisotropy = maxAniso;

    const specMap = textureLoader.load("/textures/planets/earth_specular.jpg");
    specMap.anisotropy = maxAniso;

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_VIS, 128, 128);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayMap,
      bumpMap: bumpMap,
      bumpScale: 0.035,
      specularMap: specMap,
      specular: new THREE.Color(0x334466),
      shininess: 22,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.name = "earth";
    scene.add(earth);
    earthMeshRef.current = earth;

    // 7. Rayleigh Atmospheric Limb Glow (Thin Fresnel Rim on Curved Horizon)
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS_VIS * 1.012, 96, 96);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = 1.0 - max(0.0, dot(vNormal, vViewDir));
          float intensity = pow(rim, 4.5) * 1.8;
          vec3 cyanLimb = vec3(0.22, 0.74, 1.0);
          vec3 deepBlue = vec3(0.04, 0.28, 0.85);
          vec3 color = mix(deepBlue, cyanLimb, pow(rim, 1.8));
          gl_FragColor = vec4(color, clamp(intensity, 0.0, 0.85));
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // 8. Starfield Background
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 2500 + Math.random() * 5000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.4,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // 9. Trajectory Group Container
    const trajGroup = new THREE.Group();
    trajGroup.name = "trajectories";
    scene.add(trajGroup);
    trajectoryGroupRef.current = trajGroup;

    // 10. Spacecraft / Probe 3D Model (Compact & Sleek)
    const probeGroup = new THREE.Group();
    probeGroup.name = "spacecraftProbe";

    // Gold bus
    const busGeo = new THREE.BoxGeometry(0.16, 0.16, 0.24);
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.3,
    });
    const bus = new THREE.Mesh(busGeo, busMat);
    probeGroup.add(bus);

    // Solar Wings
    const wingGeo = new THREE.BoxGeometry(0.55, 0.015, 0.16);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.9,
      roughness: 0.1,
      emissive: new THREE.Color(0x0369a1),
      emissiveIntensity: 0.4,
    });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    probeGroup.add(wing);

    // Luminous Beacon Core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), coreMat);
    core.renderOrder = 1000;
    probeGroup.add(core);

    // Pulsing Halo
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), haloMat);
    halo.renderOrder = 999;
    probeGroup.add(halo);
    probeHaloRef.current = halo;

    probeGroup.visible = false;
    scene.add(probeGroup);
    probeGroupRef.current = probeGroup;

    // 11. Initial trajectory or Standby rendering
    renderMissionTrajectory(candidate, missionType, moonPositionKm);

    // 12. Animation Loop
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();

      // Earth rotation: rotates gently during standby; locks at launch epoch when trajectory is loaded
      if (earthMeshRef.current) {
        if (!trajectoryCurveRef.current) {
          earthMeshRef.current.rotation.y += 0.0002;  // idle showcase spin
        } else {
          // Earth rotates inside the inertial frame: lock the mesh to epoch GMST
          // so geographic features line up with ECI-computed positions.
          earthMeshRef.current.rotation.y = earthSpinRef.current;
        }
      }
      // Pulse event markers
      const pulseScale = 1.0 + Math.sin(Date.now() * 0.006) * 0.18;
      for (const marker of pulseMarkersRef.current) {
        marker.scale.set(pulseScale, pulseScale, pulseScale);
      }

      // Spacecraft flight progression along trajectory spline
      if (trajectoryCurveRef.current && probeGroupRef.current && isPlayingRef.current) {
        animProgressRef.current = (animProgressRef.current + 0.0025) % 1.0;
        setAnimProgress(animProgressRef.current);

        const point = trajectoryCurveRef.current.getPointAt(animProgressRef.current);
        const tangent = trajectoryCurveRef.current.getTangentAt(animProgressRef.current);

        if (point) {
          probeGroupRef.current.position.copy(point);
          probeGroupRef.current.visible = true;

          if (tangent) {
            const lookTarget = point.clone().add(tangent);
            probeGroupRef.current.lookAt(lookTarget);
          }

          if (probeHaloRef.current) {
            const s = 1.0 + Math.sin(Date.now() * 0.012) * 0.35;
            probeHaloRef.current.scale.set(s, s, s);
          }
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    // 13. Window Resize Handling
    const onResize = () => {
      if (!canvasContainerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = canvasContainerRef.current.clientWidth;
      const h = canvasContainerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      if (rendererRef.current && canvasContainerRef.current && rendererRef.current.domElement) {
        if (canvasContainerRef.current.contains(rendererRef.current.domElement)) {
          canvasContainerRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
    };
  }, []); // Run once on mount

  // ── Sync Trajectory Updates ────────────────────────────────────────────
  useEffect(() => {
    renderMissionTrajectory(candidate, missionType, moonPositionKm, launchSite);
  }, [candidate, missionType, moonPositionKm, launchSite, renderMissionTrajectory]);

  return (
    <div className="w-full h-full min-h-[420px] lg:min-h-[500px] rounded-2xl overflow-hidden border border-slate-800/80 bg-[#020617] relative select-none shadow-2xl">
      {/* ── Isolated 3D Canvas Mount (Three.js ONLY — NO React children inside) ─ */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-0 pointer-events-auto" />

      {/* ── Top Floating Toolbar (Camera Controls) ────────────────────── */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-[#030712]/85 backdrop-blur-md border border-slate-800/80 shadow-lg">
        <button
          onClick={() => applyCameraFraming("Fit Full Trajectory", candidate, missionType, moonPositionKm)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${cameraMode === "Fit Full Trajectory"
            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
            : "text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60"
            }`}
          title="Auto-Fit Mission View"
        >
          <Maximize2 className="w-3 h-3 text-cyan-400" />
          <span>FIT ALL</span>
        </button>
        <button
          onClick={() => applyCameraFraming("Focus Earth", candidate, missionType, moonPositionKm)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${cameraMode === "Focus Earth"
            ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
            : "text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60"
            }`}
          title="Focus on Earth"
        >
          <Globe className="w-3 h-3 text-blue-400" />
          <span>EARTH</span>
        </button>
        {candidate && missionType === "satellite_launch" && (
          <>
            <button
              onClick={() => applyCameraFraming("Focus Launch", candidate, missionType, moonPositionKm)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${cameraMode === "Focus Launch"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60"
                }`}
              title="Focus on Launch Pad"
            >
              <Crosshair className="w-3 h-3 text-amber-400" />
              <span>LAUNCH</span>
            </button>
            <button
              onClick={() => applyCameraFraming("Focus Orbit", candidate, missionType, moonPositionKm)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${cameraMode === "Focus Orbit"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60"
                }`}
              title="Focus on Orbit Ring"
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>ORBIT</span>
            </button>
          </>
        )}
        {missionType === "lunar_free_return" && (
          <button
            onClick={() => applyCameraFraming("Focus Moon Encounter", candidate, missionType, moonPositionKm)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${cameraMode === "Focus Moon Encounter"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
              : "text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60"
              }`}
            title="Focus on Moon Flyby Encounter"
          >
            <MoonIcon className="w-3 h-3 text-purple-400" />
            <span>MOON</span>
          </button>
        )}
        <button
          onClick={() => applyCameraFraming("Focus Polar", candidate, missionType, moonPositionKm)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${cameraMode === "Focus Polar"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60"
            }`}
          title="Top-Down Polar View"
        >
          <Compass className="w-3 h-3 text-emerald-400" />
          <span>POLAR</span>
        </button>
      </div>

      {/* ── Top Right Playback Controls (Active only when trajectory exists) ─ */}
      {candidate && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 p-1 rounded-xl bg-[#030712]/85 backdrop-blur-md border border-slate-800/80 shadow-lg">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700/60 transition-all cursor-pointer"
            title={isPlaying ? "Pause Probe" : "Play Probe Animation"}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>
          <button
            onClick={() => {
              animProgressRef.current = 0;
              setAnimProgress(0);
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700/60 transition-all cursor-pointer"
            title="Restart Flight Sequence"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <div className="px-2 text-[9px] font-mono text-cyan-300 font-bold">
            T+{(animProgress * (candidate.durationHours || 1)).toFixed(1)}h
          </div>
        </div>
      )}

      {/* ── Bottom Left Legend / Telemetry HUD ─────────────────────────── */}
      {/* ── Bottom Left Legend / Telemetry HUD ─────────────────────────── */}
      <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-[#030712]/85 backdrop-blur-md border border-slate-800/80 text-[9px] text-slate-400 font-mono space-y-1 z-10 shadow-lg">
        {candidate ? (
          <>
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              TRAJECTORY TELEMETRY SPLINE
            </div>
            {/* Legend is derived from the phases actually present in the
                trajectory and colored through resolvePhaseStyle — the same
                function the renderer uses. It therefore cannot drift out of
                sync with what is drawn on the canvas. Set preserves first
                appearance, so entries follow the mission timeline. */}
            {Array.from(new Set(candidate.trajectory.map((p) => p.phase))).map(
              (phase) => {
                const style = resolvePhaseStyle(phase, missionType);
                return (
                  <div key={phase} className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-1.5 rounded shrink-0"
                      style={{
                        backgroundColor: style.hex,
                        boxShadow: `0 0 10px ${style.hex}`,
                      }}
                    />
                    <span className="text-slate-200">{style.label}</span>
                  </div>
                );
              }
            )}
          </>
        ) : (
          <div className="space-y-0.5">
            <div className="text-[8px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>PRE-FLIGHT ASTRODYNAMICS STANDBY</span>
            </div>
            {launchSite && (
              <div className="text-slate-300 text-[8px]">
                SITE: {launchSite.name} ({launchSite.latitudeDeg.toFixed(1)}° Lat)
              </div>
            )}
            <div className="text-slate-500 text-[8px]">
              Click RUN ANALYSIS to calculate & render trajectory
            </div>
          </div>
        )}
        <div className="text-[8px] text-slate-600 pt-1 border-t border-slate-800/60">
          Left Drag: Rotate · Right Drag: Pan · Scroll: Zoom
        </div>
      </div>


      {/* ── Bottom Right Collapsible Rendering Diagnostics ─────────────── */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end">
        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#030712]/90 border border-slate-800 text-[8px] font-mono text-slate-400 hover:text-slate-200 transition-colors shadow-lg cursor-pointer"
        >
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>Diagnostics</span>
          {showDiagnostics ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>

        {showDiagnostics && (
          <div className="mt-1 p-2.5 rounded-xl bg-[#030712]/95 backdrop-blur-md border border-slate-800 text-[8px] font-mono text-slate-300 space-y-1 shadow-2xl min-w-[220px]">
            <div className="text-[7px] font-bold text-cyan-400 uppercase border-b border-slate-800 pb-1">
              Rendering Diagnostics
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Renderer:</span>
              <span className="text-slate-300 font-bold">Three.js WebGL (Photorealistic 4K)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className={candidate ? "text-emerald-400 font-bold" : "text-cyan-400 font-bold"}>
                {candidate ? "Active Trajectory" : "Pre-Flight Standby"}
              </span>
            </div>
            {candidate && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Candidate:</span>
                  <span className="text-cyan-300 font-bold truncate max-w-[110px]">
                    {candidate.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Points Count:</span>
                  <span className="text-slate-300 font-bold">
                    {summary?.pointCount ?? candidate.trajectory.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Validity:</span>
                  <span
                    className={
                      summary?.allFinite
                        ? "text-emerald-400 font-bold"
                        : "text-amber-400 font-bold"
                    }
                  >
                    {summary?.allFinite ? "Valid & Finite" : "Degraded"}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Camera Mode:</span>
              <span className="text-slate-300">{cameraMode}</span>
            </div>
            {renderError && (
              <div className="p-1 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-[7px]">
                Error: {renderError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
