/**
 * AI Mission Control — Ephemeris Module.
 *
 * Wraps the existing `astronomy-engine` library (already installed) to
 * provide Moon geocentric ECI position and velocity at any UTC timestamp.
 *
 * REFERENCE FRAME: J2000 equatorial geocentric (ECI).
 * astronomy-engine GeoVector returns equatorial geocentric coordinates in AU.
 * We convert to meters for the physics engine.
 *
 * ACCURACY: astronomy-engine is verified against JPL Horizons to
 * sub-arcsecond accuracy for most bodies.
 */

import * as Astronomy from "astronomy-engine";
import { AU_TO_M } from "./constants";
import type { Vec3 } from "./types";

// ── Moon Position ─────────────────────────────────────────────────────────────

/**
 * Get Moon position in geocentric ECI frame at a UTC timestamp.
 * Returns position in METERS.
 *
 * @param dateUtc — UTC Date object or ISO string
 * @returns Vec3 position in meters (J2000 equatorial geocentric)
 */
export function getMoonPositionEciM(dateUtc: Date | string): Vec3 {
  const date = typeof dateUtc === "string" ? new Date(dateUtc) : dateUtc;
  // GeoVector returns equatorial geocentric coordinates in AU
  // aberration=true for apparent position
  const gv = Astronomy.GeoVector(Astronomy.Body.Moon, date, true);
  return {
    x: gv.x * AU_TO_M,
    y: gv.y * AU_TO_M,
    z: gv.z * AU_TO_M,
  };
}

/**
 * Get Moon position in geocentric ECI frame at a UTC timestamp.
 * Returns position in KILOMETERS (convenience for UI display).
 */
export function getMoonPositionEciKm(dateUtc: Date | string): Vec3 {
  const posM = getMoonPositionEciM(dateUtc);
  return {
    x: posM.x / 1000,
    y: posM.y / 1000,
    z: posM.z / 1000,
  };
}

/**
 * Estimate Moon velocity in geocentric ECI frame using finite differences.
 * Returns velocity in METERS PER SECOND.
 *
 * Uses ±30 second central difference for numerical stability.
 */
export function getMoonVelocityEciMps(dateUtc: Date | string): Vec3 {
  const date = typeof dateUtc === "string" ? new Date(dateUtc) : dateUtc;
  const dt = 30_000; // 30 seconds in ms

  const before = getMoonPositionEciM(new Date(date.getTime() - dt));
  const after = getMoonPositionEciM(new Date(date.getTime() + dt));

  const dtSeconds = (2 * dt) / 1000;
  return {
    x: (after.x - before.x) / dtSeconds,
    y: (after.y - before.y) / dtSeconds,
    z: (after.z - before.z) / dtSeconds,
  };
}

/**
 * Get Moon distance from Earth center in meters at a UTC timestamp.
 */
export function getMoonDistanceM(dateUtc: Date | string): number {
  const pos = getMoonPositionEciM(dateUtc);
  return Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
}

/**
 * Get Sun position in geocentric ECI frame at a UTC timestamp.
 * Returns position in METERS. Useful for lighting/context.
 */
export function getSunPositionEciM(dateUtc: Date | string): Vec3 {
  const date = typeof dateUtc === "string" ? new Date(dateUtc) : dateUtc;
  const gv = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  return {
    x: gv.x * AU_TO_M,
    y: gv.y * AU_TO_M,
    z: gv.z * AU_TO_M,
  };
}
