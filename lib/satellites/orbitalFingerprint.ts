import type { SatelliteOmmRecord } from "./catalogTypes";
import { calculateOrbitalMetrics } from "./orbitalMetrics";

export interface FingerprintAxis {
    id: string;
    label: string;
    normalizedValue: number; // 0 to 1
    actualValue: number;
    formattedValue: string;
    unit: string;
    description: string;
}

export interface OrbitalFingerprintResult {
    axes: FingerprintAxis[];
    disclaimer: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculate the normalized 7-axis "Orbital Fingerprint" for a satellite.
 *
 * All values are strictly bound to [0, 1] and represent physical orbital geometry
 * and ephemeris properties — NEVER an arbitrary threat or risk score.
 */
export function calculateOrbitalFingerprint(
    omm: SatelliteOmmRecord,
    currentTime: Date = new Date()
): OrbitalFingerprintResult {
    const metrics = calculateOrbitalMetrics(omm, currentTime);

    // 1. Altitude Axis (0 km = 0.0, GEO ~35,786 km = 1.0)
    const avgAltKm = (metrics.estimatedPerigeeKm + metrics.estimatedApogeeKm) / 2;
    const normAlt = clamp(avgAltKm / 36000, 0.02, 1.0);

    // 2. Inclination Axis (0° equatorial = 0.0, 90° polar = 0.5, 180° retrograde = 1.0)
    const inclDeg = omm.INCLINATION;
    const normIncl = clamp(inclDeg / 180, 0.0, 1.0);

    // 3. Eccentricity Axis (0.0 circular = 0.0, 0.8 highly elliptical = 1.0)
    const ecc = omm.ECCENTRICITY;
    const normEcc = clamp(ecc / 0.8, 0.0, 1.0);

    // 4. Period Axis (90 min LEO = 0.0625, 1440 min GEO = 1.0)
    const periodMin = metrics.periodMinutes;
    const normPeriod = clamp(periodMin / 1440, 0.05, 1.0);

    // 5. Atmospheric Drag Sensitivity (BSTAR parameter logarithmic scale)
    const absBstar = Math.abs(omm.BSTAR);
    const normDrag = clamp(
        absBstar > 0 ? (Math.log10(absBstar * 1e5) + 2) / 6 : 0.05,
        0.05,
        1.0
    );

    // 6. Element Freshness (0.0 = stale > 7 days, 1.0 = brand new < 6 hours)
    const ageHours = metrics.elementAgeHours ?? 48;
    const normFreshness = clamp(1.0 - ageHours / 168, 0.05, 1.0);

    // 7. Ground Track Coverage (0.0 = narrow equatorial band, 1.0 = global polar reach)
    const inclRad = (inclDeg * Math.PI) / 180;
    const normCoverage = clamp(Math.sin(inclRad), 0.05, 1.0);

    const axes: FingerprintAxis[] = [
        {
            id: "altitude",
            label: "ALTITUDE",
            normalizedValue: Math.round(normAlt * 100) / 100,
            actualValue: Math.round(avgAltKm),
            formattedValue: `${Math.round(avgAltKm).toLocaleString()} km`,
            unit: "km",
            description: "Average orbital height above mean Earth radius",
        },
        {
            id: "inclination",
            label: "INCLINATION",
            normalizedValue: Math.round(normIncl * 100) / 100,
            actualValue: Math.round(inclDeg * 100) / 100,
            formattedValue: `${inclDeg.toFixed(2)}°`,
            unit: "deg",
            description: "Orbital plane tilt relative to the Earth's equator",
        },
        {
            id: "eccentricity",
            label: "ECCENTRICITY",
            normalizedValue: Math.round(normEcc * 100) / 100,
            actualValue: ecc,
            formattedValue: ecc.toFixed(6),
            unit: "ratio",
            description: "Orbit deviation from a perfect circular path",
        },
        {
            id: "period",
            label: "PERIOD",
            normalizedValue: Math.round(normPeriod * 100) / 100,
            actualValue: Math.round(periodMin * 10) / 10,
            formattedValue: `${periodMin.toFixed(1)} min`,
            unit: "minutes",
            description: "Time required to complete one orbital revolution",
        },
        {
            id: "drag",
            label: "DRAG",
            normalizedValue: Math.round(normDrag * 100) / 100,
            actualValue: omm.BSTAR,
            formattedValue: omm.BSTAR.toExponential(2),
            unit: "1/Earth-radii",
            description: "BSTAR aerodynamic drag coefficient sensitivity",
        },
        {
            id: "freshness",
            label: "FRESHNESS",
            normalizedValue: Math.round(normFreshness * 100) / 100,
            actualValue: ageHours,
            formattedValue: `${Math.round(ageHours)}h ago`,
            unit: "hours",
            description: "Time elapsed since ephemeris observation epoch",
        },
        {
            id: "coverage",
            label: "COVERAGE",
            normalizedValue: Math.round(normCoverage * 100) / 100,
            actualValue: Math.round(normCoverage * 100),
            formattedValue: `${Math.round(normCoverage * 100)}%`,
            unit: "lat-span",
            description: "Latitudinal surface swath reach from orbital tilt",
        },
    ];

    return {
        axes,
        disclaimer: "Normalized orbital characteristics, not a collision-risk score.",
    };
}
