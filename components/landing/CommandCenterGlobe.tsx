"use client";

/**
 * CommandCenterGlobe — Photorealistic 3D Earth Orbit POV
 * Matches wide-horizon orbital reference imagery (ISS cupola / LEO view).
 * Features:
 *   - NASA Blue Marble 4K surface
 *   - Topographic bump mapping
 *   - Specular ocean reflections
 *   - Dynamic transparent cloud layer
 *   - Atmospheric Rayleigh glow & razor-sharp cyan limb band
 *   - Seamless 360° planetary rotation (never goes blank)
 *   - Multi-temperature deep starfield & Milky Way backdrop
 */

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

interface CommandCenterGlobeProps {
  /** "card" keeps the existing framed look. "fullscreen" fills the viewport. */
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

    // ── Framing ────────────────────────────────────────────────────────
    // Fullscreen pushes the sphere down and out past both screen edges so
    // only the limb arc is visible, matching a cupola-window composition.
    const EARTH_RADIUS = full ? 12.5 : 3.4;
    const EARTH_CENTER_Y = full ? -14.1 : -2.15;
    const CAMERA_FOV = full ? 55 : 48;
    const CAMERA_Z = full ? 4.9 : 4.4;
    // Milky Way is bright and luminous in fullscreen matching NASA reference imagery
    const SKY_OPACITY = full ? 0.95 : 0.65;
    const STAR_OPACITY = full ? 0.75 : 0.85;

    // Orbital motion. From a forward-facing window the surface always flows
    // straight DOWN the screen, so the spin axis is +X regardless of the
    // orbit's inclination — inclination only changes which terrain appears.
    const SPIN_AXIS = full
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

    // ISS-like period 92.68 min -> 2*pi/5560.8 s = 1.130e-3 rad/s = 0.0647 deg/s.
    // At true rate a visitor sees 2 degrees in 30 s, so it is scaled for display.
    const ORBIT_RATE_RAD_S = (2 * Math.PI) / (92.68 * 60);
    const TIME_SCALE = full ? 45 : 20;
    const SPIN_RATE_RAD_S = ORBIT_RATE_RAD_S * TIME_SCALE;

    let spinAngle = 0;
    let lastFrameMs = performance.now();

    // ── Scene, Camera & Renderer ───────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 0.45, CAMERA_Z);
    camera.lookAt(0, -0.4, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);

    // ── Milky Way Background Sky Dome ─────────────────────────────────
    const milkyWayTexture = textureLoader.load("/textures/milkyway.jpg");
    milkyWayTexture.colorSpace = THREE.SRGBColorSpace;
    milkyWayTexture.anisotropy = maxAniso;

