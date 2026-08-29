import {
    eciToEcf,
    eciToGeodetic,
    gstime,
    json2satrec,
    propagate,
    type SatRec,
} from "satellite.js";
import type { SatelliteOmmRecord } from "./catalogTypes";
import type { SelectedSatelliteAnalysisMessage } from "./catalogWorkerTypes";

export interface PreparedSatellite {
    noradId: number;
    satrec: SatRec | null;
    epoch: string;
}

export interface CatalogPropagationResult {
    timestamp: number;
    count: number;
    validCount: number;
    positionsEcfKm: Float64Array;
    speedsKmS: Float32Array;
    valid: Uint8Array;
}

function vectorMagnitude(
    vector: Readonly<{ x: number; y: number; z: number }>
): number {
    return Math.sqrt(
        vector.x * vector.x +
        vector.y * vector.y +
        vector.z * vector.z
    );
}

function isFiniteVector(
    vector: Readonly<{ x: number; y: number; z: number }>
): boolean {
    return (
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z)
    );
}

/**
 * Normalize longitude degrees to [-180, 180].
 */
export function normalizeLongitudeDeg(lonDeg: number): number {
    let normalized = lonDeg % 360;
    if (normalized > 180) {
        normalized -= 360;
    } else if (normalized < -180) {
        normalized += 360;
    }
    return normalized;
}

/**
 * Parse OMM records into SatRec objects once.
 * The returned array preserves the exact same order as the API catalog.
 */
export function prepareSatelliteCatalog(
    records: readonly SatelliteOmmRecord[]
): PreparedSatellite[] {
    return records.map((record) => {
        try {
            const satrec = json2satrec(record);

            if (satrec.error !== 0) {
                return {
                    noradId: record.NORAD_CAT_ID,
                    satrec: null,
                    epoch: record.EPOCH,
                };
            }

            return {
                noradId: record.NORAD_CAT_ID,
                satrec,
                epoch: record.EPOCH,
            };
        } catch {
            return {
                noradId: record.NORAD_CAT_ID,
                satrec: null,
                epoch: record.EPOCH,
            };
        }
    });
}

/**
 * Propagate every prepared object in the catalog to one UTC timestamp.
 */
export function propagateSatelliteCatalog(
    preparedSatellites: readonly PreparedSatellite[],
    date: Date
): CatalogPropagationResult {
    const timestamp = date.getTime();

    if (!Number.isFinite(timestamp)) {
        throw new RangeError("Propagation date must be valid");
    }

    const positionsEcfKm = new Float64Array(
        preparedSatellites.length * 3
    );
    const speedsKmS = new Float32Array(preparedSatellites.length);
    const valid = new Uint8Array(preparedSatellites.length);

    positionsEcfKm.fill(Number.NaN);
    speedsKmS.fill(Number.NaN);

    const gmst = gstime(date);
    let validCount = 0;

    for (let index = 0; index < preparedSatellites.length; index += 1) {
        const prepared = preparedSatellites[index];

        if (!prepared.satrec) {
            continue;
        }

        try {
            const propagated = propagate(prepared.satrec, date);

            if (!propagated) {
                continue;
            }

            const positionEcfKm = eciToEcf(
                propagated.position,
                gmst
            );

            if (
                !isFiniteVector(positionEcfKm) ||
                !isFiniteVector(propagated.velocity)
            ) {
                continue;
            }

            const positionOffset = index * 3;

            positionsEcfKm[positionOffset] = positionEcfKm.x;
            positionsEcfKm[positionOffset + 1] = positionEcfKm.y;
            positionsEcfKm[positionOffset + 2] = positionEcfKm.z;

            speedsKmS[index] = vectorMagnitude(
                propagated.velocity
            );

            valid[index] = 1;
            validCount += 1;
        } catch {
            // One corrupt or decayed object must not abort the whole catalog.
        }
    }

    return {
        timestamp,
        count: preparedSatellites.length,
        validCount,
        positionsEcfKm,
        speedsKmS,
        valid,
    };
}

