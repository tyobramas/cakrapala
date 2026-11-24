"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import {
  buildAsteroidMesh,
  inferTaxonomy,
} from "@/lib/asteroid/buildAsteroidMesh";
import {
  computeImpactPhysics,
  formatApproachCountdown,
} from "@/lib/asteroid/asteroidMath";
import { LANDMARKS } from "./ScaleRuler";
import {
  X,
  ExternalLink,
  Pause,
  Play,
  Grid,
  Flame,
  Orbit,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface AsteroidDetailModalProps {
  asteroid: AsteroidNeoObject | null;
  isOpen: boolean;
  onClose: () => void;
}

type InspectorTab = "telemetry" | "impact" | "orbit";

const TAXONOMY_META: Record<string, { name: string; density: number; desc: string }> = {
  C: { name: "Carbonaceous", density: 1500, desc: "Dark, porous carbon-rich chondrite" },
  S: { name: "Silicaceous", density: 2600, desc: "Stony silicate & nickel-iron mix" },
  M: { name: "Metallic", density: 7800, desc: "Dense nickel-iron planetary core fragment" },
};

function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/**
 * True Keplerian 2D Heliocentric Orbit SVG Plotter (Sun at focus, Earth at 1.0 AU, Asteroid ellipse (a, e))
 */
function HeliocentricOrbitDiagram({
  semiMajorAxis,
  eccentricity,
  name,
  isHazard,
}: {
  semiMajorAxis: number;
  eccentricity: number;
  name: string;
  isHazard: boolean;
}) {
  const a = Math.max(0.4, Math.min(4.0, semiMajorAxis || 1.25));
  const e = Math.max(0.01, Math.min(0.92, eccentricity || 0.3));
  const b = a * Math.sqrt(1 - e * e);
  const c = a * e; // focal offset
  const q = a * (1 - e); // perihelion
  const Q = a * (1 + e); // aphelion

  const maxExtent = Math.max(1.25, Q * 1.12);
  const cx = 140;
  const cy = 96;
  const scale = 78 / maxExtent;

  const earthR = 1.0 * scale;
  const rx = a * scale;
  const ry = b * scale;
  // Focus (Sun) at (cx, cy); ellipse center shifted by +c*scale to the right so perihelion is left, aphelion is right
  const ellipseCx = cx + c * scale;
  const periX = cx - q * scale;
  const aphX = cx + Q * scale;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[9.5px] text-slate-400">
        <span className="tracking-[0.14em] uppercase">Heliocentric Orbit Plane (J2000)</span>
        <span className="tabular-nums text-slate-500">
          q {q.toFixed(2)} AU · Q {Q.toFixed(2)} AU
        </span>
      </div>
      <svg viewBox="0 0 280 192" className="h-[168px] w-full">
        {/* Subtle polar reference crosshair */}
        <line x1="20" y1={cy} x2="260" y2={cy} stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
        <line x1={cx} y1="12" x2={cx} y2="180" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />

        {/* Earth 1.0 AU Orbit */}
        <circle
          cx={cx}
          cy={cy}
          r={earthR}
          fill="none"
          stroke="rgba(56,189,248,0.45)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {/* Earth marker */}
        <circle cx={cx} cy={cy - earthR} r="3.2" fill="#38bdf8" />
        <text
          x={cx + 6}
          y={cy - earthR + 3}
          fill="rgba(186,230,253,0.85)"
          fontSize="8.5"
          fontFamily="monospace"
        >
          Earth 1.0 AU
        </text>

        {/* Asteroid Keplerian Ellipse */}
        <ellipse
          cx={ellipseCx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={isHazard ? "rgba(251,113,133,0.85)" : "rgba(250,204,21,0.75)"}
          strokeWidth="1.4"
        />

        {/* Perihelion & Aphelion markers */}
        <circle cx={periX} cy={cy} r="2.6" fill={isHazard ? "#fb7185" : "#fde047"} />
        <text
          x={Math.max(8, periX - 4)}
          y={cy + 13}
          fill="rgba(226,232,240,0.8)"
          fontSize="8"
          fontFamily="monospace"
          textAnchor="middle"
        >
          q
        </text>
        <circle cx={aphX} cy={cy} r="2.6" fill="rgba(148,163,184,0.8)" />
        <text
          x={Math.min(270, aphX + 4)}
          y={cy + 13}
          fill="rgba(148,163,184,0.8)"
          fontSize="8"
          fontFamily="monospace"
          textAnchor="middle"
        >
          Q
        </text>

        {/* Sun at exact Keplerian Focus */}
        <circle cx={cx} cy={cy} r="7" fill="rgba(253,224,71,0.18)" />
        <circle cx={cx} cy={cy} r="3.5" fill="#fef08a" />
        <text
          x={cx + 7}
          y={cy - 5}
          fill="rgba(254,240,138,0.85)"
          fontSize="8"
          fontFamily="monospace"
        >
          Sun
        </text>

        {/* Asteroid label */}
        <text
          x="10"
          y="184"
          fill="rgba(148,163,184,0.7)"
          fontSize="8"
          fontFamily="monospace"
        >
          {name} · a={a.toFixed(2)} AU · e={e.toFixed(3)}
        </text>
      </svg>
    </div>
  );
}

export default function AsteroidDetailModal({
  asteroid,
  isOpen,
  onClose,
}: AsteroidDetailModalProps) {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const spinPausedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<InspectorTab>("telemetry");
  const [spinPaused, setSpinPaused] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [spinRateDisplay, setSpinRateDisplay] = useState<number>(0.06);

  // Interactive Impact Lab parameters
  const inferredTax = asteroid ? inferTaxonomy(asteroid.id) : "S";
  const [densityKgM3, setDensityKgM3] = useState<number>(2600);
  const [impactAngleDeg, setImpactAngleDeg] = useState<number>(45);
  const lastAsteroidIdRef = useRef<string | null>(null);

  // Sync default density cleanly when inspecting a different asteroid
  useEffect(() => {
    if (asteroid && asteroid.id !== lastAsteroidIdRef.current) {
      lastAsteroidIdRef.current = asteroid.id;
      const tax = inferTaxonomy(asteroid.id);
      queueMicrotask(() => {
        setDensityKgM3(TAXONOMY_META[tax]?.density ?? 2600);
        setImpactAngleDeg(45);
      });
    }
  }, [asteroid]);

  useEffect(() => {
    spinPausedRef.current = spinPaused;
  }, [spinPaused]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.wireframe = wireframe;
      mat.needsUpdate = true;
    }
  }, [wireframe]);

  // ── Render High-Resolution 3D Asteroid (Detail 5, Photographic Lighting) ───
  useEffect(() => {
    if (!isOpen || !asteroid) return;
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || 460;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070e);

    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.35);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;

    // 3-Point Photographic Solar Lighting
    const sun = new THREE.DirectionalLight(0xfff8ee, 3.8);
    sun.position.set(1, 0.45, 0.65).normalize().multiplyScalar(10);
    scene.add(sun);

    const ambient = new THREE.AmbientLight(0x283848, 0.42);
    scene.add(ambient);

    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.72);
    rim.position.set(-0.9, -0.35, -0.6).normalize().multiplyScalar(10);
    scene.add(rim);

    // Subtle Starfield Backdrop
    const starCount = 320;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = THREE.MathUtils.randFloatSpread(42);
      starPos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(42);
      starPos[i * 3 + 2] = THREE.MathUtils.randFloat(-32, -6);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.0,
      color: 0x64748b,
      transparent: true,
      opacity: 0.3,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Displaced 3D Asteroid Mesh (Detail 5)
    const { mesh, spinAxis, spinRate, dispose } = buildAsteroidMesh(asteroid.id, 5);
    mesh.position.set(-0.08, 0, 0);
    scene.add(mesh);
    meshRef.current = mesh;
    queueMicrotask(() => setSpinRateDisplay(spinRate));

    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (!spinPausedRef.current) {
        mesh.rotateOnAxis(spinAxis, spinRate * delta);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      meshRef.current = null;
      dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [isOpen, asteroid]);

  const avgDiameter = asteroid?.avg_diameter_meters || 50;
  const velocityKms = asteroid?.velocity_kms || (asteroid?.velocity_kmh || 45000) / 3600;

  const impact = useMemo(
    () => computeImpactPhysics(avgDiameter, velocityKms, densityKgM3, impactAngleDeg),
    [avgDiameter, velocityKms, densityKgM3, impactAngleDeg],
  );

  if (!isOpen || !asteroid) return null;

  const isHazard = asteroid.is_potentially_hazardous_asteroid;
  const minDiameter = Math.round(
    asteroid.estimated_diameter?.meters?.estimated_diameter_min || avgDiameter * 0.8,
  );
  const maxDiameter = Math.round(
    asteroid.estimated_diameter?.meters?.estimated_diameter_max || avgDiameter * 1.2,
  );
  const distanceLd = asteroid.closest_miss_distance_ld || 0;
  const distanceKm = asteroid.closest_miss_distance_km || 0;
  const distanceAu = asteroid.close_approach_data?.[0]?.miss_distance?.astronomical
    ? parseFloat(asteroid.close_approach_data[0].miss_distance.astronomical)
    : distanceKm / 149597870.7;
  const velocityKmh = asteroid.velocity_kmh || 0;
  const orbitalData = asteroid.orbital_data;
  const taxMeta = TAXONOMY_META[inferredTax] || TAXONOMY_META.S;
  const approachDateStr =
    asteroid.close_approach_data?.[0]?.close_approach_date_full ||
    asteroid.close_approach_data?.[0]?.close_approach_date ||
    "N/A";
  const countdown = formatApproachCountdown(
    asteroid.close_approach_data?.[0]?.epoch_date_close_approach,
  );
  const closestLm =
    LANDMARKS.slice()
      .reverse()
      .find((lm) => avgDiameter >= lm.m * 0.65) || LANDMARKS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xl select-none md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[90dvh] max-h-[700px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#030714]/94 text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.85)] backdrop-blur-2xl md:flex-row"
      >
        {/* ── Left: Interactive 3D Specimen Viewport (52%) ──────────────────── */}
        <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden border-b border-white/[0.08] bg-[#04070e] md:h-full md:w-[52%] md:border-r md:border-b-0">
          <div ref={canvasMountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

          {/* Top-Left Specimen Badge */}
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-full border border-white/[0.10] bg-[#030714]/75 px-3 py-1 font-mono text-[10px] backdrop-blur-xl">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isHazard ? "bg-rose-400" : "bg-sky-300"
              }`}
            />
            <span className="font-semibold text-white">{asteroid.name}</span>
            <span className="text-slate-500">#{asteroid.id}</span>
          </div>

          {/* Top-Right Viewport Controls (Spin / Wireframe) */}
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full border border-white/[0.10] bg-[#030714]/75 p-0.5 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setSpinPaused((v) => !v)}
              title={spinPaused ? "Resume rotation" : "Pause rotation"}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.10] hover:text-white"
            >
              {spinPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => setWireframe((v) => !v)}
              title="Toggle topological wireframe"
              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors ${
                wireframe
                  ? "bg-sky-400/20 text-sky-300"
                  : "text-slate-300 hover:bg-white/[0.10] hover:text-white"
              }`}
            >
              <Grid className="h-3 w-3" />
            </button>
          </div>

          {/* Right Vertical Scale Comparator */}
          <div className="pointer-events-none absolute top-1/2 right-3.5 flex -translate-y-1/2 items-center gap-2 font-mono">
            <div className="relative h-24 w-px bg-white/20">
              <div className="absolute top-0 -left-1 h-px w-2.5 bg-white/35" />
              <div className="absolute bottom-0 -left-1 h-px w-2.5 bg-white/35" />
            </div>
            <div className="text-[9.5px] leading-tight">
              <div className="font-semibold text-white">{avgDiameter} m</div>
              <div className="text-slate-400">
                ≈ {(avgDiameter / closestLm.m).toFixed(1)}× {closestLm.label}
              </div>
            </div>
          </div>

          {/* Bottom-Left Scientific Disclaimer */}
          <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[9px] leading-relaxed text-slate-500">
            <div className="text-slate-400">
              {inferredTax}-type ({taxMeta.name}) · Procedural shape model
            </div>
            <div>28° Telephoto · Spin {spinRateDisplay.toFixed(2)} rad/s · Drag to inspect</div>
          </div>
        </div>

        {/* ── Right: 3-Tab Astrophysics & Impact Physics Panel (48%) ────────── */}
        <div className="flex flex-1 flex-col overflow-hidden md:w-[48%]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 pt-4 pb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase ${
                    isHazard
                      ? "border border-rose-400/35 bg-rose-500/15 text-rose-300"
                      : "border border-emerald-400/30 bg-emerald-500/12 text-emerald-300"
                  }`}
                >
                  {isHazard ? (
                    <AlertTriangle className="h-2.5 w-2.5" />
                  ) : (
                    <ShieldCheck className="h-2.5 w-2.5" />
                  )}
                  {isHazard ? "Potentially Hazardous (PHA)" : "Nominal Flyby"}
                </span>
                <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                  {countdown}
                </span>
              </div>
              <h2 className="mt-1.5 truncate font-sans text-lg font-semibold tracking-tight text-white">
                {asteroid.name}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={asteroid.nasa_jpl_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 font-mono text-[10px] text-slate-300 transition-colors hover:border-white/25 hover:bg-white/[0.10] hover:text-white"
              >
                <ExternalLink className="h-3 w-3" />
                <span>SBDB</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-300 transition-colors hover:border-white/25 hover:bg-white/[0.10] hover:text-white"
                title="Close Inspector (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Segmented 3-Tab Selector */}
          <div className="border-b border-white/[0.08] px-5 py-2.5">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 font-mono text-[10px]">
              {[
                { id: "telemetry" as const, label: "Telemetry", icon: Activity },
                { id: "impact" as const, label: "Impact Lab", icon: Flame },
                { id: "orbit" as const, label: "Orbit", icon: Orbit },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium tracking-wider uppercase transition-all ${
                      active
                        ? "bg-white/[0.13] text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Tab Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === "telemetry" && (
              <div className="space-y-4 font-mono">
                {/* Key Metric Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[9px] tracking-[0.14em] text-slate-400 uppercase">
                      Miss Distance
                    </div>
                    <div className="mt-1 text-base font-semibold text-white tabular-nums">
                      {distanceLd.toFixed(2)}{" "}
                      <span className="text-[11px] font-normal text-slate-400">LD</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                      {Math.round(distanceKm).toLocaleString()} km · {distanceAu.toFixed(4)} AU
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[9px] tracking-[0.14em] text-slate-400 uppercase">
                      Relative Velocity
                    </div>
                    <div className="mt-1 text-base font-semibold text-white tabular-nums">
                      {velocityKms.toFixed(2)}{" "}
                      <span className="text-[11px] font-normal text-slate-400">km/s</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                      {Math.round(velocityKmh).toLocaleString()} km/h · Mach {Math.round(impact.machNumber)}
                    </div>
                  </div>
                </div>

                {/* Encounter & Physical Specs Table */}
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02] text-[11px]">
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Close Approach (UTC)</span>
                    <span className="text-white tabular-nums">{approachDateStr}</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Diameter Range</span>
                    <span className="text-white tabular-nums">
                      {avgDiameter} m{" "}
                      <span className="text-slate-500">
                        ({minDiameter}–{maxDiameter} m)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Absolute Magnitude (H)</span>
                    <span className="text-white tabular-nums">
                      {asteroid.absolute_magnitude_h}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Inferred Taxonomy</span>
                    <span className="text-white">
                      {inferredTax}-type ({taxMeta.name})
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Baseline Kinetic Energy</span>
                    <span className={isHazard ? "font-semibold text-rose-300 tabular-nums" : "text-white tabular-nums"}>
                      {formatCompactNumber(asteroid.kinetic_energy_megatons || impact.energyMegatons)} Mt TNT
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">NASA Sentry Watchlist</span>
                    <span className={asteroid.is_sentry_object ? "text-amber-300" : "text-emerald-300"}>
                      {asteroid.is_sentry_object ? "Active Sentry Object" : "Not Listed"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "impact" && (
              <div className="space-y-3.5 font-mono">
                {/* Safe trajectory honesty banner */}
                <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-[10px] leading-relaxed text-emerald-200/90">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>
                    Hypothetical Earth-impact simulation (Collins–Melosh–Marcus scaling). Actual
                    flyby passes safely at{" "}
                    <strong className="text-white">{distanceLd.toFixed(2)} LD</strong>.
                  </span>
                </div>

                {/* Interactive Physics Controls: Composition + Entry Angle */}
                <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[9.5px] text-slate-400">
                      <span className="tracking-[0.12em] uppercase">Composition Density</span>
                      <span className="text-white tabular-nums">{densityKgM3} kg/m³</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      {[
                        { label: "Porous C", d: 1500 },
                        { label: "Stony S", d: 2600 },
                        { label: "Iron M", d: 7800 },
                      ].map((opt) => (
                        <button
                          key={opt.d}
                          type="button"
                          onClick={() => setDensityKgM3(opt.d)}
                          className={`cursor-pointer rounded-lg border py-1.5 transition-all ${
                            densityKgM3 === opt.d
                              ? "border-sky-400/50 bg-sky-400/18 text-white"
                              : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[9.5px] text-slate-400">
                      <span className="tracking-[0.12em] uppercase">Entry Angle (θ)</span>
                      <span className="text-white tabular-nums">{impactAngleDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={90}
                      step={5}
                      value={impactAngleDeg}
                      onChange={(e) => setImpactAngleDeg(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-300"
                    />
                  </div>
                </div>

                {/* Computed Physics Output Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Kinetic Yield
                    </div>
                    <div className="mt-1 text-sm font-semibold text-amber-300 tabular-nums">
                      {formatCompactNumber(impact.energyMegatons)} Mt TNT
                    </div>
                    <div className="mt-0.5 text-[9.5px] text-slate-500 tabular-nums">
                      {impact.tsarBombaRatio >= 1
                        ? `${formatCompactNumber(impact.tsarBombaRatio)}× Tsar Bomba`
                        : `${formatCompactNumber(impact.hiroshimaRatio)}× Hiroshima`}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Entry Outcome
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white tabular-nums">
                      {impact.isAirburst
                        ? `Airburst @ ${impact.airburstAltKm} km`
                        : `Crater ${impact.finalCraterKm.toFixed(2)} km`}
                    </div>
                    <div className="mt-0.5 text-[9.5px] text-slate-500">
                      {impact.hazardClassification}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      5 psi Blast Radius
                    </div>
                    <div className="mt-1 text-sm font-semibold text-rose-300 tabular-nums">
                      {impact.blast5PsiKm.toFixed(1)} km
                    </div>
                    <div className="mt-0.5 text-[9.5px] text-slate-500 tabular-nums">
                      1 psi window: {impact.blast1PsiKm.toFixed(1)} km
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                    <div className="text-[9px] tracking-[0.12em] text-slate-400 uppercase">
                      Seismic · Mass
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white tabular-nums">
                      Mw {impact.seismicMw.toFixed(1)}
                    </div>
                    <div className="mt-0.5 text-[9.5px] text-slate-500 tabular-nums">
                      {formatCompactNumber(impact.massTonnes)} tonnes
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "orbit" && (
              <div className="space-y-3.5 font-mono">
                <HeliocentricOrbitDiagram
                  semiMajorAxis={
                    orbitalData?.semi_major_axis
                      ? parseFloat(orbitalData.semi_major_axis)
                      : 1.25
                  }
                  eccentricity={
                    orbitalData?.eccentricity ? parseFloat(orbitalData.eccentricity) : 0.35
                  }
                  name={asteroid.name}
                  isHazard={isHazard}
                />

                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02] text-[11px]">
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Orbit Class</span>
                    <span className="font-semibold text-sky-300">
                      {orbitalData?.orbit_class?.orbit_class_type || "NEO"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Semi-Major Axis (a)</span>
                    <span className="text-white tabular-nums">
                      {orbitalData?.semi_major_axis
                        ? `${parseFloat(orbitalData.semi_major_axis).toFixed(3)} AU`
                        : "1.250 AU"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Eccentricity (e)</span>
                    <span className="text-white tabular-nums">
                      {orbitalData?.eccentricity
                        ? parseFloat(orbitalData.eccentricity).toFixed(4)
                        : "0.3520"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Inclination (i)</span>
                    <span className="text-white tabular-nums">
                      {orbitalData?.inclination
                        ? `${parseFloat(orbitalData.inclination).toFixed(2)}°`
                        : "8.45°"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-slate-400">Orbital Period</span>
                    <span className="text-white tabular-nums">
                      {orbitalData?.orbital_period
                        ? `${parseFloat(orbitalData.orbital_period).toFixed(1)} d (${(
                            parseFloat(orbitalData.orbital_period) / 365.25
                          ).toFixed(2)} yr)`
                        : "512.4 d"}
                    </span>
                  </div>
                  {orbitalData?.minimum_orbit_intersection && (
                    <div className="flex items-center justify-between px-3.5 py-2">
                      <span className="text-slate-400">Earth MOID</span>
                      <span className="text-white tabular-nums">
                        {parseFloat(orbitalData.minimum_orbit_intersection).toFixed(5)} AU
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
