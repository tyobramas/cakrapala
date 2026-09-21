// lib/osint/layers/air/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Layer Adapter: ADS-B Flight Tracking (adsb.lol)
//
// Endpoint: https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}
// Data license: ODbL (Open Database License)
//
// POLICY NOTE:
//   adsb.lol asks heavy or commercial users to contact the maintainers. In the
//   future, an API key or bearer token will be required for non-feeders.
//   The ADSB_AUTH_HEADER constant is defined here centrally so any future auth
//   token changes can be applied in one place without touching multiple files.
// ─────────────────────────────────────────────────────────────────────────────

import type { FetchLayerParams, LayerFetcher } from '../../adapter';
import type { LayerPayload, OsintEntity } from '../../types';
import { bboxToCenterRadius, MAX_RADIUS_NM } from './geo';
import { parseAdsbPayload, type ParsedAircraft } from './parse';
import { wrapAdapter } from '../../adapter';

/**
 * Centralized auth header placeholder for future adsb.lol API key requirement.
 */
export const ADSB_AUTH_HEADER: Record<string, string> = {
  // e.g. 'Authorization': `Bearer ${process.env.ADSB_API_KEY}`
};

export const ADSB_USER_AGENT =
  'Cakrapala-OSINT/1.0 (https://github.com/tyobramas/cakrapala)';

export const MAX_AIRCRAFT_CAP = 1200;

export const rawFetchAirLayer: LayerFetcher = async (
  params: FetchLayerParams,
): Promise<LayerPayload> => {
  let centerLat: number;
  let centerLon: number;
  let radiusNm: number;

  if (params.bbox) {
    const cr = bboxToCenterRadius(params.bbox);
    if (cr.isTooLarge) {
      return {
        layer: 'air',
        entities: [],
        fetchedAt: new Date().toISOString(),
        upstreamAt: null,
        stale: false,
        error: 'AREA_TOO_LARGE',
      };
    }
    centerLat = cr.centerLat;
    centerLon = cr.centerLon;
    radiusNm = cr.radiusNm;
  } else if (
    typeof params.options?.lat === 'number' &&
    typeof params.options?.lon === 'number'
  ) {
    centerLat = params.options.lat;
    centerLon = params.options.lon;
    radiusNm = Math.min(
      MAX_RADIUS_NM,
      typeof params.options?.dist === 'number' ? params.options.dist : 100,
    );
  } else {
    // Default fallback to Jakarta center if neither bbox nor center provided
    centerLat = -6.2;
    centerLon = 106.8;
    radiusNm = 100;
  }

  const url = `https://api.adsb.lol/v2/lat/${centerLat}/lon/${centerLon}/dist/${radiusNm}`;

  const response = await fetch(url, {
    signal: params.signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': ADSB_USER_AGENT,
      ...ADSB_AUTH_HEADER,
    },
  });

  if (!response.ok) {
    throw new Error(`adsb.lol HTTP ${response.status}`);
  }

  const json = await response.json();
  const parsed = parseAdsbPayload(json);

  const totalFound = parsed.length;
  let prunedCount = 0;
  let finalAircraft: ParsedAircraft[] = parsed;

  // Enforce 1,200 aircraft cap: sort by distance (closest first) and prune
  if (parsed.length > MAX_AIRCRAFT_CAP) {
    finalAircraft = [...parsed].sort((a, b) => {
      const dstA = a.dstNm ?? 9999;
      const dstB = b.dstNm ?? 9999;
      return dstA - dstB;
    });
    prunedCount = finalAircraft.length - MAX_AIRCRAFT_CAP;
    finalAircraft = finalAircraft.slice(0, MAX_AIRCRAFT_CAP);
  }

  const entities: OsintEntity[] = finalAircraft.map((ac) => ({
    id: `air:${ac.hex}`,
    layer: 'air',
    kind: 'moving',
    label: ac.label,
    position: {
      lat: ac.lat,
      lon: ac.lon,
      altM: ac.altM,
    },
    headingDeg: ac.headingDeg,
    speedMs: ac.speedMs,
    severity: ac.severity,
    observedAt: ac.observedAt,
    source: 'adsb.lol',
    raw: {
      hex: ac.hex,
      callsign: ac.callsign,
      registration: ac.registration,
      acType: ac.acType,
      category: ac.category,
      squawk: ac.squawk,
      altBaroM: ac.altBaroM,
      altGeomM: ac.altGeomM,
      verticalRateMs: ac.verticalRateMs,
      onGround: ac.onGround,
      seenPosS: ac.seenPosS,
      fresh: ac.fresh,
      posSource: ac.posSource,
      isMilitary: ac.isMilitary,
      dstNm: ac.dstNm,
      rssi: ac.rssi,
      totalFound,
      prunedCount,
      adsbRaw: ac.raw,
    },
  }));

  // Determine latest upstream observation time
  let latestUpstream: string | null = null;
  for (const ent of entities) {
    if (!latestUpstream || ent.observedAt > latestUpstream) {
      latestUpstream = ent.observedAt;
    }
  }

  return {
    layer: 'air',
    entities,
    fetchedAt: new Date().toISOString(),
    upstreamAt: latestUpstream,
    stale: false,
    error: null,
  };
};

export const fetchAirLayer = wrapAdapter('air', rawFetchAirLayer);
