/**
 * High-DPI 3D Billboard Labels for Planets in Babylon.js.
 *
 * Clean, minimal luxury editorial typography (no blocky neon cyan boxes)
 * parented to each planet's non-rotating `orbitNode`, with automatic hiding
 * of the active label when zoomed in on a planet.
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
import type { PlanetRigMap } from "./createPlanets";

export type LabelMap = Map<PlanetId, Mesh>;

export function createLabels(
  scene: Scene,
  planetRigs: PlanetRigMap
): LabelMap {
  const map: LabelMap = new Map();

  for (const planet of PLANET_DATA) {
    const rig = planetRigs.get(planet.id);
    if (!rig) continue;

    const textureWidth = 512;
    const textureHeight = 128;
    const dynamicTexture = new DynamicTexture(
      `labelTexture_${planet.id}`,
      { width: textureWidth, height: textureHeight },
      scene,
      false
    );
    dynamicTexture.hasAlpha = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = dynamicTexture.getContext() as any;
    ctx.clearRect(0, 0, textureWidth, textureHeight);

    // Subtle translucent obsidian capsule with hairline border
    ctx.fillStyle = "rgba(2, 6, 18, 0.56)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(44, 24, textureWidth - 88, textureHeight - 48, 40);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(44, 24, textureWidth - 88, textureHeight - 48);
      ctx.strokeRect(44, 24, textureWidth - 88, textureHeight - 48);
    }

    // Crisp tracked typography
    ctx.font = "600 34px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "rgba(241, 245, 249, 0.94)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      planet.name.toUpperCase().split("").join(" "),
      textureWidth / 2,
      textureHeight / 2 + 1
    );
    dynamicTexture.update();

    const planeWidth = Math.max(3.6, planet.visualRadius * 2.5);
    const planeHeight = planeWidth * (textureHeight / textureWidth);

    const plane = MeshBuilder.CreatePlane(
      `labelPlane_${planet.id}`,
      { width: planeWidth, height: planeHeight },
      scene
    );

    // Parent to orbitNode (non-spinning) so the label floats cleanly above the planet
    plane.parent = rig.orbitNode;
    plane.position = new Vector3(
      0,
      planet.visualRadius + planeHeight * 0.85 + 0.55,
      0
    );
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const mat = new StandardMaterial(`labelMat_${planet.id}`, scene);
    mat.diffuseTexture = dynamicTexture;
    mat.emissiveTexture = dynamicTexture;
    mat.emissiveColor = Color3.White();
    mat.specularColor = Color3.Black();
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    plane.material = mat;
    plane.isPickable = false;

    map.set(planet.id, plane);
  }

  return map;
}

export function setLabelsVisible(
  labels: LabelMap,
  visible: boolean,
  hiddenPlanetId: PlanetId | null = null
): void {
  for (const [id, labelMesh] of labels.entries()) {
    labelMesh.setEnabled(visible && id !== hiddenPlanetId);
  }
}

export function disposeLabels(): void {
  // Disposed with the Babylon Scene on unmount
}
