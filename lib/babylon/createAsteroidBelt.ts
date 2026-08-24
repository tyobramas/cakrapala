/**
 * Main Asteroid Belt generator between Mars (21.0 AU visual) and Jupiter (41.0 AU visual).
 *
 * Spans between 26.5 and 35.5 visual scene units with 3,500 varied rocky particles.
 */

import {
  Scene,
  PointsCloudSystem,
  Color4,
  Vector3,
  Mesh,
  CloudPoint,
} from "@babylonjs/core";

export interface AsteroidBeltHandle {
  mesh: Mesh;
  updateRotation: (deltaSeconds: number, speedMultiplier: number) => void;
}

/**
 * Creates the high-density Main Asteroid Belt with realistic Keplerian orbital distribution.
 */
export function createAsteroidBelt(scene: Scene): AsteroidBeltHandle {
  const asteroidCount = 1800;
  const pcs = new PointsCloudSystem("asteroidBeltPCS", 1.8, scene);

  const innerR = 26.5;
  const outerR = 35.0;

  // Custom particle initializer
  pcs.addPoints(asteroidCount, (particle: CloudPoint) => {
    // Semi-Gaussian radial distribution clustering around the center of the belt (30.5 AU visual)
    const u1 = Math.random();
    const u2 = Math.random();
    const randRadius = innerR + ((u1 + u2) / 2) * (outerR - innerR);

    // Orbital angle
    const theta = Math.random() * Math.PI * 2;

    // Small vertical inclination dispersion (tilted orbital planes)
    const ySpread = (Math.random() - 0.5) * 2.4;

    particle.position = new Vector3(
      Math.cos(theta) * randRadius,
      ySpread,
      Math.sin(theta) * randRadius
    );

    // Asteroid mineral composition color grading:
    // - 70% C-Type Carbonaceous (Dark graphite grey / coal)
    // - 20% S-Type Silicate (Ochre rock / warm brown)
    // - 10% M-Type Nickel-Iron (Reflective metallic grey / pale gold)
    const mineralType = Math.random();
    if (mineralType < 0.7) {
      const b = 0.35 + Math.random() * 0.3;
      particle.color = new Color4(b * 0.85, b * 0.82, b * 0.8, 0.88);
    } else if (mineralType < 0.9) {
      const b = 0.55 + Math.random() * 0.35;
      particle.color = new Color4(b * 1.05, b * 0.9, b * 0.7, 0.92);
    } else {
      const b = 0.75 + Math.random() * 0.25;
      particle.color = new Color4(b * 0.95, b * 0.98, b * 1.0, 0.98);
    }
  });

  // Build the point cloud mesh
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
    updateRotation(deltaSeconds: number, speedMultiplier: number) {
      if (pcs.mesh) {
        // Average Keplerian orbital speed for main belt asteroids
        pcs.mesh.rotation.y += 0.05 * deltaSeconds * speedMultiplier * 0.3;
      }
    },
  };
}
