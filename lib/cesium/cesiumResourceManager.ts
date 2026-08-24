/**
 * Cesium resource lifecycle manager for Cakrapala Milestone 2.
 *
 * Centralises all Viewer/entity cleanup logic so CesiumViewer.tsx stays
 * focused on React integration.
 *
 * RULES enforced here:
 *   - Only one Viewer per page (checked via viewerRef guard).
 *   - All entities are removed before destroying the viewer.
 *   - viewer.destroy() is called on unmount.
 *   - Clock tick intervals are cleared before unmount.
 */

import { Viewer } from "cesium";

// ── Viewer teardown ───────────────────────────────────────────────────────────

/**
 * Fully disposes a Cesium Viewer.
 * Removes all entities, stops the render loop, then calls viewer.destroy().
 *
 * Safe to call even if the viewer is already destroyed.
 *
 * @param viewer  The Viewer instance to dispose.
 */
export function destroyViewer(viewer: Viewer): void {
  if (viewer.isDestroyed()) return;

  try {
    viewer.entities.removeAll();
    viewer.destroy();
  } catch {
    // Silently ignore errors during teardown — the component is unmounting.
  }
}

// ── Interval management ───────────────────────────────────────────────────────

/**
 * Holds a setInterval handle.  Wrap in an object so callers can mutate the
 * ref without creating closure issues.
 */
export type IntervalHandle = { id: ReturnType<typeof setInterval> | null };

/**
 * Creates an IntervalHandle with no active interval.
 */
export function createIntervalHandle(): IntervalHandle {
  return { id: null };
}

/**
 * Starts a tick interval, clearing any existing one first.
 *
 * @param handle      IntervalHandle to update.
 * @param callback    Function to call each tick.
 * @param intervalMs  Tick interval in milliseconds.
 */
export function startInterval(
  handle: IntervalHandle,
  callback: () => void,
  intervalMs: number
): void {
  stopInterval(handle);
  handle.id = setInterval(callback, intervalMs);
}

/**
 * Stops the interval associated with a handle.
 * Safe to call when no interval is running.
 *
 * @param handle  IntervalHandle to clear.
 */
export function stopInterval(handle: IntervalHandle): void {
  if (handle.id !== null) {
    clearInterval(handle.id);
    handle.id = null;
  }
}

// ── Entity bookkeeping ────────────────────────────────────────────────────────

/**
 * Removes all entities in a Map from the viewer and clears the Map.
 *
 * @param viewer     Cesium Viewer instance.
 * @param entityMap  Map of entity ids → Entity objects to remove.
 */
export function removeEntityMap(
  viewer: Viewer,
  entityMap: Map<string, import("cesium").Entity>
): void {
  if (viewer.isDestroyed()) return;
  for (const entity of entityMap.values()) {
    viewer.entities.remove(entity);
  }
  entityMap.clear();
}

/**
 * Removes a single named entity from the viewer if it exists.
 *
 * @param viewer  Cesium Viewer instance.
 * @param entity  Entity to remove (may be null/undefined — safely skipped).
 */
export function removeEntity(
  viewer: Viewer,
  entity: import("cesium").Entity | null | undefined
): void {
  if (viewer.isDestroyed() || !entity) return;
  viewer.entities.remove(entity);
}