    const skyGeo = new THREE.SphereGeometry(600, 48, 48);
    const skyMat = new THREE.MeshBasicMaterial({
      map: milkyWayTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: SKY_OPACITY,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    // Align Milky Way: in fullscreen, diagonal aesthetic tilt (~30°) across the deep space sky
    skyDome.rotation.x = full ? 0.08 : 0.35;
    skyDome.rotation.y = full ? -0.42 : -1.1;
    skyDome.rotation.z = full ? -0.52 : 0.0;
    // Fix mirrored sky: BackSide sphere flips texture horizontally.
    // Negate scale.x to restore correct East/West orientation matching real sky (e.g. Stellarium).
    skyDome.scale.x = -1;

    // ── Celestial Sphere Assembly (Milky Way Sky Dome + Starfield) ────
    // Grouped together so the entire cosmos moves as a physically unified celestial sphere
    const celestialGroup = new THREE.Group();
    celestialGroup.add(skyDome);
    scene.add(celestialGroup);

    // ── Multi-Temperature Starfield ───────────────────────────────────
    const starCount = 2800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const stellarPalette = [
      new THREE.Color(0xa8c5ff),
      new THREE.Color(0xdce6ff),
      new THREE.Color(0xfff7ea),
      new THREE.Color(0xffdfb3),
      new THREE.Color(0xffb87a),
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 80 + Math.random() * 350;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      const col = stellarPalette[Math.floor(Math.random() * stellarPalette.length)];
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: STAR_OPACITY,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    celestialGroup.add(stars);

    // ── Solar Vector (Calculated in World Space) ──────────────────────
    // Direct Sun position high-right creates brilliant daylit Earth on the right,
    // a glowing twilight terminator ribbon across center, and deep starry night on the left.
    const sunDirection = new THREE.Vector3(1.7, 0.12, 0.45).normalize();

    // ── Earth Assembly Group ──────────────────────────────────────────
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, EARTH_CENTER_Y, 0);
    if (full) {
      earthGroup.rotation.z = -0.06;
      earthGroup.rotation.x = 0.05;
    } else {
      earthGroup.rotation.z = -0.38; // 22° axial tilt in card mode
    }
    scene.add(earthGroup);

    // ── Texture Loading ───────────────────────────────────────────────
    let texturesLoaded = 0;
    const totalTextures = 5;

    const onTextureLoaded = () => {
      texturesLoaded++;
      if (texturesLoaded >= totalTextures && !disposed) {
        setReady(true);
      }
    };

    const onTextureError = () => {
      texturesLoaded++;
      if (texturesLoaded >= totalTextures && !disposed) {
        setReady(true);
      }
    };

    const dayMap = textureLoader.load("/textures/planets/earth_4k.jpg", onTextureLoaded, undefined, onTextureError);
    dayMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = maxAniso;
    dayMap.minFilter = THREE.LinearMipmapLinearFilter;
    dayMap.magFilter = THREE.LinearFilter;
    dayMap.generateMipmaps = true;

    const bumpMap = textureLoader.load("/textures/planets/earth_bump.jpg", onTextureLoaded, undefined, onTextureError);
    bumpMap.anisotropy = maxAniso;
    bumpMap.minFilter = THREE.LinearMipmapLinearFilter;

    const specMap = textureLoader.load("/textures/planets/earth_specular.jpg", onTextureLoaded, undefined, onTextureError);
    specMap.anisotropy = maxAniso;
    specMap.minFilter = THREE.LinearMipmapLinearFilter;

    const nightMap = textureLoader.load("/textures/planets/earth_night.jpg", onTextureLoaded, undefined, onTextureError);
    nightMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.anisotropy = maxAniso;
    nightMap.minFilter = THREE.LinearMipmapLinearFilter;

    const cloudTex = textureLoader.load("/textures/planets/earth_clouds.png", onTextureLoaded, undefined, onTextureError);
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    cloudTex.anisotropy = maxAniso;

    // ── Custom Photorealistic Day/Night Earth Material ────────────────
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayMap },
        nightTexture: { value: nightMap },
        bumpMap: { value: bumpMap },
        specularMap: { value: specMap },
        uSunDirection: { value: sunDirection },
        uBumpScale: { value: 0.035 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform sampler2D bumpMap;
        uniform sampler2D specularMap;
        uniform vec3 uSunDirection;
        uniform float uBumpScale;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vec3 worldNormal = normalize(vWorldNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          // Topographic elevation bump perturbation
          vec2 dU = vec2(0.00025, 0.0);
          vec2 dV = vec2(0.0, 0.00025);
          float hC = texture2D(bumpMap, vUv).r;
          float hU = texture2D(bumpMap, vUv + dU).r;
          float hV = texture2D(bumpMap, vUv + dV).r;
          float diffU = (hU - hC) * uBumpScale;
          float diffV = (hV - hC) * uBumpScale;

          vec3 up = abs(worldNormal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 tangent = normalize(cross(up, worldNormal));
          vec3 bitangent = cross(worldNormal, tangent);
          vec3 perturbedNormal = normalize(worldNormal - tangent * diffU - bitangent * diffV);

          float rawNL = dot(worldNormal, uSunDirection);
          float dotNL = dot(perturbedNormal, uSunDirection);

          // 1. Day Surface (NASA Blue Marble 4K)
          float dayDiffuse = clamp(dotNL, 0.0, 1.0);
          float dayFactor = smoothstep(-0.02, 0.08, rawNL);
          
          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          // Natural color calibration: rich vegetation greens, desert ochres, deep sea blues
          dayColor = pow(dayColor, vec3(0.96)) * 1.08;

          // 2. Specular Ocean Glint (Sunlight reflection on water)
          float specMask = texture2D(specularMap, vUv).r;
          vec3 halfVec = normalize(uSunDirection + viewDir);
          float dotNH = max(0.0, dot(perturbedNormal, halfVec));
          float specPower = pow(dotNH, 64.0);
          float specIntensity = specPower * specMask * max(0.0, dotNL);
          vec3 specGlint = vec3(1.0, 1.0, 1.0) * specIntensity * 1.2;

          // 3. Night City Lights (NASA Black Marble 4K)
          float nightFactor = 1.0 - smoothstep(-0.05, 0.05, rawNL);
          vec3 nightSample = texture2D(nightTexture, vUv).rgb;
          vec3 cityTone = nightSample * vec3(1.42, 1.22, 0.92);
          cityTone = pow(cityTone, vec3(1.12)) * 3.0;
          vec3 nightLights = cityTone * nightFactor;

          // 4. Starlight ambient illumination (deep dark indigo for unpopulated land & ocean)
          vec3 nightOceanAmbient = mix(vec3(0.002, 0.005, 0.012), vec3(0.006, 0.009, 0.016), dayColor.g) * nightFactor;

          // Composite physical surface: natural daylight + specular glint + night lights (NO yellow artificial glow)
          vec3 finalColor = (dayColor * dayDiffuse + specGlint) * dayFactor
                          + nightLights
                          + nightOceanAmbient;

          gl_FragColor = vec4(finalColor, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      toneMapped: true,
    });

    // ── Orbital Pitch Group & Earth Mesh ──────────────────────────────
    const orbitPitchGroup = new THREE.Group();
    earthGroup.add(orbitPitchGroup);

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    if (full) {
      // ISS 51.6° orbital inclination: ground track sweeps across populated continents
      // (Europe, Africa, Asia, Americas) avoiding the Antarctic polar cap
      earthMesh.rotation.z = THREE.MathUtils.degToRad(51.6);
      earthMesh.rotation.y = THREE.MathUtils.degToRad(25);
    }
    orbitPitchGroup.add(earthMesh);

    // ── Dynamic Cloud Layer with Day/Night Shading ─────────────────────
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        cloudTexture: { value: cloudTex },
        uSunDirection: { value: sunDirection },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D cloudTexture;
        uniform vec3 uSunDirection;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          float cloudDensity = texture2D(cloudTexture, vUv).r;
          if (cloudDensity < 0.04) discard;

          float dotNL = dot(vWorldNormal, uSunDirection);
          float dayFactor = smoothstep(-0.04, 0.10, dotNL);

          // Natural cloud colors: crisp white in day, dark silhouetted at night — NO yellow tint
          vec3 dayCloudColor = vec3(1.0, 1.0, 1.0) * clamp(dotNL, 0.15, 1.0);
          vec3 nightCloudColor = vec3(0.02, 0.03, 0.05);

          vec3 cloudColor = mix(nightCloudColor, dayCloudColor, dayFactor);
          float alpha = smoothstep(0.05, 0.85, cloudDensity) * (mix(0.18, 0.36, dayFactor));

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

    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.0035, 128, 128);
    const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    if (full) {
      cloudsMesh.rotation.z = THREE.MathUtils.degToRad(51.6);
      cloudsMesh.rotation.y = THREE.MathUtils.degToRad(25);
    }
    cloudPitchGroup.add(cloudsMesh);

    // ── Atmospheric Rayleigh Limb Glow (Sun-Aware Scattering) ─────────
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * (full ? 1.016 : 1.012), 128, 128);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirection: { value: sunDirection },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDir;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDir;

        void main() {
          float rim = 1.0 - max(0.0, dot(vWorldNormal, vViewDir));
          // Sharp limb concentration: airglow is only visible at the tangential atmospheric horizon
          float limbRim = smoothstep(0.50, 0.98, rim);
          float baseIntensity = pow(limbRim, 2.8) * 2.5;

          float dotSun = dot(vWorldNormal, uSunDirection);
          float dayLimb = smoothstep(-0.06, 0.18, dotSun);
          float nightLimb = 1.0 - smoothstep(-0.12, 0.06, dotSun);

          // Pure ISS airglow: deep blue, cyan, and white limb — NO yellow
          vec3 deepBlue = vec3(0.02, 0.38, 0.95);
          vec3 electricCyan = vec3(0.0, 0.92, 0.98);
          vec3 turquoiseAirglow = vec3(0.08, 0.98, 0.85);
          vec3 limbWhite = vec3(0.90, 0.98, 1.0);

          vec3 dayColor = mix(deepBlue, electricCyan, smoothstep(0.35, 0.78, rim));
          dayColor = mix(dayColor, turquoiseAirglow, smoothstep(0.78, 0.92, rim));
          dayColor = mix(dayColor, limbWhite, smoothstep(0.92, 1.0, rim));

          vec3 nightAirglowColor = vec3(0.04, 0.50, 0.32);

          vec3 color = dayColor * dayLimb + nightAirglowColor * nightLimb * 0.25;
          float intensity = baseIntensity * (dayLimb * 1.0 + nightLimb * 0.20);

          // Subtle vertical airglow curtain shafts
          float shafts = max(0.0, sin(vWorldPosition.x * 2.2) * 0.08 + sin(vWorldPosition.x * 5.1 + 0.8) * 0.06);
          intensity += shafts * pow(limbRim, 3.2) * (dayLimb * 0.6 + nightLimb * 0.15);

          gl_FragColor = vec4(color, clamp(intensity, 0.0, 0.98));
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // ── Animation Loop ────────────────────────────────────────────────
    let animId: number;
    let startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      const nowMs = performance.now();
      const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
      lastFrameMs = nowMs;

      spinAngle += SPIN_RATE_RAD_S * dt;

      if (full) {
        // Forward cupola flight: surface and clouds flow downwards together in unison
        orbitPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);
        cloudPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);
      } else {
        // Card mode: planetary horizontal rotation
        orbitPitchGroup.rotation.y = spinAngle;
        cloudPitchGroup.rotation.y = spinAngle;
      }

