/**
 * Cesium-based star field renderer for Cakrapala Milestone 3.
 *
 * Implements the StarFieldRenderer interface using Cesium's
 * PointPrimitiveCollection for efficient rendering.
 *
 * DESIGN:
 *   - All stars are rendered as a SINGLE PointPrimitiveCollection.
 *   - In globe mode: stars are placed at STAR_DISTANCE_M from the observer
 *     in the ECEF direction corresponding to their RA/Dec (converted to ENU
 *     at the observer's location via a sidereal hour angle approximation).
 *   - In sky-dome mode: same ECEF placement but the camera is positioned inside
 *     the star sphere looking out.
 *
 * COORDINATE NOTES:
 *   This is a VISUALIZATION APPROXIMATION.
 *   - Stars are placed at fixed distance from the observer (not at their actual
 *     distances which range from ~1 to ~1000 ly).
 *   - RA/Dec → Az/Alt conversion uses the Greenwich Apparent Sidereal Time (GAST)
 *     approximation from astronomy-engine.
 *   - Proper motion corrections are NOT applied (sub-arcsecond per year, negligible
 *     for visual display at this precision level).
 *
 * PERFORMANCE:
 *   - One PointPrimitiveCollection per scene (never recreated on toggle).
 *   - setVisible() only changes the show property.
 *   - No React state mutations from within this module.
 *
 * MAGNITUDE → PIXEL SIZE MAPPING:
 *   magnitude < 0    → 5.0 px
 *   magnitude 0–1    → 4.0 px
 *   magnitude 1–2    → 3.5 px
 *   magnitude 2–3    → 3.0 px
 *   magnitude 3–4    → 2.5 px
 *   magnitude 4–5    → 2.0 px
 *   magnitude 5–6.5  → 1.5 px
 *   magnitude > 6.5  → 1.0 px (dim, barely visible)
 * Minimum: 1.0 px. Maximum: 5.5 px (magnitude < –1, e.g. Sirius).
 */

import { Viewer, PointPrimitiveCollection, Cartesian3, Color } from "cesium";
import type { StarRecord, StarFieldRenderer, StarFieldContext } from "@/lib/astronomy/types";
import { horizontalToEcef } from "@/lib/astronomy/coordinateTransforms";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Distance in metres at which stars are placed in the scene. */
export const STAR_DISTANCE_M = 3e8; // 300,000 km — well beyond all celestial entity positions

/** Maximum pixel size for the brightest stars (magnitude < –1). */
const MAX_STAR_PX = 5.5;
/** Minimum pixel size for the faintest stars. */
const MIN_STAR_PX = 1.0;

// ── Helper: magnitude → pixel size ────────────────────────────────────────────

function magnitudeToPixelSize(mag: number): number {
  if (mag < -1) return MAX_STAR_PX;
  if (mag < 0)  return 5.0;
  if (mag < 1)  return 4.0;
  if (mag < 2)  return 3.5;
  if (mag < 3)  return 3.0;
  if (mag < 4)  return 2.5;
  if (mag < 5)  return 2.0;
  if (mag < 6.5) return 1.5;
  return MIN_STAR_PX;
}

// ── Helper: B-V color index → RGB ─────────────────────────────────────────────

/**
 * Converts a Johnson B-V color index to an approximate RGB tuple [0–1].
 * Based on Ballesteros (2012) formula and standard stellar color tables.
 */
function bvToRgb(bv: number): { r: number; g: number; b: number } {
  // Clamp to valid B-V range.
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r: number, g: number, b: number;

  if (t < 0.0) {
    // Blue-white stars
    r = 0.61 + 0.11 * t + 0.1 * t * t;
    g = 0.70 + 0.07 * t + 0.1 * t * t;
    b = 1.0;
  } else if (t < 0.4) {
    // White stars
    r = 0.83 + 0.17 * t;
    g = 0.87 + 0.13 * t;
    b = 1.0;
  } else if (t < 1.0) {
    // Yellow-white to yellow
    r = 1.0;
    g = 0.9 + 0.1 * (1.0 - t) / 0.6;
    b = 0.9 - 0.5 * (t - 0.4) / 0.6;
  } else {
    // Orange to red
    const s = (t - 1.0) / 1.0;
    r = 1.0;
    g = Math.max(0.4, 0.5 - 0.1 * s);
    b = Math.max(0.0, 0.2 - 0.2 * s);
  }

  return { r: Math.min(1, Math.max(0, r)), g: Math.min(1, Math.max(0, g)), b: Math.min(1, Math.max(0, b)) };
}

// ── Helper: RA/Dec → topocentric Az/Alt ───────────────────────────────────────

