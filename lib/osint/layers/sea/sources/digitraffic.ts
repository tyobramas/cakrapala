// lib/osint/layers/sea/sources/digitraffic.ts
// ─────────────────────────────────────────────────────────────────────────────
// Digitraffic AIS Source Adapter (Fintraffic, Finland)
//
// Endpoints:
//   - Locations: https://meri.digitraffic.fi/api/ais/v1/locations
//   - Vessels:   https://meri.digitraffic.fi/api/ais/v1/vessels
//
// License: CC BY 4.0
// Attribution: 'Vessel data: Fintraffic Digitraffic (CC BY 4.0)'
//
// Constraints:
//   - Requires header: 'Digitraffic-User': 'Cakrapala-OSINT/1.0'
//   - Requires header: 'Accept-Encoding': 'gzip' (otherwise HTTP 406 from CloudFront)
//   - Caches positions for 20 seconds, vessel metadata for 6 hours.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, OsintEntity } from '@/lib/osint/types';
import type { SeaSourceAdapter, SeaSourceResult } from './types';
import {
  parseHeading,
  parseCog,
  parseRot,
  parseSog,
  parseNavStat,
  parseShipType,
  classifyFreshness,
  isPositionReliable,
} from '../sentinel';

const LOCATIONS_URL = 'https://meri.digitraffic.fi/api/ais/v1/locations';
const VESSELS_URL = 'https://meri.digitraffic.fi/api/ais/v1/vessels';

const USER_AGENT = 'Cakrapala-OSINT/1.0';
const POSITIONS_TTL_MS = 20_000;
const VESSELS_TTL_MS = 6 * 3600 * 1000; // 6 hours

export const BALTIC_COVERAGE_BBOX: BBox = [9.0, 53.0, 33.0, 67.0];

interface RawVesselMeta {
  mmsi: number;
  name?: string;
  callSign?: string;
  imo?: number;
  shipType?: number;
  draught?: number;
  destination?: string;
  referencePointA?: number;
  referencePointB?: number;
  referencePointC?: number;
  referencePointD?: number;
  timestamp?: number;
}

// In-memory caches & deduplication
let cachedVesselsMap: Map<number, RawVesselMeta> | null = null;
let cachedVesselsExpiresAt = 0;
let inFlightVesselsPromise: Promise<Map<number, RawVesselMeta>> | null = null;

interface PositionsCacheEntry {
  features: unknown[];
  dataUpdatedTime: number;
  fetchedAt: number;
}

let cachedPositions: PositionsCacheEntry | null = null;
let inFlightPositionsPromise: Promise<PositionsCacheEntry> | null = null;

export function _resetDigitrafficCacheForTesting(): void {
  cachedVesselsMap = null;
  cachedVesselsExpiresAt = 0;
  inFlightVesselsPromise = null;
  cachedPositions = null;
  inFlightPositionsPromise = null;
}

async function getVesselsMap(): Promise<Map<number, RawVesselMeta>> {
  const now = Date.now();
  if (cachedVesselsMap && now < cachedVesselsExpiresAt) {
    return cachedVesselsMap;
  }
  if (inFlightVesselsPromise) {
    return inFlightVesselsPromise;
  }

  inFlightVesselsPromise = (async () => {
    try {
      const res = await fetch(VESSELS_URL, {
        headers: {
          'Digitraffic-User': USER_AGENT,
          'Accept-Encoding': 'gzip',
        },
      });
      if (!res.ok) {
        // Return existing cache or empty map on error
        return cachedVesselsMap ?? new Map<number, RawVesselMeta>();
      }
      const data = (await res.json()) as RawVesselMeta[];
      const map = new Map<number, RawVesselMeta>();
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.mmsi) map.set(item.mmsi, item);
        }
      }
      cachedVesselsMap = map;
      cachedVesselsExpiresAt = Date.now() + VESSELS_TTL_MS;
      return map;
    } catch {
      return cachedVesselsMap ?? new Map<number, RawVesselMeta>();
    } finally {
      inFlightVesselsPromise = null;
    }
  })();

  return inFlightVesselsPromise;
}

async function getPositions(): Promise<PositionsCacheEntry> {
  const now = Date.now();
  if (cachedPositions && now - cachedPositions.fetchedAt < POSITIONS_TTL_MS) {
    return cachedPositions;
  }
  if (inFlightPositionsPromise) {
    return inFlightPositionsPromise;
  }

  inFlightPositionsPromise = (async () => {
    try {
      const res = await fetch(LOCATIONS_URL, {
        headers: {
          'Digitraffic-User': USER_AGENT,
          'Accept-Encoding': 'gzip',
        },
      });
      if (!res.ok) {
        return cachedPositions ?? { features: [], dataUpdatedTime: now, fetchedAt: now };
      }
      const data = await res.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const dataUpdatedTime = typeof data?.dataUpdatedTime === 'string'
        ? new Date(data.dataUpdatedTime).getTime()
        : now;

      const entry: PositionsCacheEntry = {
        features,
        dataUpdatedTime,
        fetchedAt: Date.now(),
      };
      cachedPositions = entry;
      return entry;
    } catch {
      return cachedPositions ?? { features: [], dataUpdatedTime: now, fetchedAt: now };
    } finally {
      inFlightPositionsPromise = null;
    }
  })();

  return inFlightPositionsPromise;
}

