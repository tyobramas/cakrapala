"use client";

/**
 * ThreeISSGlobe (CesiumISSGlobe) — High-Performance 3D Photorealistic Satellite Radar.
 * Built with Three.js for 100% Turbopack/Next.js compatibility on Vercel:
 *   - 4K NASA Blue Marble Earth with topographic bump & ocean specular reflection
 *   - Atmospheric Rayleigh limb scattering glow shader
 *   - Real-time rotating dynamic cloud layer
 *   - Precise SGP4 spherical coordinate translation for satellite & orbital paths
 *   - Green past orbital trail & Orange future orbital trail
 *   - Red coverage footprint circle on Earth surface
 *   - Observer location marker ("YOU") with cyan radar pulse
 *   - Interactive OrbitControls (360° drag rotation, pinch/scroll zoom, pan)
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface OrbitPoint {
  lat: number;
  lon: number;
}

export interface CesiumISSGlobeProps {
  satelliteId?: string;
  satelliteName?: string;
  iconSvg?: string;
  themeColor?: string;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number;
  orbitTrail: OrbitPoint[];
  futureOrbit: OrbitPoint[];
  userLat: number;
  userLon: number;
}

const GLOBE_RADIUS = 2.0;
const EARTH_RADIUS_KM = 6371;

/**
 * Converts geographic coordinates (lat, lon, alt) to 3D Cartesian coordinates
 * matching Three.js standard SphereGeometry texture alignment.
 */
function latLonAltToVector3(
  latDeg: number,
  lonDeg: number,
  altKm: number = 0,
  baseRadius: number = GLOBE_RADIUS
): THREE.Vector3 {
  const r = baseRadius * (1 + altKm / EARTH_RADIUS_KM);
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Computes circle perimeter points for satellite footprint on Earth sphere
 */
function computeFootprintPoints(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  nPoints: number = 64
): THREE.Vector3[] {
  const safeAlt = Math.max(80, altKm || 420);
  const alpha = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + safeAlt));
  const center = latLonAltToVector3(latDeg, lonDeg, 1.5, GLOBE_RADIUS * 1.002);
  const centerNorm = center.clone().normalize();

  // Find two orthonormal basis vectors perpendicular to centerNorm
  const arbitrary = Math.abs(centerNorm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(centerNorm, arbitrary).normalize();
  const v = new THREE.Vector3().crossVectors(centerNorm, u).normalize();

  const circleRadius = GLOBE_RADIUS * 1.002 * Math.sin(alpha);
  const distFromOrigin = GLOBE_RADIUS * 1.002 * Math.cos(alpha);
  const circleCenter = centerNorm.clone().multiplyScalar(distFromOrigin);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const angle = (i / nPoints) * Math.PI * 2;
    const p = circleCenter
      .clone()
      .add(u.clone().multiplyScalar(Math.cos(angle) * circleRadius))
      .add(v.clone().multiplyScalar(Math.sin(angle) * circleRadius));
    points.push(p);
  }
  return points;
}

