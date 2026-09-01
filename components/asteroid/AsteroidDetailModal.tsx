"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import { OPS, OPS_TYPE } from "@/lib/ui/opsTheme";
import { useOpsMode } from "@/lib/ui/opsMode";
import {
  buildAsteroidMesh,
  inferTaxonomy,
  ASTEROID_TAXONOMY,
} from "@/lib/asteroid/buildAsteroidMesh";
import { LANDMARKS } from "./ScaleRuler";
import { X, ExternalLink } from "lucide-react";

interface AsteroidDetailModalProps {
  asteroid: AsteroidNeoObject | null;
  isOpen: boolean;
  onClose: () => void;
}

const TAXONOMY_NAMES: Record<string, string> = {
  C: "Carbonaceous",
  S: "Silicaceous",
  M: "Metallic",
};

export default function AsteroidDetailModal({
  asteroid,
  isOpen,
  onClose,
}: AsteroidDetailModalProps) {
  const { isOps } = useOpsMode();
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [spinRateDisplay, setSpinRateDisplay] = useState<number>(0.06);

  // ── Render High-Resolution 3D Asteroid (Detail 5, Photographic Lighting) ───
  useEffect(() => {
    if (!isOpen || !asteroid) return;
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || 460;
    const height = container.clientHeight || 420;

    // 1. Scene with Deep Void Canvas
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090c);

    // 2. Telephoto Camera (28° FOV for astronomical perspective compression)
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    // 3. Renderer with ACES Filmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;

    // 5. 3-Point Astronomical Lighting with Rich Surface Details
    const sun = new THREE.DirectionalLight(0xfff8ee, 3.6);
    sun.position.set(1, 0.45, 0.6).normalize().multiplyScalar(10);
    scene.add(sun);

    const ambient = new THREE.AmbientLight(0x283848, 0.45);
    scene.add(ambient);

    // Soft rim / fill light from opposite side
    const fill = new THREE.DirectionalLight(0x5a8fb8, 0.65);
    fill.position.set(-0.8, -0.3, -0.6).normalize().multiplyScalar(10);
    scene.add(fill);

    // 6. Very Subtle Background Star Dust (1px points, 0.25 opacity)
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = THREE.MathUtils.randFloatSpread(40);
      starPos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(40);
      starPos[i * 3 + 2] = THREE.MathUtils.randFloat(-30, -5);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.0, color: 0x475569, transparent: true, opacity: 0.25 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // 7. High-Detail Displaced 3D Asteroid Mesh (Detail = 5, ~10k vertices)
    const meshResult = buildAsteroidMesh(asteroid.id, 5);
    const { mesh, spinAxis, spinRate, dispose } = meshResult;
    mesh.position.set(-0.15, 0, 0); // Off-center slightly to the left
    scene.add(mesh);
    setSpinRateDisplay(spinRate);

    // 8. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      mesh.rotateOnAxis(spinAxis, spinRate * delta);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 10. Memory Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [isOpen, asteroid]);

  if (!isOpen || !asteroid) return null;

  const isHazard = asteroid.is_potentially_hazardous_asteroid;
  const avgDiameter = asteroid.avg_diameter_meters || 50;
  const minDiameter = Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_min || avgDiameter * 0.8);
  const maxDiameter = Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_max || avgDiameter * 1.2);
  const distanceLd = asteroid.closest_miss_distance_ld || 0;
  const distanceKm = asteroid.closest_miss_distance_km || 0;
  const velocityKmh = asteroid.velocity_kmh || 0;
  const velocityKms = asteroid.velocity_kms || velocityKmh / 3600;
  const orbitalData = asteroid.orbital_data;
  const taxKey = inferTaxonomy(asteroid.id);
  const taxName = TAXONOMY_NAMES[taxKey] || "Carbonaceous";
  const approachDateStr =
    asteroid.close_approach_data?.[0]?.close_approach_date_full ||
    asteroid.close_approach_data?.[0]?.close_approach_date ||
    "N/A";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md select-none font-mono">
      <div
        className="relative w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col md:flex-row overflow-hidden border shadow-2xl"
        style={{
          background: OPS.panel,
          borderColor: OPS.line,
          color: OPS.text,
        }}
      >
        {/* ── Close Button (Top-Right) ─────────────────────────────────────── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-1.5 border transition-colors duration-[120ms] cursor-pointer"
          style={{
            background: OPS.panelAlt,
            borderColor: OPS.line,
            color: OPS.textDim,
          }}
          title="Close Inspector"
        >
          <X className="w-4 h-4 hover:text-white" />
        </button>

        {/* ── Left Side: 3D Viewport (~58% width) ──────────────────────────── */}
        <div
          className="relative w-full md:w-[58%] h-[320px] md:h-full bg-[#07090c] flex items-center justify-center overflow-hidden"
          style={{ borderRight: `1px solid ${OPS.line}` }}
        >
          {/* Three.js Mount Container */}
          <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Top-Left Overlay */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none text-[10px] font-mono" style={{ color: OPS.textFaint }}>
            <span style={{ color: OPS.text, fontWeight: 600 }}>({asteroid.name})</span> · {asteroid.id}
          </div>

          {/* Bottom-Left Overlay: Synthetic Model Notice */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none text-[9px] font-mono leading-tight space-y-0.5" style={{ color: OPS.textFaint }}>
            {isOps ? (
              <>
                <div style={{ color: OPS.caution }}>SHAPE MODEL: SYNTHETIC — not a radar-derived shape</div>
                <div>ILLUM: solar phase ~47° · TELEPHOTO 28° FOV</div>
              </>
            ) : (
              <>
                <div style={{ color: OPS.textDim }}>Illustrative shape — exact form unknown</div>
                <div>Estimated from brightness &amp; diameter</div>
              </>
            )}
          </div>

          {/* Bottom-Right Overlay: Rotation Velocity */}
          <div className="absolute bottom-3 right-3 z-20 pointer-events-none text-[9px] font-mono text-right" style={{ color: OPS.textFaint }}>
            ROT: {spinRateDisplay.toFixed(2)} rad/s (illustrative)
          </div>

          {/* Right Edge: Vertical Scale Comparator Bar */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center gap-2 font-mono">
            <div className="h-28 w-[1px] relative" style={{ background: OPS.line }}>
              <div className="absolute top-0 -left-1 w-2.5 h-[1px]" style={{ background: OPS.line }} />
              <div className="absolute bottom-0 -left-1 w-2.5 h-[1px]" style={{ background: OPS.line }} />
            </div>
            <div className="text-[9px] leading-tight" style={{ color: OPS.textFaint }}>
              <div style={{ color: OPS.text }}>{avgDiameter} m</div>
              {!isOps && (
                <div style={{ color: OPS.textDim }}>
                  ≈ {(LANDMARKS.slice().reverse().find((lm) => avgDiameter >= lm.m * 0.7) || LANDMARKS[0]).label}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Side: Astrophysics Telemetry Blocks (~42% width) ──────── */}
        <div className="w-full md:w-[42%] h-full flex flex-col p-4 md:p-5 overflow-y-auto space-y-4">
          {/* Header Designation & External Link */}
          <div className="flex items-start justify-between pb-3 border-b pr-8" style={{ borderColor: OPS.line }}>
            <div>
              <div className="text-[10px] tracking-wider uppercase font-medium" style={{ color: OPS.textDim }}>
                ASTEROID INSPECTOR
              </div>
              <h2 className="text-base font-bold tracking-tight mt-0.5" style={{ color: OPS.text }}>
                {asteroid.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-mono font-medium tracking-wide"
                  style={{ color: isHazard ? OPS.hazard : OPS.safe }}
                >
                  {isHazard ? "● POTENTIALLY HAZARDOUS (PHA)" : "● NOMINAL FLYBY ORBIT"}
                </span>
              </div>
            </div>

            <a
              href={asteroid.nasa_jpl_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 border transition-colors duration-[120ms] flex items-center gap-1 text-[10px]"
              style={{
                background: OPS.panelAlt,
                borderColor: OPS.line,
                color: OPS.textDim,
              }}
              title="Open Official NASA JPL Small-Body Database"
            >
              <ExternalLink className="w-3 h-3 hover:text-white" />
              <span>NASA SBDB</span>
            </a>
          </div>

          {/* ── Block 1: ENCOUNTER ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>
              ENCOUNTER TELEMETRY
            </div>
            <div
              className="divide-y border text-[11px]"
              style={{ background: OPS.panelAlt, borderColor: OPS.line }}
            >
              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Miss Distance:</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {distanceLd.toFixed(2)} LD{" "}
                  <span style={{ color: OPS.textFaint }}>({Math.round(distanceKm).toLocaleString()} km)</span>
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Approach Time (UTC):</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {approachDateStr}
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Relative Velocity:</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {Math.round(velocityKmh).toLocaleString()} km/h{" "}
                  <span style={{ color: OPS.textFaint }}>({velocityKms.toFixed(2)} km/s)</span>
                </span>
              </div>
            </div>
          </div>

          {/* ── Block 2: PHYSICAL PROPERTIES ───────────────────────────────── */}
          <div className="space-y-1.5">
            <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>
              PHYSICAL PROPERTIES
            </div>
            <div
              className="divide-y border text-[11px]"
              style={{ background: OPS.panelAlt, borderColor: OPS.line }}
            >
              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Estimated Diameter:</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {avgDiameter} m{" "}
                  <span style={{ color: OPS.textFaint }}>({minDiameter}–{maxDiameter} m)</span>
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Absolute Magnitude (H):</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {asteroid.absolute_magnitude_h}
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Inferred Taxonomy:</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {taxKey}-type ({taxName})<span style={{ color: OPS.textFaint }}>?</span>
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Kinetic Energy (Est.):</span>
                <span className="font-mono tabular-nums text-right" style={{ color: isHazard ? OPS.hazard : OPS.text }}>
                  {asteroid.kinetic_energy_megatons || 0} Mt TNT
                </span>
              </div>
            </div>
          </div>

          {/* ── Block 3: ORBITAL ELEMENTS (J2000 Keplerian) ────────────────── */}
          <div className="space-y-1.5">
            <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>
              KEPLERIAN ORBITAL ELEMENTS
            </div>
            <div
              className="divide-y border text-[11px]"
              style={{ background: OPS.panelAlt, borderColor: OPS.line }}
            >
              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Semi-Major Axis (a):</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {orbitalData?.semi_major_axis ? `${parseFloat(orbitalData.semi_major_axis).toFixed(3)} AU` : "1.250 AU"}
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Eccentricity (e):</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {orbitalData?.eccentricity ? parseFloat(orbitalData.eccentricity).toFixed(4) : "0.3520"}
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Inclination (i):</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {orbitalData?.inclination ? `${parseFloat(orbitalData.inclination).toFixed(2)}°` : "8.45°"}
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Orbital Period:</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.text }}>
                  {orbitalData?.orbital_period
                    ? `${parseFloat(orbitalData.orbital_period).toFixed(1)} days (~${(
                        parseFloat(orbitalData.orbital_period) / 365.25
                      ).toFixed(2)} yr)`
                    : "512.4 days"}
                </span>
              </div>

              <div className="flex justify-between px-3 py-1.5" style={{ borderColor: OPS.line }}>
                <span style={{ color: OPS.textDim }}>Orbit Classification:</span>
                <span className="font-mono tabular-nums text-right" style={{ color: OPS.accent }}>
                  {orbitalData?.orbit_class?.orbit_class_type || "NEO"} (
                  {orbitalData?.orbit_class?.orbit_class_description?.split(" ")[0] || "Earth-crosser"})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
