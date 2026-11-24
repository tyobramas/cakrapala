"use client";

/**
 * createStarfield — 100% Seamless 8K Equirectangular Milky Way Sky Sphere
 * + Crisp Native-DPI Spectral Starfield with Exact IAU J2000 Galactic Alignment.
 *
 * Why a high-segment equirectangular sphere instead of a 6-face CubeMap in Babylon.js:
 *   - Eliminates ALL cube-edge seams and left/right-handed face-flip mismatches.
 *   - Uses lossless-derived 8192x4096 WebP ESO Serge Brunier Milky Way panorama
 *     (`milkyway_8k.webp`, auto-fallback to `milkyway.jpg` on <8K GPUs) with 16x
 *     anisotropic trilinear filtering on a 96-segment celestial sphere.
 *
 * Astronomical Orientation (IAU J2000, Heliocentric Ecliptic Frame):
 *   - XZ plane = Solar System Ecliptic (+Y = North Ecliptic Pole, +X = Vernal Equinox λ=0°).
 *   - North Galactic Pole (b = +90°, Coma Berenices): λ = 180.02°, β = +29.81°
 *     => True Galactic Plane inclination to the Ecliptic = 60.19°.
 *   - Galactic Center (l = 0°, b = 0°, Sagittarius A*): λ = 266.85°, β = -5.54°.
 *   - Galactic East (l = +90°, b = 0°, Cygnus): λ ≈ 347°, β ≈ +59.7° (North of Ecliptic).
 */

import {
  Scene,
  MeshBuilder,
  Texture,
  ShaderMaterial,
  Effect,
  Matrix,
  Quaternion,
  Vector3,
  TransformNode,
  PointsCloudSystem,
  Color4,
  CloudPoint,
  Mesh,
} from "@babylonjs/core";

import { STAR_COUNT, STARFIELD_RADIUS } from "./sceneConstants";

const SKY_SPHERE_SHADER = "seamlessMilkyWay8kShader";

function ensureSkySphereShadersRegistered(): void {
  if (!Effect.ShadersStore[`${SKY_SPHERE_SHADER}VertexShader`]) {
    Effect.ShadersStore[`${SKY_SPHERE_SHADER}VertexShader`] = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;

      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
  }

  if (!Effect.ShadersStore[`${SKY_SPHERE_SHADER}FragmentShader`]) {
    Effect.ShadersStore[`${SKY_SPHERE_SHADER}FragmentShader`] = `
      precision highp float;
      uniform sampler2D uMilkyWayTex;
      uniform float uIntensity;
      varying vec2 vUv;

      void main(void) {
        // Mirror U horizontally for inside-sphere view so Cygnus (l=+90°) sits East/left
        // and Carina (l=270°) sits West/right when facing Sagittarius A* (u=0.5), matching the real sky.
        vec2 skyUv = vec2(1.0 - vUv.x, vUv.y);
        vec3 col = texture2D(uMilkyWayTex, skyUv).rgb;

        // Clean astrophotography tone curve: obsidian deep space + luminous golden galactic core & dust rifts
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float lift = smoothstep(0.014, 0.13, luma);
        col = pow(max(col, 0.0), vec3(1.16)) * (0.38 + 0.78 * lift) * uIntensity;

        float outLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = max(mix(vec3(outLuma), col, 1.12), 0.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `;
  }
}

/**
 * Exact IAU J2000 Galactic-to-Ecliptic Quaternion for Babylon CreateSphere:
 *   - On CreateSphere with `skyUv.x = 1 - vUv.x`:
 *       u = 0.50 (Galactic Center, Sagittarius A*) sits at local -X (-1, 0, 0)
 *       v = 1.00 (North Galactic Pole, b=+90°)    sits at local +Y ( 0,+1, 0)
 *       u = 0.25 (Cygnus, l=+90°)                 sits at local -Z ( 0, 0,-1)
 *       u = 0.75 (Carina, l=270°)                 sits at local +Z ( 0, 0,+1)
 */
function computeGalacticToEclipticQuaternion(): Quaternion {
  const deg = Math.PI / 180;

  const eclipticToVec = (lonDeg: number, latDeg: number): Vector3 => {
    const lam = lonDeg * deg;
    const bet = latDeg * deg;
    const cosB = Math.cos(bet);
    return new Vector3(
      cosB * Math.cos(lam),
      Math.sin(bet),
      cosB * Math.sin(lam)
    ).normalize();
  };

  // Galactic Center (Sagittarius A*): λ = 266.85°, β = -5.54°
  const gCenter = eclipticToVec(266.85, -5.54);
  // North Galactic Pole (Coma Berenices): λ = 180.02°, β = +29.81°
  const rawNorth = eclipticToVec(180.02, 29.81);

  // local +X = Galactic Anticenter (-gCenter, Orion/Taurus) so local -X = Galactic Center
  const localX = gCenter.scale(-1).normalize();
  // Gram-Schmidt orthonormal North Galactic Pole
  const localY = rawNorth
    .subtract(localX.scale(Vector3.Dot(rawNorth, localX)))
    .normalize();
  // In Babylon left-handed space: Cross(+X, +Y) = +Z -> points toward Carina (l=270°, β≈-60°)
  // and -Z points toward Cygnus (l=+90°, β≈+60° North of the Ecliptic)
  const localZ = Vector3.Cross(localX, localY).normalize();

  const rotMat = Matrix.FromValues(
    localX.x, localX.y, localX.z, 0,
    localY.x, localY.y, localY.z, 0,
    localZ.x, localZ.y, localZ.z, 0,
    0,        0,        0,        1
  );

  return Quaternion.FromRotationMatrix(rotMat);
}

