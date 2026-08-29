import type {
    SatelliteCatalogResponse,
    SatelliteOmmRecord,
} from "./catalogTypes";

const CATALOG_CACHE_KEY = "cakrapala_active_satellites_catalog_v1";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface StoredCatalogCache {
    version: 1;
    savedAt: number;
    catalog: SatelliteCatalogResponse;
}

function getStorage(): Storage | null {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
        if (typeof localStorage !== "undefined") {
            return localStorage;
        }
    } catch {
        // Storage access error
    }
    return null;
}

/**
 * Synchronously load valid cached catalog from localStorage if available and unexpired.
 */
export function loadCachedCatalog(): SatelliteCatalogResponse | null {
    const storage = getStorage();
    if (!storage) {
        return null;
    }

    try {
        const raw = storage.getItem(CATALOG_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed: unknown = JSON.parse(raw);
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "savedAt" in parsed &&
            "catalog" in parsed
        ) {
            const cache = parsed as StoredCatalogCache;
            const isFresh = Date.now() - cache.savedAt < MAX_CACHE_AGE_MS;
            const hasValidSatellites =
                Array.isArray(cache.catalog?.satellites) &&
                cache.catalog.satellites.length > 0;

            if (isFresh && hasValidSatellites) {
                return cache.catalog;
            }
        }
    } catch {
        // Storage error or quota restriction
    }

    return null;
}

/**
 * Save the latest valid catalog to localStorage.
 */
export function saveCachedCatalog(catalog: SatelliteCatalogResponse): void {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    try {
        if (
            !catalog ||
            !Array.isArray(catalog.satellites) ||
            catalog.satellites.length === 0
        ) {
            return;
        }

        const cache: StoredCatalogCache = {
            version: 1,
            savedAt: Date.now(),
            catalog,
        };

        storage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Storage disabled or quota exceeded
    }
}

/**
 * Convert parsed snapshot records into a standard SatelliteCatalogResponse.
 */
export function createSnapshotCatalogResponse(
    records: readonly SatelliteOmmRecord[]
): SatelliteCatalogResponse {
    return {
        source: {
            name: "CelesTrak",
            format: "OMM JSON",
            url: "/data/active-satellites-1000.json",
        },
        metadataSource: {
            name: "CelesTrak SATCAT",
            url: "https://celestrak.org/pub/satcat.json",
            fetchedAt: null,
            available: false,
        },
        group: "active",
        generatedAt: new Date().toISOString(),
        refreshIntervalSeconds: 7200,
        count: records.length,
        totalAvailable: records.length,
        satellites: [...records],
    };
}
