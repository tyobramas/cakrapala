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
    // WAJIB: EPSG:4326 GeographicTilingScheme (2x1 tiles at level 0)
    tilingScheme: new Cesium.GeographicTilingScheme(),
    // PENTING: jangan dinaikkan di atas nilai katalog untuk menghindari 404
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