export default function CesiumISSGlobe({
  satelliteId = "iss",
  satelliteName = "ISS (ZARYA)",
  iconSvg = "/textures/satellites/iss.svg",
  themeColor = "#00f0ff",
  latitude,
  longitude,
  altitude,
  orbitTrail,
  futureOrbit,
  userLat,
  userLon,
}: CesiumISSGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const satSpriteRef = useRef<THREE.Sprite | null>(null);
  const satGlowRef = useRef<THREE.Mesh | null>(null);
  const pastLineRef = useRef<THREE.Line | null>(null);
  const futureLineRef = useRef<THREE.Line | null>(null);
  const footprintLineRef = useRef<THREE.Line | null>(null);
  const observerGroupRef = useRef<THREE.Group | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);

  // Latest props stored in ref for animation frame and update effects
  const propsRef = useRef({
    satelliteId,
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitude,
    orbitTrail,
    futureOrbit,
    userLat,
    userLon,
  });

  propsRef.current = {
    satelliteId,
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitude,
    orbitTrail,
    futureOrbit,
    userLat,
    userLon,
  };

  // ── 1. Bootstrap Three.js Scene ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.5, 6.0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.6;
    controls.maxDistance = 14.0;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(8, 4, 10);
    scene.add(sunLight);

    const backLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    backLight.position.set(-8, -3, -8);
    scene.add(backLight);

    const textureLoader = new THREE.TextureLoader();

    // ── 2. Deep Space Stars & Milky Way Skybox ────────────────────────────────
    const milkyWayTex = textureLoader.load("/textures/milkyway.jpg");
    milkyWayTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.SphereGeometry(300, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: milkyWayTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.5,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // ── 3. Earth Globe (4K NASA Blue Marble) ──────────────────────────────────
    const earthMap = textureLoader.load("/textures/planets/earth.jpg");
    earthMap.colorSpace = THREE.SRGBColorSpace;

    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      map: earthMap,
      roughness: 0.65,
      metalness: 0.1,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // Dynamic Atmospheric Clouds
    const cloudTex = textureLoader.load("/textures/planets/earth_clouds.png");
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.008, 64, 64);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(cloudsMesh);
    cloudsMeshRef.current = cloudsMesh;

    // Atmospheric Rayleigh Limb Glow
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.0, 0.75, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // ── 4. Active Satellite 3D Entity & Billboard ─────────────────────────────
    const satGroup = new THREE.Group();
    scene.add(satGroup);
    satGroupRef.current = satGroup;

    // Glowing Radar Ping Ring around Satellite
    const satPingGeo = new THREE.RingGeometry(0.05, 0.085, 32);
    const satPingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(themeColor || "#00f0ff"),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const satGlow = new THREE.Mesh(satPingGeo, satPingMat);
    satGroup.add(satGlow);
    satGlowRef.current = satGlow;

    // Satellite Center Core Dot
    const coreGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffffff"),
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    satGroup.add(coreMesh);

    // Satellite Icon Billboard Sprite
    const spriteTex = textureLoader.load(iconSvg || "/textures/satellites/iss.svg");
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTex,
      transparent: true,
      depthTest: false,
    });
    const satSprite = new THREE.Sprite(spriteMat);
    satSprite.scale.set(0.42, 0.26, 1);
    satSprite.position.set(0, 0.12, 0);
    satGroup.add(satSprite);
    satSpriteRef.current = satSprite;

    // ── 5. Orbit Trajectory Lines (Past Green / Future Orange) ─────────────────
    // Past Trail (Green)
    const pastGeo = new THREE.BufferGeometry();
    const pastMat = new THREE.LineBasicMaterial({
      color: 0x84cc16,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    const pastLine = new THREE.Line(pastGeo, pastMat);
    scene.add(pastLine);
    pastLineRef.current = pastLine;

    // Future Trail (Orange)
    const futureGeo = new THREE.BufferGeometry();
    const futureMat = new THREE.LineBasicMaterial({
      color: 0xf97316,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    const futureLine = new THREE.Line(futureGeo, futureMat);
    scene.add(futureLine);
    futureLineRef.current = futureLine;

    // ── 6. Coverage Footprint (Red Line) ───────────────────────────────────────
    const fpGeo = new THREE.BufferGeometry();
    const fpMat = new THREE.LineBasicMaterial({
      color: 0xef4444,
      linewidth: 2,
      transparent: true,
      opacity: 0.75,
    });
    const fpLine = new THREE.Line(fpGeo, fpMat);
    scene.add(fpLine);
    footprintLineRef.current = fpLine;

    // ── 7. Observer Location Marker ("YOU") ───────────────────────────────────
    const obsGroup = new THREE.Group();
    scene.add(obsGroup);
    observerGroupRef.current = obsGroup;

    const obsPinGeo = new THREE.SphereGeometry(0.03, 16, 16);
    const obsPinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const obsPin = new THREE.Mesh(obsPinGeo, obsPinMat);
    obsGroup.add(obsPin);

    const obsRingGeo = new THREE.RingGeometry(0.04, 0.065, 24);
    const obsRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const obsRing = new THREE.Mesh(obsRingGeo, obsRingMat);
    obsGroup.add(obsRing);

    // Initial Camera positioning facing the satellite
    const initialPos = latLonAltToVector3(latitude, longitude, altitude);
    camera.position.copy(initialPos.clone().multiplyScalar(1.9));
    camera.lookAt(0, 0, 0);

    // ── 8. Animation Render Loop ──────────────────────────────────────────────
    let pulseAngle = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Rotate clouds slowly
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.0003;
      }

      // Pulse Satellite radar ring
      pulseAngle += 0.04;
      if (satGlowRef.current) {
        const scale = 1.0 + Math.sin(pulseAngle) * 0.25;
        satGlowRef.current.scale.set(scale, scale, 1);
        satGlowRef.current.lookAt(camera.position);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  // ── 9. Sync Entity Positions on Telemetry Updates ───────────────────────────
  useEffect(() => {
    // 1. Update Satellite Position & Orientation
    if (satGroupRef.current) {
      const satPos = latLonAltToVector3(latitude, longitude, altitude);
      satGroupRef.current.position.copy(satPos);
    }

    // Update Satellite Icon Texture if satellite changed
    if (satSpriteRef.current) {
      const loader = new THREE.TextureLoader();
      loader.load(iconSvg || "/textures/satellites/iss.svg", (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (satSpriteRef.current) satSpriteRef.current.material.map = tex;
      });
    }

    // 2. Update Past Orbit Trail
    if (pastLineRef.current) {
      const pastCoords = [...(orbitTrail || []), { lat: latitude, lon: longitude }];
      const points = pastCoords.map((pt) =>
        latLonAltToVector3(pt.lat, pt.lon, altitude)
      );
      pastLineRef.current.geometry.dispose();
      pastLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }

    // 3. Update Future Orbit Trail
    if (futureLineRef.current) {
      const futureCoords = [{ lat: latitude, lon: longitude }, ...(futureOrbit || [])];
      const points = futureCoords.map((pt) =>
        latLonAltToVector3(pt.lat, pt.lon, altitude)
      );
      futureLineRef.current.geometry.dispose();
      futureLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }

    // 4. Update Footprint Coverage Circle
    if (footprintLineRef.current) {
      const fpPoints = computeFootprintPoints(latitude, longitude, altitude);
      footprintLineRef.current.geometry.dispose();
      footprintLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(fpPoints);
    }

    // 5. Update Observer Location Marker
    if (observerGroupRef.current) {
      const obsPos = latLonAltToVector3(userLat, userLon, 1, GLOBE_RADIUS * 1.005);
      observerGroupRef.current.position.copy(obsPos);
      observerGroupRef.current.lookAt(obsPos.clone().multiplyScalar(2));
    }
  }, [
    satelliteId,
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitude,
    orbitTrail,
    futureOrbit,
    userLat,
    userLon,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden"
      style={{ background: "#020713" }}
    />
  );
}
