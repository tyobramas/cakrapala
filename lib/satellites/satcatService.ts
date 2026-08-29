import {
    CELESTRAK_ACTIVE_SATCAT_URL,
    parseSatcatCatalog,
} from "./satcatParser";
import type { SatelliteSatcatRecord, SatcatSourceInfo } from "./satcatTypes";
import type { SatelliteOmmRecord } from "./catalogTypes";

const SATCAT_CACHE_TTL_MS = 86_400 * 1000; // 24 hours

let cachedSatcatMap: Map<number, SatelliteSatcatRecord> | null = null;
let lastSatcatFetchTimestamp = 0;
let lastSatcatFetchSuccessful = false;

/**
 * Fetch the active SATCAT records in bulk from CelesTrak.
 * Never requests individual CATNR per satellite.
 */
async function fetchBulkSatcat(): Promise<SatelliteSatcatRecord[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
        const response = await fetch(CELESTRAK_ACTIVE_SATCAT_URL, {
            headers: {
                Accept: "application/json, text/plain, */*",
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            next: {
                revalidate: 86400,
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`CelesTrak SATCAT HTTP ${response.status}`);
        }

        const raw = (await response.json()) as unknown;
        return parseSatcatCatalog(raw);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Get or refresh the in-memory SATCAT Map<noradId, SatelliteSatcatRecord>.
 * Cached for 24 hours. If upstream fails, retains previous cache if available.
 */
export async function getSatcatMap(): Promise<{
    map: Map<number, SatelliteSatcatRecord>;
    sourceInfo: SatcatSourceInfo;
}> {
    const now = Date.now();

    if (
        cachedSatcatMap &&
        cachedSatcatMap.size > 0 &&
        now - lastSatcatFetchTimestamp < SATCAT_CACHE_TTL_MS
    ) {
        return {
            map: cachedSatcatMap,
            sourceInfo: {
                name: "CelesTrak SATCAT",
                url: CELESTRAK_ACTIVE_SATCAT_URL,
                fetchedAt: new Date(lastSatcatFetchTimestamp).toISOString(),
                available: true,
            },
        };
    }

    try {
        const records = await fetchBulkSatcat();
        if (records.length > 0) {
            const map = new Map<number, SatelliteSatcatRecord>();
            for (const rec of records) {
                map.set(rec.NORAD_CAT_ID, rec);
            }
            cachedSatcatMap = map;
            lastSatcatFetchTimestamp = now;
            lastSatcatFetchSuccessful = true;

            return {
                map,
                sourceInfo: {
                    name: "CelesTrak SATCAT",
                    url: CELESTRAK_ACTIVE_SATCAT_URL,
                    fetchedAt: new Date(now).toISOString(),
                    available: true,
                },
            };
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "SATCAT fetch failed";
        console.warn(`[satcatService] Bulk SATCAT fetch failed (${msg}).`);
    }

    // If fetch failed but we have stale cache, continue using it
    if (cachedSatcatMap && cachedSatcatMap.size > 0) {
        return {
            map: cachedSatcatMap,
            sourceInfo: {
                name: "CelesTrak SATCAT",
                url: CELESTRAK_ACTIVE_SATCAT_URL,
                fetchedAt: new Date(lastSatcatFetchTimestamp).toISOString(),
                available: lastSatcatFetchSuccessful,
            },
        };
    }

    // No SATCAT available
    return {
        map: new Map(),
        sourceInfo: {
            name: "CelesTrak SATCAT",
            url: CELESTRAK_ACTIVE_SATCAT_URL,
            fetchedAt: null,
            available: false,
        },
    };
}

/**
 * Join OMM records with SATCAT in O(n) time using Map lookup.
 */
export function joinOmmWithSatcat(
    ommRecords: readonly SatelliteOmmRecord[],
    satcatMap: ReadonlyMap<number, SatelliteSatcatRecord>
): SatelliteOmmRecord[] {
    return ommRecords.map((omm) => {
        const satcat = satcatMap.get(omm.NORAD_CAT_ID) ?? null;
        return {
            ...omm,
            SATCAT: satcat,
        };
    });
}
