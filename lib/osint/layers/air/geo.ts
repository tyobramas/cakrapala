// lib/osint/layers/air/geo.ts
// ─────────────────────────────────────────────────────────────────────────────
// Geographic helpers for ADS-B air layer.
//
// Converts viewport BBox [w, s, e, n] into (centerLat, centerLon, radiusNm).
// Enforces hard limits:
//   - Max radius: 250 nm (upstream api.adsb.lol hard limit).
//   - Radius is rounded up to multiples of 25 nm to ensure stable cache hits.
//   - Center coordinates rounded to 0.25° for grid caching.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox } from '../../types';

const KM_PER_NM = 1.852;
export const MAX_RADIUS_NM = 250;

/**
 * Haversine formula to compute distance in kilometers between two lat/lon points.
 */
export function haversineDistKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface CenterRadiusResult {
  centerLat: number;
  centerLon: number;
  radiusNm: number;
  rawRadiusNm: number;
  isTooLarge: boolean;
}

/**
 * Converts a bounding box [w, s, e, n] to (center, radius in nm).
 */
export function bboxToCenterRadius(bbox: BBox): CenterRadiusResult {
  const [w, s, e, n] = bbox;

  // Center latitude
  const centerLat = (s + n) / 2;

  // Center longitude (handling antimeridian if w > e)
  let centerLon: number;
  if (w <= e) {
    centerLon = (w + e) / 2;
  } else {
    // Crosses date line (e.g. 170 to -170)
    let avg = (w + (e + 360)) / 2;
    if (avg > 180) avg -= 360;
    centerLon = avg;
  }

  // Half diagonal: distance from center to a corner (n, e)
  const halfDiagKm = haversineDistKm(centerLat, centerLon, n, e);
  const rawRadiusNm = halfDiagKm / KM_PER_NM;

  // Round up to nearest multiple of 25 nm
  const roundedRadiusNm = Math.max(25, Math.ceil(rawRadiusNm / 25) * 25);
  const isTooLarge = rawRadiusNm > MAX_RADIUS_NM;
  const radiusNm = Math.min(MAX_RADIUS_NM, roundedRadiusNm);

  return {
    centerLat: Number(centerLat.toFixed(4)),
    centerLon: Number(centerLon.toFixed(4)),
    radiusNm,
    rawRadiusNm,
    isTooLarge,
  };
}

/**
 * Rounds a coordinate to a grid step (e.g. 0.25°).
 */
export function roundCoord(val: number, step = 0.25): number {
  return Number((Math.round(val / step) * step).toFixed(4));
}
