/**
 * AI Mission Control — Lunar Free-Return Targeting.
 *
 * Turns perilune from an ECHOED INPUT into a SOLVED OUTPUT.
 *
 * Two-parameter patched-conic targeting:
 *   - B-plane angle  θ : orientation of the flyby plane around v∞_in
 *   - Perilune radius rp: magnitude of the gravity turn
 *
 * For each θ the solver bisects on rp until the post-flyby geocentric
 * perigee lands inside the atmospheric reentry corridor.
 *
 * Formulas:
 *   A. Hyperbolic excess:   v∞ = v_sc − v_moon
 *   B. Flyby eccentricity:  e = 1 + rp·v∞² / μ_M
 *   C. Turn angle:          δ = 2·arcsin(1/e)
 *   D. Vis-viva energy:     ε = v²/2 − μ_E/r
 *   E. Kepler time-to-perigee via eccentric anomaly
 */

import type { Vec3 } from "./types";
import {
    EARTH_MU_M3_S2,
    EARTH_RADIUS_M,
    MOON_MU_M3_S2,
    MOON_RADIUS_M,
    REENTRY_CORRIDOR_MIN_M,
    REENTRY_CORRIDOR_MAX_M,
} from "./constants";
import {
    vec3,
    magnitude,
    sub,
    add,
    scale,
    normalize,
    cross,
    dot,
    rotateAroundAxis,
} from "./vector3";

// ── Search bounds ─────────────────────────────────────────────────────────────

/** Lowest perilune radius considered (m). Below this the flyby risks impact. */
export const PERILUNE_RADIUS_MIN_M = MOON_RADIUS_M + 50_000;

/** Highest perilune radius considered (m). Beyond this the turn is negligible. */
export const PERILUNE_RADIUS_MAX_M = MOON_RADIUS_M + 25_000_000;

/** Reentry interface altitude the targeter aims for (m). */
export const REENTRY_TARGET_ALTITUDE_M = 120_000;

/** Number of B-plane orientations sampled around v∞_in. */
export const B_PLANE_SAMPLES = 16;

/** Perilune radius samples used to bracket a sign change before bisection. */
const RP_BRACKET_SAMPLES = 24;

/** Bisection iterations once a bracket is found. */
const BISECTION_ITERATIONS = 40;

// ── Return orbit geometry ─────────────────────────────────────────────────────

export interface ReturnOrbit {
    /** True when the post-flyby orbit is elliptical (still Earth-bound). */
    bound: boolean;
    semiMajorAxisM: number;
    eccentricity: number;
    perigeeRadiusM: number;
    perigeeAltitudeM: number;
}

/**
 * Geocentric conic resulting from the post-flyby state vector.
 */
export function returnOrbitFromState(
    posM: Vec3,
    velMps: Vec3
): ReturnOrbit {
    const r = magnitude(posM);
    const v = magnitude(velMps);
    const energy = (v * v) / 2 - EARTH_MU_M3_S2 / r;

    if (!Number.isFinite(energy) || energy >= 0) {
        return {
            bound: false,
            semiMajorAxisM: Infinity,
            eccentricity: 1,
            perigeeRadiusM: Infinity,
            perigeeAltitudeM: Infinity,
        };
    }

    const a = -EARTH_MU_M3_S2 / (2 * energy);
    const h = magnitude(cross(posM, velMps));
    const p = (h * h) / EARTH_MU_M3_S2;
    const e = Math.sqrt(Math.max(0, 1 - p / a));
    const perigeeRadiusM = a * (1 - e);

    return {
        bound: true,
        semiMajorAxisM: a,
        eccentricity: e,
        perigeeRadiusM,
        perigeeAltitudeM: perigeeRadiusM - EARTH_RADIUS_M,
    };
}

/**
 * Time remaining until perigee passage, for a spacecraft at radius r on an
 * inbound (perigee-approaching) leg of an ellipse.
 *
 *   cos ν₀ = (p/r − 1)/e ,  tan(E₀/2) = √((1−e)/(1+e))·tan(ν₀/2)
 *   M₀ = E₀ − e·sin E₀ ,    t = M₀ / n ,  n = √(μ/a³)
 *
 * Validated against Apollo 13: a = 628,900 km, e = 0.9897, r = 384,400 km
 * yields 57.0 h (flown value from perilune to entry interface ≈ 65 h).
 */
