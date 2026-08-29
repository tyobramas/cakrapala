import type { SatelliteOmmRecord } from "./catalogTypes";

export type FreshnessCategory = "FRESH" | "AGING" | "STALE" | "VERY_STALE";

export interface DataQualityReport {
    freshnessCategory: FreshnessCategory;
    freshnessLabel: string;
    freshnessColor: "emerald" | "amber" | "orange" | "red";
    dataAgeFormatted: string;
    dataAgeHours: number | null;
    elementEpochUtc: string;
    propagationStatus: "VALID" | "DEGRADED" | "UNAVAILABLE";
    fieldCompletenessPercent: number;
    satcatStatus: "AVAILABLE" | "NOT AVAILABLE";
    sourceDescription: string;
    disclaimer: string;
}

const REQUIRED_OMM_FIELDS: readonly (keyof SatelliteOmmRecord)[] = [
    "OBJECT_NAME",
    "OBJECT_ID",
    "EPOCH",
    "MEAN_MOTION",
    "ECCENTRICITY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "NORAD_CAT_ID",
    "BSTAR",
    "MEAN_MOTION_DOT",
];

function formatDuration(hours: number): string {
    if (hours < 1) {
        const mins = Math.max(1, Math.round(hours * 60));
        return `${mins}m`;
    }
    if (hours < 24) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Assess real data quality based strictly on ephemeris metadata and timestamps.
 * Does not emit speculative or synthetic AI threat scores.
 */
export function assessDataQuality(
    omm: SatelliteOmmRecord,
    hasValidSatrec: boolean = true,
    currentTime: Date = new Date()
): DataQualityReport {
    // 1. Calculate Field Completeness
    let validFieldCount = 0;
    for (const field of REQUIRED_OMM_FIELDS) {
        const val = omm[field];
        if (typeof val === "number") {
            if (Number.isFinite(val)) validFieldCount += 1;
        } else if (typeof val === "string") {
            if (val.trim().length > 0) validFieldCount += 1;
        }
    }

    const fieldCompletenessPercent = Math.round(
        (validFieldCount / REQUIRED_OMM_FIELDS.length) * 100
    );

    // 2. Element Age & Freshness
    let dataAgeHours: number | null = null;
    let dataAgeFormatted = "Unknown";
    let freshnessCategory: FreshnessCategory = "VERY_STALE";
    let freshnessLabel = "VERY STALE";
    let freshnessColor: "emerald" | "amber" | "orange" | "red" = "red";

    const epochTimestamp = Date.parse(omm.EPOCH);
    if (Number.isFinite(epochTimestamp)) {
        const ageMs = currentTime.getTime() - epochTimestamp;
        const hours = ageMs / (3600 * 1000);

        if (hours >= 0) {
            dataAgeHours = Math.round(hours * 10) / 10;
            dataAgeFormatted = formatDuration(hours);

            if (hours <= 24) {
                freshnessCategory = "FRESH";
                freshnessLabel = "FRESH";
                freshnessColor = "emerald";
            } else if (hours <= 72) {
                freshnessCategory = "AGING";
                freshnessLabel = "AGING";
                freshnessColor = "amber";
            } else if (hours <= 168) {
                freshnessCategory = "STALE";
                freshnessLabel = "STALE";
                freshnessColor = "orange";
            } else {
                freshnessCategory = "VERY_STALE";
                freshnessLabel = "VERY STALE";
                freshnessColor = "red";
            }
        }
    }

    // 3. Propagation Status
    let propagationStatus: "VALID" | "DEGRADED" | "UNAVAILABLE" = "UNAVAILABLE";
    if (hasValidSatrec) {
        propagationStatus = fieldCompletenessPercent >= 90 ? "VALID" : "DEGRADED";
    }

    // 4. SATCAT Metadata Availability
    const satcatStatus = omm.SATCAT ? "AVAILABLE" : "NOT AVAILABLE";

    // 5. Source Description
    const sourceDescription = omm.SATCAT
        ? "CelesTrak NORAD OMM + SATCAT Registry"
        : "CelesTrak NORAD OMM (Mean Elements)";

    return {
        freshnessCategory,
        freshnessLabel,
        freshnessColor,
        dataAgeFormatted,
        dataAgeHours,
        elementEpochUtc: omm.EPOCH,
        propagationStatus,
        fieldCompletenessPercent,
        satcatStatus,
        sourceDescription,
        disclaimer: "Freshness describes element age, not guaranteed positional accuracy.",
    };
}
