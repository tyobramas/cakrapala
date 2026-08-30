/**
 * AI Mission Control — Ascent & Orbit-Raising Physics Model.
 *
 * Replaces the previous flat-constant loss model with input-sensitive
 * physics so that altitude, inclination, launch latitude and vehicle
 * configuration each produce distinct delta-v budgets.
 *
 * Formulas implemented:
 *   A. Hohmann transfer:   Δv₁ = v_p - v₁ ,  Δv₂ = v₂ - v_a
 *   B. Launch azimuth:     sin(A) = cos(i) / cos(φ)
 *   C. Rotation assist:    v_rot = ω · R · cos(φ) · sin(A)
 *   D. Plane change:       Δv = 2 · v · sin(Δi/2)
 *   E. GMST for ECEF→ECI launch site placement
 */

import {
    EARTH_MU_M3_S2,
    EARTH_RADIUS_M,
    EARTH_ROTATION_RATE_RAD_S,
} from "./constants";
import { degToRad, validatePositiveFinite } from "./units";

// ── Model calibration constants ───────────────────────────────────────────────

/** Altitude the ascent phase actually targets before orbit raising (km). */
export const REFERENCE_PARKING_ALTITUDE_KM = 200;

/** Liftoff thrust-to-weight ratio at which BASELINE_GRAVITY_LOSS_MPS applies. */
export const BASELINE_TWR = 1.45;

/** Gravity loss at BASELINE_TWR (m/s). Real launchers span ~1,200–1,800. */
export const BASELINE_GRAVITY_LOSS_MPS = 1_500;

/** Drag loss for a BASELINE_DRAG_MASS_KG class vehicle (m/s). */
export const BASELINE_DRAG_LOSS_MPS = 300;
export const BASELINE_DRAG_MASS_KG = 30_000;

/** Standard gravity used for TWR (m/s²). */
const G0 = 9.80665;

// ── A. Hohmann transfer ───────────────────────────────────────────────────────

export interface HohmannResult {
    /** Prograde burn at the parking orbit (m/s). */
    burn1Mps: number;
    /** Circularization burn at apoapsis (m/s). */
    burn2Mps: number;
    /** Sum of both burns (m/s). */
    totalMps: number;
    /** Half-period of the transfer ellipse (s). */
    transferTimeS: number;
}

/**
 * Two-impulse Hohmann transfer between coplanar circular orbits.
 * Returns zeros when r2 <= r1 (no orbit raising required).
 */
export function hohmannTransfer(r1M: number, r2M: number): HohmannResult {
    validatePositiveFinite(r1M, "Hohmann r1");
    validatePositiveFinite(r2M, "Hohmann r2");

    if (r2M <= r1M) {
        return { burn1Mps: 0, burn2Mps: 0, totalMps: 0, transferTimeS: 0 };
    }

    const mu = EARTH_MU_M3_S2;
    const aT = (r1M + r2M) / 2;

    const v1 = Math.sqrt(mu / r1M);
    const vP = Math.sqrt(mu * (2 / r1M - 1 / aT));
    const burn1 = vP - v1;

    const v2 = Math.sqrt(mu / r2M);
    const vA = Math.sqrt(mu * (2 / r2M - 1 / aT));
    const burn2 = v2 - vA;

    const transferTimeS = Math.PI * Math.sqrt(Math.pow(aT, 3) / mu);

    return {
        burn1Mps: burn1,
        burn2Mps: burn2,
        totalMps: burn1 + burn2,
        transferTimeS,
    };
}

// ── B. Launch azimuth ─────────────────────────────────────────────────────────

export interface LaunchAzimuthResult {
    /** Azimuth measured from local north, eastward positive (rad). */
    azimuthRad: number;
    /** True when the inclination is reachable without a plane change. */
    achievable: boolean;
    /** Lowest inclination reachable directly from this latitude (deg). */
    minInclinationDeg: number;
    /** Plane change still required after launching at minimum inclination (deg). */
    residualPlaneChangeDeg: number;
}

/**
 * Solve launch azimuth from target inclination and launch latitude.
 *
 *   sin(A) = cos(i) / cos(φ)
 *
 * When |cos(i)| > cos(φ) the inclination is below the site latitude and a
 * plane change is unavoidable; the vehicle then launches due east at the
 * minimum achievable inclination.
 */
export function solveLaunchAzimuth(
    targetIncDeg: number,
    latitudeDeg: number
): LaunchAzimuthResult {
    const latRad = degToRad(latitudeDeg);
    const incRad = degToRad(targetIncDeg);
    const cosLat = Math.cos(latRad);
    const minInclinationDeg = Math.abs(latitudeDeg);

    // Near-polar launch site: any inclination is reachable, azimuth degenerates.
    if (cosLat < 1e-6) {
        return {
            azimuthRad: Math.PI / 2,
            achievable: true,
            minInclinationDeg,
            residualPlaneChangeDeg: 0,
        };
    }

    const sinAz = Math.cos(incRad) / cosLat;

    if (Math.abs(sinAz) > 1) {
        // Inclination below site latitude — launch due east, pay a plane change.
        return {
            azimuthRad: Math.PI / 2,
            achievable: false,
            minInclinationDeg,
            residualPlaneChangeDeg: minInclinationDeg - targetIncDeg,
        };
    }

    return {
        azimuthRad: Math.asin(sinAz),
        achievable: true,
        minInclinationDeg,
        residualPlaneChangeDeg: 0,
    };
}

