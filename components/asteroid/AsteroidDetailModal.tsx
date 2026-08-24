"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AsteroidNeoObject } from "@/lib/asteroid/types";
import {
  SIZE_COMPARISON_REFERENCES,
  LUNAR_DISTANCE_KM,
} from "@/lib/asteroid/asteroidMath";
import {
  X,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Zap,
  Globe,
  Radio,
  Clock,
  Compass,
  Layers,
  Sparkles,
  Info,
  Maximize2,
} from "lucide-react";

interface AsteroidDetailModalProps {
  asteroid: AsteroidNeoObject | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AsteroidDetailModal({
  asteroid,
  isOpen,
  onClose,
}: AsteroidDetailModalProps) {
  const rockCanvasRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "orbit" | "scale" | "approaches">("overview");

  // ── Render 3D Asteroid Rock in Mini Canvas ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !asteroid) return;
    const container = rockCanvasRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Lights
    const dirLight1 = new THREE.DirectionalLight(0xfff5e6, 2.5);
    dirLight1.position.set(4, 3, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x0284c7, 0.8);
    dirLight2.position.set(-4, -2, -3);
    scene.add(dirLight2);

    const ambLight = new THREE.AmbientLight(0x1e293b, 0.7);
    scene.add(ambLight);

    // Create Irregular Deformed Asteroid Geometry
    const baseGeo = new THREE.DodecahedronGeometry(1.4, 3);
    const posAttr = baseGeo.attributes.position;

    // Procedural noise displacement to create realistic asteroid craters & ridges
    const seed = parseFloat(asteroid.id) || 12345;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);

      const noise =
        Math.sin(vx * 3.5 + seed) * 0.15 +
        Math.cos(vy * 4.2 + seed) * 0.12 +
        Math.sin(vz * 5.1 + seed * 2) * 0.08;

