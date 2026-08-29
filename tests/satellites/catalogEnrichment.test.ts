import { describe, expect, it } from "vitest";
import { joinOmmWithSatcat } from "../../lib/satellites/satcatService";
import type { SatelliteOmmRecord } from "../../lib/satellites/catalogTypes";
import type { SatelliteSatcatRecord } from "../../lib/satellites/satcatTypes";

describe("Catalog SATCAT Enrichment", () => {
    const sampleOmm: SatelliteOmmRecord[] = [
        {
            OBJECT_NAME: "ISS (ZARYA)",
            OBJECT_ID: "1998-067A",
            EPOCH: "2026-08-28T12:00:00.000Z",
            MEAN_MOTION: 15.49,
            ECCENTRICITY: 0.0005,
            INCLINATION: 51.64,
            RA_OF_ASC_NODE: 120.5,
            ARG_OF_PERICENTER: 45.2,
            MEAN_ANOMALY: 314.8,
            EPHEMERIS_TYPE: 0,
            CLASSIFICATION_TYPE: "U",
            NORAD_CAT_ID: 25544,
            ELEMENT_SET_NO: 999,
            REV_AT_EPOCH: 55000,
            BSTAR: 0.0002,
            MEAN_MOTION_DOT: 0.0001,
            MEAN_MOTION_DDOT: 0,
        },
        {
            OBJECT_NAME: "STARLINK-1007",
            OBJECT_ID: "2019-074A",
            EPOCH: "2026-08-28T12:00:00.000Z",
            MEAN_MOTION: 15.05,
            ECCENTRICITY: 0.0001,
            INCLINATION: 53.05,
            RA_OF_ASC_NODE: 85.2,
            ARG_OF_PERICENTER: 90.0,
            MEAN_ANOMALY: 270.0,
            EPHEMERIS_TYPE: 0,
            CLASSIFICATION_TYPE: "U",
            NORAD_CAT_ID: 44713,
            ELEMENT_SET_NO: 999,
            REV_AT_EPOCH: 35000,
            BSTAR: 0.00005,
            MEAN_MOTION_DOT: 0.00002,
            MEAN_MOTION_DDOT: 0,
        },
    ];

    it("joins SATCAT metadata with OMM records using NORAD_CAT_ID in O(n)", () => {
        const satcatMap = new Map<number, SatelliteSatcatRecord>([
            [
                25544,
                {
                    OBJECT_NAME: "ISS (ZARYA)",
                    OBJECT_ID: "1998-067A",
                    NORAD_CAT_ID: 25544,
                    OBJECT_TYPE: "PAY",
                    OPS_STATUS_CODE: "+",
                    OWNER: "ISS",
                    LAUNCH_DATE: "1998-11-20",
                    LAUNCH_SITE: "TTMTR",
                    DECAY_DATE: null,
                    PERIOD: 92.9,
                    INCLINATION: 51.64,
                    APOGEE: 422,
                    PERIGEE: 414,
                    RCS: 400.0,
                    DATA_STATUS_CODE: "0",
                    ORBIT_CENTER: "EA",
                    ORBIT_TYPE: "ORB",
                },
            ],
        ]);

        const joined = joinOmmWithSatcat(sampleOmm, satcatMap);
        expect(joined).toHaveLength(2);

        // First item matched
        expect(joined[0].NORAD_CAT_ID).toBe(25544);
        expect(joined[0].SATCAT).not.toBeNull();
        expect(joined[0].SATCAT?.OWNER).toBe("ISS");
        expect(joined[0].SATCAT?.OBJECT_TYPE).toBe("PAY");
        expect(joined[0].SATCAT?.APOGEE).toBe(422);

        // Second item had no SATCAT entry
        expect(joined[1].NORAD_CAT_ID).toBe(44713);
        expect(joined[1].SATCAT).toBeNull();
    });

    it("produces null SATCAT when SATCAT map is empty without failing OMM", () => {
        const emptyMap = new Map<number, SatelliteSatcatRecord>();
        const joined = joinOmmWithSatcat(sampleOmm, emptyMap);

        expect(joined).toHaveLength(2);
        expect(joined[0].SATCAT).toBeNull();
        expect(joined[1].SATCAT).toBeNull();
        expect(joined[0].OBJECT_NAME).toBe("ISS (ZARYA)");
        expect(joined[1].OBJECT_NAME).toBe("STARLINK-1007");
    });
});
