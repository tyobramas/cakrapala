"use client";

/**
 * createOrbits — Authentic Elliptical 3D VSOP87 Orbital Trajectories.
 *
 * Each planet's trajectory is sampled directly from `astronomy-engine` across one
 * complete sidereal orbital period (preserving true eccentricity, off-center solar
 * focus, perihelion/aphelion distances, and 3D orbital inclination).
 */

import { Scene, MeshBuilder, Color4 } from "@babylonjs/core";
import type { LinesMesh } from "@babylonjs/core";

import type { PlanetId } from "../astronomy/types";
import { PLANET_DATA } from "../astronomy/planetData";
import {
  sampleRealPlanetOrbit,
  type OrbitingPlanetId,
} from "../astronomy/solarSystemPhysics";
import { ORBIT_SEGMENTS } from "./sceneConstants";

export type OrbitMeshMap = Map<PlanetId, LinesMesh>;

export function createOrbits(
  scene: Scene,
  referenceDate: Date = new Date()
): OrbitMeshMap {
  const map: OrbitMeshMap = new Map();

  for (const planet of PLANET_DATA) {
    const id = planet.id as OrbitingPlanetId;
    const points = sampleRealPlanetOrbit(id, referenceDate, ORBIT_SEGMENTS);

    const orbit = MeshBuilder.CreateLines(
      `orbit_${planet.id}`,
      {
        points,
        colors: points.map(() => new Color4(0.76, 0.85, 0.98, 0.2)),
        useVertexAlpha: true,
      },
      scene
    );

    orbit.isPickable = false;
    orbit.alpha = 0.24;
    map.set(planet.id, orbit);
  }

  return map;
}

export function setOrbitsVisible(
  orbits: OrbitMeshMap,
  visible: boolean
): void {
  for (const orbit of orbits.values()) {
    orbit.isVisible = visible;
  }
}

export function highlightSelectedOrbit(
  orbits: OrbitMeshMap,
  selectedId: PlanetId | null
): void {
  for (const [id, orbit] of orbits.entries()) {
    if (!selectedId || selectedId === "sun") {
      orbit.alpha = 0.24;
    } else if (id === selectedId) {
      orbit.alpha = 0.78;
    } else {
      orbit.alpha = 0.09;
    }
  }
}