/**
 * Compute detailed 1-orbit SGP4 profile for ONE selected satellite.
 * Never computed for the entire catalog of 1,000 objects.
 */
export function propagateSatelliteProfile(
    prepared: PreparedSatellite,
    startTimestamp: number,
    sampleCount: number = 120,
    requestId: number = 0
): SelectedSatelliteAnalysisMessage {
    const clampedSamples = Math.min(Math.max(sampleCount, 60), 180);

    const timestamps = new Float64Array(clampedSamples);
    const positionsEcfKm = new Float64Array(clampedSamples * 3);
    const altitudesKm = new Float32Array(clampedSamples);
    const speedsKmS = new Float32Array(clampedSamples);
    const latitudesDeg = new Float32Array(clampedSamples);
    const longitudesDeg = new Float32Array(clampedSamples);
    const valid = new Uint8Array(clampedSamples);

    positionsEcfKm.fill(Number.NaN);
    altitudesKm.fill(Number.NaN);
    speedsKmS.fill(Number.NaN);
    latitudesDeg.fill(Number.NaN);
    longitudesDeg.fill(Number.NaN);

    if (!prepared.satrec) {
        return {
            type: "selected-analysis",
            requestId,
            noradId: prepared.noradId,
            elementEpoch: prepared.epoch,
            timestamps,
            positionsEcfKm,
            altitudesKm,
            speedsKmS,
            latitudesDeg,
            longitudesDeg,
            valid,
        };
    }

    // Determine 1 orbit duration in seconds (satrec.no is in radians/minute)
    // Period T (min) = 2π / satrec.no -> Period (sec) = (2π * 60) / satrec.no
    const meanMotionRadPerMin = prepared.satrec.no;
    let periodSec = 5400; // default 90 minutes

    if (meanMotionRadPerMin > 0) {
        periodSec = (2 * Math.PI * 60) / meanMotionRadPerMin;
        // Clamp period between 60 minutes and 24 hours
        periodSec = Math.min(Math.max(periodSec, 3600), 86400);
    }

    const stepMs = (periodSec * 1000) / (clampedSamples - 1);

    const gmst0 = gstime(new Date(startTimestamp));

    for (let index = 0; index < clampedSamples; index += 1) {
        const sampleTimeMs = startTimestamp + index * stepMs;
        timestamps[index] = sampleTimeMs;

        const date = new Date(sampleTimeMs);
        const gmst = gstime(date);

        try {
            const propagated = propagate(prepared.satrec, date);

            if (
                !propagated ||
                !isFiniteVector(propagated.position) ||
                !isFiniteVector(propagated.velocity)
            ) {
                continue;
            }

            // Project 3D orbital ring in inertial frame aligned to current Earth orientation (gmst0)
            const positionEcf = eciToEcf(propagated.position, gmst0);
            if (!isFiniteVector(positionEcf)) {
                continue;
            }

            const geodetic = eciToGeodetic(propagated.position, gmst);

            if (
                !Number.isFinite(geodetic.height) ||
                !Number.isFinite(geodetic.latitude) ||
                !Number.isFinite(geodetic.longitude)
            ) {
                continue;
            }

            const latDeg = geodetic.latitude * (180 / Math.PI);
            const lonDeg = normalizeLongitudeDeg(
                geodetic.longitude * (180 / Math.PI)
            );

            const offset = index * 3;
            positionsEcfKm[offset] = positionEcf.x;
            positionsEcfKm[offset + 1] = positionEcf.y;
            positionsEcfKm[offset + 2] = positionEcf.z;

            altitudesKm[index] = geodetic.height;
            speedsKmS[index] = vectorMagnitude(propagated.velocity);
            latitudesDeg[index] = latDeg;
            longitudesDeg[index] = lonDeg;
            valid[index] = 1;
        } catch {
            // Keep sample as invalid
        }
    }

    return {
        type: "selected-analysis",
        requestId,
        noradId: prepared.noradId,
        elementEpoch: prepared.epoch,
        timestamps,
        positionsEcfKm,
        altitudesKm,
        speedsKmS,
        latitudesDeg,
        longitudesDeg,
        valid,
    };
}
