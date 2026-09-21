/**
 * NASA FIRMS Active Fire CSV Parser
 *
 * Mengurai payload CSV dari NASA FIRMS (VIIRS & MODIS) ke dalam bentuk
 * objek entitas OSINT yang stabil dan ternormalisasi.
 *
 * PERHATIAN:
 * 1. Parser berbasis NAMA kolom pada header, bukan indeks tetap.
 * 2. Confidence dinormalisasi ke 'low' | 'nominal' | 'high' (MODIS <30, 30..80, >80).
 * 3. acq_time dipadding 4 digit UTC ('45' -> '00:45', '130' -> '01:30').
 * 4. ID disintesis secara deterministik dari satelit, waktu, dan koordinat.
 * 5. Urutan koordinat di CSV adalah LATITUDE dulu, baru LONGITUDE.
 */

import type { OsintEntity } from '@/lib/osint/types';

export type FireConfidence = 'low' | 'nominal' | 'high';

export interface FireFeatureRaw extends Record<string, unknown> {
  frp: number | null;
  confidence: FireConfidence;
  confidenceRaw: string;
  daynight: string;
  brightness: number | null;
  scan: number | null;
  track: number | null;
  version: string;
  satellite: string;
  instrument: string;
  acqDate: string;
  acqTime: string;
}

/**
 * Normalisasi nilai confidence FIRMS:
 * - VIIRS: 'l' -> 'low', 'n' -> 'nominal', 'h' -> 'high'
 * - MODIS: 0..100 numerik (<30 -> 'low', 30..80 -> 'nominal', >80 -> 'high')
 */
export function normalizeConfidence(raw: string): FireConfidence {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'l' || trimmed === 'low') return 'low';
  if (trimmed === 'n' || trimmed === 'nominal') return 'nominal';
  if (trimmed === 'h' || trimmed === 'high') return 'high';

  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    if (num < 30) return 'low';
    if (num <= 80) return 'nominal';
    return 'high';
  }

  return 'nominal';
}

/**
 * Format acq_time (yang bisa kehilangan leading zero seperti '45' atau '130')
 * dan acq_date ('YYYY-MM-DD') menjadi string ISO UTC 8601 lengkap.
 */
export function formatAcquisitionIso(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.trim();
  const digits = timeStr.trim().replace(/\D/g, '');
  const padded = digits.padStart(4, '0').slice(-4);
  const hh = padded.slice(0, 2);
  const mm = padded.slice(2, 4);

  return `${cleanDate}T${hh}:${mm}:00.000Z`;
}

/**
 * Menghitung severity berbasis Fire Radiative Power (FRP, MW):
 * Formula logaritmik: clamp(log10(1 + frp) / log10(1 + 500), 0, 1)
 * Fallback jika kosong/NaN: 0.15
 */
export function calculateFrpSeverity(frp: number | null | undefined): number {
  if (frp == null || isNaN(frp) || frp < 0) {
    return 0.15;
  }
  const denominator = Math.log10(1 + 500); // ~2.6998
  const score = Math.log10(1 + frp) / denominator;
  return Math.min(1, Math.max(0, score));
}

/**
 * Parse baris CSV sederhana dengan menangani spasi di sekitar delimiter.
 */
function parseCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

/**
 * Mengurai string CSV NASA FIRMS menjadi array entitas OsintEntity.
 *
 * @param csvContent String mentah CSV dari endpoint FIRMS
 * @param options Opsi filter (misal: tampilkan confidence low)
 */
