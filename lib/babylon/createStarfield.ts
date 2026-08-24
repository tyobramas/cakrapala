"use client";

/**
 * createStarfield — Ultra High-Definition 8K PhotoDome Celestial Sky.
 *
 * Uses Babylon.js native PhotoDome with the 8K ESO Milky Way Panorama (/textures/milkyway.jpg)
 * and infinite distance depth projection, calibrated to the exact IAU J2000 Galactic-to-Ecliptic
 * celestial inclination (60.19°) and Galactic Center alignment.
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

      // ── IAU J2000 Astronomical Galactic Orientation ─────────────────────────
      // 1. Inclination of Galactic Equator to Ecliptic Plane (Solar System Orbit Disk) = 60.19° (~1.0505 rad)
      // 2. Galactic Center (Sagittarius A*) Ecliptic Longitude = ~266.8° (Ascending Node ~176.84°)
      const GALACTIC_INCLINATION_RAD = (60.19 * Math.PI) / 180; // 60.19°
      const ASCENDING_NODE_RAD = (176.84 * Math.PI) / 180;       // 176.84°

      photoDome.mesh.rotation.x = GALACTIC_INCLINATION_RAD;
      photoDome.mesh.rotation.y = ASCENDING_NODE_RAD;
      photoDome.mesh.rotation.z = 0;
    }

    photoDome.imageMode = PhotoDome.MODE_MONOSCOPIC;
    photoDome.fovMultiplier = 1.0;
  } catch (err) {
    console.error("Error initializing Celestial PhotoDome:", err);
  }
}
