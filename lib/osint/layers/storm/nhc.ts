// lib/osint/layers/storm/nhc.ts
// ─────────────────────────────────────────────────────────────────────────────
// NOAA National Hurricane Center (NHC) Tropical Cyclone Parser.
//
// Endpoint: https://www.nhc.noaa.gov/CurrentStorms.json
// Coverage: Atlantic and Eastern/Central Pacific basins only.
// Public domain, no API key required.
//
// JEBAKAN A: intensity & pressure are strings ("60", "995"). Must convert explicitly.
// JEBAKAN B: wind & movement speed are in KNOTS. Convert to SI m/s (1 kt = 0.514444 m/s).
// JEBAKAN C: KMZ/GIS urls are kept in raw; do not unzip/parse KMZ on server.
// JEBAKAN D: Watches/warnings/GIS fields can be null. Safe navigation required.
// JEBAKAN E: activeStorms can be an empty array outside cyclone season (normal).
// ─────────────────────────────────────────────────────────────────────────────

export interface NhcStormRaw {
  id: string; // e.g. "al062026" (basin + number + year, stable)
  binNumber?: string;
  name: string;
  classification: string;
  intensity?: string | number; // knots string, e.g. "60"
  pressure?: string | number; // mb string, e.g. "995"
  latitude?: string;
  longitude?: string;
  latitudeNumeric?: number;
  longitudeNumeric?: number;
  movementDir?: number | string; // degrees
  movementSpeed?: number | string; // knots
  lastUpdate?: string; // ISO UTC, e.g. "2026-09-21T03:00:00.000Z"
  publicAdvisory?: {
    advNum?: string;
    issuance?: string;
    fileUpdateTime?: string;
    url?: string;
  } | null;
  forecastAdvisory?: {
    advNum?: string;
    url?: string;
  } | null;
  [key: string]: unknown;
}

export interface NhcResponseRaw {
  activeStorms?: NhcStormRaw[];
  [key: string]: unknown;
}

export interface NhcParsedStorm {
  id: string;
  name: string;
  classification: string;
  windKt: number;
  windMs: number;
  pressureMb: number | null;
  lat: number;
  lon: number;
  movementDir: number | null;
  movementSpeedKt: number | null;
  movementSpeedMs: number | null;
  lastUpdate: string;
  advisoryNum: string | null;
  advisoryUrl: string | null;
  raw: NhcStormRaw;
}

const KT_TO_MS = 0.514444;

/**
 * Parses raw NOAA NHC JSON payload into normalized storm objects.
 */
export function parseNhcPayload(payload: unknown): NhcParsedStorm[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const data = payload as NhcResponseRaw;
  if (!Array.isArray(data.activeStorms) || data.activeStorms.length === 0) {
    return [];
  }

  const results: NhcParsedStorm[] = [];

  for (const storm of data.activeStorms) {
    if (!storm || typeof storm !== 'object') continue;

    // Must have latitudeNumeric and longitudeNumeric
    const lat = typeof storm.latitudeNumeric === 'number' ? storm.latitudeNumeric : NaN;
    const lon = typeof storm.longitudeNumeric === 'number' ? storm.longitudeNumeric : NaN;

    if (isNaN(lat) || isNaN(lon)) continue;

    // Intensity string in knots
    const windKt =
      typeof storm.intensity === 'number'
        ? storm.intensity
        : parseFloat(String(storm.intensity ?? '0'));
    const validWindKt = isNaN(windKt) ? 0 : Math.max(0, windKt);
    const windMs = validWindKt * KT_TO_MS;

    // Pressure string in mb
    const pressureRaw =
      typeof storm.pressure === 'number'
        ? storm.pressure
        : parseFloat(String(storm.pressure ?? ''));
    const pressureMb = isNaN(pressureRaw) || pressureRaw <= 0 ? null : pressureRaw;

    // Movement direction (degrees) and speed (knots)
    const movDirRaw =
      typeof storm.movementDir === 'number'
        ? storm.movementDir
        : parseFloat(String(storm.movementDir ?? ''));
    const movementDir = isNaN(movDirRaw) ? null : movDirRaw;

    const movSpeedRaw =
      typeof storm.movementSpeed === 'number'
        ? storm.movementSpeed
        : parseFloat(String(storm.movementSpeed ?? ''));
    const movementSpeedKt = isNaN(movSpeedRaw) ? null : movSpeedRaw;
    const movementSpeedMs = movementSpeedKt !== null ? movementSpeedKt * KT_TO_MS : null;

    // Observation time
    const lastUpdate =
      typeof storm.lastUpdate === 'string' && storm.lastUpdate.trim()
        ? storm.lastUpdate.trim()
        : new Date().toISOString();

    const advisoryNum = storm.publicAdvisory?.advNum ?? null;
    const advisoryUrl = storm.publicAdvisory?.url ?? null;

    results.push({
      id: String(storm.id ?? `nhc-${lat}-${lon}`),
      name: String(storm.name ?? 'Unnamed').trim(),
      classification: String(storm.classification ?? 'TC').trim(),
      windKt: validWindKt,
      windMs,
      pressureMb,
      lat,
      lon,
      movementDir,
      movementSpeedKt,
      movementSpeedMs,
      lastUpdate,
      advisoryNum,
      advisoryUrl,
      raw: storm,
    });
  }

  return results;
}

/**
 * Fetches active storms from NOAA NHC.
 */
export async function fetchNhcActiveStorms(signal?: AbortSignal): Promise<NhcParsedStorm[]> {
  const url = 'https://www.nhc.noaa.gov/CurrentStorms.json';
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Cakrapala-OSINT/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA NHC HTTP ${response.status}`);
  }

  const json = await response.json();
  return parseNhcPayload(json);
}
