/**
 * AI Mission Control — Unit Conversions & Validation.
 *
 * All primary calculations use SI units (m, s, kg, rad).
 * These helpers convert between SI and display units (km, deg, AU).
 * Every converter includes NaN/Infinity guards.
 */

// ── Conversion functions ──────────────────────────────────────────────────────

export function kmToM(km: number): number {
  validateFinite(km, "kmToM input");
  return km * 1_000;
}

export function mToKm(m: number): number {
  validateFinite(m, "mToKm input");
  return m / 1_000;
}

export function degToRad(deg: number): number {
  validateFinite(deg, "degToRad input");
  return deg * (Math.PI / 180);
}

export function radToDeg(rad: number): number {
  validateFinite(rad, "radToDeg input");
  return rad * (180 / Math.PI);
}

export function auToM(au: number): number {
  validateFinite(au, "auToM input");
  return au * 149_597_870_700;
}

export function auToKm(au: number): number {
  return mToKm(auToM(au));
}

export function hoursToSeconds(h: number): number {
  validateFinite(h, "hoursToSeconds input");
  return h * 3_600;
}

export function secondsToHours(s: number): number {
  validateFinite(s, "secondsToHours input");
  return s / 3_600;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Assert that a numeric value is finite (not NaN, not ±Infinity).
 * Throws with a descriptive message on failure.
 */
export function validateFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`[MissionControl] ${label} is not finite: ${value}`);
  }
}

/**
 * Assert that a numeric value is strictly positive and finite.
 */
export function validatePositiveFinite(value: number, label: string): void {
  validateFinite(value, label);
  if (value <= 0) {
    throw new RangeError(
      `[MissionControl] ${label} must be > 0, got: ${value}`
    );
  }
}

/**
 * Assert that a value is within a specified range [min, max].
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  label: string
): void {
  validateFinite(value, label);
  if (value < min || value > max) {
    throw new RangeError(
      `[MissionControl] ${label} must be in [${min}, ${max}], got: ${value}`
    );
  }
}

/**
 * Validate that payload mass does not exceed vehicle capacity.
 */
export function validatePayload(
  payloadMassKg: number,
  capacityKg: number
): void {
  validatePositiveFinite(payloadMassKg, "payloadMassKg");
  if (payloadMassKg > capacityKg) {
    throw new RangeError(
      `[MissionControl] Payload ${payloadMassKg} kg exceeds vehicle capacity ${capacityKg} kg`
    );
  }
}
