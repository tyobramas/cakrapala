import { describe, it, expect } from "vitest";
import { CONSTELLATION_ANCHORS } from "../lib/astronomy/constellationProfiles";
import { buildArtworkMapper, angularSepDeg } from "../lib/astronomy/constellationArtworkSolver";

describe("Constellation artwork anchors", () => {
  const rows = Object.entries(CONSTELLATION_ANCHORS).map(([key, a]) => {
    const list = [a.star1, a.star2, a.star3, ...(a.star4 ? [a.star4] : [])];
    return { key, mapper: buildArtworkMapper(list), list };
  });

  it("laporan audit", () => {
    for (const { key, mapper } of rows) {
      const d = mapper!.diagnostics;
      console.log(
        `${key.padEnd(4)} det=${d.determinant > 0 ? "+" : "-"} ` +
        `res=${d.maxResidualDeg.toFixed(2)}° shear=${d.shearDeg.toFixed(1)}° ` +
        `aniso=${d.anisotropy.toFixed(2)} scale=${d.scaleUDeg.toFixed(1)}x${d.scaleVDeg.toFixed(1)}°`
      );
    }
  });

  it("semua rasi memakai handedness yang sama", () => {
    const bad = rows.filter((r) => r.mapper!.diagnostics.determinant > 0).map((r) => r.key);
    expect(bad, `konvensi atlas/tercermin: ${bad.join(", ")}`).toEqual([]);
  });

  it("shear wajar dan tidak terlalu anisotropik", () => {
    for (const { key, mapper } of rows) {
      const d = mapper!.diagnostics;
      expect(d.shearDeg, `${key} shear`).toBeLessThan(25);
      expect(d.anisotropy, `${key} anisotropi`).toBeLessThan(2.1);
    }
  });
});
