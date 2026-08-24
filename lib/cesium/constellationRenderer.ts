/**
 * Cesium constellation line renderer for Cakrapala Milestone 3.
 *
 * Renders IAU constellation stick figures as Cesium polyline primitives.
 *
 * DESIGN:
 *   - One PolylineCollection per scene (never recreated on toggle).
 *   - setVisible() only toggles show on the collection.
 *   - Lines are placed at CONSTELLATION_DISTANCE_M from the observer ECEF origin.
 *   - Star positions are looked up by HR number via the same GAST approximation
 *     used by CesiumStarFieldRenderer.
 *
 * COORDINATE NOTES:
 *   Same visual approximation as CesiumStarFieldRenderer.
 *   Line endpoints are placed at a slightly shorter distance than stars to
 *   prevent z-fighting.
 *
 * PERFORMANCE:
 *   - Single PolylineCollection draw call for all segments.
 *   - Lines are static during a session (not updated per frame).
 *   - No React state mutations.
 */

import { Viewer, PolylineCollection, Cartesian3, Color, Material } from "cesium";
import type { StarRecord, ConstellationSegment } from "@/lib/astronomy/types";
import { horizontalToEcef } from "@/lib/astronomy/coordinateTransforms";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Distance at which constellation lines are placed (slightly less than stars). */
const CONSTELLATION_DISTANCE_M = 2.8e8;

/** Constellation line colour: subtle blue-gray. */
const LINE_COLOR = { r: 0.35, g: 0.5, b: 0.8, a: 0.4 };

/** Line width in pixels. */
const LINE_WIDTH = 1.0;

// ── Helper: same sidereal-time approximation as starFieldRenderer ─────────────

function raDecToAzAlt(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  utcDate: Date
): { azDeg: number; altDeg: number } {
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const jd = utcDate.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  let gast = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    T * T * (0.000387933 - T / 38710000);
  gast = ((gast % 360) + 360) % 360;
  const lst = ((gast + lonDeg) % 360 + 360) % 360;
  const ha = lst - raDeg;
  const haRad = ha * D2R;
  const decRad = decDeg * D2R;
  const latRad = latDeg * D2R;
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;
  const y = -Math.cos(decRad) * Math.sin(haRad);
  const x = Math.sin(decRad) * Math.cos(latRad) -
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  let azDeg = Math.atan2(y, x) * R2D;
  azDeg = ((azDeg % 360) + 360) % 360;
  return { azDeg, altDeg };
}

// ── CesiumConstellationRenderer ───────────────────────────────────────────────

export class CesiumConstellationRenderer {
  private readonly viewer: Viewer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private collection: any | null = null;
  private visible = true;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  /**
   * Creates the PolylineCollection from star and segment data.
   * Must be called once after CesiumStarFieldRenderer.create().
   *
   * @param stars     Star records (indexed by HR number for quick lookup).
   * @param segments  Constellation line segments.
   * @param observer  Initial observer location for coordinate conversion.
   * @param utcDate   Initial simulation time.
   */
  create(
    stars: StarRecord[],
    segments: ConstellationSegment[],
    observer: { latitude: number; longitude: number; elevationMeters: number; timezone: string; displayName: string },
    utcDate: Date
  ): void {
    if (this.collection) return;

    // Build HR number → StarRecord index.
    const starByHR = new Map<number, StarRecord>();
    for (const star of stars) {
      const hrNum = parseInt(star.id.replace("HR", ""), 10);
      if (!isNaN(hrNum)) {
        starByHR.set(hrNum, star);
      }
    }

    const collection = new PolylineCollection();
    this.collection = collection;
    this.viewer.scene.primitives.add(collection);

    const lineColor = new Color(LINE_COLOR.r, LINE_COLOR.g, LINE_COLOR.b, LINE_COLOR.a);

    for (const seg of segments) {
      const starA = starByHR.get(seg.starA);
      const starB = starByHR.get(seg.starB);
      if (!starA || !starB) continue;
      if (seg.starA === seg.starB) continue; // skip self-loops

      const posA = starToEcef(starA, observer, utcDate);
      const posB = starToEcef(starB, observer, utcDate);

      if (!posA || !posB) continue;

      collection.add({
        positions: [
          new Cartesian3(posA.x, posA.y, posA.z),
          new Cartesian3(posB.x, posB.y, posB.z),
        ],
        width: LINE_WIDTH,
        material: Material.fromType("Color", { color: lineColor }),
      });
    }

    collection.show = this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
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
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

function starToEcef(
  star: StarRecord,
  observer: { latitude: number; longitude: number; elevationMeters: number; timezone: string; displayName: string },
  utcDate: Date
): { x: number; y: number; z: number } | null {
  const { azDeg, altDeg } = raDecToAzAlt(
    star.rightAscensionDegrees,
    star.declinationDegrees,
    observer.latitude,
    observer.longitude,
    utcDate
  );
  return horizontalToEcef(
    { azimuthDeg: azDeg, altitudeDeg: altDeg },
    observer,
    CONSTELLATION_DISTANCE_M
  );
}
