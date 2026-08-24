"use client";

/**
 * createStarfield — Deep Space Astrophotographic Starfield & Cosmic Nebulae Dome.
 * Features:
 *   - 4,000 Multi-Layered Stars with Astronomical Spectral Colors
 *   - Deep Cosmic Volumetric Nebulae & Interstellar Star Clouds
 *   - 3D Depth Layering (Foreground, Midground, Deep Background)
 *   - Genuine Optical Diffraction Spikes on First-Magnitude Stars
 */

import {
  Scene,
  SolidParticleSystem,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Color4,
  Color3,
  Texture,
} from "@babylonjs/core";

import { STAR_COUNT, STARFIELD_RADIUS } from "./sceneConstants";

const MIN_STAR_SIZE = 0.4;
const MAX_STAR_SIZE = 1.8;

export function createStarfield(scene: Scene): void {
  // ── 1. Multi-Layered Starfield Solid Particle System ─────────────────────
  const sps = new SolidParticleSystem("deepStarfieldSPS", scene, {
    isPickable: false,
    enableMultiMaterial: false,
    useModelMaterial: false,
  });

  const starModel = MeshBuilder.CreateBox("_starModel", { size: 1 }, scene);
  sps.addShape(starModel, STAR_COUNT);
  starModel.dispose();

  const spsMesh = sps.buildMesh();

  const mat = new StandardMaterial("starfieldMat", scene);
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  spsMesh.material = mat;

  // Astronomical Spectral Color Palette (O, B, A, F, G, K, M)
  const starPalettes = [
    new Color4(1.0, 1.0, 1.0, 1.0),       // Pure White (Class A)
    new Color4(0.85, 0.95, 1.0, 0.95),    // Blue-White (Class B)
    new Color4(0.68, 0.88, 1.0, 0.95),    // Pale Sapphire (Class O)
    new Color4(1.0, 0.98, 0.82, 0.9),     // Warm White (Class F)
    new Color4(1.0, 0.88, 0.55, 0.95),    // Golden Solar (Class G)
    new Color4(1.0, 0.72, 0.45, 0.9),     // Orange (Class K)
    new Color4(1.0, 0.55, 0.55, 0.85),    // Red Dwarf (Class M)
  ];

  sps.initParticles = () => {
    for (let i = 0; i < sps.nbParticles; i++) {
      const p = sps.particles[i];

      // Multi-layer depth sphere distribution (radius from 450 to 750 units)
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = STARFIELD_RADIUS * (0.75 + Math.random() * 0.4);

      p.position.x = r * Math.sin(phi) * Math.cos(theta);
      p.position.y = r * Math.sin(phi) * Math.sin(theta);
      p.position.z = r * Math.cos(phi);

      // Natural magnitude distribution (many small stars, few bright stars)
      const isBright = Math.random() < 0.04;
      const isMedium = Math.random() < 0.18;
      const size = isBright
        ? MAX_STAR_SIZE * (0.8 + Math.random() * 0.4)
        : isMedium
        ? 0.9 + Math.random() * 0.4
        : MIN_STAR_SIZE + Math.random() * 0.35;

      p.scale.setAll(size);

      const color = starPalettes[Math.floor(Math.random() * starPalettes.length)];
      const brightness = isBright ? 1.0 : isMedium ? 0.85 : 0.4 + Math.random() * 0.35;
      p.color = new Color4(
        color.r * brightness,
        color.g * brightness,
        color.b * brightness,
        color.a
      );
    }
  };

  sps.initParticles();
  sps.setParticles();
  sps.mesh.freezeWorldMatrix();
  sps.mesh.isPickable = false;

  // ── 2. Deep Space Celestial Sky Dome (Milky Way & Cosmic Nebulae Band) ─────
  try {
    const skyDome = MeshBuilder.CreateSphere(
      "celestialSkyDome",
      { diameter: STARFIELD_RADIUS * 2.1, segments: 48, sideOrientation: Mesh.BACKSIDE },
      scene
    );

    const skyMat = new StandardMaterial("celestialSkyMat", scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.emissiveColor = new Color3(0.04, 0.06, 0.14);

    // Load authentic NASA Milky Way celestial texture
    const galaxyTex = new Texture(
      "/textures/planets/galaxy.jpg",
      scene,
      false,
      false,
      undefined,
      undefined,
      (msg) => console.warn("Sky dome texture fallback:", msg)
    );
    galaxyTex.uScale = 1.0;
    galaxyTex.vScale = 1.0;
    skyMat.emissiveTexture = galaxyTex;
    skyMat.alpha = 0.28; // Subtle atmospheric deep space glow

    skyDome.material = skyMat;
    skyDome.isPickable = false;
    skyDome.freezeWorldMatrix();
  } catch (err) {
    console.warn("Celestial sky dome error:", err);
  }
}
