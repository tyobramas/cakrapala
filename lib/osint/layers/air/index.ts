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
import type { BBox, LayerPayload, OsintEntity } from '../../types';
import { bboxToCenterRadius, haversineDistKm, MAX_RADIUS_NM } from './geo';
import {
  parseAdsbPayload,
  calculateAircraftVisualScale,
  type ParsedAircraft,
} from './parse';
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

interface OpenSkyResponse {
  time?: number;
  states?: Array<Array<string | number | boolean | null>> | null;
}

/**
 * Normalizes OpenSky Network /api/states/all into ParsedAircraft[].
 * State vector indices:
 *   0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
 *   5: lon, 6: lat, 7: baro_altitude (m), 8: on_ground, 9: velocity (m/s),
 *   10: true_track (deg), 11: vertical_rate (m/s), 13: geo_altitude (m),
 *   14: squawk, 17: category
 */
function parseOpenSkyPayload(
  payload: unknown,
  centerLat: number,
  centerLon: number,
): ParsedAircraft[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as OpenSkyResponse;
  if (!Array.isArray(data.states) || data.states.length === 0) return [];

  const nowEpoch =
    typeof data.time === 'number' && !isNaN(data.time)
      ? data.time * 1000
      : Date.now();
  const results: ParsedAircraft[] = [];

  for (const s of data.states) {
    if (!Array.isArray(s) || s.length < 12) continue;
    const hex = String(s[0] ?? '').trim().toLowerCase();
    const lon = typeof s[5] === 'number' ? s[5] : NaN;
    const lat = typeof s[6] === 'number' ? s[6] : NaN;
    if (!hex || isNaN(lat) || isNaN(lon)) continue;

    const timePosSec = typeof s[3] === 'number' ? s[3] : typeof s[4] === 'number' ? s[4] : Math.floor(nowEpoch / 1000);
    const seenPosS = Math.max(0, Math.floor(nowEpoch / 1000) - timePosSec);
    if (seenPosS > 120) continue;

    const callsign = String(s[1] ?? '').trim();
    const label = callsign || hex.toUpperCase();
    const onGround = Boolean(s[8]);
    const altBaroM = typeof s[7] === 'number' && !isNaN(s[7]) ? s[7] : null;
    const altGeomM = typeof s[13] === 'number' && !isNaN(s[13]) ? s[13] : null;
    const altM = onGround ? 0 : (altBaroM ?? altGeomM ?? 0);
    const speedMs = typeof s[9] === 'number' && !isNaN(s[9]) ? Math.max(0, s[9]) : 0;
    const speedKt = speedMs / 0.514444;
    const headingDeg = typeof s[10] === 'number' && !isNaN(s[10]) ? s[10] : undefined;
    const verticalRateMs = typeof s[11] === 'number' && !isNaN(s[11]) ? s[11] : null;
    const squawk = s[14] ? String(s[14]).trim() : null;
    const dstNm = haversineDistKm(centerLat, centerLon, lat, lon) / 1.852;

    results.push({
      hex,
      callsign,
      label,
      registration: null,
      acType: null,
      category: null,
      lat,
      lon,
      altM,
      altBaroM,
      altGeomM,
      onGround,
      speedKt,
      speedMs,
      headingDeg,
      verticalRateMs,
      squawk,
      seenPosS,
      fresh: seenPosS <= 30,
      isMilitary: false,
      posSource: 'opensky',
      dstNm,
      rssi: null,
      observedAt: new Date(timePosSec * 1000).toISOString(),
      severity: calculateAircraftVisualScale(null, null),
      raw: { hex, flight: callsign, lat, lon },
    });
  }

  return results;
}

export const rawFetchAirLayer: LayerFetcher = async (
  params: FetchLayerParams,
): Promise<LayerPayload> => {
  let centerLat: number;
  let centerLon: number;
  let radiusNm: number;
  let queryBBox: BBox | null = null;

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
    queryBBox = params.bbox;
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

  const adsbUrl = `https://api.adsb.lol/v2/lat/${centerLat}/lon/${centerLon}/dist/${radiusNm}`;
  const degSpan = Math.min(3.5, (radiusNm * 1.852) / 111);
  const [w, s, e, n] = queryBBox ?? [
    centerLon - degSpan,
    centerLat - degSpan,
    centerLon + degSpan,
    centerLat + degSpan,
  ];
  const openSkyUrl = `https://opensky-network.org/api/states/all?lamin=${s.toFixed(3)}&lomin=${w.toFixed(3)}&lamax=${n.toFixed(3)}&lomax=${e.toFixed(3)}`;

  const [adsbResult, openSkyResult] = await Promise.allSettled([
    fetch(adsbUrl, {
      signal: params.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': ADSB_USER_AGENT,
        ...ADSB_AUTH_HEADER,
      },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`adsb.lol HTTP ${res.status}`);
      return parseAdsbPayload(await res.json());
    }),
    fetch(openSkyUrl, {
      signal: params.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': ADSB_USER_AGENT,
      },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
      return parseOpenSkyPayload(await res.json(), centerLat, centerLon);
    }),
  ]);

  const adsbAircraft = adsbResult.status === 'fulfilled' ? adsbResult.value : [];
  const openSkyAircraft = openSkyResult.status === 'fulfilled' ? openSkyResult.value : [];

  if (adsbResult.status === 'rejected' && openSkyResult.status === 'rejected') {
    throw adsbResult.reason instanceof Error
      ? adsbResult.reason
      : new Error('All ADS-B flight providers failed');
  }

  // Merge by ICAO24 hex: prefer adsb.lol rich metadata (acType, reg, military),
  // enrich missing callsigns from OpenSky, and include OpenSky-only aircraft.
  const mergedMap = new Map<string, { ac: ParsedAircraft; source: string }>();
  for (const ac of adsbAircraft) {
    mergedMap.set(ac.hex, { ac, source: 'adsb.lol' });
  }
  for (const osAc of openSkyAircraft) {
    const existing = mergedMap.get(osAc.hex);
    if (existing) {
      if (!existing.ac.callsign && osAc.callsign) {
        existing.ac = {
          ...existing.ac,
          callsign: osAc.callsign,
          label: osAc.callsign,
        };
      }
    } else {
      mergedMap.set(osAc.hex, { ac: osAc, source: 'OpenSky Network' });
    }
  }

  const parsedEntries = Array.from(mergedMap.values());
  const totalFound = parsedEntries.length;
  let prunedCount = 0;
  let finalEntries = parsedEntries;

  // Enforce 1,200 aircraft cap: sort by distance (closest first) and prune
  if (parsedEntries.length > MAX_AIRCRAFT_CAP) {
    finalEntries = [...parsedEntries].sort((a, b) => {
      const dstA = a.ac.dstNm ?? 9999;
      const dstB = b.ac.dstNm ?? 9999;
      return dstA - dstB;
    });
    prunedCount = finalEntries.length - MAX_AIRCRAFT_CAP;
    finalEntries = finalEntries.slice(0, MAX_AIRCRAFT_CAP);
  }

  const entities: OsintEntity[] = finalEntries.map(({ ac, source }) => ({
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
    source,
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
