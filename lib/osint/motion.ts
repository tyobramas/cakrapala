// lib/osint/motion.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared Great-Circle Dead Reckoning & Angular Mathematics for Moving Entities
//
// Used across OSINT layers:
//   - Layer Air: aircraft extrapolation (max 30s, min 5 m/s)
//   - Layer Sea: vessel extrapolation (max 60s, min 0.257 m/s, using COG)
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

export interface ProjectedPosition {
  lat: number;
  lon: number;
}

export interface ExtrapolateOptions {
  /** Maximum seconds to project forward before stopping (prevents runaway drift) */
  maxExtrapolationS?: number;
  /** Minimum speed in m/s required to project (below this, entity remains stationary) */
  minSpeedMs?: number;
}

/**
 * Pure function: projects (lat, lon) forward along headingOrCogDeg by dtSeconds at speedMs.
 * Uses spherical great-circle trigonometry (Haversine destination formula).
 */
export function extrapolateMotion(
  lat: number,
  lon: number,
  headingOrCogDeg: number | undefined,
  speedMs: number,
  dtSeconds: number,
  options: ExtrapolateOptions = {},
): ProjectedPosition {
  const maxDt = options.maxExtrapolationS ?? 30;
  const minSpeed = options.minSpeedMs ?? 0;

  if (
    headingOrCogDeg === undefined ||
    isNaN(headingOrCogDeg) ||
    isNaN(lat) ||
    isNaN(lon) ||
    isNaN(speedMs) ||
    speedMs < minSpeed ||
    dtSeconds <= 0
  ) {
    return { lat, lon };
  }

  // Clamp extrapolation to maximum seconds
  const dt = Math.min(dtSeconds, maxDt);
  const distanceM = speedMs * dt;
  const angularDist = distanceM / EARTH_RADIUS_M;

  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const phi1 = lat * toRad;
  const lambda1 = lon * toRad;
  const theta = headingOrCogDeg * toRad;

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
 * Interpolates heading/course smoothly between two angles along the shortest path.
 */
export function interpolateHeading(fromDeg: number, toDeg: number, t: number): number {
  const diff = shortestAngleDiff(fromDeg, toDeg);
  const result = fromDeg + diff * Math.max(0, Math.min(1, t));
  return (result + 360) % 360;
}