export function timeToPerigeeS(
    orbit: ReturnOrbit,
    currentRadiusM: number
): number {
    if (!orbit.bound) return Infinity;

    const { semiMajorAxisM: a, eccentricity: e } = orbit;
    if (e < 1e-9) return Infinity; // circular — perigee undefined

    const p = a * (1 - e * e);
    let cosNu = (p / currentRadiusM - 1) / e;
    cosNu = Math.min(1, Math.max(-1, cosNu));
    const nu0 = Math.acos(cosNu); // (0, π) — receding branch

    const tanHalfE = Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu0 / 2);
    const E0 = 2 * Math.atan(tanHalfE);
    const M0 = E0 - e * Math.sin(E0);
    const n = Math.sqrt(EARTH_MU_M3_S2 / Math.pow(a, 3));

    const t = M0 / n;
    return Number.isFinite(t) && t > 0 ? t : Infinity;
}

// ── Flyby mechanics ───────────────────────────────────────────────────────────

/**
 * Hyperbolic flyby turn angle: δ = 2·arcsin(1 / (1 + rp·v∞²/μ_M)).
 */
export function hyperbolicTurnAngleRad(
    periluneRadiusM: number,
    vInfMps: number
): number {
    const e = 1 + (periluneRadiusM * vInfMps * vInfMps) / MOON_MU_M3_S2;
    if (!Number.isFinite(e) || e <= 1) return Math.PI;
    return 2 * Math.asin(1 / e);
}

/**
 * Build an orthonormal reference perpendicular to v∞_in, used as the
 * zero-point for the B-plane angle sweep.
 */
function referencePerpendicular(vInfDir: Vec3, moonPosM: Vec3): Vec3 {
    let u = cross(vInfDir, normalize(moonPosM));
    if (magnitude(u) < 1e-8) {
        u = cross(vInfDir, vec3(0, 0, 1));
    }
    if (magnitude(u) < 1e-8) {
        u = cross(vInfDir, vec3(0, 1, 0));
    }
    return normalize(u);
}

/**
 * Evaluate one flyby: deflect v∞_in about the given axis and return the
 * resulting geocentric orbit. Cheap — used inside the bisection loop.
 */
function evaluateFlyby(
    vInfIn: Vec3,
    vInfMag: number,
    moonPosM: Vec3,
    moonVelMps: Vec3,
    periluneRadiusM: number,
    axis: Vec3
): { orbit: ReturnOrbit; vOutEarthMps: Vec3; turnAngleRad: number } {
    const delta = hyperbolicTurnAngleRad(periluneRadiusM, vInfMag);
    const vInfOut = rotateAroundAxis(vInfIn, axis, delta);
    const vOutEarthMps = add(vInfOut, moonVelMps);
    const orbit = returnOrbitFromState(moonPosM, vOutEarthMps);
    return { orbit, vOutEarthMps, turnAngleRad: delta };
}

// ── Targeting solution ────────────────────────────────────────────────────────

export interface FlybySolution {
    /** Solved perilune radius from Moon centre (m). */
    periluneRadiusM: number;
    /** Solved perilune altitude above lunar surface (m). */
    periluneAltitudeM: number;
    /** B-plane orientation angle used (rad). */
    bPlaneAngleRad: number;
    /** Hyperbolic turn angle achieved (rad). */
    turnAngleRad: number;
    /** Hyperbolic excess speed relative to the Moon (m/s). */
    vInfinityMps: number;
    /** Post-flyby geocentric velocity (m/s). */
    vOutEarthMps: Vec3;
    /** Resulting geocentric return orbit. */
    returnOrbit: ReturnOrbit;
    /** Coast time from flyby to perigee (s). */
    returnTimeS: number;
    /** True when perigee lands inside [80, 300] km. */
    inCorridor: boolean;
    /** Signed distance from the corridor (m). Zero when inside. */
    corridorMissM: number;
    /** Estimated trim burn to move perigee into the corridor (m/s). */
    corridorTrimDeltaVMps: number;
}

