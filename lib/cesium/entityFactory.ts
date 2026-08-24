/**
 * Cesium entity factory helpers for Cakrapala Milestone 2.
 *
 * Creates and updates point/billboard entities for:
 *   - Observer marker (fixed geographic position)
 *   - Celestial body direction indicators (visual approximation)
 *
 * DESIGN RULE: No Cesium objects are stored in React state.
 *   All entities are attached directly to viewer.entities and manipulated
 *   imperatively via the update functions.
 *
 * VISUAL BODY PLACEMENT:
 *   Celestial bodies are placed at VISUAL_BODY_DISTANCE_M from the observer
 *   in the direction given by their Az/Alt.  This is a VISUAL APPROXIMATION —
 *   see lib/astronomy/coordinateTransforms.ts for the derivation.
 *
 * This module imports from "cesium" — it must only be used inside components
 * loaded with `dynamic(..., { ssr: false })`.
 */

import {
  Viewer,
  Entity,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  NearFarScalar,
  VerticalOrigin,
  LabelStyle,
  Cartographic,
  Math as CesiumMath,
} from "cesium";

import { horizontalToEcef } from "@/lib/astronomy/coordinateTransforms";
import type { CelestialBodyPosition, ObserverLocation } from "@/lib/astronomy/types";

// ── Colour palette ────────────────────────────────────────────────────────────

/** Colour map for celestial body point entities. Keys are lowercase CelestialBodyId. */
const BODY_COLORS: Record<string, Color> = {
  sun:     Color.fromCssColorString("#FDB813"),
  moon:    Color.fromCssColorString("#C8C8C8"),
  mercury: Color.fromCssColorString("#B5B5B5"),
  venus:   Color.fromCssColorString("#E8C56C"),
  mars:    Color.fromCssColorString("#C1440E"),
  jupiter: Color.fromCssColorString("#C88B3A"),
  saturn:  Color.fromCssColorString("#E4D191"),
  uranus:  Color.fromCssColorString("#7DE8E8"),
  neptune: Color.fromCssColorString("#3F54BA"),
};

function bodyColor(name: string): Color {
  return BODY_COLORS[name] ?? Color.WHITE;
}

// ── Observer marker ───────────────────────────────────────────────────────────

/**
 * Creates a labelled point entity marking the observer's geographic location.
 * Returns the entity so the caller can hold a ref and remove/update it.
 *
 * @param viewer    Cesium Viewer instance.
 * @param observer  Geographic observer location.
 */
export function createObserverMarker(
  viewer: Viewer,
  observer: ObserverLocation
): Entity {
  const cart = Cartesian3.fromDegrees(
    observer.longitude,
    observer.latitude,
    observer.elevationMeters
  );

  const entity = viewer.entities.add({
    id: "observer-marker",
    name: observer.displayName,
    position: new ConstantPositionProperty(cart),
    point: {
      pixelSize: 10,
      color: Color.fromCssColorString("#22d3ee"),
      outlineColor: Color.fromCssColorString("#0e7490"),
      outlineWidth: 2,
      // Ensures the marker stays visible as the camera zooms out.
      scaleByDistance: new NearFarScalar(1e3, 2.0, 1e7, 0.5),
    },
    label: {
      text: observer.displayName,
      font: "11px sans-serif",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Color.BLACK,
      fillColor: Color.fromCssColorString("#e2e8f0"),
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -14),
      scaleByDistance: new NearFarScalar(1e3, 1.2, 1e7, 0.6),
    },
  });

  return entity;
}

/**
 * Updates the observer marker's position when the observer location changes.
 *
 * @param entity    Existing observer marker entity.
 * @param observer  New geographic observer location.
 */
export function updateObserverMarker(
  entity: Entity,
  observer: ObserverLocation
): void {
  const cart = Cartesian3.fromDegrees(
    observer.longitude,
    observer.latitude,
    observer.elevationMeters
  );
  if (entity.position instanceof ConstantPositionProperty) {
    entity.position.setValue(cart);
  } else {
    entity.position = new ConstantPositionProperty(cart);
  }
  if (entity.label) {
    entity.label.text = new ConstantProperty(observer.displayName);
  }
}

// ── Celestial body entities ───────────────────────────────────────────────────

/**
 * Creates point + label entities for a list of celestial bodies.
 * Returns a Map from body id → Entity for later updates.
 *
 * @param viewer     Cesium Viewer instance.
 * @param positions  Computed positions array (from computeAllBodyPositions).
 * @param observer   Observer location (needed for coordinate transform).
 */
