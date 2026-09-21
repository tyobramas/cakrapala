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

const EARTH_RADIUS_M = 6_371_000;
const MAX_EXTRAPOLATION_S = 30;
const MIN_SPEED_MS = 5;

export interface ProjectedPosition {
  lat: number;
  lon: number;
}

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
  if (
    headingDeg === undefined ||
    isNaN(headingDeg) ||
    isNaN(lat) ||
    isNaN(lon) ||
    isNaN(speedMs) ||
    speedMs < MIN_SPEED_MS ||
    dtSeconds <= 0
  ) {
    return { lat, lon };
  }

  // Clamp extrapolation to maximum 30 seconds
  const dt = Math.min(dtSeconds, MAX_EXTRAPOLATION_S);
  const distanceM = speedMs * dt;
  const angularDist = distanceM / EARTH_RADIUS_M;

  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const phi1 = lat * toRad;
  const lambda1 = lon * toRad;
  const theta = headingDeg * toRad;

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinAng = Math.sin(angularDist);
  const cosAng = Math.cos(angularDist);

  const sinPhi2 = sinPhi1 * cosAng + cosPhi1 * sinAng * Math.cos(theta);
  const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));

  const y = Math.sin(theta) * sinAng * cosPhi1;
  const x = cosAng - sinPhi1 * Math.sin(phi2);
  const lambda2 = lambda1 + Math.atan2(y, x);

  const projectedLat = phi2 * toDeg;
  // Normalize longitude to [-180, 180]
  const projectedLon = (((lambda2 * toDeg + 540) % 360) - 180);

  return {
    lat: projectedLat,
    lon: projectedLon,
  };
}

/**
 * Calculates the shortest angular difference between two headings across 0°/360°.
 * Example: 349° to 3° returns +14° (not -346°).
 */
export function shortestAngleDiff(fromDeg: number, toDeg: number): number {
  return (((toDeg - fromDeg + 540) % 360) - 180);
}

/**
 * Interpolates heading smoothly between two angles along the shortest path.
 */
export function interpolateHeading(fromDeg: number, toDeg: number, t: number): number {
  const diff = shortestAngleDiff(fromDeg, toDeg);
  const result = fromDeg + diff * Math.max(0, Math.min(1, t));
  return (result + 360) % 360;
}
