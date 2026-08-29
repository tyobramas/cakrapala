import { describe, expect, it } from "vitest";
import { calculateOrbitalFingerprint } from "../../lib/satellites/orbitalFingerprint";
import type { SatelliteOmmRecord } from "../../lib/satellites/catalogTypes";

describe("Orbital Fingerprint Calculator", () => {
    const sampleOmm: SatelliteOmmRecord = {
        OBJECT_NAME: "ISS (ZARYA)",
        OBJECT_ID: "1998-067A",
        EPOCH: new Date(Date.now() - 3600 * 6000).toISOString(),
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
    };

    it("generates 7 normalized axes strictly bound within [0, 1]", () => {
        const result = calculateOrbitalFingerprint(sampleOmm);
        expect(result.axes).toHaveLength(7);
        expect(result.disclaimer).toBe("Normalized orbital characteristics, not a collision-risk score.");

        const expectedAxisIds = [
            "altitude",
            "inclination",
            "eccentricity",
            "period",
            "drag",
            "freshness",
            "coverage",
        ];

        for (const axis of result.axes) {
            expect(expectedAxisIds).toContain(axis.id);
            expect(axis.normalizedValue).toBeGreaterThanOrEqual(0);
            expect(axis.normalizedValue).toBeLessThanOrEqual(1);
            expect(typeof axis.formattedValue).toBe("string");
            expect(typeof axis.description).toBe("string");
            expect(axis.unit).toBeDefined();
        }
    });
});
