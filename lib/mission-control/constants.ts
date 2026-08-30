/**
 * AI Mission Control — Physical Constants.
 *
 * All constants in SI base units (m, s, kg) unless otherwise noted.
 * Sources: IAU 2012 (GM values), WGS84 (Earth radius), NASA GMAT (Moon).
 */

// ── Gravitational acceleration at sea level ───────────────────────────────────
/** Standard gravitational acceleration (m/s²). Used in Tsiolkovsky equation. */
export const G0_MPS2 = 9.80665;

// ── Earth parameters ──────────────────────────────────────────────────────────
/** Earth gravitational parameter μ_E (m³/s²). Source: IAU 2012 nominal. */
export const EARTH_MU_M3_S2 = 3.986004418e14;

/** Earth mean equatorial radius (m). Source: WGS84. */
export const EARTH_RADIUS_M = 6_378_137;

/** Earth sidereal rotation rate (rad/s). */
export const EARTH_ROTATION_RATE_RAD_S = 7.2921159e-5;

// ── Moon parameters ───────────────────────────────────────────────────────────
/** Moon gravitational parameter μ_M (m³/s²). Source: NASA GMAT. */
export const MOON_MU_M3_S2 = 4.9028695e12;

/** Moon mean radius (m). */
export const MOON_RADIUS_M = 1_737_400;

/** Earth–Moon mean distance (m). Approximate semi-major axis. */
export const MOON_MEAN_DISTANCE_M = 384_400_000;

// ── Sphere of Influence ───────────────────────────────────────────────────────
/** Earth Hill sphere / SOI approximate radius (m). */
export const EARTH_SOI_M = 924_000_000;

// ── Unit conversion constants ─────────────────────────────────────────────────
/** 1 AU in meters. Source: IAU 2012 exact definition. */
export const AU_TO_M = 149_597_870_700;

/** Model version identifier for traceability. */
export const MODEL_VERSION = "cakrapala-mc-1.0-simplified";

// ── Satellite Launch planner defaults ─────────────────────────────────────────
/** Default gravity loss estimate (m/s). Range: 1200–1800. */
export const DEFAULT_GRAVITY_LOSS_MPS = 1_500;

/** Default atmospheric drag loss estimate (m/s). Range: 100–300. */
export const DEFAULT_DRAG_LOSS_MPS = 200;

/** Default steering loss estimate (m/s). */
export const DEFAULT_STEERING_LOSS_MPS = 200;

/** Feasibility margin threshold — feasible (m/s). */
export const FEASIBILITY_MARGIN_FEASIBLE_MPS = 500;

// ── Lunar planner defaults ────────────────────────────────────────────────────
/** Mid-course correction delta-v estimate (m/s). */
export const MIDCOURSE_CORRECTION_ESTIMATE_MPS = 30;

/** Return correction delta-v estimate (m/s). */
export const RETURN_CORRECTION_ESTIMATE_MPS = 50;

/** Reentry corridor minimum altitude above Earth surface (m). */
export const REENTRY_CORRIDOR_MIN_M = 80_000;

/** Reentry corridor maximum altitude above Earth surface (m). */
export const REENTRY_CORRIDOR_MAX_M = 300_000;
