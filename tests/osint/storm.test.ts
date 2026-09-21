import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseNhcPayload } from '../../lib/osint/layers/storm/nhc';
import {
  parseGdacsPayload,
  parseGdacsDate,
} from '../../lib/osint/layers/storm/gdacs';
import {
  mergeStormSources,
  calculateStormSeverity,
  haversineDistanceKm,
} from '../../lib/osint/layers/storm/merge';
import { splitPolylineAtAntimeridian } from '../../lib/osint/layers/storm/geometry';
import { rawFetchStormLayer } from '../../lib/osint/layers/storm';

// ─────────────────────────────────────────────────────────────────────────────
// OSINT Module — Storm Layer Unit Tests (14 test cases per spec)
// All tests use mocks; NO real network calls to NHC or GDACS.
// ─────────────────────────────────────────────────────────────────────────────

describe('OSINT Storm Layer — 14 Test Cases', () => {
  // ── 1. Parser NHC: intensity/pressure string → number, empty values safe
  it('1. parses NHC string intensity and pressure into numbers and handles empty/non-numeric values safely', () => {
    const raw = {
      activeStorms: [
        {
          id: 'al062026',
          name: 'Fay',
          classification: 'TS',
          intensity: '60',
          pressure: '995',
          latitudeNumeric: 34.1,
          longitudeNumeric: -31.9,
          lastUpdate: '2026-09-21T03:00:00.000Z',
        },
        {
          id: 'ep992026',
          name: 'Mystery',
          classification: 'TD',
          intensity: '', // empty
          pressure: 'invalid', // non-numeric
          latitudeNumeric: 15.0,
          longitudeNumeric: -120.0,
        },
      ],
    };

    const parsed = parseNhcPayload(raw);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].windKt).toBe(60);
    expect(parsed[0].pressureMb).toBe(995);

    expect(parsed[1].windKt).toBe(0);
    expect(parsed[1].pressureMb).toBeNull();
  });

  // ── 2. Konversi knot → m/s benar (60 kt ≈ 30.87 m/s)
  it('2. converts knots to m/s correctly (60 kt ≈ 30.87 m/s)', () => {
    const raw = {
      activeStorms: [
        {
          id: 'al062026',
          name: 'Fay',
          classification: 'TS',
          intensity: '60',
          latitudeNumeric: 34.1,
          longitudeNumeric: -31.9,
        },
      ],
    };

    const parsed = parseNhcPayload(raw);
    expect(parsed[0].windMs).toBeCloseTo(30.8666, 2);
  });

  // ── 3. Konversi km/h → m/s benar (111.1104 km/h ≈ 30.86 m/s)
  it('3. converts GDACS km/h to m/s correctly (111.1104 km/h ≈ 30.86 m/s)', () => {
    const raw = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-31.9, 34.1] },
          properties: {
            eventid: 1001323,
            episodeid: 7,
            eventname: 'FAY-26',
            alertlevel: 'Green',
            iscurrent: 'true',
            severitydata: {
              severity: 111.1104,
            },
          },
        },
      ],
    };

    const parsed = parseGdacsPayload(raw);
    expect(parsed[0].windMs).toBeCloseTo(30.864, 2);
  });

  // ── 4. latitudeNumeric/longitudeNumeric dipakai, bukan string "34.1N"
  it('4. uses latitudeNumeric and longitudeNumeric, not string representations', () => {
    const raw = {
      activeStorms: [
        {
          id: 'al062026',
          name: 'Fay',
          classification: 'TS',
          latitude: '34.1N',
          longitude: '31.9W',
          latitudeNumeric: 34.1,
          longitudeNumeric: -31.9, // signed, negative for West
        },
      ],
    };

    const parsed = parseNhcPayload(raw);
    expect(parsed[0].lat).toBe(34.1);
    expect(parsed[0].lon).toBe(-31.9);
  });

  // ── 5. GDACS: coordinates [lon, lat] TIDAK tertukar (uji lon 137.6, lat 30.4)
  it('5. preserves GeoJSON [lon, lat] coordinate order without swapping (lon 137.6, lat 30.4)', () => {
    const raw = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [137.6, 30.4] }, // GeoJSON: lon, lat
          properties: {
            eventid: 1001322,
            episodeid: 21,
            eventname: 'DUJUAN-26',
            alertlevel: 'Green',
            iscurrent: 'true',
          },
        },
      ],
    };

    const parsed = parseGdacsPayload(raw);
    expect(parsed[0].lon).toBe(137.6);
    expect(parsed[0].lat).toBe(30.4);
  });

  // ── 6. parseGdacsDate menambahkan 'Z': jalankan dengan TZ berbeda dan buktikan hasil ISO identik
  it('6. appends Z so parseGdacsDate is strictly timezone-independent', () => {
    const dateStr = '2026-09-21T03:00:00';
    const parsedIso = parseGdacsDate(dateStr);

    // Must strictly equal UTC ISO string
    expect(parsedIso).toBe('2026-09-21T03:00:00.000Z');

    // Simulate different timezone parsing
    const originalTZ = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Jakarta';
      const jakartaResult = parseGdacsDate(dateStr);

      process.env.TZ = 'UTC';
      const utcResult = parseGdacsDate(dateStr);

      expect(jakartaResult).toBe(utcResult);
      expect(jakartaResult).toBe('2026-09-21T03:00:00.000Z');
    } finally {
      process.env.TZ = originalTZ;
    }
  });

  // ── 7. iscurrent "false" diperlakukan sebagai false (bukan truthy)
  it('7. treats iscurrent string "false" as false, excluding concluded storms by default', () => {
    const raw = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-143.1, 20.5] },
          properties: {
            eventid: 1001320,
            episodeid: 24,
            eventname: 'NORBERT-26',
            alertlevel: 'Green',
            iscurrent: 'false', // STRING "false"
          },
        },
      ],
    };

    const parsedDefault = parseGdacsPayload(raw, { allPast: false });
    expect(parsedDefault).toHaveLength(0);

    const parsedAllPast = parseGdacsPayload(raw, { allPast: true });
    expect(parsedAllPast).toHaveLength(1);
    expect(parsedAllPast[0].isCurrent).toBe(false);
  });

  // ── 8. Dedup: fixture Fay dari NHC + GDACS → TEPAT SATU entitas
  it('8. deduplicates Fay from NHC + GDACS into exactly ONE entity with NHC telemetry and GDACS alert level', () => {
    const nhcStorms = [
      {
        id: 'al062026',
        name: 'Fay',
        classification: 'TS',
        windKt: 60,
        windMs: 30.87,
        pressureMb: 995,
        lat: 34.1,
        lon: -31.9,
        movementDir: 120,
        movementSpeedKt: 5,
        movementSpeedMs: 2.57,
        lastUpdate: '2026-09-21T03:00:00.000Z',
        advisoryNum: '007',
        advisoryUrl: 'https://nhc/advisory',
        raw: { id: 'al062026' } as any,
      },
    ];

    const gdacsStorms = [
      {
        eventId: 1001323,
        episodeId: 7,
        eventName: 'FAY-26',
        displayName: 'Tropical Cyclone FAY-26',
        alertLevel: 'Orange' as const,
        alertScore: 1.5,
        isCurrent: true,
        lat: 34.1,
        lon: -31.9,
        windKmh: 111.11,
        windMs: 30.86,
        source: 'NOAA',
        fromDate: '2026-09-19T15:00:00.000Z',
        toDate: '2026-09-21T03:00:00.000Z',
        dateModified: '2026-09-21T06:20:32.000Z',
        affectedCountries: [],
        geometryUrl: 'https://gdacs/geom',
        reportUrl: 'https://gdacs/report',
        raw: { properties: { eventid: 1001323 } } as any,
      },
    ];

    const merged = mergeStormSources(nhcStorms, gdacsStorms);
    expect(merged).toHaveLength(1);

    const storm = merged[0];
    // Stable ID uses NHC ID
    expect(storm.id).toBe('storm:nhc:al062026');
    // Position from NHC
    expect(storm.position.lat).toBe(34.1);
    expect(storm.position.lon).toBe(-31.9);
    // Alert level from GDACS
    expect(storm.raw.alertLevel).toBe('Orange');
    // Telemetry from NHC
    expect(storm.raw.pressureMb).toBe(995);
    expect(storm.source).toBe('NOAA NHC + GDACS');
  });

  // ── 9. Dedup jarak: dua badai berbeda berjarak 500 km → tetap DUA entitas
  it('9. preserves two distinct storms when distance > 150 km', () => {
    const nhcStorms = [
      {
        id: 'ep162026',
        name: 'Odalys',
        classification: 'TS',
        windKt: 45,
        windMs: 23.15,
        pressureMb: 1002,
        lat: 13.1,
        lon: -127.7,
        movementDir: 290,
        movementSpeedKt: 9,
        movementSpeedMs: 4.63,
        lastUpdate: '2026-09-21T03:00:00.000Z',
        advisoryNum: '004',
        advisoryUrl: null,
        raw: {} as any,
      },
    ];

    const gdacsStorms = [
      {
        eventId: 1001399,
        episodeId: 1,
        eventName: 'SEPARATE-STORM',
        displayName: 'Separate Storm',
        alertLevel: 'Green' as const,
        alertScore: 1,
        isCurrent: true,
        lat: 18.0, // ~550 km away
        lon: -127.7,
        windKmh: 65,
        windMs: 18,
        source: 'JTWC',
        fromDate: null,
        toDate: null,
        dateModified: '2026-09-21T03:00:00.000Z',
        affectedCountries: [],
        geometryUrl: null,
        reportUrl: null,
        raw: {} as any,
      },
    ];

    const merged = mergeStormSources(nhcStorms, gdacsStorms);
    expect(merged).toHaveLength(2);
  });

  // ── 10. Stabilitas id: episodeid berubah 7 → 8 → id entitas TIDAK berubah
  it('10. ensures entity ID is stable when GDACS episodeid increments from 7 to 8', () => {
    const gdacsStormEp7 = [
      {
        eventId: 1001323,
        episodeId: 7,
        eventName: 'DUJUAN-26',
        displayName: 'Tropical Cyclone DUJUAN-26',
        alertLevel: 'Green' as const,
        alertScore: 1,
        isCurrent: true,
        lat: 30.4,
        lon: 137.6,
        windKmh: 120,
        windMs: 33.3,
        source: 'JTWC',
        fromDate: null,
        toDate: null,
        dateModified: '2026-09-20T12:00:00.000Z',
        affectedCountries: [],
        geometryUrl: null,
        reportUrl: null,
        raw: {} as any,
      },
    ];

    const gdacsStormEp8 = [
      {
        ...gdacsStormEp7[0],
        episodeId: 8, // updated episode
        dateModified: '2026-09-21T00:00:00.000Z',
      },
    ];

    const merged1 = mergeStormSources([], gdacsStormEp7);
    const merged2 = mergeStormSources([], gdacsStormEp8);

    expect(merged1[0].id).toBe('storm:gdacs:1001323');
    expect(merged2[0].id).toBe('storm:gdacs:1001323');
    expect(merged1[0].id).toBe(merged2[0].id);
  });

  // ── 11. activeStorms: [] dan features: [] → entities [] tanpa error
  it('11. returns empty entities array without error when upstream payloads are empty', () => {
    const parsedNhc = parseNhcPayload({ activeStorms: [] });
    expect(parsedNhc).toEqual([]);

    const parsedGdacs = parseGdacsPayload({ type: 'FeatureCollection', features: [] });
    expect(parsedGdacs).toEqual([]);

    const merged = mergeStormSources(parsedNhc, parsedGdacs);
    expect(merged).toEqual([]);
  });

  // ── 12. Satu sumber gagal (NHC 500) → layer tetap mengembalikan data GDACS, degradasi lunak
  it('12. performs soft degradation when NHC fails (HTTP 500), returning GDACS data without throwing', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('nhc.noaa.gov')) {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }
      if (url.includes('gdacs.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [137.6, 30.4] },
                  properties: {
                    eventid: 1001322,
                    episodeid: 21,
                    eventname: 'DUJUAN-26',
                    alertlevel: 'Green',
                    iscurrent: 'true',
                    severitydata: { severity: 129.6 },
                  },
                },
              ],
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    try {
      const controller = new AbortController();
      const payload = await rawFetchStormLayer({
        signal: controller.signal,
      });

      expect(payload.entities).toHaveLength(1);
      expect(payload.entities[0].label).toContain('DUJUAN');
      expect(payload.error).toContain('NOAA NHC data unavailable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 13. severity monoton naik untuk angin 15, 30, 50, 80, 120 m/s, selalu [0, 1]
  it('13. calculates monotonically increasing severity clamped to [0, 1]', () => {
    const windSpeeds = [15, 30, 50, 80, 120];
    const severities = windSpeeds.map(calculateStormSeverity);

    for (let i = 0; i < severities.length - 1; i++) {
      expect(severities[i + 1]).toBeGreaterThanOrEqual(severities[i]);
    }

    for (const s of severities) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }

    expect(calculateStormSeverity(80)).toBe(1.0);
    expect(calculateStormSeverity(120)).toBe(1.0); // clamped
    expect(calculateStormSeverity(0)).toBe(0);
    expect(calculateStormSeverity(NaN)).toBe(0);
  });

  // ── 14. Polyline melintasi antimeridian tidak menghasilkan koordinat melompat
  it('14. splits polylines crossing the antimeridian to prevent visual jumps across the globe', () => {
    // East to West crossing (e.g. 179 to -179)
    const crossingLine: [number, number][] = [
      [178.0, 10.0],
      [179.0, 11.0],
      [-179.0, 12.0],
      [-178.0, 13.0],
    ];

    const segments = splitPolylineAtAntimeridian(crossingLine);
    expect(segments).toHaveLength(2);

    // Segment 1 ends at +180
    const seg1 = segments[0];
    expect(seg1[seg1.length - 1][0]).toBe(180);

    // Segment 2 starts at -180
    const seg2 = segments[1];
    expect(seg2[0][0]).toBe(-180);

    // Verify within each segment there is no jump > 180°
    for (const seg of segments) {
      for (let i = 0; i < seg.length - 1; i++) {
        expect(Math.abs(seg[i + 1][0] - seg[i][0])).toBeLessThanOrEqual(180);
      }
    }
  });
});