export function createStarfield(scene: Scene): void {
  try {
    ensureSkySphereShadersRegistered();

    const galacticRoot = new TransformNode("galacticCelestialSphere", scene);
    galacticRoot.rotationQuaternion = computeGalacticToEclipticQuaternion();

    const maxTexSize = scene.getEngine().getCaps().maxTextureSize;
    const skyPath =
      maxTexSize >= 8192
        ? "/textures/milkyway_8k.webp"
        : "/textures/milkyway.jpg";

    const skyTex = new Texture(
      skyPath,
      scene,
      false,
      false, // invertY = false -> North Galactic Pole (top of image) maps to v=0 (+Y on CreateSphere)
      Texture.TRILINEAR_SAMPLINGMODE
    );
    skyTex.anisotropicFilteringLevel = 16;
    skyTex.wrapU = Texture.WRAP_ADDRESSMODE;
    skyTex.wrapV = Texture.CLAMP_ADDRESSMODE;

    const skyMat = new ShaderMaterial(
      "seamlessMilkyWay8kMat",
      scene,
      {
        vertex: SKY_SPHERE_SHADER,
        fragment: SKY_SPHERE_SHADER,
      },
      {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection", "uIntensity"],
        samplers: ["uMilkyWayTex"],
      }
    );
    skyMat.setTexture("uMilkyWayTex", skyTex);
    skyMat.setFloat("uIntensity", 0.92);
    skyMat.backFaceCulling = true;
    skyMat.disableDepthWrite = true;

    // 96-segment BackSide sphere -> 100% seamless 360° panorama with zero cube seams
    const skySphere = MeshBuilder.CreateSphere(
      "milkyWaySkySphere",
      {
        diameter: 5600,
        segments: 96,
        sideOrientation: Mesh.BACKSIDE,
      },
      scene
    );
    skySphere.material = skyMat;
    skySphere.parent = galacticRoot;
    skySphere.isPickable = false;
    skySphere.infiniteDistance = true;
    skySphere.checkCollisions = false;
    skySphere.renderingGroupId = 0;

    // ── Crisp Spectral Starfield Locked to the Same Galactic Frame ──────────
    const pcs = new PointsCloudSystem("galacticStarfieldPCS", 1.25, scene);
    const spectralColors: [number, number, number][] = [
      [0.64, 0.76, 1.0],
      [0.82, 0.88, 1.0],
      [0.98, 0.98, 1.0],
      [1.0, 0.95, 0.86],
      [1.0, 0.89, 0.70],
      [1.0, 0.78, 0.56],
      [1.0, 0.65, 0.48],
    ];

    pcs.addPoints(STAR_COUNT, (p: CloudPoint, i: number) => {
      const inBand = i < STAR_COUNT * 0.45;
      const theta = Math.random() * Math.PI * 2;
      let y: number;
      if (inBand) {
        const g = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
        y = Math.sin(g * 0.92);
      } else {
        y = 2 * Math.random() - 1;
      }
      const rPlane = Math.sqrt(Math.max(0, 1 - y * y));
      const r = STARFIELD_RADIUS + Math.random() * 500;

      p.position = new Vector3(
        rPlane * Math.cos(theta) * r,
        y * r,
        rPlane * Math.sin(theta) * r
      );

      const [cr, cg, cb] =
        spectralColors[Math.floor(Math.random() * spectralColors.length)];
      const mag = Math.pow(Math.random(), 2.3);
      const brightness = 0.2 + mag * 0.8;
      p.color = new Color4(cr * brightness, cg * brightness, cb * brightness, 0.9);
    });

    pcs.buildMeshAsync().then((mesh) => {
      const starMesh = mesh as Mesh;
      if (starMesh) {
        starMesh.parent = galacticRoot;
        starMesh.isPickable = false;
        starMesh.infiniteDistance = true;
        starMesh.checkCollisions = false;
      }
    });
  } catch (err) {
    console.error("Error initializing seamless 8K Milky Way sky sphere:", err);
  }
}
