/**
 * AI Mission Control — Lunar Three-Body Propagator & Free-Return Corrector.
 *
 * Replaces the Bézier rendering geometry with an integrated trajectory.
 *
 * Dynamics (Earth-centred, non-inertial):
 *
 *   a = -mu_E * r/|r|^3
 *       - mu_M * (r - r_M)/|r - r_M|^3      direct lunar attraction
 *       - mu_M * r_M/|r_M|^3                indirect term
 *
 * The indirect term exists because the Moon also pulls Earth, so an
 * Earth-centred frame is accelerating. Its magnitude at mean lunar distance is
 * mu_M/|r_M|^2 = 3.3e-5 m/s^2; dropping it biases a 6-day trajectory by
 * thousands of km and is a common silent error.
 *
 * Nothing here is tuned for appearance: perilune, return perigee and duration
 * are all outputs of the integration, driven by the departure state and the
 * real lunar ephemeris.
 */

import type { Vec3, TrajectoryPoint, MissionEvent } from "./types";
import {
    EARTH_MU_M3_S2,
    EARTH_RADIUS_M,
    MOON_MU_M3_S2,
    MOON_RADIUS_M,
} from "./constants";
import {
    add,
    sub,
    scale,
    dot,
    cross,
    magnitude,
    normalize,
} from "./vector3";
import { getMoonPositionEciM, getMoonVelocityEciMps } from "./ephemeris";

/** Lunar sphere of influence used for phase labelling (m). */
export const MOON_SOI_RADIUS_M = 66_100_000;

/** Ephemeris cache spacing (s). Hermite error at this spacing is < 1 mm. */
const EPHEMERIS_SAMPLE_S = 1_800;

/** Integrator step bounds (s). */
const DT_MIN_S = 1;
const DT_MAX_S = 600;

/** Step is this fraction of the shortest local orbital period. */
const DT_PERIOD_FRACTION = 0.002;

/** Sub-steps used when refining a closest-approach event. */
const REFINE_SUBSTEPS = 64;

// ── Moon ephemeris cache ──────────────────────────────────────────────────────

/**
 * Cubic-Hermite cache over the lunar ephemeris. Calling astronomy-engine at
 * every RK4 stage would dominate runtime, so exact positions AND velocities
 * are sampled every EPHEMERIS_SAMPLE_S and interpolated. Because both value
 * and derivative are exact at the nodes, the interpolant is C1 continuous —
 * important, since a kinked perturbing acceleration would corrupt RK4.
 */
class MoonEphemerisCache {
    private readonly baseMs: number;
    private readonly stepMs: number;
    private readonly pos: Vec3[] = [];
    private readonly vel: Vec3[] = [];

    constructor(startMs: number, spanS: number) {
        this.stepMs = EPHEMERIS_SAMPLE_S * 1000;
        this.baseMs = startMs - this.stepMs; // pad so we never extrapolate
        const count = Math.ceil((spanS * 1000) / this.stepMs) + 4;
        for (let i = 0; i < count; i++) {
            const t = new Date(this.baseMs + i * this.stepMs);
            this.pos.push(getMoonPositionEciM(t));
            this.vel.push(getMoonVelocityEciMps(t));
        }
    }

    positionAt(tMs: number): Vec3 {
        const x = (tMs - this.baseMs) / this.stepMs;
        let i = Math.floor(x);
        if (i < 0) i = 0;
        if (i > this.pos.length - 2) i = this.pos.length - 2;

        const s = x - i;
        const h = this.stepMs / 1000;
        const s2 = s * s;
        const s3 = s2 * s;
        const h00 = 2 * s3 - 3 * s2 + 1;
        const h10 = s3 - 2 * s2 + s;
        const h01 = -2 * s3 + 3 * s2;
        const h11 = s3 - s2;

        const p0 = this.pos[i];
        const p1 = this.pos[i + 1];
        const v0 = this.vel[i];
        const v1 = this.vel[i + 1];

        return {
            x: h00 * p0.x + h10 * h * v0.x + h01 * p1.x + h11 * h * v1.x,
            y: h00 * p0.y + h10 * h * v0.y + h01 * p1.y + h11 * h * v1.y,
            z: h00 * p0.z + h10 * h * v0.z + h01 * p1.z + h11 * h * v1.z,
        };
    }
}

