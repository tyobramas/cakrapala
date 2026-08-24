"use client";

/**
 * SimulationTimePanel — displays the current simulation clock time in both
 * UTC and the observer's local timezone.
 *
 * Receives the current UTC Date as a prop (updated from the Cesium clock tick
 * via the parent's onTimeChange callback).  No Cesium imports here.
 */

import { Clock } from "lucide-react";
import { formatUtc, formatLocalTime } from "@/lib/astronomy/time";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  /** Current simulation UTC time. */
  currentUtcDate: Date;
  /** IANA timezone string for local display (e.g. "Asia/Jakarta"). */
  observerTimezone: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SimulationTimePanel({
  currentUtcDate,
  observerTimezone,
}: Props) {
  const utcStr = formatUtc(currentUtcDate);
  const localStr = formatLocalTime(currentUtcDate, observerTimezone);

  return (
    <div
      className="
        flex items-center gap-2 bg-[#050c1a]/95 border border-[#1e3a5f]/50
        rounded-lg px-3 py-2 backdrop-blur-sm
      "
      aria-label="Simulation clock display"
    >
      <Clock size={13} className="text-blue-400 shrink-0" />
      <div className="flex flex-col">
        <span className="font-mono text-[10px] text-blue-300 leading-tight">
          {utcStr}
        </span>
        <span className="font-mono text-[9px] text-slate-500 leading-tight">
          {localStr} ({observerTimezone})
        </span>
      </div>
    </div>
  );
}
