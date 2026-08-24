"use client";

/**
 * createPlanets — Photorealistic Planetary Engine with Crisp High-Resolution NASA Textures.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Texture,
  VertexData,
} from "@babylonjs/core";

import type { PlanetId } from "../astronomy/types";
import { PLANET_DATA } from "../astronomy/planetData";

export type PlanetMeshMap = Map<PlanetId, Mesh>;

export function createPlanets(scene: Scene): PlanetMeshMap {
  const map: PlanetMeshMap = new Map();

  for (const planet of PLANET_DATA) {
    // ── High-polygon sphere for crisp texture projection ────────────────────
    const mesh = MeshBuilder.CreateSphere(
      `planet_${planet.id}`,
      { diameter: planet.visualRadius * 2, segments: 64 },
      scene
    );

    // Initial position on orbit
    mesh.position = new Vector3(planet.visualOrbitRadius, 0, 0);

    // ── Photorealistic Material ───────────────────────────────────────────────
    const mat = new StandardMaterial(`mat_${planet.id}`, scene);
    const baseColor = hexToColor3(planet.color);
    mat.diffuseColor = baseColor;
    mat.specularColor = new Color3(0.2, 0.2, 0.25);
    mat.specularPower = 32;

    // Load High-Resolution NASA Texture map
    try {
      const texturePath = `/textures/planets/${planet.id}.jpg`;
      const texture = new Texture(
        texturePath,
        scene,
        false,
        false,
        undefined,
        undefined,
        (msg) => console.warn(`Planet ${planet.id} texture warning:`, msg)
      );
      // Flip horizontal UV so continents and planetary features are not mirrored
      texture.uScale = -1;
      mat.diffuseTexture = texture;
    } catch (err) {
      console.warn(`Planet ${planet.id} texture error:`, err);
    }

    mesh.material = mat;

    mesh.metadata = {
      type: "planet",
      planetId: planet.id,
      name: planet.name,
    };

    map.set(planet.id, mesh);

    // ── Saturn's Photorealistic Ring System ──────────────────────────────────
    if (planet.hasRing) {
      addPhotorealisticSaturnRing(mesh, planet.visualRadius, scene);
    }
  }

  return map;
}

// ── Saturn's Photorealistic Ring Annulus Geometry ──────────────────────────────

function addPhotorealisticSaturnRing(
  saturnMesh: Mesh,
  saturnRadius: number,
  scene: Scene
): void {
  const innerRadius = saturnRadius * 1.30;
  const outerRadius = saturnRadius * 2.55;
  const segments = 128;

  const ringMesh = new Mesh("saturnRingAnnulus", scene);
  const vertexData = new VertexData();

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    positions.push(cos * innerRadius, 0, sin * innerRadius);
    normals.push(0, 1, 0);
    uvs.push(0, i / segments);

    positions.push(cos * outerRadius, 0, sin * outerRadius);
    normals.push(0, 1, 0);
    uvs.push(1, i / segments);
  }

  for (let i = 0; i < segments; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = (i + 1) * 2;
    const i3 = (i + 1) * 2 + 1;

    indices.push(i0, i1, i2);
    indices.push(i1, i3, i2);
    indices.push(i2, i1, i0);
    indices.push(i2, i3, i1);
  }

  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;
  vertexData.applyToMesh(ringMesh);

  ringMesh.rotation.x = 0.46;
  ringMesh.rotation.z = 0.12;
  ringMesh.parent = saturnMesh;

  const ringMat = new StandardMaterial("saturnRingPhotorealisticMat", scene);
  try {
    const ringTexture = new Texture(
      "/textures/planets/saturn_ring.png",
      scene,
      false,
      false,
      undefined,
      undefined,
      (msg) => console.warn("Saturn ring texture warning:", msg)
    );
    ringMat.diffuseTexture = ringTexture;
    ringMat.opacityTexture = ringTexture;
  } catch (err) {
    console.warn("Saturn ring texture error:", err);
  }

  ringMat.diffuseColor = new Color3(1.0, 0.94, 0.82);
  ringMat.emissiveColor = new Color3(0.25, 0.22, 0.16);
  ringMat.specularColor = new Color3(0.08, 0.08, 0.08);
  ringMat.backFaceCulling = false;
  ringMat.useAlphaFromDiffuseTexture = true;
  ringMat.alpha = 0.92;
  ringMesh.material = ringMat;
  ringMesh.isPickable = false;
}

function hexToColor3(hex: string): Color3 {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color3(r, g, b);
}
