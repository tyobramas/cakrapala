"use client";

/**
 * ObserverPanel — displays and allows editing of the observer's geographic
 * location for the Cesium globe view.
 *
 * Shows:
 *   - Display name
 *   - Latitude / Longitude / Elevation (read-only display for MVP)
 *   - "Demo location" disclaimer
 *
 * Editing is intentionally deferred to a future milestone.  The panel is
 * purely informational for Milestone 2.
 */

import { MapPin } from "lucide-react";
import {
  formatLatitude,
  formatLongitude,
} from "@/lib/astronomy/observer";
import type { ObserverLocation } from "@/lib/astronomy/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  observer: ObserverLocation;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ObserverPanel({ observer }: Props) {
  return (
    <aside
      className="
        flex flex-col gap-3 bg-[#050c1a]/95 border border-[#1e3a5f]/50
        rounded-lg p-3 backdrop-blur-sm min-w-[200px]
      "
      aria-label="Observer location panel"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <MapPin size={13} className="text-cyan-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-300 truncate">
          {observer.displayName}
        </span>
      </div>

      {/* ── Location data ────────────────────────────────────────────────── */}
      <dl className="flex flex-col gap-1.5">
        <Row label="Lat" value={formatLatitude(observer.latitude)} />
        <Row label="Lon" value={formatLongitude(observer.longitude)} />
        <Row
          label="Elev"
          value={`${observer.elevationMeters.toFixed(0)} m`}
        />
        <Row label="TZ" value={observer.timezone} />
      </dl>

      {/* ── Demo disclaimer ──────────────────────────────────────────────── */}
      <p className="text-[9px] text-slate-600 leading-relaxed border-t border-[#1e3a5f]/30 pt-2">
        ⚠️ Demo location — not GPS-derived.
      </p>
    </aside>
  );
}

// ── Internal row helper ───────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[10px] text-slate-500 shrink-0">{label}</dt>
      <dd className="text-[10px] font-mono text-slate-300 text-right">{value}</dd>
    </div>
  );
}
