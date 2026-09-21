// lib/osint/layers/storm/geometry.ts
// ─────────────────────────────────────────────────────────────────────────────
// GDACS Tropical Cyclone Geometry Fetcher and Antimeridian Processor.
//
// Fetches detailed track lines (historical & forecast) and uncertainty cones
// lazily on user interaction (when a storm is clicked/inspected).
//
// Antimeridian Handling:
//   West Pacific cyclones often cross the ±180° meridian (Date Line).
//   When longitudes jump across the meridian (|lon2 - lon1| > 180), Cesium
//   can draw the polyline wrapping around the entire globe.
//   `splitPolylineAtAntimeridian` splits the polyline at the antimeridian boundary
//   so each line segment renders smoothly without visual artifacts.
// ─────────────────────────────────────────────────────────────────────────────

export interface StormTrackLine {
  coordinates: [number, number][]; // [lon, lat][]
  isForecast: boolean;
  windKmh?: number;
}

export interface StormUncertaintyCone {
  coordinates: [number, number][][]; // Polygon rings [lon, lat][]
  alertLevel?: string;
}

export interface StormGeometryData {
  historicalTracks: StormTrackLine[];
  forecastTracks: StormTrackLine[];
  uncertaintyCones: StormUncertaintyCone[];
}

/**
 * In-memory client/server cache for geometry payloads.
 * Key: `${eventId}:${episodeId}`
 */
const geometryCache = new Map<string, { data: StormGeometryData; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Splits a polyline at the ±180° antimeridian if any segment jumps > 180° in longitude.
 *
 * Example:
 *   Input: [[179, 10], [-179, 12]]
 *   Output: [
 *     [[179, 10], [180, 11]],
 *     [[-180, 11], [-179, 12]]
 *   ]
 */
export function splitPolylineAtAntimeridian(
  points: [number, number][],
): [number, number][][] {
  if (points.length <= 1) return [points];

  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const [lon1, lat1] = p1;
    const [lon2, lat2] = p2;

    const lonDiff = lon2 - lon1;

    // Check if crossing antimeridian:
    // Case 1: East to West crossing (e.g. 179 to -179, lonDiff = -358)
    // Case 2: West to East crossing (e.g. -179 to 179, lonDiff = +358)
    if (Math.abs(lonDiff) > 180) {
      if (lon1 > 0 && lon2 < 0) {
        // Crossing from Eastern hemisphere (+180) to Western hemisphere (-180)
        const dLon = 180 - lon1 + (lon2 + 180);
        const fraction = dLon !== 0 ? (180 - lon1) / dLon : 0.5;
        const latCross = lat1 + (lat2 - lat1) * fraction;

        // End current segment at +180
        currentSegment.push([180, latCross]);
        segments.push(currentSegment);

        // Start new segment at -180
        currentSegment = [[-180, latCross], p2];
      } else if (lon1 < 0 && lon2 > 0) {
        // Crossing from Western hemisphere (-180) to Eastern hemisphere (+180)
        const dLon = lon1 + 180 + (180 - lon2);
        const fraction = dLon !== 0 ? (lon1 + 180) / dLon : 0.5;
        const latCross = lat1 + (lat2 - lat1) * fraction;

        // End current segment at -180
        currentSegment.push([-180, latCross]);
        segments.push(currentSegment);

        // Start new segment at +180
        currentSegment = [[180, latCross], p2];
      } else {
        segments.push(currentSegment);
        currentSegment = [p2];
      }
    } else {
      currentSegment.push(p2);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Parses GDACS getgeometry GeoJSON FeatureCollection into structured lines and cones.
 */
export function parseGdacsGeometry(geojson: unknown): StormGeometryData {
  const result: StormGeometryData = {
    historicalTracks: [],
    forecastTracks: [],
    uncertaintyCones: [],
  };

  if (!geojson || typeof geojson !== 'object') return result;
  const fc = geojson as { features?: Array<{ geometry?: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }> };
  if (!Array.isArray(fc.features)) return result;

  for (const feature of fc.features) {
    if (!feature?.geometry) continue;
    const geomType = feature.geometry.type;
    const props = feature.properties ?? {};

    if (geomType === 'LineString') {
      const coords = feature.geometry.coordinates;
      if (Array.isArray(coords)) {
        const validCoords: [number, number][] = [];
        for (const pt of coords) {
          if (Array.isArray(pt) && pt.length >= 2) {
            const lon = Number(pt[0]);
            const lat = Number(pt[1]);
            if (!isNaN(lon) && !isNaN(lat)) {
              validCoords.push([lon, lat]);
            }
          }
        }

        if (validCoords.length > 1) {
          const isForecast = props.forecast === true;
          const splitLines = splitPolylineAtAntimeridian(validCoords);

          for (const line of splitLines) {
            const trackLine: StormTrackLine = {
              coordinates: line,
              isForecast,
              windKmh: typeof props.severitydata === 'object' && props.severitydata !== null
                ? Number((props.severitydata as { severity?: number }).severity)
                : undefined,
            };

            if (isForecast) {
              result.forecastTracks.push(trackLine);
            } else {
              result.historicalTracks.push(trackLine);
            }
          }
        }
      }
    } else if (geomType === 'Polygon') {
      const coords = feature.geometry.coordinates;
      if (Array.isArray(coords)) {
        const validRings: [number, number][][] = [];
        for (const ring of coords) {
          if (Array.isArray(ring)) {
            const validRing: [number, number][] = [];
            for (const pt of ring) {
              if (Array.isArray(pt) && pt.length >= 2) {
                const lon = Number(pt[0]);
                const lat = Number(pt[1]);
                if (!isNaN(lon) && !isNaN(lat)) {
                  validRing.push([lon, lat]);
                }
              }
            }
            if (validRing.length >= 3) {
              validRings.push(validRing);
            }
          }
        }

        if (validRings.length > 0) {
          result.uncertaintyCones.push({
            coordinates: validRings,
            alertLevel: String(props.alertlevel ?? 'Green'),
          });
        }
      }
    }
  }

  return result;
}

/**
 * Lazily fetches GDACS geometry for a specific storm.
 */
export async function fetchStormGeometry(
  geometryUrl: string,
  cacheKey?: string,
  signal?: AbortSignal,
): Promise<StormGeometryData | null> {
  if (!geometryUrl) return null;

  if (cacheKey) {
    const cached = geometryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const res = await fetch(geometryUrl, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const data = parseGdacsGeometry(json);

    if (cacheKey) {
      geometryCache.set(cacheKey, { data, fetchedAt: Date.now() });
    }

    return data;
  } catch {
    // Soft degradation: return null without crashing
    return null;
  }
}
