// lib/osint/adapter.ts
// ─────────────────────────────────────────────────────────────────────────────
// Adapter contract for OSINT layer data fetchers.
//
// Every layer adapter exports a `fetchLayer` function conforming to this
// contract.  The adapter wrapper enforces:
//   1. 8-second upstream timeout via AbortSignal.
//   2. Never throws — returns LayerPayload with `error` populated.
//   3. Correctly fills fetchedAt / upstreamAt / stale.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, LayerId, LayerPayload } from './types';

/** Parameters passed to every layer adapter. */
export interface FetchLayerParams {
  bbox?: BBox;
  cameraAltM?: number;
  signal: AbortSignal;
  options?: Record<string, unknown>;
}

/**
 * The raw fetch function each layer must implement.
 * MAY throw — the wrapper (below) catches all errors.
 */
export type LayerFetcher = (params: FetchLayerParams) => Promise<LayerPayload>;

/** Upstream timeout in milliseconds. */
const UPSTREAM_TIMEOUT_MS = 8_000;

/**
 * Wrap a raw layer fetcher with timeout enforcement and error absorption.
 *
 * Usage:
 * ```ts
 * const safeFetch = wrapAdapter('quake', rawQuakeFetcher);
 * const payload = await safeFetch({ signal: controller.signal });
 * ```
 */
export function wrapAdapter(
  layerId: LayerId,
  fetcher: LayerFetcher,
): LayerFetcher {
  return async (params: FetchLayerParams): Promise<LayerPayload> => {
    // Compose abort signals: caller's signal + our timeout.
    const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

    // Combine both signals: whichever aborts first wins.
    const combinedController = new AbortController();

    const onCallerAbort = () => combinedController.abort(params.signal.reason);
    const onTimeoutAbort = () =>
      combinedController.abort(new Error('Upstream timeout (8 s)'));

    params.signal.addEventListener('abort', onCallerAbort, { once: true });
    timeoutSignal.addEventListener('abort', onTimeoutAbort, { once: true });

    try {
      const result = await fetcher({
        ...params,
        signal: combinedController.signal,
      });
      return result;
    } catch (err: unknown) {
      // Never throw to the caller.
      const message =
        err instanceof Error ? err.message : 'Unknown upstream error';
      return {
        layer: layerId,
        entities: [],
        fetchedAt: new Date().toISOString(),
        upstreamAt: null,
        stale: false,
        error: message,
      };
    } finally {
      // Cleanup listeners to prevent memory leaks.
      params.signal.removeEventListener('abort', onCallerAbort);
      timeoutSignal.removeEventListener('abort', onTimeoutAbort);
    }
  };
}
