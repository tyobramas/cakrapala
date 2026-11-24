'use client';

/**
 * DataAgeBadge — Subtle Luxury Telemetry Freshness Pill.
 */

import { useMemo } from 'react';
import type { LayerStatus } from '@/lib/osint/useLayer';

export interface DataAgeBadgeProps {
  name: string;
  ageMs: number;
  status: LayerStatus;
  refreshMs: number;
  entityCount?: number;
  noPulse?: boolean;
}

function formatAge(ms: number): string {
  if (ms < 0) return '–';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

type BadgeTone = 'fresh' | 'stale' | 'error';

function resolveTone(
  ageMs: number,
  refreshMs: number,
  status: LayerStatus,
): BadgeTone {
  if (status === 'error') return 'error';
  if (refreshMs > 0 && ageMs >= 2 * refreshMs) return 'stale';
  return 'fresh';
}

const DOT_CLASSES: Record<BadgeTone, string> = {
  fresh: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  stale: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.75)]',
  error: 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.75)]',
};

export default function DataAgeBadge({
  name,
  ageMs,
  status,
  refreshMs,
  entityCount,
}: DataAgeBadgeProps) {
  const tone = useMemo(
    () => resolveTone(ageMs, refreshMs, status),
    [ageMs, refreshMs, status],
  );

  const ageText = formatAge(ageMs);
  const countSuffix = entityCount !== undefined ? ` · ${entityCount}` : '';

  return (
    <div
      role="status"
      aria-label={`${name}: updated ${ageText} ago${countSuffix}`}
      className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-[#030714]/55 px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-slate-200/90 backdrop-blur-xl"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      <span>{name}</span>
      <span className="text-white/25">·</span>
      <span className="text-slate-400">
        {ageText}
        {countSuffix}
      </span>
    </div>
  );
}
