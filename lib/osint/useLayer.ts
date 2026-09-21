'use client';
// lib/osint/useLayer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-side hook for polling an OSINT layer.
//
// Features:
//   - Polls at the layer's refreshMs from registry.
//   - Stops polling when the page is hidden (Page Visibility API).
//   - Aborts in-flight requests when bbox changes.
//   - Debounces bbox changes by 400 ms.
//   - Preserves last good data on error (status → 'stale').
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LayerId, BBox, OsintEntity, LayerPayload } from './types';
import { LAYER_REGISTRY } from './registry';

export type LayerStatus = 'idle' | 'loading' | 'ok' | 'stale' | 'error';

export interface UseLayerResult {
  entities: OsintEntity[];
  fetchedAt: string | null;
  upstreamAt: string | null;
  /** Live age in ms, recalculated every second. */
  ageMs: number;
  status: LayerStatus;
  /** Manually trigger a refetch. */
  refetch: () => void;
}

const DEBOUNCE_MS = 400;

export function useLayer(
  layerId: LayerId,
  bbox: BBox | undefined,
  cameraAltM: number | undefined,
  enabled: boolean,
): UseLayerResult {
  const config = LAYER_REGISTRY[layerId];

  const [entities, setEntities] = useState<OsintEntity[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [upstreamAt, setUpstreamAt] = useState<string | null>(null);
  const [status, setStatus] = useState<LayerStatus>('idle');
  const [ageMs, setAgeMs] = useState(0);

  // Refs to avoid stale closures.
  const abortRef = useRef<AbortController | null>(null);
  const bboxRef = useRef(bbox);
  const enabledRef = useRef(enabled);
  const refetchFlagRef = useRef(0);
  const fetchedAtRef = useRef<string | null>(null);
  const upstreamAtRef = useRef<string | null>(null);

  bboxRef.current = bbox;
  enabledRef.current = enabled;

  // ── Fetch function ──────────────────────────────────────────────────────

  const doFetch = useCallback(async () => {
    if (!enabledRef.current || !config.enabled) return;

    // Abort any in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');

    try {
      const params = new URLSearchParams();
      if (bboxRef.current) {
        params.set('bbox', bboxRef.current.join(','));
      }
      if (cameraAltM !== undefined) {
        params.set('alt', String(cameraAltM));
      }

      const qs = params.toString();
      const url = `/api/osint/${layerId}${qs ? `?${qs}` : ''}`;

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: LayerPayload = await response.json();

      if (data.error) {
        // Upstream error but we have previous data → stale.
        if (fetchedAtRef.current) {
          setStatus('stale');
        } else {
          setStatus('error');
        }
        return;
      }

      setEntities(data.entities);
      setFetchedAt(data.fetchedAt);
      setUpstreamAt(data.upstreamAt);
      fetchedAtRef.current = data.fetchedAt;
      upstreamAtRef.current = data.upstreamAt;
      setStatus(data.stale ? 'stale' : 'ok');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      // Preserve last good data → stale.
      if (fetchedAtRef.current) {
        setStatus('stale');
      } else {
        setStatus('error');
      }
    }
  }, [layerId, config.enabled, cameraAltM]);

  // ── Refetch imperative handle ───────────────────────────────────────────

  const refetch = useCallback(() => {
    refetchFlagRef.current += 1;
    doFetch();
  }, [doFetch]);

  // ── Debounced bbox watcher ──────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const handle = setTimeout(() => {
      doFetch();
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], enabled]);

  // ── Polling with visibility gating ──────────────────────────────────────

  useEffect(() => {
    if (!enabled || !config.enabled || config.refreshMs <= 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(doFetch, config.refreshMs);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Fetch immediately when tab becomes visible, then resume polling.
        doFetch();
        startPolling();
      }
    };

    // Start polling immediately if page is visible.
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, config.enabled, config.refreshMs, doFetch]);

  // ── Live age counter ────────────────────────────────────────────────────

  useEffect(() => {
    if (!fetchedAt && !upstreamAt) return;

    const tick = () => {
      const ref = upstreamAtRef.current ?? fetchedAtRef.current;
      if (ref) {
        setAgeMs(Date.now() - new Date(ref).getTime());
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fetchedAt, upstreamAt]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { entities, fetchedAt, upstreamAt, ageMs, status, refetch };
}
