// lib/osint/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// OSINT module — shared type definitions.
// All positions use SI units (meters, decimal degrees). No knots, feet, etc.
// ─────────────────────────────────────────────────────────────────────────────

/** The seven OSINT layer identifiers. */
export type LayerId = 'air' | 'sea' | 'fire' | 'storm' | 'quake' | 'eyes' | 'imagery';

/** Classifies how an entity behaves on the globe. */
export type EntityKind = 'moving' | 'event' | 'static';

/**
 * A single OSINT entity normalised across all layers.
 *
 * Every adapter MUST produce entities conforming to this shape.
 * The `id` field must be stable across fetches so the client can diff
 * efficiently without rebuilding the entire Cesium entity collection.
 */
export interface OsintEntity {
  /** Unique, stable identifier (must survive across fetches). */
  id: string;
  /** Which layer this entity belongs to. */
  layer: LayerId;
  /** Behavioural classification. */
  kind: EntityKind;
  /** Human-readable label (e.g. place name, callsign). */
  label: string;
  /** Geographic position in decimal degrees + altitude in meters. */
  position: {
    /** Latitude in decimal degrees (−90 … +90). */
    lat: number;
    /** Longitude in decimal degrees (−180 … +180). */
    lon: number;
    /**
     * Altitude in meters above (positive) or below (negative) the WGS-84
     * ellipsoid surface.  Earthquake depth is stored as negative altM.
     */
    altM: number;
  };
  /**
   * Normalised severity / intensity / magnitude.
   * Clamped to [0, 1].  Layers that have no concept of severity set 0.
   */
  severity: number;
  /** When the event / observation was recorded (ISO 8601 UTC). */
  observedAt: string;
  /** Attribution source name (e.g. "USGS", "ADS-B Exchange"). */
  source: string;
  /** Optional movement heading in degrees (0..360, 0 = North, 90 = East). */
  headingDeg?: number;
  /** Optional movement translation speed in meters per second (SI units). */
  speedMs?: number;
  /** Optional URL for a thumbnail or icon image. */
  thumbnail?: string;
  /**
   * Raw upstream properties kept for debugging and future UI panels.
   * Adapters should strip fields that are excessively large or sensitive.
   */
  raw?: Record<string, unknown>;
}

/**
 * Axis-aligned bounding box: [west, south, east, north] in decimal degrees.
 */
export type BBox = [west: number, south: number, east: number, north: number];

/**
 * The payload returned by every layer adapter and by the API route handler.
 */
export interface LayerPayload {
  /** The layer this payload belongs to. */
  layer: LayerId;
  /** Normalised entities (may be empty on error). */
  entities: OsintEntity[];
  /** ISO 8601 UTC timestamp of when *our server* fetched the data. */
  fetchedAt: string;
  /**
   * ISO 8601 UTC timestamp of the upstream data's own "last updated" time,
   * if the upstream provides one.  Null otherwise.
   */
  upstreamAt: string | null;
  /**
   * True when the returned data comes from cache and may be outdated.
   */
  stale: boolean;
  /**
   * Human-readable error message if the upstream call failed.
   * Never contains raw upstream error details or API keys.
   */
  error: string | null;
}
