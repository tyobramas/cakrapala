import { describe, expect, it } from "vitest";
import { getSatelliteMedia } from "../../lib/satellites/satelliteMedia";

describe("Satellite Media Registry", () => {
    it("returns verified media metadata for flagship satellites", () => {
        const issMedia = getSatelliteMedia(25544);
        expect(issMedia).not.toBeNull();
        expect(issMedia?.noradId).toBe(25544);
        expect(issMedia?.src).toBe("/textures/satellites/iss.svg");
        expect(issMedia?.sourceName).toContain("NASA");
        expect(issMedia?.license).toBeDefined();

        const hubbleMedia = getSatelliteMedia(20580);
        expect(hubbleMedia).not.toBeNull();
        expect(hubbleMedia?.noradId).toBe(20580);
    });

    it("returns null for non-registered satellite IDs without error", () => {
        expect(getSatelliteMedia(999999)).toBeNull();
        expect(getSatelliteMedia(-1)).toBeNull();
        expect(getSatelliteMedia(null)).toBeNull();
        expect(getSatelliteMedia(undefined)).toBeNull();
    });
});
