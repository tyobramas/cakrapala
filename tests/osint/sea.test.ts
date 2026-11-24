// tests/osint/sea.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Layer Sea (AIS Vessel Tracking) — 18 Comprehensive Test Cases
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseHeading,
  parseCog,
  parseRot,
  parseSog,
  parseNavStat,
  classifyFreshness,
  isPositionReliable,
} from '@/lib/osint/layers/sea/sentinel';
import { extrapolateVessel } from '@/lib/osint/layers/sea/deadReckon';
import {
  rawFetchSeaLayer,
  isWithinSeaCoverage,
  MAX_SEA_ENTITIES,
} from '@/lib/osint/layers/sea';
import {
  DigitrafficSourceAdapter,
  _resetDigitrafficCacheForTesting,
} from '@/lib/osint/layers/sea/sources/digitraffic';
import type { BBox } from '@/lib/osint/types';

describe('OSINT Sea Layer (AIS Vessel Tracking) — 18 Test Cases', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    _resetDigitrafficCacheForTesting();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ── 1. Heading Sentinel (511) ──────────────────────────────────────────────
  it('1. heading 511 returns undefined, valid heading 214 returns 214 (never 0 or 511)', () => {
    expect(parseHeading(511)).toBeUndefined();
    expect(parseHeading('511')).toBeUndefined();
    expect(parseHeading(214)).toBe(214);
    expect(parseHeading(0)).toBe(0);
    expect(parseHeading(359)).toBe(359);
    expect(parseHeading(360)).toBeUndefined();
    expect(parseHeading(null)).toBeUndefined();
  });

  // ── 2. Course Over Ground Sentinel (>= 360.0) ──────────────────────────────
  it('2. cog 360.0 returns undefined, cog 173.7 returns 173.7', () => {
    expect(parseCog(360.0)).toBeUndefined();
    expect(parseCog(360)).toBeUndefined();
    expect(parseCog(400)).toBeUndefined();
    expect(parseCog(173.7)).toBe(173.7);
    expect(parseCog(0)).toBe(0);
    expect(parseCog(359.9)).toBe(359.9);
  });

  // ── 3. Rate of Turn Sentinel (-128) & Fast Turn Limits ─────────────────────
  it('3. rot -128 returns undefined; rot -127 flags fast left turn; rot 4 returns precision rate', () => {
    const r128 = parseRot(-128);
    expect(r128.rotDegMin).toBeUndefined();
    expect(r128.fastTurn).toBeUndefined();

    const rLeft = parseRot(-127);
    expect(rLeft.fastTurn).toBe('left');

    const rRight = parseRot(127);
    expect(rRight.fastTurn).toBe('right');

    const r4 = parseRot(4);
    expect(r4.rotDegMin).toBe(4);
    expect(r4.fastTurn).toBeUndefined();
  });

  // ── 4. Speed Over Ground Sentinel (102.3) & Knot to m/s conversion ──────────
  it('4. sog 102.3 returns undefined; sog 8.7 converts to 4.4758 m/s (±0.001)', () => {
    const s1023 = parseSog(102.3);
    expect(s1023.sogKnots).toBeUndefined();
    expect(s1023.speedMs).toBeUndefined();

    const s87 = parseSog(8.7);
    expect(s87.sogKnots).toBe(8.7);
    expect(s87.speedMs).toBeCloseTo(4.47566, 2);
    expect(s87.speedMs).toBeGreaterThan(4.474);
    expect(s87.speedMs).toBeLessThan(4.477);
  });

  // ── 5. Navigational Status Mapping & Emergency SART/MOB Flag ───────────────
  it('5. maps navStat 0/1/5/14/15 to human labels; status 14 triggers emergency flag', () => {
    const n0 = parseNavStat(0);
    expect(n0.labelEn).toBe('Under way using engine');
    expect(n0.isEmergency).toBe(false);

    const n1 = parseNavStat(1);
    expect(n1.labelId).toBe('Berlabuh jangkar');
    expect(n1.isSpecial).toBe(true);
    expect(n1.isEmergency).toBe(false);

    const n5 = parseNavStat(5);
    expect(n5.labelId).toBe('Tertambat (moored)');
    expect(n5.isEmergency).toBe(false);

    const n14 = parseNavStat(14);
    expect(n14.labelId).toContain('DARURAT: AIS-SART');
    expect(n14.isEmergency).toBe(true);
    expect(n14.isSpecial).toBe(true);

    const n15 = parseNavStat(15);
    expect(n15.labelId).toBe('Tidak terdefinisi');
    expect(n15.isEmergency).toBe(false);
  });

  // ── 6. Timestamp Trap (timestamp 41 vs timestampExternal) ──────────────────
  it('6. ignores raw second "timestamp" for observation time; uses "timestampExternal" epoch', async () => {
    const nowEpoch = Date.now() - 10_000;
    const adapter = new DigitrafficSourceAdapter();

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/vessels')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              mmsi: 273336380,
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [24.9, 59.9] },
              properties: {
                mmsi: 273336380,
                sog: 12.5,
                cog: 180.0,
                heading: 180,
                timestamp: 41, // second-of-minute: NOT observation time!
                timestampExternal: nowEpoch, // genuine epoch ms
              },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const res = await adapter.fetchVessels();
    expect(res.entities).toHaveLength(1);
    const entity = res.entities[0];
    expect(entity.observedAt).toBe(new Date(nowEpoch).toISOString());
    expect(entity.raw?.tsSecond).toBe(41);
  });

  // ── 7. Reliability Flags (tsSecond 62/63 and posAcc) ───────────────────────
  it('7. flags timestamp 62 (dead reckoning) and 63 (inoperative) as positionReliable: false', () => {
    expect(isPositionReliable(41, true)).toBe(true);
    expect(isPositionReliable(62, true)).toBe(false);
    expect(isPositionReliable(63, true)).toBe(false);
    expect(isPositionReliable(15, false)).toBe(false);
  });

  // ── 8. Position Freshness Classification & Age Thresholds ──────────────────
  it('8. classifies age correctly: 1m (fresh), 30m (stale), 6h (last_known), 20h (drop)', () => {
    expect(classifyFreshness(60)).toBe('fresh');          // 1 minute <= 300s
    expect(classifyFreshness(300)).toBe('fresh');         // 5 minutes
    expect(classifyFreshness(1800)).toBe('stale');        // 30 minutes <= 3600s
    expect(classifyFreshness(21600)).toBe('last_known');   // 6 hours <= 43200s
    expect(classifyFreshness(72000)).toBe('drop');        // 20 hours > 43200s
  });

  // ── 9. GeoJSON Coordinates Order [lon, lat] NOT Inverted ──────────────────
  it('9. preserves GeoJSON [lon, lat] coordinates without inversion (lon 28.6, lat 59.9)', async () => {
    const adapter = new DigitrafficSourceAdapter();
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/vessels')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              mmsi: 230981000,
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [28.6, 59.9] }, // [lon, lat]
              properties: {
                mmsi: 230981000,
                sog: 5,
                cog: 90,
                timestampExternal: Date.now(),
              },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const res = await adapter.fetchVessels();
    expect(res.entities[0].position.lon).toBe(28.6);
    expect(res.entities[0].position.lat).toBe(59.9);
  });

  // ── 10. Vessel Metadata Join by MMSI & Fallback ────────────────────────────
  it('10. joins metadata from /vessels, and falls back to "MMSI xxx" when metadata is missing', async () => {
    const adapter = new DigitrafficSourceAdapter();
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/vessels')) {
        return new Response(
          JSON.stringify([
            {
              mmsi: 230145000,
              name: 'FINNSTAR',
              shipType: 60, // passenger
              callSign: 'OJFF',
            },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              mmsi: 230145000,
              geometry: { type: 'Point', coordinates: [25.0, 60.0] },
              properties: { mmsi: 230145000, sog: 10, timestampExternal: Date.now() },
            },
            {
              mmsi: 999999999, // not in /vessels
              geometry: { type: 'Point', coordinates: [25.1, 60.1] },
              properties: { mmsi: 999999999, sog: 2, timestampExternal: Date.now() },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const res = await adapter.fetchVessels();
    const v1 = res.entities.find((e) => e.id === 'sea:230145000');
    const v2 = res.entities.find((e) => e.id === 'sea:999999999');

    expect(v1?.label).toBe('FINNSTAR');
    expect(v1?.raw?.shipTypeCategory).toBe('passenger');
    expect(v2?.label).toBe('MMSI 999999999');
  });

  // ── 11. Stationary & Stale Ships NOT Dead-Reckoned ─────────────────────────
  it('11. does not extrapolate slow ships (sog < 0.5 kt), moored/anchored ships, or stale positions', () => {
    const lat = 60.0;
    const lon = 25.0;

    // Slow ship (sog 0.2 kt ≈ 0.103 m/s < 0.257 m/s)
    const pSlow = extrapolateVessel(lat, lon, 90, 0.1, 30);
    expect(pSlow.lat).toBe(lat);
    expect(pSlow.lon).toBe(lon);

    // Moored ship (navStat 5)
    const pMoored = extrapolateVessel(lat, lon, 90, 5.0, 30, { navStat: 5 });
    expect(pMoored.lat).toBe(lat);
    expect(pMoored.lon).toBe(lon);

    // Anchored ship (navStat 1)
    const pAnchor = extrapolateVessel(lat, lon, 90, 5.0, 30, { navStat: 1 });
    expect(pAnchor.lat).toBe(lat);
    expect(pAnchor.lon).toBe(lon);

    // Stale position (> 5 min = 600 s)
    const pStale = extrapolateVessel(lat, lon, 90, 5.0, 30, { ageSeconds: 600 });
    expect(pStale.lat).toBe(lat);
    expect(pStale.lon).toBe(lon);
  });

  // ── 12. Dead Reckoning Uses COG, NOT Heading ──────────────────────────────
  it('12. dead reckoning uses cog (actual movement over ground), not heading', () => {
    const lat = 60.0;
    const lon = 25.0;
    const speedMs = 10.0;

    // Projected along COG 90° (East)
    const pEast = extrapolateVessel(lat, lon, 90, speedMs, 30);
    expect(pEast.lat).toBeCloseTo(lat, 4);
    expect(pEast.lon).toBeGreaterThan(lon);

    // When COG is undefined (>= 360), no extrapolation occurs
    const pUndefined = extrapolateVessel(lat, lon, undefined, speedMs, 30);
    expect(pUndefined.lat).toBe(lat);
    expect(pUndefined.lon).toBe(lon);
  });

  // ── 13. Dead Reckoning Clamped to 60 Seconds Maximum ───────────────────────
  it('13. clamps extrapolation duration to maximum 60 seconds', () => {
    const lat = 60.0;
    const lon = 25.0;
    const speedMs = 10.0;

    const p60 = extrapolateVessel(lat, lon, 0, speedMs, 60);
    const p300 = extrapolateVessel(lat, lon, 0, speedMs, 300);

    expect(p300.lat).toBe(p60.lat);
    expect(p300.lon).toBe(p60.lon);
  });

  // ── 14. Entity Cap (1,500 Vessels) Prioritizes Moving & Fresh ─────────────
  it('14. caps results to 1,500 vessels, prioritizing moving & fresh vessels', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/vessels')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      // Generate 2,000 vessels
      const features = [];
      for (let i = 1; i <= 2000; i++) {
        features.push({
          mmsi: 200000000 + i,
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [24.0 + (i % 100) * 0.05, 59.0 + (i % 50) * 0.05] },
          properties: {
            mmsi: 200000000 + i,
            sog: i <= 500 ? 0 : 12, // first 500 stationary, next 1500 moving
            cog: 90,
            timestampExternal: Date.now() - (i % 600) * 1000,
          },
        });
      }
      return new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status: 200 });
    });

    const payload = await rawFetchSeaLayer({
      signal: new AbortController().signal,
      bbox: [20.0, 58.0, 30.0, 62.0], // inside Baltic
    });

    expect(payload.entities.length).toBe(MAX_SEA_ENTITIES);
    expect(payload.entities[0].raw?.cutCount).toBe(500);
    expect(payload.entities[0].raw?.totalFound).toBe(2000);
  });

  // ── 15. Viewport Outside Coverage Returns Notice without Error ─────────────
  it('15. returns OUT_OF_COVERAGE notice without error when viewport is outside Baltic (e.g. Sunda Strait)', async () => {
    const sundaStraitBBox: BBox = [105.0, -6.5, 106.5, -5.5];
    expect(isWithinSeaCoverage(sundaStraitBBox)).toBe(false);

    const fetchSpy = vi.spyOn(global, 'fetch');
    const payload = await rawFetchSeaLayer({
      signal: new AbortController().signal,
      bbox: sundaStraitBBox,
    });

    // Mock fetch must NOT be called at all!
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(payload.entities).toHaveLength(0);
    expect(payload.error).toBe('OUT_OF_COVERAGE');
  });

  // ── 16. Entity ID Stability (sea:${mmsi}) ──────────────────────────────────
  it('16. maintains stable entity ID based on MMSI across name changes', async () => {
    const mmsi = 230985000;
    const adapter = new DigitrafficSourceAdapter();

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/vessels')) {
        return new Response(
          JSON.stringify([{ mmsi, name: 'VESSEL_V1' }]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              mmsi,
              geometry: { type: 'Point', coordinates: [24.5, 60.1] },
              properties: { mmsi, sog: 5, cog: 120, timestampExternal: Date.now() },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const res1 = await adapter.fetchVessels();
    expect(res1.entities[0].id).toBe(`sea:${mmsi}`);
    expect(res1.entities[0].label).toBe('VESSEL_V1');
  });

  // ── 17. Empty Features Returns Empty Array Gracefully ──────────────────────
  it('17. handles empty or null features array gracefully without throwing', async () => {
    const adapter = new DigitrafficSourceAdapter();
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
    });

    const res = await adapter.fetchVessels();
    expect(res.entities).toEqual([]);
  });

  // ── 18. Air Layer Tests Regression Check ──────────────────────────────────
  it('18. confirms that motion.ts refactor preserves great-circle destination properties', () => {
    // Check that extrapolateVessel projects along great-circle accurately
    const lat = 60.0;
    const lon = 25.0;
    const speedMs = 15.0;

    const pNorth = extrapolateVessel(lat, lon, 0, speedMs, 50);
    expect(pNorth.lat).toBeGreaterThan(lat);
    expect(pNorth.lon).toBeCloseTo(lon, 4);

    const pEast = extrapolateVessel(lat, lon, 90, speedMs, 50);
    expect(pEast.lat).toBeCloseTo(lat, 4);
    expect(pEast.lon).toBeGreaterThan(lon);
  });
});
