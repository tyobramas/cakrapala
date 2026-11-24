"use client";

/**
 * CommandCenterGlobe — Photorealistic 3D Earth Orbit POV (ISS Cupola)
 *
 * Rendering pipeline:
 *   - Adaptive 8K (8192x4096) WebP NASA Blue Marble, Black Marble, Clouds,
 *     Tangent-Space Normal Map, and Specular Water Mask (auto-fallback to 4K)
 *   - Seamless 6 x 2048x2048 CubeMap Milky Way generated from lossless ESO
 *     Serge Brunier panorama, centered on the Galactic Core
 *   - Native-DPI 6,500-star GLSL procedural pinpoint starfield with OBAFGKM
 *     spectral temperatures & subtle diffraction spikes on mag-1 stars
 *   - Physically inspired Earth shader: object-space tangent normal mapping,
 *     Schlick-Fresnel ocean sun glint, projected cloud shadows, Rayleigh sunset
 *     terminator extinction, limb aerial perspective, and cloud-occluded city lights
 *   - Two-layer atmospheric scattering (inner Rayleigh limb + outer BackSide halo)
 */

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

interface CommandCenterGlobeProps {
  /** "card" keeps the framed look. "fullscreen" fills the landing viewport. */
  variant?: "card" | "fullscreen";
}