// ── Dynamics ──────────────────────────────────────────────────────────────────

function acceleration(posM: Vec3, moonPosM: Vec3): Vec3 {
    const r = magnitude(posM);
    const rel = sub(posM, moonPosM);
    const dRel = magnitude(rel);
    const dMoon = magnitude(moonPosM);

    const kE = -EARTH_MU_M3_S2 / (r * r * r);
    const kM = -MOON_MU_M3_S2 / (dRel * dRel * dRel);
    const kI = -MOON_MU_M3_S2 / (dMoon * dMoon * dMoon);

    return {
        x: kE * posM.x + kM * rel.x + kI * moonPosM.x,
        y: kE * posM.y + kM * rel.y + kI * moonPosM.y,
        z: kE * posM.z + kM * rel.z + kI * moonPosM.z,
    };
}

/**
 * Step size from the shortest local orbital timescale, so the integrator
 * automatically refines near Earth and near perilune without any hand-tuned
 * schedule.
 */
function stepSizeS(rEarthM: number, rMoonM: number): number {
    const tE = 2 * Math.PI * Math.sqrt(Math.pow(rEarthM, 3) / EARTH_MU_M3_S2);
    const tM = 2 * Math.PI * Math.sqrt(Math.pow(rMoonM, 3) / MOON_MU_M3_S2);
    const dt = DT_PERIOD_FRACTION * Math.min(tE, tM);
    return Math.min(Math.max(dt, DT_MIN_S), DT_MAX_S);
}

interface State {
    pos: Vec3;
    vel: Vec3;
}

function rk4Step(
    st: State,
    tMs: number,
    dtS: number,
    eph: MoonEphemerisCache
): State {
    const mStart = eph.positionAt(tMs);
    const mMid = eph.positionAt(tMs + dtS * 500);
    const mEnd = eph.positionAt(tMs + dtS * 1000);

    const a1 = acceleration(st.pos, mStart);
    const v2 = add(st.vel, scale(a1, dtS / 2));
    const a2 = acceleration(add(st.pos, scale(st.vel, dtS / 2)), mMid);
    const v3 = add(st.vel, scale(a2, dtS / 2));
    const a3 = acceleration(add(st.pos, scale(v2, dtS / 2)), mMid);
    const v4 = add(st.vel, scale(a3, dtS));
    const a4 = acceleration(add(st.pos, scale(v3, dtS)), mEnd);

    const dPos = scale(add(add(st.vel, scale(add(v2, v3), 2)), v4), dtS / 6);
    const dVel = scale(add(add(a1, scale(add(a2, a3), 2)), a4), dtS / 6);

    return { pos: add(st.pos, dPos), vel: add(st.vel, dVel) };
}

// ── Propagation ───────────────────────────────────────────────────────────────

export interface LunarPropagationOptions {
    /** Hard stop on integration time (s). */
    maxDurationS?: number;
    /** Approximate number of trajectory points to emit. */
    targetSamples?: number;
    /** Skip point collection — used by the corrector's inner iterations. */
    collectPoints?: boolean;
    /** Altitude at which the return leg is declared to have reached entry (m). */
    reentryAltitudeM?: number;
}

export interface LunarPropagationResult {
    points: TrajectoryPoint[];
    events: MissionEvent[];
    /** Integrated perilune altitude above the lunar surface (km). */
    periluneAltitudeKm: number;
    periluneUtc: string;
    /** Integrated geocentric perigee altitude on the return leg (km). */
    returnPerigeeAltitudeKm: number;
    returnPerigeeUtc: string;
    /** True when the path intersected the lunar surface. */
    impactedMoon: boolean;
    /** True when a return perigee was actually found. */
    returnFound: boolean;
    maxGeocentricDistanceKm: number;
    durationHours: number;
    steps: number;
}

