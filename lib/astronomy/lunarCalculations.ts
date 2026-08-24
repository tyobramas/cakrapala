/**
 * Lunar calculation utilities for Cakrapala Milestone 3.
 *
 * Wraps astronomy-engine to provide moon phase, illumination, and
 * next-new-moon calculations. This is the foundation layer for Hilal AI
 * (Milestone 4+) — it does NOT implement any religious calendar determination,
 * crescent visibility criteria, or official rukyat judgment.
 *
 * TERMINOLOGY:
 *   Astronomical new moon: The instant when the Moon's elongation from the
 *   Sun is exactly 0° (conjunction). The Moon is NOT visible at this point.
 *
 *   Visible hilal (crescent): The first sighting of the thin crescent Moon
 *   after astronomical new moon. This depends on elongation, altitude, age,
 *   atmospheric conditions, and observer criteria (Wujudul Hilal, Imkan Rukyat,
 *   IICC, etc.). This module does NOT compute crescent visibility.
 *
 * PHASE CONVENTION:
 *   phaseDegrees: 0° = new moon, 90° = first quarter,
 *                 180° = full moon, 270° = last quarter.
 *   Source: Astronomy.MoonPhase() which returns the Moon's ecliptic longitude
 *   relative to the Sun, in the range [0°, 360°).
 *
 * ILLUMINATION:
 *   0.0 = completely dark (new moon).
 *   1.0 = fully illuminated (full moon).
 *   Source: Astronomy.Illumination(Body.Moon, date).phase_fraction.
 *
 * TIME STANDARD: All dates are UTC.
 *
 * ACCURACY: astronomy-engine agrees with JPL Horizons to within 1 minute
 * for new moon and full moon times.
 */

import * as Astronomy from "astronomy-engine";
import type { LunarData } from "./types";
import { clampToAstronomyRange } from "./time";

// ── Phase naming ──────────────────────────────────────────────────────────────

/**
 * Returns a human-readable English phase name for a given phase angle.
 *
 * @param phaseDeg  Phase angle in degrees [0, 360).
 */
function phaseName(phaseDeg: number): string {
  const p = ((phaseDeg % 360) + 360) % 360;
  if (p < 22.5)  return "New Moon";
  if (p < 67.5)  return "Waxing Crescent";
  if (p < 112.5) return "First Quarter";
  if (p < 157.5) return "Waxing Gibbous";
  if (p < 202.5) return "Full Moon";
  if (p < 247.5) return "Waning Gibbous";
  if (p < 292.5) return "Last Quarter";
  if (p < 337.5) return "Waning Crescent";
  return "New Moon";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the Moon's phase angle in degrees at the given UTC date.
 *
 * @param utcDate  UTC Date.
 * @returns        Phase angle in degrees [0, 360). 0 = new moon, 180 = full moon.
 */
export function calculateMoonPhase(utcDate: Date): number {
  const safe = clampToAstronomyRange(utcDate);
  // Astronomy.MoonPhase returns the Moon's geocentric ecliptic longitude
  // relative to the Sun, which equals 0° at new moon and 180° at full moon.
  return Astronomy.MoonPhase(safe);
}

/**
 * Returns the fraction of the Moon's disc that is illuminated at the given date.
 *
 * @param utcDate  UTC Date.
 * @returns        Illuminated fraction [0, 1]. 0 = new moon, 1 = full moon.
 */
export function calculateMoonIllumination(utcDate: Date): number {
  const safe = clampToAstronomyRange(utcDate);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, safe);
  // phase_fraction is already in [0, 1].
  return illum.phase_fraction;
}

/**
 * Returns the UTC Date of the next new moon at or after `afterDate`.
 *
 * Searches up to 40 days ahead (more than one full synodic month).
 * Returns null if no new moon is found (should not happen in normal operation).
 *
 * @param afterDate  UTC Date from which to search.
 * @returns          UTC Date of next new moon, or null.
 */
export function calculateNextNewMoon(afterDate: Date): Date | null {
  const safe = clampToAstronomyRange(afterDate);
  try {
    // SearchMoonPhase(targetPhase, startDate, limitDays)
    // targetPhase = 0 means new moon.
    const result = Astronomy.SearchMoonPhase(0, safe, 40);
    return result ? result.date : null;
  } catch {
    return null;
  }
}

/**
 * Returns a complete LunarData snapshot for the given UTC date.
 * Combines phase, illumination, phase name, and next new moon.
 *
 * @param utcDate  UTC Date.
 */
export function getLunarData(utcDate: Date): LunarData {
  const phase = calculateMoonPhase(utcDate);
  const illum = calculateMoonIllumination(utcDate);
  const nextNew = calculateNextNewMoon(utcDate);

  return {
    phaseDegrees: phase,
    illuminationFraction: illum,
    phaseName: phaseName(phase),
    nextNewMoonDate: nextNew,
  };
}

/**
 * Returns the approximate number of days since the last new moon (lunar age).
 *
 * Lunar age is computed from the current phase angle.
 * A synodic month is approximately 29.53059 days.
 *
 * ⚠️  This is an approximation. The actual new moon instant varies due to
 *     the Moon's elliptical orbit and other perturbations.
 *
 * @param utcDate  UTC Date.
 * @returns        Approximate lunar age in days [0, 29.53).
 */
export function calculateLunarAge(utcDate: Date): number {
  const SYNODIC_MONTH_DAYS = 29.53059;
  const phase = calculateMoonPhase(utcDate);
  return (phase / 360) * SYNODIC_MONTH_DAYS;
}
