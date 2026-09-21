import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// OSINT Module — NASA FIRMS Active Fire Unit Tests
//
// 11 test areas required by spec:
//   1. Parser: VIIRS & MODIS schemas pass (small fixtures with headers)
//   2. Confidence: 'l'/'n'/'h' and 0/45/95 → normalised properly
//   3. Acquisition time: '45', '130', '0000', '2359' → correct ISO UTC
//   4. Coordinate order: lat/lon NOT swapped (lat -2.5, lon 118.0)
//   5. Severity: FRP 0, 5, 50, 500, 5000, NaN, null → monotonic, in [0, 1], NaN → 0.15
//   6. ID stability: two parses of identical CSV → identical ID set
//   7. Area rejection: bbox 100°x100° → error 'AREA_TOO_LARGE', mock fetch NOT called
//   8. Missing key: without FIRMS_MAP_KEY → error 'MISSING_KEY', no throw, no env leak
//   9. Grid caching: two bboxes differing by 0.1° → EXACTLY 1 upstream call
//   10. Empty CSV / header-only → entities [] without error
//   11. Malformed CSV rows → skipped, valid rows parsed, no throw
// ─────────────────────────────────────────────────────────────────────────────

import {
  parseFirmsCsv,
  normalizeConfidence,
  formatAcquisitionIso,
  calculateFrpSeverity,
} from '../../lib/osint/layers/fire/parse';
import {
  fetchFireLayer,
  isBBoxAreaAllowed,
} from '../../lib/osint/layers/fire';
import { cache } from '../../lib/osint/cache';

// ── Test Fixtures ────────────────────────────────────────────────────────────

const VIIRS_CSV_FIXTURE = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
-2.5000,118.0000,340.5,0.4,0.4,2026-09-20,130,N20,VIIRS,nominal,2.0NRT,290.1,15.4,N
-3.1000,115.2000,367.2,0.38,0.37,2026-09-20,0045,N20,VIIRS,h,2.0NRT,298.5,84.2,D
-1.2000,116.8000,310.0,0.5,0.5,2026-09-20,2359,N20,VIIRS,l,2.0NRT,280.0,3.1,N`;

const MODIS_CSV_FIXTURE = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
-2.5000,118.0000,325.4,1.1,1.0,2026-09-20,45,Terra,MODIS,85,6.1NRT,295.2,42.0,D
-0.8000,117.1000,312.0,1.2,1.1,2026-09-20,0000,Aqua,MODIS,15,6.1NRT,288.0,8.5,N`;

// ═══════════════════════════════════════════════════════════════════════════
// 1. Parser: VIIRS & MODIS Schemas
// ═══════════════════════════════════════════════════════════════════════════

