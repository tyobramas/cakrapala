/**
 * Imagery Catalog — NASA GIBS + Cesium Ion
 *
 * GIBS layers verified from WMTS GetCapabilities EPSG:4326:
 * URL: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml
 * Verified: 2026-09-21
 *
 * Cesium Ion layer uses Ion default World Imagery (Bing Maps Aerial).
 */

export type GibsLayerType = 'base' | 'overlay';

export interface GibsLayer {
  /** Official layer identifier (WMTS ows:Identifier or internal key) */
  id: string;
  /** Human-readable label for UI */
  label: string;
  /** Layer kind: 'base' for surface imagery, 'overlay' for thematic overlay */
  type: GibsLayerType;
  /** Tile format MIME type */
  format: 'image/jpeg' | 'image/png';
  /** TileMatrixSet identifier (e.g. '250m', '500m', '15.625m', 'webmercator') */
  tileMatrixSetID: string;
  /** Maximum zoom level (0-indexed: TileMatrix '0'..'N' => maximumLevel = N) */
  maximumLevel: number;
  /** Nominal resolution for informational display (e.g. '250m', '~1m') */
  resolution: string;
  /** Whether the layer has a daily time dimension */
  hasTime: boolean;
  /**
   * Data availability latency in days (UTC).
   * TrueColor products require ~1 day (yesterday UTC), Night Band (DNB)
   * requires ~2 days for a complete global mosaic.
   * Static overlays have latency 0.
   */
  latencyDays: number;
  /** Whether this layer is active by default on first load */
  defaultActive?: boolean;
  /** Copyright / data source attribution text */
  attribution: string;
  /**
   * Tiling scheme. Defaults to 'geographic' (EPSG:4326) for GIBS layers.
   * Set to 'webmercator' for standard web map tiles (e.g. Cesium Ion, Esri).
   */
  tilingScheme?: 'geographic' | 'webmercator';
  /**
   * If true, this layer is sourced from Cesium Ion (requires Ion token).
   * The provider factory uses createWorldImageryAsync() instead of URL templates.
   */
  isCesiumIon?: boolean;
}

export const ION_WORLD_IMAGERY_LAYER: GibsLayer = {
  id: 'CesiumIon_WorldImagery',
  label: 'High-Res Satellite (Bing)',
  type: 'base',
  format: 'image/jpeg',
  tileMatrixSetID: 'webmercator',
  maximumLevel: 19,
  resolution: '~1m',
  hasTime: false,
  latencyDays: 0,
  defaultActive: false,
  attribution: 'Bing Maps / Microsoft',
  tilingScheme: 'webmercator',
  isCesiumIon: true,
};

export const GIBS_LAYERS: GibsLayer[] = [
  // ── NASA GIBS Satellite Layers ────────────────────────────────────────
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    label: 'VIIRS SNPP True Color',
    type: 'base',
    format: 'image/jpeg',
    tileMatrixSetID: '250m',
    maximumLevel: 8,
    resolution: '250m',
    hasTime: true,
    latencyDays: 1,
    defaultActive: true,
    attribution: 'NASA EOSDIS GIBS / Suomi NPP VIIRS',
  },
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    label: 'MODIS Terra True Color',
    type: 'base',
    format: 'image/jpeg',
    tileMatrixSetID: '250m',
    maximumLevel: 8,
    resolution: '250m',
    hasTime: true,
    latencyDays: 1,
    defaultActive: false,
    attribution: 'NASA EOSDIS GIBS / Terra MODIS',
  },
  {
    id: 'VIIRS_SNPP_DayNightBand_At_Sensor_Radiance',
    label: 'VIIRS Night Lights (DNB)',
    type: 'base',
    format: 'image/png',
    tileMatrixSetID: '500m',
    maximumLevel: 7,
    resolution: '500m',
    hasTime: true,
    latencyDays: 2,
    defaultActive: false,
    attribution: 'NASA EOSDIS GIBS / Suomi NPP VIIRS DNB',
  },
  {
    id: 'Coastlines_15m',
    label: 'Coastlines (15m)',
    type: 'overlay',
    format: 'image/png',
    tileMatrixSetID: '15.625m',
    maximumLevel: 12,
    resolution: '15m',
    hasTime: false,
    latencyDays: 0,
    defaultActive: true,
    attribution: 'OpenStreetMap contributors / NASA GIBS',
  },
  {
    id: 'Reference_Labels_15m',
    label: 'Region Labels (15m)',
    type: 'overlay',
    format: 'image/png',
    tileMatrixSetID: '15.625m',
    maximumLevel: 12,
    resolution: '15m',
    hasTime: false,
    latencyDays: 0,
    defaultActive: false,
    attribution: 'OpenStreetMap contributors / NASA GIBS',
  },
];

/** Get the default active base layer entry for base imagery */
export function getDefaultBaseLayer(): GibsLayer {
  return (
    GIBS_LAYERS.find((l) => l.type === 'base' && l.defaultActive) ??
    GIBS_LAYERS[0]
  );
}

/** Get all base layers */
export function getBaseLayers(): GibsLayer[] {
  return GIBS_LAYERS.filter((l) => l.type === 'base');
}

/** Get all overlay layers */
export function getOverlayLayers(): GibsLayer[] {
  return GIBS_LAYERS.filter((l) => l.type === 'overlay');
}

/** Get the Cesium Ion hi-res layer entry */
export function getCesiumIonLayer(): GibsLayer {
  return ION_WORLD_IMAGERY_LAYER;
}
