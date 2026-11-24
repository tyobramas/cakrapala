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
  solarLatDeg?: number;
  solarLonDeg?: number;
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
  solarLatDeg = 0,
  solarLonDeg = 0,
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
    solarLatDeg,
    solarLonDeg,
  });

  useEffect(() => {
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
      solarLatDeg,
      solarLonDeg,
    };
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
    solarLatDeg,
    solarLonDeg,
  ]);

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

    // ── 3. Photorealistic 8K Earth with True Real-Time Day/Night Solar Terminator & City Lights ──
    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const dayMap = textureLoader.load("/textures/planets/earth_day_8k.webp");
    dayMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = maxAniso;

    const waterMaskMap = textureLoader.load("/textures/planets/earth_water_mask.png");
    const nightMap = textureLoader.load("/textures/planets/earth_night_8k.webp");
    nightMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.anisotropy = maxAniso;

    const cloudsMap = textureLoader.load("/textures/planets/earth_clouds_8k.webp");
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
    cloudsMap.anisotropy = maxAniso;

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96);

    // Exact real-time VSOP87 subsolar vector in Earth-Fixed coordinates
    const sunDir = latLonAltToVector3(
      propsRef.current.solarLatDeg,
      propsRef.current.solarLonDeg,
      0,
      1.0,
    ).normalize();

    // Physically-inspired Real-Time Day / Golden Twilight / Night City Lights Shader
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayMap },
        waterMaskTexture: { value: waterMaskMap },
        nightTexture: { value: nightMap },
        cloudsTexture: { value: cloudsMap },
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
        uniform sampler2D cloudsTexture;
        uniform vec3 sunDirection;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vWorldViewDir;

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(vWorldViewDir);
          vec3 sDir = normalize(sunDirection);

          vec3 daySample = texture2D(dayTexture, vUv).rgb;
          float isWater = texture2D(waterMaskTexture, vUv).r;
          vec3 nightSample = texture2D(nightTexture, vUv).rgb;
          float cloudVal = texture2D(cloudsTexture, vUv).r;

          // Rich sunlit oceans + crisp natural terrain
          vec3 oceanDeep = vec3(0.015, 0.095, 0.28);
          vec3 oceanShallow = vec3(0.04, 0.24, 0.52);
          vec3 baseOcean = mix(oceanDeep, oceanShallow, clamp(daySample.b * 1.5, 0.0, 1.0));
          vec3 surfaceDay = mix(daySample * 1.18, baseOcean, isWater * 0.72);

          // Blend crisp sunlit cloud formations on the day side
          float sunDot = dot(normal, sDir);
          float dayMask = smoothstep(-0.14, 0.16, sunDot);
          float diffuse = pow(max(sunDot, 0.0), 0.78);
          vec3 sunlitSurface = mix(surfaceDay, vec3(0.95, 0.97, 1.0), cloudVal * 0.44);

          // Day illumination (natural orbital sunlight) + subtle starlit night ambient so continents remain faintly legible
          vec3 nightBase = surfaceDay * vec3(0.032, 0.048, 0.088);
          vec3 litColor = mix(nightBase, sunlitSurface * (0.28 + diffuse * 1.08), dayMask);

          // Golden-amber atmospheric Rayleigh twilight scatter right along the exact sunset/sunrise terminator
          float twilightBand = exp(-pow((sunDot + 0.01) / 0.11, 2.0));
          vec3 twilightGlow = vec3(1.0, 0.44, 0.15) * twilightBand * 0.20 * (1.0 - cloudVal * 0.35);

          // Specular solar glint over sunlit oceans (masked by clouds)
          vec3 halfVec = normalize(sDir + viewDir);
          float NdotH = max(0.0, dot(normal, halfVec));
          float specular = pow(NdotH, 92.0) * isWater * (1.0 - cloudVal * 0.75) * smoothstep(0.02, 0.25, sunDot) * 0.52;
          vec3 sunGlint = vec3(0.96, 0.98, 1.0) * specular;

          // Radiant 8K NASA City Night Lights across Earth's dark hemisphere
          float nightMask = smoothstep(0.06, -0.18, sunDot);
          vec3 cityLights = nightSample * vec3(1.15, 0.88, 0.52) * nightMask * (1.0 - cloudVal * 0.35) * 1.85;

          // Physically-modulated atmospheric Rayleigh limb glow (bright cyan-blue on day limb, faint indigo on night limb)
          float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.6);
          vec3 limbCol = mix(vec3(0.06, 0.14, 0.32), vec3(0.22, 0.62, 1.0), dayMask);
          vec3 atmosScatter = limbCol * fresnel * mix(0.26, 0.62, dayMask);

          vec3 finalColor = litColor + twilightGlow + sunGlint + cityLights + atmosScatter;

          gl_FragColor = vec4(finalColor, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
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

    // 6. Update Real-Time Solar Subpoint Direction for Exact Day/Night Terminator
    if (earthMatRef.current) {
      const realSunDir = latLonAltToVector3(solarLatDeg, solarLonDeg, 0, 1.0).normalize();
      earthMatRef.current.uniforms.sunDirection.value.copy(realSunDir);
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
    solarLatDeg,
    solarLonDeg,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden"
      style={{ background: "#020713" }}
    />
  );
}
