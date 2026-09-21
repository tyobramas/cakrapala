// lib/osint/geo.ts
// ─────────────────────────────────────────────────────────────────────────────
// Geographic utilities for OSINT bounding-box operations and distance.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox } from './types';

/**
 * Round a bounding box to the nearest grid step so that nearby viewport
 * positions share the same cache key.
 *
 * @param bbox  [west, south, east, north] in decimal degrees
 * @param stepDeg  Grid resolution (default 0.5°)
 */
export function roundBBox(bbox: BBox, stepDeg = 0.5): BBox {
  return [
    Math.floor(bbox[0] / stepDeg) * stepDeg,
    Math.floor(bbox[1] / stepDeg) * stepDeg,
    Math.ceil(bbox[2] / stepDeg) * stepDeg,
    Math.ceil(bbox[3] / stepDeg) * stepDeg,
  ];
}

/**
 * Produce a deterministic, stable string key from a bounding box.
 * Two identical bboxes (after rounding) always produce the same key.
 */
export function bboxKey(bbox: BBox, stepDeg = 0.5): string {
  const r = roundBBox(bbox, stepDeg);
  return `${r[0]},${r[1]},${r[2]},${r[3]}`;
}

// ── Haversine ───────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two points in **meters** (Haversine formula).
 */
export function haversineM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);
  const h =
    sinHalfDLat * sinHalfDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfDLon * sinHalfDLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// ── Clamp ───────────────────────────────────────────────────────────────────

/** Maximum allowed bbox area in square degrees (roughly 60° × 60°). */
const MAX_AREA_SQ_DEG = 3600;

/**
 * Clamp a bounding box so it doesn't exceed a reasonable area.
 * Returns the original bbox if within limits, or a clamped version centred
 * on the midpoint.
 */
export function clampBBox(bbox: BBox): BBox {
  const [w, s, e, n] = bbox;
  const width = Math.abs(e - w);
  const height = Math.abs(n - s);

  if (width * height <= MAX_AREA_SQ_DEG) return bbox;

  // Centre the box and limit each dimension.
  const maxSide = Math.sqrt(MAX_AREA_SQ_DEG); // 60°
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const hw = Math.min(width, maxSide) / 2;
  const hh = Math.min(height, maxSide) / 2;

  return [
    Math.max(cx - hw, -180),
    Math.max(cy - hh, -90),
    Math.min(cx + hw, 180),
    Math.min(cy + hh, 90),
  ];
}
