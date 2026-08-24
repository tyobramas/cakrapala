"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import {
  ShieldAlert,
  Compass,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Crosshair,
  Layers,
  Sparkles,
} from "lucide-react";

interface Asteroid3DRadarSceneProps {
  asteroids: AsteroidNeoObject[];
  selectedAsteroid: AsteroidNeoObject | null;
  onSelectAsteroid: (asteroid: AsteroidNeoObject) => void;
  isLoading?: boolean;
}

/**
 * Creates a high-res tactical canvas HUD label sprite for the approaching asteroid
 */
function createAsteroidHudSprite(
  neo: AsteroidNeoObject,
  isHazard: boolean,
  isSelected: boolean
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, 512, 180);

    const mainColor = isSelected
      ? "#38bdf8"
      : isHazard
      ? "#ef4444"
      : (neo.closest_miss_distance_ld || 99) < 5
      ? "#f59e0b"
      : "#10b981";

    const bgColor = isHazard ? "rgba(30, 10, 15, 0.88)" : "rgba(5, 12, 28, 0.88)";
    const borderColor = isSelected ? "#38bdf8" : isHazard ? "#ef4444" : "rgba(6, 182, 212, 0.5)";

    // Rounded Box Background
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSelected ? 4 : 2.5;

    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 160, 20);
    ctx.fill();
    ctx.stroke();

    // Corner Tactical Brackets
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 4;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(10, 35);
    ctx.lineTo(10, 10);
    ctx.lineTo(35, 10);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(502, 35);
    ctx.lineTo(502, 10);
    ctx.lineTo(477, 10);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(10, 145);
    ctx.lineTo(10, 170);
    ctx.lineTo(35, 170);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(502, 145);
    ctx.lineTo(502, 170);
    ctx.lineTo(477, 170);
    ctx.stroke();

    // Directional Approaching Chevron Icon (Left Side)
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(35, 50);
    ctx.lineTo(65, 90);
    ctx.lineTo(35, 130);
    ctx.lineTo(50, 130);
    ctx.lineTo(80, 90);
    ctx.lineTo(50, 50);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(60, 50);
    ctx.lineTo(90, 90);
    ctx.lineTo(60, 130);
    ctx.lineTo(75, 130);
    ctx.lineTo(105, 90);
    ctx.lineTo(75, 50);
    ctx.closePath();
    ctx.fill();

    // Asteroid Name Title
    ctx.font = "bold 32px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(neo.name, 125, 58);

    // Hazard Status Badge
    if (isHazard) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.fillRect(125, 75, 190, 32);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(125, 75, 190, 32);

      ctx.font = "bold 18px monospace";
      ctx.fillStyle = "#fca5a5";
      ctx.fillText("⚠ PHA HAZARDOUS", 135, 98);
    } else {
      ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
      ctx.fillRect(125, 75, 150, 32);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(125, 75, 150, 32);

      ctx.font = "bold 18px monospace";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText("✔ SAFE PASS", 135, 98);
    }

    // Velocity & Distance Readouts
    ctx.font = "22px monospace";
    ctx.fillStyle = "#94a3b8";
    const distText = `DIST: ${(neo.closest_miss_distance_ld || 0).toFixed(1)} LD`;
    const speedText = `VEL: ${Math.round(neo.velocity_kmh || 0).toLocaleString()} km/h`;
    ctx.fillText(distText, 125, 142);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(speedText, 285, 142);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(7.5, 2.6, 1);
  sprite.position.set(0, 3.2, 0); // Positioned above the asteroid core
  return sprite;
}

