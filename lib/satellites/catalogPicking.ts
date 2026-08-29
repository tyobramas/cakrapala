export interface CatalogSatellitePickMetadata {
    kind: "catalog-satellite";
    index: number;
    noradId: number;
}

/**
 * Type guard to check if an unknown value conforms to CatalogSatellitePickMetadata.
 */
export function isCatalogSatellitePick(
    value: unknown
): value is CatalogSatellitePickMetadata {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
        candidate.kind === "catalog-satellite" &&
        typeof candidate.noradId === "number" &&
        Number.isFinite(candidate.noradId) &&
        typeof candidate.index === "number" &&
        Number.isFinite(candidate.index)
    );
}

/**
 * Parse and validate satellite pick metadata from a picked object.
 * Checks both `picked.id` and `picked.primitive.id` if present.
 */
export function parseCatalogSatellitePick(
    picked: unknown
): CatalogSatellitePickMetadata | null {
    if (typeof picked !== "object" || picked === null) {
        return null;
    }

    // Direct metadata object
    if (isCatalogSatellitePick(picked)) {
        return picked;
    }

    const obj = picked as Record<string, unknown>;

    // Case 1: Cesium Scene.pick / drillPick result where id is the metadata
    if ("id" in obj && isCatalogSatellitePick(obj.id)) {
        return obj.id;
    }

    // Case 2: Cesium Primitive wrapped result where primitive.id is the metadata
    if (
        "primitive" in obj &&
        typeof obj.primitive === "object" &&
        obj.primitive !== null
    ) {
        const prim = obj.primitive as Record<string, unknown>;
        if ("id" in prim && isCatalogSatellitePick(prim.id)) {
            return prim.id;
        }
    }

    return null;
}

/**
 * Extracts the first valid satellite pick from a drillPick result array.
 * Optionally validates that the noradId belongs to an allowed set of active catalog IDs.
 */
export function extractFirstValidSatellitePick(
    drillPickResults: unknown,
    validNoradIds?: ReadonlySet<number> | null
): CatalogSatellitePickMetadata | null {
    if (!Array.isArray(drillPickResults) || drillPickResults.length === 0) {
        return null;
    }

    for (const item of drillPickResults) {
        const parsed = parseCatalogSatellitePick(item);
        if (parsed !== null) {
            if (validNoradIds && !validNoradIds.has(parsed.noradId)) {
                continue;
            }
            return parsed;
        }
    }

    return null;
}
