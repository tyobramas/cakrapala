// lib/osint/layers/air/parse.ts
// ─────────────────────────────────────────────────────────────────────────────
// ADS-B Flight Data Parser for adsb.lol.
//
// Endpoint: https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}
// License: ODbL (Open Database License)
//
// JEBAKAN A: alt_baro can be string 'ground'. Convert to onGround: true, altM: 0.
// JEBAKAN B: flight has trailing padding spaces (width 8). Must .trim().
//            If empty, fallback to registration, then hex.
// JEBAKAN C: seen_pos age:
//   - seen_pos <= 30 s: fresh, full dead reckoning.
//   - 30 < seen_pos <= 120 s: stale, render with reduced opacity, NO dead reckoning.
//   - seen_pos > 120 s: discard.
// JEBAKAN D: heading priority: track -> true_heading -> mag_heading -> undefined (NEVER 0).
// JEBAKAN E: dbFlags is a BITFIELD. Military aircraft: (dbFlags & 1) === 1.
// JEBAKAN F: 'type' reveals position quality (adsb_icao vs mlat vs tisb).
// ─────────────────────────────────────────────────────────────────────────────

export interface AdsbAircraftRaw {
  hex: string;
  type?: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | string | null;
  alt_geom?: number | null;
  gs?: number | null; // knots
  track?: number | null;
  true_heading?: number | null;
  mag_heading?: number | null;
  baro_rate?: number | null;
  geom_rate?: number | null;
  squawk?: string | null;
  category?: string | null;
  lat?: number | null;
  lon?: number | null;
  seen_pos?: number | null; // seconds
  seen?: number | null;
  dst?: number | null; // nautical miles
  dbFlags?: number | null;
  rssi?: number | null;
  [key: string]: unknown;
}

export interface AdsbResponseRaw {
  ac?: AdsbAircraftRaw[];
  now?: number; // epoch ms
  total?: number;
  ctime?: number;
  ptime?: number;
  msg?: string;
  [key: string]: unknown;
}

export interface ParsedAircraft {
  hex: string;
  callsign: string;
  label: string;
  registration: string | null;
  acType: string | null;
  category: string | null;
  lat: number;
  lon: number;
  altM: number;
  altBaroM: number | null;
  altGeomM: number | null;
  onGround: boolean;
  speedKt: number;
  speedMs: number;
  headingDeg: number | undefined;
  verticalRateMs: number | null;
  squawk: string | null;
  seenPosS: number;
  fresh: boolean; // seen_pos <= 30
  isMilitary: boolean;
  posSource: string;
  dstNm: number | null;
  rssi: number | null;
  observedAt: string;
  severity: number; // visual scale channel based on aircraft size/category
  raw: AdsbAircraftRaw;
}

const KT_TO_MS = 0.514444;
const FT_TO_M = 0.3048;
const FPM_TO_MS = 0.00508;

/**
 * Maps aircraft category / type to visual scale severity (0..1).
 * NOTE: Severity in the air layer is used strictly for 3D visual scale, NOT danger.
 */
export function calculateAircraftVisualScale(
  category?: string | null,
  acType?: string | null,
): number {
  if (category === 'A5') return 1.0; // Heavy / Wide-body
  if (category === 'A4') return 0.85; // Large airliner
  if (category === 'A3') return 0.7; // Medium airliner (A320, B738)
  if (category === 'A2') return 0.5; // Regional / Turboprop
  if (category === 'A7') return 0.4; // Rotorcraft / Helicopter
  if (category === 'A1' || category === 'A0') return 0.35; // Light aircraft

  // Fallback by aircraft type
  if (acType) {
    const t = acType.toUpperCase();
    if (['B744', 'B748', 'B77W', 'B772', 'B773', 'B788', 'B789', 'B78X', 'A388', 'A359', 'A35K', 'A332', 'A333', 'A339'].includes(t)) {
      return 1.0;
    }
    if (['A320', 'A20N', 'A321', 'A21N', 'B737', 'B738', 'B739', 'B38M', 'B39M'].includes(t)) {
      return 0.7;
    }
    if (t.startsWith('H') || t.startsWith('EC') || t.startsWith('AS') || t.startsWith('S76')) {
      return 0.4; // Helicopter
    }
  }

  return 0.45;
}

/**
 * Resolves heading priority:
 * track -> true_heading -> mag_heading -> undefined (NEVER default to 0°).
 */
