// lib/osint/layers/storm/gdacs.ts
// ─────────────────────────────────────────────────────────────────────────────
// GDACS (Global Disaster Alert and Coordination System) Tropical Cyclone Parser.
//
// Endpoint: https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH
// Coverage: GLOBAL (combines NOAA, JTWC, JMA, etc.).
// Attribution required: "GDACS (JRC, European Commission)"
//
// JEBAKAN F: Timestamps ('fromdate', 'todate', 'datemodified') lack 'Z'.
//   Without 'Z', JS Date parses as LOCAL browser time! Always append 'Z'.
// JEBAKAN G: 'iscurrent' and 'istemporary' are strings "true" / "false".
//   Must compare explicitly with === 'true'.
// JEBAKAN H: 'severity' is in KM/H. Convert to SI m/s (1 km/h = 0.277778 m/s).
// ─────────────────────────────────────────────────────────────────────────────

export interface GdacsFeatureProperties {
  eventtype: string;
  eventid: number;
  episodeid: number;
  eventname: string; // e.g. "FAY-26"
  name: string; // e.g. "Tropical Cyclone FAY-26"
  description?: string;
  htmldescription?: string;
  alertlevel: 'Green' | 'Orange' | 'Red' | string;
  alertscore?: number;
  episodealertlevel?: string;
  episodealertscore?: number;
  istemporary: string; // "true" | "false"
  iscurrent: string; // "true" | "false"
  fromdate?: string; // e.g. "2026-09-19T15:00:00"
  todate?: string; // e.g. "2026-09-21T03:00:00"
  datemodified?: string; // e.g. "2026-09-21T06:20:32"
  source?: string; // e.g. "NOAA", "JTWC"
  sourceid?: string;
  country?: string;
  affectedcountries?: Array<{
    iso2?: string;
    iso3?: string;
    countryname?: string;
  }>;
  url?: {
    geometry?: string;
    report?: string;
    details?: string;
  };
  severitydata?: {
    severity?: number; // km/h
    severitytext?: string;
    severityunit?: string;
  };
  [key: string]: unknown;
}

export interface GdacsFeature {
  type: string;
  bbox?: [number, number, number, number] | null;
  geometry: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
  properties: GdacsFeatureProperties;
}

export interface GdacsFeatureCollection {
  type: 'FeatureCollection';
  features?: GdacsFeature[];
  bbox?: unknown;
}

export interface GdacsParsedStorm {
  eventId: number;
  episodeId: number;
  eventName: string; // "FAY-26"
  displayName: string; // "Tropical Cyclone FAY-26"
  alertLevel: 'Green' | 'Orange' | 'Red';
  alertScore: number;
  isCurrent: boolean;
  lat: number;
  lon: number;
  windKmh: number;
  windMs: number;
  source: string;
  fromDate: string | null;
  toDate: string | null;
  dateModified: string;
  affectedCountries: string[];
  geometryUrl: string | null;
  reportUrl: string | null;
  raw: GdacsFeature;
}

const KMH_TO_MS = 0.277778;

/**
 * JEBAKAN F: GDACS date strings are in UTC but omit the 'Z' timezone indicator
 * (e.g. "2026-09-21T03:00:00"). Without 'Z', JavaScript's Date constructor
 * treats the string as local time, shifting the observation by the client's UTC offset.
 *
 * This function ensures 'Z' is appended and returns a strict ISO 8601 UTC string.
 */
export function parseGdacsDate(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString();
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return new Date().toISOString();
  }

  // If already has Z or explicit offset, parse directly.
  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  // Append 'Z' to force UTC interpretation.
  const utcStr = `${trimmed}Z`;
  const d = new Date(utcStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Parses a GDACS FeatureCollection into normalized GDACS storm objects.
 */
export function parseGdacsPayload(
  payload: unknown,
  options?: { allPast?: boolean },
): GdacsParsedStorm[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const data = payload as GdacsFeatureCollection;
  if (!Array.isArray(data.features) || data.features.length === 0) {
    return [];
  }

  const results: GdacsParsedStorm[] = [];

  for (const feature of data.features) {
    if (!feature || typeof feature !== 'object' || !feature.properties) continue;
    const props = feature.properties;

    // JEBAKAN G: iscurrent is string "true" / "false".
    const isCurrent = props.iscurrent === 'true';
    if (!options?.allPast && !isCurrent) {
      continue;
    }

    // Geometry coordinates: [lon, lat]
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (isNaN(lon) || isNaN(lat)) continue;

    // Severity in km/h -> convert to m/s
    const windKmh =
      typeof props.severitydata?.severity === 'number'
        ? Math.max(0, props.severitydata.severity)
        : 0;
    const windMs = windKmh * KMH_TO_MS;

    // Alert level
    const alertLevel: 'Green' | 'Orange' | 'Red' =
      props.alertlevel === 'Red'
        ? 'Red'
        : props.alertlevel === 'Orange'
          ? 'Orange'
          : 'Green';

    // Dates
    const fromDate = props.fromdate ? parseGdacsDate(props.fromdate) : null;
    const toDate = props.todate ? parseGdacsDate(props.todate) : null;
    const dateModified = parseGdacsDate(props.datemodified ?? props.todate);

    // Affected countries
    const affectedCountries: string[] = [];
    if (Array.isArray(props.affectedcountries)) {
      for (const c of props.affectedcountries) {
        if (c?.countryname) {
          affectedCountries.push(c.countryname);
        }
      }
    }

    results.push({
      eventId: props.eventid,
      episodeId: props.episodeid,
      eventName: String(props.eventname ?? `TC-${props.eventid}`),
      displayName: String(props.name ?? props.eventname ?? 'Tropical Cyclone'),
      alertLevel,
      alertScore: Number(props.alertscore ?? 0),
      isCurrent,
      lat,
      lon,
      windKmh,
      windMs,
      source: String(props.source ?? 'GDACS'),
      fromDate,
      toDate,
      dateModified,
      affectedCountries,
      geometryUrl: props.url?.geometry ?? null,
      reportUrl: props.url?.report ?? null,
      raw: feature,
    });
  }

  return results;
}

/**
 * Formats a Date object to YYYY-MM-DD UTC.
 */
function formatDateUtc(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetches active tropical cyclones from GDACS search endpoint.
 */
export async function fetchGdacsActiveStorms(
  options?: { allPast?: boolean },
  signal?: AbortSignal,
): Promise<GdacsParsedStorm[]> {
  const now = new Date();
  const toDateStr = formatDateUtc(now);

  const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromDateStr = formatDateUtc(pastWeek);

  // Semicolon separator for alert levels
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&alertlevel=Green;Orange;Red&fromdate=${fromDateStr}&todate=${toDateStr}`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Cakrapala-OSINT/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`GDACS HTTP ${response.status}`);
  }

  const json = await response.json();
  return parseGdacsPayload(json, options);
}