export default function CommandCenterGlobe({
  variant = "card",
}: CommandCenterGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const full = variant === "fullscreen";

    // ── Framing (ISS Cupola Wide-Horizon Composition) ─────────────────
    const EARTH_RADIUS = full ? 12.5 : 3.4;
    const EARTH_CENTER_Y = full ? -14.15 : -2.15;
    const CAMERA_FOV = full ? 52 : 48;
    const CAMERA_Z = full ? 4.95 : 4.4;

    const SPIN_AXIS = full
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

    // ISS orbital period ~92.68 min scaled smoothly for live viewport motion
    const ORBIT_RATE_RAD_S = (2 * Math.PI) / (92.68 * 60);
    const TIME_SCALE = full ? 32 : 18;
    const SPIN_RATE_RAD_S = ORBIT_RATE_RAD_S * TIME_SCALE;

    let spinAngle = 0;
    let cloudDriftU = 0;
    let lastFrameMs = performance.now();

    // Subtle cursor parallax
    let targetMouseX = 0;
    let targetMouseY = 0;
    let smoothMouseX = 0;
    let smoothMouseY = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (!full) return;
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2.0;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2.0;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // ── Scene, Camera & Renderer ──────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      2500
    );
    camera.position.set(0, 0.45, CAMERA_Z);
    camera.lookAt(0, -0.42, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x01030a, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);
    const supports8K = renderer.capabilities.maxTextureSize >= 8192;

    // ── Texture Loading Tracking ──────────────────────────────────────
    let loadedCount = 0;
    const totalAssets = 6; // 5 Earth maps + 1 Milky Way CubeMap
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalAssets && !disposed) {
        setReady(true);
      }
    };

    const textureLoader = new THREE.TextureLoader();
    const configureTex = (tex: THREE.Texture, isColor: boolean) => {
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = true;
      return tex;
    };

    const dayMap = configureTex(
      textureLoader.load(
        supports8K
          ? "/textures/planets/earth_day_8k.webp"
          : "/textures/planets/earth_4k.jpg",
        markLoaded,
        undefined,
        markLoaded
      ),
      true
    );

    const nightMap = configureTex(
      textureLoader.load(
        supports8K
          ? "/textures/planets/earth_night_8k.webp"
          : "/textures/planets/earth_night.jpg",
        markLoaded,
        undefined,
        markLoaded
      ),
      true
    );

    const cloudMap = configureTex(
      textureLoader.load(
        supports8K
          ? "/textures/planets/earth_clouds_8k.webp"
          : "/textures/planets/earth_clouds2.jpg",
        markLoaded,
        undefined,
        markLoaded
      ),
      false
    );

    const normalMap = configureTex(
      textureLoader.load(
        supports8K
          ? "/textures/planets/earth_normal_8k.webp"
          : "/textures/planets/earth_bump.jpg",
        markLoaded,
        undefined,
        markLoaded
      ),
      false
    );

    const specMap = configureTex(
      textureLoader.load(
        supports8K
          ? "/textures/planets/earth_specular_8k.webp"
          : "/textures/planets/earth_water_mask.png",
        markLoaded,
        undefined,
        markLoaded
      ),
      false
    );

    // ── HD Milky Way Skybox (Seamless 6 x 2048px CubeMap) ─────────────
    const cubeLoader = new THREE.CubeTextureLoader();
    cubeLoader.setPath("/textures/milkyway-cube/");
    const skyCube = cubeLoader.load(
      ["px.webp", "nx.webp", "py.webp", "ny.webp", "pz.webp", "nz.webp"],
      markLoaded,
      undefined,
      markLoaded
    );
    skyCube.colorSpace = THREE.SRGBColorSpace;
    skyCube.minFilter = THREE.LinearMipmapLinearFilter;
    skyCube.magFilter = THREE.LinearFilter;
    skyCube.generateMipmaps = true;

    const celestialGroup = new THREE.Group();
    scene.add(celestialGroup);

    const skyBoxGeo = new THREE.BoxGeometry(1100, 1100, 1100);
    const skyBoxMat = new THREE.ShaderMaterial({
      uniforms: {
        uSkyCube: { value: skyCube },
        uIntensity: { value: full ? 1.05 : 0.72 },
      },
      vertexShader: `
        varying vec3 vLocalDir;
        void main() {
          vLocalDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform samplerCube uSkyCube;
        uniform float uIntensity;
        varying vec3 vLocalDir;

        void main() {
          vec3 dir = normalize(vLocalDir);
          vec3 col = textureCube(uSkyCube, dir).rgb;

          // Deep-space astrophotography tone curve:
          // crush faint noise floor to pure obsidian while preserving golden galactic core & dust lanes
          float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float lift = smoothstep(0.004, 0.06, luma);
          col = pow(max(col, 0.0), vec3(1.12)) * (0.45 + 0.78 * lift) * uIntensity;

          // Subtle natural color separation (warm galactic bulge vs cool star clouds)
          float outLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = max(mix(vec3(outLuma), col, 1.14), 0.0);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const skyBox = new THREE.Mesh(skyBoxGeo, skyBoxMat);
    // Frame the Sagittarius/Scorpius Galactic Core gracefully across upper-left-to-right sky
    skyBox.rotation.set(
      full ? 0.14 : 0.28,
      full ? 0.14 : -0.55,
      full ? -0.34 : 0.0
    );
    celestialGroup.add(skyBox);

    // ── Razor-Sharp Native-DPI GLSL Pinpoint Starfield ────────────────
    const starCount = full ? 6500 : 2400;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);
    const starSpikes = new Float32Array(starCount);

    // Authentic blackbody stellar spectral palette (O, B, A, F, G, K, M)
    const spectralPalette = [
      new THREE.Color(0x9bb8ff), // O/B blue-white
      new THREE.Color(0xcad8ff), // B/A pale sapphire
      new THREE.Color(0xf8f9ff), // A pure white
      new THREE.Color(0xfff4e0), // F warm white
      new THREE.Color(0xffe4b5), // G solar cream
      new THREE.Color(0xffc994), // K warm amber
      new THREE.Color(0xffa97a), // M soft red-orange
    ];

    // Match galactic tilt so denser star bands follow the Milky Way plane
    const galacticQuat = new THREE.Quaternion().setFromEuler(skyBox.rotation);
    const tmpVec = new THREE.Vector3();

    for (let i = 0; i < starCount; i++) {
      // 42% concentrated gently along the galactic belt, 58% isotropic celestial sphere
      const inBand = i < starCount * 0.42;
      const theta = Math.random() * Math.PI * 2;
      let y: number;
      if (inBand) {
        // Gaussian-like spread around galactic equator
        const g = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
        y = Math.sin(g * 1.15);
      } else {
        y = 2 * Math.random() - 1;
      }
      const rPlane = Math.sqrt(Math.max(0, 1 - y * y));
      const radius = 360 + Math.random() * 140;

      tmpVec.set(rPlane * Math.cos(theta), y, rPlane * Math.sin(theta));
      if (inBand) tmpVec.applyQuaternion(galacticQuat);
      tmpVec.multiplyScalar(radius);

      starPositions[i * 3] = tmpVec.x;
      starPositions[i * 3 + 1] = tmpVec.y;
      starPositions[i * 3 + 2] = tmpVec.z;

      // Astronomical power-law magnitude distribution
      const magRoll = Math.random();
      let size: number;
      let brightness: number;
      let hasSpike = 0.0;
      if (magRoll > 0.994) {
        // Rare 1st-magnitude stars with delicate optical diffraction spikes
        size = 6.2 + Math.random() * 3.0;
        brightness = 1.0;
        hasSpike = 1.0;
      } else if (magRoll > 0.955) {
        size = 2.6 + Math.random() * 1.6;
        brightness = 0.72 + Math.random() * 0.28;
      } else if (magRoll > 0.72) {
        size = 1.5 + Math.random() * 1.0;
        brightness = 0.42 + Math.random() * 0.35;
      } else {
        size = 0.85 + Math.random() * 0.75;
        brightness = 0.18 + Math.random() * 0.28;
      }

      const col =
        spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
      starColors[i * 3] = col.r * brightness;
      starColors[i * 3 + 1] = col.g * brightness;
      starColors[i * 3 + 2] = col.b * brightness;
      starSizes[i] = size;
      starPhases[i] = Math.random() * Math.PI * 2;
      starSpikes[i] = hasSpike;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );
    starGeo.setAttribute("aColor", new THREE.BufferAttribute(starColors, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute("aPhase", new THREE.BufferAttribute(starPhases, 1));
    starGeo.setAttribute("aSpike", new THREE.BufferAttribute(starSpikes, 1));

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        attribute float aSpike;

        uniform float uTime;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vSpike;
        varying float vShimmer;

        void main() {
          vColor = aColor;
          vSpike = aSpike;
          // Ultra-subtle natural luminance shimmer
          vShimmer = 0.90 + 0.10 * sin(uTime * 0.9 + aPhase);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(aSize * uPixelRatio, 1.0, 26.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSpike;
        varying float vShimmer;

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          if (d > 0.5) discard;

          // Razor-sharp Gaussian pinpoint core + subtle Airy halo
          float core = exp(-d * d * (vSpike > 0.5 ? 95.0 : 42.0));
          float halo = exp(-d * 9.0) * 0.32;
          float intensity = core + halo;

          // Delicate 4-point optical diffraction spikes on rare brightest stars
          if (vSpike > 0.5) {
            float sx = exp(-abs(p.y) * 52.0) * exp(-abs(p.x) * 6.5);
            float sy = exp(-abs(p.x) * 52.0) * exp(-abs(p.y) * 6.5);
            intensity += (sx + sy) * 0.42;
          }

          vec3 col = mix(vColor, vec3(1.0), core * 0.65) * intensity * vShimmer;
          gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starField = new THREE.Points(starGeo, starMat);
    celestialGroup.add(starField);

    // ── Solar Light Vector (Dramatic Grazing Orbital Daylight) ────────
    // High-right sun illuminates the right hemisphere with golden ocean glint,
    // paints a warm Rayleigh sunset terminator slightly left of center, and
    // leaves the left horizon in rich starry night with 8K city lights.
    const sunDirection = new THREE.Vector3(1.52, 0.20, 0.42).normalize();

    // ── Earth Assembly ────────────────────────────────────────────────
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, EARTH_CENTER_Y, 0);
    if (full) {
      earthGroup.rotation.z = -0.045;
      earthGroup.rotation.x = 0.04;
    } else {
      earthGroup.rotation.z = -0.38;
    }
    scene.add(earthGroup);

    // ── Photorealistic Earth Surface Material ─────────────────────────
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayMap },
        nightTexture: { value: nightMap },
        normalMap: { value: normalMap },
        specularMap: { value: specMap },
        cloudTexture: { value: cloudMap },
        uSunDirection: { value: sunDirection },
        uUseNormalMap: { value: supports8K ? 1.0 : 0.0 },
        uCloudDriftU: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldTangent;
        varying vec3 vWorldBitangent;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;

          mat3 normalMat = mat3(modelMatrix);
          vec3 objN = normalize(normal);
          // Exact analytical sphere tangent along +U (longitude) in object space
          vec3 objT = vec3(objN.z, 0.0, -objN.x);
          float tLen = length(objT);
          objT = tLen > 0.0001 ? (objT / tLen) : vec3(1.0, 0.0, 0.0);
          vec3 objB = normalize(cross(objN, objT));

          vWorldNormal = normalize(normalMat * objN);
          vWorldTangent = normalize(normalMat * objT);
          vWorldBitangent = normalize(normalMat * objB);

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform sampler2D normalMap;
        uniform sampler2D specularMap;
        uniform sampler2D cloudTexture;
        uniform vec3 uSunDirection;
        uniform float uUseNormalMap;
        uniform float uCloudDriftU;

        varying vec3 vWorldNormal;
        varying vec3 vWorldTangent;
        varying vec3 vWorldBitangent;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vec3 N0 = normalize(vWorldNormal);
          vec3 T = normalize(vWorldTangent);
          vec3 B = normalize(vWorldBitangent);
          vec3 V = normalize(cameraPosition - vWorldPosition);

          float waterMask = smoothstep(0.18, 0.65, texture2D(specularMap, vUv).r);
          float landMask = 1.0 - waterMask;

          // 1. Tangent-space 8K topographic normal mapping (mountains & valleys on land only)
          vec3 N = N0;
          if (uUseNormalMap > 0.5) {
            vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
            mapN.xy *= 0.85 * landMask;
            N = normalize(T * mapN.x + B * mapN.y + N0 * max(mapN.z, 0.25));
          } else {
            vec2 stepUv = vec2(0.00025, 0.00025);
            float hC = texture2D(normalMap, vUv).r;
            float hU = texture2D(normalMap, vUv + vec2(stepUv.x, 0.0)).r;
            float hV = texture2D(normalMap, vUv + vec2(0.0, stepUv.y)).r;
            N = normalize(N0 - T * (hU - hC) * 1.4 * landMask - B * (hV - hC) * 1.4 * landMask);
          }

          float rawNL = dot(N0, uSunDirection);
          float dotNL = dot(N, uSunDirection);
          float dotNV = max(0.0, dot(N0, V));

          // 2. Day Surface (NASA Blue Marble 8K, physically calibrated albedo)
          float dayMask = smoothstep(-0.08, 0.14, rawNL);
          // Slightly softer planetary diffuse falloff than raw Lambertian
          float diffuse = pow(clamp(dotNL, 0.0, 1.0), 0.88);
          vec3 albedo = texture2D(dayTexture, vUv).rgb;
          // Enhance oceanic bathymetry depth & natural continental chroma slightly
          albedo = mix(albedo * vec3(0.96, 1.0, 1.04), albedo * vec3(1.03, 1.02, 0.98), landMask);

          // 3. Projected 3D Cloud Shadows onto Earth's surface
          vec2 sunTan = vec2(dot(uSunDirection, T), dot(uSunDirection, B));
          vec2 shadowUv = vec2(
            fract(vUv.x - uCloudDriftU + sunTan.x * 0.0011),
            clamp(vUv.y + sunTan.y * 0.0011, 0.001, 0.999)
          );
          float shadowDensity = texture2D(cloudTexture, shadowUv).r;
          float cloudShadow = 1.0 - smoothstep(0.18, 0.82, shadowDensity) * 0.44 * dayMask;

          // 4. Physical Ocean Specular Glint (Dual-lobe GGX-inspired + Schlick Fresnel)
          vec3 H = normalize(uSunDirection + V);
          float dotNH = max(0.0, dot(N0, H));
          float fresnel = 0.03 + 0.97 * pow(1.0 - dotNV, 5.0);
          float glintCore = pow(dotNH, 150.0) * 1.65;
          float glintBroad = pow(dotNH, 20.0) * (0.20 + 0.45 * fresnel);
          vec3 sunGlint = vec3(1.0, 0.96, 0.89)
            * (glintCore + glintBroad)
            * waterMask
            * smoothstep(-0.02, 0.18, rawNL)
            * cloudShadow;

          // 5. Rayleigh Sunset / Twilight Terminator Extinction Band
          float terminator = exp(-pow((rawNL - 0.015) / 0.072, 2.0));
          vec3 twilightWarm = vec3(1.0, 0.42, 0.14) * terminator * (0.28 * landMask + 0.20 * waterMask) * cloudShadow;

          vec3 daySurface = (albedo * diffuse * 1.18 * cloudShadow + sunGlint) * dayMask + twilightWarm;

          // 6. Aerial Perspective / Surface Rayleigh Haze toward Earth's Horizon Limb
          float grazing = 1.0 - dotNV;
          float hazeAmount = pow(grazing, 2.8) * smoothstep(-0.14, 0.30, rawNL);
          vec3 skyScatter = mix(vec3(0.10, 0.36, 0.88), vec3(0.42, 0.74, 1.0), pow(grazing, 2.2));
          // Slight warm sunset scatter near terminator
          skyScatter = mix(skyScatter, vec3(0.95, 0.46, 0.22), terminator * 0.45);
          daySurface = mix(daySurface, skyScatter * 1.15, clamp(hazeAmount * 0.72, 0.0, 0.85));

          // 7. NASA Black Marble 8K Night City Lights (Cloud-Occluded & Diffused)
          float nightMask = 1.0 - smoothstep(-0.08, 0.05, rawNL);
          vec2 overheadCloudUv = vec2(fract(vUv.x - uCloudDriftU), vUv.y);
          float overheadCloud = texture2D(cloudTexture, overheadCloudUv).r;
          float cloudOcclusion = 1.0 - smoothstep(0.22, 0.85, overheadCloud) * 0.72;

          vec3 citySample = texture2D(nightTexture, vUv).rgb;
          // Natural sodium-vapor amber & crisp white urban centers
          vec3 cityLights = pow(max(citySample, 0.0), vec3(1.15))
            * vec3(1.55, 1.18, 0.72)
            * 2.45
            * nightMask
            * cloudOcclusion;

          // Subtle ambient starlight / moonlight bounce on dark hemisphere
          vec3 nightAmbient = mix(
            vec3(0.0018, 0.0042, 0.011),
            vec3(0.0045, 0.0068, 0.013),
            landMask
          ) * nightMask;

          vec3 finalColor = daySurface + cityLights + nightAmbient;

          gl_FragColor = vec4(finalColor, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      toneMapped: true,
    });

    const orbitPitchGroup = new THREE.Group();
    earthGroup.add(orbitPitchGroup);

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 160, 160);
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    if (full) {
      // ISS 51.6° inclination positioned over Europe / Mediterranean / North Africa / Middle East
      earthMesh.rotation.z = THREE.MathUtils.degToRad(51.6);
      earthMesh.rotation.y = THREE.MathUtils.degToRad(22);
    }
    orbitPitchGroup.add(earthMesh);

    // ── Photorealistic 8K Cloud Layer (Self-Relief + Sunset Terminator) ──
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        cloudTexture: { value: cloudMap },
        uSunDirection: { value: sunDirection },
        uCloudDriftU: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldTangent;
        varying vec3 vWorldBitangent;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;

          mat3 normalMat = mat3(modelMatrix);
          vec3 objN = normalize(normal);
          vec3 objT = vec3(objN.z, 0.0, -objN.x);
          float tLen = length(objT);
          objT = tLen > 0.0001 ? (objT / tLen) : vec3(1.0, 0.0, 0.0);
          vec3 objB = normalize(cross(objN, objT));

          vWorldNormal = normalize(normalMat * objN);
          vWorldTangent = normalize(normalMat * objT);
          vWorldBitangent = normalize(normalMat * objB);

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D cloudTexture;
        uniform vec3 uSunDirection;
        uniform float uCloudDriftU;

        varying vec3 vWorldNormal;
        varying vec3 vWorldTangent;
        varying vec3 vWorldBitangent;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vec2 cuv = vec2(fract(vUv.x - uCloudDriftU), vUv.y);
          float density = texture2D(cloudTexture, cuv).r;
          if (density < 0.04) discard;

          vec3 N = normalize(vWorldNormal);
          vec3 T = normalize(vWorldTangent);
          vec3 B = normalize(vWorldBitangent);
          vec3 V = normalize(cameraPosition - vWorldPosition);

          // Micro self-shadowing across cloud tops for volumetric cumulus relief
          vec2 sunStep = vec2(dot(uSunDirection, T), dot(uSunDirection, B)) * 0.00055;
          float densitySun = texture2D(cloudTexture, vec2(fract(cuv.x + sunStep.x), clamp(cuv.y + sunStep.y, 0.001, 0.999))).r;
          float selfRelief = clamp(1.0 + (density - densitySun) * 1.15, 0.72, 1.18);

          float dotNL = dot(N, uSunDirection);
          float dayFactor = smoothstep(-0.08, 0.14, dotNL);
          float terminator = exp(-pow((dotNL - 0.015) / 0.070, 2.0));

          // Crisp sunlit cloud tops + golden-amber sunset edge + soft slate night clouds
          float sunLit = clamp(pow(max(dotNL, 0.0), 0.78), 0.12, 1.0) * selfRelief;
          vec3 dayCloud = vec3(0.97, 0.985, 1.0) * sunLit * 1.12;
          vec3 sunsetCloud = vec3(1.0, 0.50, 0.24) * terminator * 0.65;
          vec3 nightCloud = vec3(0.012, 0.020, 0.036);

          vec3 cloudColor = mix(nightCloud, dayCloud, dayFactor) + sunsetCloud;

          // Limb aerial perspective on clouds near horizon
          float grazing = 1.0 - max(0.0, dot(N, V));
          vec3 horizonBlue = vec3(0.28, 0.62, 1.0);
          cloudColor = mix(cloudColor, horizonBlue, pow(grazing, 3.2) * dayFactor * 0.55);

          float alpha = smoothstep(0.06, 0.88, density) * mix(0.22, 0.82, dayFactor);
          // Fade clouds very gently right at the razor limb edge
          alpha *= 1.0 - smoothstep(0.88, 1.0, grazing) * 0.35;

          gl_FragColor = vec4(cloudColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      toneMapped: true,
    });

    const cloudPitchGroup = new THREE.Group();
    earthGroup.add(cloudPitchGroup);

    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.0038, 160, 160);
    const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    if (full) {
      cloudsMesh.rotation.z = THREE.MathUtils.degToRad(51.6);
      cloudsMesh.rotation.y = THREE.MathUtils.degToRad(22);
    }
    cloudPitchGroup.add(cloudsMesh);

    // ── Layer 1: Inner Rayleigh Troposphere/Stratosphere Limb Glow ────
    const innerAtmosGeo = new THREE.SphereGeometry(
      EARTH_RADIUS * (full ? 1.012 : 1.011),
      160,
      160
    );
    const innerAtmosMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirection: { value: sunDirection },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(vViewDir);
          float rim = 1.0 - max(0.0, dot(N, V));

          // Concentrated physical tangent-path scattering along Earth's curved limb
          float limb = smoothstep(0.46, 0.985, rim);
          float density = pow(limb, 3.0) * 1.95;

          float dotSun = dot(N, uSunDirection);
          float dayLimb = smoothstep(-0.10, 0.22, dotSun);
          float nightLimb = 1.0 - smoothstep(-0.15, 0.05, dotSun);
          float terminator = exp(-pow((dotSun - 0.01) / 0.11, 2.0));

          // Authentic NASA ISS orbital Rayleigh palette (sapphire -> sky blue -> ice-white horizon)
          vec3 deepCobalt = vec3(0.04, 0.28, 0.88);
          vec3 orbitalSky = vec3(0.24, 0.66, 1.0);
          vec3 horizonWhite = vec3(0.86, 0.95, 1.0);

          vec3 dayColor = mix(deepCobalt, orbitalSky, smoothstep(0.42, 0.82, rim));
          dayColor = mix(dayColor, horizonWhite, smoothstep(0.84, 0.99, rim));

          // Warm amber-violet sunset transition at the terminator
          vec3 twilightColor = vec3(0.95, 0.42, 0.18) * terminator * pow(limb, 2.4) * 0.55;

          // Subtle authentic 557.7nm oxygen nightglow (real ISS photography)
          vec3 nightAirglow = vec3(0.06, 0.36, 0.28) * nightLimb * pow(limb, 3.8) * 0.26;

          vec3 color = dayColor * density * dayLimb + twilightColor + nightAirglow;
          float alpha = clamp(density * dayLimb + terminator * 0.22 + nightLimb * 0.12, 0.0, 0.96);

          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
    const innerAtmosMesh = new THREE.Mesh(innerAtmosGeo, innerAtmosMat);
    earthGroup.add(innerAtmosMesh);

    // ── Layer 2: Outer Exosphere Rayleigh Halo (BackSide Soft Bloom) ──
    const outerAtmosRadius = EARTH_RADIUS * (full ? 1.046 : 1.065);
    const outerAtmosGeo = new THREE.SphereGeometry(outerAtmosRadius, 128, 128);
    // Exact geometric tangent dot at Earth's limb for seamless exponential fade
    const outerAtmosMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirection: { value: sunDirection },
        uLimbEdgeDot: { value: full ? 0.30 : 0.36 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        uniform float uLimbEdgeDot;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(vViewDir);

          // On BackSide sphere, dot(-N, V) is 0 at outer silhouette and increases inward toward Earth's limb
          float backDot = max(0.0, dot(-N, V));
          float t = clamp(backDot / uLimbEdgeDot, 0.0, 1.0);
          float falloff = pow(t, 3.8);

          float dotSun = dot(N, uSunDirection);
          float daySide = smoothstep(-0.18, 0.32, dotSun);
          float terminator = exp(-pow((dotSun + 0.02) / 0.16, 2.0));

          // Mie forward-scattering solar rim boost on the sunlit right edge
          float sunForward = pow(max(0.0, dot(-V, uSunDirection)), 4.0) * 0.35;

          vec3 haloBlue = mix(vec3(0.05, 0.32, 0.92), vec3(0.45, 0.78, 1.0), pow(t, 2.2));
          vec3 haloTwilight = vec3(0.85, 0.38, 0.18) * terminator * 0.28;
          vec3 haloNight = vec3(0.03, 0.14, 0.24) * (1.0 - daySide) * 0.16;

          vec3 color = (haloBlue * (0.85 + sunForward) * daySide + haloTwilight + haloNight) * falloff;
          float alpha = clamp(falloff * (daySide * 0.85 + 0.12), 0.0, 0.92);

          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const outerAtmosMesh = new THREE.Mesh(outerAtmosGeo, outerAtmosMat);
    earthGroup.add(outerAtmosMesh);

    // ── Animation Loop ────────────────────────────────────────────────
    let animId: number;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const elapsed = (nowMs - startTime) * 0.001;
      const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
      lastFrameMs = nowMs;

      spinAngle += SPIN_RATE_RAD_S * dt;
      cloudDriftU = (cloudDriftU + dt * 0.00035) % 1.0;

      earthMat.uniforms.uCloudDriftU.value = cloudDriftU;
      cloudMat.uniforms.uCloudDriftU.value = cloudDriftU;
      starMat.uniforms.uTime.value = elapsed;

      if (full) {
        orbitPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);
        cloudPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);
        // Ultra-slow celestial sphere drift synchronized with orbital flight
        celestialGroup.rotation.x -= 0.00045 * dt;
      } else {
        orbitPitchGroup.rotation.y = spinAngle;
        cloudPitchGroup.rotation.y = spinAngle;
        celestialGroup.rotation.y += 0.0012 * dt;
      }

      // Smooth damped cupola float + delicate mouse parallax
      smoothMouseX += (targetMouseX - smoothMouseX) * Math.min(1, dt * 2.5);
      smoothMouseY += (targetMouseY - smoothMouseY) * Math.min(1, dt * 2.5);

      const floatX = Math.sin(elapsed * 0.28) * 0.025 + smoothMouseX * 0.085;
      const floatY =
        0.45 + Math.cos(elapsed * 0.22) * 0.016 - smoothMouseY * 0.045;

      camera.position.set(floatX, floatY, CAMERA_Z);
      camera.lookAt(smoothMouseX * 0.03, -0.42 - smoothMouseY * 0.015, 0);

      renderer.render(scene, camera);
    };
    animate();

    // Failsafe ready transition if textures load from browser cache synchronously
    const readyTimer = window.setTimeout(() => {
      if (!disposed) setReady(true);
    }, 1400);

    // ── Responsive Resize ─────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      window.clearTimeout(readyTimer);
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      innerAtmosGeo.dispose();
      innerAtmosMat.dispose();
      outerAtmosGeo.dispose();
      outerAtmosMat.dispose();
      skyBoxGeo.dispose();
      skyBoxMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      dayMap.dispose();
      nightMap.dispose();
      cloudMap.dispose();
      normalMap.dispose();
      specMap.dispose();
      skyCube.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#01030a]">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Subtle loading veil — fades away smoothly once WebGL is ready */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#01030a] transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="font-mono text-[10px] tracking-[0.35em] text-slate-400/70 uppercase">
          Calibrating Orbital Viewport
        </span>
      </div>

      {/* Card variant telemetry captions (used only outside landing fullscreen) */}
      {variant === "card" && (
        <>
          <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] tracking-wider text-slate-200">
              LOW EARTH ORBIT · 418 KM
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/65 px-4 py-1 font-mono text-[9px] tracking-wider text-slate-300 backdrop-blur-xl">
              <span>8K BLUE MARBLE</span>
              <span className="text-white/20">·</span>
              <span>HD MILKY WAY</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
