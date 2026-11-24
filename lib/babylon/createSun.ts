"use client";

/**
 * createSun — Radiant Photorealistic Solar Photosphere, Chromosphere & Corona.
 *
 * Features:
 *   - 4K WebP solar photosphere texture with slow animated plasma rotation
 *   - Custom additive Fresnel solar corona & soft volumetric outer halo
 *   - Calibrated solar PointLight illuminating all 8 planets with realistic contrast
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  ShaderMaterial,
  Effect,
  Color3,
  PointLight,
  Vector3,
  GlowLayer,
  Texture,
  Mesh,
} from "@babylonjs/core";

import {
  SUN_POINT_LIGHT_INTENSITY,
  SUN_POINT_LIGHT_RANGE,
} from "./sceneConstants";
import { SUN_DATA } from "../astronomy/planetData";

const CORONA_SHADER_NAME = "solarCoronaFresnelShader";

function ensureCoronaShadersRegistered(): void {
  if (!Effect.ShadersStore[`${CORONA_SHADER_NAME}VertexShader`]) {
    Effect.ShadersStore[`${CORONA_SHADER_NAME}VertexShader`] = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main(void) {
        vec4 wp = world * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(world) * normal);
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
  }

  if (!Effect.ShadersStore[`${CORONA_SHADER_NAME}FragmentShader`]) {
    Effect.ShadersStore[`${CORONA_SHADER_NAME}FragmentShader`] = `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform vec3 uInnerColor;
      uniform vec3 uOuterColor;
      uniform float uPower;
      uniform float uOpacity;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main(void) {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        // BackSide sphere normals point inward: dot(N, V) peaks at center and fades to 0 at silhouette edge
        float d = clamp(dot(N, V), 0.0, 1.0);
        float glow = pow(d, uPower);
        vec3 col = mix(uOuterColor, uInnerColor, pow(d, 1.6));
        gl_FragColor = vec4(col * glow * uOpacity, glow * uOpacity);
      }
    `;
  }
}

export interface SunHandle {
  mesh: Mesh;
  update: (deltaSeconds: number, speedMultiplier: number) => void;
}

export function createSun(scene: Scene): SunHandle {
  ensureCoronaShadersRegistered();

  // ── 1. 4K Solar Photosphere Core ──────────────────────────────────────────
  const sun = MeshBuilder.CreateSphere(
    "sun",
    { diameter: SUN_DATA.visualRadius * 2, segments: 64 },
    scene
  );
  sun.position = Vector3.Zero();

  const sunMaterial = new StandardMaterial("sunMaterial", scene);
  sunMaterial.emissiveColor = new Color3(1.15, 0.92, 0.58);
  sunMaterial.diffuseColor = Color3.White();
  sunMaterial.specularColor = Color3.Black();
  sunMaterial.disableLighting = true;

  let sunTexture: Texture | null = null;
  try {
    sunTexture = new Texture(
      "/textures/planets/hd/sun.webp",
      scene,
      false,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
      undefined,
      () => {
        // Fallback to legacy sun texture if needed
        const fb = new Texture("/textures/planets/sun.jpg", scene, false, false);
        fb.uScale = -1;
        sunMaterial.emissiveTexture = fb;
      }
    );
    sunTexture.uScale = -1;
    sunTexture.anisotropicFilteringLevel = 8;
    sunMaterial.emissiveTexture = sunTexture;
  } catch (err) {
    console.warn("Sun texture creation error:", err);
  }

  sun.material = sunMaterial;
  sun.isPickable = true;
  sun.metadata = {
    type: "sun",
    planetId: "sun",
    name: SUN_DATA.name,
  };

  // ── 2. Volumetric Fresnel Solar Corona Halo ───────────────────────────────
  const coronaMesh = MeshBuilder.CreateSphere(
    "sunCoronaHalo",
    {
      diameter: SUN_DATA.visualRadius * 3.8,
      segments: 48,
      sideOrientation: Mesh.BACKSIDE,
    },
    scene
  );
  coronaMesh.parent = sun;
  coronaMesh.isPickable = false;

  const coronaMat = new ShaderMaterial(
    "sunCoronaMat",
    scene,
    {
      vertex: CORONA_SHADER_NAME,
      fragment: CORONA_SHADER_NAME,
    },
    {
      attributes: ["position", "normal"],
      uniforms: [
        "world",
        "worldViewProjection",
        "cameraPosition",
        "uInnerColor",
        "uOuterColor",
        "uPower",
        "uOpacity",
      ],
      needAlphaBlending: true,
    }
  );
  coronaMat.setColor3("uInnerColor", new Color3(1.0, 0.88, 0.55));
  coronaMat.setColor3("uOuterColor", new Color3(0.95, 0.36, 0.06));
  coronaMat.setFloat("uPower", 3.6);
  coronaMat.setFloat("uOpacity", 0.95);
  coronaMat.backFaceCulling = true;
  coronaMat.alphaMode = 1; // ALPHA_ADD
  coronaMat.disableDepthWrite = true;
  coronaMesh.material = coronaMat;

  // ── 3. Primary Solar Point Light Source ───────────────────────────────────
  const sunLight = new PointLight("sunLight", Vector3.Zero(), scene);
  sunLight.diffuse = new Color3(1.0, 0.97, 0.92);
  sunLight.specular = new Color3(1.0, 0.95, 0.86);
  sunLight.intensity = SUN_POINT_LIGHT_INTENSITY;
  sunLight.range = SUN_POINT_LIGHT_RANGE;

  // ── 4. Subtle Solar Bloom GlowLayer ───────────────────────────────────────
  try {
    const glow = new GlowLayer("sunGlow", scene, {
      blurKernelSize: 64,
      mainTextureFixedSize: 512,
    });
    glow.intensity = 0.62;
    glow.addIncludedOnlyMesh(sun);
  } catch (err) {
    console.warn("Sun glowlayer fallback:", err);
  }

  return {
    mesh: sun,
    update(deltaSeconds: number, speedMultiplier: number) {
      // Gentle solar rotation (~25-day Carrington rotation scaled subtly)
      sun.rotation.y += 0.045 * deltaSeconds * Math.max(0.25, Math.min(speedMultiplier, 4));
      if (sunTexture) {
        sunTexture.uOffset = (sunTexture.uOffset + 0.0025 * deltaSeconds) % 1;
      }
    },
  };
}