export function resolveAircraftHeading(raw: AdsbAircraftRaw): number | undefined {
  if (typeof raw.track === 'number' && !isNaN(raw.track)) {
    return raw.track;
  }
  if (typeof raw.true_heading === 'number' && !isNaN(raw.true_heading)) {
    return raw.true_heading;
  }
  if (typeof raw.mag_heading === 'number' && !isNaN(raw.mag_heading)) {
    return raw.mag_heading;
  }
  return undefined;
}

/**
 * Parses an adsb.lol API JSON response into normalized aircraft structures.
 */
export function parseAdsbPayload(payload: unknown): ParsedAircraft[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const data = payload as AdsbResponseRaw;
  if (!Array.isArray(data.ac) || data.ac.length === 0) {
    return [];
  }

  const nowEpoch = typeof data.now === 'number' && !isNaN(data.now) ? data.now : Date.now();
  const results: ParsedAircraft[] = [];

  for (const ac of data.ac) {
    if (!ac || typeof ac !== 'object') continue;

    const hex = String(ac.hex ?? '').trim().toLowerCase();
    if (!hex) continue;

    // Lat / Lon validation
    const lat = typeof ac.lat === 'number' ? ac.lat : NaN;
    const lon = typeof ac.lon === 'number' ? ac.lon : NaN;
    if (isNaN(lat) || isNaN(lon)) continue;

    // JEBAKAN C: seen_pos filtering
    const seenPosS = typeof ac.seen_pos === 'number' && !isNaN(ac.seen_pos) ? Math.max(0, ac.seen_pos) : 0;
    if (seenPosS > 120) {
      // Stale > 2 minutes: discard
      continue;
    }
    const fresh = seenPosS <= 30;

    // JEBAKAN A: alt_baro handling
    let onGround = false;
    let altM: number = 0;
    let altBaroM: number | null = null;
    let altGeomM: number | null = null;

    if (ac.alt_baro === 'ground') {
      onGround = true;
      altM = 0;
      altBaroM = 0;
    } else if (typeof ac.alt_baro === 'number' && !isNaN(ac.alt_baro)) {
      altBaroM = ac.alt_baro * FT_TO_M;
      altM = altBaroM;
    } else if (typeof ac.alt_geom === 'number' && !isNaN(ac.alt_geom)) {
      altGeomM = ac.alt_geom * FT_TO_M;
      altM = altGeomM;
    } else {
      altM = 0;
    }

    if (typeof ac.alt_geom === 'number' && !isNaN(ac.alt_geom)) {
      altGeomM = ac.alt_geom * FT_TO_M;
    }

    // JEBAKAN B: Callsign trimming & fallback
    const rawFlight = String(ac.flight ?? '').trim();
    const registration = ac.r ? String(ac.r).trim() : null;
    const label = rawFlight || registration || hex.toUpperCase();

    // Speed
    const speedKt = typeof ac.gs === 'number' && !isNaN(ac.gs) ? Math.max(0, ac.gs) : 0;
    const speedMs = speedKt * KT_TO_MS;

    // JEBAKAN D: Heading resolution
    const headingDeg = resolveAircraftHeading(ac);

    // Vertical rate
    const rateFpm = typeof ac.baro_rate === 'number' ? ac.baro_rate : typeof ac.geom_rate === 'number' ? ac.geom_rate : null;
    const verticalRateMs = rateFpm !== null && !isNaN(rateFpm) ? rateFpm * FPM_TO_MS : null;

    // JEBAKAN E: Military bitfield check (dbFlags bit 0)
    const isMilitary = typeof ac.dbFlags === 'number' ? (ac.dbFlags & 1) === 1 : false;

    // JEBAKAN F: Position source quality
    const posSource = String(ac.type ?? 'adsb_icao');

    // Observed at: now - seen_pos * 1000
    const observedEpoch = nowEpoch - Math.round(seenPosS * 1000);
    const observedAt = new Date(observedEpoch).toISOString();

    const severity = calculateAircraftVisualScale(ac.category, ac.t);

    results.push({
      hex,
      callsign: rawFlight,
      label,
      registration,
      acType: ac.t ? String(ac.t).trim() : null,
      category: ac.category ? String(ac.category).trim() : null,
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
      squawk: ac.squawk ? String(ac.squawk).trim() : null,
      seenPosS,
      fresh,
      isMilitary,
      posSource,
      dstNm: typeof ac.dst === 'number' ? ac.dst : null,
      rssi: typeof ac.rssi === 'number' ? ac.rssi : null,
      observedAt,
      severity,
      raw: ac,
    });
  }

  return results;
}
