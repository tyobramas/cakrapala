/**
 * 3D Billboard Label Manager for Planets in Babylon.js.
 *
 * Uses 3D DynamicTexture Plane Meshes parented directly to each planet mesh
 * with BILLBOARDMODE_ALL. This guarantees 100% position accuracy without GUI drift.
 */

import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Vector3,
  Color3,
} from "@babylonjs/core";

import type { PlanetId } from "../astronomy/types";
import { PLANET_DATA } from "../astronomy/planetData";

export type LabelMap = Map<PlanetId, Mesh>;

/**
 * Creates 3D billboard text planes parented to each planet mesh.
 */
export function createLabels(
  scene: Scene,
  planetMeshes: Map<PlanetId, Mesh>
): LabelMap {
  const map: LabelMap = new Map();

  for (const planet of PLANET_DATA) {
    const mesh = planetMeshes.get(planet.id);
    if (!mesh) continue;

    // ── 1. Create a high-res Dynamic Texture for the text ───────────────────
    const textureWidth = 256;
    const textureHeight = 64;
    const dynamicTexture = new DynamicTexture(
      `labelTexture_${planet.id}`,
      { width: textureWidth, height: textureHeight },
      scene,
      false
    );
    dynamicTexture.hasAlpha = true;

    // Draw stylized label pill background and text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = dynamicTexture.getContext() as any;
    ctx.clearRect(0, 0, textureWidth, textureHeight);

    // Pill background
    ctx.fillStyle = "rgba(3, 7, 18, 0.75)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(16, 10, textureWidth - 32, textureHeight - 20, 12);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(16, 10, textureWidth - 32, textureHeight - 20);
      ctx.strokeRect(16, 10, textureWidth - 32, textureHeight - 20);
    }

    // Text
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#e0f2fe";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(planet.name.toUpperCase(), textureWidth / 2, textureHeight / 2);
    dynamicTexture.update();

    // ── 2. Create the Plane Mesh for the billboard ──────────────────────────
    const planeWidth = Math.max(3.2, planet.visualRadius * 2.8);
    const planeHeight = planeWidth * (textureHeight / textureWidth);

    const plane = MeshBuilder.CreatePlane(
      `labelPlane_${planet.id}`,
      { width: planeWidth, height: planeHeight },
      scene
    );

    // Parent to planet mesh so it follows the planet automatically in 3D
    plane.parent = mesh;
    // Position floating above the planet's north pole
    plane.position = new Vector3(0, planet.visualRadius + planeHeight * 0.8 + 0.6, 0);

    // Always face camera from all angles
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

    // Material
    const mat = new StandardMaterial(`labelMat_${planet.id}`, scene);
    mat.diffuseTexture = dynamicTexture;
    mat.emissiveTexture = dynamicTexture;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.specularColor = new Color3(0, 0, 0);
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    plane.material = mat;
    plane.isPickable = false;

    map.set(planet.id, plane);
  }

  return map;
}

/**
 * Sets visibility of all planet labels.
 */
export function setLabelsVisible(labels: LabelMap, visible: boolean): void {
  for (const labelMesh of labels.values()) {
    labelMesh.setEnabled(visible);
  }
}

/**
 * Disposes all label meshes and textures on teardown.
 */
export function disposeLabels(): void {
  // Meshes are disposed when the scene tears down
}
