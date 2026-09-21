/**
 * NASA GIBS Imagery Catalog
 *
 * Verifikasi langsung dari GetCapabilities WMTS EPSG:4326:
 * URL: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml
 * Tanggal Verifikasi: 2026-09-21
 */

export type GibsLayerType = 'base' | 'overlay';

export interface GibsLayer {
  /** Identifier resmi layer di WMTS Capabilities (ows:Identifier) */
  id: string;
  /** Label ramah manusia untuk antarmuka pengguna */
  label: string;
  /** Jenis layer: 'base' untuk citra utama permukaan, 'overlay' untuk lapisan tematik di atasnya */
  type: GibsLayerType;
  /** MIME type tile format */
  format: 'image/jpeg' | 'image/png';
  /** TileMatrixSet identifier (e.g. '250m', '500m', '15.625m') */
  tileMatrixSetID: string;
  /** Level zoom maksimum (0-indexed: TileMatrix '0'..'N' => maximumLevel = N) */
  maximumLevel: number;
  /** Resolusi nominal untuk tampilan informatif (misal: '250m', '500m', '15m') */
  resolution: string;
  /** Apakah layer memiliki dimensi waktu (harian) atau statis */
  hasTime: boolean;
  /**
   * Latensi ketersediaan data dalam hari (UTC).
   * Produk TrueColor membutuhkan ~1 hari (kemarin UTC), sedangkan produk Night Band
   * (DNB) membutuhkan ~2 hari untuk mosaik global lengkap.
   * Overlay statis memiliki latensi 0.
   */
  latencyDays: number;
  /** Apakah aktif secara default saat pertama kali dimuat */
  defaultActive?: boolean;
  /** Teks atribusi hak cipta / data source */
  attribution: string;
}

export const GIBS_LAYERS: GibsLayer[] = [
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
    label: 'VIIRS Lampu Malam (DNB)',
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
    label: 'Garis Pantai (15m)',
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
    label: 'Label Wilayah (15m)',
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

/** Ambil entri layer default aktif untuk base imagery */
export function getDefaultBaseLayer(): GibsLayer {
  return (
    GIBS_LAYERS.find((l) => l.type === 'base' && l.defaultActive) ??
    GIBS_LAYERS[0]
  );
}

/** Ambil seluruh layer base */
export function getBaseLayers(): GibsLayer[] {
  return GIBS_LAYERS.filter((l) => l.type === 'base');
}

/** Ambil seluruh layer overlay */
export function getOverlayLayers(): GibsLayer[] {
  return GIBS_LAYERS.filter((l) => l.type === 'overlay');
}