      // Majestic slow vertical celestial drift (orbital pitch flow)
      // In fullscreen, the entire starry cosmos glides slowly downwards in harmony with Earth's forward flight
      if (full) {
        celestialGroup.rotation.x -= 0.0006 * dt; // slow vertical descent (rad/s)
      } else {
        celestialGroup.rotation.y += 0.0015 * dt;
      }

      // Subtle orbital breathing / float for cinematic feeling
      camera.position.x = Math.sin(elapsed * 0.35) * 0.035;
      camera.position.y = 0.45 + Math.cos(elapsed * 0.25) * 0.02;
      camera.lookAt(0, -0.4, 0);

      renderer.render(scene, camera);
    };
    animate();

    // Signal ready immediately if cached
    if (!disposed) {
      requestAnimationFrame(() => {
        if (!disposed) setReady(true);
      });
    }

    // ── Responsive Resizing ───────────────────────────────────────────
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
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      dayMap.dispose();
      bumpMap.dispose();
      specMap.dispose();
      nightMap.dispose();
      cloudTex.dispose();
      milkyWayTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {/* 3D WebGL Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full absolute inset-0"
      />

      {/* Loading overlay — hides once Three.js renders */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#020617]/80 transition-opacity duration-700">
          <div className="text-cyan-400/60 font-mono text-xs animate-pulse tracking-widest">
            INITIALIZING LEO VIEWPORT...
          </div>
        </div>
      )}

      {/* Top Left: Live Telemetry Badge */}
      {variant === "card" && (
        <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-cyan-500/30 backdrop-blur-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider">
            LOW EARTH ORBIT
          </span>
          <span className="text-slate-700 text-xs">│</span>
          <span className="text-[9px] font-mono text-slate-300">
            ALT 418.4 KM
          </span>
        </div>
      )}

      {/* Top Right: Flight Status */}
      {variant === "card" && (
        <div className="absolute top-3 right-3 z-10 pointer-events-none flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-slate-800/80 backdrop-blur-xl text-[9px] font-mono text-slate-300">
            VELOCITY: <strong className="text-cyan-300 font-bold">27,580 KM/H</strong>
          </div>
        </div>
      )}

      {/* Bottom Center: Telemetry Info */}
      {variant === "card" && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/75 border border-slate-800/80 backdrop-blur-xl text-[9px] font-mono text-slate-400 shadow-xl">
            <span className="text-cyan-300 font-bold">4K NASA BLUE MARBLE</span>
            <span className="text-slate-700">│</span>
            <span className="text-indigo-300 font-bold">8K MILKY WAY</span>
            <span className="text-slate-700">│</span>
            <span className="text-emerald-400 font-bold">LEO POV • 418 KM</span>
          </div>
        </div>
      )}
    </div>
  );
}
