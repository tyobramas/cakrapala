import { describe, expect, it } from "vitest";
import {
    normalizeLongitudeDeg,
    prepareSatelliteCatalog,
    propagateSatelliteProfile,
} from "../../lib/satellites/catalogPropagation";
import type { SatelliteOmmRecord } from "../../lib/satellites/catalogTypes";

describe("SGP4 Satellite Profile Propagation", () => {
    const issOmm: SatelliteOmmRecord = {
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

    it("normalizes longitude degrees correctly within [-180, 180]", () => {
        expect(normalizeLongitudeDeg(0)).toBe(0);
        expect(normalizeLongitudeDeg(180)).toBe(180);
        expect(normalizeLongitudeDeg(-180)).toBe(-180);
        expect(normalizeLongitudeDeg(190)).toBe(-170);
        expect(normalizeLongitudeDeg(-190)).toBe(170);
        expect(normalizeLongitudeDeg(540)).toBe(180);
    });

    it("generates full 1-orbit profile for selected satellite with valid arrays", () => {
        const prepared = prepareSatelliteCatalog([issOmm])[0];
        expect(prepared.satrec).not.toBeNull();

        const startTimestamp = Date.now();
        const profile = propagateSatelliteProfile(
            prepared,
            startTimestamp,
            120,
            42
        );

        expect(profile.requestId).toBe(42);
        expect(profile.noradId).toBe(25544);
        expect(profile.timestamps).toHaveLength(120);
        expect(profile.positionsEcfKm).toHaveLength(360);
        expect(profile.altitudesKm).toHaveLength(120);
        expect(profile.speedsKmS).toHaveLength(120);
        expect(profile.latitudesDeg).toHaveLength(120);
        expect(profile.longitudesDeg).toHaveLength(120);
        expect(profile.valid).toHaveLength(120);

        // Verify timestamps are strictly increasing
        for (let i = 1; i < profile.timestamps.length; i += 1) {
            expect(profile.timestamps[i]).toBeGreaterThan(profile.timestamps[i - 1]);
        }

        // Verify physical ranges for ISS LEO
        let validSamples = 0;
        for (let i = 0; i < profile.valid.length; i += 1) {
            if (profile.valid[i] === 1) {
                validSamples += 1;
                expect(profile.altitudesKm[i]).toBeGreaterThan(300);
                expect(profile.altitudesKm[i]).toBeLessThan(600);
                expect(profile.speedsKmS[i]).toBeGreaterThan(7.0);
                expect(profile.speedsKmS[i]).toBeLessThan(8.0);
                expect(profile.latitudesDeg[i]).toBeGreaterThanOrEqual(-90);
                expect(profile.latitudesDeg[i]).toBeLessThanOrEqual(90);
                expect(profile.longitudesDeg[i]).toBeGreaterThanOrEqual(-180);
                expect(profile.longitudesDeg[i]).toBeLessThanOrEqual(180);
            }
        }

        expect(validSamples).toBeGreaterThan(110);
    });

    it("handles invalid or corrupt satrec gracefully without throwing", () => {
        const corruptPrepared = {
            noradId: 99999,
            satrec: null,
            epoch: new Date().toISOString(),
        };

        const profile = propagateSatelliteProfile(
            corruptPrepared,
            Date.now(),
            120,
            1
        );

        expect(profile.noradId).toBe(99999);
        expect(profile.valid[0]).toBe(0);
        expect(Number.isNaN(profile.altitudesKm[0])).toBe(true);
    });
});
