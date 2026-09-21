import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// OSINT Module — NASA GIBS Imagery Unit Tests
//
// Tests required by spec & user instructions:
//   1. URL builder branching:
//      - timeVarying: false (Coastlines & Labels) has NO date segment.
//      - timeVarying: true (TrueColor & DNB) includes date segment.
//      - Correct file extensions (.jpeg vs .png).
//   2. Time resolution:
//      - Per-layer latencyDays offsets (TrueColor 1d, DNB 2d).
//      - Clamping upper bound (cannot exceed today - latencyDays).
//      - Clamping lower bound (cannot exceed 30 days history).
//      - Malformed dates fallback safely.
//      - Layer with hasTime=false returns empty string.
//   3. Catalog integrity:
//      - All 5 required layers present with verified identifiers.
//      - Exact maximumLevel values (8, 8, 7, 12, 12).
//      - Exact tileMatrixSetID ('250m', '500m', '15.625m').
//   4. Route handler:
//      - GET /api/osint/imagery returns HTTP 409 Conflict.
//   5. Registry:
//      - imagery layer is marked as basemap and enabled.
// ─────────────────────────────────────────────────────────────────────────────

import {
  GIBS_LAYERS,
  getDefaultBaseLayer,
  getBaseLayers,
  getOverlayLayers,
  type GibsLayer,
} from '../../lib/osint/imagery/catalog';
import {
  resolveImageryDate,
  getMaxDateForLayer,
  getMinDate,
  formatUtcDate,
  parseUtcDate,
} from '../../lib/osint/imagery/time';
import {
  buildGibsTileUrl,
  buildGibsTemplateUrl,
  getLayerFileExtension,
} from '../../lib/osint/imagery/provider';
import { LAYER_REGISTRY, isBasemapLayer } from '../../lib/osint/registry';