export function propagateLunarTrajectory(
    departurePosM: Vec3,
    departureVelMps: Vec3,
    departureUtc: string,
    options: LunarPropagationOptions = {}
): LunarPropagationResult {
    const maxDurationS = options.maxDurationS ?? 12 * 86_400;
    const targetSamples = options.targetSamples ?? 600;
    const collect = options.collectPoints ?? true;
    const reentryAltM = options.reentryAltitudeM ?? 120_000;

    const t0Ms = new Date(departureUtc).getTime();
    const eph = new MoonEphemerisCache(t0Ms, maxDurationS);

    const points: TrajectoryPoint[] = [];
    const events: MissionEvent[] = [];

    let st: State = { pos: departurePosM, vel: departureVelMps };
    let tS = 0;
    let steps = 0;

    let perilunePassed = false;
    let periluneDistM = Infinity;
    let perilunePos: Vec3 = st.pos;
    let periluneTS = 0;

    let perigeeAltM = Infinity;
    let perigeePos: Vec3 = st.pos;
    let perigeeTS = 0;
    let returnFound = false;

    let impactedMoon = false;
    let maxRM = magnitude(st.pos);

    const outputIntervalS = maxDurationS / targetSamples;
    let nextOutputS = 0;

    const toKm = (v: Vec3): Vec3 => ({
        x: v.x / 1000,
        y: v.y / 1000,
        z: v.z / 1000,
    });

    const phaseAt = (rM: number, dRelM: number): TrajectoryPoint["phase"] => {
        if (dRelM <= MOON_SOI_RADIUS_M) return "lunar_flyby";
        if (!perilunePassed) {
            // Display convention: the first Earth radius of climb is shown as the
            // TLI segment. It carries no physical meaning beyond labelling.
            return rM < 2 * EARTH_RADIUS_M ? "tli" : "outbound";
        }
        return rM < EARTH_RADIUS_M + 2_000_000 ? "reentry_interface" : "return";
    };

    const emit = (state: State, timeS: number): void => {
        if (!collect) return;
        const rM = magnitude(state.pos);
        const dRel = magnitude(sub(state.pos, eph.positionAt(t0Ms + timeS * 1000)));
        points.push({
            timestampUtc: new Date(t0Ms + timeS * 1000).toISOString(),
            positionEciKm: toKm(state.pos),
            velocityEciKmS: toKm(state.vel),
            altitudeKm: (rM - EARTH_RADIUS_M) / 1000,
            phase: phaseAt(rM, dRel),
        });
    };

    emit(st, 0);
    nextOutputS = outputIntervalS;

    events.push({
        type: "tli_burn",
        timestampUtc: new Date(t0Ms).toISOString(),
        label: "Trans-Lunar Injection",
        positionEciKm: toKm(st.pos),
    });

    let prevRelRate = dot(
        sub(st.pos, eph.positionAt(t0Ms)),
        sub(st.vel, getMoonVelocityEciMps(new Date(t0Ms)))
    );
    let prevRadialRate = dot(st.pos, st.vel);

    while (tS < maxDurationS) {
        const moonPos = eph.positionAt(t0Ms + tS * 1000);
        const rM = magnitude(st.pos);
        const dRel = magnitude(sub(st.pos, moonPos));

        if (dRel < MOON_RADIUS_M) {
            impactedMoon = true;
            periluneDistM = Math.min(periluneDistM, dRel);
            break;
        }

        const dtS = stepSizeS(rM, dRel);
        const prev = st;
        const prevTS = tS;

        st = rk4Step(st, t0Ms + tS * 1000, dtS, eph);
        tS += dtS;
        steps++;

        const newMoonPos = eph.positionAt(t0Ms + tS * 1000);
        const newRel = sub(st.pos, newMoonPos);
        const newRM = magnitude(st.pos);
        if (newRM > maxRM) maxRM = newRM;

        // Closest lunar approach: d/dt |r - r_M| changes sign from - to +.
        const moonVel = getMoonVelocityEciMps(new Date(t0Ms + tS * 1000));
        const relRate = dot(newRel, sub(st.vel, moonVel));
        if (!perilunePassed && prevRelRate < 0 && relRate >= 0) {
            const refined = refineClosestApproach(prev, prevTS, dtS, t0Ms, eph, true);
            periluneDistM = refined.distanceM;
            perilunePos = refined.state.pos;
            periluneTS = refined.timeS;
            perilunePassed = true;

            events.push({
                type: "lunar_closest_approach",
                timestampUtc: new Date(t0Ms + periluneTS * 1000).toISOString(),
                label: `Perilune — ${Math.round(
                    (periluneDistM - MOON_RADIUS_M) / 1000
                )} km altitude`,
                positionEciKm: toKm(perilunePos),
            });
            emit(refined.state, periluneTS);
        }
        prevRelRate = relRate;

        // Return perigee: d/dt |r| changes sign from - to +, after perilune.
        const radialRate = dot(st.pos, st.vel);
        if (perilunePassed && !returnFound && prevRadialRate < 0 && radialRate >= 0) {
            const refined = refineClosestApproach(prev, prevTS, dtS, t0Ms, eph, false);
            perigeeAltM = refined.distanceM - EARTH_RADIUS_M;
            perigeePos = refined.state.pos;
            perigeeTS = refined.timeS;
            returnFound = true;

            events.push({
                type: "earth_return_interface",
                timestampUtc: new Date(t0Ms + perigeeTS * 1000).toISOString(),
                label: `Earth Return Perigee — ${Math.round(perigeeAltM / 1000)} km`,
                positionEciKm: toKm(perigeePos),
            });
            emit(refined.state, perigeeTS);
            break;
        }
        prevRadialRate = radialRate;

        // Reentry reached before a perigee turnaround (steep entry).
        if (perilunePassed && newRM - EARTH_RADIUS_M < reentryAltM) {
            perigeeAltM = newRM - EARTH_RADIUS_M;
            perigeePos = st.pos;
            perigeeTS = tS;
            returnFound = true;
            events.push({
                type: "earth_return_interface",
                timestampUtc: new Date(t0Ms + tS * 1000).toISOString(),
                label: `Entry Interface — ${Math.round(perigeeAltM / 1000)} km`,
                positionEciKm: toKm(st.pos),
            });
            emit(st, tS);
            break;
        }

        if (tS >= nextOutputS) {
            emit(st, tS);
            nextOutputS += outputIntervalS;
        }
    }

    if (collect && points.length > 0) {
        emit(st, tS);
    }

    return {
        points,
        events,
        periluneAltitudeKm: (periluneDistM - MOON_RADIUS_M) / 1000,
        periluneUtc: new Date(t0Ms + periluneTS * 1000).toISOString(),
        returnPerigeeAltitudeKm: perigeeAltM / 1000,
        returnPerigeeUtc: new Date(t0Ms + perigeeTS * 1000).toISOString(),
        impactedMoon,
        returnFound,
        maxGeocentricDistanceKm: maxRM / 1000,
        durationHours: tS / 3600,
        steps,
    };
}

