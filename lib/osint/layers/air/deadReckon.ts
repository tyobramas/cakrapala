// lib/osint/layers/air/deadReckon.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-Side Dead Reckoning for Aircraft.
//
// Extrapolates aircraft position smoothly between 10-second polling intervals
// using great-circle destination mathematics.
//
// Hard limits:
//   - Max extrapolation time: 30 seconds (beyond this, aircraft freezes).
//   - Grounded aircraft (onGround === true) or stationary/slow (< 5 m/s)
//     are NOT dead-reckoned.
//   - Heading normalization handles shortest angular path across 0°/360°.
// ─────────────────────────────────────────────────────────────────────────────

import {
  extrapolateMotion,
  shortestAngleDiff,
  interpolateHeading,
  type ProjectedPosition,
} from '@/lib/osint/motion';

export type { ProjectedPosition };
export { shortestAngleDiff, interpolateHeading };

const MAX_EXTRAPOLATION_S = 30;
const MIN_SPEED_MS = 5;

/**
 * Pure function: projects (lat, lon) forward along headingDeg by dtSeconds at speedMs.
 * Uses spherical great-circle trigonometry (Haversine destination formula).
 */
export function extrapolate(
  lat: number,
  lon: number,
  headingDeg: number | undefined,
  speedMs: number,
  dtSeconds: number,
): ProjectedPosition {
  return extrapolateMotion(lat, lon, headingDeg, speedMs, dtSeconds, {
    maxExtrapolationS: MAX_EXTRAPOLATION_S,
    minSpeedMs: MIN_SPEED_MS,
  });
}
