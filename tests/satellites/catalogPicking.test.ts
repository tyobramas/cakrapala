import { describe, expect, it } from "vitest";
import {
    extractFirstValidSatellitePick,
    isCatalogSatellitePick,
    parseCatalogSatellitePick,
    type CatalogSatellitePickMetadata,
} from "../../lib/satellites/catalogPicking";

describe("catalogPicking", () => {
    describe("isCatalogSatellitePick", () => {
        it("returns true for valid metadata object", () => {
            const valid: CatalogSatellitePickMetadata = {
                kind: "catalog-satellite",
                index: 0,
                noradId: 25544,
            };
            expect(isCatalogSatellitePick(valid)).toBe(true);
        });

        it("returns false for non-object, null, or array inputs", () => {
            expect(isCatalogSatellitePick(null)).toBe(false);
            expect(isCatalogSatellitePick(undefined)).toBe(false);
            expect(isCatalogSatellitePick("string")).toBe(false);
            expect(isCatalogSatellitePick(123)).toBe(false);
            expect(isCatalogSatellitePick([])).toBe(false);
            expect(isCatalogSatellitePick([1, 2, 3])).toBe(false);
        });

        it("returns false when kind is missing or incorrect", () => {
            expect(
                isCatalogSatellitePick({
                    index: 0,
                    noradId: 25544,
                })
            ).toBe(false);

            expect(
                isCatalogSatellitePick({
                    kind: "star",
                    index: 0,
                    noradId: 25544,
                })
            ).toBe(false);
        });

        it("returns false when noradId is non-number or not finite", () => {
            expect(
                isCatalogSatellitePick({
                    kind: "catalog-satellite",
                    index: 0,
                    noradId: "25544",
                })
            ).toBe(false);

            expect(
                isCatalogSatellitePick({
                    kind: "catalog-satellite",
                    index: 0,
                    noradId: Number.NaN,
                })
            ).toBe(false);

            expect(
                isCatalogSatellitePick({
                    kind: "catalog-satellite",
                    index: 0,
                    noradId: Number.POSITIVE_INFINITY,
                })
            ).toBe(false);
        });

        it("returns false when index is non-number or not finite", () => {
            expect(
                isCatalogSatellitePick({
                    kind: "catalog-satellite",
                    index: "0",
                    noradId: 25544,
                })
            ).toBe(false);

            expect(
                isCatalogSatellitePick({
                    kind: "catalog-satellite",
                    index: Number.NaN,
                    noradId: 25544,
                })
            ).toBe(false);
        });
    });

    describe("parseCatalogSatellitePick", () => {
        it("extracts metadata from direct object", () => {
            const raw = {
                kind: "catalog-satellite" as const,
                index: 5,
                noradId: 48274,
            };
            expect(parseCatalogSatellitePick(raw)).toEqual(raw);
        });

        it("extracts metadata from pickedObject.id", () => {
            const picked = {
                id: {
                    kind: "catalog-satellite" as const,
                    index: 10,
                    noradId: 20580,
                },
                primitive: {},
            };
            expect(parseCatalogSatellitePick(picked)).toEqual({
                kind: "catalog-satellite",
                index: 10,
                noradId: 20580,
            });
        });

        it("extracts metadata from pickedObject.primitive.id", () => {
            const picked = {
                primitive: {
                    id: {
                        kind: "catalog-satellite" as const,
                        index: 25,
                        noradId: 33591,
                    },
                },
            };
            expect(parseCatalogSatellitePick(picked)).toEqual({
                kind: "catalog-satellite",
                index: 25,
                noradId: 33591,
            });
        });

        it("returns null for non-matching picked objects", () => {
            expect(parseCatalogSatellitePick(null)).toBeNull();
            expect(parseCatalogSatellitePick(undefined)).toBeNull();
            expect(parseCatalogSatellitePick("")).toBeNull();
            expect(parseCatalogSatellitePick({})).toBeNull();
            expect(parseCatalogSatellitePick({ id: "entity-1" })).toBeNull();
            expect(
                parseCatalogSatellitePick({
                    primitive: { id: { kind: "ground-station" } },
                })
            ).toBeNull();
        });
    });

    describe("extractFirstValidSatellitePick", () => {
        it("returns the first valid satellite from a drillPick array", () => {
            const results = [
                null,
                { id: "some-billboard" },
                {
                    id: {
                        kind: "catalog-satellite" as const,
                        index: 2,
                        noradId: 25544,
                    },
                },
                {
                    id: {
                        kind: "catalog-satellite" as const,
                        index: 3,
                        noradId: 48274,
                    },
                },
            ];

            const pick = extractFirstValidSatellitePick(results);
            expect(pick).toEqual({
                kind: "catalog-satellite",
                index: 2,
                noradId: 25544,
            });
        });

        it("returns null if drillPick array contains no valid satellites", () => {
            const results = [
                null,
                { id: "terrain" },
                { id: { kind: "satellite-orbit" } },
            ];

            expect(extractFirstValidSatellitePick(results)).toBeNull();
            expect(extractFirstValidSatellitePick([])).toBeNull();
            expect(extractFirstValidSatellitePick(null)).toBeNull();
            expect(extractFirstValidSatellitePick(undefined)).toBeNull();
        });

        it("filters out satellites not present in validNoradIds set", () => {
            const allowedSet = new Set([48274]);
            const results = [
                {
                    id: {
                        kind: "catalog-satellite" as const,
                        index: 1,
                        noradId: 25544, // Not in set
                    },
                },
                {
                    id: {
                        kind: "catalog-satellite" as const,
                        index: 2,
                        noradId: 48274, // In set
                    },
                },
            ];

            const pick = extractFirstValidSatellitePick(results, allowedSet);
            expect(pick?.noradId).toBe(48274);
        });

        it("returns null if none of the satellites match the allowed set", () => {
            const allowedSet = new Set([99999]);
            const results = [
                {
                    id: {
                        kind: "catalog-satellite" as const,
                        index: 1,
                        noradId: 25544,
                    },
                },
            ];

            expect(extractFirstValidSatellitePick(results, allowedSet)).toBeNull();
        });
    });
});
