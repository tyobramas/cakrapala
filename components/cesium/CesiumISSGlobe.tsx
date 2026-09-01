"use client";

/**
 * CesiumISSGlobe (Three.js 3D Satellite Radar Globe)
 *
 * High-Performance Photorealistic 3D Earth for Real-Time Satellite Tracking:
 *   - Bright, vibrant, crystal-clear sapphire & azure blue oceans
 *   - 4K NASA Blue Marble high-definition land terrain & realistic night city lights
 *   - Multi-angle daylight illumination so Earth is always bright and clear
 *   - Specular sun glint reflection on ocean surfaces (crisp, realistic)
 *   - Soft Rayleigh atmospheric limb scattering integrated seamlessly into the planet
 *   - Precise SGP4 spherical coordinate translation for satellite & orbital paths
 *   - Past Ground Track (Neon Lime Green) & Future Orbit (Neon Orange)
 *   - Red coverage footprint circle on Earth surface
 *   - Observer location marker ("YOU") with cyan radar pulse
 *   - Interactive OrbitControls (360° rotation, pinch/scroll zoom)
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
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const satSpriteRef = useRef<THREE.Sprite | null>(null);
  const satGlowRef = useRef<THREE.Mesh | null>(null);
  const satConnectorRef = useRef<THREE.Line | null>(null);
  const pastLineRef = useRef<THREE.Line | null>(null);
  const futureLineRef = useRef<THREE.Line | null>(null);
  const footprintLineRef = useRef<THREE.Line | null>(null);
  const observerGroupRef = useRef<THREE.Group | null>(null);

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
    camera.position.set(0, 1.8, 4.6);
    cameraRef.current = camera;

    // Renderer with ACES Filmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.3;
    controls.maxDistance = 12.0;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controlsRef.current = controls;

    const textureLoader = new THREE.TextureLoader();

    // ── 2. Deep Space Stars & Milky Way Skybox ────────────────────────────────
    const milkyWayTex = textureLoader.load("/textures/milkyway.jpg");
    milkyWayTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.SphereGeometry(300, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: milkyWayTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.55,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // ── 3. High-Definition Earth (Bright, Brilliant Blue Oceans & Crisp Land) ──
    const dayMap = textureLoader.load("/textures/planets/earth_4k.jpg");
    dayMap.colorSpace = THREE.SRGBColorSpace;

    const waterMaskMap = textureLoader.load("/textures/planets/earth_water_mask.png");
    const nightMap = textureLoader.load("/textures/planets/earth_night.jpg");
    nightMap.colorSpace = THREE.SRGBColorSpace;

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96);

    // Celestial Sun direction in Space
    const sunDir = new THREE.Vector3(15.0, 10.0, 20.0).normalize();

    // Custom World-Space Earth Shader
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayMap },
        waterMaskTexture: { value: waterMaskMap },
        nightTexture: { value: nightMap },
        sunDirection: { value: sunDir },
        uCameraPosition: { value: camera.position.clone() },
      },
      vertexShader: `
        uniform vec3 uCameraPosition;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vWorldViewDir;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldViewDir = normalize(uCameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D waterMaskTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vWorldViewDir;

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(vWorldViewDir);
          vec3 sDir = normalize(sunDirection);

          // Texture samples
          vec4 daySample = texture2D(dayTexture, vUv);
          float isWater = texture2D(waterMaskTexture, vUv).r; // 1.0 = ocean, 0.0 = land/ice
          vec4 nightSample = texture2D(nightTexture, vUv);

          // 1. Vibrant, Radiant Blue Oceans (Bright & High-Visibility):
          // Deep ocean: rich sapphire / cobalt blue (vec3(0.04, 0.28, 0.72))
          // Shallow / coastal waters: luminous azure / cyan (vec3(0.08, 0.52, 0.88))
          vec3 oceanDeep = vec3(0.04, 0.28, 0.72);
          vec3 oceanShallow = vec3(0.08, 0.52, 0.88);
          vec3 baseOcean = mix(oceanDeep, oceanShallow, clamp(daySample.b * 1.6, 0.0, 1.0));

          // 2. Daytime Surface Color:
          vec3 enhancedLand = daySample.rgb * 1.30;
          vec3 dayColor = mix(enhancedLand, baseOcean, isWater);

          // 3. Multi-directional Illumination (Bright, High-Clarity Global Fill):
          float sunDot = dot(normal, sDir);
          float sunDiff = clamp(sunDot, 0.0, 1.0);

          // Opposite fill light
          vec3 fillDir = normalize(vec3(-sDir.x, 0.3, -sDir.z));
          float fillDiff = clamp(dot(normal, fillDir), 0.0, 1.0) * 0.35;

          // Camera-facing fill so the observed Earth hemisphere is always beautifully illuminated
          float camDiff = clamp(dot(normal, viewDir), 0.0, 1.0) * 0.25;

          // High baseline ambient for bright, tactical satellite radar visibility
          float ambient = 0.55;

          float totalLight = sunDiff * 0.45 + fillDiff + camDiff + ambient;

          // 4. Crisp Specular Sun Glint Reflection on Oceans:
          vec3 halfVec = normalize(sDir + viewDir);
          float NdotH = max(0.0, dot(normal, halfVec));
          float specular = pow(NdotH, 96.0) * isWater * clamp(sunDot * 2.5, 0.0, 1.0) * 0.45;
          vec3 sunGlint = vec3(0.92, 0.96, 1.0) * specular;

          // 5. City Night Lights on unlit land:
          float nightTransition = clamp(1.0 - sunDiff * 3.0, 0.0, 1.0);
          vec3 cityLights = nightSample.rgb * vec3(1.0, 0.85, 0.45) * nightTransition * (1.0 - isWater) * 1.2;

          // 6. Integrated Atmospheric Limb Scattering (Soft Cyan-Blue Edge):
          float limbFresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.8);
          vec3 atmosScatter = vec3(0.15, 0.55, 0.95) * limbFresnel * 0.40;

          // Final Color Output
          vec3 finalColor = dayColor * totalLight + sunGlint + cityLights + atmosScatter;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
    earthMatRef.current = earthMat;

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // ── 4. Active Satellite 3D Entity & Billboard ─────────────────────────────
    const satGroup = new THREE.Group();
    scene.add(satGroup);
    satGroupRef.current = satGroup;

    // Glowing Radar Ping Ring around Satellite
    const satPingGeo = new THREE.RingGeometry(0.04, 0.07, 32);
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
    const coreGeo = new THREE.SphereGeometry(0.025, 16, 16);
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
    satSprite.scale.set(0.32, 0.20, 1);
    satSprite.position.set(0, 0.09, 0);
    satGroup.add(satSprite);
    satSpriteRef.current = satSprite;

    // Altitude Nadir Connector (Dashed line from surface to satellite)
    const connectorGeo = new THREE.BufferGeometry();
    const connectorMat = new THREE.LineDashedMaterial({
      color: 0x00f0ff,
      dashSize: 0.05,
      gapSize: 0.03,
      transparent: true,
      opacity: 0.75,
    });
    const satConnector = new THREE.Line(connectorGeo, connectorMat);
    scene.add(satConnector);
    satConnectorRef.current = satConnector;

    // ── 5. Orbit Trajectory Lines (Past Green / Future Orange) ─────────────────
    // Past Trail (Green)
    const pastGeo = new THREE.BufferGeometry();
    const pastMat = new THREE.LineBasicMaterial({
      color: 0x84cc16,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
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
      opacity: 0.95,
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
      opacity: 0.85,
    });
    const fpLine = new THREE.Line(fpGeo, fpMat);
    scene.add(fpLine);
    footprintLineRef.current = fpLine;

    // ── 7. Observer Location Marker ("YOU") ───────────────────────────────────
    const obsGroup = new THREE.Group();
    scene.add(obsGroup);
    observerGroupRef.current = obsGroup;

    const obsPinGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const obsPinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const obsPin = new THREE.Mesh(obsPinGeo, obsPinMat);
    obsGroup.add(obsPin);

    const obsRingGeo = new THREE.RingGeometry(0.035, 0.055, 24);
    const obsRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const obsRing = new THREE.Mesh(obsRingGeo, obsRingMat);
    obsGroup.add(obsRing);

    // Initial Camera positioning framing the Earth nicely
    const initialSatPos = latLonAltToVector3(latitude, longitude, altitude);
    const camDir = initialSatPos.clone().normalize();
    camera.position.set(camDir.x * 4.6, camDir.y * 4.6 + 0.4, camDir.z * 4.6);
    camera.lookAt(0, 0, 0);

    // ── 8. Animation Render Loop ──────────────────────────────────────────────
    let pulseAngle = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Pulse Satellite radar ring
      pulseAngle += 0.04;
      if (satGlowRef.current) {
        const scale = 1.0 + Math.sin(pulseAngle) * 0.22;
        satGlowRef.current.scale.set(scale, scale, 1);
        satGlowRef.current.lookAt(camera.position);
      }

      // Sync camera position uniform
      if (earthMatRef.current) {
        earthMatRef.current.uniforms.uCameraPosition.value.copy(camera.position);
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
      cameraRef.current = null;
    };
  }, []);

  // ── 9. Sync Entity Positions on Telemetry Updates ───────────────────────────
  useEffect(() => {
    // 1. Update Satellite Position & Nadir Connector
    if (satGroupRef.current) {
      const satPos = latLonAltToVector3(latitude, longitude, altitude);
      satGroupRef.current.position.copy(satPos);

      // Nadir surface point
      const surfPos = latLonAltToVector3(latitude, longitude, 0);
      if (satConnectorRef.current) {
        satConnectorRef.current.geometry.dispose();
        satConnectorRef.current.geometry = new THREE.BufferGeometry().setFromPoints([surfPos, satPos]);
        satConnectorRef.current.computeLineDistances();
      }
    }

    // Update Satellite Icon Texture if satellite changed
    if (satSpriteRef.current) {
      const loader = new THREE.TextureLoader();
      loader.load(iconSvg || "/textures/satellites/iss.svg", (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (satSpriteRef.current) satSpriteRef.current.material.map = tex;
      });
    }

    // Update radar ring color if theme changed
    if (satGlowRef.current) {
      (satGlowRef.current.material as THREE.MeshBasicMaterial).color.set(themeColor || "#00f0ff");
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
