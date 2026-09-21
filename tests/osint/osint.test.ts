import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// OSINT Module — Unit Tests
//
// 7 test areas required by spec:
//   1. Quake normaliser: lon/lat order (lon 130, lat -5)
//   2. Depth km → meters, null mag → severity 0
//   3. resolveDisplayMode at 500K and 3M boundaries
//   4. roundBBox / bboxKey deterministic & stable
//   5. Cache: TTL expiry + dedup in-flight
//   6. Adapter: no throw on upstream failure, error field populated
//   7. Route handler: 404 unknown, 409 disabled, 400 invalid bbox
//
// All network calls are mocked. No real USGS requests.
// ─────────────────────────────────────────────────────────────────────────────

import { normaliseQuakeFeature } from '../../lib/osint/layers/quake';
import { resolveDisplayMode, LAYER_REGISTRY } from '../../lib/osint/registry';
import { roundBBox, bboxKey } from '../../lib/osint/geo';
import { createCache } from '../../lib/osint/cache';
import { wrapAdapter } from '../../lib/osint/adapter';
import type { LayerPayload } from '../../lib/osint/types';

// ═══════════════════════════════════════════════════════════════════════════
// 1. Quake normaliser: lon/lat order NOT swapped
// ═══════════════════════════════════════════════════════════════════════════

