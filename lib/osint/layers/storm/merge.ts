// lib/osint/layers/storm/merge.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tropical Cyclone Deduplication and Synthesis.
//
// Combines NOAA NHC (high-precision telemetry for Atlantic / East Pacific)
// with GDACS (global alerts, impacts, report URLs, and geometry).
//
// Rules:
//   1. Name match: normalized name comparison (e.g. "FAY-26" vs "Fay" → "FAY").
//   2. Spatio-temporal match: haversine < 150 km AND observation diff < 6 hours.
//
// Output: Exactly ONE entity per physical storm with stable ID:
//   - If matched or NHC-only: `storm:nhc:${nhcId}`
//   - If GDACS-only: `storm:gdacs:${eventId}`
// ─────────────────────────────────────────────────────────────────────────────

import type { OsintEntity } from '../../types';
import type { NhcParsedStorm } from './nhc';
import type { GdacsParsedStorm } from './gdacs';

export interface MergedStormEntity extends OsintEntity {
  headingDeg?: number;
  speedMs?: number;
  raw: {
    nhcId?: string;
    gdacsEventId?: number;
    gdacsEpisodeId?: number;
    name: string;
    classification: string;
    windKt: number;
    windKmh: number;
    windMs: number;
    pressureMb: number | null;
    alertLevel: 'Green' | 'Orange' | 'Red';
    alertScore?: number;
    movementDir: number | null;
    movementSpeedKt: number | null;
    movementSpeedMs: number | null;
    advisoryNum: string | null;
    advisoryUrl: string | null;
    reportUrl: string | null;
    geometryUrl: string | null;
    affectedCountries: string[];
    nhcRaw?: unknown;
    gdacsRaw?: unknown;
  };
}

/**
 * Normalizes storm name by stripping prefixes ("TROPICAL CYCLONE"),
 * trailing year codes ("-26", "-E-26"), and special characters.
 */
