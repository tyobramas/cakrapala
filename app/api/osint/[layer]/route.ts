// app/api/osint/[layer]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generic OSINT API route handler.
//
// GET /api/osint/:layer?bbox=w,s,e,n&alt=<meters>
//
// Validates layer against registry, enforces rate limiting, applies caching,
// and delegates to the appropriate layer adapter.
//
// SECURITY:
//   - Never leaks API keys or raw upstream error messages to the client.
//   - Rate limited: 60 requests per minute per IP (in-memory sliding window).
//     NOTE: This in-memory rate limiter resets on cold start and is per-process.
//     For production, replace with Upstash Redis rate limiting.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest } from 'next/server';
import { LAYER_REGISTRY, isValidLayerId } from '@/lib/osint/registry';
import { cache } from '@/lib/osint/cache';
import { roundBBox, bboxKey } from '@/lib/osint/geo';
import { fetchQuakeLayer } from '@/lib/osint/layers/quake';
import { fetchFireLayer } from '@/lib/osint/layers/fire';
import { fetchStormLayer } from '@/lib/osint/layers/storm';
import { fetchAirLayer } from '@/lib/osint/layers/air';
import { bboxToCenterRadius, roundCoord } from '@/lib/osint/layers/air/geo';
import type { BBox, LayerPayload } from '@/lib/osint/types';
import type { LayerFetcher } from '@/lib/osint/adapter';

// ── Layer adapter map ───────────────────────────────────────────────────────

const LAYER_FETCHERS: Partial<Record<string, LayerFetcher>> = {
  quake: fetchQuakeLayer,
  fire: fetchFireLayer,
  storm: fetchStormLayer,
  air: fetchAirLayer,
};

// ── Rate limiter (in-memory, sliding window) ────────────────────────────────
// NOTE: In-memory — resets on cold start, not shared across processes/regions.
// Replace with Upstash Redis for production use.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateLimitStore = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) ?? [];
  // Remove timestamps outside the window.
  const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(ip, valid);
    return true;
  }
  valid.push(now);
  rateLimitStore.set(ip, valid);
  return false;
}

// ── BBox validation (manual — no zod dependency) ────────────────────────────

function parseBBox(raw: string | null): BBox | null | 'invalid' {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return 'invalid';
  const [w, s, e, n] = parts;
  if (s < -90 || s > 90 || n < -90 || n > 90) return 'invalid';
  if (w < -180 || w > 180 || e < -180 || e > 180) return 'invalid';
  if (s > n) return 'invalid';
  return [w, s, e, n] as BBox;
}

function parseAlt(raw: string | null): number | null | 'invalid' {
  if (!raw) return null;
  const val = Number(raw);
  if (isNaN(val) || val < 0) return 'invalid';
  return val;
}

// ── GET handler ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layer: string }> },
) {
  // 1. Rate limit check.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Rate limit exceeded. Max 60 requests per minute.' },
      { status: 429 },
    );
  }

  // 2. Validate layer param.
  const { layer: layerParam } = await params;
  if (!isValidLayerId(layerParam)) {
    return Response.json(
      { error: `Unknown layer: "${layerParam}"` },
      { status: 404 },
    );
  }

  const config = LAYER_REGISTRY[layerParam];
  if (config.category === 'basemap' || layerParam === 'imagery') {
    return Response.json(
      {
        error: `Layer "${layerParam}" is a client-side WMTS basemap layer and cannot be fetched via API.`,
        layer: layerParam,
      },
      { status: 409 },
    );
  }

  if (!config.enabled) {
    return Response.json(
      {
        error: `Layer "${layerParam}" is not yet enabled. Coming soon.`,
        layer: layerParam,
      },
      { status: 409 },
    );
  }

  // 3. Validate query params.
  const { searchParams } = request.nextUrl;
  const bboxResult = parseBBox(searchParams.get('bbox'));
  if (bboxResult === 'invalid') {
    return Response.json(
      { error: 'Invalid bbox. Expected format: bbox=west,south,east,north (decimal degrees).' },
      { status: 400 },
    );
  }

  const altResult = parseAlt(searchParams.get('alt'));
  if (altResult === 'invalid') {
    return Response.json(
      { error: 'Invalid alt. Expected a non-negative number in meters.' },
      { status: 400 },
    );
  }

  // 4. Build cache key and handle layer-specific area constraints.
  const bbox = bboxResult ?? undefined;

  // Handle air layer viewport radius constraint
  if (layerParam === 'air') {
    if (bbox) {
      const cr = bboxToCenterRadius(bbox);
      if (cr.isTooLarge) {
        return Response.json({
          layer: 'air',
          entities: [],
          fetchedAt: new Date().toISOString(),
          upstreamAt: null,
          stale: false,
          error: 'AREA_TOO_LARGE',
        });
      }
    }
  }

  let roundedBBoxStr = 'global';
  if (layerParam === 'air' && bbox) {
    const cr = bboxToCenterRadius(bbox);
    const rLat = roundCoord(cr.centerLat, 0.25);
    const rLon = roundCoord(cr.centerLon, 0.25);
    roundedBBoxStr = `${rLat},${rLon}:r=${cr.radiusNm}`;
  } else if (!config.globalScope) {
    roundedBBoxStr = bbox ? bboxKey(roundBBox(bbox)) : 'global';
  }

  // Extract optional layer options (e.g. for fire & storm)
  const rangeParam = searchParams.get('range');
  const sourceParam = searchParams.get('source');
  const lowParam = searchParams.get('low');
  const nightParam = searchParams.get('night');
  const allPastParam = searchParams.get('allPast');

  let optSuffix = '';
  const fetchOptions: Record<string, unknown> = {};
  if (rangeParam) {
    optSuffix += `:r=${rangeParam}`;
    fetchOptions.dayRange = parseInt(rangeParam, 10);
  }
  if (sourceParam) {
    optSuffix += `:s=${sourceParam}`;
    fetchOptions.source = sourceParam;
  }
  if (lowParam === 'true' || lowParam === '1') {
    optSuffix += ':l=1';
    fetchOptions.includeLowConfidence = true;
  }
  if (nightParam === 'true' || nightParam === '1') {
    optSuffix += ':n=1';
    fetchOptions.nightOnly = true;
  }
  if (allPastParam === 'true' || allPastParam === '1') {
    optSuffix += ':allPast=1';
    fetchOptions.allPast = true;
  }

  const cacheKey = `osint:${layerParam}:${roundedBBoxStr}${optSuffix}`;

  // 5. Fetch (with cache + dedup).
  const fetcher = LAYER_FETCHERS[layerParam];
  if (!fetcher) {
    return Response.json(
      { error: `No adapter registered for layer "${layerParam}".` },
      { status: 500 },
    );
  }

  const payload = await cache.dedup<LayerPayload>(
    cacheKey,
    async () => {
      const controller = new AbortController();
      return fetcher({
        bbox,
        cameraAltM: altResult ?? undefined,
        signal: controller.signal,
        options: fetchOptions,
      });
    },
    config.ttlMs,
  );

  // 6. Build response with cache headers.
  const ttlSeconds = Math.round(config.ttlMs / 1000);
  const headers = new Headers({
    'Cache-Control': `s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
    'X-Osint-Fetched-At': payload.fetchedAt,
    'X-Osint-Stale': String(payload.stale),
  });

  return Response.json(payload, { headers });
}
