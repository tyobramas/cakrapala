import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    loadCachedCatalog,
    saveCachedCatalog,
    createSnapshotCatalogResponse,
} from "../../lib/satellites/catalogStorage";
import type { SatelliteOmmRecord } from "../../lib/satellites/catalogTypes";

const mockSampleRecord: SatelliteOmmRecord = {
    OBJECT_NAME: "TEST SAT",
    OBJECT_ID: "2026-001A",
    EPOCH: "2026-08-28T12:00:00.000000",
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.0001,
    INCLINATION: 51.6,
    RA_OF_ASC_NODE: 120.0,
    ARG_OF_PERICENTER: 45.0,
    MEAN_ANOMALY: 180.0,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: "U",
    NORAD_CAT_ID: 99999,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 100,
    BSTAR: 0.0001,
    MEAN_MOTION_DOT: 0.00001,
    MEAN_MOTION_DDOT: 0,
    SATCAT: null,
};

describe("catalogStorage", () => {
    beforeEach(() => {
        // Mock localStorage
        const store: Record<string, string> = {};
        vi.stubGlobal("localStorage", {
            getItem: (key: string) => store[key] ?? null,
            setItem: (key: string, value: string) => {
                store[key] = value;
            },
            removeItem: (key: string) => {
                delete store[key];
            },
            clear: () => {
                for (const key of Object.keys(store)) {
                    delete store[key];
                }
            },
        });
    });

    it("creates a well-formed snapshot catalog response", () => {
        const response = createSnapshotCatalogResponse([mockSampleRecord]);

        expect(response.group).toBe("active");
        expect(response.count).toBe(1);
        expect(response.satellites[0].NORAD_CAT_ID).toBe(99999);
        expect(response.source.name).toBe("CelesTrak");
    });

    it("saves and loads catalog from localStorage", () => {
        const response = createSnapshotCatalogResponse([mockSampleRecord]);

        saveCachedCatalog(response);

        const loaded = loadCachedCatalog();
        expect(loaded).not.toBeNull();
        expect(loaded?.count).toBe(1);
        expect(loaded?.satellites[0].OBJECT_NAME).toBe("TEST SAT");
    });

    it("returns null when cache is empty", () => {
        const loaded = loadCachedCatalog();
        expect(loaded).toBeNull();
    });
});
