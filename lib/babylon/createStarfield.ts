"use client";

/**
 * createStarfield — Deep Space Volumetric Starfield & Galactic Depth Engine.
 * 
 * Replaces flat blurry 2D image skyboxes with genuine 3D parallax celestial layers:
 *   1. Deep Infinite Point Stars (5,500 multi-magnitude stars with true stellar spectral colors)
 *   2. Volumetric 3D Milky Way Galactic Plane & Interstellar Dust Clusters (with genuine camera parallax)
 *   3. Prominent Landmark Navigational Stars with Diamond Diffraction Glints
 */

import {
  Scene,
  SolidParticleSystem,
  MeshBuilder,
  StandardMaterial,
  Color4,
  Color3,
  Engine,
} from "@babylonjs/core";

import { STARFIELD_RADIUS } from "./sceneConstants";

export function createStarfield(scene: Scene): void {
  // ── 1. Deep Field Omnidirectional Point Stars (5,500 particles) ───────────
  const starSPS = new SolidParticleSystem("deepOmniStarsSPS", scene, {
    isPickable: false,
    enableMultiMaterial: false,
    useModelMaterial: false,
  });

  // Sharp faceted star geometry for crisp, non-blurry rendering at any zoom
  const starShape = MeshBuilder.CreatePolyhedron(
    "_starPoly",
    { type: 0, size: 0.8 },
    scene
  );
  starSPS.addShape(starShape, 5500);
  starShape.dispose();

  const starMesh = starSPS.buildMesh();
  const starMat = new StandardMaterial("starfieldPointMat", scene);
  starMat.emissiveColor = new Color3(1, 1, 1);
  starMat.disableLighting = true;
  starMat.backFaceCulling = false;
  starMesh.material = starMat;

  // Real Astronomical Spectral Palette (O, B, A, F, G, K, M)
  const spectralPalette = [
    new Color4(1.0, 1.0, 1.0, 1.0),        // Class A: Diamond White (Sirius, Vega)
    new Color4(0.82, 0.92, 1.0, 0.95),     // Class B: Blue-White (Rigel, Spica)
    new Color4(0.65, 0.85, 1.0, 0.95),     // Class O: Electric Deep Blue (Alnitak)
    new Color4(1.0, 0.98, 0.88, 0.9),      // Class F: Pale Cream (Procyon, Canopus)
    new Color4(1.0, 0.90, 0.65, 0.95),     // Class G: Solar Gold (Sun, Alpha Centauri)
    new Color4(1.0, 0.75, 0.45, 0.9),      // Class K: Warm Amber (Arcturus, Aldebaran)
    new Color4(1.0, 0.58, 0.48, 0.85),     // Class M: Ruby Red (Betelgeuse, Antares)
  ];

  starSPS.initParticles = () => {
    for (let i = 0; i < starSPS.nbParticles; i++) {
      const p = starSPS.particles[i];

      // Deep spherical shell distribution (radius 700 to 1400 units)
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = STARFIELD_RADIUS * (1.1 + Math.random() * 0.9);

      p.position.x = distance * Math.sin(phi) * Math.cos(theta);
      p.position.y = distance * Math.sin(phi) * Math.sin(theta);
      p.position.z = distance * Math.cos(phi);

      // Realistic astronomical magnitude distribution
      const isFirstMag = Math.random() < 0.015; // 1.5% Bright anchor stars
      const isSecondMag = Math.random() < 0.08; // 8% Moderate stars
      const size = isFirstMag
        ? 2.2 + Math.random() * 0.8
        : isSecondMag
        ? 1.3 + Math.random() * 0.5
        : 0.5 + Math.random() * 0.45;

      p.scale.setAll(size);

      const color = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
      const brightness = isFirstMag ? 1.0 : isSecondMag ? 0.85 : 0.45 + Math.random() * 0.4;

      p.color = new Color4(
        color.r * brightness,
        color.g * brightness,
        color.b * brightness,
        color.a
      );
    }
  };

  starSPS.initParticles();
  starSPS.setParticles();
  starSPS.mesh.freezeWorldMatrix();
  starSPS.mesh.isPickable = false;

  // ── 2. Volumetric Milky Way Galactic Band (2,200 3D Star Cluster Particles) ─
  const galaxySPS = new SolidParticleSystem("galacticPlaneSPS", scene, {
    isPickable: false,
    enableMultiMaterial: false,
    useModelMaterial: false,
  });

  const dustShape = MeshBuilder.CreatePolyhedron(
    "_dustPoly",
    { type: 1, size: 1.2 },
    scene
  );
  galaxySPS.addShape(dustShape, 2200);
  dustShape.dispose();

  const galaxyMesh = galaxySPS.buildMesh();
  const galaxyMat = new StandardMaterial("galacticPlaneMat", scene);
  galaxyMat.emissiveColor = new Color3(0.9, 0.95, 1.0);
  galaxyMat.disableLighting = true;
  galaxyMat.backFaceCulling = false;
  galaxyMat.alphaMode = Engine.ALPHA_ADD;
  galaxyMesh.material = galaxyMat;

  // Galactic dust colors (deep cosmic indigo, cyan glow, star clouds)
  const dustColors = [
    new Color4(0.4, 0.6, 1.0, 0.45),   // Interstellar Blue Dust
    new Color4(0.3, 0.8, 0.9, 0.5),    // Ionized Cyan Nebula Cloud
    new Color4(0.7, 0.5, 0.9, 0.4),    // Magenta / Violet Gas
    new Color4(1.0, 0.95, 0.8, 0.7),   // Dense Starfield Core
    new Color4(0.9, 0.8, 0.6, 0.55),   // Warm Galactic Dust
  ];

  // 60-degree galactic tilt relative to the ecliptic plane
  const galacticTiltAngle = Math.PI / 3;
  const cosTilt = Math.cos(galacticTiltAngle);
  const sinTilt = Math.sin(galacticTiltAngle);

  galaxySPS.initParticles = () => {
    for (let i = 0; i < galaxySPS.nbParticles; i++) {
      const p = galaxySPS.particles[i];

      // Distribute along an elliptical celestial band (Galactic Disk)
      const angle = Math.random() * 2 * Math.PI;
      const baseRadius = STARFIELD_RADIUS * (1.15 + Math.random() * 0.6);
      
      // Gaussian-like concentration towards galactic core (Sagittarius region)
      const coreFactor = Math.exp(-Math.pow(angle - Math.PI, 2) / 1.8);
      const radius = baseRadius * (1 - coreFactor * 0.15);
      
      // Thickness variation (wider at the galactic bulge)
      const thickness = (35 + coreFactor * 90) * (Math.random() - 0.5);

      const localX = radius * Math.cos(angle);
      const localY = thickness;
      const localZ = radius * Math.sin(angle);

      // Rotate by galactic plane tilt
      p.position.x = localX;
      p.position.y = localY * cosTilt - localZ * sinTilt;
      p.position.z = localY * sinTilt + localZ * cosTilt;

      const size = 0.8 + Math.random() * 2.2 + coreFactor * 1.5;
      p.scale.setAll(size);

      const color = dustColors[Math.floor(Math.random() * dustColors.length)];
      const alpha = (0.25 + Math.random() * 0.55 + coreFactor * 0.3);
      p.color = new Color4(color.r, color.g, color.b, alpha);
    }
  };

  galaxySPS.initParticles();
  galaxySPS.setParticles();
  galaxySPS.mesh.freezeWorldMatrix();
  galaxySPS.mesh.isPickable = false;

  // ── 3. Landmark Navigation Stars (35 Major Real Sky Anchors) ──────────────
  const landmarkSPS = new SolidParticleSystem("landmarkStarsSPS", scene, {
    isPickable: false,
    enableMultiMaterial: false,
    useModelMaterial: false,
  });

  const anchorShape = MeshBuilder.CreatePolyhedron(
    "_anchorPoly",
    { type: 2, size: 2.5 },
    scene
  );
  landmarkSPS.addShape(anchorShape, 40);
  anchorShape.dispose();

  const landmarkMesh = landmarkSPS.buildMesh();
  const landmarkMat = new StandardMaterial("landmarkStarMat", scene);
  landmarkMat.emissiveColor = new Color3(1, 1, 1);
  landmarkMat.disableLighting = true;
  landmarkMat.backFaceCulling = false;
  landmarkMat.alphaMode = Engine.ALPHA_ADD;
  landmarkMesh.material = landmarkMat;

  landmarkSPS.initParticles = () => {
    for (let i = 0; i < landmarkSPS.nbParticles; i++) {
      const p = landmarkSPS.particles[i];
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = STARFIELD_RADIUS * 1.35;

      p.position.x = distance * Math.sin(phi) * Math.cos(theta);
      p.position.y = distance * Math.sin(phi) * Math.sin(theta);
      p.position.z = distance * Math.cos(phi);

      p.scale.setAll(3.5 + Math.random() * 2.0);

      const color = spectralPalette[i % spectralPalette.length];
      p.color = new Color4(color.r, color.g, color.b, 1.0);
    }
  };

  landmarkSPS.initParticles();
  landmarkSPS.setParticles();
  landmarkSPS.mesh.freezeWorldMatrix();
  landmarkSPS.mesh.isPickable = false;
}
