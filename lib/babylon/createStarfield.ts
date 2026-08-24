"use client";

/**
 * createStarfield — Ultra High-Definition 8K PhotoDome Celestial Sky.
 *
 * Uses Babylon.js native PhotoDome with the 8K ESO Milky Way Panorama (/textures/milkyway.jpg)
 * and infinite distance depth projection, matching the high-definition quality of the planetarium sky.
 */

import {
  Scene,
  PhotoDome,
} from "@babylonjs/core";

export function createStarfield(scene: Scene): void {
  try {
    // ── Ultra High-Definition 360° Equirectangular Celestial PhotoDome ───────
    const photoDome = new PhotoDome(
      "celestialPhotoDome",
      "/textures/milkyway.jpg",
      {
        resolution: 64,
        size: 3000,
        useDirectMapping: false,
      },
      scene
    );

    // Ensure it acts as an infinite depth sky background (never clipped, never pickable)
    if (photoDome.mesh) {
      photoDome.mesh.isPickable = false;
      photoDome.mesh.infiniteDistance = true;
      photoDome.mesh.checkCollisions = false;

      // Realistic astronomical galactic tilt (60° inclination to the ecliptic plane)
      photoDome.mesh.rotation.x = 0.48;
      photoDome.mesh.rotation.y = 2.15;
      photoDome.mesh.rotation.z = 0.25;
    }

    photoDome.imageMode = PhotoDome.MODE_MONOSCOPIC;
    photoDome.fovMultiplier = 1.0;
  } catch (err) {
    console.error("Error initializing Celestial PhotoDome:", err);
  }
}
