
import {
    eciToEcf,
    gstime,
    json2satrec,
    propagate,
    type SatRec,
} from "satellite.js";
import type { SatelliteOmmRecord } from "./catalogTypes";

export interface PreparedSatellite {
    noradId: number;
    satrec: SatRec | null;
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
 * Parse OMM records into SatRec objects once.
 *
 * The returned array preserves the exact same order as the API catalog.
 * Invalid records remain represented by a null satrec.
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
                };
            }

            return {
                noradId: record.NORAD_CAT_ID,
                satrec,
            };
        } catch {
            return {
                noradId: record.NORAD_CAT_ID,
                satrec: null,
            };
        }
    });
}

/**
 * Propagate every prepared object to one UTC timestamp.
 *
 * Output uses typed arrays so it can be transferred efficiently from
 * a Web Worker to the browser main thread.
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
            const propagated = propagate(prepared.satrec, date, {
                communityDecayCheckEnabled: true,
            });

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
