import { describe, expect, it } from "vitest";
import {
    parseCelestrakOmmCatalog,
    parseCelestrakOmmRecord,
} from "../../lib/satellites/celestrakCatalog";

const validIssRecord = {
    OBJECT_NAME: "ISS (ZARYA)",
    OBJECT_ID: "1998-067A",
    EPOCH: "2026-08-28T15:03:31.768992",
    MEAN_MOTION: 15.4892201,
    ECCENTRICITY: 0.0005003,
    INCLINATION: 51.6318,
    RA_OF_ASC_NODE: 301.546,
    ARG_OF_PERICENTER: 85.3161,
    MEAN_ANOMALY: 274.8399,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: "U",
    NORAD_CAT_ID: 25544,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 58298,
    BSTAR: 0.00023891,
    MEAN_MOTION_DOT: 0.00012701,
    MEAN_MOTION_DDOT: 0,
};

describe("CelesTrak catalog parser", () => {
    it("parses a valid OMM record", () => {
        const result = parseCelestrakOmmRecord(validIssRecord);

        expect(result).not.toBeNull();
        expect(result?.OBJECT_NAME).toBe("ISS (ZARYA)");
        expect(result?.NORAD_CAT_ID).toBe(25544);
        expect(result?.MEAN_MOTION).toBeCloseTo(15.4892201);
    });

    it("accepts numeric values represented as strings", () => {
        const result = parseCelestrakOmmRecord({
            ...validIssRecord,
            NORAD_CAT_ID: "25544",
            MEAN_MOTION: "15.4892201",
            ECCENTRICITY: ".0005003",
        });

        expect(result?.NORAD_CAT_ID).toBe(25544);
        expect(result?.ECCENTRICITY).toBeCloseTo(0.0005003);
    });

    it("rejects malformed or physically invalid records", () => {
        expect(parseCelestrakOmmRecord(null)).toBeNull();

        expect(
            parseCelestrakOmmRecord({
                ...validIssRecord,
                EPOCH: "not-a-date",
            })
        ).toBeNull();

        expect(
            parseCelestrakOmmRecord({
                ...validIssRecord,
                ECCENTRICITY: 1.2,
            })
        ).toBeNull();

        expect(
            parseCelestrakOmmRecord({
                ...validIssRecord,
                MEAN_MOTION: 0,
            })
        ).toBeNull();
    });

    it("removes duplicate NORAD IDs and keeps the newest epoch", () => {
        const olderRecord = {
            ...validIssRecord,
            EPOCH: "2026-08-27T15:03:31.768992",
            MEAN_ANOMALY: 100,
        };

        const newerRecord = {
            ...validIssRecord,
            EPOCH: "2026-08-28T15:03:31.768992",
            MEAN_ANOMALY: 200,
        };

        const result = parseCelestrakOmmCatalog([
            olderRecord,
            newerRecord,
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].MEAN_ANOMALY).toBe(200);
    });

    it("throws when the top-level response is not an array", () => {
        expect(() =>
            parseCelestrakOmmCatalog({
                satellites: [],
            })
        ).toThrow(TypeError);
    });

    it("filters invalid records without rejecting the whole catalog", () => {
        const result = parseCelestrakOmmCatalog([
            validIssRecord,
            {
                ...validIssRecord,
                NORAD_CAT_ID: -1,
            },
            {
                invalid: true,
            },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].NORAD_CAT_ID).toBe(25544);
    });
});
