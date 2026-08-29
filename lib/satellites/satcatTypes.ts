/**
 * CelesTrak SATCAT (Satellite Catalog) record types.
 *
 * SATCAT provides object classification, launch metadata, ownership,
 * operational status, and radar cross-section (RCS) information.
 */

export type SatcatObjectType = "PAY" | "R/B" | "DEB" | "UNK";

export interface SatelliteSatcatRecord {
    OBJECT_NAME: string;
    OBJECT_ID: string;
    NORAD_CAT_ID: number;
    OBJECT_TYPE: SatcatObjectType;
    OPS_STATUS_CODE: string | null;
    OWNER: string | null;
    LAUNCH_DATE: string | null;
    LAUNCH_SITE: string | null;
    DECAY_DATE: string | null;
    PERIOD: number | null;
    INCLINATION: number | null;
    APOGEE: number | null;
    PERIGEE: number | null;
    RCS: number | null;
    DATA_STATUS_CODE: string | null;
    ORBIT_CENTER: string | null;
    ORBIT_TYPE: string | null;
}

export interface SatcatSourceInfo {
    name: "CelesTrak SATCAT";
    url: string;
    fetchedAt: string | null;
    available: boolean;
}