/**
 * Converts equatorial RA/Dec (degrees) to topocentric Az/Alt (degrees) for
 * a given observer and UTC date.
 *
 * Uses the Greenwich Apparent Sidereal Time (GAST) approximation:
 *   GAST ≈ (JD - J2000.0) * 360.9856235 + 280.46061837 (deg)
 *   Local Hour Angle = GAST + longitude - RA
 *
 * Then standard equatorial-to-horizontal conversion:
 *   sin(alt) = sin(dec)*sin(lat) + cos(dec)*cos(lat)*cos(ha)
 *   az = atan2(-cos(dec)*sin(ha), sin(dec)*cos(lat) - cos(dec)*cos(ha)*sin(lat))
 *
 * This approximation is accurate to ~1 arcminute, sufficient for star rendering.
 *
 * Reference frame: topocentric, geometric (no refraction applied for stars).
 */
function raDecToAzAlt(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  utcDate: Date
): { azDeg: number; altDeg: number } {
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  // Julian Date from UTC.
  const jd = utcDate.getTime() / 86400000 + 2440587.5;

  // Greenwich Apparent Sidereal Time (degrees) — simplified formula.
  const T = (jd - 2451545.0) / 36525;
  let gast = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    T * T * (0.000387933 - T / 38710000);
  gast = ((gast % 360) + 360) % 360;

  // Local Sidereal Time.
  const lst = ((gast + lonDeg) % 360 + 360) % 360;

  // Hour angle (degrees).
  const ha = lst - raDeg;
  const haRad = ha * D2R;

  const decRad = decDeg * D2R;
  const latRad = latDeg * D2R;

  // Altitude.
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;

  // Azimuth (N=0, E=90 convention).
  const y = -Math.cos(decRad) * Math.sin(haRad);
  const x = Math.sin(decRad) * Math.cos(latRad) -
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  let azDeg = Math.atan2(y, x) * R2D;
  azDeg = ((azDeg % 360) + 360) % 360;

  return { azDeg, altDeg };
}

// ── CesiumStarFieldRenderer ────────────────────────────────────────────────────

export class CesiumStarFieldRenderer implements StarFieldRenderer {
  private readonly viewer: Viewer;
  private collection: PointPrimitiveCollection | null = null;
  private stars: StarRecord[] = [];

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  create(stars: StarRecord[]): void {
    // Only create once — guard against duplicate calls.
    if (this.collection) return;

    this.stars = stars;

    const collection = new PointPrimitiveCollection();
    this.collection = collection;
    this.viewer.scene.primitives.add(collection);

    // Use current viewer time for initial placement.
    const utcDate = new Date();

    // Get observer from a temporary default — will be updated on first update() call.
    const DEFAULT_LAT = 0;
    const DEFAULT_LON = 0;

    for (const star of stars) {
      const { azDeg, altDeg } = raDecToAzAlt(
        star.rightAscensionDegrees,
        star.declinationDegrees,
        DEFAULT_LAT,
        DEFAULT_LON,
        utcDate
      );

      const ecef = horizontalToEcef(
        { azimuthDeg: azDeg, altitudeDeg: altDeg },
        { latitude: DEFAULT_LAT, longitude: DEFAULT_LON, elevationMeters: 0, timezone: "UTC", displayName: "" },
        STAR_DISTANCE_M
      );

      const pixelSize = magnitudeToPixelSize(star.magnitude);
      const bv = star.colorIndex ?? 0.6;
      const rgb = bvToRgb(bv);
      // Brightness based on magnitude: brighter stars are more opaque.
      const alpha = Math.min(1.0, Math.max(0.3, 1.0 - (star.magnitude - 1) * 0.1));

      collection.add({
        position: new Cartesian3(ecef.x, ecef.y, ecef.z),
        pixelSize,
        color: new Color(rgb.r, rgb.g, rgb.b, alpha),
        // Disable depth testing so stars are always visible.
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  update(context: StarFieldContext): void {
    if (!this.collection) return;

    const { utcDate, observer } = context;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const point = this.collection.get(i);
      if (!point) continue;

      const { azDeg, altDeg } = raDecToAzAlt(
        star.rightAscensionDegrees,
        star.declinationDegrees,
        observer.latitude,
        observer.longitude,
        utcDate
      );

      const ecef = horizontalToEcef(
        { azimuthDeg: azDeg, altitudeDeg: altDeg },
        observer,
        STAR_DISTANCE_M
      );

      point.position = new Cartesian3(ecef.x, ecef.y, ecef.z);
    }
  }

  setVisible(visible: boolean): void {
    if (this.collection) {
      this.collection.show = visible;
    }
  }

  destroy(): void {
    if (this.collection) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.scene.primitives.remove(this.collection);
      }
      this.collection = null;
    }
    this.stars = [];
  }
}
