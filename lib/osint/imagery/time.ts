/**
 * NASA GIBS Imagery Time Dimension Helper
 *
 * Mengelola penentuan tanggal citra satelit harian NASA GIBS.
 *
 * PENTING:
 * 1. GIBS WMTS TIDAK MENDUKUNG kata kunci 'current'. Permintaan tile harus
 *    menyertakan tanggal eksplisit dalam format YYYY-MM-DD.
 * 2. Tile level 0 selalu merespons HTTP 200 bahkan ketika sebagian besar piksel
 *    masih kosong/hitam (belum selesai diakuisisi). Oleh karena itu, kita tidak
 *    boleh menggunakan 'hari ini' (today).
 * 3. Setiap produk satelit memiliki latensi ketersediaan data (latencyDays):
 *    - TrueColor (VIIRS SNPP, MODIS Terra): ~1 hari (kemarin UTC).
 *    - Night Band (VIIRS DNB): ~2 hari (2 hari lalu UTC).
 * 4. Rentang waktu dibatasi maksimal 30 hari ke belakang dari waktu UTC sekarang.
 */

import type { GibsLayer } from './catalog';

/** Maksimum rentang riwayat citra ke belakang (30 hari) */
export const MAX_IMAGERY_HISTORY_DAYS = 30;

/**
 * Format objek Date menjadi string 'YYYY-MM-DD' berdasarkan kalender UTC.
 */
export function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse string 'YYYY-MM-DD' menjadi objek Date UTC tengah malam (00:00:00.000Z).
 * Mengembalikan null jika format tidak valid.
 */
export function parseUtcDate(str: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!match) return null;
  const [, yStr, mStr, dStr] = match;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const d = parseInt(dStr, 10);
  const date = new Date(Date.UTC(y, m, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/**
 * Menghitung tanggal batas atas (paling baru) yang tersedia untuk layer tertentu,
 * dengan memperhitungkan latencyDays produk.
 */
export function getMaxDateForLayer(
  layer: GibsLayer,
  now: Date = new Date(),
): string {
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  target.setUTCDate(target.getUTCDate() - Math.max(0, layer.latencyDays));
  return formatUtcDate(target);
}

/**
 * Menghitung tanggal batas bawah (paling lampau) yang didukung (30 hari ke belakang).
 */
export function getMinDate(now: Date = new Date()): string {
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  target.setUTCDate(target.getUTCDate() - MAX_IMAGERY_HISTORY_DAYS);
  return formatUtcDate(target);
}

/**
 * Menentukan dan memvalidasi tanggal citra yang aman untuk suatu layer.
 *
 * @param layer Entri GibsLayer (mengandung informasi latencyDays dan hasTime)
 * @param dateInput Tanggal opsional yang diminta pengguna (string YYYY-MM-DD atau Date)
 * @param now Waktu referensi (default: waktu sekarang)
 * @returns Tanggal terverifikasi dan ter-clamp dalam format 'YYYY-MM-DD'
 */
export function resolveImageryDate(
  layer: GibsLayer,
  dateInput?: string | Date | null,
  now: Date = new Date(),
): string {
  // Jika layer tidak memiliki dimensi waktu (misal: garis pantai, label), tanggal tidak relevan
  if (!layer.hasTime) {
    return '';
  }

  const maxDateStr = getMaxDateForLayer(layer, now);
  const minDateStr = getMinDate(now);

  if (!dateInput) {
    // Default: tanggal batas atas teraman berdasarkan latensi layer
    return maxDateStr;
  }

  let targetDate: Date | null = null;
  if (typeof dateInput === 'string') {
    targetDate = parseUtcDate(dateInput);
  } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    targetDate = new Date(
      Date.UTC(
        dateInput.getUTCFullYear(),
        dateInput.getUTCMonth(),
        dateInput.getUTCDate(),
      ),
    );
  }

  // Jika input tanggal tidak valid, fallback ke batas atas teraman
  if (!targetDate) {
    return maxDateStr;
  }

  const targetStr = formatUtcDate(targetDate);

  // Clamp tanggal ke batas [minDateStr, maxDateStr]
  if (targetStr < minDateStr) {
    return minDateStr;
  }
  if (targetStr > maxDateStr) {
    return maxDateStr;
  }

  return targetStr;
}
