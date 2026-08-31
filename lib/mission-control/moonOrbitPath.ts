/**
 * AI Mission Control — Moon Orbit Ground Path.
 *
 * The Moon's orbit is NOT in Earth's equatorial plane: it is inclined between
 * 18.3 deg and 28.6 deg to the equator (5.145 deg to the ecliptic, which is
 * itself tilted 23.44 deg), varying over the 18.6-year nodal cycle. It is also
 * elliptical, ranging from about 356,500 km at perigee to 406,700 km at apogee.
 *
 * Rather than approximate it with a circle, this samples the real ephemeris
 * over one sidereal month so the rendered path passes exactly through the
 * Moon's plotted position by construction.
 */

import { getMoonPositionEciKm } from "./ephemeris";
import type { Vec3 } from "./types";

/** Sidereal month — the Moon's orbital period relative to the stars (days). */
export const SIDEREAL_MONTH_DAYS = 27.321661;

export interface MoonOrbitPath {
    points: Vec3[];
    perigeeKm: number;
    apogeeKm: number;
    /** Inclination of the osculating orbit plane to Earth's equator (deg). */
    inclinationDeg: number;
}

export function moonOrbitPathEciKm(
    epochUtc: Date | string,
    samples: number = 256
): MoonOrbitPath {
    const t0 = typeof epochUtc === "string" ? new Date(epochUtc) : epochUtc;
    const periodMs = SIDEREAL_MONTH_DAYS * 86_400_000;

    const points: Vec3[] = [];
    let perigeeKm = Infinity;
    let apogeeKm = 0;

    // Start one full period BEFORE the epoch so the path is closed and the
    // Moon's current position lies on it, not at a loose end.
    for (let i = 0; i <= samples; i++) {
        const t = new Date(t0.getTime() + (i / samples) * periodMs);
        const p = getMoonPositionEciKm(t);
        points.push(p);

        const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (r < perigeeKm) perigeeKm = r;
        if (r > apogeeKm) apogeeKm = r;
    }

    // Osculating plane normal from r x v, using a finite-difference velocity.
    const pA = getMoonPositionEciKm(new Date(t0.getTime() - 3_600_000));
    const pB = getMoonPositionEciKm(new Date(t0.getTime() + 3_600_000));
    const r0 = getMoonPositionEciKm(t0);
    const v = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z };
    const h = {
        x: r0.y * v.z - r0.z * v.y,
        y: r0.z * v.x - r0.x * v.z,
        z: r0.x * v.y - r0.y * v.x,
    };
    const hMag = Math.sqrt(h.x * h.x + h.y * h.y + h.z * h.z) || 1;
    const inclinationDeg =
        (Math.acos(Math.max(-1, Math.min(1, h.z / hMag))) * 180) / Math.PI;

    return { points, perigeeKm, apogeeKm, inclinationDeg };
}
