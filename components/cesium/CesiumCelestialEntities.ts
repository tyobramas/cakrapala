/**
 * CesiumCelestialEntities — imperative helper module for celestial body entities.
 *
 * NOTE: Entity creation/update is handled by lib/cesium/entityFactory.ts.
 * This file re-exports the relevant functions for use by Cesium components,
 * providing a components/cesium-scoped import path.
 *
 * This module has no React dependencies — it is a pure re-export shim.
 *
 * VISUAL APPROXIMATION NOTE:
 *   Celestial bodies are rendered at VISUAL_BODY_DISTANCE_M from the observer
 *   in the direction computed by Az/Alt → ECEF transformation.  This gives
 *   the correct apparent direction on the globe but NOT the correct distance.
 */

export {
  createCelestialEntities,
  updateCelestialEntities,
} from "@/lib/cesium/entityFactory";

export { VISUAL_BODY_DISTANCE_M } from "@/lib/astronomy/coordinateTransforms";
