import type { SatelliteOmmRecord } from "./catalogTypes";

export const CELESTRAK_ACTIVE_OMM_URL =
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON";

const MAX_REASONABLE_MEAN_MOTION = 20;
const MAX_INCLINATION_DEGREES = 180;

function isUnknownRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function readString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
}

function readOptionalString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function readFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function isValidEpoch(value: string): boolean {
    return Number.isFinite(Date.parse(value));
}

/**
 * Validate and normalize one CelesTrak OMM record.
 *
 * CelesTrak normally returns numeric JSON values, but this parser also
 * accepts numeric strings so it remains usable if the upstream serializer
 * changes its representation.
 */
export function parseCelestrakOmmRecord(
    value: unknown
): SatelliteOmmRecord | null {
    if (!isUnknownRecord(value)) {
        return null;
    }

    const objectName = readString(value.OBJECT_NAME);
    const objectId = readOptionalString(value.OBJECT_ID);
    const epoch = readString(value.EPOCH);

    const rawClassificationType = readString(
        value.CLASSIFICATION_TYPE
    );

    const classificationType: "U" | "C" =
        rawClassificationType === "C" ? "C" : "U";

    const meanMotion = readFiniteNumber(value.MEAN_MOTION);
    const eccentricity = readFiniteNumber(value.ECCENTRICITY);
    const inclination = readFiniteNumber(value.INCLINATION);
    const rightAscension = readFiniteNumber(
        value.RA_OF_ASC_NODE
    );
    const argumentOfPericenter = readFiniteNumber(
        value.ARG_OF_PERICENTER
    );
    const meanAnomaly = readFiniteNumber(value.MEAN_ANOMALY);
    const ephemerisType = readFiniteNumber(
        value.EPHEMERIS_TYPE
    );
    const noradCatalogId = readFiniteNumber(
        value.NORAD_CAT_ID
    );
    const elementSetNumber = readFiniteNumber(
        value.ELEMENT_SET_NO
    );
    const revolutionAtEpoch = readFiniteNumber(
        value.REV_AT_EPOCH
    );
    const bstar = readFiniteNumber(value.BSTAR);
    const meanMotionDot = readFiniteNumber(
        value.MEAN_MOTION_DOT
    );
    const meanMotionDdot = readFiniteNumber(
        value.MEAN_MOTION_DDOT
    );

    if (
        !objectName ||
        !epoch ||
        !isValidEpoch(epoch) ||
        meanMotion === null ||
        eccentricity === null ||
        inclination === null ||
        rightAscension === null ||
        argumentOfPericenter === null ||
        meanAnomaly === null ||
        ephemerisType === null ||
        noradCatalogId === null ||
        elementSetNumber === null ||
        revolutionAtEpoch === null ||
        bstar === null ||
        meanMotionDot === null ||
        meanMotionDdot === null
    ) {
        return null;
    }

    if (
        ephemerisType !== 0 ||
        noradCatalogId <= 0 ||
        meanMotion <= 0 ||
        meanMotion > MAX_REASONABLE_MEAN_MOTION ||
        eccentricity < 0 ||
        eccentricity >= 1 ||
        inclination < 0 ||
        inclination > MAX_INCLINATION_DEGREES
    ) {
        return null;
    }

    return {
        OBJECT_NAME: objectName,
        OBJECT_ID: objectId,
        EPOCH: epoch,
        MEAN_MOTION: meanMotion,
        ECCENTRICITY: eccentricity,
        INCLINATION: inclination,
        RA_OF_ASC_NODE: rightAscension,
        ARG_OF_PERICENTER: argumentOfPericenter,
        MEAN_ANOMALY: meanAnomaly,
        EPHEMERIS_TYPE: 0,
        CLASSIFICATION_TYPE: classificationType,
        NORAD_CAT_ID: Math.trunc(noradCatalogId),
        ELEMENT_SET_NO: Math.trunc(elementSetNumber),
        REV_AT_EPOCH: Math.trunc(revolutionAtEpoch),
        BSTAR: bstar,
        MEAN_MOTION_DOT: meanMotionDot,
        MEAN_MOTION_DDOT: meanMotionDdot,
    };
}

/**
 * Parse the complete CelesTrak response and remove duplicate NORAD IDs.
 */
export function parseCelestrakOmmCatalog(
    payload: unknown
): SatelliteOmmRecord[] {
    if (!Array.isArray(payload)) {
        throw new TypeError(
            "CelesTrak response must be an array"
        );
    }

    const uniqueRecords = new Map<
        number,
        SatelliteOmmRecord
    >();

    for (const value of payload) {
        const record = parseCelestrakOmmRecord(value);

        if (!record) {
            continue;
        }

        const existing = uniqueRecords.get(
            record.NORAD_CAT_ID
        );

        if (!existing) {
            uniqueRecords.set(record.NORAD_CAT_ID, record);
            continue;
        }

        const existingEpoch = Date.parse(existing.EPOCH);
        const candidateEpoch = Date.parse(record.EPOCH);

        // If an object appears more than once, preserve its newest element set.
        if (candidateEpoch > existingEpoch) {
            uniqueRecords.set(record.NORAD_CAT_ID, record);
        }
    }

    return Array.from(uniqueRecords.values());
}