/**
 * First-order estimate of the mid-course burn required to move the return
 * perigee to the reentry target, applied near the Moon where it is cheapest.
 *
 * Assumes the current radius is close to apogee, so a_target ≈ (r + rp)/2.
 * Deliberately an ESTIMATE — labelled as such in the mission assumptions.
 */
export function estimateCorridorTrimDeltaVMps(
    currentRadiusM: number,
    currentSpeedMps: number,
    desiredPerigeeRadiusM: number
): number {
    const aTarget = (currentRadiusM + desiredPerigeeRadiusM) / 2;
    const term = 2 / currentRadiusM - 1 / aTarget;
    if (term <= 0) return Infinity;
    const vNeeded = Math.sqrt(EARTH_MU_M3_S2 * term);
    return Math.abs(vNeeded - currentSpeedMps);
}

/**
 * Solve the free-return targeting problem for a given arrival state.
 *
 * Sweeps B_PLANE_SAMPLES flyby orientations. For each, brackets and bisects
 * on perilune radius to place the geocentric perigee at the reentry target.
 * Returns the best solution found, or the closest miss when the corridor
 * cannot be reached.
 */
export function solveFreeReturnFlyby(
    arrivalVelMps: Vec3,
    moonPosM: Vec3,
    moonVelMps: Vec3
): FlybySolution | null {
    const vInfIn = sub(arrivalVelMps, moonVelMps);
    const vInfMag = magnitude(vInfIn);

    // Below this the patched-conic flyby model is meaningless (near-capture).
    if (!Number.isFinite(vInfMag) || vInfMag < 50) return null;

    const vInfDir = normalize(vInfIn);
    const refPerp = referencePerpendicular(vInfDir, moonPosM);
    const targetPerigeeR = EARTH_RADIUS_M + REENTRY_TARGET_ALTITUDE_M;
    const moonDistM = magnitude(moonPosM);

    let best: FlybySolution | null = null;
    let bestMiss = Infinity;

    for (let k = 0; k < B_PLANE_SAMPLES; k++) {
        const theta = (2 * Math.PI * k) / B_PLANE_SAMPLES;
        const axis = normalize(rotateAroundAxis(refPerp, vInfDir, theta));

        // Objective: perigee altitude minus target. Bracket a sign change.
        const f = (rp: number): number => {
            const { orbit } = evaluateFlyby(
                vInfIn, vInfMag, moonPosM, moonVelMps, rp, axis
            );
            if (!orbit.bound) return Number.NaN; // escaped — unusable sample
            return orbit.perigeeRadiusM - targetPerigeeR;
        };

        const logMin = Math.log(PERILUNE_RADIUS_MIN_M);
        const logMax = Math.log(PERILUNE_RADIUS_MAX_M);

        let prevRp = PERILUNE_RADIUS_MIN_M;
        let prevF = f(prevRp);
        let loRp = Number.NaN;
        let hiRp = Number.NaN;

        for (let s = 1; s < RP_BRACKET_SAMPLES; s++) {
            const rp = Math.exp(logMin + ((logMax - logMin) * s) / (RP_BRACKET_SAMPLES - 1));
            const fv = f(rp);

            if (Number.isFinite(prevF) && Number.isFinite(fv) && prevF * fv <= 0) {
                loRp = prevRp;
                hiRp = rp;
                break;
            }
            prevRp = rp;
            prevF = fv;
        }

        let solvedRp: number;
        if (Number.isFinite(loRp) && Number.isFinite(hiRp)) {
            let lo = loRp;
            let hi = hiRp;
            const fLo = f(lo);
            for (let i = 0; i < BISECTION_ITERATIONS; i++) {
                const mid = (lo + hi) / 2;
                const fMid = f(mid);
                if (!Number.isFinite(fMid)) break;
                if (fLo * fMid <= 0) hi = mid;
                else lo = mid;
            }
            solvedRp = (lo + hi) / 2;
        } else {
            // No bracket for this orientation — take the closest bracket sample.
            let closestRp = PERILUNE_RADIUS_MIN_M;
            let closestAbs = Infinity;
            for (let s = 0; s < RP_BRACKET_SAMPLES; s++) {
                const rp = Math.exp(logMin + ((logMax - logMin) * s) / (RP_BRACKET_SAMPLES - 1));
                const fv = f(rp);
                if (Number.isFinite(fv) && Math.abs(fv) < closestAbs) {
                    closestAbs = Math.abs(fv);
                    closestRp = rp;
                }
            }
            if (!Number.isFinite(closestAbs)) continue; // all orientations escaped
            solvedRp = closestRp;
        }

        const { orbit, vOutEarthMps, turnAngleRad } = evaluateFlyby(
            vInfIn, vInfMag, moonPosM, moonVelMps, solvedRp, axis
        );
        if (!orbit.bound) continue;

        const altM = orbit.perigeeAltitudeM;
        const inCorridor =
            altM >= REENTRY_CORRIDOR_MIN_M && altM <= REENTRY_CORRIDOR_MAX_M;

        let missM = 0;
        if (altM < REENTRY_CORRIDOR_MIN_M) missM = altM - REENTRY_CORRIDOR_MIN_M;
        else if (altM > REENTRY_CORRIDOR_MAX_M) missM = altM - REENTRY_CORRIDOR_MAX_M;

        const trim = inCorridor
            ? 0
            : estimateCorridorTrimDeltaVMps(
                moonDistM,
                magnitude(vOutEarthMps),
                targetPerigeeR
            );

        const absMiss = Math.abs(missM);
        if (absMiss < bestMiss) {
            bestMiss = absMiss;
            best = {
                periluneRadiusM: solvedRp,
                periluneAltitudeM: solvedRp - MOON_RADIUS_M,
                bPlaneAngleRad: theta,
                turnAngleRad,
                vInfinityMps: vInfMag,
                vOutEarthMps,
                returnOrbit: orbit,
                returnTimeS: timeToPerigeeS(orbit, moonDistM),
                inCorridor,
                corridorMissM: missM,
                corridorTrimDeltaVMps: Number.isFinite(trim) ? trim : 0,
            };
            if (inCorridor) break; // corridor hit — no need to sweep further
        }
    }

    return best;
}