export function createCelestialEntities(
  viewer: Viewer,
  positions: CelestialBodyPosition[],
  observer: ObserverLocation
): Map<string, Entity> {
  const entityMap = new Map<string, Entity>();

  for (const pos of positions) {
    const ecef = horizontalToEcef(pos.horizontal, observer);
    const cart = new Cartesian3(ecef.x, ecef.y, ecef.z);
    const color = bodyColor(pos.id);

    // Bodies below the horizon are dimmed but still shown (useful when fast-
    // forwarding time).
    const alphaColor = pos.isAboveHorizon ? color : color.withAlpha(0.35);

    const entity = viewer.entities.add({
      id: `celestial-${pos.id}`,
      name: pos.name,
      position: new ConstantPositionProperty(cart),
      point: {
        pixelSize: pos.id === "sun" ? 18 : pos.id === "moon" ? 14 : 8,
        color: alphaColor,
        outlineColor: Color.BLACK.withAlpha(0.5),
        outlineWidth: 1,
        scaleByDistance: new NearFarScalar(1e6, 1.5, 1e9, 1.0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: pos.name,
        font: "10px sans-serif",
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Color.BLACK,
        fillColor: pos.isAboveHorizon
          ? Color.fromCssColorString("#e2e8f0")
          : Color.fromCssColorString("#64748b"),
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -10),
        scaleByDistance: new NearFarScalar(1e6, 1.0, 1e9, 0.7),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    entityMap.set(pos.id, entity);
  }

  return entityMap;
}

/**
 * Updates existing celestial body entities with new positions.
 * Mutates entity positions in-place — no entity add/remove overhead.
 *
 * @param entityMap  Map returned from createCelestialEntities.
 * @param positions  New position array from computeAllBodyPositions.
 * @param observer   Current observer location.
 */
export function updateCelestialEntities(
  entityMap: Map<string, Entity>,
  positions: CelestialBodyPosition[],
  observer: ObserverLocation
): void {
  for (const pos of positions) {
    const entity = entityMap.get(pos.id);
    if (!entity) continue;

    const ecef = horizontalToEcef(pos.horizontal, observer);
    const cart = new Cartesian3(ecef.x, ecef.y, ecef.z);

    if (entity.position instanceof ConstantPositionProperty) {
      entity.position.setValue(cart);
    } else {
      entity.position = new ConstantPositionProperty(cart);
    }

    // Update colour/alpha based on above-horizon status.
    if (entity.point) {
      const color = bodyColor(pos.id);
      entity.point.color = new ConstantProperty(
        pos.isAboveHorizon ? color : color.withAlpha(0.35)
      );
    }
    if (entity.label) {
      entity.label.fillColor = new ConstantProperty(
        pos.isAboveHorizon
          ? Color.fromCssColorString("#e2e8f0")
          : Color.fromCssColorString("#64748b")
      );
    }
  }
}

// ── Camera helper ─────────────────────────────────────────────────────────────

/**
 * Returns Cesium Cartographic for the observer position.
 * Useful for flying the camera to the observer on mount.
 *
 * @param observer  Observer location.
 */
export function observerCartographic(observer: ObserverLocation): Cartographic {
  return Cartographic.fromDegrees(
    observer.longitude,
    observer.latitude,
    observer.elevationMeters
  );
}

/**
 * Formats an altitude value for display in a label.
 * Positive values get a "+" prefix.
 *
 * @param altDeg  Altitude in degrees.
 */
export function formatAltLabel(altDeg: number): string {
  const sign = altDeg >= 0 ? "+" : "";
  return `${sign}${altDeg.toFixed(1)}°`;
}

/**
 * Converts degrees to a DMS string.  Used for RA/Dec display.
 *
 * @param deg  Value in decimal degrees.
 */
export function degToDms(deg: number): string {
  const d = Math.floor(Math.abs(deg));
  const m = Math.floor((Math.abs(deg) - d) * 60);
  const s = ((Math.abs(deg) - d) * 60 - m) * 60;
  const sign = deg < 0 ? "−" : "";
  return `${sign}${d}° ${m}′ ${s.toFixed(0)}″`;
}

/**
 * Formats a Right Ascension value (hours) as HH h MM m SS s.
 *
 * @param raHours  RA in decimal hours.
 */
export function formatRa(raHours: number): string {
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const s = ((raHours - h) * 60 - m) * 60;
  return `${h}h ${m}m ${s.toFixed(0)}s`;
}

// Re-export for convenience
export { CesiumMath };