// ═══════════════════════════════════════════════════════════════════════════
// 1. URL Builder Branching Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('NASA GIBS URL Builder — Branching & Canonical Formats', () => {
  const viirsTrueColor = GIBS_LAYERS.find(
    (l) => l.id === 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
  )!;
  const modisTerra = GIBS_LAYERS.find(
    (l) => l.id === 'MODIS_Terra_CorrectedReflectance_TrueColor',
  )!;
  const viirsDnb = GIBS_LAYERS.find(
    (l) => l.id === 'VIIRS_SNPP_DayNightBand_At_Sensor_Radiance',
  )!;
  const coastlines = GIBS_LAYERS.find((l) => l.id === 'Coastlines_15m')!;
  const referenceLabels = GIBS_LAYERS.find(
    (l) => l.id === 'Reference_Labels_15m',
  )!;

  it('generates canonical tile URL for static overlay (Coastlines) WITHOUT time segment', () => {
    const url = buildGibsTileUrl(coastlines, '2026-09-20', 0, 0, 0);

    // MUST NOT contain date segment or double-default
    expect(url).not.toContain('2026-09-20');
    expect(url).not.toContain('default/default');

    // Canonical pattern: {base}/{layer}/default/{tileMatrixSet}/{z}/{row}/{col}.{ext}
    expect(url).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/Coastlines_15m/default/15.625m/0/0/0.png',
    );
  });

  it('generates canonical template URL for static overlay (Reference Labels) WITHOUT time segment', () => {
    const template = buildGibsTemplateUrl(referenceLabels);

    expect(template).not.toContain('default/default');
    expect(template).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/Reference_Labels_15m/default/15.625m/{z}/{y}/{x}.png',
    );
  });

  it('generates tile URL with date segment and .jpeg extension for TrueColor', () => {
    const url = buildGibsTileUrl(viirsTrueColor, '2026-09-20', 2, 1, 3);

    expect(url).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2026-09-20/250m/2/1/3.jpeg',
    );
  });

  it('generates template URL with date segment and .png extension for Day/Night Band', () => {
    const template = buildGibsTemplateUrl(viirsDnb, '2026-09-19');

    expect(template).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_SNPP_DayNightBand_At_Sensor_Radiance/default/2026-09-19/500m/{z}/{y}/{x}.png',
    );
  });

  it('maps MIME formats correctly to file extensions', () => {
    expect(getLayerFileExtension(viirsTrueColor)).toBe('jpeg');
    expect(getLayerFileExtension(modisTerra)).toBe('jpeg');
    expect(getLayerFileExtension(viirsDnb)).toBe('png');
    expect(getLayerFileExtension(coastlines)).toBe('png');
    expect(getLayerFileExtension(referenceLabels)).toBe('png');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Time Dimension & Latency Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('NASA GIBS Time Dimension & Latency Resolution', () => {
  const viirsTrueColor = GIBS_LAYERS.find(
    (l) => l.id === 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
  )!;
  const viirsDnb = GIBS_LAYERS.find(
    (l) => l.id === 'VIIRS_SNPP_DayNightBand_At_Sensor_Radiance',
  )!;
  const coastlines = GIBS_LAYERS.find((l) => l.id === 'Coastlines_15m')!;

  // Fixed reference point: 2026-09-21 12:00:00 UTC
  const fixedNow = new Date(Date.UTC(2026, 8, 21, 12, 0, 0));

  it('offsets by 1 day for TrueColor products (latencyDays = 1)', () => {
    const resolved = resolveImageryDate(viirsTrueColor, null, fixedNow);
    expect(resolved).toBe('2026-09-20');
  });

  it('offsets by 2 days for Night Band products (latencyDays = 2)', () => {
    const resolved = resolveImageryDate(viirsDnb, null, fixedNow);
    expect(resolved).toBe('2026-09-19');
  });

  it('clamps future / same-day dates to layer maxDate (cannot exceed latency bound)', () => {
    // Attempting to request 2026-09-21 for TrueColor (maxDate: 2026-09-20)
    const clampedTrueColor = resolveImageryDate(
      viirsTrueColor,
      '2026-09-21',
      fixedNow,
    );
    expect(clampedTrueColor).toBe('2026-09-20');

    // Attempting to request 2026-09-20 for DNB (maxDate: 2026-09-19)
    const clampedDnb = resolveImageryDate(viirsDnb, '2026-09-20', fixedNow);
    expect(clampedDnb).toBe('2026-09-19');
  });

  it('clamps dates older than 30 days to minDate', () => {
    const minDate = getMinDate(fixedNow); // 30 days before 2026-09-21 is 2026-08-22
    expect(minDate).toBe('2026-08-22');

    const clampedOld = resolveImageryDate(
      viirsTrueColor,
      '2025-01-01',
      fixedNow,
    );
    expect(clampedOld).toBe('2026-08-22');
  });

  it('safely handles invalid / malformed date strings by falling back to maxDate', () => {
    const fallback = resolveImageryDate(
      viirsTrueColor,
      'invalid-date-string',
      fixedNow,
    );
    expect(fallback).toBe('2026-09-20');
  });

  it('returns empty string for static layers (hasTime: false)', () => {
    const resolved = resolveImageryDate(coastlines, '2026-09-20', fixedNow);
    expect(resolved).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Catalog Integrity Tests (Matches GetCapabilities)
// ═══════════════════════════════════════════════════════════════════════════

describe('NASA GIBS Catalog Integrity', () => {
  it('contains exactly 5 verified layers', () => {
    expect(GIBS_LAYERS).toHaveLength(5);
  });

  it('has exact maximumLevel values matching GetCapabilities XML (no guessing)', () => {
    const levels: Record<string, number> = {};
    for (const l of GIBS_LAYERS) {
      levels[l.id] = l.maximumLevel;
    }

    expect(levels['VIIRS_SNPP_CorrectedReflectance_TrueColor']).toBe(8);
    expect(levels['MODIS_Terra_CorrectedReflectance_TrueColor']).toBe(8);
    expect(levels['VIIRS_SNPP_DayNightBand_At_Sensor_Radiance']).toBe(7);
    expect(levels['Coastlines_15m']).toBe(12);
    expect(levels['Reference_Labels_15m']).toBe(12);
  });

  it('has exact TileMatrixSet identifiers matching EPSG:4326', () => {
    const tms: Record<string, string> = {};
    for (const l of GIBS_LAYERS) {
      tms[l.id] = l.tileMatrixSetID;
    }

    expect(tms['VIIRS_SNPP_CorrectedReflectance_TrueColor']).toBe('250m');
    expect(tms['MODIS_Terra_CorrectedReflectance_TrueColor']).toBe('250m');
    expect(tms['VIIRS_SNPP_DayNightBand_At_Sensor_Radiance']).toBe('500m');
    expect(tms['Coastlines_15m']).toBe('15.625m');
    expect(tms['Reference_Labels_15m']).toBe('15.625m');
  });

  it('provides helpers for base and overlay filtering', () => {
    const baseLayers = getBaseLayers();
    const overlayLayers = getOverlayLayers();
    const defaultBase = getDefaultBaseLayer();

    expect(baseLayers).toHaveLength(3);
    expect(overlayLayers).toHaveLength(2);
    expect(defaultBase.id).toBe('VIIRS_SNPP_CorrectedReflectance_TrueColor');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Registry & API Route Guard Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Registry & Route Guard for Imagery Layer', () => {
  it('marks imagery layer as enabled basemap in LAYER_REGISTRY', () => {
    expect(LAYER_REGISTRY.imagery.enabled).toBe(true);
    expect(LAYER_REGISTRY.imagery.category).toBe('basemap');
    expect(isBasemapLayer('imagery')).toBe(true);
    expect(isBasemapLayer('quake')).toBe(false);
  });

  it('returns 409 Conflict when attempting to query /api/osint/imagery', async () => {
    const mod = await import('../../app/api/osint/[layer]/route');
    const GET = mod.GET;

    const url = new URL('http://localhost/api/osint/imagery');
    const req = {
      nextUrl: url,
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      url: url.toString(),
    } as unknown as Parameters<typeof GET>[0];

    const res = await GET(req, {
      params: Promise.resolve({ layer: 'imagery' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('basemap');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Imagery Layer Lifecycle & Stability Tests (Cesium Layer Collection)
// ═══════════════════════════════════════════════════════════════════════════

describe('NASA GIBS Imagery Layer Lifecycle & Stability', () => {
  it('maintains stable layer count and preserves NaturalEarthII across 5x base switches & 5x date switches', async () => {
    const Cesium = await import('cesium');
    const layers = new Cesium.ImageryLayerCollection();

    // NaturalEarthII is permanently at index 0
    const neProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://example.com/ne/{z}/{x}/{y}.png',
    });
    const neLayer = new Cesium.ImageryLayer(neProvider);
    layers.add(neLayer);

    expect(layers.length).toBe(1);
    expect(layers.get(0)).toBe(neLayer);

    let currentGibsBase: import('cesium').ImageryLayer | null = null;

    function setBaseLayer(layerDef: GibsLayer, date: string) {
      if (currentGibsBase) {
        layers.remove(currentGibsBase, true);
        currentGibsBase = null;
      }
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: buildGibsTemplateUrl(layerDef, date),
        tilingScheme: new Cesium.GeographicTilingScheme(),
        maximumLevel: layerDef.maximumLevel,
      });
      currentGibsBase = new Cesium.ImageryLayer(provider);
      layers.add(currentGibsBase, 1);
    }

    const baseDefs = [
      GIBS_LAYERS[0], // VIIRS SNPP
      GIBS_LAYERS[1], // MODIS Terra
      GIBS_LAYERS[2], // VIIRS DNB
      GIBS_LAYERS[0], // VIIRS SNPP
      GIBS_LAYERS[1], // MODIS Terra
    ];

    // 5x base switches
    for (const def of baseDefs) {
      setBaseLayer(def, '2026-09-20');
      expect(layers.length).toBe(2);
      expect(layers.get(0)).toBe(neLayer);
    }

    // 5x date switches
    const dates = [
      '2026-09-19',
      '2026-09-18',
      '2026-09-17',
      '2026-09-16',
      '2026-09-15',
    ];
    for (const d of dates) {
      setBaseLayer(GIBS_LAYERS[0], d);
      expect(layers.length).toBe(2);
      expect(layers.get(0)).toBe(neLayer);
    }

    // Toggle off
    if (currentGibsBase) {
      layers.remove(currentGibsBase, true);
      currentGibsBase = null;
    }
    expect(layers.length).toBe(1);
    expect(layers.get(0)).toBe(neLayer);
  });
});

