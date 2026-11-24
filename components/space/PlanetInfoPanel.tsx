"use client";

/**
 * PlanetInfoPanel — Refined Luxury Aerospace Celestial Inspector.
 *
 * Floating sheer frosted-glass inspector on desktop (right rail) and
 * clean compact drawer on mobile, replacing the legacy neon tactical HUD.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { DETAILED_PLANET_DATA } from "@/lib/astronomy/planetDetailedData";
import type { LivePlanetTelemetry } from "@/lib/astronomy/solarSystemPhysics";
import type { PlanetId } from "@/lib/astronomy/types";

type Props = {
  selectedPlanetId: PlanetId | null;
  liveTelemetry?: LivePlanetTelemetry | null;
  onClose: () => void;
};

type TabId = "overview" | "orbit" | "physics" | "atmosphere" | "moons" | "missions";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Info" },
  { id: "orbit", label: "Orbit" },
  { id: "physics", label: "Physics" },
  { id: "atmosphere", label: "Atmo" },
  { id: "moons", label: "Moons" },
  { id: "missions", label: "Probes" },
];

export default function PlanetInfoPanel({
  selectedPlanetId,
  liveTelemetry,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const planet = selectedPlanetId
    ? DETAILED_PLANET_DATA[selectedPlanetId]
    : null;
  if (!planet) return null;

  return (
    <aside
      className="pointer-events-auto fixed inset-x-3 bottom-20 z-30 flex max-h-[52vh] flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#030714]/56 text-slate-100 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.1)] md:inset-auto md:top-20 md:right-5 md:bottom-24 md:max-h-none md:w-[350px]"
      aria-label="Celestial Body Inspector"
    >
      {/* Sticky Minimal Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/25 shadow-sm">
            <img
              src={`/textures/planets/${planet.id}.jpg`}
              alt={planet.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-orbitron)] text-sm font-medium tracking-[0.14em] text-white uppercase">
              {planet.name}
            </h2>
            <p className="text-[10px] tracking-[0.08em] text-slate-400">
              {planet.classification}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Inspector"
          title="Return to Overview (Esc)"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:border-white/25 hover:bg-white/12 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* Clean Pill Tabs */}
        <div className="grid grid-cols-6 gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 font-mono text-[9.5px]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer rounded-lg py-1.5 text-center font-medium uppercase transition-all ${
                activeTab === tab.id
                  ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-3.5">
            <p className="text-xs leading-relaxed font-light text-slate-200/90">
              {planet.overview}
            </p>

            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
              <MetricCard
                label={liveTelemetry ? "Live Distance" : "Solar Distance"}
                value={
                  liveTelemetry
                    ? `${liveTelemetry.distanceAU.toFixed(4)} AU`
                    : planet.orbitalStats.semiMajorAxisAU
                }
              />
              <MetricCard
                label={liveTelemetry ? "Live Velocity" : "Gravity"}
                value={
                  liveTelemetry
                    ? `${liveTelemetry.velocityKmS.toFixed(2)} km/s`
                    : planet.physicalStats.surfaceGravity
                }
              />
              <MetricCard label="Mean Radius" value={planet.physicalStats.meanRadiusKm} />
              <MetricCard label="Mean Temp" value={planet.physicalStats.avgTempC} />
            </div>
          </div>
        )}

        {/* Orbit Tab */}
        {activeTab === "orbit" && (
          <div className="space-y-2 font-mono text-[10px]">
            {liveTelemetry && (
              <>
                <MetricRow
                  label="Live Distance r(t)"
                  value={`${liveTelemetry.distanceAU.toFixed(5)} AU`}
                />
                <MetricRow
                  label="Live Speed v(t) (Vis-Viva)"
                  value={`${liveTelemetry.velocityKmS.toFixed(3)} km/s`}
                />
                <MetricRow
                  label="Ecliptic Lon / Lat (J2000)"
                  value={`${liveTelemetry.eclipticLonDeg.toFixed(2)}° / ${liveTelemetry.eclipticLatDeg >= 0 ? "+" : ""}${liveTelemetry.eclipticLatDeg.toFixed(2)}°`}
                />
              </>
            )}
            <MetricRow
              label="Semi-Major Axis (a)"
              value={`${planet.orbitalStats.semiMajorAxisAU} (${planet.orbitalStats.semiMajorAxisKm})`}
            />
            <MetricRow label="Orbital Period" value={planet.orbitalStats.orbitalPeriod} />
            <MetricRow label="Mean Velocity" value={planet.orbitalStats.orbitalSpeedKmS} />
            <MetricRow label="Inclination" value={planet.orbitalStats.inclinationDeg} />
          </div>
        )}

        {/* Physics Tab */}
        {activeTab === "physics" && (
          <div className="space-y-2 font-mono text-[10px]">
            <MetricRow label="Mass" value={planet.physicalStats.massKg} />
            <MetricRow label="Surface Gravity" value={planet.physicalStats.surfaceGravity} />
            <MetricRow label="Escape Velocity" value={planet.physicalStats.escapeVelocity} />
            <MetricRow label="Axial Tilt" value={planet.physicalStats.axialTilt} />
          </div>
        )}

        {/* Atmosphere Tab */}
        {activeTab === "atmosphere" && (
          <div className="space-y-3 font-mono text-[10px]">
            <MetricRow label="Surface Pressure" value={planet.atmosphere.pressureBar} />

            <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <span className="block text-[9px] tracking-[0.2em] text-slate-400 uppercase">
                Composition
              </span>
              {planet.atmosphere.components.map((comp) => (
                <div
                  key={comp.name}
                  className="flex items-center justify-between text-[10px]"
                >
                  <span className="text-slate-300">{comp.name}</span>
                  <strong className="font-medium text-white/90">{comp.percent}</strong>
                </div>
              ))}
            </div>

            <p className="px-0.5 font-sans text-[11px] leading-relaxed font-light text-slate-400">
              {planet.atmosphere.notes}
            </p>
          </div>
        )}

        {/* Moons Tab */}
        {activeTab === "moons" && (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="flex items-center justify-between px-1 pb-1 text-slate-400">
              <span className="text-[9px] tracking-[0.2em] uppercase">Known Moons</span>
              <strong className="font-medium text-white">{planet.moons.count}</strong>
            </div>

            {planet.moons.moonsList.length > 0 ? (
              planet.moons.moonsList.map((moon) => (
                <div
                  key={moon.name}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"
                >
                  <div>
                    <strong className="block font-sans text-xs font-medium text-white">
                      {moon.name}
                    </strong>
                    <span className="text-[9px] text-slate-400">
                      Ø {moon.diameterKm}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-300">
                    {moon.orbitalPeriodDays}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-center font-sans text-xs font-light text-slate-400">
                No natural satellites in orbit.
              </div>
            )}
          </div>
        )}

        {/* Missions Tab */}
        {activeTab === "missions" && (
          <div className="space-y-2">
            {planet.missions.map((m) => (
              <div
                key={m.name}
                className="space-y-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs font-medium text-white">{m.name}</strong>
                  <span className="font-mono text-[9px] text-slate-400">
                    {m.agency} · {m.year}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed font-light text-slate-300/90">
                  {m.achievement}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
      <span className="block text-[9px] tracking-[0.14em] text-slate-400 uppercase">
        {label}
      </span>
      <strong className="mt-1 block text-[11px] font-medium text-white/95">
        {value}
      </strong>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <span className="text-slate-400">{label}</span>
      <strong className="text-right font-medium text-white/95">{value}</strong>
    </div>
  );
}