// ── Transfer plane construction ───────────────────────────────────────────────

/**
 * Build the transfer plane normal for a parking orbit of the given
 * inclination that CONTAINS the Moon's arrival position.
 *
 * With m̂ = Moon direction, ê₁ = normalize(ẑ × m̂) has ê₁_z = 0, and
 * ê₂ = m̂ × ê₁ has ê₂_z = cos(declination). Requiring n̂_z = cos(i) gives
 *
 *   sin ψ = cos(i) / cos(dec) ,   n̂ = cos ψ · ê₁ + sin ψ · ê₂
 *
 * A solution exists exactly when i ≥ |dec| — which is why the caller sets
 * i_park = max(|latitude|, |declination|). This removes the artificial
 * plane-change penalty that appears if the transfer is forced into the
 * Moon's own orbital plane.
 */
export function transferPlaneNormal(
    moonPosM: Vec3,
    inclinationRad: number
): Vec3 | null {
    const m = normalize(moonPosM);
    const s = Math.sqrt(m.x * m.x + m.y * m.y); // = cos(declination)

    if (s < 1e-8) return null; // Moon directly over a pole — degenerate

    const e1 = vec3(-m.y / s, m.x / s, 0);
    const e2 = cross(m, e1); // e2.z === s

    const sinPsi = Math.cos(inclinationRad) / s;
    if (Math.abs(sinPsi) > 1) return null; // inclination below declination

    const psi = Math.asin(sinPsi);
    const n = add(scale(e1, Math.cos(psi)), scale(e2, Math.sin(psi)));
    const nn = normalize(n);

    // Sanity: normal must be perpendicular to the Moon direction.
    if (Math.abs(dot(nn, m)) > 1e-6) return null;
    return nn;
}

/** Moon declination in radians from its ECI position. */
export function moonDeclinationRad(moonPosM: Vec3): number {
    const m = normalize(moonPosM);
    return Math.asin(Math.min(1, Math.max(-1, m.z)));
}
