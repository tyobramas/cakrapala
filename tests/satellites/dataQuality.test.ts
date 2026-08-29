import { describe, expect, it } from "vitest";
import { assessDataQuality } from "../../lib/satellites/dataQuality";
import type { SatelliteOmmRecord } from "../../lib/satellites/catalogTypes";

describe("Data Quality Assessment", () => {
    const baseOmm: SatelliteOmmRecord = {
        OBJECT_NAME: "ISS (ZARYA)",
        OBJECT_ID: "1998-067A",
        EPOCH: new Date().toISOString(),
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

    it("classifies <= 24h element as FRESH with 100% completeness", () => {
        const omm = {
            ...baseOmm,
            EPOCH: new Date(Date.now() - 6 * 3600 * 1000).toISOString(), // 6 hours old
        };

        const report = assessDataQuality(omm, true);
        expect(report.freshnessCategory).toBe("FRESH");
        expect(report.freshnessColor).toBe("emerald");
        expect(report.fieldCompletenessPercent).toBe(100);
        expect(report.propagationStatus).toBe("VALID");
        expect(report.disclaimer).toBe("Freshness describes element age, not guaranteed positional accuracy.");
    });

    it("classifies older epochs as AGING, STALE, and VERY_STALE", () => {
        const agingOmm = {
            ...baseOmm,
            EPOCH: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48h
        };
        expect(assessDataQuality(agingOmm, true).freshnessCategory).toBe("AGING");

        const staleOmm = {
            ...baseOmm,
            EPOCH: new Date(Date.now() - 120 * 3600 * 1000).toISOString(), // 5 days
        };
        expect(assessDataQuality(staleOmm, true).freshnessCategory).toBe("STALE");

        const veryStaleOmm = {
            ...baseOmm,
            EPOCH: new Date(Date.now() - 300 * 3600 * 1000).toISOString(), // 12.5 days
        };
        expect(assessDataQuality(veryStaleOmm, true).freshnessCategory).toBe("VERY_STALE");
    });
});