export function parseFirmsCsv(
  csvContent: string,
  options?: { includeLowConfidence?: boolean },
): OsintEntity[] {
  if (!csvContent || typeof csvContent !== 'string') {
    return [];
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  // 1. Header mapping berdasarkan nama kolom (Jebakan A)
  const headerCols = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colMap = new Map<string, number>();
  headerCols.forEach((col, idx) => colMap.set(col, idx));

  // Pastikan kolom wajib minimal tersedia
  const latIdx = colMap.get('latitude') ?? colMap.get('lat');
  const lonIdx = colMap.get('longitude') ?? colMap.get('lon');
  const dateIdx = colMap.get('acq_date');
  const timeIdx = colMap.get('acq_time');

  if (
    latIdx === undefined ||
    lonIdx === undefined ||
    dateIdx === undefined ||
    timeIdx === undefined
  ) {
    return [];
  }

  // Kolom skema spesifik
  const satIdx = colMap.get('satellite');
  const instIdx = colMap.get('instrument');
  const confIdx = colMap.get('confidence');
  const frpIdx = colMap.get('frp');
  const daynightIdx = colMap.get('daynight');
  const versionIdx = colMap.get('version');
  const scanIdx = colMap.get('scan');
  const trackIdx = colMap.get('track');

  // VIIRS: bright_ti4, bright_ti5 | MODIS: brightness, bright_t31
  const brightIdx = colMap.get('bright_ti4') ?? colMap.get('brightness');

  const entities: OsintEntity[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = parseCsvLine(line);

    if (cells.length < 4) {
      continue; // Baris terlalu pendek, lewati
    }

    const rawLat = cells[latIdx];
    const rawLon = cells[lonIdx];
    const lat = parseFloat(rawLat);
    const lon = parseFloat(rawLon);

    if (isNaN(lat) || isNaN(lon)) {
      continue; // Koordinat tidak valid, lewati
    }

    const acqDate = cells[dateIdx] || '';
    const rawTime = cells[timeIdx] || '';
    if (!acqDate || !rawTime) {
      continue;
    }

    const paddedTime = rawTime.replace(/\D/g, '').padStart(4, '0').slice(-4);
    const satellite = (satIdx !== undefined ? cells[satIdx] : '') || 'N/A';
    const instrument = (instIdx !== undefined ? cells[instIdx] : '') || 'VIIRS';

    // Sintesis ID stabil (Jebakan D)
    const id = `firms:${satellite}:${acqDate}T${paddedTime}:${lat.toFixed(4)}:${lon.toFixed(4)}`;

    const rawConf = confIdx !== undefined ? cells[confIdx] || '' : '';
    const confidence = normalizeConfidence(rawConf);

    // Filter default: buang confidence 'low' kecuali diminta
    if (confidence === 'low' && !options?.includeLowConfidence) {
      continue;
    }

    const rawFrp = frpIdx !== undefined ? cells[frpIdx] : '';
    const frp = rawFrp !== '' && !isNaN(parseFloat(rawFrp)) ? parseFloat(rawFrp) : null;
    const severity = calculateFrpSeverity(frp);

    const observedAt = formatAcquisitionIso(acqDate, rawTime);

    const rawBright = brightIdx !== undefined ? cells[brightIdx] : '';
    const brightness = rawBright !== '' && !isNaN(parseFloat(rawBright)) ? parseFloat(rawBright) : null;

    const daynight = (daynightIdx !== undefined ? cells[daynightIdx] : '') || 'D';
    const version = (versionIdx !== undefined ? cells[versionIdx] : '') || '';
    const scan = scanIdx !== undefined && cells[scanIdx] !== '' ? parseFloat(cells[scanIdx]) : null;
    const track = trackIdx !== undefined && cells[trackIdx] !== '' ? parseFloat(cells[trackIdx]) : null;

    const label = `${frp != null ? frp.toFixed(0) : '?'} MW · ${satellite}`;

    const entity: OsintEntity = {
      id,
      layer: 'fire',
      kind: 'event',
      label,
      position: {
        lat,
        lon,
        altM: 0,
      },
      severity,
      observedAt,
      source: `NASA FIRMS / ${instrument} ${satellite}`,
      raw: {
        frp,
        confidence,
        confidenceRaw: rawConf,
        daynight,
        brightness,
        scan: isNaN(scan as number) ? null : scan,
        track: isNaN(track as number) ? null : track,
        version,
      } as FireFeatureRaw,
    };

    entities.push(entity);
  }

  return entities;
}
