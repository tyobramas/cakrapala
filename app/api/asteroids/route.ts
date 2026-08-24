import { NextRequest, NextResponse } from "next/server";
import {
  AsteroidNeoObject,
  NeoFeedResponse,
} from "@/lib/asteroid/types";
import {
  enrichAsteroidObject,
  computeAsteroidSummary,
  VERIFIED_FALLBACK_ASTEROIDS,
} from "@/lib/asteroid/asteroidMath";

export const dynamic = "force-dynamic";

const NASA_API_BASE = "https://api.nasa.gov/neo/rest/v1";
const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

// In-memory cache for API requests to minimize NASA API rate-limit exhaustion
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const cacheStore = new Map<string, { timestamp: number; data: any }>();

function getFormattedDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const startDate = searchParams.get("start_date") || getFormattedDate(new Date());
    const endDate = searchParams.get("end_date") || startDate;

    // ── Single Asteroid Lookup by NASA ID ──────────────────────────────────────
    if (id) {
      const cacheKey = `neo_${id}`;
      const cached = cacheStore.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json({ success: true, source: "cache", asteroid: cached.data });
      }

      try {
        const res = await fetch(`${NASA_API_BASE}/neo/${id}?api_key=${NASA_API_KEY}`, {
          next: { revalidate: 3600 },
        });

        if (res.ok) {
          const rawData: AsteroidNeoObject = await res.json();
          const enriched = enrichAsteroidObject(rawData, 0, 1);
          cacheStore.set(cacheKey, { timestamp: Date.now(), data: enriched });
          return NextResponse.json({ success: true, source: "nasa_api", asteroid: enriched });
        }
      } catch (err) {
        console.warn("[NASA NeoWs] Single lookup failed, falling back to local dataset", err);
      }

      // Find in fallback dataset
      const fallback = VERIFIED_FALLBACK_ASTEROIDS.find((a) => a.id === id || a.neo_reference_id === id);
      if (fallback) {
        const enriched = enrichAsteroidObject(fallback, 0, 1);
        return NextResponse.json({ success: true, source: "fallback_verified", asteroid: enriched });
      }

      return NextResponse.json({ error: "Asteroid not found" }, { status: 404 });
    }

    // ── Date Range Feed Lookup ────────────────────────────────────────────────
    const feedCacheKey = `feed_${startDate}_${endDate}`;
    const cachedFeed = cacheStore.get(feedCacheKey);
    if (cachedFeed && Date.now() - cachedFeed.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedFeed.data);
    }

    let rawFeed: NeoFeedResponse | null = null;

    try {
      const apiUrl = `${NASA_API_BASE}/feed?start_date=${startDate}&end_date=${endDate}&api_key=${NASA_API_KEY}`;
      const res = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 1800 },
      });

      if (res.ok) {
        rawFeed = await res.json();
      } else {
        console.warn(`[NASA NeoWs] API responded with status ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      console.warn("[NASA NeoWs] Feed fetch failed:", err);
    }

    let allAsteroids: AsteroidNeoObject[] = [];

    if (rawFeed && rawFeed.near_earth_objects) {
      // Flatten all dates from feed
      const rawList: AsteroidNeoObject[] = [];
      Object.values(rawFeed.near_earth_objects).forEach((dayList) => {
        if (Array.isArray(dayList)) {
          rawList.push(...dayList);
        }
      });

      // Deduplicate by ID and enrich
      const uniqueMap = new Map<string, AsteroidNeoObject>();
      rawList.forEach((neo) => {
        if (!uniqueMap.has(neo.id)) {
          uniqueMap.set(neo.id, neo);
        }
      });

      const uniqueList = Array.from(uniqueMap.values());
      allAsteroids = uniqueList.map((neo, idx) => enrichAsteroidObject(neo, idx, uniqueList.length));
    } else {
      // Use verified fallback enriched dataset if NASA API is rate limited
      allAsteroids = VERIFIED_FALLBACK_ASTEROIDS.map((neo, idx) =>
        enrichAsteroidObject(neo, idx, VERIFIED_FALLBACK_ASTEROIDS.length)
      );
    }

    // Compute summary
    const summary = computeAsteroidSummary(allAsteroids, startDate);

    const payload = {
      success: true,
      source: rawFeed ? "nasa_api" : "fallback_verified",
      startDate,
      endDate,
      totalCount: allAsteroids.length,
      summary,
      asteroids: allAsteroids,
    };

    cacheStore.set(feedCacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Asteroid API Error]", error);

    const fallbackEnriched = VERIFIED_FALLBACK_ASTEROIDS.map((neo, idx) =>
      enrichAsteroidObject(neo, idx, VERIFIED_FALLBACK_ASTEROIDS.length)
    );
    const summary = computeAsteroidSummary(fallbackEnriched, getFormattedDate(new Date()));

    return NextResponse.json({
      success: true,
      source: "fallback_emergency",
      totalCount: fallbackEnriched.length,
      summary,
      asteroids: fallbackEnriched,
    });
  }
}