describe('Quake normaliser — coordinate order', () => {
  it('correctly maps GeoJSON [lon, lat] to entity {lat, lon}', () => {
    const feature = {
      id: 'test-001',
      properties: {
        place: 'Near Banda Aceh',
        mag: 5.2,
        time: Date.now(),
      },
      geometry: {
        type: 'Point',
        coordinates: [130, -5, 10] as [number, number, number],
        // GeoJSON order: lon=130, lat=-5, depthKm=10
      },
    };

    const entity = normaliseQuakeFeature(feature);

    // lat should be -5 (second element of coordinates)
    expect(entity.position.lat).toBe(-5);
    // lon should be 130 (first element of coordinates)
    expect(entity.position.lon).toBe(130);
    // They must NOT be swapped
    expect(entity.position.lat).not.toBe(130);
    expect(entity.position.lon).not.toBe(-5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Depth km → meters, null mag → severity 0
// ═══════════════════════════════════════════════════════════════════════════

describe('Quake normaliser — depth and magnitude', () => {
  it('converts depth km to negative altM in meters', () => {
    const feature = {
      id: 'depth-test',
      properties: { place: 'Deep quake', mag: 3.0, time: Date.now() },
      geometry: {
        type: 'Point',
        coordinates: [100, 0, 25.5] as [number, number, number],
        // depth 25.5 km
      },
    };

    const entity = normaliseQuakeFeature(feature);

    // 25.5 km = 25500 m, stored as negative (below surface)
    expect(entity.position.altM).toBe(-25500);
  });

  it('treats null magnitude as severity 0', () => {
    const feature = {
      id: 'null-mag',
      properties: { place: 'Unknown', mag: null, time: Date.now() },
      geometry: {
        type: 'Point',
        coordinates: [0, 0, 0] as [number, number, number],
      },
    };

    const entity = normaliseQuakeFeature(feature);
    expect(entity.severity).toBe(0);
  });

  it('clamps severity to [0, 1]', () => {
    const feature = {
      id: 'big-mag',
      properties: { place: 'Big one', mag: 12, time: Date.now() },
      geometry: {
        type: 'Point',
        coordinates: [0, 0, 0] as [number, number, number],
      },
    };

    const entity = normaliseQuakeFeature(feature);
    expect(entity.severity).toBeLessThanOrEqual(1);
    expect(entity.severity).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. resolveDisplayMode at boundary values
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveDisplayMode', () => {
  it('returns aggregate above 3,000,000 m', () => {
    expect(resolveDisplayMode(3_000_001)).toBe('aggregate');
    expect(resolveDisplayMode(10_000_000)).toBe('aggregate');
  });

  it('returns icons at exactly 3,000,000 m', () => {
    expect(resolveDisplayMode(3_000_000)).toBe('icons');
  });

  it('returns icons between 500,000 and 3,000,000 m', () => {
    expect(resolveDisplayMode(1_500_000)).toBe('icons');
    expect(resolveDisplayMode(500_000)).toBe('icons');
  });

  it('returns detail below 500,000 m', () => {
    expect(resolveDisplayMode(499_999)).toBe('detail');
    expect(resolveDisplayMode(100)).toBe('detail');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. roundBBox / bboxKey deterministic & stable
// ═══════════════════════════════════════════════════════════════════════════

describe('roundBBox and bboxKey', () => {
  it('roundBBox is deterministic — same input → same output', () => {
    const bbox: [number, number, number, number] = [106.7, -6.3, 107.1, -6.1];
    const a = roundBBox(bbox);
    const b = roundBBox(bbox);
    expect(a).toEqual(b);
  });

  it('roundBBox snaps to grid', () => {
    const bbox: [number, number, number, number] = [106.7, -6.3, 107.1, -6.1];
    const rounded = roundBBox(bbox, 0.5);
    // west 106.7 → floor(106.7/0.5)*0.5 = 213*0.5 = 106.5
    expect(rounded[0]).toBe(106.5);
    // south -6.3 → floor(-6.3/0.5)*0.5 = -13*0.5 = -6.5
    expect(rounded[1]).toBe(-6.5);
    // east 107.1 → ceil(107.1/0.5)*0.5 = 215*0.5 = 107.5
    expect(rounded[2]).toBe(107.5);
    // north -6.1 → ceil(-6.1/0.5)*0.5 = -12*0.5 = -6.0
    expect(rounded[3]).toBe(-6);
  });

  it('bboxKey is stable for the same rounded bbox', () => {
    const bbox: [number, number, number, number] = [106.7, -6.3, 107.1, -6.1];
    const key1 = bboxKey(bbox);
    const key2 = bboxKey(bbox);
    expect(key1).toBe(key2);
    expect(typeof key1).toBe('string');
    expect(key1.length).toBeGreaterThan(0);
  });

  it('nearby but different bboxes that snap to the same grid produce the same key', () => {
    // Both west values floor to 106.5, south to -6.5, east ceil to 107.5, north to -6.0
    const a: [number, number, number, number] = [106.6, -6.3, 107.1, -6.1];
    const b: [number, number, number, number] = [106.7, -6.4, 107.2, -6.0];
    // Both should snap to same rounded bbox with step 0.5
    expect(bboxKey(a, 0.5)).toBe(bboxKey(b, 0.5));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Cache: TTL expiry + dedup in-flight
// ═══════════════════════════════════════════════════════════════════════════

describe('Cache', () => {
  it('returns undefined after TTL expires', async () => {
    const c = createCache();
    c.set('key1', 'value1', 50); // 50ms TTL
    expect(c.get('key1')).toBe('value1');

    // Wait for TTL to expire.
    await new Promise((r) => setTimeout(r, 60));
    expect(c.get('key1')).toBeUndefined();
  });

  it('dedup: two concurrent calls share one upstream fetch', async () => {
    const c = createCache();
    let fetchCount = 0;

    const factory = () => {
      fetchCount++;
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve('result'), 20);
      });
    };

    // Fire two concurrent dedup calls.
    const [r1, r2] = await Promise.all([
      c.dedup('shared', factory, 5000),
      c.dedup('shared', factory, 5000),
    ]);

    // Only one actual fetch should have occurred.
    expect(fetchCount).toBe(1);
    expect(r1).toBe('result');
    expect(r2).toBe('result');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Adapter: no throw on upstream failure, error field populated
// ═══════════════════════════════════════════════════════════════════════════

describe('Adapter wrapper', () => {
  it('does not throw when the upstream fetcher throws', async () => {
    const failingFetcher = vi.fn(async (): Promise<LayerPayload> => {
      throw new Error('Upstream is down');
    });

    const safeFetcher = wrapAdapter('quake', failingFetcher);
    const controller = new AbortController();

    // Should NOT throw.
    const result = await safeFetcher({ signal: controller.signal });

    expect(result.error).toBeTruthy();
    expect(result.error).toContain('Upstream is down');
    expect(result.entities).toEqual([]);
    expect(result.layer).toBe('quake');
  });

  it('populates fetchedAt even on error', async () => {
    const failingFetcher = vi.fn(async (): Promise<LayerPayload> => {
      throw new Error('timeout');
    });

    const safeFetcher = wrapAdapter('quake', failingFetcher);
    const controller = new AbortController();

    const result = await safeFetcher({ signal: controller.signal });
    expect(result.fetchedAt).toBeTruthy();
    // Should be a valid ISO date.
    expect(new Date(result.fetchedAt).getTime()).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Route handler: 404 unknown layer, 409 disabled, 400 invalid bbox
// ═══════════════════════════════════════════════════════════════════════════

describe('Route handler validation', () => {
  // We test the validation logic by importing the GET handler and
  // simulating NextRequest-like objects.

  // Lazy import to keep test module isolated.
  let GET: (
    request: Request & { nextUrl: URL; headers: Headers },
    ctx: { params: Promise<{ layer: string }> },
  ) => Promise<Response>;

  beforeEach(async () => {
    // Reset modules to reset rate limiter state.
    vi.resetModules();
    const mod = await import('../../app/api/osint/[layer]/route');
    GET = mod.GET as typeof GET;
  });

  function makeRequest(path: string, query = '') {
    const url = new URL(`http://localhost${path}${query ? `?${query}` : ''}`);
    return {
      nextUrl: url,
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      url: url.toString(),
    } as unknown as Parameters<typeof GET>[0];
  }

  it('returns 404 for unknown layer', async () => {
    const req = makeRequest('/api/osint/nonexistent');
    const res = await GET(req, {
      params: Promise.resolve({ layer: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('nonexistent');
  });

  it('returns 409 for disabled layer', async () => {
    const reg = await import('../../lib/osint/registry');
    const original = reg.LAYER_REGISTRY.quake.enabled;
    (reg.LAYER_REGISTRY.quake as { enabled: boolean }).enabled = false;
    try {
      const req = makeRequest('/api/osint/quake');
      const res = await GET(req, {
        params: Promise.resolve({ layer: 'quake' }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('not yet enabled');
    } finally {
      (reg.LAYER_REGISTRY.quake as { enabled: boolean }).enabled = original;
    }
  });

  it('returns 400 for invalid bbox', async () => {
    const req = makeRequest('/api/osint/quake', 'bbox=invalid');
    const res = await GET(req, {
      params: Promise.resolve({ layer: 'quake' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('bbox');
  });

  it('returns 400 for bbox with out-of-range latitude', async () => {
    const req = makeRequest('/api/osint/quake', 'bbox=0,-100,10,10');
    const res = await GET(req, {
      params: Promise.resolve({ layer: 'quake' }),
    });
    expect(res.status).toBe(400);
  });
});
