// lib/osint/layers/sea/deadReckon.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-Side Dead Reckoning for Sea Vessels
//
// Rules:
//   - Uses Course Over Ground (COG), NOT Heading, for motion projection.
//   - Max extrapolation time: 60 seconds (vessels are slower; stops runaway).
//   - Vessels at anchor (navStat 1), moored (5), aground (6), or slow (< 0.5 kt),
//     or with stale position (> 5 min) are NOT dead-reckoned.
// ─────────────────────────────────────────────────────────────────────────────

import {
  extrapolateMotion,
  shortestAngleDiff,
  interpolateHeading,
  type ProjectedPosition,
} from '@/lib/osint/motion';

export type { ProjectedPosition };
export { shortestAngleDiff, interpolateHeading };

const MAX_SEA_EXTRAPOLATION_S = 60;
const MIN_SEA_SPEED_MS = 0.257222; // 0.5 knot

/**
 * Pure function: projects (lat, lon) forward along cogDeg by dtSeconds at speedMs.
 * Clamped to 60 seconds max.
 */
export function extrapolateVessel(
  lat: number,
  lon: number,
  cogDeg: number | undefined,
  speedMs: number | undefined,
  dtSeconds: number,
  options?: {
    navStat?: number;
    ageSeconds?: number;
  },
): ProjectedPosition {
  if (
    options?.navStat === 1 || // at anchor
    options?.navStat === 5 || // moored
    options?.navStat === 6    // aground
  ) {
    return { lat, lon };
  }

  if (options?.ageSeconds !== undefined && options.ageSeconds > 300) {
    // Stale positions (> 5 min) must not be extrapolated
    return { lat, lon };
  }

  if (speedMs === undefined || speedMs < MIN_SEA_SPEED_MS) {
    return { lat, lon };
  }

  return extrapolateMotion(lat, lon, cogDeg, speedMs, dtSeconds, {
    maxExtrapolationS: MAX_SEA_EXTRAPOLATION_S,
    minSpeedMs: MIN_SEA_SPEED_MS,
  });
}
