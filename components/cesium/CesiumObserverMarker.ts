/**
 * CesiumObserverMarker — imperative helper module for the observer entity.
 *
 * NOTE: Entity creation/update is handled by lib/cesium/entityFactory.ts.
 * This file re-exports the relevant functions for use by Cesium components,
 * providing a components/cesium-scoped import path.
 *
 * This module has no React dependencies — it is a pure re-export shim.
 */

export {
  createObserverMarker,
  updateObserverMarker,
  observerCartographic,
} from "@/lib/cesium/entityFactory";