// ── C. Earth rotation assist ──────────────────────────────────────────────────

/**
 * Velocity contributed by Earth's rotation along the launch azimuth.
 *
 *   v_rot = ω · R · cos(φ) · sin(A)
 *
 * Due east gives the full bonus, polar gives ~0, retrograde gives a penalty
 * (negative return value).
 */
export function rotationAssistMps(
    latitudeDeg: number,
    azimuthRad: number
): number {
    const latRad = degToRad(latitudeDeg);
    return (
        EARTH_ROTATION_RATE_RAD_S *
        EARTH_RADIUS_M *
        Math.cos(latRad) *
        Math.sin(azimuthRad)
    );
}

// ── D. Plane change ───────────────────────────────────────────────────────────

/**
 * Impulsive plane change delta-v: Δv = 2 · v · sin(Δi/2).
 * Perform this at the highest available radius, where v is smallest.
 */
export function planeChangeDeltaVMps(
    velocityAtBurnMps: number,
    deltaIncDeg: number
): number {
    if (deltaIncDeg <= 0) return 0;
    return 2 * velocityAtBurnMps * Math.sin(degToRad(deltaIncDeg) / 2);
}

// ── Vehicle-dependent ascent losses ───────────────────────────────────────────

/**
 * Gravity loss estimate scaled by liftoff thrust-to-weight ratio.
 * Higher TWR burns through the gravity well faster and loses less.
 * Falls back to the baseline when thrust is not specified.
 */
export function gravityLossMps(
    wetMassKg: number,
    thrustN?: number
): number {
    if (!thrustN || !Number.isFinite(thrustN) || thrustN <= 0) {
        return BASELINE_GRAVITY_LOSS_MPS;
    }
    const twr = thrustN / (wetMassKg * G0);
    if (twr <= 1) {
        // Cannot lift off; return a deliberately punitive value.
        return 2_400;
    }
    const scaled =
        BASELINE_GRAVITY_LOSS_MPS * Math.pow(BASELINE_TWR / twr, 0.8);
    return Math.min(2_400, Math.max(1_000, scaled));
}

/**
 * Drag loss estimate scaled by vehicle mass as a ballistic-coefficient proxy.
 * Small launchers carry a worse mass-to-frontal-area ratio and lose more.
 */
export function dragLossMps(wetMassKg: number): number {
    validatePositiveFinite(wetMassKg, "wet mass");
    const scaled =
        BASELINE_DRAG_LOSS_MPS *
        Math.pow(BASELINE_DRAG_MASS_KG / wetMassKg, 0.15);
    return Math.min(320, Math.max(120, scaled));
}

/**
 * Steering loss estimate. Grows modestly with dogleg severity, since a
 * non-due-east azimuth costs extra attitude authority during ascent.
 */
export function steeringLossMps(azimuthRad: number): number {
    const doglegFromEast = Math.abs(Math.PI / 2 - azimuthRad);
    return 200 + 120 * Math.sin(Math.min(doglegFromEast, Math.PI / 2));
}

// ── E. Sidereal time ──────────────────────────────────────────────────────────

/**
 * Greenwich Mean Sidereal Time (radians) for a UTC instant.
 * Used to place a launch site into the ECI frame so that launch date
 * actually rotates the trajectory.
 */
export function gmstRad(dateUtc: Date | string): number {
    const date = typeof dateUtc === "string" ? new Date(dateUtc) : dateUtc;
    if (isNaN(date.getTime())) {
        throw new RangeError(`[MissionControl] Invalid GMST date: ${dateUtc}`);
    }
    const jd = date.getTime() / 86_400_000 + 2_440_587.5;
    const d = jd - 2_451_545.0;
    const gmstHours = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    return (gmstHours * Math.PI) / 12;
}

/**
 * Convert a geodetic launch site to an ECI position vector at a given time.
 * Returns components in METERS.
 */
export function launchSiteEciM(
    latitudeDeg: number,
    longitudeDeg: number,
    dateUtc: Date | string,
    elevationM: number = 0
): { x: number; y: number; z: number } {
    const latRad = degToRad(latitudeDeg);
    const raRad = degToRad(longitudeDeg) + gmstRad(dateUtc);
    const r = EARTH_RADIUS_M + elevationM;
    return {
        x: r * Math.cos(latRad) * Math.cos(raRad),
        y: r * Math.cos(latRad) * Math.sin(raRad),
        z: r * Math.sin(latRad),
    };
}
