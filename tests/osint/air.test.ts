import { describe, it, expect, vi } from 'vitest';
import {
  parseAdsbPayload,
  resolveAircraftHeading,
} from '../../lib/osint/layers/air/parse';
import {
  extrapolate,
  shortestAngleDiff,
} from '../../lib/osint/layers/air/deadReckon';
import {
  bboxToCenterRadius,
  haversineDistKm,
} from '../../lib/osint/layers/air/geo';
import { rawFetchAirLayer } from '../../lib/osint/layers/air';

// ─────────────────────────────────────────────────────────────────────────────
// OSINT Module — Air Layer Unit Tests (16 test cases per spec)
// All tests use mock data; NO calls to api.adsb.lol.
// ─────────────────────────────────────────────────────────────────────────────

describe('OSINT Air Layer — 16 Test Cases', () => {
  // ── 1. alt_baro 'ground' → onGround true, altM 0, tidak NaN
  it('1. parses alt_baro "ground" as onGround: true and altM: 0 without producing NaN', () => {
    const raw = {
      ac: [
        {
          hex: '8a04a7',
          flight: 'GA123   ',
          alt_baro: 'ground',
          lat: -6.12,
          lon: 106.65,
          seen_pos: 1.0,
        },
      ],
    };

    const parsed = parseAdsbPayload(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].onGround).toBe(true);
    expect(parsed[0].altM).toBe(0);
    expect(isNaN(parsed[0].altM)).toBe(false);
  });

  // ── 2. alt_baro number → meter benar; alt_baro hilang → fallback alt_geom
  it('2. converts numeric alt_baro to meters correctly and falls back to alt_geom when alt_baro is missing', () => {
    const raw = {
      ac: [
        {
          hex: '8a0001',
          flight: 'AIR1    ',
          alt_baro: 10000, // 10000 ft * 0.3048 = 3048 m
          lat: -6.0,
          lon: 106.0,
          seen_pos: 1.0,
        },
        {
          hex: '8a0002',
          flight: 'AIR2    ',
          alt_baro: null,
          alt_geom: 12000, // fallback: 12000 ft * 0.3048 = 3657.6 m
          lat: -6.1,
          lon: 106.1,
          seen_pos: 1.0,
        },
      ],
    };

    const parsed = parseAdsbPayload(raw);
    expect(parsed[0].altM).toBeCloseTo(3048, 1);
    expect(parsed[0].onGround).toBe(false);

    expect(parsed[1].altM).toBeCloseTo(3657.6, 1);
    expect(parsed[1].onGround).toBe(false);
  });

  // ── 3. flight 'CTV918  ' → label 'CTV918'; flight kosong → fallback ke registrasi lalu hex
  it('3. trims flight callsigns and falls back to registration then hex if empty', () => {
    const raw = {
      ac: [
        {
          hex: '8a04a7',
          flight: 'CTV918  ',
          r: 'PK-GQD',
          lat: -5.8,
          lon: 106.2,
          seen_pos: 1.0,
        },
        {
          hex: '8a0999',
          flight: '   ',
          r: 'PK-XYZ',
          lat: -5.9,
          lon: 106.3,
          seen_pos: 1.0,
        },
        {
          hex: '8a0888',
          flight: '',
          r: null,
          lat: -6.0,
          lon: 106.4,
          seen_pos: 1.0,
        },
      ],
    };

    const parsed = parseAdsbPayload(raw);
    expect(parsed[0].label).toBe('CTV918');
    expect(parsed[1].label).toBe('PK-XYZ');
    expect(parsed[2].label).toBe('8A0888');
  });

  // ── 4. seen_pos 5 / 60 / 300 → segar / redup-tanpa-DR / dibuang
  it('4. filters and flags seen_pos correctly (<=30s fresh, <=120s stale, >120s dropped)', () => {
    const raw = {
      ac: [
        { hex: '111111', seen_pos: 5, lat: 0, lon: 0 },
        { hex: '222222', seen_pos: 60, lat: 0, lon: 0 },
        { hex: '333333', seen_pos: 300, lat: 0, lon: 0 }, // > 120s -> dropped
      ],
    };

    const parsed = parseAdsbPayload(raw);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].hex).toBe('111111');
    expect(parsed[0].fresh).toBe(true);

    expect(parsed[1].hex).toBe('222222');
    expect(parsed[1].fresh).toBe(false);
  });

  // ── 5. dbFlags bitwise: 0, 1, 3, 8 → isMilitary true hanya untuk 1 dan 3
  it('5. evaluates bitwise military flag (dbFlags & 1 === 1)', () => {
    const raw = {
      ac: [
        { hex: 'a0', dbFlags: 0, lat: 0, lon: 0, seen_pos: 1 },
        { hex: 'a1', dbFlags: 1, lat: 0, lon: 0, seen_pos: 1 }, // bit 0 set
        { hex: 'a3', dbFlags: 3, lat: 0, lon: 0, seen_pos: 1 }, // bit 0 and 1 set
        { hex: 'a8', dbFlags: 8, lat: 0, lon: 0, seen_pos: 1 }, // bit 3 set, bit 0 clear
      ],
    };

    const parsed = parseAdsbPayload(raw);
    expect(parsed.find((a) => a.hex === 'a0')?.isMilitary).toBe(false);
    expect(parsed.find((a) => a.hex === 'a1')?.isMilitary).toBe(true);
    expect(parsed.find((a) => a.hex === 'a3')?.isMilitary).toBe(true);
    expect(parsed.find((a) => a.hex === 'a8')?.isMilitary).toBe(false);
  });

  // ── 6. Prioritas heading: track ada → pakai track; hanya mag_heading → pakai itu; tidak ada → undefined (bukan 0)
  it('6. resolves heading priority (track -> true_heading -> mag_heading -> undefined, never 0)', () => {
    expect(resolveAircraftHeading({ hex: '1', track: 120.5, true_heading: 122, mag_heading: 121 })).toBe(120.5);
    expect(resolveAircraftHeading({ hex: '2', true_heading: 240, mag_heading: 238 })).toBe(240);
    expect(resolveAircraftHeading({ hex: '3', mag_heading: 95 })).toBe(95);
    expect(resolveAircraftHeading({ hex: '4' })).toBeUndefined();
  });

  // ── 7. Konversi knot → m/s (398.6 kt ≈ 205.06 m/s) dan feet → m (17925 ft ≈ 5463.6 m)
  it('7. converts knots to m/s and feet to meters accurately', () => {
    const raw = {
      ac: [
        {
          hex: '8a04a7',
          gs: 398.6,
          alt_baro: 17925,
          lat: 0,
          lon: 0,
          seen_pos: 1,
        },
      ],
    };

    const parsed = parseAdsbPayload(raw);
    expect(parsed[0].speedMs).toBeCloseTo(205.06, 1);
    expect(parsed[0].altM).toBeCloseTo(5463.54, 1);
  });

  // ── 8. extrapolate(): heading 0° menambah lat; heading 90° menambah lon; lat 60° lon delta lebih besar dari equator
  it('8. extrapolates using spherical great-circle trigonometry, showing larger lon delta at 60° latitude', () => {
    const speedMs = 250; // ~500 knots
    const dt = 20; // 20 seconds

    // Northbound at equator
    const north = extrapolate(0, 0, 0, speedMs, dt);
    expect(north.lat).toBeGreaterThan(0);
    expect(north.lon).toBeCloseTo(0, 4);

    // Eastbound at equator (lat 0)
    const eastEquator = extrapolate(0, 0, 90, speedMs, dt);
    const lonDeltaEquator = eastEquator.lon - 0;

    // Eastbound at 60° latitude
    const east60 = extrapolate(60, 0, 90, speedMs, dt);
    const lonDelta60 = east60.lon - 0;

    // At 60° lat, parallel circumference is cos(60°) = 0.5 of equator,
    // so delta lon must be approximately double that of equator!
    expect(lonDelta60).toBeGreaterThan(lonDeltaEquator * 1.8);
  });

  // ── 9. extrapolate() dengan dt 120 s → dibatasi pada 30 s
  it('9. clamps extrapolation duration to a maximum of 30 seconds', () => {
    const speedMs = 200;
    const res30 = extrapolate(10, 106, 90, speedMs, 30);
    const res120 = extrapolate(10, 106, 90, speedMs, 120);

    expect(res120.lat).toBeCloseTo(res30.lat, 5);
    expect(res120.lon).toBeCloseTo(res30.lon, 5);
  });

  // ── 10. Interpolasi heading 349° → 3° menghasilkan jalur terpendek (+14°)
  it('10. calculates shortest angular difference across 0°/360° boundary (349° to 3° is +14°)', () => {
    const diff = shortestAngleDiff(349, 3);
    expect(diff).toBe(14);

    const diffReverse = shortestAngleDiff(3, 349);
    expect(diffReverse).toBe(-14);
  });

  // ── 11. bbox → (center, radius): radius dibulatkan naik ke kelipatan 25 nm; viewport luas → radius > 250 nm → 'AREA_TOO_LARGE' DAN mock fetch tidak dipanggil
  it('11. converts bbox to rounded center and radius, returning AREA_TOO_LARGE without network call if radius > 250 nm', async () => {
    // Large viewport (e.g. 10° x 10° ~ 600 nm)
    const largeBbox: [number, number, number, number] = [100, -10, 110, 0];
    const crLarge = bboxToCenterRadius(largeBbox);
    expect(crLarge.isTooLarge).toBe(true);

    const mockFetch = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const payload = await rawFetchAirLayer({
        bbox: largeBbox,
        signal: new AbortController().signal,
      });

      expect(payload.error).toBe('AREA_TOO_LARGE');
      expect(payload.entities).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Small viewport (e.g. Jakarta ~ 30 nm)
    const smallBbox: [number, number, number, number] = [106.5, -6.4, 107.0, -6.0];
    const crSmall = bboxToCenterRadius(smallBbox);
    expect(crSmall.isTooLarge).toBe(false);
    expect(crSmall.radiusNm % 25).toBe(0);
  });

  // ── 12. Cache: dua center berselisih 0,05° dengan radius sama → SATU panggilan upstream
  it('12. demonstrates grid rounding to 0.25° where centers differing by 0.05° produce identical cache key', () => {
    const bbox1: [number, number, number, number] = [106.75, -6.25, 106.85, -6.15];
    const bbox2: [number, number, number, number] = [106.80, -6.20, 106.90, -6.10]; // shifted by 0.05°

    const cr1 = bboxToCenterRadius(bbox1);
    const cr2 = bboxToCenterRadius(bbox2);

    const rLat1 = Number((Math.round(cr1.centerLat / 0.25) * 0.25).toFixed(4));
    const rLon1 = Number((Math.round(cr1.centerLon / 0.25) * 0.25).toFixed(4));

    const rLat2 = Number((Math.round(cr2.centerLat / 0.25) * 0.25).toFixed(4));
    const rLon2 = Number((Math.round(cr2.centerLon / 0.25) * 0.25).toFixed(4));

    expect(rLat1).toBe(rLat2);
    expect(rLon1).toBe(rLon2);
    expect(cr1.radiusNm).toBe(cr2.radiusNm);
  });

  // ── 13. Hasil 2.000 pesawat → dipotong ke 1.200 terdekat berdasarkan dst
  it('13. caps results to 1,200 nearest aircraft when upstream returns 2,000 aircraft', async () => {
    const fakeAircraft = Array.from({ length: 2000 }, (_, i) => ({
      hex: `hex_${i}`,
      lat: -6.0 + i * 0.001,
      lon: 106.0 + i * 0.001,
      dst: 2000 - i, // inverted distance: hex_1999 has dst 1, hex_0 has dst 2000
      seen_pos: 1,
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ac: fakeAircraft, now: Date.now() }),
    });

    try {
      const payload = await rawFetchAirLayer({
        bbox: [106.5, -6.3, 106.9, -6.1],
        signal: new AbortController().signal,
      });

      expect(payload.entities).toHaveLength(1200);
      expect(payload.entities[0].raw?.prunedCount).toBe(800);
      // Ensure nearest aircraft are retained (hex_1999 has lowest dst)
      expect(payload.entities[0].id).toBe('air:hex_1999');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 14. Stabilitas id: dua polling dengan hex sama tapi callsign berubah → id tetap sama
  it('14. maintains stable entity ID based on ICAO24 hex even if callsign changes across polls', () => {
    const poll1 = parseAdsbPayload({
      ac: [{ hex: '8a04a7', flight: 'GA123   ', lat: -6.2, lon: 106.8, seen_pos: 1 }],
    });
    const poll2 = parseAdsbPayload({
      ac: [{ hex: '8a04a7', flight: 'GA999   ', lat: -6.25, lon: 106.85, seen_pos: 1 }],
    });

    const id1 = `air:${poll1[0].hex}`;
    const id2 = `air:${poll2[0].hex}`;

    expect(id1).toBe('air:8a04a7');
    expect(id2).toBe('air:8a04a7');
    expect(id1).toBe(id2);
  });

  // ── 15. Respons tanpa field 'now' → observedAt tetap dihitung wajar
  it('15. handles missing "now" field gracefully using Date.now() fallback', () => {
    const raw = {
      ac: [{ hex: '8a04a7', lat: -6.2, lon: 106.8, seen_pos: 5 }],
      // 'now' field intentionally omitted
    };

    const before = Date.now() - 6000;
    const parsed = parseAdsbPayload(raw);
    const after = Date.now();

    expect(parsed).toHaveLength(1);
    const observedEpoch = new Date(parsed[0].observedAt).getTime();
    expect(observedEpoch).toBeGreaterThanOrEqual(before);
    expect(observedEpoch).toBeLessThanOrEqual(after);
  });

  // ── 16. Respons 'ac' kosong / null → entities [] tanpa throw
  it('16. returns empty entities array without throwing when "ac" is empty, null, or missing', () => {
    expect(parseAdsbPayload({ ac: [] })).toEqual([]);
    expect(parseAdsbPayload({ ac: null })).toEqual([]);
    expect(parseAdsbPayload({})).toEqual([]);
    expect(parseAdsbPayload(null)).toEqual([]);
  });
});
