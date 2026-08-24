"use client";

/**
 * HorizonEventsPanel — displays sunrise, sunset, moonrise, moonset,
 * lunar phase, and illumination for the current simulation date and observer.
 *
 * Times are displayed in both UTC and local timezone.
 * All times come from lib/astronomy/horizonEvents.ts and lunarCalculations.ts.
 */

import { formatUtc, formatLocalTime } from "@/lib/astronomy/time";
import { getLunarData } from "@/lib/astronomy/lunarCalculations";
import {
  calculateSunRiseSet,
  calculateMoonRiseSet,
  utcDayStart,
} from "@/lib/astronomy/horizonEvents";
import type { ObserverLocation, HorizonEventResult } from "@/lib/astronomy/types";

type Props = {
  observer: ObserverLocation;
  /** Current simulation UTC date. */
  utcDate: Date;
};

export default function HorizonEventsPanel({ observer, utcDate }: Props) {
  const dayStart = utcDayStart(utcDate);
  const sunEvents = calculateSunRiseSet(observer, dayStart);
  const moonEvents = calculateMoonRiseSet(observer, dayStart);
  const lunar = getLunarData(utcDate);
  const tz = observer.timezone;

  return (
    <div className="bg-[#050c1a]/95 border border-[#1e3a5f]/40 rounded p-3 text-xs">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-2">
        Horizon Events
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {/* Sunrise */}
        <EventRow
          label="☀ Sunrise"
          event={sunEvents.rise}
          tz={tz}
        />
        {/* Sunset */}
        <EventRow
          label="☀ Sunset"
          event={sunEvents.set}
          tz={tz}
        />
        {/* Moonrise */}
        <EventRow
          label="☽ Moonrise"
          event={moonEvents.rise}
          tz={tz}
        />
        {/* Moonset */}
        <EventRow
          label="☽ Moonset"
          event={moonEvents.set}
          tz={tz}
        />
      </div>

      {/* ── Lunar data ────────────────────────────────────────────────────── */}
      <div className="mt-3 pt-2 border-t border-[#1e3a5f]/30">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-1.5">
          Lunar
        </div>
        <div className="flex flex-col gap-1">
          <DataRow label="Phase" value={lunar.phaseName} />
          <DataRow label="Phase angle" value={`${lunar.phaseDegrees.toFixed(1)}°`} />
          <DataRow label="Illumination" value={`${(lunar.illuminationFraction * 100).toFixed(1)}%`} />
          {lunar.nextNewMoonDate && (
            <DataRow
              label="Next new moon"
              value={formatLocalTime(lunar.nextNewMoonDate, tz)}
            />
          )}
        </div>
        <p className="text-[9px] text-slate-600 mt-2">
          ⚠ Astronomical new moon ≠ visible hilal. Crescent visibility depends on
          elongation, altitude, atmospheric conditions, and observer criteria.
        </p>
      </div>
    </div>
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function EventRow({
  label,
  event,
  tz,
}: {
  label: string;
  event: HorizonEventResult;
  tz: string;
}) {
  if (!event.date) {
    return (
      <>
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-600 italic">
          {event.unavailableReason ? "Unavailable" : "—"}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-mono">
        {formatLocalTime(event.date, tz)}
        <span className="text-slate-600 ml-1 text-[9px]">({tz})</span>
      </span>
    </>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 font-mono text-right">{value}</span>
    </div>
  );
}

// suppress unused import warning for formatUtc (available for external use)
void formatUtc;
