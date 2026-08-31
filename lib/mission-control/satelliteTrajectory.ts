/**
 * AI Mission Control — Satellite Mission Path Generator.
 *
 * Generates the full staged mission path in ONE orbital plane:
 *
 *   1. "launch" / "ascent"  — parametric gravity turn, pad → parking orbit
 *   2. "parking_orbit"      — one closed circular revolution
 *   3. "outbound"           — Hohmann transfer ellipse, perigee → apogee
 *   4. "parking_orbit"      — one closed revolution of the final orbit
 *
 * Every segment is produced by rotating the launch-site radius vector around a
 * single orbit normal h = r_site x d, where d is the launch azimuth direction.
 * Because h is shared by all segments, the parking orbit, the transfer ellipse
 * and the final orbit are strictly coplanar: on screen they render as nested
 * ellipses joined by the transfer arc, and the rings can never intersect.
 *
 * Inclination satisfies cos(i) = cos(phi) * sin(A) exactly, which is the
 * inverse of the azimuth relation solved in ascentModel.
 */

import type {
    SatelliteLaunchInput,
    TrajectoryPoint,
    MissionEvent,
    Vec3,
} from "./types";
import { EARTH_MU_M3_S2, EARTH_RADIUS_M } from "./constants";
import { kmToM, mToKm, degToRad } from "./units";
import {
    vec3,
    normalize,
    scale,
    add,
    cross,
    dot,
    magnitude,
    rotateAroundAxis,
} from "./vector3";
import { solveLaunchAzimuth, launchSiteEciM } from "./ascentModel";

export interface SatelliteTrajectoryResult {
    points: TrajectoryPoint[];
    events: MissionEvent[];
    /** Inclination of the ascent plane, acos(cos phi * sin A) (deg). */
    achievedInclinationDeg: number;
    /** Inclination of the final orbit, after any plane change (deg). */
    finalInclinationDeg: number;
    /** Central angle swept from the pad to parking insertion (deg). */
    downrangeAngleDeg: number;
    /** Liftoff → final-orbit insertion (s), excluding display revolutions. */
    timeToFinalOrbitS: number;
    /** |r_site . h| — must be ~0, proving the plane contains the launch site. */
    planeResidual: number;
}

const ASCENT_POINTS = 120;
const RING_POINTS = 120;
const TRANSFER_POINTS = 90;

const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

function inclinationDegOf(hHat: Vec3): number {
    return radToDeg(Math.acos(Math.max(-1, Math.min(1, hHat.z))));
}

