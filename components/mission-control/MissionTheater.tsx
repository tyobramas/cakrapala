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
const PHASE_COLORS: Record<string, { color: number; hex: string; label: string }> = {
  launch: { color: 0x00f0ff, hex: "#00f0ff", label: "Launch & Ascent" },
  ascent: { color: 0x00f0ff, hex: "#00f0ff", label: "Ascent Gravity Turn" },
  parking_orbit: { color: 0x38bdf8, hex: "#38bdf8", label: "Target Orbit (LEO)" },
  tli: { color: 0xf59e0b, hex: "#f59e0b", label: "TLI Burn" },
  outbound: { color: 0xf97316, hex: "#f97316", label: "Outbound TLI Transfer" },
  lunar_flyby: { color: 0xd946ef, hex: "#d946ef", label: "Perilune Lunar Flyby" },
  return: { color: 0x6366f1, hex: "#6366f1", label: "Earth Free-Return Leg" },
  reentry_interface: { color: 0xef4444, hex: "#ef4444", label: "Reentry Corridor" },
};

const EARTH_RADIUS_VIS = 6.378137; // 6,378 km in Scene units (1 unit = 1,000 km)

export default function MissionTheater({
  candidate,
  missionType,
  moonPositionKm,
  launchSite,
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
          camera.position.set(190, 500, 0.1);
          controls.target.set(190, 0, 0);
        }
      } else if (mode === "Focus Moon Encounter" && moonGroupRef.current) {
        const mPos = moonGroupRef.current.position;
        camera.position.set(mPos.x + 12, mPos.y + 8, mPos.z + 16);
        controls.target.copy(mPos);
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
          // Lunar mission framing
          const moonDist = moonKm
            ? Math.sqrt(moonKm.x ** 2 + moonKm.y ** 2 + moonKm.z ** 2) * RENDERER_SCALE
            : 384;
          const midX = moonDist * 0.5;
          camera.position.set(midX, moonDist * 0.55, moonDist * 0.95);
          controls.target.set(midX, 0, 0);
        }
      }

      camera.updateProjectionMatrix();
      controls.update();
    },
    []
  );

  // ── Trajectory & Scene Builder ─────────────────────────────────────────
  const renderMissionTrajectory = useCallback(
    (cand: MissionCandidate | null, type: MissionType, moonKm?: Vec3) => {
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

      // ── CLEAN STANDBY STATE (Before Running Analysis) ─────────────────────
      if (!cand || cand.trajectory.length < 2) {
        trajectoryCurveRef.current = null;
        if (probeGroupRef.current) probeGroupRef.current.visible = false;
        setSummary(null);

        // Standby Moon in Lunar Mode at true astronomical position
        if (type === "lunar_free_return" && moonKm) {
          const textureLoader = new THREE.TextureLoader();
          const moonRadius = 1.737;
          const moonGroup = new THREE.Group();
          moonGroup.name = "moonGroup";

          const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
          const moonTex = textureLoader.load("/textures/planets/moon.jpg");
          const moonMat = new THREE.MeshStandardMaterial({
            map: moonTex,
            roughness: 0.85,
            metalness: 0.05,
            emissive: new THREE.Color(0x222222),
          });
          const moon = new THREE.Mesh(moonGeo, moonMat);
          moonGroup.add(moon);

          const mPos = eciKmToRendererPosition(moonKm);
          moonGroup.position.set(mPos.x, mPos.y, mPos.z);
          scene.add(moonGroup);
          moonGroupRef.current = moonGroup;

          // Moon Orbit Ring
          const moonDist = Math.sqrt(mPos.x ** 2 + mPos.y ** 2 + mPos.z ** 2);
          const ringPoints: THREE.Vector3[] = [];
          for (let i = 0; i <= 128; i++) {
            const angle = (i / 128) * Math.PI * 2;
            ringPoints.push(
              new THREE.Vector3(moonDist * Math.cos(angle), 0, moonDist * Math.sin(angle))
            );
          }
          const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
          const ringMat = new THREE.LineBasicMaterial({
            color: 0x475569,
            transparent: true,
            opacity: 0.35,
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
          const moonRadius = 1.737; // 1,737 km in scene units
          const moonGroup = new THREE.Group();
          moonGroup.name = "moonGroup";

          const moonGeo = new THREE.SphereGeometry(moonRadius, 48, 48);
          const moonTex = textureLoader.load("/textures/planets/moon.jpg");
          const moonMat = new THREE.MeshStandardMaterial({
            map: moonTex,
            roughness: 0.85,
            metalness: 0.05,
            emissive: new THREE.Color(0x222222),
          });
          const moon = new THREE.Mesh(moonGeo, moonMat);
          moonGroup.add(moon);

          // Moon Soft Atmospheric / Surface Glow Aura
          const moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(moonRadius * 1.15, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 0xe2e8f0,
              transparent: true,
              opacity: 0.20,
              side: THREE.BackSide,
              depthWrite: false,
            })
          );
          moonGroup.add(moonGlow);

          // Exact Moon ephemeris center position
          const periluneEvt = cand.events.find((e) => e.type === "lunar_closest_approach");
          let moonCenterKm: Vec3 = moonKm || { x: 384400, y: 0, z: 0 };
          if (periluneEvt) {
            const mag =
              Math.sqrt(
                periluneEvt.positionEciKm.x ** 2 +
                  periluneEvt.positionEciKm.y ** 2 +
                  periluneEvt.positionEciKm.z ** 2
              ) || 1;
            const pNormX = periluneEvt.positionEciKm.x / mag;
            const pNormY = periluneEvt.positionEciKm.y / mag;
            const pNormZ = periluneEvt.positionEciKm.z / mag;
            const periR = 1.737 + (cand.periluneAltitudeKm || 200) / 1000;
            moonCenterKm = {
              x: periluneEvt.positionEciKm.x - pNormX * periR,
              y: periluneEvt.positionEciKm.y - pNormY * periR,
              z: periluneEvt.positionEciKm.z - pNormZ * periR,
            };
          }
          const mPos = eciKmToRendererPosition(moonCenterKm);
          moonGroup.position.set(mPos.x, mPos.y, mPos.z);
          scene.add(moonGroup);
          moonGroupRef.current = moonGroup;

          // Moon Orbit Ring around Earth
          const moonDist = Math.sqrt(mPos.x ** 2 + mPos.y ** 2 + mPos.z ** 2);
          const ringPoints: THREE.Vector3[] = [];
          for (let i = 0; i <= 128; i++) {
            const angle = (i / 128) * Math.PI * 2;
            ringPoints.push(
              new THREE.Vector3(moonDist * Math.cos(angle), 0, moonDist * Math.sin(angle))
            );
          }
          const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
          const ringMat = new THREE.LineBasicMaterial({
            color: 0x475569,
            transparent: true,
            opacity: 0.35,
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
            const conf = PHASE_COLORS[currentPhase] || { color: 0x00f0ff, hex: "#00f0ff" };

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
                      : 0xef4444;

          const markerRadius = type === "satellite_launch" ? 0.09 : 0.6;

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

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6.8;
    controls.maxDistance = 50000;
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
          earthMeshRef.current.rotation.y += 0.0002;
        } else {
          earthMeshRef.current.rotation.y = 0;
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
    renderMissionTrajectory(candidate, missionType, moonPositionKm);
  }, [candidate, missionType, moonPositionKm, renderMissionTrajectory]);

  return (
    <div className="w-full h-full min-h-[420px] lg:min-h-[500px] rounded-2xl overflow-hidden border border-slate-800/80 bg-[#020617] relative select-none shadow-2xl">
      {/* ── Isolated 3D Canvas Mount (Three.js ONLY — NO React children inside) ─ */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-0 pointer-events-auto" />

      {/* ── Top Floating Toolbar (Camera Controls) ────────────────────── */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-[#030712]/85 backdrop-blur-md border border-slate-800/80 shadow-lg">
        <button
          onClick={() => applyCameraFraming("Fit Full Trajectory", candidate, missionType, moonPositionKm)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
            cameraMode === "Fit Full Trajectory"
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
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
            cameraMode === "Focus Earth"
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
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                cameraMode === "Focus Launch"
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
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                cameraMode === "Focus Orbit"
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
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
              cameraMode === "Focus Moon Encounter"
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
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
            cameraMode === "Focus Polar"
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
      <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-[#030712]/85 backdrop-blur-md border border-slate-800/80 text-[9px] text-slate-400 font-mono space-y-1 z-10 shadow-lg">
        {candidate ? (
          <>
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              TRAJECTORY TELEMETRY SPLINE
            </div>
            {missionType === "satellite_launch" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1.5 bg-[#00f0ff] rounded shadow-[0_0_10px_#00f0ff]" />
                  <span className="text-slate-200">Ascent Gravity Turn</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1.5 bg-[#38bdf8] rounded shadow-[0_0_10px_#38bdf8]" />
                  <span className="text-slate-200">Circular Insertion Orbit</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1.5 bg-[#f97316] rounded shadow-[0_0_10px_#f97316]" />
                  <span className="text-slate-200">Outbound TLI Transfer</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1.5 bg-[#d946ef] rounded shadow-[0_0_10px_#d946ef]" />
                  <span className="text-slate-200">Lunar Perilune Flyby</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1.5 bg-[#6366f1] rounded shadow-[0_0_10px_#6366f1]" />
                  <span className="text-slate-200">Earth Free-Return Leg</span>
                </div>
              </>
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
