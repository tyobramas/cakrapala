/**
 * NASA GIBS Imagery Provider Factory
 *
 * Menghasilkan URL template dan instance UrlTemplateImageryProvider Cesium
 * yang terkonfigurasi dengan EPSG:4326 GeographicTilingScheme.
 *
 * PENTING:
 * 1. GeographicTilingScheme wajib digunakan untuk EPSG:4326 (2 tile horizontal pada level 0).
 * 2. URL builder memiliki 2 cabang kanonik:
 *    - Layer statis (!hasTime): segmen {Time} dihilangkan sama sekali.
 *    - Layer berwaktu (hasTime): menyertakan {Time} dalam format YYYY-MM-DD.
 * 3. maximumLevel tidak dinaikkan di atas spesifikasi GetCapabilities agar tidak
 *    memicu tile 404/400. Cesium menangani upsampling secara otomatis.
 */

import type { GibsLayer } from './catalog';
import { resolveImageryDate } from './time';

const GIBS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

/**
 * Mendapatkan ekstensi file dari MIME format layer ('jpeg' atau 'png').
 */
export function getLayerFileExtension(layer: GibsLayer): 'jpeg' | 'png' {
  return layer.format === 'image/png' ? 'png' : 'jpeg';
}

/**
 * Membangun URL tile kanonik untuk satu tile tertentu (pure function, testable tanpa Cesium).
 *
 * Format kanonik:
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
 * Membangun URL template REST untuk Cesium UrlTemplateImageryProvider.
 *
 * Menggunakan token Cesium standard:
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
 * Membuat instance UrlTemplateImageryProvider Cesium untuk layer GIBS.
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
 * Membuat instance ImageryLayer Cesium lengkap dengan opacity.
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
