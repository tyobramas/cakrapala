import { describe, expect, it } from "vitest";
import { calculateOrbitalMetrics } from "../../lib/satellites/orbitalMetrics";

describe("Derived Orbital Metrics Calculator", () => {
    it("calculates LEO metrics accurately for ISS", () => {
        const omm = {
            MEAN_MOTION: 15.5,
            ECCENTRICITY: 0.0005,
            EPOCH: new Date(Date.now() - 3600 * 4000).toISOString(), // 4 hours ago
        };

        const metrics = calculateOrbitalMetrics(omm);
        expect(metrics.regime).toBe("LEO");
        expect(metrics.periodMinutes).toBeCloseTo(92.9, 1);
        expect(metrics.semiMajorAxisKm).toBeGreaterThan(6700);
        expect(metrics.semiMajorAxisKm).toBeLessThan(6900);
        expect(metrics.estimatedPerigeeKm).toBeGreaterThan(350);
        expect(metrics.estimatedPerigeeKm).toBeLessThan(450);
        expect(metrics.estimatedApogeeKm).toBeGreaterThan(350);
        expect(metrics.estimatedApogeeKm).toBeLessThan(450);
        expect(metrics.elementAgeHours).toBeCloseTo(4, 0.5);
    });

    it("calculates GEO metrics accurately for Geostationary satellite", () => {
        const omm = {
            MEAN_MOTION: 1.0027,
            ECCENTRICITY: 0.0001,
            EPOCH: new Date().toISOString(),
        };

        const metrics = calculateOrbitalMetrics(omm);
        expect(metrics.regime).toBe("GEO");
        expect(metrics.periodMinutes).toBeCloseTo(1436.1, 0.5);
        expect(metrics.semiMajorAxisKm).toBeCloseTo(42164, -2);
        expect(metrics.estimatedPerigeeKm).toBeCloseTo(35786, -2);
        expect(metrics.estimatedApogeeKm).toBeCloseTo(35786, -2);
    });

    it("classifies highly eccentric orbit as HEO", () => {
        const omm = {
            MEAN_MOTION: 2.005, // ~12 hour period
            ECCENTRICITY: 0.72, // Molniya orbit
            EPOCH: new Date().toISOString(),
        };

        const metrics = calculateOrbitalMetrics(omm);
        expect(metrics.regime).toBe("HEO");
        expect(metrics.estimatedPerigeeKm).toBeLessThan(2000);
        expect(metrics.estimatedApogeeKm).toBeGreaterThan(30000);
    });

    it("handles invalid or corrupt inputs safely without throwing NaN/Infinity", () => {
        const corruptOmm = {
            MEAN_MOTION: -5,
            ECCENTRICITY: 1.5,
            EPOCH: "invalid-date",
        };

        const metrics = calculateOrbitalMetrics(corruptOmm);
        expect(metrics.regime).toBe("LEO");
        expect(metrics.periodMinutes).toBe(0);
        expect(metrics.semiMajorAxisKm).toBe(0);
        expect(metrics.estimatedPerigeeKm).toBe(0);
        expect(metrics.estimatedApogeeKm).toBe(0);
        expect(metrics.elementAgeHours).toBeNull();
    });
});
