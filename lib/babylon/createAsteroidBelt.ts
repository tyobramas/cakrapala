/**
 * Main Asteroid Belt positioned at its real heliocentric span (2.1 – 3.3 AU)
 * via the shared `auToSceneRadius` mapping and driven by Kepler's 3rd Law
 * (mean orbital period ~4.55 Earth years at a ≈ 2.75 AU).
 */

import {
  Scene,
  PointsCloudSystem,
  Color4,
  Vector3,
  Mesh,
  CloudPoint,
} from "@babylonjs/core";
import { auToSceneRadius } from "../astronomy/solarSystemPhysics";

export interface AsteroidBeltHandle {
  mesh: Mesh;
  /** Advances the belt by `deltaDays` simulated Earth days using Kepler's 3rd Law. */
  updateBySimDays: (deltaDays: number) => void;
}

// Mean Main Belt semi-major axis ≈ 2.75 AU => Kepler period T = 2.75^1.5 = 4.560 years ≈ 1665.7 days
const MEAN_BELT_PERIOD_DAYS = Math.pow(2.75, 1.5) * 365.256;
const BELT_RAD_PER_DAY = (Math.PI * 2) / MEAN_BELT_PERIOD_DAYS;

export function createAsteroidBelt(scene: Scene): AsteroidBeltHandle {
  const asteroidCount = 2200;
  const pcs = new PointsCloudSystem("asteroidBeltPCS", 1.55, scene);

  const innerAU = 2.12;
  const outerAU = 3.28;

  pcs.addPoints(asteroidCount, (particle: CloudPoint) => {
    // Triangular radial distribution peaking near 2.7 AU (between Mars & Jupiter)
    const u1 = Math.random();
    const u2 = Math.random();
    const rAU = innerAU + ((u1 + u2) / 2) * (outerAU - innerAU);
    const sceneR = auToSceneRadius(rAU);

    const theta = Math.random() * Math.PI * 2;
    // Realistic Main Belt orbital inclination dispersion (~±8° Gaussian-like)
    const incDeg = ((Math.random() + Math.random()) / 2 - 0.5) * 14;
    const y = Math.sin((incDeg * Math.PI) / 180) * sceneR * 0.35;

    particle.position = new Vector3(
      Math.cos(theta) * sceneR,
      y,
      Math.sin(theta) * sceneR
    );

    // Authentic C-type (carbonaceous), S-type (silicate), M-type (metallic) albedo palette
    const mineralType = Math.random();
    if (mineralType < 0.72) {
      const b = 0.28 + Math.random() * 0.25;
      particle.color = new Color4(b * 0.86, b * 0.83, b * 0.8, 0.85);
    } else if (mineralType < 0.92) {
      const b = 0.48 + Math.random() * 0.3;
      particle.color = new Color4(b * 1.04, b * 0.88, b * 0.68, 0.9);
    } else {
      const b = 0.68 + Math.random() * 0.24;
      particle.color = new Color4(b * 0.95, b * 0.97, b * 1.0, 0.95);
    }
  });

  try {
    pcs.buildMeshAsync().then((mesh) => {
      const beltMesh = mesh as Mesh;
      if (beltMesh) {
        beltMesh.isPickable = false;
      }
    });
  } catch (err) {
    console.warn("Asteroid belt PCS build fallback:", err);
  }

  return {
    mesh: pcs.mesh as Mesh,
    updateBySimDays(deltaDays: number) {
      if (pcs.mesh) {
        pcs.mesh.rotation.y += BELT_RAD_PER_DAY * deltaDays;
      }
    },
  };
}