/**
 * Re-integrate one step with REFINE_SUBSTEPS sub-steps and return the state at
 * the true extremum, so the recorded perilune is not quantised to the
 * integrator step (which would be tens of km at 1 km/s).
 */
function refineClosestApproach(
    start: State,
    startTS: number,
    dtS: number,
    t0Ms: number,
    eph: MoonEphemerisCache,
    relativeToMoon: boolean
): { state: State; timeS: number; distanceM: number } {
    const sub_dt = dtS / REFINE_SUBSTEPS;
    let st = start;
    let tS = startTS;
    let best = { state: start, timeS: startTS, distanceM: Infinity };

    for (let i = 0; i <= REFINE_SUBSTEPS; i++) {
        const d = relativeToMoon
            ? magnitude(sub(st.pos, eph.positionAt(t0Ms + tS * 1000)))
            : magnitude(st.pos);
        if (d < best.distanceM) best = { state: st, timeS: tS, distanceM: d };
        st = rk4Step(st, t0Ms + tS * 1000, sub_dt, eph);
        tS += sub_dt;
    }
    return best;
}

// ── Free-return differential corrector ───────────────────────────────────────

export interface FreeReturnCorrection {
    converged: boolean;
    iterations: number;
    /** Corrected departure velocity (m/s). */
    departureVelMps: Vec3;
    /** Extra delta-v the correction costs versus the raw Lambert arc (m/s). */
    correctionDeltaVMps: number;
    /** Perilune altitude residual against the requested value (km). */
    periluneResidualKm: number;
    /** Return perigee residual against the reentry target (km). */
    perigeeResidualKm: number;
    propagation: LunarPropagationResult;
}

const CORRECTOR_MAX_ITERATIONS = 10;
const CORRECTOR_FD_STEP_MPS = 0.5;
const CORRECTOR_MAX_TOTAL_MPS = 400;
const CORRECTOR_TOLERANCE_M = 5_000;

