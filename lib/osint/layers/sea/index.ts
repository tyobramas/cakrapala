// lib/osint/layers/sea/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Sea Layer Aggregator (AIS Vessel Tracking)
//
// Phase 1: HTTP-based regional sources (Digitraffic Baltic Sea).
// Phase 2: Will integrate aisstream.io global worker with identical API contract.
//
// PRIVACY SAFEGUARDS (ENFORCED IN CODE):
//   1. Do NOT implement persistent per-vessel tracking or push notifications.
//   2. Do NOT persist vessel tracks/history to databases or local storage.
//   Tracks exist solely in ephemeral client memory and are discarded on reload.
//   MMSI for small recreational vessels can identify private individuals.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, LayerPayload, OsintEntity } from '@/lib/osint/types';
import type { FetchLayerParams, LayerFetcher } from '@/lib/osint/adapter';
import { wrapAdapter } from '@/lib/osint/adapter';
import type { SeaSourceAdapter } from './sources/types';
import { digitrafficAdapter } from './sources/digitraffic';

export const MAX_SEA_ENTITIES = 1500;
export const SEA_COVERAGE_MESSAGE =
  'Cakupan AIS saat ini terbatas pada Laut Baltik dan Norwegia. Cakupan global menyusul.';

const ACTIVE_SOURCES: SeaSourceAdapter[] = [digitrafficAdapter];

/**
 * Checks if two bounding boxes [west, south, east, north] intersect.
 */
export function bboxesIntersect(a: BBox, b: BBox): boolean {
  const [w1, s1, e1, n1] = a;
  const [w2, s2, e2, n2] = b;
  return w1 <= e2 && e1 >= w2 && s1 <= n2 && n1 >= s2;
}

/**
 * Checks if a given viewport bbox intersects any coverage area of active sources.
 */
export function isWithinSeaCoverage(bbox?: BBox): boolean {
  if (!bbox) return true; // Default to true if no bbox supplied
  for (const src of ACTIVE_SOURCES) {
    for (const cov of src.coverageBBoxes) {
      if (bboxesIntersect(bbox, cov)) return true;
    }
  }
  return false;
}

export const rawFetchSeaLayer: LayerFetcher = async (
  params: FetchLayerParams,
): Promise<LayerPayload> => {
  const bbox = params.bbox;
  const fetchedAt = new Date().toISOString();

  // 1. Coverage check: If viewport is outside Baltic/supported regions, return informative notice
  if (bbox && !isWithinSeaCoverage(bbox)) {
    return {
      layer: 'sea',
      entities: [],
      fetchedAt,
      upstreamAt: null,
      stale: false,
      error: 'OUT_OF_COVERAGE',
    };
  }

  // 2. Fetch from active sources
  const results = await Promise.all(ACTIVE_SOURCES.map((s) => s.fetchVessels(bbox)));

  let allEntities: OsintEntity[] = [];
  let latestUpstreamTime = 0;
  let totalInSource = 0;

  for (const res of results) {
    allEntities.push(...res.entities);
    if (res.upstreamUpdatedTime && res.upstreamUpdatedTime > latestUpstreamTime) {
      latestUpstreamTime = res.upstreamUpdatedTime;
    }
    totalInSource += res.totalVesselsInSource ?? res.entities.length;
  }

  // 3. Entity cap enforcement (max 1,500 vessels)
  let cutCount = 0;
  let displayedEntities = allEntities;

  if (allEntities.length > MAX_SEA_ENTITIES) {
    cutCount = allEntities.length - MAX_SEA_ENTITIES;

    // Viewport center for distance sorting
    const centerLat = bbox ? (bbox[1] + bbox[3]) / 2 : 59.9;
    const centerLon = bbox ? (bbox[0] + bbox[2]) / 2 : 24.9;

    // Sort priority:
    // (a) Moving vessels (sogKnots > 0.5)
    // (b) Fresh positions (ageS <= 300)
    // (c) Distance to center
    allEntities.sort((a, b) => {
      const aMoving = (Number(a.raw?.sogKnots) || 0) > 0.5 ? 1 : 0;
      const bMoving = (Number(b.raw?.sogKnots) || 0) > 0.5 ? 1 : 0;
      if (aMoving !== bMoving) return bMoving - aMoving;

      const aFresh = (Number(a.raw?.ageS) || 0) <= 300 ? 1 : 0;
      const bFresh = (Number(b.raw?.ageS) || 0) <= 300 ? 1 : 0;
      if (aFresh !== bFresh) return bFresh - aFresh;

      const distA = Math.hypot(a.position.lat - centerLat, a.position.lon - centerLon);
      const distB = Math.hypot(b.position.lat - centerLat, b.position.lon - centerLon);
      return distA - distB;
    });

    displayedEntities = allEntities.slice(0, MAX_SEA_ENTITIES);
  }

  // Attach metadata to raw of entities
  for (const ent of displayedEntities) {
    if (ent.raw) {
      ent.raw.totalFound = totalInSource;
      ent.raw.cutCount = cutCount;
    }
  }

  return {
    layer: 'sea',
    entities: displayedEntities,
    fetchedAt,
    upstreamAt: latestUpstreamTime ? new Date(latestUpstreamTime).toISOString() : null,
    stale: false,
    error: null,
  };
};

export const fetchSeaLayer: LayerFetcher = wrapAdapter('sea', rawFetchSeaLayer);
