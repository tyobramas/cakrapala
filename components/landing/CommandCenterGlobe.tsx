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

export default function CommandCenterGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    // ── Constants & Dimensions ─────────────────────────────────────────
    const EARTH_RADIUS = 3.4;

    // ── Scene, Camera & Renderer ───────────────────────────────────────
    const scene = new THREE.Scene();

    // 48° FOV provides a grand, wide-angle cinematic curve matching real orbit photos
    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 0.45, 4.4);
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
      opacity: 0.65,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.rotation.x = 0.35;
    skyDome.rotation.y = -1.1;
    scene.add(skyDome);

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
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Earth Assembly Group ──────────────────────────────────────────
    // Placed below camera line so the curved horizon apex lands at ~25-30% from the top
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -2.15, 0);
    earthGroup.rotation.z = -0.12; // Realistic orbital axial tilt
    earthGroup.rotation.x = 0.08;  // Slight pitch forward for optimal landmass visibility
    scene.add(earthGroup);

    // Group for continuous spinning layers
    const earthSpinGroup = new THREE.Group();
    earthGroup.add(earthSpinGroup);

    // ── Earth Sphere Mesh ─────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);

    let texturesLoaded = 0;
    const totalTextures = 4;

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

    const earthMat = new THREE.MeshPhongMaterial({
      map: dayMap,
      bumpMap: bumpMap,
      bumpScale: 0.045,
      specularMap: specMap,
      specular: new THREE.Color(0xb8e2f8),
      shininess: 40,
      emissiveMap: nightMap,
      emissive: new THREE.Color(0xffd085),
      emissiveIntensity: 0.9,
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthSpinGroup.add(earthMesh);

    // ── Dynamic Cloud Layer ───────────────────────────────────────────
    const cloudTex = textureLoader.load("/textures/planets/earth_clouds.png");
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.003, 128, 128);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.32,
      blending: THREE.NormalBlending,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthSpinGroup.add(cloudsMesh);

    // ── Atmospheric Rayleigh Limb Glow (Photorealistic Horizon Glow) ──
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 128, 128);
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
          
          // Pure horizon scattering curve
          float intensity = pow(rim, 3.8) * 2.2;
          
          // Smooth transition from deep ocean blue -> vivid cyan -> white-blue limb
          vec3 deepBlue = vec3(0.05, 0.28, 0.90);
          vec3 electricCyan = vec3(0.32, 0.78, 1.0);
          vec3 limbWhite = vec3(0.88, 0.95, 1.0);
          
          vec3 color = mix(deepBlue, electricCyan, smoothstep(0.4, 0.85, rim));
          color = mix(color, limbWhite, smoothstep(0.85, 1.0, rim));
          
          gl_FragColor = vec4(color, clamp(intensity, 0.0, 0.95));
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // ── Solar & Orbital Lighting ──────────────────────────────────────
    // Direct Sun position high-right creates brilliant daylit Earth & sparkling oceans
    const sunLight = new THREE.DirectionalLight(0xfff6ec, 3.8);
    sunLight.position.set(5.5, 7.5, 6.0);
    scene.add(sunLight);

    // Ambient space illumination to prevent pitch-black areas
    const ambientLight = new THREE.AmbientLight(0x0f1c30, 0.55);
    scene.add(ambientLight);

    // Soft cyan atmospheric fill light from the side
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(-5.0, 2.5, 3.5);
    scene.add(fillLight);

    // ── Animation Loop ────────────────────────────────────────────────
    let animId: number;
    let startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      // Rotate the entire earthSpinGroup (Earth + Clouds rotate together seamlessly)
      earthSpinGroup.rotation.y += 0.00045;

      // Subtle atmospheric shimmer & skybox drift
      skyDome.rotation.y += 0.00004;

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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

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

      {/* Top Right: Flight Status */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-slate-800/80 backdrop-blur-xl text-[9px] font-mono text-slate-300">
          VELOCITY: <strong className="text-cyan-300 font-bold">27,580 KM/H</strong>
        </div>
      </div>

      {/* Bottom Center: Telemetry Info */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/75 border border-slate-800/80 backdrop-blur-xl text-[9px] font-mono text-slate-400 shadow-xl">
          <span className="text-cyan-300 font-bold">4K NASA BLUE MARBLE</span>
          <span className="text-slate-700">│</span>
          <span className="text-indigo-300 font-bold">8K MILKY WAY</span>
          <span className="text-slate-700">│</span>
          <span className="text-emerald-400 font-bold">LEO POV • 418 KM</span>
        </div>
      </div>
    </div>
  );
}