describe('NASA FIRMS CSV Parser — Schema Compatibility', () => {
  it('successfully parses VIIRS CSV schema', () => {
    const entities = parseFirmsCsv(VIIRS_CSV_FIXTURE, { includeLowConfidence: true });
    expect(entities).toHaveLength(3);

    const first = entities[0];
    expect(first.layer).toBe('fire');
    expect(first.kind).toBe('event');
    expect(first.position.lat).toBe(-2.5);
    expect(first.position.lon).toBe(118.0);
    expect(first.label).toBe('15 MW · N20');
    expect(first.source).toBe('NASA FIRMS / VIIRS N20');
  });

  it('successfully parses MODIS CSV schema', () => {
    const entities = parseFirmsCsv(MODIS_CSV_FIXTURE, { includeLowConfidence: true });
    expect(entities).toHaveLength(2);

    const first = entities[0];
    expect(first.layer).toBe('fire');
    expect(first.position.lat).toBe(-2.5);
    expect(first.position.lon).toBe(118.0);
    expect(first.label).toBe('42 MW · Terra');
    expect(first.source).toBe('NASA FIRMS / MODIS Terra');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Confidence Normalisation (VIIRS vs MODIS)
// ═══════════════════════════════════════════════════════════════════════════

describe('Confidence Normalisation', () => {
  it('normalises VIIRS categorical strings', () => {
    expect(normalizeConfidence('l')).toBe('low');
    expect(normalizeConfidence('low')).toBe('low');
    expect(normalizeConfidence('n')).toBe('nominal');
    expect(normalizeConfidence('nominal')).toBe('nominal');
    expect(normalizeConfidence('h')).toBe('high');
    expect(normalizeConfidence('high')).toBe('high');
  });

  it('normalises MODIS numeric scores (<30 low, 30..80 nominal, >80 high)', () => {
    expect(normalizeConfidence('0')).toBe('low');
    expect(normalizeConfidence('29')).toBe('low');
    expect(normalizeConfidence('30')).toBe('nominal');
    expect(normalizeConfidence('45')).toBe('nominal');
    expect(normalizeConfidence('80')).toBe('nominal');
    expect(normalizeConfidence('81')).toBe('high');
    expect(normalizeConfidence('95')).toBe('high');
    expect(normalizeConfidence('100')).toBe('high');
  });

  it('filters out low confidence by default', () => {
    // VIIRS fixture has 1 low, 1 nominal, 1 high
    const filtered = parseFirmsCsv(VIIRS_CSV_FIXTURE);
    expect(filtered).toHaveLength(2);
    expect(filtered.some((e) => (e.raw as { confidence?: string })?.confidence === 'low')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Acquisition Time Padding & ISO UTC Formatting
// ═══════════════════════════════════════════════════════════════════════════

describe('Acquisition Time Formatting', () => {
  it('correctly pads and converts acq_time: 45, 130, 0000, 2359', () => {
    expect(formatAcquisitionIso('2026-09-20', '45')).toBe('2026-09-20T00:45:00.000Z');
    expect(formatAcquisitionIso('2026-09-20', '130')).toBe('2026-09-20T01:30:00.000Z');
    expect(formatAcquisitionIso('2026-09-20', '0000')).toBe('2026-09-20T00:00:00.000Z');
    expect(formatAcquisitionIso('2026-09-20', '2359')).toBe('2026-09-20T23:59:00.000Z');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Coordinate Order (lat/lon NOT swapped)
// ═══════════════════════════════════════════════════════════════════════════

describe('Coordinate Order Validation', () => {
  it('maps CSV latitude and longitude correctly without swapping', () => {
    const csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
-2.5000,118.0000,340.5,0.4,0.4,2026-09-20,130,N20,VIIRS,h,2.0NRT,290.1,15.4,N`;

    const [entity] = parseFirmsCsv(csv);
    expect(entity.position.lat).toBe(-2.5);
    expect(entity.position.lon).toBe(118.0);
    expect(entity.position.lat).not.toBe(118.0);
    expect(entity.position.lon).not.toBe(-2.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Severity FRP Scaling
// ═══════════════════════════════════════════════════════════════════════════

describe('FRP Severity Scaling', () => {
  it('produces monotonically increasing scores in [0, 1]', () => {
    const s0 = calculateFrpSeverity(0);
    const s5 = calculateFrpSeverity(5);
    const s50 = calculateFrpSeverity(50);
    const s500 = calculateFrpSeverity(500);
    const s5000 = calculateFrpSeverity(5000);

    expect(s0).toBe(0);
    expect(s5).toBeGreaterThan(s0);
    expect(s50).toBeGreaterThan(s5);
    expect(s500).toBeGreaterThan(s50);
    expect(s500).toBeCloseTo(1.0, 4);
    expect(s5000).toBe(1.0); // Clamped at 1.0
  });

  it('falls back to 0.15 for NaN or null FRP', () => {
    expect(calculateFrpSeverity(NaN)).toBe(0.15);
    expect(calculateFrpSeverity(null)).toBe(0.15);
    expect(calculateFrpSeverity(undefined)).toBe(0.15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. ID Synthesis & Stability (Jebakan D)
// ═══════════════════════════════════════════════════════════════════════════

describe('ID Synthesis & Stability', () => {
  it('produces identical IDs on multiple parses of the same CSV', () => {
    const run1 = parseFirmsCsv(VIIRS_CSV_FIXTURE, { includeLowConfidence: true });
    const run2 = parseFirmsCsv(VIIRS_CSV_FIXTURE, { includeLowConfidence: true });

    expect(run1.map((e) => e.id)).toEqual(run2.map((e) => e.id));
    expect(run1[0].id).toBe('firms:N20:2026-09-20T0130:-2.5000:118.0000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Area Rejection (100° x 100° → AREA_TOO_LARGE, NO fetch called)
// ═══════════════════════════════════════════════════════════════════════════

describe('Area Limit Rejection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects bbox larger than 60°x60° and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // 100° x 100° bbox
    const largeBBox: [number, number, number, number] = [0, -50, 100, 50];
    expect(isBBoxAreaAllowed(largeBBox)).toBe(false);

    const controller = new AbortController();
    const payload = await fetchFireLayer({
      bbox: largeBBox,
      signal: controller.signal,
    });

    expect(payload.error).toBe('AREA_TOO_LARGE');
    expect(payload.entities).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects call when bbox is undefined without calling fetch', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const controller = new AbortController();
    const payload = await fetchFireLayer({
      signal: controller.signal,
    });

    expect(payload.error).toBe('AREA_TOO_LARGE');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Missing Key Handling
// ═══════════════════════════════════════════════════════════════════════════

describe('Missing FIRMS_MAP_KEY', () => {
  const originalEnv = process.env.FIRMS_MAP_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.FIRMS_MAP_KEY;
  });

  afterEach(() => {
    process.env.FIRMS_MAP_KEY = originalEnv;
    global.fetch = originalFetch;
  });

  it('soft-fails with MISSING_KEY and does not leak env var name', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const controller = new AbortController();
    const payload = await fetchFireLayer({
      bbox: [110, -5, 115, 0],
      signal: controller.signal,
    });

    expect(payload.error).toBe('MISSING_KEY');
    expect(payload.entities).toEqual([]);
    expect(payload.error).not.toContain('FIRMS_MAP_KEY');
    expect(payload.error).not.toContain('process.env');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Grid-based Caching (0.1° pan hits the same cache key)
// ═══════════════════════════════════════════════════════════════════════════

describe('Grid Caching for Fire Layer', () => {
  const originalEnv = process.env.FIRMS_MAP_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.FIRMS_MAP_KEY = 'test-mock-key';
    (cache as unknown as { _clear(): void })._clear();
  });

  afterEach(() => {
    process.env.FIRMS_MAP_KEY = originalEnv;
    global.fetch = originalFetch;
  });

  it('shares single upstream call for bboxes differing by 0.1° due to 0.5° grid rounding', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(VIIRS_CSV_FIXTURE),
    });
    global.fetch = mockFetch;

    const routeMod = await import('../../app/api/osint/[layer]/route');
    const GET = routeMod.GET;

    // First request at bbox [110.1, -2.1, 115.1, 1.1]
    const req1 = {
      nextUrl: new URL('http://localhost/api/osint/fire?bbox=110.1,-2.1,115.1,1.1'),
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      url: 'http://localhost/api/osint/fire?bbox=110.1,-2.1,115.1,1.1',
    } as unknown as Parameters<typeof GET>[0];

    const res1 = await GET(req1, { params: Promise.resolve({ layer: 'fire' }) });
    expect(res1.status).toBe(200);

    // Second request shifted slightly by 0.1° (e.g. slight map pan)
    // [110.2, -2.2, 115.2, 1.2] rounds to identical 0.5° grid: [110, -2.5, 115.5, 1.5]
    const req2 = {
      nextUrl: new URL('http://localhost/api/osint/fire?bbox=110.2,-2.2,115.2,1.2'),
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      url: 'http://localhost/api/osint/fire?bbox=110.2,-2.2,115.2,1.2',
    } as unknown as Parameters<typeof GET>[0];

    const res2 = await GET(req2, { params: Promise.resolve({ layer: 'fire' }) });
    expect(res2.status).toBe(200);

    // EXACTLY 1 upstream fetch call occurred because grid cache hit
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Empty CSV / Header-Only Handling
// ═══════════════════════════════════════════════════════════════════════════

describe('Empty CSV Handling', () => {
  it('returns empty entities array for empty CSV or header-only CSV without throwing', () => {
    expect(parseFirmsCsv('')).toEqual([]);
    expect(parseFirmsCsv('   \n  ')).toEqual([]);

    const headerOnly = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n';
    expect(parseFirmsCsv(headerOnly)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Malformed CSV Rows Resilience
// ═══════════════════════════════════════════════════════════════════════════

describe('Malformed CSV Rows Resilience', () => {
  it('skips malformed rows and parses valid rows without throwing', () => {
    const malformedCsv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
corrupted,line
-2.5000,not_a_number,340.5,0.4,0.4,2026-09-20,130,N20,VIIRS,h,2.0NRT,290.1,15.4,N
-3.1000,115.2000,367.2,0.38,0.37,2026-09-20,0045,N20,VIIRS,h,2.0NRT,298.5,84.2,D
short
`;

    const entities = parseFirmsCsv(malformedCsv);
    expect(entities).toHaveLength(1);
    expect(entities[0].position.lat).toBe(-3.1);
    expect(entities[0].position.lon).toBe(115.2);
  });
});