      posAttr.setXYZ(i, vx + vx * noise, vy + vy * noise, vz + vz * noise);
    }
    baseGeo.computeVertexNormals();

    const isHazard = asteroid.is_potentially_hazardous_asteroid;
    const rockMat = new THREE.MeshStandardMaterial({
      color: isHazard ? 0x991b1b : 0x475569,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true,
    });
    const rockMesh = new THREE.Mesh(baseGeo, rockMat);
    scene.add(rockMesh);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      rockMesh.rotation.x += 0.006;
      rockMesh.rotation.y += 0.012;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [isOpen, asteroid]);

  if (!isOpen || !asteroid) return null;

  const isHazard = asteroid.is_potentially_hazardous_asteroid;
  const avgDiameter = asteroid.avg_diameter_meters || 50;
  const distanceLd = asteroid.closest_miss_distance_ld || 0;
  const distanceKm = asteroid.closest_miss_distance_km || 0;
  const velocityKmh = asteroid.velocity_kmh || 0;
  const orbitalData = asteroid.orbital_data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-mono">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#050b18] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden text-white">
        {/* ── Modal Top Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isHazard
                  ? "bg-red-500/15 border-red-500/40 text-red-400"
                  : "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
              }`}
            >
              {isHazard ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <Globe className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">{asteroid.name}</h2>
                {isHazard ? (
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                    POTENTIALLY HAZARDOUS (PHA)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                    SAFE FLYBY ORBIT
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                NASA JPL Small-Body ID: <span className="text-cyan-300">{asteroid.id}</span> | Orbit Class:{" "}
                <span className="text-indigo-300">{orbitalData?.orbit_class?.orbit_class_type || "NEO"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={asteroid.nasa_jpl_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs transition-colors flex items-center gap-1.5"
              title="Open Official NASA JPL Small-Body Database"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">NASA JPL SBDB</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-500 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 text-xs">
          {[
            { id: "overview", label: "OVERVIEW & 3D ROCK" },
            { id: "scale", label: "PHYSICAL SIZE SCALE" },
            { id: "orbit", label: "ORBITAL MECHANICS" },
            { id: "approaches", label: "CLOSE APPROACH HISTORY" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-bold transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Contents ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* TAB 1: OVERVIEW & 3D ROCK */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: 3D Animated Rock */}
              <div className="md:col-span-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-between">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider text-center w-full">
                  3D TOPOLOGICAL RECONSTRUCTION
                </div>
                <div ref={rockCanvasRef} className="w-full h-48 my-2 cursor-grab active:cursor-grabbing" />
                <div className="text-[10px] text-center text-slate-500 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 w-full">
                  Faceted S-type Chondrite Model
                </div>
              </div>

              {/* Right Column: Key Astrophysics Telemetry */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400">EST. DIAMETER</div>
                    <div className="text-lg font-bold text-white mt-0.5">{avgDiameter} m</div>
                    <div className="text-[10px] text-slate-500">
                      Range: {Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_min || 0)}m -{" "}
                      {Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_max || 0)}m
                    </div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400">MISS DISTANCE</div>
                    <div className="text-lg font-bold text-cyan-300 mt-0.5">{distanceLd.toFixed(2)} LD</div>
                    <div className="text-[10px] text-slate-500">
                      {Math.round(distanceKm).toLocaleString()} km
                    </div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400">RELATIVE VELOCITY</div>
                    <div className="text-lg font-bold text-amber-300 mt-0.5">
                      {Math.round(velocityKmh).toLocaleString()} km/h
                    </div>
                    <div className="text-[10px] text-slate-500">
                      ({asteroid.velocity_kms?.toFixed(2)} km/s)
                    </div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400">ABSOLUTE MAGNITUDE (H)</div>
                    <div className="text-lg font-bold text-indigo-300 mt-0.5">
                      {asteroid.absolute_magnitude_h}
                    </div>
                    <div className="text-[10px] text-slate-500">Visual brightness scale</div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400">KINETIC IMPACT ENERGY</div>
                    <div className="text-lg font-bold text-red-400 mt-0.5">
                      {asteroid.kinetic_energy_megatons || 0} Mt TNT
                    </div>
                    <div className="text-[10px] text-slate-500">
                      ≈ {(asteroid.kinetic_energy_megatons || 1) * 65} Hiroshima Equiv.
                    </div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400">SENTRY IMPACT MONITOR</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">
                      {asteroid.is_sentry_object ? "MONITORED" : "CLEAR"}
                    </div>
                    <div className="text-[10px] text-slate-500">NASA JPL Earth impact table</div>
                  </div>
                </div>

                {/* Planetary Defense Assessment Box */}
                <div
                  className={`p-4 rounded-2xl border ${
                    isHazard
                      ? "bg-red-950/30 border-red-800/60 text-red-200"
                      : "bg-slate-900/60 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-white mb-1.5">
                    <ShieldAlert className={`w-4 h-4 ${isHazard ? "text-red-400" : "text-emerald-400"}`} />
                    <span>NASA PLANETARY DEFENSE EVALUATION</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {isHazard
                      ? `Objek ${asteroid.name} diklasifikasikan sebagai Potentially Hazardous Asteroid (PHA) oleh NASA JPL karena diameter estimasi melampaui 140 meter dan titik simpang orbit minimum (MOID) berjarak kurang dari 0.05 AU (19.5 Lunar Distances). Saat ini tidak ada indikasi tabrakan langsung, namun tetap dipantau berkala dalam radar pertahanan bumi.`
                      : `Objek ${asteroid.name} berada pada jalur orbit aman melintasi Bumi pada jarak ${distanceLd.toFixed(2)} Lunar Distances (${Math.round(distanceKm).toLocaleString()} km). Tidak menimbulkan ancaman fisik terhadap atmosfer atau permukaan Bumi.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PHYSICAL SIZE SCALE */}
          {activeTab === "scale" && (
            <div className="space-y-6">
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <div className="text-xs font-bold text-cyan-300 mb-1">
                  REAL-WORLD SIZE COMPARISON INFOGRAPHIC
                </div>
                <p className="text-[11px] text-slate-400 mb-4">
                  Visualisasi skala ukuran fisik asteroid ({avgDiameter} meter) dibandingkan dengan landmark dunia nyata.
                </p>

                {/* Scaled Comparison Bar Diagram */}
                <div className="space-y-3">
                  {/* Asteroid Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-cyan-300">
                      <span>✦ {asteroid.name} (Asteroid Target)</span>
                      <span>{avgDiameter} METERS</span>
                    </div>
                    <div className="h-6 w-full bg-slate-900 rounded-lg overflow-hidden border border-cyan-500/40 flex items-center px-2">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded"
                        style={{ width: `${Math.min(100, Math.max(5, (avgDiameter / 828) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Reference Landmarks */}
                  {SIZE_COMPARISON_REFERENCES.map((ref) => {
                    const refScale = Math.max(ref.heightMeters, ref.widthMeters);
                    const percentage = Math.min(100, (refScale / 828) * 100);

                    return (
                      <div key={ref.id} className="space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>{ref.name}</span>
                          <span className="text-slate-300 font-bold">{refScale} m</span>
                        </div>
                        <div className="h-4 w-full bg-slate-900/60 rounded-lg overflow-hidden border border-slate-800 flex items-center px-1">
                          <div
                            className="h-2.5 bg-slate-700 rounded"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORBITAL MECHANICS */}
          {activeTab === "orbit" && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>KEPLERIAN ORBITAL ELEMENTS (J2000.0 EPOCH)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">SEMI-MAJOR AXIS (a)</div>
                    <div className="font-bold text-white mt-0.5">
                      {orbitalData?.semi_major_axis ? `${parseFloat(orbitalData.semi_major_axis).toFixed(3)} AU` : "1.250 AU"}
                    </div>
                    <div className="text-[9px] text-slate-500">Average orbital radius</div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">ECCENTRICITY (e)</div>
                    <div className="font-bold text-cyan-300 mt-0.5">
                      {orbitalData?.eccentricity ? parseFloat(orbitalData.eccentricity).toFixed(4) : "0.3520"}
                    </div>
                    <div className="text-[9px] text-slate-500">Orbital elongation</div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">INCLINATION (i)</div>
                    <div className="font-bold text-amber-300 mt-0.5">
                      {orbitalData?.inclination ? `${parseFloat(orbitalData.inclination).toFixed(2)}°` : "8.45°"}
                    </div>
                    <div className="text-[9px] text-slate-500">Tilt relative to ecliptic</div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">ORBITAL PERIOD</div>
                    <div className="font-bold text-indigo-300 mt-0.5">
                      {orbitalData?.orbital_period ? `${parseFloat(orbitalData.orbital_period).toFixed(1)} days` : "512.4 days"}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      ≈ {(parseFloat(orbitalData?.orbital_period || "512") / 365.25).toFixed(2)} Earth years
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">PERIHELION DISTANCE (q)</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {orbitalData?.perihelion_distance ? `${parseFloat(orbitalData.perihelion_distance).toFixed(3)} AU` : "0.850 AU"}
                    </div>
                    <div className="text-[9px] text-slate-500">Closest distance to Sun</div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">APHELION DISTANCE (Q)</div>
                    <div className="font-bold text-red-400 mt-0.5">
                      {orbitalData?.aphelion_distance ? `${parseFloat(orbitalData.aphelion_distance).toFixed(3)} AU` : "1.650 AU"}
                    </div>
                    <div className="text-[9px] text-slate-500">Farthest distance from Sun</div>
                  </div>
                </div>

                {orbitalData?.orbit_class && (
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-xs">
                    <div className="text-cyan-300 font-bold mb-1">
                      Orbit Class: {orbitalData.orbit_class.orbit_class_type} ({orbitalData.orbit_class.orbit_class_description})
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Range definition: {orbitalData.orbit_class.orbit_class_range}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CLOSE APPROACH HISTORY */}
          {activeTab === "approaches" && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <div className="text-xs font-bold text-cyan-300 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>NASA JPL RECORDED CLOSE APPROACHES</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 rounded-l-lg">Flyby Date (UTC)</th>
                        <th className="p-2.5">Orbiting Body</th>
                        <th className="p-2.5">Miss Distance (LD)</th>
                        <th className="p-2.5">Miss Distance (km)</th>
                        <th className="p-2.5 rounded-r-lg">Velocity (km/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {asteroid.close_approach_data?.map((approach, i) => (
                        <tr key={i} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-bold text-white">{approach.close_approach_date_full}</td>
                          <td className="p-2.5 text-cyan-300">{approach.orbiting_body}</td>
                          <td className="p-2.5 font-bold text-emerald-400">
                            {parseFloat(approach.miss_distance.lunar).toFixed(2)} LD
                          </td>
                          <td className="p-2.5 text-slate-300">
                            {Math.round(parseFloat(approach.miss_distance.kilometers)).toLocaleString()} km
                          </td>
                          <td className="p-2.5 text-amber-300 font-semibold">
                            {Math.round(parseFloat(approach.relative_velocity.kilometers_per_hour)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
