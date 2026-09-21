'use client';
// components/osint/DataAgeBadge.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Displays data freshness: "{name} · {age} ago"
//
// Status colours:
//   Green (pulsing)  — ageMs < 2× refreshMs
//   Yellow           — ageMs >= 2× refreshMs
//   Red              — status === 'error'
//
// Accessibility: descriptive aria-label, icon/text status indicator,
// minimum 4.5:1 contrast on dark transparent background.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import type { LayerStatus } from '@/lib/osint/useLayer';

export interface DataAgeBadgeProps {
  /** Human-readable name (e.g. "Earthquakes"). */
  name: string;
  /** Age in milliseconds (live counter from useLayer). */
  ageMs: number;
  /** Current layer status. */
  status: LayerStatus;
  /** refreshMs from registry — used for colour thresholds. */
  refreshMs: number;
  /** Optional count of entities currently displayed. */
  entityCount?: number;
  /** If true, suppress live pulse animation. */
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

type BadgeColour = 'green' | 'yellow' | 'red';

function resolveColour(
  ageMs: number,
  refreshMs: number,
  status: LayerStatus,
): BadgeColour {
  if (status === 'error') return 'red';
  if (refreshMs > 0 && ageMs >= 2 * refreshMs) return 'yellow';
  return 'green';
}

const COLOUR_CLASSES: Record<BadgeColour, string> = {
  green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  yellow: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  red: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const PULSE_CLASS = 'animate-pulse';

const STATUS_ICONS: Record<BadgeColour, string> = {
  green: '●',
  yellow: '◐',
  red: '✕',
};

const STATUS_LABELS: Record<BadgeColour, string> = {
  green: 'Fresh data',
  yellow: 'Stale data',
  red: 'Failed to load data',
};

export default function DataAgeBadge({
  name,
  ageMs,
  status,
  refreshMs,
  entityCount,
  noPulse,
}: DataAgeBadgeProps) {
  const colour = useMemo(
    () => resolveColour(ageMs, refreshMs, status),
    [ageMs, refreshMs, status],
  );

  const ageText = formatAge(ageMs);
  const isPulsing = !noPulse && refreshMs > 0 && colour === 'green';
  const countSuffix = entityCount !== undefined ? ` (${entityCount} cameras)` : '';
  const ariaLabel = `${name}: ${STATUS_LABELS[colour]}. Last updated ${ageText} ago${countSuffix}.`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border backdrop-blur-sm
        ${COLOUR_CLASSES[colour]}
        ${isPulsing ? PULSE_CLASS : ''}
      `}
    >
      <span aria-hidden="true" className="text-[10px]">
        {STATUS_ICONS[colour]}
      </span>
      <span>
        {name} · {ageText} ago{countSuffix}
      </span>
    </div>
  );
}
