import type { SatelliteOmmRecord } from "./catalogTypes";

/**
 * Standard astrodynamical constants (WGS-84 / Earth Gravitational Model).
 */
export const EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 = 398600.4418; // Standard gravitational parameter μ (G * M_earth)
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137; // WGS-84 Earth Equatorial Radius

export interface DerivedOrbitalMetrics {
    regime: "LEO" | "MEO" | "GEO" | "HEO";
    periodMinutes: number;
    semiMajorAxisKm: number;
    estimatedPerigeeKm: number;
    estimatedApogeeKm: number;
    elementAgeHours: number | null;
}

/**
 * Compute derived orbital metrics and classify regime from OMM mean elements.
 */
export function calculateOrbitalMetrics(
    omm: Pick<SatelliteOmmRecord, "MEAN_MOTION" | "ECCENTRICITY" | "EPOCH">,
    currentTime: Date = new Date()
): DerivedOrbitalMetrics {
    const meanMotion = omm.MEAN_MOTION;
    const eccentricity = omm.ECCENTRICITY;

    if (
        !Number.isFinite(meanMotion) ||
        meanMotion <= 0 ||
        !Number.isFinite(eccentricity) ||
        eccentricity < 0 ||
        eccentricity >= 1
    ) {
        return {
            regime: "LEO",
            periodMinutes: 0,
            semiMajorAxisKm: 0,
            estimatedPerigeeKm: 0,
            estimatedApogeeKm: 0,
            elementAgeHours: null,
        };
    }

    // Mean motion n in rad/s: n = (meanMotion * 2π) / 86400
    const meanMotionRadPerSec = (meanMotion * 2 * Math.PI) / 86400;

    // Semi-major axis a = (μ / n²)^(1/3)
    const semiMajorAxisKm = Math.cbrt(
        EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 /
        (meanMotionRadPerSec * meanMotionRadPerSec)
    );

    // Orbital period in minutes: T = 1440 / meanMotion
    const periodMinutes = 1440 / meanMotion;

    // Perigee and Apogee Radii from Earth center
    const perigeeRadiusKm = semiMajorAxisKm * (1 - eccentricity);
    const apogeeRadiusKm = semiMajorAxisKm * (1 + eccentricity);

    // Altitudes relative to equatorial Earth surface
    const estimatedPerigeeKm = perigeeRadiusKm - EARTH_EQUATORIAL_RADIUS_KM;
    const estimatedApogeeKm = apogeeRadiusKm - EARTH_EQUATORIAL_RADIUS_KM;

    // Element age in hours from epoch
    let elementAgeHours: number | null = null;
    const epochTimestamp = Date.parse(omm.EPOCH);

    if (Number.isFinite(epochTimestamp)) {
        const diffMs = currentTime.getTime() - epochTimestamp;
        // Age is valid if epoch is not unreasonably in the future (> 48 hours)
        if (diffMs >= -48 * 3600 * 1000) {
            elementAgeHours = Math.max(0, diffMs / (3600 * 1000));
        }
    }

    // Regime classification
    let regime: "LEO" | "MEO" | "GEO" | "HEO";

    if (eccentricity >= 0.25) {
        regime = "HEO"; // Highly Eccentric Orbit (Molniya, Tundra, GTO)
    } else if (meanMotion >= 11.25 || periodMinutes <= 128) {
        regime = "LEO"; // Low Earth Orbit (< 2,000 km altitude)
    } else if (meanMotion > 1.2 && periodMinutes < 1400) {
        regime = "MEO"; // Medium Earth Orbit (GPS, Galileo, Glonass)
    } else {
        regime = "GEO"; // Geostationary / Geosynchronous Belt (~35,786 km)
    }

    return {
        regime,
        periodMinutes: Math.round(periodMinutes * 100) / 100,
        semiMajorAxisKm: Math.round(semiMajorAxisKm * 100) / 100,
        estimatedPerigeeKm: Math.round(estimatedPerigeeKm * 10) / 10,
        estimatedApogeeKm: Math.round(estimatedApogeeKm * 10) / 10,
        elementAgeHours: elementAgeHours !== null ? Math.round(elementAgeHours * 10) / 10 : null,
    };
}
