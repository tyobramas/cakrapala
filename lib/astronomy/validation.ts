/**
 * Input validation utilities for Cakrapala Milestone 2.
 *
 * Centralises guard clauses for user-supplied values (observer lat/lon/elev,
 * simulation time, speed multiplier) so component code stays clean.
 *
 * All functions return a Result discriminated union:
 *   { ok: true;  value: T }   — valid
 *   { ok: false; error: string } — invalid, with a human-readable reason
 */

import { CESIUM_SPEED_MULTIPLIERS, type CesiumSpeedMultiplier } from "./types";

// ── Result type ───────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// ── Latitude ──────────────────────────────────────────────────────────────────

/**
 * Validates a latitude string entered by the user.
 * Accepts decimal degrees in range [–90, +90].
 *
 * @param raw  Raw string from a form input.
 */
export function validateLatitudeInput(raw: string): ValidationResult<number> {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Latitude must be a number." };
  }
  if (n < -90 || n > 90) {
    return { ok: false, error: "Latitude must be between –90° and +90°." };
  }
  return { ok: true, value: n };
}

// ── Longitude ─────────────────────────────────────────────────────────────────

/**
 * Validates a longitude string entered by the user.
 * Accepts decimal degrees in range [–180, +180].
 *
 * @param raw  Raw string from a form input.
 */
export function validateLongitudeInput(raw: string): ValidationResult<number> {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Longitude must be a number." };
  }
  if (n < -180 || n > 180) {
    return { ok: false, error: "Longitude must be between –180° and +180°." };
  }
  return { ok: true, value: n };
}

// ── Elevation ─────────────────────────────────────────────────────────────────

/**
 * Validates an elevation string entered by the user.
 * Accepts metres in range [–500, +9000].
 *
 * @param raw  Raw string from a form input.
 */
export function validateElevationInput(raw: string): ValidationResult<number> {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Elevation must be a number." };
  }
  if (n < -500 || n > 9000) {
    return { ok: false, error: "Elevation must be between –500 m and +9000 m." };
  }
  return { ok: true, value: n };
}

// ── Speed multiplier ──────────────────────────────────────────────────────────

/**
 * Validates that a candidate speed value is one of the allowed multipliers.
 *
 * @param candidate  Number to validate.
 */
export function validateSpeedMultiplier(
  candidate: number
): ValidationResult<CesiumSpeedMultiplier> {
  const allowed: readonly number[] = CESIUM_SPEED_MULTIPLIERS;
  if (allowed.includes(candidate)) {
    return { ok: true, value: candidate as CesiumSpeedMultiplier };
  }
  return {
    ok: false,
    error: `Speed must be one of: ${allowed.join(", ")}× (got ${candidate}×).`,
  };
}

// ── Date ──────────────────────────────────────────────────────────────────────

/**
 * Validates that a Date object represents a valid, non-NaN instant.
 *
 * @param date  Date to validate.
 */
export function validateDate(date: Date): ValidationResult<Date> {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { ok: false, error: "Invalid date." };
  }
  return { ok: true, value: date };
}
