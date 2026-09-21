// lib/osint/layers/quake.ts
// ─────────────────────────────────────────────────────────────────────────────
// USGS Earthquake layer adapter.
//
// Upstream: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
// This feed is PUBLIC DOMAIN — no API key required.
// Uses all_day (not all_hour) so the map has data even during seismically
// quiet periods.
//
// GeoJSON coordinate order: [longitude, latitude, depthKm].
// Depth is in kilometres and represents below-surface → stored as negative
// altM in our OsintEntity.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, LayerPayload, OsintEntity } from '../types';
import type { FetchLayerParams, LayerFetcher } from '../adapter';
import { wrapAdapter } from '../adapter';

const UPSTREAM_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

// ── Normaliser ──────────────────────────────────────────────────────────────

/** Clamp a number to [min, max]. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** GeoJSON Feature from the USGS feed. */
interface USGSFeature {
  id?: string;
  properties: {
    ids?: string;
    place?: string;
    mag?: number | null;
    time?: number;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: [lon: number, lat: number, depthKm: number];
  };
}

interface USGSGeoJSON {
  type: string;
  metadata?: { generated?: number; [key: string]: unknown };
  features: USGSFeature[];
}

/**
 * Normalise a single USGS GeoJSON feature into an OsintEntity.
 *
 * IMPORTANT: GeoJSON coordinates are [longitude, latitude, depthKm].
 * The order is lon-first, NOT lat-first.
 */
export function normaliseQuakeFeature(feature: USGSFeature): OsintEntity {
  const { properties, geometry } = feature;
  const [lon, lat, depthKm] = geometry.coordinates;

  // Stable ID: prefer properties.ids, fall back to feature.id.
  const rawId = properties.ids || feature.id || `quake-${lon}-${lat}-${properties.time}`;
  // properties.ids may contain comma-delimited strings; use full value as-is.
  const id = String(rawId).trim();

  // Magnitude → severity: clamp(mag / 9, 0, 1).  Null mag → 0.
  const mag = typeof properties.mag === 'number' ? properties.mag : 0;
  const severity = clamp(mag / 9, 0, 1);

  // Depth in km → altitude in meters (negative = below surface).
  const altM = typeof depthKm === 'number' ? -(depthKm * 1000) : 0;

  // Observed timestamp: epoch ms → ISO UTC.
  const observedAt =
    typeof properties.time === 'number'
      ? new Date(properties.time).toISOString()
      : new Date().toISOString();

  // Raw: keep properties, but strip excessively large fields.
  const { products: _products, ...safeProps } = properties as Record<string, unknown>;
  void _products; // explicitly unused

  return {
    id,
    layer: 'quake',
    kind: 'event',
    label: properties.place || 'Unknown location',
    position: { lat, lon, altM },
    severity,
    observedAt,
    source: 'USGS',
    raw: safeProps,
  };
}

// ── BBox filter ─────────────────────────────────────────────────────────────

function isWithinBBox(lat: number, lon: number, bbox: BBox): boolean {
  const [west, south, east, north] = bbox;
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

// ── Raw fetcher ─────────────────────────────────────────────────────────────

const rawQuakeFetcher: LayerFetcher = async (
  params: FetchLayerParams,
): Promise<LayerPayload> => {
  const response = await fetch(UPSTREAM_URL, { signal: params.signal });

  if (!response.ok) {
    throw new Error(`USGS responded with HTTP ${response.status}`);
  }

  const data: USGSGeoJSON = await response.json();
  const fetchedAt = new Date().toISOString();

  // Upstream "generated" timestamp if available.
  const upstreamAt =
    typeof data.metadata?.generated === 'number'
      ? new Date(data.metadata.generated).toISOString()
      : null;

  let entities: OsintEntity[] = data.features.map(normaliseQuakeFeature);

  // Server-side bbox filter.
  if (params.bbox) {
    entities = entities.filter((e) =>
      isWithinBBox(e.position.lat, e.position.lon, params.bbox!),
    );
  }

  return {
    layer: 'quake',
    entities,
    fetchedAt,
    upstreamAt,
    stale: false,
    error: null,
  };
};

// ── Exported safe fetcher ───────────────────────────────────────────────────

/**
 * Fetch earthquake data from USGS.
 * Wrapped with timeout and error absorption — never throws.
 */
export const fetchQuakeLayer: LayerFetcher = wrapAdapter('quake', rawQuakeFetcher);
