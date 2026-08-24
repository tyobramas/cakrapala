/**
 * Observer location utilities for Cakrapala Milestone 2.
 *
 * The observer model represents a geographic point on Earth's surface from
 * which topocentric celestial coordinates are computed.
 *
 * Default observer: Bogor, Indonesia (demo location — NOT GPS-derived).
 *   lat: –6.595°, lon: +106.816°, elev: 250 m, tz: Asia/Jakarta
 *
 * All latitudes and longitudes are in decimal degrees.
 * Elevation is in metres above the WGS-84 ellipsoid.
 */

import type { ObserverLocation } from "./types";

// ── Default demo observer ─────────────────────────────────────────────────────

/**
 * Default observer used when the user has not supplied a location.
 *
 * ⚠️ DEMO LOCATION — This is NOT GPS-derived.  It is a fixed reference point
 *    near central Bogor, Indonesia, chosen for testing purposes.
 *    Do NOT present this as the user's actual position.
 */
export const DEFAULT_OBSERVER: ObserverLocation = {
  latitude: -6.595,     // degrees, South is negative
  longitude: 106.816,   // degrees, East is positive
  elevationMeters: 250, // metres above WGS-84 ellipsoid
  timezone: "Asia/Jakarta",
  displayName: "Bogor, Indonesia",
} as const;

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Returns true if the supplied latitude value is in range [–90, +90].
 * Input is expected in decimal degrees.
 */
export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

/**
 * Returns true if the supplied longitude value is in range [–180, +180].
 * Input is expected in decimal degrees.
 */
export function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

/**
 * Returns true if the supplied elevation is in a plausible range.
 * Accepts –500 m (below sea level) to 9000 m (above Everest summit).
 * Input is in metres.
 */
export function isValidElevation(elev: number): boolean {
  return Number.isFinite(elev) && elev >= -500 && elev <= 9000;
}

/**
 * Validates an ObserverLocation.  Returns an array of error strings.
 * An empty array means the location is valid.
 */
export function validateObserverLocation(loc: ObserverLocation): string[] {
  const errors: string[] = [];
  if (!isValidLatitude(loc.latitude)) {
    errors.push(`Latitude ${loc.latitude}° is out of range [–90, +90].`);
  }
  if (!isValidLongitude(loc.longitude)) {
    errors.push(`Longitude ${loc.longitude}° is out of range [–180, +180].`);
  }
  if (!isValidElevation(loc.elevationMeters)) {
    errors.push(`Elevation ${loc.elevationMeters} m is out of range [–500, +9000].`);
  }
  return errors;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Formats a decimal-degree latitude as a human-readable string.
 * Example: formatLatitude(-6.595) → "6.5950° S"
 */
export function formatLatitude(lat: number): string {
  const dir = lat >= 0 ? "N" : "S";
  return `${Math.abs(lat).toFixed(4)}° ${dir}`;
}

/**
 * Formats a decimal-degree longitude as a human-readable string.
 * Example: formatLongitude(106.816) → "106.8160° E"
 */
export function formatLongitude(lon: number): string {
  const dir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lon).toFixed(4)}° ${dir}`;
}
