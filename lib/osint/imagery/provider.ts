/**
 * Imagery Provider Factory — NASA GIBS + Cesium Ion
 *
 * Produces URL templates and Cesium UrlTemplateImageryProvider instances
 * configured for GIBS EPSG:4326 GeographicTilingScheme, as well as
 * Cesium Ion World Imagery (Bing Maps Aerial) via IonImageryProvider.
 *
 * IMPORTANT:
 * 1. GeographicTilingScheme is required for GIBS EPSG:4326 (2 tiles horizontally at level 0).
 * 2. URL builder has 2 canonical branches:
 *    - Static layers (!hasTime): {Time} segment is omitted entirely.
 *    - Temporal layers (hasTime): includes {Time} in YYYY-MM-DD format.
 * 3. maximumLevel is not raised above GetCapabilities spec to avoid
 *    triggering 404/400 tiles. Cesium handles upsampling automatically.
 * 4. Cesium Ion layers bypass the GIBS URL template entirely and use
 *    createWorldImageryAsync() which returns a ready-to-use provider.
 */

import type { GibsLayer } from './catalog';
import { resolveImageryDate } from './time';

const GIBS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

/**
 * Returns the file extension from the layer's MIME format ('jpeg' or 'png').
 */
export function getLayerFileExtension(layer: GibsLayer): 'jpeg' | 'png' {
  return layer.format === 'image/png' ? 'png' : 'jpeg';
}

/**
 * Builds the canonical tile URL for a single tile (pure function, testable without Cesium).
 *
 * Canonical format:
 * - Layer berwaktu (hasTime: true):
 *   https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{layer}/default/{time}/{tileMatrixSet}/{z}/{row}/{col}.{ext}
 * - Layer statis (hasTime: false):
 *   https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{layer}/default/{tileMatrixSet}/{z}/{row}/{col}.{ext}
 */
export function buildGibsTileUrl(
  layer: GibsLayer,
  dateStr: string,
  z: number,
  row: number,
  col: number,
): string {
  const ext = getLayerFileExtension(layer);
  if (!layer.hasTime) {
    return `${GIBS_BASE_URL}/${layer.id}/default/${layer.tileMatrixSetID}/${z}/${row}/${col}.${ext}`;
  }
  const safeDate = dateStr || resolveImageryDate(layer);
  return `${GIBS_BASE_URL}/${layer.id}/default/${safeDate}/${layer.tileMatrixSetID}/${z}/${row}/${col}.${ext}`;
}

/**
 * Builds the REST URL template for Cesium UrlTemplateImageryProvider.
 *
 * Uses standard Cesium tokens:
 * - {z} untuk TileMatrix / level
 * - {y} untuk TileRow (North ke South pada GeographicTilingScheme)
 * - {x} untuk TileCol (West ke East pada GeographicTilingScheme)
 */
export function buildGibsTemplateUrl(
  layer: GibsLayer,
  dateStr?: string,
): string {
  const ext = getLayerFileExtension(layer);
  if (!layer.hasTime) {
    return `${GIBS_BASE_URL}/${layer.id}/default/${layer.tileMatrixSetID}/{z}/{y}/{x}.${ext}`;
  }
  const safeDate = dateStr || resolveImageryDate(layer);
  return `${GIBS_BASE_URL}/${layer.id}/default/${safeDate}/${layer.tileMatrixSetID}/{z}/{y}/{x}.${ext}`;
}

export interface GibsProviderOptions {
  layer: GibsLayer;
  dateStr?: string;
  onTileError?: (errorCount: number, error: unknown) => void;
}

/**
 * Creates NASA GIBS compliant GeographicTilingScheme (EPSG:4326).
 * GIBS in EPSG:4326 uses 512px tiles with custom matrix dimensions (2x1, 3x2, 5x3, 10x5...).
 */
