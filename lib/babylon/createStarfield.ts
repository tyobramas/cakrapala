"use client";

/**
 * createStarfield — Ultra High-Definition ESO 360° Milky Way Celestial SkyDome.
 *
 * Uses the authentic 8K ESO Astrophotography Panorama (/textures/milkyway.jpg)
 * for a photorealistic deep space sky with genuine cosmic depth, dark nebulae,
 * galactic core luminosity, and crisp pin-point stellar fields.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Texture,
  Mesh,
} from "@babylonjs/core";

import { STARFIELD_RADIUS } from "./sceneConstants";

export function createStarfield(scene: Scene): void {
  try {
    // ── 1. High-Definition 360° Celestial SkyDome ───────────────────────────
    const skyDome = MeshBuilder.CreateSphere(
      "celestialSkyDome",
      {
        diameter: STARFIELD_RADIUS * 3.2,
        segments: 64,
        sideOrientation: Mesh.BACKSIDE,
      },
      scene
    );

    const skyMat = new StandardMaterial("celestialSkyMat", scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.diffuseColor = new Color3(0, 0, 0);
    skyMat.specularColor = new Color3(0, 0, 0);

    // Load High-Resolution 8K ESO Milky Way Panorama
    const galaxyTex = new Texture(
      "/textures/milkyway.jpg",
      scene,
      false, // noMipmap: false (smooth high-res mipmaps)
      false, // invertY: false
      Texture.TRILINEAR_SAMPLINGMODE
    );
    galaxyTex.uScale = 1.0;
    galaxyTex.vScale = 1.0;

    skyMat.emissiveTexture = galaxyTex;
    skyMat.emissiveColor = new Color3(1.0, 1.0, 1.0);
    skyMat.alpha = 1.0;

    // Realistic celestial galactic tilt (60° inclination to the ecliptic)
    skyDome.rotation.x = 0.52;
    skyDome.rotation.y = 1.85;
    skyDome.rotation.z = 0.35;

    skyDome.material = skyMat;
    skyDome.isPickable = false;
    skyDome.freezeWorldMatrix();
  } catch (err) {
    console.error("Error creating Celestial SkyDome:", err);
  }
}