/**
 * Two-variable shooting method.
 *
 * A Lambert arc aimed at the Moon's CENTRE is an impact trajectory, so the
 * departure velocity must be corrected before it becomes a flyby. Free
 * variables are two velocity components perpendicular to the departure
 * velocity — the cheapest way to move the arrival aim point over a
 * 384,000 km lever arm. Targets are the requested perilune altitude and the
 * reentry-corridor perigee.
 *
 * Stage 1 scans out-of-plane offset until the Moon is cleared, giving the
 * Newton iteration a starting point that is already a flyby rather than an
 * impact. Stage 2 is a finite-difference Newton on both targets.
 */
export function correctFreeReturn(
    departurePosM: Vec3,
    lambertVelMps: Vec3,
    departureUtc: string,
    targetPeriluneAltitudeM: number,
    targetReentryAltitudeM: number,
    maxDurationS: number = 12 * 86_400
): FreeReturnCorrection {
    const u1 = normalize(cross(lambertVelMps, departurePosM)); // out-of-plane
    const u2 = normalize(cross(lambertVelMps, u1)); // in-plane, perpendicular

    const velAt = (a: number, b: number): Vec3 =>
        add(lambertVelMps, add(scale(u1, a), scale(u2, b)));

    const run = (a: number, b: number, collectPoints: boolean) =>
        propagateLunarTrajectory(departurePosM, velAt(a, b), departureUtc, {
            maxDurationS,
            collectPoints,
            targetSamples: 600,
        });

    // Stage 1 — clear the Moon.
    let bestA = 0;
    let bestErr = Infinity;
    for (let i = -12; i <= 12; i++) {
        const a = i * 12; // m/s
        if (Math.abs(a) > CORRECTOR_MAX_TOTAL_MPS) continue;
        const p = run(a, 0, false);
        const altM = p.impactedMoon
            ? -Infinity
            : p.periluneAltitudeKm * 1000;
        const err = Math.abs(altM - targetPeriluneAltitudeM);
        if (Number.isFinite(err) && err < bestErr) {
            bestErr = err;
            bestA = a;
        }
    }

    // Stage 2 — Newton on (perilune, return perigee).
    let a = bestA;
    let b = 0;
    let converged = false;
    let iterations = 0;
    let current = run(a, b, false);

    const residuals = (p: LunarPropagationResult): [number, number] => [
        p.impactedMoon ? -1e9 : p.periluneAltitudeKm * 1000 - targetPeriluneAltitudeM,
        p.returnFound
            ? p.returnPerigeeAltitudeKm * 1000 - targetReentryAltitudeM
            : 1e9,
    ];

    for (let it = 0; it < CORRECTOR_MAX_ITERATIONS; it++) {
        iterations = it + 1;
        const [f1, f2] = residuals(current);

        if (Math.abs(f1) < CORRECTOR_TOLERANCE_M && Math.abs(f2) < CORRECTOR_TOLERANCE_M) {
            converged = true;
            break;
        }

        const h = CORRECTOR_FD_STEP_MPS;
        const [f1a, f2a] = residuals(run(a + h, b, false));
        const [f1b, f2b] = residuals(run(a, b + h, false));

        const j11 = (f1a - f1) / h;
        const j12 = (f1b - f1) / h;
        const j21 = (f2a - f2) / h;
        const j22 = (f2b - f2) / h;

        const det = j11 * j22 - j12 * j21;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;

        let da = (-f1 * j22 + f2 * j12) / det;
        let db = (-f2 * j11 + f1 * j21) / det;

        // Damping keeps the step inside the region where the Jacobian is valid.
        const stepMag = Math.hypot(da, db);
        const maxStep = 40;
        if (stepMag > maxStep) {
            da *= maxStep / stepMag;
            db *= maxStep / stepMag;
        }

        const na = a + da;
        const nb = b + db;
        if (Math.hypot(na, nb) > CORRECTOR_MAX_TOTAL_MPS) break;

        a = na;
        b = nb;
        current = run(a, b, false);
    }

    const final = run(a, b, true);
    const [r1, r2] = residuals(final);

    return {
        converged,
        iterations,
        departureVelMps: velAt(a, b),
        correctionDeltaVMps: Math.hypot(a, b),
        periluneResidualKm: r1 / 1000,
        perigeeResidualKm: r2 / 1000,
        propagation: final,
    };
}
