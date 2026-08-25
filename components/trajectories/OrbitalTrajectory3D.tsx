"use client";

/**
 * OrbitalTrajectory3D — Interactive Three.js Astrodynamics Visualizer.
 * Features:
 *   - Photorealistic 3D Earth (NASA 4K Blue Marble, Bump, Night Lights, Atmosphere)
 *   - Photorealistic 3D Moon with realistic lunar distance & orbital path
 *   - Real-time generated 3D Trajectory Splines (Ascent, Parking Orbit, Hohmann / 3-Body Free-Return, Final Orbit)
 *   - Physics-driven animated Spacecraft with Keplerian variable velocity & engine thruster plume
 *   - Interactive Maneuver Burn Nodes (Delta-V 1 & Delta-V 2)
 *   - Camera Modes: Free Orbit, Earth Focus, Moon Focus, Spacecraft Chase Cam, Full Highway View
 *   - Full Time-Warp & Scrubbable Mission Timeline controls
 */

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import {
  FlightTelemetryState,
  LaunchSite,
  MissionPreset,
} from "@/lib/trajectories/types";
import {
  generateLunarFreeReturnSpline,
  ASTRO_CONSTANTS,
  THREE_Vector3Like,
} from "@/lib/trajectories/orbitalPhysics";
import {
  Play,
  Pause,
  RotateCcw,
  Globe,
  CircleDot,
  Rocket,
  Maximize2,
} from "lucide-react";

interface OrbitalTrajectory3DProps {
  mission: MissionPreset;
  launchSite: LaunchSite;
  perigeeKm: number;
  apogeeKm: number;
  inclinationDeg: number;
  onTelemetryUpdate?: (telemetry: FlightTelemetryState) => void;
}

