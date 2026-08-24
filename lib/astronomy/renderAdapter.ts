/**
 * Coordinate render adapter for Cakrapala Milestone 3.
 *
 * Provides explicit separation between Globe mode and Sky Dome mode
 * coordinate transformations, as required by the CoordinateRenderAdapter type.
 *
 * GLOBE MODE:
 *   Az/Alt → ENU unit vector → scale by distanceM → ECEF offset →
 *   add observer ECEF origin → result is WGS-84 ECEF Cartesian3.
 *   This places the entity at the correct DIRECTIONAL position from the
 *   observer on the Earth globe.
 *
 * SKY DOME MODE:
 *   Az/Alt → ENU unit vector → scale by distanceM → result stays in
 *   LOCAL ENU frame (origin at observer, x=East, y=North, z=Up).
 *   The sky dome renderer uses this local frame directly.
 *   The local frame is NOT a full ECEF transform — it is a visualization-only
 *   local Cartesian frame.
 *
 * ⚠️  ACCURACY DISCLAIMER:
 *   Both modes are VISUAL APPROXIMATIONS. They correctly represent the
 *   DIRECTION to a body but not its physical distance or parallax.
 *   This module is a visualization foundation, not an astronomy-grade renderer.
 *
 * UNIT CONVENTIONS:
 *   - Azimuth input: degrees clockwise from North (0–360°).
 *   - Altitude input: degrees above/below horizon (–90° to +90°).
 *   - Output: metres (globe = ECEF; sky-dome = local ENU).
 *
 * NO Cesium imports here — pure math, usable server-side.
 */

import type { HorizontalCoordinate, ObserverLocation, CoordinateRenderAdapter } from "./types";
import {
  horizontalToEcef,
  azAltToEnuUnit,
  VISUAL_BODY_DISTANCE_M,
} from "./coordinateTransforms";

// ── Globe adapter ─────────────────────────────────────────────────────────────

/**
 * Converts Az/Alt to an ECEF position for Globe mode.
 * Delegates to horizontalToEcef from coordinateTransforms.ts.
 */
function toGlobePosition(
  horizontal: HorizontalCoordinate,
  observer: ObserverLocation,
  distanceM: number = VISUAL_BODY_DISTANCE_M
): { x: number; y: number; z: number } {
  // HorizontalCoordinate uses azimuthDegrees/altitudeDegrees;
  // horizontalToEcef expects HorizontalPosition with azimuthDeg/altitudeDeg.
  return horizontalToEcef(
    { azimuthDeg: horizontal.azimuthDegrees, altitudeDeg: horizontal.altitudeDegrees },
    observer,
    distanceM
  );
}

// ── Sky dome adapter ──────────────────────────────────────────────────────────

/**
 * Converts Az/Alt to a local ENU Cartesian position for Sky Dome mode.
 *
 * SKY DOME FRAME DOCUMENTATION:
 *   - This is a visualization-only local frame anchored at the observer.
 *   - It is NOT ECEF and NOT topocentric in the geodetic sense.
 *   - x-axis: East (ENU East).
 *   - y-axis: Up (ENU Up = local vertical).
 *   - z-axis: North (ENU North).
 *   - Origin: observer position in local space (treated as 0,0,0).
 *   - The frame is NOT rotated into ECEF; it is purely local.
 *   - Suitable for rendering a hemispherical sky dome around the observer.
 *   - Parallax, Earth curvature, and refraction are NOT modelled in this frame.
 *
 * @param horizontal  Az/Alt in degrees.
 * @param _observer   Observer location (used only for consistency; not needed in ENU-local).
 * @param distanceM   Radius of the visual sky dome in metres.
 * @returns           { x, y, z } in local ENU frame (NOT ECEF).
 */
function toSkyDomePosition(
  horizontal: HorizontalCoordinate,
  _observer: ObserverLocation,
  distanceM: number = VISUAL_BODY_DISTANCE_M
): { x: number; y: number; z: number } {
  const enu = azAltToEnuUnit(horizontal.azimuthDegrees, horizontal.altitudeDegrees);

  // Sky dome convention: x=East, y=Up, z=North (right-hand local frame).
  return {
    x: enu.e * distanceM,  // East
    y: enu.u * distanceM,  // Up (local vertical)
    z: enu.n * distanceM,  // North
  };
}

// ── Exported adapter ──────────────────────────────────────────────────────────

/**
 * The default coordinate render adapter.
 * Use this to convert Az/Alt positions to either Globe or Sky Dome positions.
 */
export const coordinateRenderAdapter: CoordinateRenderAdapter = {
  toGlobePosition,
  toSkyDomePosition,
};

export { toGlobePosition, toSkyDomePosition };