export function generateSatelliteTrajectory(
    input: SatelliteLaunchInput,
    parkingAltitudeKm: number,
    ascentTimeS: number
): SatelliteTrajectoryResult {
    const points: TrajectoryPoint[] = [];
    const events: MissionEvent[] = [];

    const launchDate = new Date(input.launchDateUtc);
    const t0Ms = launchDate.getTime();

    const parkingR = EARTH_RADIUS_M + kmToM(parkingAltitudeKm);
    const targetR = EARTH_RADIUS_M + kmToM(input.targetAltitudeKm);
    const needsTransfer = targetR > parkingR + 1; // 1 m tolerance

    const toKm = (v: Vec3): Vec3 => ({
        x: mToKm(v.x),
        y: mToKm(v.y),
        z: mToKm(v.z),
    });

    const push = (
        posM: Vec3,
        timeMs: number,
        phase: TrajectoryPoint["phase"]
    ): void => {
        points.push({
            timestampUtc: new Date(timeMs).toISOString(),
            positionEciKm: toKm(posM),
            altitudeKm: mToKm(magnitude(posM) - EARTH_RADIUS_M),
            phase,
        });
    };

    // ── 1. Orbit plane from launch site + azimuth ────────────────────────────
    const siteM = launchSiteEciM(
        input.launchSite.latitudeDeg,
        input.launchSite.longitudeDeg,
        launchDate,
        input.launchSite.elevationM ?? 0
    );
    const sitePos = vec3(siteM.x, siteM.y, siteM.z);
    const rHatSite = normalize(sitePos);

    const northPole = vec3(0, 0, 1);
    const eastRaw = cross(northPole, rHatSite);
    const eastDir =
        magnitude(eastRaw) < 1e-9 ? vec3(0, 1, 0) : normalize(eastRaw);
    const northDir = normalize(cross(rHatSite, eastDir));

    const az = solveLaunchAzimuth(
        input.targetInclinationDeg,
        input.launchSite.latitudeDeg
    );
    const downrangeDir = normalize(
        add(
            scale(northDir, Math.cos(az.azimuthRad)),
            scale(eastDir, Math.sin(az.azimuthRad))
        )
    );

    // Orbit normal. Rotating r_site about +h moves it toward d (right-hand rule).
    const hHat = normalize(cross(rHatSite, downrangeDir));
    const planeResidual = Math.abs(dot(rHatSite, hHat));

    // ── 2. Ascent: pad → parking orbit ───────────────────────────────────────
    // Constant-acceleration proxy: the vehicle goes 0 → v_circ over the ascent,
    // so downrange distance ~ 0.5 * v_circ * t_ascent (about 1,900 km for a
    // 200 km parking orbit and an 8-minute ascent, matching real profiles).
    const vCircParking = Math.sqrt(EARTH_MU_M3_S2 / parkingR);
    const sweepRad = Math.min(
        (0.5 * vCircParking * ascentTimeS) / parkingR,
        Math.PI / 3
    );

    events.push({
        type: "liftoff",
        timestampUtc: launchDate.toISOString(),
        label: "Liftoff",
        positionEciKm: toKm(sitePos),
    });

    const pitchOverIndex = Math.floor(0.12 * ASCENT_POINTS);

    for (let i = 0; i <= ASCENT_POINTS; i++) {
        const t = i / ASCENT_POINTS;
        const timeMs = t0Ms + t * ascentTimeS * 1000;

        // Smoothstep altitude: dr/dt = 0 at both ends, so the vehicle levels off
        // exactly tangential at parking-orbit insertion.
        const altFrac = t * t * (3 - 2 * t);
        const r = EARTH_RADIUS_M + (parkingR - EARTH_RADIUS_M) * altFrac;

        // Downrange ~ t^2: vertical at liftoff, horizontal-dominant at insertion.
        const sweep = sweepRad * t * t;

        const pos = rotateAroundAxis(scale(rHatSite, r), hHat, sweep);
        // Phase boundary at the Kármón line (100 km): below it the vehicle is in
        // atmospheric flight, above it the gravity turn is exo-atmospheric. This is
        // a physical threshold, not an arbitrary fraction of the ascent.
        const altKm = mToKm(r - EARTH_RADIUS_M);
        const atmospheric = parkingAltitudeKm > 120 ? altKm < 100 : t < 0.5;
        push(pos, timeMs, atmospheric ? "launch" : "ascent");

        if (i === pitchOverIndex) {
            events.push({
                type: "pitch_over",
                timestampUtc: new Date(timeMs).toISOString(),
                label: "Pitch-Over Maneuver",
                positionEciKm: toKm(pos),
            });
        }
    }

    // ── 3. Parking orbit: one closed revolution ──────────────────────────────
    const rHatIns = rotateAroundAxis(rHatSite, hHat, sweepRad);
    const insertionMs = t0Ms + ascentTimeS * 1000;
    const parkingPeriodS =
        2 * Math.PI * Math.sqrt(Math.pow(parkingR, 3) / EARTH_MU_M3_S2);

    events.push({
        type: "orbit_insertion",
        timestampUtc: new Date(insertionMs).toISOString(),
        label: needsTransfer
            ? `Parking Orbit Insertion (${Math.round(parkingAltitudeKm)} km)`
            : `Orbit Insertion (${Math.round(input.targetAltitudeKm)} km)`,
        positionEciKm: toKm(scale(rHatIns, parkingR)),
    });

    // Loops below start at i = 1: the i = 0 sample coincides in time and place
    // with the last point of the previous segment, and duplicate timestamps
    // would fail the strict chronological-ordering check in trajectoryValidation.
    for (let i = 1; i <= RING_POINTS; i++) {
        const frac = i / RING_POINTS;
        const pos = rotateAroundAxis(
            scale(rHatIns, parkingR),
            hHat,
            frac * 2 * Math.PI
        );
        push(pos, insertionMs + frac * parkingPeriodS * 1000, "parking_orbit");
    }

    let timeToFinalOrbitS = ascentTimeS;
    let finalInclinationDeg = inclinationDegOf(hHat);

    // ── 4. Hohmann transfer + final orbit ────────────────────────────────────
    if (needsTransfer) {
        // The transfer burn happens after one parking revolution, so the transfer
        // perigee direction is r_ins.
        const burnMs = insertionMs + parkingPeriodS * 1000;

        const aT = (parkingR + targetR) / 2;
        const eT = (targetR - parkingR) / (targetR + parkingR);
        const nT = Math.sqrt(EARTH_MU_M3_S2 / Math.pow(aT, 3));
        const transferTimeS = Math.PI / nT; // half the ellipse period

        for (let i = 1; i <= TRANSFER_POINTS; i++) {
            // Sample eccentric anomaly E in [0, pi]: perigee → apogee.
            const E = (i / TRANSFER_POINTS) * Math.PI;
            const r = aT * (1 - eT * Math.cos(E));
            const nu =
                2 *
                Math.atan2(
                    Math.sqrt(1 + eT) * Math.sin(E / 2),
                    Math.sqrt(1 - eT) * Math.cos(E / 2)
                );
            // Kepler's equation: M = E - e*sin(E), t = M / n.
            const dtS = (E - eT * Math.sin(E)) / nT;

            const pos = rotateAroundAxis(scale(rHatIns, r), hHat, nu);
            push(pos, burnMs + dtS * 1000, "outbound");
        }

        const arrivalMs = burnMs + transferTimeS * 1000;
        const rHatApo = rotateAroundAxis(rHatIns, hHat, Math.PI);

        // A plane change, if needed, is performed at apogee: the position is
        // unchanged and the orbit normal rotates about that radius vector.
        let hFinal = hHat;
        if (!az.achievable && az.residualPlaneChangeDeg > 1e-6) {
            const di = degToRad(az.residualPlaneChangeDeg);
            const plus = normalize(rotateAroundAxis(hHat, rHatApo, di));
            const minus = normalize(rotateAroundAxis(hHat, rHatApo, -di));
            const errOf = (h: Vec3) =>
                Math.abs(inclinationDegOf(h) - input.targetInclinationDeg);
            hFinal = errOf(plus) <= errOf(minus) ? plus : minus;
        }
        finalInclinationDeg = inclinationDegOf(hFinal);

        events.push({
            type: "orbit_insertion",
            timestampUtc: new Date(arrivalMs).toISOString(),
            label: `Final Orbit Circularization (${Math.round(
                input.targetAltitudeKm
            )} km)`,
            positionEciKm: toKm(scale(rHatApo, targetR)),
        });

        const targetPeriodS =
            2 * Math.PI * Math.sqrt(Math.pow(targetR, 3) / EARTH_MU_M3_S2);

        for (let i = 1; i <= RING_POINTS; i++) {
            const frac = i / RING_POINTS;
            const pos = rotateAroundAxis(
                scale(rHatApo, targetR),
                hFinal,
                frac * 2 * Math.PI
            );
            push(pos, arrivalMs + frac * targetPeriodS * 1000, "parking_orbit");
        }

        timeToFinalOrbitS = ascentTimeS + parkingPeriodS + transferTimeS;
    }

    return {
        points,
        events,
        achievedInclinationDeg: inclinationDegOf(hHat),
        finalInclinationDeg,
        downrangeAngleDeg: radToDeg(sweepRad),
        timeToFinalOrbitS,
        planeResidual,
    };
}
