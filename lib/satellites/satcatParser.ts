import type { SatelliteSatcatRecord, SatcatObjectType } from "./satcatTypes";

export const CELESTRAK_ACTIVE_SATCAT_URL =
    "https://celestrak.org/satcat/records.php?GROUP=active&FORMAT=JSON";

export const CELESTRAK_FALLBACK_SATCAT_CSV_URL =
    "https://celestrak.org/pub/satcat.csv";

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
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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

function normalizeObjectType(value: unknown): SatcatObjectType {
    if (typeof value !== "string") {
        return "UNK";
    }
    const upper = value.trim().toUpperCase();
    if (upper === "PAY" || upper === "PAYLOAD") return "PAY";
    if (upper === "R/B" || upper === "ROCKET BODY") return "R/B";
    if (upper === "DEB" || upper === "DEBRIS") return "DEB";
    return "UNK";
}

/**
 * Validate and normalize a single SATCAT record.
 * Handles both standard casing and uppercase keys from CelesTrak JSON format.
 */
export function parseSatcatRecord(value: unknown): SatelliteSatcatRecord | null {
    if (!isUnknownRecord(value)) {
        return null;
    }

    const objectName =
        readString(value.OBJECT_NAME) ??
        readString(value.objectName) ??
        readString(value.NAME);

    const objectId =
        readString(value.OBJECT_ID) ??
        readString(value.objectId) ??
        readString(value.INTLDES) ??
        "";

    const noradIdRaw =
        readFiniteNumber(value.NORAD_CAT_ID) ??
        readFiniteNumber(value.noradCatId) ??
        readFiniteNumber(value.NORAD_NUMBER) ??
        readFiniteNumber(value.CATNR);

    if (noradIdRaw === null || noradIdRaw <= 0 || !Number.isInteger(noradIdRaw)) {
        return null;
    }

    const noradId = Math.trunc(noradIdRaw);

    const rawObjectType =
        value.OBJECT_TYPE ?? value.objectType ?? value.TYPE;
    const objectType = normalizeObjectType(rawObjectType);

    const opsStatusCode =
        readString(value.OPS_STATUS_CODE) ??
        readString(value.opsStatusCode) ??
        readString(value.STATUS);

    const owner =
        readString(value.OWNER) ??
        readString(value.owner) ??
        readString(value.COUNTRY);

    const launchDate =
        readString(value.LAUNCH_DATE) ??
        readString(value.launchDate) ??
        readString(value.LAUNCH);

    const launchSite =
        readString(value.LAUNCH_SITE) ??
        readString(value.launchSite) ??
        readString(value.SITE);

    const decayDate =
        readString(value.DECAY_DATE) ??
        readString(value.decayDate) ??
        readString(value.DECAY);

    const period =
        readFiniteNumber(value.PERIOD) ??
        readFiniteNumber(value.period);

    const inclination =
        readFiniteNumber(value.INCLINATION) ??
        readFiniteNumber(value.inclination);

    const apogee =
        readFiniteNumber(value.APOGEE) ??
        readFiniteNumber(value.apogee);

    const perigee =
        readFiniteNumber(value.PERIGEE) ??
        readFiniteNumber(value.perigee);

    const rcs =
        readFiniteNumber(value.RCS) ??
        readFiniteNumber(value.rcs) ??
        readFiniteNumber(value.RCS_SIZE);

    const dataStatusCode =
        readString(value.DATA_STATUS_CODE) ??
        readString(value.dataStatusCode);

    const orbitCenter =
        readString(value.ORBIT_CENTER) ??
        readString(value.orbitCenter);

    const orbitType =
        readString(value.ORBIT_TYPE) ??
        readString(value.orbitType);

    return {
        OBJECT_NAME: objectName ?? `OBJECT ${noradId}`,
        OBJECT_ID: objectId,
        NORAD_CAT_ID: noradId,
        OBJECT_TYPE: objectType,
        OPS_STATUS_CODE: opsStatusCode,
        OWNER: owner,
        LAUNCH_DATE: launchDate,
        LAUNCH_SITE: launchSite,
        DECAY_DATE: decayDate,
        PERIOD: period,
        INCLINATION: inclination,
        APOGEE: apogee,
        PERIGEE: perigee,
        RCS: rcs,
        DATA_STATUS_CODE: dataStatusCode,
        ORBIT_CENTER: orbitCenter,
        ORBIT_TYPE: orbitType,
    };
}

/**
 * Parse an array of SATCAT records and deduplicate by NORAD_CAT_ID.
 */
export function parseSatcatCatalog(payload: unknown): SatelliteSatcatRecord[] {
    if (!Array.isArray(payload)) {
        return [];
    }

    const uniqueMap = new Map<number, SatelliteSatcatRecord>();

    for (const item of payload) {
        const record = parseSatcatRecord(item);
        if (record && !uniqueMap.has(record.NORAD_CAT_ID)) {
            uniqueMap.set(record.NORAD_CAT_ID, record);
        }
    }

    return Array.from(uniqueMap.values());
}

/**
 * Format SATCAT OPS_STATUS_CODE into human-readable label.
 */
export function formatOperationalStatus(code: string | null | undefined): {
    label: string;
    code: string;
    isOperational: boolean;
} {
    if (!code || code.trim() === "" || code === "?") {
        return { label: "Unknown", code: "?", isOperational: false };
    }

    const trimmed = code.trim().toUpperCase();

    switch (trimmed) {
        case "+":
            return { label: "Operational", code: "+", isOperational: true };
        case "-":
            return { label: "Nonoperational", code: "-", isOperational: false };
        case "P":
            return { label: "Partially Operational", code: "P", isOperational: true };
        case "B":
            return { label: "Backup / Standby", code: "B", isOperational: true };
        case "S":
            return { label: "Spare", code: "S", isOperational: true };
        case "X":
            return { label: "Extended Mission", code: "X", isOperational: true };
        case "D":
            return { label: "Decayed", code: "D", isOperational: false };
        default:
            return { label: `Status (${trimmed})`, code: trimmed, isOperational: false };
    }
}

/**
 * Format SATCAT OBJECT_TYPE into human-readable label.
 */
export function formatObjectType(type: SatcatObjectType | string | null | undefined): string {
    switch (type) {
        case "PAY":
            return "Payload";
        case "R/B":
            return "Rocket Body";
        case "DEB":
            return "Debris";
        case "UNK":
        default:
            return "Unknown Object";
    }
}
