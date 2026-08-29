import { NextRequest, NextResponse } from "next/server";
import {
    CELESTRAK_ACTIVE_OMM_URL,
    parseCelestrakOmmCatalog,
} from "@/lib/satellites/celestrakCatalog";
import type {
    SatelliteCatalogResponse,
    SatelliteOmmRecord,
} from "@/lib/satellites/catalogTypes";
import fallbackCatalogRaw from "@/lib/satellites/active_catalog_fallback.json";

export const runtime = "nodejs";
export const revalidate = 7200;
export const maxDuration = 30;

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 1000;
const REFRESH_INTERVAL_SECONDS = 7200;

// In-memory cache across requests
let cachedValidRecords: SatelliteOmmRecord[] | null = null;
let lastCacheTimestamp = 0;

function parseLimit(value: string | null): number {
    if (!value) {
        return DEFAULT_LIMIT;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
        return DEFAULT_LIMIT;
    }

    return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function getFallbackRecords(): SatelliteOmmRecord[] {
    try {
        const records = parseCelestrakOmmCatalog(fallbackCatalogRaw);
        if (records.length > 0) {
            return records;
        }
    } catch {
        // Ignored
    }
    return [];
}

async function fetchCelestrakCatalog(): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    try {
        const response = await fetch(CELESTRAK_ACTIVE_OMM_URL, {
            headers: {
                Accept: "application/json, text/plain, */*",
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            next: {
                revalidate: REFRESH_INTERVAL_SECONDS,
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(
                `CelesTrak request failed with HTTP ${response.status}`
            );
        }

        return (await response.json()) as unknown;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function GET(request: NextRequest) {
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const now = Date.now();

    let validRecords: SatelliteOmmRecord[] = [];
    let isLive = false;

    // 1. Check in-memory cache if still fresh within 2 hours
    if (
        cachedValidRecords &&
        cachedValidRecords.length > 0 &&
        now - lastCacheTimestamp < REFRESH_INTERVAL_SECONDS * 1000
    ) {
        validRecords = cachedValidRecords;
    } else {
        // 2. Attempt live fetch from CelesTrak
        try {
            const rawCatalog = await fetchCelestrakCatalog();
            const parsed = parseCelestrakOmmCatalog(rawCatalog);

            if (parsed.length > 0) {
                validRecords = parsed;
                cachedValidRecords = parsed;
                lastCacheTimestamp = now;
                isLive = true;
            }
        } catch (fetchError: unknown) {
            const errorMsg =
                fetchError instanceof Error
                    ? fetchError.message
                    : "Live fetch failed";
            console.warn(
                `[orbital-catalog] Live CelesTrak fetch failed (${errorMsg}), utilizing cached/bundled fallback.`
            );
        }
    }

    // 3. If live fetch failed and no memory cache, use pre-bundled snapshot
    if (validRecords.length === 0) {
        if (cachedValidRecords && cachedValidRecords.length > 0) {
            validRecords = cachedValidRecords;
        } else {
            validRecords = getFallbackRecords();
            cachedValidRecords = validRecords;
            lastCacheTimestamp = now;
        }
    }

    if (validRecords.length === 0) {
        return NextResponse.json(
            {
                error: "ORBITAL_CATALOG_UNAVAILABLE",
                message: "No orbital catalog records available.",
            },
            { status: 502 }
        );
    }

    const selectedRecords = validRecords.slice(0, limit);

    const payload: SatelliteCatalogResponse = {
        source: {
            name: "CelesTrak",
            format: "OMM JSON",
            url: isLive
                ? CELESTRAK_ACTIVE_OMM_URL
                : "https://celestrak.org/NORAD/elements/gp.php (Snapshot Fallback)",
        },
        group: "active",
        generatedAt: new Date().toISOString(),
        refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
        count: selectedRecords.length,
        totalAvailable: validRecords.length,
        satellites: selectedRecords,
    };

    return NextResponse.json(payload, {
        headers: {
            "Cache-Control":
                "public, s-maxage=7200, stale-while-revalidate=86400",
        },
    });
}

