// lib/osint/layers/storm/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Layer Adapter: Tropical Cyclone (NOAA NHC + GDACS)
//
// Combines:
//   1. NOAA NHC (high-precision telemetry, Atlantic & East/Central Pacific)
//   2. European Commission GDACS (global alerts, impacts, report URLs, geometry)
//
// Key features:
//   - Global scope: does not restrict to bbox or altitude.
//   - Soft degradation: if one source fails (e.g. NHC 500), the other still populates.
//   - Deduplication: merges overlapping storms into a single entity.
// ─────────────────────────────────────────────────────────────────────────────

import type { FetchLayerParams, LayerFetcher } from '../../adapter';
import type { LayerPayload } from '../../types';
import { fetchNhcActiveStorms, type NhcParsedStorm } from './nhc';
import { fetchGdacsActiveStorms, type GdacsParsedStorm } from './gdacs';
import { mergeStormSources } from './merge';

/**
 * Raw storm layer fetcher.
 * Uses Promise.allSettled to ensure resilience if either upstream source is down.
 */
export const rawFetchStormLayer: LayerFetcher = async (
  params: FetchLayerParams,
): Promise<LayerPayload> => {
  const allPast = Boolean(params.options?.allPast);

  // Parallel fetch both sources
  const [nhcResult, gdacsResult] = await Promise.allSettled([
    fetchNhcActiveStorms(params.signal),
    fetchGdacsActiveStorms({ allPast }, params.signal),
  ]);

  const nhcStorms: NhcParsedStorm[] =
    nhcResult.status === 'fulfilled' ? nhcResult.value : [];
  const gdacsStorms: GdacsParsedStorm[] =
    gdacsResult.status === 'fulfilled' ? gdacsResult.value : [];

  const nhcFailed = nhcResult.status === 'rejected';
  const gdacsFailed = gdacsResult.status === 'rejected';

  // If both failed, propagate error
  if (nhcFailed && gdacsFailed) {
    const nhcErr = (nhcResult as PromiseRejectedResult).reason;
    const gdacsErr = (gdacsResult as PromiseRejectedResult).reason;
    const msg = `Both storm sources failed: NHC (${nhcErr?.message || 'error'}), GDACS (${gdacsErr?.message || 'error'})`;
    return {
      layer: 'storm',
      entities: [],
      fetchedAt: new Date().toISOString(),
      upstreamAt: null,
      stale: false,
      error: msg,
    };
  }

  // Deduplicate and merge
  const entities = mergeStormSources(nhcStorms, gdacsStorms);

  // Determine latest upstream observation time
  let latestUpstream: string | null = null;
  for (const ent of entities) {
    if (ent.observedAt) {
      if (!latestUpstream || ent.observedAt > latestUpstream) {
        latestUpstream = ent.observedAt;
      }
    }
  }

  // Note degradation if one source had an issue
  let degradationNotice: string | null = null;
  if (nhcFailed) {
    degradationNotice = 'NOAA NHC data unavailable; using global GDACS data only.';
  } else if (gdacsFailed) {
    degradationNotice = 'GDACS data unavailable; using NOAA NHC data only.';
  }

  return {
    layer: 'storm',
    entities,
    fetchedAt: new Date().toISOString(),
    upstreamAt: latestUpstream,
    stale: false,
    error: degradationNotice,
  };
};

import { wrapAdapter } from '../../adapter';

/**
 * Safe, wrapped storm layer fetcher with 8s timeout and error absorption.
 */
export const fetchStormLayer = wrapAdapter('storm', rawFetchStormLayer);
