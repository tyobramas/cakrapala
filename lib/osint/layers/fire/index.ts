/**
 * NASA FIRMS Active Fire Layer Adapter
 *
 * Upstream: NASA FIRMS (Fire Information for Resource Management System)
 * API Endpoint: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{W,S,E,N}/{DAY_RANGE}
 *
 * KUOTA MAP_KEY:
 * 5000 transaksi per jendela waktu 10 menit (5000 / 10 min).
 * Permintaan multi-hari dihitung sebagai beberapa transaksi.
 *
 * CACHE & GRID POLICY:
 * - Menggunakan grid roundBBox(bbox, 0.5) untuk efisiensi caching.
 * - TTL: 480_000 ms (8 menit) sesuai registry.
 * - Luas area maksimal: 60° x 60°. Area lebih besar ditolak dengan 'AREA_TOO_LARGE'.
 */

import type { BBox, LayerPayload, OsintEntity } from '@/lib/osint/types';
import type { FetchLayerParams, LayerFetcher } from '@/lib/osint/adapter';
import { wrapAdapter } from '@/lib/osint/adapter';
import { roundBBox, clampBBox } from '@/lib/osint/geo';
import { parseFirmsCsv } from './parse';

export const FIRMS_SOURCES = [
  'VIIRS_NOAA20_NRT', // Utama (satelit terbaru, 375m)
  'VIIRS_SNPP_NRT',   // Cadangan (375m)
  'MODIS_NRT',        // Cadangan terakhir (1km, cakupan historis)
] as const;

export type FirmsSource = (typeof FIRMS_SOURCES)[number];

const FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const MAX_AREA_DEG = 60; // 60° x 60° batas maksimum

// ── In-memory Quota Monitor (5000 tx / 10 min) ─────────────────────────────
// NOTE: Dalam lingkungan produksi terdistribusi / multi-region serverless,
// penghitung ini harus dipindahkan ke Upstash Redis.
const QUOTA_WINDOW_MS = 10 * 60 * 1000;
const QUOTA_LIMIT = 5000;
const QUOTA_WARN_THRESHOLD = 4500;
const transactionTimestamps: number[] = [];

export function recordFirmsTransaction(): number {
  const now = Date.now();
  transactionTimestamps.push(now);
  while (
    transactionTimestamps.length > 0 &&
    transactionTimestamps[0] < now - QUOTA_WINDOW_MS
  ) {
    transactionTimestamps.shift();
  }
  const count = transactionTimestamps.length;
  if (count >= QUOTA_WARN_THRESHOLD) {
    console.warn(
      `[FIRMS] Peringatan: Penggunaan kuota mendekati batas (${count}/${QUOTA_LIMIT} dalam 10 menit)`,
    );
  }
  return count;
}

export function getFirmsTransactionCount(): number {
  const now = Date.now();
  while (
    transactionTimestamps.length > 0 &&
    transactionTimestamps[0] < now - QUOTA_WINDOW_MS
  ) {
    transactionTimestamps.shift();
  }
  return transactionTimestamps.length;
}

export interface FetchFireLayerOptions {
  source?: string;
  dayRange?: number;
  includeLowConfidence?: boolean;
  nightOnly?: boolean;
}

/**
 * Validasi apakah ukuran area BBox memenuhi ambang aman (< 60° x 60°).
 */
export function isBBoxAreaAllowed(bbox?: BBox): boolean {
  if (!bbox) return false;
  const [w, s, e, n] = bbox;
  const width = Math.abs(e - w);
  const height = Math.abs(n - s);
  if (width <= 0 || height <= 0) return false;
  if (width > MAX_AREA_DEG || height > MAX_AREA_DEG) return false;
  if (width * height > MAX_AREA_DEG * MAX_AREA_DEG) return false;
  return true;
}

/**
 * Raw fetch function untuk layer Fire.
 */
async function rawFetchFireLayer(params: FetchLayerParams): Promise<LayerPayload> {
  const { bbox, signal } = params;

  // 1. Verifikasi batas area (DILARANG fetch jika bbox kosong atau > 60° x 60°)
  if (!isBBoxAreaAllowed(bbox)) {
    return {
      layer: 'fire',
      entities: [],
      fetchedAt: new Date().toISOString(),
      upstreamAt: null,
      stale: false,
      error: 'AREA_TOO_LARGE',
    };
  }

  // 2. Verifikasi env FIRMS_MAP_KEY
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    return {
      layer: 'fire',
      entities: [],
      fetchedAt: new Date().toISOString(),
      upstreamAt: null,
      stale: false,
      error: 'MISSING_KEY',
    };
  }

  // 3. Grid-based rounding (stepDeg = 0.5)
  // BBox yang dikirim ke upstream adalah bbox yang sudah dibulatkan agar pan kecil
  // dapat mengenai cache.
  const rounded = clampBBox(roundBBox(bbox!, 0.5));
  const [w, s, e, n] = rounded;
  const areaCoords = `${w},${s},${e},${n}`;

  // 4. Pengaturan opsi
  const opts = (params as { options?: FetchFireLayerOptions }).options || {};
  let dayRange = opts.dayRange ?? 1;
  if (dayRange < 1) dayRange = 1;
  if (dayRange > 5) dayRange = 5;

  const targetSource: FirmsSource =
    opts.source && (FIRMS_SOURCES as readonly string[]).includes(opts.source)
      ? (opts.source as FirmsSource)
      : FIRMS_SOURCES[0];

  // 5. Fetch dengan Fallback (Maksimal 2 kali percobaan upstream)
  const sourcesToTry: FirmsSource[] = [targetSource];
  if (targetSource === FIRMS_SOURCES[0]) {
    sourcesToTry.push(FIRMS_SOURCES[1]); // Cadangan VIIRS_SNPP_NRT jika VIIRS_NOAA20_NRT gagal
  }

  let lastError: Error | null = null;
  let csvText: string | null = null;
  let usedSource = targetSource;

  for (const src of sourcesToTry) {
    try {
      const url = `${FIRMS_BASE_URL}/${mapKey}/${src}/${areaCoords}/${dayRange}`;
      recordFirmsTransaction();

      const response = await fetch(url, {
        signal,
        headers: {
          Accept: 'text/csv, text/plain',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from FIRMS ${src}`);
      }

      const text = await response.text();
      // Jika response HTML atau pesan error FIRMS (misal invalid map key)
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`Invalid response format from FIRMS ${src}`);
      }

      csvText = text;
      usedSource = src;
      break; // Berhasil
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Lanjut ke sumber fallback berikutnya jika masih ada kuota percobaan
    }
  }

  if (csvText === null) {
    return {
      layer: 'fire',
      entities: [],
      fetchedAt: new Date().toISOString(),
      upstreamAt: null,
      stale: false,
      error: lastError?.message || 'Gagal menghubungi server NASA FIRMS',
    };
  }

  // 6. Parsing CSV
  let entities = parseFirmsCsv(csvText, {
    includeLowConfidence: opts.includeLowConfidence ?? false,
  });

  // Filter malam jika diminta
  if (opts.nightOnly) {
    entities = entities.filter(
      (e) => (e.raw as { daynight?: string })?.daynight === 'N',
    );
  }

  const upstreamAt = entities.length > 0 ? entities[0].observedAt : null;

  return {
    layer: 'fire',
    entities,
    fetchedAt: new Date().toISOString(),
    upstreamAt,
    stale: false,
    error: null,
  };
}

/**
 * Layer fetcher terbungkus timeout & error handler aman.
 */
export const fetchFireLayer: LayerFetcher = wrapAdapter('fire', rawFetchFireLayer);
