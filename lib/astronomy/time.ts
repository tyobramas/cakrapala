/**
 * Simulation time utilities for Cakrapala Milestone 2.
 *
 * The canonical time source is a plain UTC `Date` object.
 * Cesium's JulianDate is used only inside Cesium components (never in this lib).
 *
 * All functions in this module are pure (no side effects).
 *
 * Speed multipliers: 1× = real-time.  Values from CESIUM_SPEED_MULTIPLIERS.
 */

/**
 * Returns the current wall-clock UTC time as a Date.
 * Alias for `new Date()` — exists for clarity at call sites.
 */
export function nowUtc(): Date {
  return new Date();
}

/**
 * Formats a UTC Date as an ISO 8601 string with seconds precision.
 * Example: "2024-01-01 00:00:00 UTC"
 */
export function formatUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/**
 * Formats a UTC Date in the given IANA timezone for display.
 * Falls back to UTC display if the timezone is not recognised by the runtime.
 *
 * @param date   The UTC Date to format.
 * @param tz     IANA timezone string, e.g. "Asia/Jakarta".
 * @returns      Locale string in the specified timezone.
 */
export function formatLocalTime(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    // Unknown timezone — fall back to UTC.
    return formatUtc(date);
  }
}

/**
 * Advances a UTC Date by the given number of wall-clock seconds,
 * scaled by the simulation speed multiplier.
 *
 * Used in testing / manual time stepping; in production the Cesium clock
 * advances time automatically.
 *
 * @param date            Starting UTC Date.
 * @param wallSeconds     Elapsed real seconds.
 * @param speedMultiplier Simulation speed (e.g. 100 = 100× real-time).
 * @returns               New Date advanced by wallSeconds × speedMultiplier.
 */
export function advanceSimulationTime(
  date: Date,
  wallSeconds: number,
  speedMultiplier: number
): Date {
  const simMs = wallSeconds * speedMultiplier * 1000;
  return new Date(date.getTime() + simMs);
}

/**
 * Returns a new Date clamped to the valid Julian Day Number range supported
 * by astronomy-engine (year 1 CE to year 9999 CE).
 *
 * @param date  Input UTC Date.
 * @returns     The same date if in range, otherwise clamped to the boundary.
 */
export function clampToAstronomyRange(date: Date): Date {
  const MIN_YEAR = new Date("0001-01-01T00:00:00Z").getTime();
  const MAX_YEAR = new Date("9999-12-31T23:59:59Z").getTime();
  const t = date.getTime();
  if (t < MIN_YEAR) return new Date(MIN_YEAR);
  if (t > MAX_YEAR) return new Date(MAX_YEAR);
  return date;
}
