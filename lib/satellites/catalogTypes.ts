/**
 * CelesTrak GP data represented using Orbit Mean-Elements
 * Message JSON field names.
 *
 * Uppercase field names are intentionally preserved because
 * satellite.js json2satrec() accepts the original OMM format.
 */
export interface SatelliteOmmRecord {
    OBJECT_NAME: string;
    OBJECT_ID: string;
    EPOCH: string;

    MEAN_MOTION: number;
    ECCENTRICITY: number;
    INCLINATION: number;
    RA_OF_ASC_NODE: number;
    ARG_OF_PERICENTER: number;
    MEAN_ANOMALY: number;

    EPHEMERIS_TYPE: 0;
    CLASSIFICATION_TYPE: "U" | "C";

    NORAD_CAT_ID: number;
    ELEMENT_SET_NO: number;
    REV_AT_EPOCH: number;

    BSTAR: number;
    MEAN_MOTION_DOT: number;
    MEAN_MOTION_DDOT: number;

    /**
     * OMM may contain additional metadata fields.
     *
     * This index signature also makes this interface compatible
     * with satellite.js OMMJsonObject.
     */
    [key: string]: unknown;
}

export interface SatelliteCatalogResponse {
    source: {
        name: "CelesTrak";
        format: "OMM JSON";
        url: string;
    };
    group: "active";
    generatedAt: string;
    refreshIntervalSeconds: number;
    count: number;
    totalAvailable: number;
    satellites: SatelliteOmmRecord[];
}

export interface SatelliteCatalogErrorResponse {
    error: string;
    message: string;
}