export function createGibsGeographicTilingScheme(Cesium: typeof import('cesium')) {
  const scheme = new Cesium.GeographicTilingScheme();
  const tilePixels = 512;
  const rectangle = Cesium.Rectangle.MAX_VALUE;

  const getLevelInfo = (level: number) => {
    let width: number, height: number;
    if (level === 0) {
      width = 2;
      height = 1;
    } else if (level === 1) {
      width = 3;
      height = 2;
    } else if (level === 2) {
      width = 5;
      height = 3;
    } else {
      const mult = Math.pow(2, level - 3);
      width = 10 * mult;
      height = 5 * mult;
    }
    const resolution = 0.009817477042468103 / Math.pow(2, level);
    return { width, height, resolution };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scheme as any).getNumberOfXTilesAtLevel = function (level: number) {
    return getLevelInfo(level).width;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scheme as any).getNumberOfYTilesAtLevel = function (level: number) {
    return getLevelInfo(level).height;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scheme as any).tileXYToRectangle = function (x: number, y: number, level: number, result?: any) {
    const { resolution } = getLevelInfo(level);
    const xTileWidth = resolution * tilePixels;
    const yTileHeight = resolution * tilePixels;

    const west = x * xTileWidth + rectangle.west;
    const east = (x + 1) * xTileWidth + rectangle.west;
    const north = rectangle.north - y * yTileHeight;
    const south = rectangle.north - (y + 1) * yTileHeight;

    if (!result) {
      result = new Cesium.Rectangle(0, 0, 0, 0);
    }
    result.west = west;
    result.south = south;
    result.east = east;
    result.north = north;
    return result;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scheme as any).positionToTileXY = function (position: any, level: number, result?: any) {
    if (!Cesium.Rectangle.contains(rectangle, position)) {
      return undefined;
    }

    const { width: xTiles, height: yTiles, resolution } = getLevelInfo(level);
    const xTileWidth = resolution * tilePixels;
    const yTileHeight = resolution * tilePixels;

    let longitude = position.longitude;
    if (rectangle.east < rectangle.west) {
      longitude += Cesium.Math.TWO_PI;
    }

    let xTileCoordinate = Math.floor((longitude - rectangle.west) / xTileWidth);
    if (xTileCoordinate >= xTiles) {
      xTileCoordinate = xTiles - 1;
    }

    const latitude = position.latitude;
    let yTileCoordinate = Math.floor((rectangle.north - latitude) / yTileHeight);
    if (yTileCoordinate >= yTiles) {
      yTileCoordinate = yTiles - 1;
    }

    if (!result) {
      result = new Cesium.Cartesian2(0, 0);
    }
    result.x = xTileCoordinate;
    result.y = yTileCoordinate;
    return result;
  };

  return scheme;
}

/**
 * Creates a NASA GIBS UrlTemplateImageryProvider.
 */
export function createGibsImageryProvider(
  Cesium: typeof import('cesium'),
  options: GibsProviderOptions,
): import('cesium').UrlTemplateImageryProvider {
  const { layer, dateStr, onTileError } = options;
  const urlTemplate = buildGibsTemplateUrl(layer, dateStr);

  const provider = new Cesium.UrlTemplateImageryProvider({
    url: urlTemplate,
    tilingScheme: createGibsGeographicTilingScheme(Cesium),
    tileWidth: 512,
    tileHeight: 512,
    maximumLevel: layer.maximumLevel,
    credit: layer.attribution,
    hasAlphaChannel: layer.format === 'image/png',
  });

  let consecutiveErrors = 0;
  provider.errorEvent.addEventListener((event) => {
    consecutiveErrors++;
    if (onTileError) {
      onTileError(consecutiveErrors, event);
    }
  });

  return provider;
}

/**
 * Creates a GIBS ImageryLayer with opacity.
 */
export function createGibsImageryLayer(
  Cesium: typeof import('cesium'),
  options: GibsProviderOptions & { opacity?: number },
): import('cesium').ImageryLayer {
  const provider = createGibsImageryProvider(Cesium, options);
  const imageryLayer = new Cesium.ImageryLayer(provider, {
    alpha: options.opacity ?? 1.0,
    show: true,
  });
  return imageryLayer;
}

/**
 * Creates a Cesium Ion World Imagery (Bing Maps Aerial) imagery layer.
 * Requires a valid Cesium Ion access token (Ion.defaultAccessToken).
 */
export async function createCesiumIonImageryLayer(
  Cesium: typeof import('cesium'),
  options?: { opacity?: number },
): Promise<import('cesium').ImageryLayer> {
  const provider = await Cesium.IonImageryProvider.fromAssetId(2); // Asset 2 = Bing Maps Aerial
  const imageryLayer = new Cesium.ImageryLayer(provider, {
    alpha: options?.opacity ?? 1.0,
    show: true,
  });
  return imageryLayer;
}

const ESRI_WORLD_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const ESRI_BOUNDARIES_LABELS_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

/**
 * Creates a fixed, high-resolution global Satellite Imagery layer (Esri World Imagery).
 * Free, no API key or date latency, crisp from global view down to street level (~0.3m-1m).
 */
export function createEsriSatelliteImageryLayer(
  Cesium: typeof import('cesium'),
  options?: { opacity?: number },
): import('cesium').ImageryLayer {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: ESRI_WORLD_IMAGERY_URL,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18,
    credit: 'Esri, Maxar, Earthstar Geographics',
  });
  return new Cesium.ImageryLayer(provider, {
    alpha: options?.opacity ?? 1.0,
    show: true,
  });
}

/**
 * Creates a crisp transparent Boundaries & Places reference overlay for satellite maps.
 */
export function createEsriBoundariesOverlayLayer(
  Cesium: typeof import('cesium'),
  options?: { opacity?: number },
): import('cesium').ImageryLayer {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: ESRI_BOUNDARIES_LABELS_URL,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 13,
    hasAlphaChannel: true,
    credit: 'Esri Reference Overlay',
  });
  return new Cesium.ImageryLayer(provider, {
    alpha: options?.opacity ?? 0.85,
    show: true,
  });
}
