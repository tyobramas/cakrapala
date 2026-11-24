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
import type { LayerPayload, OsintEntity } from '../../types';
import { fetchNhcActiveStorms, type NhcParsedStorm } from './nhc';
import { fetchGdacsActiveStorms, type GdacsParsedStorm } from './gdacs';
import { mergeStormSources } from './merge';

const EONET_STORMS_URL =
  'https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&status=open&limit=20';

interface EonetEvent {
  id: string;
  title: string;
  sources?: Array<{ id?: string; url?: string }>;
  geometry?: Array<{
    date: string;
    type: string;
    coordinates: [number, number];
    magnitudeValue?: number | null;
    magnitudeUnit?: string | null;
  }>;
}

async function fetchEonetActiveStorms(signal?: AbortSignal): Promise<OsintEntity[]> {
  const res = await fetch(EONET_STORMS_URL, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const data = (await res.json()) as { events?: EonetEvent[] };
  if (!Array.isArray(data.events)) return [];

  const results: OsintEntity[] = [];
  for (const ev of data.events) {
    const geoms = ev.geometry ?? [];
    if (geoms.length === 0) continue;
    const latest = geoms[geoms.length - 1];
    if (!Array.isArray(latest.coordinates) || latest.coordinates.length < 2) continue;
    const [lon, lat] = latest.coordinates;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const windKt =
      latest.magnitudeUnit === 'kts' && typeof latest.magnitudeValue === 'number'
        ? latest.magnitudeValue
        : 45;
    const windMs = windKt * 0.514444;
    const windKmh = windKt * 1.852;
    const severity = Math.min(1, Math.max(0.25, windMs / 80));

    results.push({
      id: `storm:eonet:${ev.id}`,
      layer: 'storm',
      kind: 'moving',
      label: ev.title,
      position: { lat, lon, altM: 0 },
      severity,
      observedAt: latest.date || new Date().toISOString(),
      source: 'NASA EONET',
      raw: {
        name: ev.title,
        windKt,
        windKmh,
        windMs,
        alertLevel: windKt >= 64 ? 'Orange' : 'Green',
        reportUrl: ev.sources?.[0]?.url ?? null,
      },
    });
  }
  return results;
}

/**
 * Raw storm layer fetcher.
 * Uses Promise.allSettled to ensure resilience if any upstream source is down.
 */
export const rawFetchStormLayer: LayerFetcher = async (
  params: FetchLayerParams,
): Promise<LayerPayload> => {
  const allPast = Boolean(params.options?.allPast);

  // Parallel fetch NHC, GDACS, and NASA EONET
  const [nhcResult, gdacsResult, eonetResult] = await Promise.allSettled([
    fetchNhcActiveStorms(params.signal),
    fetchGdacsActiveStorms({ allPast }, params.signal),
    fetchEonetActiveStorms(params.signal),
  ]);

  const nhcStorms: NhcParsedStorm[] =
    nhcResult.status === 'fulfilled' ? nhcResult.value : [];
  const gdacsStorms: GdacsParsedStorm[] =
    gdacsResult.status === 'fulfilled' ? gdacsResult.value : [];
  const eonetStorms: OsintEntity[] =
    eonetResult.status === 'fulfilled' ? eonetResult.value : [];

  const nhcFailed = nhcResult.status === 'rejected';
  const gdacsFailed = gdacsResult.status === 'rejected';

  // If both primary sources failed and EONET also yielded nothing, propagate error
  if (nhcFailed && gdacsFailed && eonetStorms.length === 0) {
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

  // Deduplicate and merge primary sources
  const entities: OsintEntity[] = mergeStormSources(nhcStorms, gdacsStorms);

  // Append active NASA EONET storms not already covered by NHC/GDACS
  for (const eonetEnt of eonetStorms) {
    const eonetName = eonetEnt.label.toLowerCase();
    const isDuplicate = entities.some((existing) => {
      const existingName = String(existing.raw?.name ?? existing.label)
        .toLowerCase()
        .replace(/[^a-z]/g, '');
      const nameOverlap =
        existingName.length >= 4 && eonetName.replace(/[^a-z]/g, '').includes(existingName);
      const nearBy =
        Math.abs(existing.position.lat - eonetEnt.position.lat) < 6 &&
        Math.abs(existing.position.lon - eonetEnt.position.lon) < 6;
      return nameOverlap || nearBy;
    });
    if (!isDuplicate) {
      entities.push(eonetEnt);
    }
  }

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