export function normalizeStormName(name: string): string {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/\b(TROPICAL\s+CYCLONE|TROPICAL\s+STORM|HURRICANE|TYPHOON|DEPRESSION)\b/g, '')
    .replace(/-[A-Z0-9]+$/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Great-circle distance between two points in kilometers (Haversine formula).
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates normalized severity [0, 1] based on maximum wind speed in m/s.
 * 80 m/s (~155 knots, strong Category 5) maps to 1.0.
 */
export function calculateStormSeverity(windMs: number): number {
  if (isNaN(windMs) || windMs <= 0) return 0;
  return Math.max(0, Math.min(1, windMs / 80));
}

/**
 * Deduplicates and merges NHC and GDACS storm lists into a single collection of OsintEntity.
 */
export function mergeStormSources(
  nhcStorms: NhcParsedStorm[],
  gdacsStorms: GdacsParsedStorm[],
): MergedStormEntity[] {
  const merged: MergedStormEntity[] = [];
  const matchedGdacsEventIds = new Set<number>();

  for (const nhc of nhcStorms) {
    const nhcNormName = normalizeStormName(nhc.name);
    const nhcTime = new Date(nhc.lastUpdate).getTime();

    // Find best GDACS match
    let bestGdacs: GdacsParsedStorm | null = null;

    // Rule 1: Normalized Name match
    for (const gdacs of gdacsStorms) {
      if (matchedGdacsEventIds.has(gdacs.eventId)) continue;
      const gdacsNormName = normalizeStormName(gdacs.eventName);
      if (nhcNormName && gdacsNormName && nhcNormName === gdacsNormName) {
        bestGdacs = gdacs;
        break;
      }
    }

    // Rule 2: Spatio-temporal match (< 150 km AND < 6 hours)
    if (!bestGdacs) {
      for (const gdacs of gdacsStorms) {
        if (matchedGdacsEventIds.has(gdacs.eventId)) continue;
        const distKm = haversineDistanceKm(nhc.lat, nhc.lon, gdacs.lat, gdacs.lon);
        const gdacsTime = new Date(gdacs.dateModified).getTime();
        const timeDiffHours = Math.abs(nhcTime - gdacsTime) / (1000 * 60 * 60);

        if (distKm < 150 && timeDiffHours < 6) {
          bestGdacs = gdacs;
          break;
        }
      }
    }

    if (bestGdacs) {
      matchedGdacsEventIds.add(bestGdacs.eventId);
    }

    const windMs = nhc.windMs;
    const windKt = nhc.windKt;
    const windKmh = windMs / 0.277778;
    const severity = calculateStormSeverity(windMs);

    const alertLevel = bestGdacs?.alertLevel ?? 'Green';
    const source = bestGdacs ? 'NOAA NHC + GDACS' : 'NOAA NHC';

    merged.push({
      id: `storm:nhc:${nhc.id}`,
      layer: 'storm',
      kind: 'moving',
      label: `${nhc.name} · ${nhc.classification}`,
      position: {
        lat: nhc.lat,
        lon: nhc.lon,
        altM: 0,
      },
      headingDeg: nhc.movementDir ?? undefined,
      speedMs: nhc.movementSpeedMs ?? undefined,
      severity,
      observedAt: nhc.lastUpdate,
      source,
      raw: {
        nhcId: nhc.id,
        gdacsEventId: bestGdacs?.eventId,
        gdacsEpisodeId: bestGdacs?.episodeId,
        name: nhc.name,
        classification: nhc.classification,
        windKt,
        windKmh,
        windMs,
        pressureMb: nhc.pressureMb,
        alertLevel,
        alertScore: bestGdacs?.alertScore,
        movementDir: nhc.movementDir,
        movementSpeedKt: nhc.movementSpeedKt,
        movementSpeedMs: nhc.movementSpeedMs,
        advisoryNum: nhc.advisoryNum,
        advisoryUrl: nhc.advisoryUrl,
        reportUrl: bestGdacs?.reportUrl ?? null,
        geometryUrl: bestGdacs?.geometryUrl ?? null,
        affectedCountries: bestGdacs?.affectedCountries ?? [],
        nhcRaw: nhc.raw,
        gdacsRaw: bestGdacs?.raw,
      },
    });
  }

  // Add remaining unmatched GDACS storms (e.g. West Pacific / Indian Ocean storms)
  for (const gdacs of gdacsStorms) {
    if (matchedGdacsEventIds.has(gdacs.eventId)) continue;

    const windMs = gdacs.windMs;
    const windKmh = gdacs.windKmh;
    const windKt = windMs / 0.514444;
    const severity = calculateStormSeverity(windMs);

    // Extract simple classification or name from displayName
    const classification =
      gdacs.displayName.includes('Hurricane')
        ? 'HU'
        : gdacs.displayName.includes('Typhoon')
          ? 'TY'
          : gdacs.displayName.includes('Depression')
            ? 'TD'
            : 'TS';

    const cleanName = gdacs.eventName.replace(/-[A-Z0-9]+$/g, '');

    merged.push({
      id: `storm:gdacs:${gdacs.eventId}`,
      layer: 'storm',
      kind: 'moving',
      label: `${cleanName} · ${classification}`,
      position: {
        lat: gdacs.lat,
        lon: gdacs.lon,
        altM: 0,
      },
      severity,
      observedAt: gdacs.dateModified,
      source: `GDACS (${gdacs.source || 'JRC'})`,
      raw: {
        gdacsEventId: gdacs.eventId,
        gdacsEpisodeId: gdacs.episodeId,
        name: cleanName,
        classification,
        windKt,
        windKmh,
        windMs,
        pressureMb: null,
        alertLevel: gdacs.alertLevel,
        alertScore: gdacs.alertScore,
        movementDir: null,
        movementSpeedKt: null,
        movementSpeedMs: null,
        advisoryNum: null,
        advisoryUrl: null,
        reportUrl: gdacs.reportUrl,
        geometryUrl: gdacs.geometryUrl,
        affectedCountries: gdacs.affectedCountries,
        gdacsRaw: gdacs.raw,
      },
    });
  }

  return merged;
}
