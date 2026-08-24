"use client";

/**
 * createSun — Radiant Photorealistic Solar Engine.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Vector3,
  GlowLayer,
  Texture,
} from "@babylonjs/core";

import { SUN_POINT_LIGHT_INTENSITY, SUN_POINT_LIGHT_RANGE } from "./sceneConstants";
import { SUN_DATA } from "../astronomy/planetData";

export function createSun(scene: Scene): void {
  // ── 1. Sun Core Sphere Mesh ────────────────────────────────────────────────
  const sun = MeshBuilder.CreateSphere(
    "sun",
    { diameter: SUN_DATA.visualRadius * 2, segments: 64 },
    scene
  );
  sun.position = Vector3.Zero();

  const sunMaterial = new StandardMaterial("sunMaterial", scene);
  const sunColor = hexToColor3(SUN_DATA.color);
  sunMaterial.emissiveColor = new Color3(1.0, 0.85, 0.45);
  sunMaterial.diffuseColor = sunColor;

  try {
    const sunTexture = new Texture(
      "/textures/planets/sun.jpg",
      scene,
      false,
      false,
      undefined,
      undefined,
      (msg) => console.warn("Sun texture load fallback:", msg)
    );
    sunMaterial.emissiveTexture = sunTexture;
    sunMaterial.diffuseTexture = sunTexture;
  } catch (err) {
    console.warn("Sun texture creation error:", err);
  }

  // Sun is a pure emitter
  sunMaterial.disableLighting = true;
  sun.material = sunMaterial;
  sun.isPickable = true;

  sun.metadata = {
    type: "sun",
    planetId: "sun",
    name: SUN_DATA.name,
  };

  // ── 2. Primary Solar Point Light Source ────────────────────────────────────
  const sunLight = new PointLight("sunLight", Vector3.Zero(), scene);
  sunLight.diffuse = new Color3(1.0, 0.96, 0.88);
  sunLight.specular = new Color3(1.0, 0.95, 0.8);
  sunLight.intensity = SUN_POINT_LIGHT_INTENSITY;
  sunLight.range = SUN_POINT_LIGHT_RANGE;

  // ── 3. Solar Corona Glow Layer ─────────────────────────────────────────────
  try {
    const glow = new GlowLayer("sunGlow", scene);
    glow.intensity = 0.85;
    glow.blurKernelSize = 64;
    glow.referenceMeshToUseItsOwnMaterial(sun);
  } catch (err) {
    console.warn("Sun glowlayer creation fallback:", err);
  }
}

function hexToColor3(hex: string): Color3 {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color3(r, g, b);
}
