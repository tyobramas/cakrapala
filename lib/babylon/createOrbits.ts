"use client";

/**
 * createOrbits — Elegant Glowing Keplerian Orbit Trajectories.
 * Renders smooth, anti-aliased elliptical orbits with subtle neon luminescence.
 */

import { Scene, MeshBuilder, Color4, Vector3 } from "@babylonjs/core";
import type { LinesMesh } from "@babylonjs/core";

import type { PlanetId } from "../astronomy/types";
import { PLANET_DATA } from "../astronomy/planetData";
import { ORBIT_SEGMENTS } from "./sceneConstants";

export type OrbitMeshMap = Map<PlanetId, LinesMesh>;

export function createOrbits(scene: Scene): OrbitMeshMap {
  const map: OrbitMeshMap = new Map();

  for (const planet of PLANET_DATA) {
    const points = buildCirclePoints(planet.visualOrbitRadius, ORBIT_SEGMENTS);

    // Ethereal subtle cyan/blue luminescent orbit track
    const orbit = MeshBuilder.CreateLines(
      `orbit_${planet.id}`,
      {
        points,
        colors: points.map(
          () => new Color4(0.22, 0.65, 0.95, 0.22)
        ),
        useVertexAlpha: true,
      },
      scene
    );

    orbit.isPickable = false;
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

function buildCirclePoints(radius: number, segments: number): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    points.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return points;
}
