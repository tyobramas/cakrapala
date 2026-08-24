/**
 * Coordinate-system transformation utilities for Cakrapala Milestone 2.
 *
 * Converts topocentric Az/Alt coordinates into 3-D Cartesian (ENU then ECEF)
 * vectors that CesiumJS can use to position a billboard/point entity in the
 * correct direction as seen from the observer on the globe.
 *
 * APPROACH (visual approximation):
 *   1. Convert Az/Alt → unit vector in the local East-North-Up (ENU) frame.
 *   2. Scale the ENU vector to a large "visual distance" (VISUAL_BODY_DISTANCE_M).
 *   3. Compute the observer's ECEF position from lat/lon/elev.
 *   4. Add the scaled ENU offset to the observer ECEF position to get the
 *      entity's final ECEF position.
 *
 * ⚠️  ACCURACY DISCLAIMER:
 *   This is a VISUAL approximation, NOT an astronomical distance.
 *   The entity appears in the correct directional position as seen from
 *   the observer but at an arbitrary fixed distance from Earth's centre.
 *   Parallax, actual planetary distances, and angular sizes are not modelled.
 *
 * UNIT CONVENTIONS:
 *   - Azimuth input:  degrees clockwise from North (0–360°).
 *   - Altitude input: degrees above/below horizon (–90° to +90°).
 *   - Output:         metres in Earth-Centred Earth-Fixed (ECEF) frame.
 *                     Compatible with Cesium.Cartesian3.
 *
 * NO Cesium imports here — this module is pure math, usable server-side.
 */

import type { HorizontalPosition, ObserverLocation } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Visual distance in metres at which celestial entities are placed from the
 * observer in the ENU frame.  Large enough to appear far away on the globe but
 * within Cesium's default far-plane (~1e10 m).
 */
export const VISUAL_BODY_DISTANCE_M = 1e8;

/** WGS-84 semi-major axis in metres. */
const WGS84_A = 6378137.0;

/** WGS-84 first eccentricity squared. */
const WGS84_E2 = 6.6943799901414e-3;

// ── Internal math helpers ─────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts geodetic lat/lon/elev to ECEF Cartesian coordinates (metres).
 * Uses the WGS-84 ellipsoid.
 *
 * @param latDeg  Geodetic latitude in degrees (–90 to +90).
 * @param lonDeg  Longitude in degrees (–180 to +180).
 * @param elevM   Elevation in metres above WGS-84 ellipsoid.
 * @returns       { x, y, z } in metres (ECEF).
 */
export function geodeticToEcef(
  latDeg: number,
  lonDeg: number,
  elevM: number
): { x: number; y: number; z: number } {
  const lat = degToRad(latDeg);
  const lon = degToRad(lonDeg);

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  // Prime vertical radius of curvature N(φ)
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return {
    x: (N + elevM) * cosLat * cosLon,
    y: (N + elevM) * cosLat * sinLon,
    z: (N * (1 - WGS84_E2) + elevM) * sinLat,
  };
}

/**
 * Converts topocentric Az/Alt to a unit direction vector in the ENU frame.
 *
 * ENU frame: x = East, y = North, z = Up (local vertical at the observer).
 *
 * Azimuth = 0° → North, 90° → East, 180° → South, 270° → West.
 * Altitude = 0° → horizon, +90° → zenith, –90° → nadir.
 *
 * @param azDeg   Azimuth in degrees clockwise from North.
 * @param altDeg  Altitude in degrees above the horizon.
 * @returns       Unit vector { e, n, u } in ENU frame.
 */
export function azAltToEnuUnit(
  azDeg: number,
  altDeg: number
): { e: number; n: number; u: number } {
  const az  = degToRad(azDeg);
  const alt = degToRad(altDeg);

  const cosAlt = Math.cos(alt);
  return {
    e: cosAlt * Math.sin(az),   // East component
    n: cosAlt * Math.cos(az),   // North component
    u: Math.sin(alt),           // Up component
  };
}

/**
 * Rotates an ENU vector to ECEF using the observer's geodetic latitude and
 * longitude (the standard ENU-to-ECEF rotation matrix).
 *
 * @param enu     ENU vector { e, n, u } (any magnitude).
 * @param latDeg  Observer geodetic latitude in degrees.
 * @param lonDeg  Observer longitude in degrees.
 * @returns       ECEF vector { x, y, z } with same magnitude as enu.
 */
export function enuToEcef(
  enu: { e: number; n: number; u: number },
  latDeg: number,
  lonDeg: number
): { x: number; y: number; z: number } {
  const lat = degToRad(latDeg);
  const lon = degToRad(lonDeg);

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  return {
    x: -sinLon * enu.e - sinLat * cosLon * enu.n + cosLat * cosLon * enu.u,
    y:  cosLon * enu.e - sinLat * sinLon * enu.n + cosLat * sinLon * enu.u,
    z:  cosLat         * enu.n                   + sinLat           * enu.u,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Converts topocentric Az/Alt + observer location into an ECEF position
 * suitable for use as a Cesium.Cartesian3.
 *
 * The returned position is at VISUAL_BODY_DISTANCE_M from the observer in the
 * direction given by azimuth and altitude.
 *
 * ⚠️  Visual approximation only — see module header for details.
 *
 * @param horizontal  Az/Alt in degrees.
 * @param observer    Geographic observer location.
 * @param distanceM   Optional override for visual distance (default: VISUAL_BODY_DISTANCE_M).
 * @returns           { x, y, z } in metres (ECEF), compatible with Cesium.Cartesian3.
 */
export function horizontalToEcef(
  horizontal: HorizontalPosition,
  observer: ObserverLocation,
  distanceM: number = VISUAL_BODY_DISTANCE_M
): { x: number; y: number; z: number } {
  // 1. Az/Alt → ENU unit vector.
  const enu = azAltToEnuUnit(horizontal.azimuthDeg, horizontal.altitudeDeg);

  // 2. Scale to visual distance.
  const scaledEnu = {
    e: enu.e * distanceM,
    n: enu.n * distanceM,
    u: enu.u * distanceM,
  };

  // 3. ENU offset → ECEF offset.
  const ecefOffset = enuToEcef(scaledEnu, observer.latitude, observer.longitude);

  // 4. Observer ECEF origin.
  const origin = geodeticToEcef(observer.latitude, observer.longitude, observer.elevationMeters);

  // 5. Final ECEF = observer origin + scaled directional offset.
  return {
    x: origin.x + ecefOffset.x,
    y: origin.y + ecefOffset.y,
    z: origin.z + ecefOffset.z,
  };
}
