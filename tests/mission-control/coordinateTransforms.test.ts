import { describe, it, expect } from "vitest";
import {
  eciKmToRendererPosition,
  rendererPositionToEciKm,
  eciKmToEcefKm,
  assertFiniteVector3,
  RENDERER_SCALE,
} from "../../lib/mission-control/coordinateTransforms";

describe("Coordinate System Transformations", () => {
  it("converts ECI km to Three.js renderer positions with axis swap and sphere UV alignment", () => {
    const eci = { x: 7000, y: 3000, z: 2000 };
    const renderer = eciKmToRendererPosition(eci);

    // ECI X -> Three.js X
    expect(renderer.x).toBeCloseTo(7.0);
    // ECI Z -> Three.js Y (North)
    expect(renderer.y).toBeCloseTo(2.0);
    // ECI Y -> Three.js -Z
    expect(renderer.z).toBeCloseTo(-3.0);
  });

  it("inverts renderer positions back to ECI km accurately", () => {
    const originalEci = { x: 12345.6, y: -7890.1, z: 4567.8 };
    const renderer = eciKmToRendererPosition(originalEci);
    const recoveredEci = rendererPositionToEciKm(renderer);

    expect(recoveredEci.x).toBeCloseTo(originalEci.x, 4);
    expect(recoveredEci.y).toBeCloseTo(originalEci.y, 4);
    expect(recoveredEci.z).toBeCloseTo(originalEci.z, 4);
  });

  it("converts ECI km to ECEF km preserving magnitude", () => {
    const eci = { x: 5000, y: 4000, z: 3000 };
    const dateUtc = "2026-10-01T12:00:00Z";
    const ecef = eciKmToEcefKm(eci, dateUtc);

    const magEci = Math.sqrt(eci.x ** 2 + eci.y ** 2 + eci.z ** 2);
    const magEcef = Math.sqrt(ecef.x ** 2 + ecef.y ** 2 + ecef.z ** 2);

    expect(magEcef).toBeCloseTo(magEci, 4);
    // Z coordinate should remain unchanged during Earth equatorial rotation
    expect(ecef.z).toBeCloseTo(eci.z, 4);
  });

  it("throws TypeError on non-finite input vectors", () => {
    expect(() => assertFiniteVector3({ x: NaN, y: 0, z: 0 })).toThrow(TypeError);
    expect(() => assertFiniteVector3({ x: 0, y: Infinity, z: 0 })).toThrow(TypeError);
  });
});