export default function Asteroid3DRadarScene({
  asteroids,
  selectedAsteroid,
  onSelectAsteroid,
  isLoading = false,
}: Asteroid3DRadarSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredAsteroid, setHoveredAsteroid] = useState<AsteroidNeoObject | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [cameraViewMode, setCameraViewMode] = useState<"free" | "top" | "target">("free");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sweepMeshRef = useRef<THREE.Mesh | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const moonPivotRef = useRef<THREE.Group | null>(null);
  const asteroidMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const trajectoryLinesRef = useRef<THREE.Line[]>([]);
  const trajectoryPulsesRef = useRef<{ line: THREE.Line; speed: number; offset: number }[]>([]);
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
    scene.fog = new THREE.FogExp2(0x020617, 0.0012);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    camera.position.set(45, 38, 65);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 250;
    controls.maxPolarAngle = Math.PI - 0.05;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x2d3748, 0.9);
    scene.add(ambientLight);

    // Realistic Sun directional light
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.2);
    sunLight.position.set(120, 30, 140);
    scene.add(sunLight);

    // Deep space azure fill light
    const deepBlueLight = new THREE.DirectionalLight(0x0284c7, 0.7);
    deepBlueLight.position.set(-90, -40, -110);
    scene.add(deepBlueLight);

    const textureLoader = new THREE.TextureLoader();

    // ── 6. Realistic Milky Way Skybox Sphere ──────────────────────────────────
    const skyGeo = new THREE.SphereGeometry(800, 48, 48);
    const milkywayTex = textureLoader.load("/textures/milkyway.jpg");
    milkywayTex.colorSpace = THREE.SRGBColorSpace;

    const skyMat = new THREE.MeshBasicMaterial({
      map: milkywayTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.78,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.rotation.x = THREE.MathUtils.degToRad(60);
    skyMesh.rotation.y = THREE.MathUtils.degToRad(120);
    scene.add(skyMesh);

    // Deep Space Starfield Points
    const starCount = 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = THREE.MathUtils.randFloat(220, 650);
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      const colorVariance = Math.random();
      if (colorVariance > 0.8) {
        starColors[i * 3] = 0.6; // Bluish
        starColors[i * 3 + 1] = 0.85;
        starColors[i * 3 + 2] = 1.0;
      } else if (colorVariance < 0.15) {
        starColors[i * 3] = 1.0; // Amber/Warm
        starColors[i * 3 + 1] = 0.75;
        starColors[i * 3 + 2] = 0.5;
      } else {
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.95;
        starColors[i * 3 + 2] = 1.0;
      }
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── 7. Realistic 3D Earth ────────────────────────────────────────────────
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthRadius = 2.2;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTex = textureLoader.load("/textures/planets/earth.jpg");
    earthTex.colorSpace = THREE.SRGBColorSpace;

    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.65,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.z = THREE.MathUtils.degToRad(23.44);
    earthGroup.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Atmospheric Glow Layer
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.1, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmoMesh);

    // ── 8. Realistic 3D Moon & Lunar Orbit (1 LD = radius 7.5) ───────────────
    const lunarRadius3D = 7.5;
    const moonPivot = new THREE.Group();
    earthGroup.add(moonPivot);
    moonPivotRef.current = moonPivot;

    const moonGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const moonTex = textureLoader.load("/textures/planets/moon.jpg");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.9,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(lunarRadius3D, 0, 0);
    moonPivot.add(moonMesh);

    // Moon Orbit Ring Line (1 LD)
    const moonOrbitGeo = new THREE.BufferGeometry();
    const moonOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      moonOrbitPts.push(new THREE.Vector3(Math.cos(angle) * lunarRadius3D, 0, Math.sin(angle) * lunarRadius3D));
    }
    moonOrbitGeo.setFromPoints(moonOrbitPts);
    const moonOrbitMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.5,
    });
    const moonOrbitLine = new THREE.Line(moonOrbitGeo, moonOrbitMat);
    earthGroup.add(moonOrbitLine);

    // ── 9. Holographic Radar Distance Rings (1 LD, 5 LD, 10 LD, 20 LD, 50 LD) ─
    const distanceRings = [
      { ld: 1, radius: 7.5, color: 0x06b6d4, opacity: 0.55, label: "1 LD (~384K km / MOON)" },
      { ld: 5, radius: 15.0, color: 0x38bdf8, opacity: 0.4, label: "5 LD (~1.9M km)" },
      { ld: 10, radius: 25.0, color: 0x6366f1, opacity: 0.32, label: "10 LD (~3.8M km)" },
      { ld: 20, radius: 40.0, color: 0x8b5cf6, opacity: 0.25, label: "20 LD (~7.6M km)" },
      { ld: 50, radius: 60.0, color: 0x64748b, opacity: 0.18, label: "50 LD (~19.2M km)" },
    ];

    distanceRings.forEach((ring) => {
      const ringGeo = new THREE.BufferGeometry();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const theta = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * ring.radius, 0, Math.sin(theta) * ring.radius));
      }
      ringGeo.setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({
        color: ring.color,
        transparent: true,
        opacity: ring.opacity,
      });
      const line = new THREE.Line(ringGeo, ringMat);
      scene.add(line);
    });

    // Polar Radar Grid Crosshairs
    const gridHelper = new THREE.PolarGridHelper(65, 16, 8, 64, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // ── 10. Rotating Radar Conical Sweep Beam ─────────────────────────────────
    const sweepGeo = new THREE.RingGeometry(0.1, 62, 48, 1, 0, Math.PI / 4);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    sweepMesh.rotation.x = Math.PI / 2;
    scene.add(sweepMesh);
    sweepMeshRef.current = sweepMesh;

    // ── 11. Animation Loop ───────────────────────────────────────────────────
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate Earth
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += delta * 0.12;
      }

      // Moon revolution
      if (moonPivotRef.current) {
        moonPivotRef.current.rotation.y += delta * 0.05;
      }

      // Radar sweep
      if (sweepMeshRef.current) {
        sweepMeshRef.current.rotation.z -= delta * 0.85;
      }

      // Asteroid Visual Elements Pulse & Slow Rotation
      asteroidMeshesRef.current.forEach((group, id) => {
        const pulseRing = group.getObjectByName("pulseRing");
        if (pulseRing) {
          const scale = 1.0 + Math.sin(elapsed * 4 + parseFloat(id) % 5) * 0.35;
          pulseRing.scale.set(scale, scale, scale);
        }

        const rockCore = group.getObjectByName("rockCore");
        if (rockCore) {
          rockCore.rotation.x += delta * 0.4;
          rockCore.rotation.y += delta * 0.6;
        }

        // Animate Arrow Vector Beacon
        const arrowMesh = group.getObjectByName("arrowBeacon");
        if (arrowMesh) {
          const arrowPulse = 1.0 + Math.sin(elapsed * 6 + parseFloat(id) % 3) * 0.2;
          arrowMesh.scale.set(arrowPulse, arrowPulse, 1.0);
        }
      });

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

  // ── Render Extended Trajectories & Approaching Icons in 3D Scene ───────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old asteroid meshes and trajectory lines
    asteroidMeshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
    });
    asteroidMeshesRef.current.clear();

    trajectoryLinesRef.current.forEach((line) => {
      scene.remove(line);
    });
    trajectoryLinesRef.current = [];

    // Rebuild Asteroids with Long Hyperbolic Trajectories and Approaching Icons
    asteroids.forEach((neo) => {
      const coord = neo.radar_coord_3d;
      if (!coord) return;

      const group = new THREE.Group();
      group.position.set(coord.x, coord.y, coord.z);
      group.userData = { asteroid: neo };

      const isHazard = neo.is_potentially_hazardous_asteroid;
      const isSelected = selectedAsteroid?.id === neo.id;
      const distanceLd = neo.closest_miss_distance_ld || 50;

      // Color scheme based on threat
      let mainColorHex = isHazard ? 0xef4444 : distanceLd < 5 ? 0xf59e0b : 0x10b981;
      if (isSelected) mainColorHex = 0x38bdf8;

      // ── 1. 3D Deformed Asteroid Rock Core (Faceted & Cratered) ───────────────
      const coreSize = Math.max(0.6, Math.min(1.5, (neo.avg_diameter_meters || 50) / 120));
      const coreGeo = new THREE.DodecahedronGeometry(coreSize, 2);
      const posAttr = coreGeo.attributes.position;
      const seed = parseFloat(neo.id) || 42;

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const noise =
          Math.sin(vx * 4.0 + seed) * 0.18 +
          Math.cos(vy * 4.5 + seed) * 0.14 +
          Math.sin(vz * 5.2 + seed * 2) * 0.1;
        posAttr.setXYZ(i, vx + vx * noise, vy + vy * noise, vz + vz * noise);
      }
      coreGeo.computeVertexNormals();

      const coreMat = new THREE.MeshStandardMaterial({
        color: mainColorHex,
        roughness: 0.85,
        metalness: 0.2,
        emissive: mainColorHex,
        emissiveIntensity: isHazard ? 0.7 : 0.3,
        flatShading: true,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.name = "rockCore";
      group.add(coreMesh);

      // Glowing Aura / Threat Beacon
      const haloGeo = new THREE.SphereGeometry(coreSize * 2.0, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: mainColorHex,
        transparent: true,
        opacity: isHazard ? 0.55 : 0.3,
        blending: THREE.AdditiveBlending,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.name = "pulseRing";
      group.add(haloMesh);

      // ── 2. Tactical Approaching Direction Pointer (3D Arrow / Cone Vector) ───
      const angleRad = THREE.MathUtils.degToRad(coord.approachAngleDeg);
      const tangentX = -Math.sin(angleRad);
      const tangentZ = Math.cos(angleRad);
      const velocityDir = new THREE.Vector3(tangentX, 0, tangentZ).normalize();

      // Direction Cone Arrow pointing in direction of velocity
      const arrowGeo = new THREE.ConeGeometry(coreSize * 0.75, coreSize * 2.2, 16);
      const arrowMat = new THREE.MeshBasicMaterial({
        color: mainColorHex,
        transparent: true,
        opacity: 0.9,
      });
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      arrowMesh.name = "arrowBeacon";

      // Orient cone towards tangent velocity direction
      const targetVec = new THREE.Vector3().addVectors(new THREE.Vector3(0, 0, 0), velocityDir);
      arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), velocityDir);
      arrowMesh.position.copy(velocityDir.clone().multiplyScalar(coreSize * 1.8));
      group.add(arrowMesh);

      // ── 3. High-Res Tactical Canvas HUD Label Sprite ─────────────────────────
      const hudSprite = createAsteroidHudSprite(neo, isHazard, isSelected);
      group.add(hudSprite);

      // ── 4. Dropdown Trajectory Stalk to radar floor plane (y=0) ──────────────
      const stalkGeo = new THREE.BufferGeometry();
      stalkGeo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -coord.y, 0)]);
      const stalkMat = new THREE.LineDashedMaterial({
        color: mainColorHex,
        dashSize: 0.5,
        gapSize: 0.35,
        transparent: true,
        opacity: 0.45,
      });
      const stalkLine = new THREE.Line(stalkGeo, stalkMat);
      stalkLine.computeLineDistances();
      group.add(stalkLine);

      // Floor Shadow Target Reticle
      const floorMarkerGeo = new THREE.RingGeometry(0.3, 0.7, 16);
      const floorMarkerMat = new THREE.MeshBasicMaterial({
        color: mainColorHex,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const floorMarker = new THREE.Mesh(floorMarkerGeo, floorMarkerMat);
      floorMarker.position.set(0, -coord.y, 0);
      floorMarker.rotation.x = Math.PI / 2;
      group.add(floorMarker);

      // ── 5. EXTENDED REALISTIC HYPERBOLIC TRAJECTORY (Far Deep Space Span) ───
      if (showOrbits) {
        // Extended span length across deep space (spanning 240 units from entry to exit)
        const trajSpan = 140;
        const trajPts: THREE.Vector3[] = [];
        const steps = 100;

        // Gravitational bend parameter towards Earth (center 0,0,0)
        const bendStrength = Math.max(2.0, 18.0 / Math.sqrt(distanceLd));

        for (let s = -steps; s <= steps; s++) {
          const t = s / steps; // -1.0 to 1.0
          const distAlongTangent = t * trajSpan;

          // Asymptotic hyperbolic bend around closest approach point
          const normalToEarth = new THREE.Vector3(-coord.x, 0, -coord.z).normalize();
          const hyperBend = (1 / Math.sqrt(1 + (t * 6) ** 2) - 0.05) * bendStrength;

          const px = coord.x + tangentX * distAlongTangent + normalToEarth.x * hyperBend;
          const py = coord.y + (t * 3.5); // slight vertical approach slope
          const pz = coord.z + tangentZ * distAlongTangent + normalToEarth.z * hyperBend;

          trajPts.push(new THREE.Vector3(px, py, pz));
        }

        const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
        const trajMat = new THREE.LineBasicMaterial({
          color: isHazard ? 0xf87171 : isSelected ? 0x38bdf8 : distanceLd < 5 ? 0xfbbf24 : 0x2dd4bf,
          transparent: true,
          opacity: isSelected ? 0.75 : isHazard ? 0.55 : 0.38,
          linewidth: isSelected ? 2 : 1,
        });
        const trajLine = new THREE.Line(trajGeo, trajMat);
        scene.add(trajLine);
        trajectoryLinesRef.current.push(trajLine);
      }

      scene.add(group);
      asteroidMeshesRef.current.set(neo.id, group);
    });
  }, [asteroids, selectedAsteroid, showOrbits]);

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

  // ── Camera Preset Controls ─────────────────────────────────────────────────
  const setCameraTopView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 95, 0.01);
    controlsRef.current.target.set(0, 0, 0);
    setCameraViewMode("top");
  };

  const resetCameraFreeView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(45, 38, 65);
    controlsRef.current.target.set(0, 0, 0);
    setCameraViewMode("free");
  };

  const focusSelectedTarget = () => {
    if (!selectedAsteroid || !cameraRef.current || !controlsRef.current) return;
    const coord = selectedAsteroid.radar_coord_3d;
    if (!coord) return;

    controlsRef.current.target.set(coord.x, coord.y, coord.z);
    cameraRef.current.position.set(coord.x + 12, coord.y + 8, coord.z + 12);
    setCameraViewMode("target");
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#020617]">
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* ── Overlay Radar HUD Scope Rings & Coordinates ──────────────────────── */}
      <div className="absolute inset-0 pointer-events-none border border-cyan-500/20 m-2 rounded-2xl flex flex-col justify-between p-4">
        {/* Top Radar Status & Astronomical Orientation */}
        <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400/80 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/30 w-fit pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-bold text-white tracking-wider">TOPOCENTRIC NEO RADAR (WGS-84)</span>
          </div>
          <div className="mx-3 text-slate-600">|</div>
          <div className="text-slate-300">
            RANGE: <span className="text-cyan-300 font-bold">50 LD (~19.2M KM)</span>
          </div>
          <div className="mx-3 text-slate-600">|</div>
          <div className="text-slate-300">
            OBJECTS: <span className="text-emerald-400 font-bold">{asteroids.length} ACTIVE</span>
          </div>
        </div>

        {/* Floating View Controls Dock */}
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Legend */}
          <div className="flex items-center gap-3 bg-slate-950/70 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              <span>Safe (&gt;10 LD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              <span>Close Pass (&lt;5 LD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
              <span className="text-red-300 font-bold">PHA (Hazardous)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>Moon (1 LD)</span>
            </div>
          </div>

          {/* Camera & Layer Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={resetCameraFreeView}
              title="Reset 3D Perspective View"
              className={`p-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                cameraViewMode === "free"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>3D ORBIT</span>
            </button>

            <button
              onClick={setCameraTopView}
              title="Polar Top-Down Radar View"
              className={`p-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                cameraViewMode === "top"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>POLAR 2D</span>
            </button>

            {selectedAsteroid && (
              <button
                onClick={focusSelectedTarget}
                title="Lock Camera on Target Asteroid"
                className="p-2 rounded-lg text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition-all flex items-center gap-1"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>LOCK TARGET</span>
              </button>
            )}

            <button
              onClick={() => setShowOrbits(!showOrbits)}
              title="Toggle Extended Flyby Trajectories"
              className={`p-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                showOrbits ? "text-cyan-300 bg-cyan-950/50 border border-cyan-800" : "text-slate-500"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>LONG ORBITS</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive Hover Tooltip (Comfortable Clearance) ─────────────── */}
      {hoveredAsteroid && tooltipPos && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-950/95 backdrop-blur-xl border border-cyan-500/60 p-3.5 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] text-xs font-mono text-white min-w-[240px] after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[6px] after:border-transparent after:border-t-cyan-500/60"
          style={{ left: tooltipPos.x, top: Math.max(20, tooltipPos.y - 20) }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <span>✦</span>
              <span>{hoveredAsteroid.name}</span>
            </span>
            {hoveredAsteroid.is_potentially_hazardous_asteroid ? (
              <span className="px-1.5 py-0.5 rounded bg-red-500/25 text-red-300 border border-red-500/50 text-[9px] font-bold">
                PHA HAZARD
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px]">
                SAFE
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Miss Distance:</span>
              <span className="font-semibold text-white">
                {hoveredAsteroid.closest_miss_distance_ld?.toFixed(2)} LD
                <span className="text-[10px] text-slate-400 ml-1">
                  ({Math.round(hoveredAsteroid.closest_miss_distance_km || 0).toLocaleString()} km)
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Est. Diameter:</span>
              <span className="font-semibold text-white">{hoveredAsteroid.avg_diameter_meters} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Velocity:</span>
              <span className="font-semibold text-cyan-300">
                {Math.round(hoveredAsteroid.velocity_kmh || 0).toLocaleString()} km/h
              </span>
            </div>
          </div>
          <div className="mt-2 text-[9px] text-center text-cyan-400/90 bg-cyan-950/40 py-1 rounded border border-cyan-800/40">
            Click to inspect telemetry &amp; 3D model
          </div>
        </div>
      )}
    </div>
  );
}