export class DigitrafficSourceAdapter implements SeaSourceAdapter {
  readonly id = 'digitraffic';
  readonly name = 'Fintraffic Digitraffic';
  readonly attribution = 'Vessel data: Fintraffic Digitraffic (CC BY 4.0)';
  readonly coverageBBoxes: BBox[] = [BALTIC_COVERAGE_BBOX];

  async fetchVessels(bbox?: BBox): Promise<SeaSourceResult> {
    const [positionsEntry, vesselsMap] = await Promise.all([
      getPositions(),
      getVesselsMap(),
    ]);

    const now = Date.now();
    const entities: OsintEntity[] = [];

    for (const f of positionsEntry.features as any[]) {
      if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) continue;
      const [lon, lat] = f.geometry.coordinates;
      if (typeof lon !== 'number' || typeof lat !== 'number') continue;

      // Filter by bbox if specified
      if (bbox) {
        const [w, s, e, n] = bbox;
        if (lon < w || lon > e || lat < s || lat > n) {
          continue;
        }
      }

      const p = f.properties || {};
      const mmsi = Number(p.mmsi ?? f.mmsi);
      if (!mmsi || isNaN(mmsi)) continue;

      // Timestamp evaluation
      const timestampExternal = typeof p.timestampExternal === 'number'
        ? p.timestampExternal
        : now;
      const ageSeconds = Math.max(0, Math.floor((now - timestampExternal) / 1000));
      const freshness = classifyFreshness(ageSeconds);

      // Drop vessels older than 12 hours
      if (freshness === 'drop') {
        continue;
      }

      const heading = parseHeading(p.heading);
      const cog = parseCog(p.cog);
      const rot = parseRot(p.rot);
      const sog = parseSog(p.sog);
      const navStat = parseNavStat(p.navStat);
      const positionReliable = isPositionReliable(p.timestamp, p.posAcc);

      // Metadata join
      const meta = vesselsMap.get(mmsi);
      const vesselName = meta?.name ? meta.name.trim() : undefined;
      const label = vesselName || `MMSI ${mmsi}`;
      const shipTypeResult = parseShipType(meta?.shipType);

      // Length and width from AIS dimensions
      const lengthM = meta ? ((meta.referencePointA ?? 0) + (meta.referencePointB ?? 0)) || undefined : undefined;
      const widthM = meta ? ((meta.referencePointC ?? 0) + (meta.referencePointD ?? 0)) || undefined : undefined;
      const draughtM = meta?.draught != null ? meta.draught / 10 : undefined;

      // HeadingDeg priority: heading (if not 511) -> cog (if < 360) -> undefined
      const headingDeg = heading !== undefined ? heading : (cog !== undefined ? cog : undefined);

      // Visual scale severity: emergency (1.0), otherwise ship category scale
      const severity = navStat.isEmergency ? 1.0 : shipTypeResult.severity;

      const entity: OsintEntity = {
        id: `sea:${mmsi}`,
        layer: 'sea',
        kind: 'moving',
        label,
        position: { lat, lon, altM: 0 },
        headingDeg,
        speedMs: sog.speedMs,
        severity,
        observedAt: new Date(timestampExternal).toISOString(),
        source: 'Fintraffic Digitraffic',
        raw: {
          mmsi,
          imo: meta?.imo,
          callsign: meta?.callSign ? meta.callSign.trim() : undefined,
          shipTypeCode: shipTypeResult.code,
          shipTypeLabel: shipTypeResult.labelEn,
          shipTypeCategory: shipTypeResult.category,
          navStat: navStat.code,
          navStatLabel: navStat.labelEn,
          navStatLabelEn: navStat.labelEn,
          isSpecialNav: navStat.isSpecial,
          isEmergency: navStat.isEmergency,
          headingRaw: p.heading,
          cogRaw: p.cog,
          rotRaw: p.rot,
          rotDegMin: rot.rotDegMin,
          fastTurn: rot.fastTurn,
          sogKnots: sog.sogKnots,
          posAcc: p.posAcc,
          raim: p.raim,
          tsSecond: p.timestamp,
          ageS: ageSeconds,
          freshness,
          destination: meta?.destination ? meta.destination.trim() : undefined,
          draughtM,
          lengthM,
          widthM,
          positionReliable,
        },
      };

      entities.push(entity);
    }

    return {
      entities,
      upstreamUpdatedTime: positionsEntry.dataUpdatedTime,
      totalVesselsInSource: positionsEntry.features.length,
    };
  }
}

export const digitrafficAdapter = new DigitrafficSourceAdapter();
