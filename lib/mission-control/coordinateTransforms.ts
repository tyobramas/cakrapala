/**
 * AI Mission Control — Coordinate System & Unit Transformations.
 *
 * Internal Calculation Standard:
 *   - Reference Frame: Earth-Centered Inertial (ECI) J2000
 *   - Distance Units: kilometers (km)
 *   - Velocity Units: kilometers per second (km/s)
 *   - Time: UTC ISO 8601 strings
 *
 * 3D Renderer Standard (Three.js):
 *   - Scene Scale: 1 unit = 1,000 km
 *   - Coordinate Mapping:
 *       Three.js +X = ECI X (Vernal Equinox)
 *       Three.js +Y = ECI Z (North Celestial Pole / Earth Axis)
 *       Three.js +Z = -ECI Y (Aligns standard SphereGeometry equirectangular UV longitude with ECI)
 */

import type { Vec3 } from "./types";
import { EARTH_ROTATION_RATE_RAD_S } from "./constants";

export const RENDERER_SCALE = 1 / 1000; // 1 Three.js unit = 1,000 km

export interface RendererVector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Validates that a 3D vector has finite numbers.
 */
export function assertFiniteVector3(v: Vec3, label: string = "Vector3"): void {
  if (
    !v ||
    !Number.isFinite(v.x) ||
    !Number.isFinite(v.y) ||
    !Number.isFinite(v.z)
  ) {
    throw new TypeError(
      `Invalid non-finite vector in ${label}: (${v?.x}, ${v?.y}, ${v?.z})`
    );
  }
}

/**
 * Converts ECI position (km) to 3D Renderer scene coordinates.
 * Scales by 1/1,000 and maps axes so:
 *   Three.js +X = ECI X (0° Longitude / Greenwich)
 *   Three.js +Y = ECI Z (North Celestial Pole / Earth Axis)
 *   Three.js +Z = -ECI Y (Western Longitudes map to +Z in Three.js front view)
 */
export function eciKmToRendererPosition(
  posEciKm: Vec3,
  scale: number = RENDERER_SCALE
): RendererVector3 {
  assertFiniteVector3(posEciKm, "eciKmToRendererPosition");
  return {
    x: posEciKm.x * scale,
    y: posEciKm.z * scale,  // ECI Z -> Three.js Y (North)
    z: -posEciKm.y * scale, // ECI Y -> Three.js -Z (West is +Z in standard Three.js sphere UVs)
  };
}

/**
 * Converts 3D Renderer scene coordinates back to ECI position (km).
 */
export function rendererPositionToEciKm(
  renderPos: RendererVector3,
  scale: number = RENDERER_SCALE
): Vec3 {
  assertFiniteVector3(renderPos as Vec3, "rendererPositionToEciKm");
  return {
    x: renderPos.x / scale,
    y: -renderPos.z / scale, // Three.js -Z -> ECI Y
    z: renderPos.y / scale,  // Three.js Y -> ECI Z
  };
}

/**
 * Converts ECI coordinates (km) to Earth-Centered Earth-Fixed (ECEF) coordinates (km)
 * by rotating around the Z-axis by Greenwich Sidereal Time.
 */
export function eciKmToEcefKm(posEciKm: Vec3, timestampUtc: string): Vec3 {
  assertFiniteVector3(posEciKm, "eciKmToEcefKm");
  const date = new Date(timestampUtc);
  if (isNaN(date.getTime())) {
    throw new RangeError(`Invalid timestamp: ${timestampUtc}`);
  }

  // Julian date
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0; // days since J2000.0

  // Greenwich Mean Sidereal Time (GMST) in radians
  const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
  const gmstRad = (gmstHours * Math.PI) / 12;

  // Rotate around Z axis by -gmstRad
  const cosG = Math.cos(gmstRad);
  const sinG = Math.sin(gmstRad);

  return {
    x: posEciKm.x * cosG + posEciKm.y * sinG,
    y: -posEciKm.x * sinG + posEciKm.y * cosG,
    z: posEciKm.z,
  };
}

/**
 * Calculates straight-line distance between two 3D points in km.
 */
export function distanceBetweenKm(a: Vec3, b: Vec3): number {
  assertFiniteVector3(a, "distanceBetweenKm: a");
  assertFiniteVector3(b, "distanceBetweenKm: b");
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}
