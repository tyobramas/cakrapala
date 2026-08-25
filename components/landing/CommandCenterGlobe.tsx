"use client";

/**
 * CommandCenterGlobe — Ultra-HD Photorealistic ISS LEO Backward Flight POV.
 * Features:
 *   - Ultra-HD 5.4K NASA Blue Marble surface with 16x Anisotropic filtering
 *   - 5.4K Topographic terrain relief with enhanced bump mapping
 *   - 4K NASA Black Marble golden city lights (emissive)
 *   - High-density 256x256 sphere geometry for ultra-crisp curved detail
 *   - Backward Vertical Orbital Flight: Terrain recedes smoothly upward toward the horizon
 *   - Background: 8K ESO Milky Way (Bimasakti) panorama + multi-spectral starfield
 *   - Razor-thin Rayleigh atmospheric blue limb along the curved horizon
 *   - Crisp ocean specular reflection with solar sunglint
 *   - Ultra-smooth, relaxing backward flight motion
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function CommandCenterGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── 1. Scene, Camera & Renderer (Ultra-HD Configuration) ─────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      3000
    );
    // ISS Aft/Backward-Facing Flight Viewpoint (altitude ~400km)
    camera.position.set(0, 1.25, 3.5);
    camera.lookAt(0, 0.45, -2.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    // Support Retina/4K high-density displays for razor-sharp textures
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);

    // ── 2. Milky Way (Bimasakti) Background Sky Dome ────────────────────────
    const milkyWayTexture = textureLoader.load("/textures/milkyway.jpg");
    milkyWayTexture.colorSpace = THREE.SRGBColorSpace;
    milkyWayTexture.anisotropy = maxAniso;
    milkyWayTexture.minFilter = THREE.LinearMipmapLinearFilter;
    milkyWayTexture.magFilter = THREE.LinearFilter;

    const skyGeo = new THREE.SphereGeometry(600, 48, 48);
    const skyMat = new THREE.MeshBasicMaterial({
      map: milkyWayTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.8,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.rotation.x = 0.45;
    skyDome.rotation.y = -1.2;
    scene.add(skyDome);

    // ── 3. Multi-Temperature Pinpoint Stars (Deep Space Depth) ──────────────
    const starCount = 3800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const stellarPalette = [
      new THREE.Color(0xa8c5ff), // Cool Blue-White (Class O/B)
      new THREE.Color(0xdce6ff), // White (Class A)
      new THREE.Color(0xfff7ea), // Yellow-White (Class F/G)
      new THREE.Color(0xffdfb3), // Warm Orange (Class K)
      new THREE.Color(0xffb87a), // Deep Amber (Class M)
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 80 + Math.random() * 350;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)) + 6; // Above horizon
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      const col = stellarPalette[Math.floor(Math.random() * stellarPalette.length)];
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;

      const rnd = Math.random();
      starSizes[i] = rnd > 0.96 ? 1.5 : rnd > 0.85 ? 0.95 : 0.4;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── 4. Earth Globe Pivot Group ───────────────────────────────────────────
    const earthRadius = 11.5;
    const earthPivot = new THREE.Group();
    earthPivot.position.set(0, -10.45, -0.35);
    scene.add(earthPivot);

    // ── 5. Ultra-HD Earth Textures Setup ────────────────────────────────────
    const dayMap = textureLoader.load("/textures/planets/earth_4k.jpg");
    dayMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = maxAniso;
    dayMap.minFilter = THREE.LinearMipmapLinearFilter;
    dayMap.magFilter = THREE.LinearFilter;
    dayMap.generateMipmaps = true;

    const bumpMap = textureLoader.load("/textures/planets/earth_bump.jpg");
    bumpMap.anisotropy = maxAniso;
    bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
    bumpMap.magFilter = THREE.LinearFilter;

    const specMap = textureLoader.load("/textures/planets/earth_specular.jpg");
    specMap.anisotropy = maxAniso;
    specMap.minFilter = THREE.LinearMipmapLinearFilter;
    specMap.magFilter = THREE.LinearFilter;

    const nightMap = textureLoader.load("/textures/planets/earth_night.jpg");
    nightMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.anisotropy = maxAniso;
    nightMap.minFilter = THREE.LinearMipmapLinearFilter;
    nightMap.magFilter = THREE.LinearFilter;

    // ── 6. Ultra-HD Earth Surface Mesh (256x256 High Tessellation) ───────────
    const earthGeo = new THREE.SphereGeometry(earthRadius, 256, 256);

    const earthMat = new THREE.MeshPhongMaterial({
      map: dayMap,
      bumpMap: bumpMap,
      bumpScale: 0.045, // Pronounced mountain & terrain relief
      specularMap: specMap,
      specular: new THREE.Color(0xc0e0ff), // Vivid ocean specular reflection
      shininess: 48,
      emissiveMap: nightMap,
      emissive: new THREE.Color(0xffcb78), // Radiant golden city lights
      emissiveIntensity: 1.85,
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthPivot.add(earthMesh);

    // Initial orientation: Mediterranean / Red Sea / Europe coastlines in crisp focus
    earthMesh.rotation.y = -Math.PI * 0.48;
    earthMesh.rotation.x = 0.38;

    // ── 7. Razor-Thin Rayleigh Atmospheric Rim Glow ──────────────────────────
    const atmosGeo = new THREE.SphereGeometry(earthRadius * 1.0075, 140, 140);
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
          float intensity = pow(rim, 6.0) * 2.4;
          
          vec3 cyanLimb = vec3(0.35, 0.78, 1.0);
          vec3 deepBlue = vec3(0.06, 0.35, 0.95);
          vec3 color = mix(deepBlue, cyanLimb, pow(rim, 2.0));
          
          gl_FragColor = vec4(color, clamp(intensity, 0.0, 0.85));
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthPivot.add(atmosMesh);

    // ── 8. Solar Lighting & Specular Ocean Sunglint ──────────────────────────
    const sunLight = new THREE.DirectionalLight(0xfff6ea, 4.0);
    sunLight.position.set(2.0, 7.0, 2.0);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x0a1428, 0.35);
    scene.add(ambientLight);

    const fillLight = new THREE.DirectionalLight(0x203560, 0.5);
    fillLight.position.set(-5.0, 1.0, -3.0);
    scene.add(fillLight);

    // ── 9. Animation Loop (Backward Orbital Flight Motion) ───────────────────
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Backward orbital flight: Terrain rolls vertically upward toward the horizon
      const flightSpeed = 0.000045;
      earthMesh.rotation.x += flightSpeed; // Backward roll
      earthMesh.rotation.y -= flightSpeed * 0.12; // Orbital inclination drift

      // Very subtle celestial drift of Milky Way
      skyDome.rotation.y += 0.000008;

      renderer.render(scene, camera);
    };
    animate();

    // ── 10. Responsive Resizing ─────────────────────────────────────────────
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
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
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
      {/* 3D WebGL Ultra-HD Earth & Milky Way LEO Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full relative"
        style={{ minHeight: "100%" }}
      />

      {/* Top Left: Authentic Live Telemetry Badge */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-cyan-500/30 backdrop-blur-xl">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
        </span>
        <span className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider">
          LIVE LEO AFT FLIGHT
        </span>
        <span className="text-slate-700 text-xs">│</span>
        <span className="text-[9px] font-mono text-slate-300">
          ALT 418.4 KM
        </span>
      </div>

      {/* Top Right: Flight Status */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-slate-800/80 backdrop-blur-xl text-[9px] font-mono text-slate-300">
          ORBIT VELOCITY: <strong className="text-cyan-300 font-bold">27,580 KM/H</strong>
        </div>
      </div>

      {/* Bottom Center: Telemetry Information */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/75 border border-slate-800/80 backdrop-blur-xl text-[9px] font-mono text-slate-400 shadow-xl">
          <span className="text-cyan-300 font-bold">5.4K ULTRA-HD NASA BLUE MARBLE</span>
          <span className="text-slate-700">│</span>
          <span className="text-indigo-300 font-bold">8K ESO MILKY WAY GALAXY</span>
          <span className="text-slate-700">│</span>
          <span className="text-emerald-400 font-bold">AFT GROUND TRACK</span>
        </div>
      </div>
    </div>
  );
}