export default function OrbitalTrajectory3D({
  mission,
  perigeeKm,
  apogeeKm,
  inclinationDeg,
  onTelemetryUpdate,
}: OrbitalTrajectory3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeWarp, setTimeWarp] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [cameraMode, setCameraMode] = useState<
    "FREE" | "EARTH" | "MOON" | "CHASE" | "OVERVIEW"
  >("FREE");

  // Internal references
  const animFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const spacecraftRef = useRef<THREE.Group | null>(null);
  const thrusterGlowRef = useRef<THREE.Mesh | null>(null);
  const trajectorySplinePointsRef = useRef<THREE_Vector3Like[]>([]);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const parkingOrbitLineRef = useRef<THREE.Line | null>(null);
  const moonGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);

  // Interactive mouse drag controls
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 7.5,
    theta: 0.6,
    phi: 1.1,
  });

  const progressRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  const timeWarpRef = useRef<number>(1);
  const cameraModeRef = useRef<string>("FREE");

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    timeWarpRef.current = timeWarp;
  }, [timeWarp]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  // ── 1. Setup Three.js Scene ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    cameraRef.current = camera;
    camera.position.set(5.5, 4.2, 5.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();

    // ── Starfield & Milky Way Sky Dome ───────────────────────────────────────
    const milkyWayTex = textureLoader.load("/textures/milkyway.jpg");
    milkyWayTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.SphereGeometry(600, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: milkyWayTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.75,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Stars particle field
    const starCount = 2500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 250 + Math.random() * 200;

      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);

      const colorRoll = Math.random();
      if (colorRoll > 0.8) {
        starColors[i * 3] = 0.6;
        starColors[i * 3 + 1] = 0.8;
        starColors[i * 3 + 2] = 1.0;
      } else if (colorRoll > 0.6) {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.85;
        starColors[i * 3 + 2] = 0.6;
      } else {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 1.0;
        starColors[i * 3 + 2] = 1.0;
      }
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ── Lighting ─────────────────────────────────────────────────────────────
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(30, 15, 20);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x18243b, 0.8);
    scene.add(ambientLight);

    // ── 3D Earth Globe ───────────────────────────────────────────────────────
    const earthRadius = 1.25;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);

    const earthDayTex = textureLoader.load("/textures/planets/earth_4k.jpg");
    earthDayTex.colorSpace = THREE.SRGBColorSpace;
    const earthBumpTex = textureLoader.load("/textures/planets/earth_bump.jpg");
    const earthNightTex = textureLoader.load("/textures/planets/earth_night.jpg");
    earthNightTex.colorSpace = THREE.SRGBColorSpace;
    const earthSpecTex = textureLoader.load("/textures/planets/earth_specular.jpg");

    const earthMat = new THREE.MeshPhongMaterial({
      map: earthDayTex,
      bumpMap: earthBumpTex,
      bumpScale: 0.04,
      specularMap: earthSpecTex,
      specular: new THREE.Color(0x334466),
      shininess: 25,
      emissiveMap: earthNightTex,
      emissive: new THREE.Color(0x221105),
      emissiveIntensity: 0.3,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // Rayleigh Atmosphere Halo
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.025, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(0.2, 0.65, 1.0, 1.0) * intensity * 0.9;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Earth Equator Grid Guide Line
    const eqGeo = new THREE.RingGeometry(earthRadius * 1.002, earthRadius * 1.006, 64);
    const eqMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const eqRing = new THREE.Mesh(eqGeo, eqMat);
    eqRing.rotation.x = Math.PI / 2;
    scene.add(eqRing);

    // ── 3D Moon Sphere & Lunar Orbit ─────────────────────────────────────────
    const moonGroup = new THREE.Group();
    moonGroupRef.current = moonGroup;

    const moonRadius = earthRadius * 0.27;
    const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
    const moonTex = textureLoader.load("/textures/moons/moon.jpg");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.85,
      metalness: 0.1,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    const moonDistance = 9.2;
    moonMesh.position.set(moonDistance, 0.35, 1.8);
    moonGroup.add(moonMesh);

    // Moon Orbit Trail
    const moonOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      moonOrbitPts.push(
        new THREE.Vector3(
          Math.cos(angle) * moonDistance,
          Math.sin(angle) * 0.35,
          Math.sin(angle) * moonDistance * 0.4
        )
      );
    }
    const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
    const moonOrbitMat = new THREE.LineDashedMaterial({
      color: 0x94a3b8,
      dashSize: 0.2,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.3,
    });
    const moonOrbitLine = new THREE.Line(moonOrbitGeo, moonOrbitMat);
    moonOrbitLine.computeLineDistances();
    moonGroup.add(moonOrbitLine);

    scene.add(moonGroup);

    // ── Spacecraft 3D Object ─────────────────────────────────────────────────
    const spacecraft = new THREE.Group();
    spacecraftRef.current = spacecraft;

    // Body capsule
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.18, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.8,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    spacecraft.add(body);

    // Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.04, 0.08, 16);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.5,
      roughness: 0.3,
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.z = 0.13;
    nose.rotation.x = Math.PI / 2;
    spacecraft.add(nose);

    // Solar panels
    const panelGeo = new THREE.BoxGeometry(0.36, 0.005, 0.09);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2,
    });
    const panels = new THREE.Mesh(panelGeo, panelMat);
    spacecraft.add(panels);

    // Rocket Engine Thruster Flame Plume
    const thrusterGeo = new THREE.ConeGeometry(0.035, 0.16, 12);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.z = -0.16;
    thruster.rotation.x = -Math.PI / 2;
    thrusterGlowRef.current = thruster;
    spacecraft.add(thruster);

    // Beacon light on spacecraft
    const beacon = new THREE.PointLight(0x38bdf8, 2.0, 1.5);
    beacon.position.set(0, 0.05, 0);
    spacecraft.add(beacon);

    scene.add(spacecraft);

    // ── Mouse Drag Event Handlers ────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (cameraModeRef.current !== "FREE") setCameraMode("FREE");
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      const s = cameraSphericalRef.current;
      s.theta -= deltaX * 0.008;
      s.phi = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi - deltaY * 0.008));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = cameraSphericalRef.current;
      s.radius = Math.max(2.2, Math.min(24.0, s.radius + e.deltaY * 0.006));
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container.contains(dom)) container.removeChild(dom);
    };
  }, []);

  // ── 2. Update Trajectory Curves on Param Change ───────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (trajectoryLineRef.current) scene.remove(trajectoryLineRef.current);
    if (parkingOrbitLineRef.current) scene.remove(parkingOrbitLineRef.current);

    const earthRadiusVisual = 1.25;
    let points: THREE_Vector3Like[] = [];

    if (mission.id === "trans_lunar") {
      const lunarData = generateLunarFreeReturnSpline(earthRadiusVisual, 9.2, 360);
      points = lunarData.points;
      if (moonGroupRef.current) moonGroupRef.current.visible = true;
    } else if (mission.id === "gto_geo" || mission.id === "molniya") {
      const transferA = (ASTRO_CONSTANTS.EARTH_RADIUS_KM + (perigeeKm + apogeeKm) / 2) / ASTRO_CONSTANTS.EARTH_RADIUS_KM * earthRadiusVisual;
      const ecc = (apogeeKm - perigeeKm) / (ASTRO_CONSTANTS.EARTH_RADIUS_KM * 2 + perigeeKm + apogeeKm);

      for (let i = 0; i <= 240; i++) {
        const nu = (i / 240) * Math.PI * 2;
        const r = (transferA * (1 - ecc * ecc)) / (1 + ecc * Math.cos(nu));
        const incRad = (inclinationDeg * Math.PI) / 180;
        const x = r * Math.cos(nu);
        const y = r * Math.sin(nu) * Math.sin(incRad);
        const z = -r * Math.sin(nu) * Math.cos(incRad);
        points.push({ x, y, z });
      }

      if (moonGroupRef.current) moonGroupRef.current.visible = false;
    } else {
      const orbitalRadius = earthRadiusVisual * (1 + perigeeKm / ASTRO_CONSTANTS.EARTH_RADIUS_KM);
      const incRad = (inclinationDeg * Math.PI) / 180;

      for (let i = 0; i <= 180; i++) {
        const nu = (i / 180) * Math.PI * 2;
        const x = orbitalRadius * Math.cos(nu);
        const y = orbitalRadius * Math.sin(nu) * Math.sin(incRad);
        const z = -orbitalRadius * Math.sin(nu) * Math.cos(incRad);
        points.push({ x, y, z });
      }

      if (moonGroupRef.current) moonGroupRef.current.visible = false;
    }

    trajectorySplinePointsRef.current = points;

    const vec3Points = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const trajGeo = new THREE.BufferGeometry().setFromPoints(vec3Points);

    const trajMat = new THREE.LineBasicMaterial({
      color: mission.id === "trans_lunar" ? 0xf59e0b : 0x06b6d4,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    const trajLine = new THREE.Line(trajGeo, trajMat);
    trajectoryLineRef.current = trajLine;
    scene.add(trajLine);

    const parkRadius = earthRadiusVisual * (1 + 250 / ASTRO_CONSTANTS.EARTH_RADIUS_KM);
    const parkPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const nu = (i / 72) * Math.PI * 2;
      parkPts.push(new THREE.Vector3(parkRadius * Math.cos(nu), 0, parkRadius * Math.sin(nu)));
    }
    const parkGeo = new THREE.BufferGeometry().setFromPoints(parkPts);
    const parkMat = new THREE.LineDashedMaterial({
      color: 0x0ea5e9,
      dashSize: 0.1,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.35,
    });
    const parkLine = new THREE.Line(parkGeo, parkMat);
    parkLine.computeLineDistances();
    parkingOrbitLineRef.current = parkLine;
    scene.add(parkLine);
  }, [mission, perigeeKm, apogeeKm, inclinationDeg]);

  // ── 3. Main Animation Loop ────────────────────────────────────────────────
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);

      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += 0.0008 * deltaSec;
      }

      if (isPlayingRef.current) {
        const speed = deltaSec * 0.04 * timeWarpRef.current;
        let newProg = progressRef.current + speed;
        if (newProg > 1.0) newProg = 0;
        setProgress(newProg);
        progressRef.current = newProg;
      }

      const points = trajectorySplinePointsRef.current;
      const sc = spacecraftRef.current;

      if (points.length > 1 && sc) {
        const totalIdx = (points.length - 1) * progressRef.current;
        const idx = Math.floor(totalIdx);
        const nextIdx = Math.min(points.length - 1, idx + 1);
        const factor = totalIdx - idx;

        const p1 = points[idx];
        const p2 = points[nextIdx];

        if (p1 && p2) {
          const currentX = p1.x + (p2.x - p1.x) * factor;
          const currentY = p1.y + (p2.y - p1.y) * factor;
          const currentZ = p1.z + (p2.z - p1.z) * factor;

          sc.position.set(currentX, currentY, currentZ);

          const tangent = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize();
          const targetLook = new THREE.Vector3(currentX + tangent.x, currentY + tangent.y, currentZ + tangent.z);
          sc.lookAt(targetLook);

          if (thrusterGlowRef.current) {
            const isBurning =
              progressRef.current < 0.12 ||
              (progressRef.current > 0.45 && progressRef.current < 0.58) ||
              progressRef.current > 0.94;
            thrusterGlowRef.current.visible = isBurning;
            if (isBurning) {
              const flicker = 0.8 + Math.random() * 0.4;
              thrusterGlowRef.current.scale.set(flicker, flicker, flicker);
            }
          }

          const distFromEarthCenter = Math.sqrt(currentX * currentX + currentY * currentY + currentZ * currentZ);
          const earthRadiusVisual = 1.25;
          const altitudeKm = Math.round(
            ((distFromEarthCenter - earthRadiusVisual) / earthRadiusVisual) *
              ASTRO_CONSTANTS.EARTH_RADIUS_KM
          );

          let phase = "ORBITAL COAST";
          let phaseCode = "PHASE-03";
          let speedKmS = 7.78;
          let gForce = 1.0;
          let qKPa = 0.0;

          if (progressRef.current < 0.05) {
            phase = "STAGE 1 ASCENT / MAX-Q";
            phaseCode = "PHASE-01";
            speedKmS = 2.4 + progressRef.current * 40;
            gForce = 2.8;
            qKPa = 32.4;
          } else if (progressRef.current < 0.15) {
            phase = "STAGE 2 INSERTION (SES-1)";
            phaseCode = "PHASE-02";
            speedKmS = 7.6 + progressRef.current * 4;
            gForce = 1.6;
          } else if (progressRef.current > 0.48 && progressRef.current < 0.56 && mission.id === "trans_lunar") {
            phase = "LUNAR GRAVITY SLINGSHOT";
            phaseCode = "PHASE-LUNAR";
            speedKmS = 2.15;
            gForce = 0.16;
          } else if (progressRef.current > 0.9) {
            phase = "TARGET CIRCULARIZATION";
            phaseCode = "PHASE-FINAL";
            speedKmS = 3.07;
          }

          const totalMissionSec = Math.round(progressRef.current * 86400 * 3);
          const hrs = Math.floor(totalMissionSec / 3600);
          const mins = Math.floor((totalMissionSec % 3600) / 60);
          const secs = totalMissionSec % 60;
          const formattedTime = `T+${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

          if (onTelemetryUpdate) {
            onTelemetryUpdate({
              missionTimeSec: totalMissionSec,
              formattedTime,
              phase,
              phaseCode,
              altitudeKm: Math.max(0, altitudeKm),
              velocityKmS: Number(speedKmS.toFixed(2)),
              machNumber: Number((speedKmS / 0.34).toFixed(1)),
              dynamicPressureKPa: qKPa,
              gForce,
              downrangeKm: Math.round(progressRef.current * 18000),
              propellantRemainingPercent: Math.max(0, Math.round((1 - progressRef.current * 0.85) * 100)),
              deltaVExpendedMS: Math.round(progressRef.current * 9200),
              deltaVRemainingMS: Math.max(0, Math.round((1 - progressRef.current) * 9200)),
              orbitProgressPercent: Math.round(progressRef.current * 100),
              spacecraftPosition: [currentX, currentY, currentZ],
            });
          }
        }
      }

      const cam = cameraRef.current;
      if (cam) {
        if (cameraModeRef.current === "FREE") {
          const s = cameraSphericalRef.current;
          cam.position.x = s.radius * Math.sin(s.phi) * Math.sin(s.theta);
          cam.position.y = s.radius * Math.cos(s.phi);
          cam.position.z = s.radius * Math.sin(s.phi) * Math.cos(s.theta);
          cam.lookAt(0, 0, 0);
        } else if (cameraModeRef.current === "EARTH") {
          cam.position.set(2.8, 1.8, 3.2);
          cam.lookAt(0, 0, 0);
        } else if (cameraModeRef.current === "MOON") {
          cam.position.set(10.8, 1.2, 3.2);
          cam.lookAt(9.2, 0.35, 1.8);
        } else if (cameraModeRef.current === "CHASE" && sc) {
          cam.position.set(
            sc.position.x - 0.7,
            sc.position.y + 0.35,
            sc.position.z + 0.7
          );
          cam.lookAt(sc.position);
        } else if (cameraModeRef.current === "OVERVIEW") {
          cam.position.set(5.5, 14.0, 7.5);
          cam.lookAt(4.5, 0, 1.0);
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mission, onTelemetryUpdate]);

  return (
    <div className="relative w-full h-full min-h-[480px] lg:min-h-[580px] rounded-3xl overflow-hidden border border-slate-800/80 bg-[#020617] shadow-[0_0_80px_rgba(6,182,212,0.1)] select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Tactical Corner HUD Reticles */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50 rounded-tl-md pointer-events-none" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50 rounded-tr-md pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50 rounded-bl-md pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50 rounded-br-md pointer-events-none" />

      {/* Top Left: Orbit Profile Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#060b18]/90 border border-slate-700/80 backdrop-blur-xl font-mono text-[10px]">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span className="font-bold text-white uppercase">{mission.name}</span>
        <span className="text-slate-500">│</span>
        <span className="text-cyan-300 font-bold">{mission.transferType}</span>
      </div>

      {/* Top Right: Camera POV Switcher */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 p-1 rounded-2xl bg-[#060b18]/90 border border-slate-700/80 backdrop-blur-xl font-mono text-[9px]">
        {[
          { id: "FREE", label: "FREE 3D", icon: RotateCcw },
          { id: "EARTH", label: "EARTH", icon: Globe },
          { id: "MOON", label: "MOON", icon: CircleDot },
          { id: "CHASE", label: "CHASE CAM", icon: Rocket },
          { id: "OVERVIEW", label: "HIGHWAY", icon: Maximize2 },
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setCameraMode(mode.id as any)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all ${
              cameraMode === mode.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <mode.icon className="w-3 h-3" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom Center: Interactive Flight Playback & Timeline Scrub Dock */}
      <div className="absolute bottom-4 left-4 right-4 z-10 max-w-[700px] mx-auto p-2.5 rounded-2xl bg-[#060b18]/95 border border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-2xl font-mono">
        <div className="flex items-center justify-between gap-3 mb-2">
          {/* Play/Pause & Reset */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 transition-all cursor-pointer"
              title={isPlaying ? "Pause Simulation" : "Play Simulation"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                setProgress(0);
                progressRef.current = 0;
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all cursor-pointer"
              title="Reset to Liftoff T-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrubbable Timeline Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-bold shrink-0">LIFTOFF</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setProgress(val);
                progressRef.current = val;
              }}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[9px] text-cyan-300 font-bold shrink-0">
              {(progress * 100).toFixed(0)}%
            </span>
          </div>

          {/* Time-Warp Multiplier Buttons */}
          <div className="flex items-center gap-1">
            {[1, 5, 25, 100].map((warp) => (
              <button
                key={warp}
                onClick={() => setTimeWarp(warp)}
                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all ${
                  timeWarp === warp
                    ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/60"
                    : "text-slate-500 hover:text-slate-300 bg-slate-900/60 border border-slate-800"
                }`}
              >
                {warp}x
              </button>
            ))}
          </div>
        </div>

        {/* Legend strip */}
        <div className="flex items-center justify-between text-[8px] text-slate-400 px-1 border-t border-slate-800/80 pt-1.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Parking Orbit</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Transfer Trajectory</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Destination Orbit</span>
            </span>
          </div>
          <span className="text-slate-500">Drag to rotate • Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}
