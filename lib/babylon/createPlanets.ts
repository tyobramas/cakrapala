"use client";

/**
 * createPlanets — Photorealistic Planetary Engine with:
 *   - Real IAU axial obliquity via dedicated `tiltNode` containers
 *     (fixes Saturn ring wobbling & renders Uranus's 97.8° sideways spin accurately)
 *   - True upright orientation (`invertY = true`) & un-tinted NASA/SSS 2K–8K WebP textures
 *   - Dedicated Photorealistic Earth Shader: 8K Day + 8K Black Marble Night City Lights +
 *     8K Cloud Layer with drift + 8K Specular Ocean Glint + Rayleigh Atmospheric Limb
 *   - Orbiting 2K Earth Moon
 *   - Sun-aware Fresnel atmospheric scattering shells on Venus, Mars, Jupiter, Saturn, Uranus, Neptune
 *   - Crisp Saturn Ring System + delicate Uranus Ring System
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  ShaderMaterial,
  Effect,
  Color3,
  Vector3,
  Mesh,
  TransformNode,
  Texture,
  VertexData,
} from "@babylonjs/core";

import type { PlanetId } from "../astronomy/types";
import { PLANET_DATA } from "../astronomy/planetData";

export type PlanetMeshMap = Map<PlanetId, Mesh>;

export interface PlanetRig {
  /** Root orbital carrier positioned along the planet's Keplerian orbit. */
  orbitNode: TransformNode;
  /** Axial tilt container holding the spinning planet sphere and equatorial rings. */
  tiltNode: TransformNode;
  /** Pickable planet sphere mesh (spins around its local Y axis inside `tiltNode`). */
  mesh: Mesh;
  /** Optional cloud layer mesh (Earth). */
  cloudMesh?: Mesh;
  /** Optional Earth Moon mesh positioned via real geocentric lunar ephemeris. */
  moonMesh?: Mesh;
  /** Visual orbital distance for Earth's Moon around Earth (in scene units). */
  moonOrbitRadius?: number;
  /** Optional update callback for cloud drift shader uniform. */
  update?: (deltaDays: number) => void;
}

export type PlanetRigMap = Map<PlanetId, PlanetRig>;

/** True IAU axial obliquity (degrees) & orbital inclination (degrees). */
export const PLANET_ASTRONOMY: Record<
  Exclude<PlanetId, "sun">,
  {
    axialTiltDeg: number;
    orbitalInclinationDeg: number;
    ascendingNodeDeg: number;
    spinDir: number;
    atmoColor?: [number, number, number];
    atmoStrength?: number;
  }
> = {
  mercury: {
    axialTiltDeg: 0.03,
    orbitalInclinationDeg: 7.0,
    ascendingNodeDeg: 48.3,
    spinDir: 1,
  },
  venus: {
    axialTiltDeg: 2.64,
    orbitalInclinationDeg: 3.39,
    ascendingNodeDeg: 76.7,
    spinDir: -1, // Retrograde rotation
    atmoColor: [0.96, 0.80, 0.48],
    atmoStrength: 0.65,
  },
  earth: {
    axialTiltDeg: 23.44,
    orbitalInclinationDeg: 0.0,
    ascendingNodeDeg: 0.0,
    spinDir: 1,
    atmoColor: [0.24, 0.62, 1.0],
    atmoStrength: 0.95,
  },
  mars: {
    axialTiltDeg: 25.19,
    orbitalInclinationDeg: 1.85,
    ascendingNodeDeg: 49.6,
    spinDir: 1,
    atmoColor: [0.92, 0.48, 0.30],
    atmoStrength: 0.42,
  },
  jupiter: {
    axialTiltDeg: 3.13,
    orbitalInclinationDeg: 1.3,
    ascendingNodeDeg: 100.5,
    spinDir: 1,
    atmoColor: [0.92, 0.78, 0.62],
    atmoStrength: 0.36,
  },
  saturn: {
    axialTiltDeg: 26.73,
    orbitalInclinationDeg: 2.49,
    ascendingNodeDeg: 113.7,
    spinDir: 1,
    atmoColor: [0.94, 0.84, 0.64],
    atmoStrength: 0.36,
  },
  uranus: {
    axialTiltDeg: 97.77,
    orbitalInclinationDeg: 0.77,
    ascendingNodeDeg: 74.0,
    spinDir: 1,
    atmoColor: [0.55, 0.88, 0.95],
    atmoStrength: 0.52,
  },
  neptune: {
    axialTiltDeg: 28.32,
    orbitalInclinationDeg: 1.77,
    ascendingNodeDeg: 131.8,
    spinDir: 1,
    atmoColor: [0.24, 0.48, 1.0],
    atmoStrength: 0.62,
  },
};

const ATMO_SHADER_NAME = "planetFresnelAtmoShader";
const EARTH_SHADER_NAME = "solarSystemEarth8kShader";

function ensurePlanetaryShadersRegistered(): void {
  if (!Effect.ShadersStore[`${ATMO_SHADER_NAME}VertexShader`]) {
    Effect.ShadersStore[`${ATMO_SHADER_NAME}VertexShader`] = `
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

  if (!Effect.ShadersStore[`${ATMO_SHADER_NAME}FragmentShader`]) {
    Effect.ShadersStore[`${ATMO_SHADER_NAME}FragmentShader`] = `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main(void) {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        // Sun is at world origin (0,0,0)
        vec3 L = normalize(-vWorldPos);

        float rim = 1.0 - max(0.0, dot(N, V));
        float fresnel = pow(rim, 3.2);
        float sunSide = smoothstep(-0.22, 0.35, dot(N, L));

        float intensity = fresnel * (0.06 + 0.94 * sunSide) * uStrength;
        gl_FragColor = vec4(uColor * intensity, clamp(intensity, 0.0, 0.92));
      }
    `;
  }

  if (!Effect.ShadersStore[`${EARTH_SHADER_NAME}VertexShader`]) {
    Effect.ShadersStore[`${EARTH_SHADER_NAME}VertexShader`] = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main(void) {
        vUv = uv;
        vec4 wp = world * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(world) * normal);
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
  }

  if (!Effect.ShadersStore[`${EARTH_SHADER_NAME}FragmentShader`]) {
    Effect.ShadersStore[`${EARTH_SHADER_NAME}FragmentShader`] = `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform sampler2D uDayTex;
      uniform sampler2D uNightTex;
      uniform sampler2D uSpecTex;
      uniform sampler2D uCloudTex;
      uniform float uCloudDrift;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main(void) {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(-vWorldPos); // Sun at world origin

        // Flip U so East is right and West is left on the outside of Babylon CreateSphere
        // (paired with invertY = false so North Pole sits at +Y)
        vec2 earthUv = vec2(1.0 - vUv.x, vUv.y);

        float dotNL = dot(N, L);
        float dotNV = max(0.0, dot(N, V));
        float dayMask = smoothstep(-0.10, 0.16, dotNL);
        float nightMask = 1.0 - smoothstep(-0.08, 0.06, dotNL);
        float terminator = exp(-pow((dotNL - 0.015) / 0.085, 2.0));

        vec3 dayCol = texture2D(uDayTex, earthUv).rgb;
        float waterMask = smoothstep(0.2, 0.65, texture2D(uSpecTex, earthUv).r);
        vec2 cloudUv = vec2(fract(earthUv.x - uCloudDrift), earthUv.y);
        float cloud = texture2D(uCloudTex, cloudUv).r;

        // Diffuse daylight + soft cloud shadow
        float diffuse = pow(clamp(dotNL, 0.0, 1.0), 0.85);
        float shadow = 1.0 - smoothstep(0.22, 0.82, cloud) * 0.35 * dayMask;

        // Ocean sun glint with Schlick Fresnel
        vec3 H = normalize(L + V);
        float dotNH = max(0.0, dot(N, H));
        float fresnel = 0.04 + 0.96 * pow(1.0 - dotNV, 5.0);
        float glint = (pow(dotNH, 110.0) * 1.3 + pow(dotNH, 18.0) * (0.18 + 0.35 * fresnel))
          * waterMask * smoothstep(-0.02, 0.2, dotNL) * shadow;

        vec3 surface = (dayCol * diffuse * 1.25 * shadow + vec3(1.0, 0.96, 0.90) * glint) * dayMask;

        // Warm Rayleigh twilight sunset along terminator
        surface += vec3(1.0, 0.44, 0.18) * terminator * 0.22 * shadow;

        // Cloud layer composited smoothly with day/sunset/night lighting
        vec3 dayCloud = vec3(0.96, 0.98, 1.0) * clamp(diffuse * 1.2, 0.1, 1.0);
        vec3 sunsetCloud = vec3(1.0, 0.52, 0.24) * terminator * 0.55;
        vec3 nightCloud = vec3(0.015, 0.024, 0.042);
        vec3 cloudCol = mix(nightCloud, dayCloud, dayMask) + sunsetCloud;
        float cloudAlpha = smoothstep(0.10, 0.88, cloud) * mix(0.20, 0.86, dayMask);

        // 8K Black Marble city lights on night side (occluded by thick clouds)
        vec3 nightLights = pow(max(texture2D(uNightTex, earthUv).rgb, 0.0), vec3(1.1))
          * vec3(1.45, 1.12, 0.68) * 1.9 * nightMask * (1.0 - smoothstep(0.25, 0.85, cloud) * 0.68);

        vec3 ambientNight = vec3(0.012, 0.020, 0.040) * nightMask;
        vec3 finalCol = mix(surface + nightLights + ambientNight, cloudCol, cloudAlpha);

        // Surface Rayleigh limb haze on sunlit side
        float rim = 1.0 - dotNV;
        float haze = pow(rim, 3.0) * smoothstep(-0.12, 0.30, dotNL);
        finalCol = mix(finalCol, vec3(0.26, 0.62, 1.0), clamp(haze * 0.65, 0.0, 0.78));

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `;
  }
}

export function createPlanets(scene: Scene): {
  meshes: PlanetMeshMap;
  rigs: PlanetRigMap;
} {
  ensurePlanetaryShadersRegistered();

  const meshes: PlanetMeshMap = new Map();
  const rigs: PlanetRigMap = new Map();
  const maxTexSize = scene.getEngine().getCaps().maxTextureSize;
  const supports8K = maxTexSize >= 8192;

  for (const planet of PLANET_DATA) {
    const astro = PLANET_ASTRONOMY[planet.id as Exclude<PlanetId, "sun">];

    // 1. Orbital carrier node positioned along planet's 3D inclined orbit
    const orbitNode = new TransformNode(`orbitNode_${planet.id}`, scene);
    orbitNode.position = new Vector3(planet.visualOrbitRadius, 0, 0);

    // 2. Axial obliquity node (stays at fixed real-world axial tilt while sphere spins inside)
    // Earth's North Pole tilts +23.4393° toward +Z (Summer Solstice λ=90°), matching real seasons!
    const tiltNode = new TransformNode(`tiltNode_${planet.id}`, scene);
    tiltNode.parent = orbitNode;
    if (planet.id === "earth") {
      tiltNode.rotation.x = (astro.axialTiltDeg * Math.PI) / 180;
    } else {
      tiltNode.rotation.z = (astro.axialTiltDeg * Math.PI) / 180;
    }

    // 3. High-segment planet sphere
    const mesh = MeshBuilder.CreateSphere(
      `planet_${planet.id}`,
      { diameter: planet.visualRadius * 2, segments: 64 },
      scene
    );
    mesh.parent = tiltNode;

    let updateFn: ((deltaDays: number) => void) | undefined;
    let moonMesh: Mesh | undefined;
    let moonOrbitRadius: number | undefined;

    if (planet.id === "earth") {
      // Dedicated Photorealistic Earth Shader (8K Day/Night/Clouds/Specular)
      const loadTex = (path: string) => {
        const t = new Texture(
          path,
          scene,
          false,
          false, // invertY = false -> Babylon CreateSphere v=0 is North Pole (+Y)
          Texture.TRILINEAR_SAMPLINGMODE
        );
        t.anisotropicFilteringLevel = 8;
        t.wrapU = Texture.WRAP_ADDRESSMODE;
        t.wrapV = Texture.CLAMP_ADDRESSMODE;
        return t;
      };

      const dayTex = loadTex(
        supports8K
          ? "/textures/planets/earth_day_8k.webp"
          : "/textures/planets/earth_4k.jpg"
      );
      const nightTex = loadTex(
        supports8K
          ? "/textures/planets/earth_night_8k.webp"
          : "/textures/planets/earth_night.jpg"
      );
      const specTex = loadTex(
        supports8K
          ? "/textures/planets/earth_specular_8k.webp"
          : "/textures/planets/earth_water_mask.png"
      );
      const cloudTex = loadTex(
        supports8K
          ? "/textures/planets/earth_clouds_8k.webp"
          : "/textures/planets/earth_clouds2.jpg"
      );

      const earthMat = new ShaderMaterial(
        "mat_earth_photoreal",
        scene,
        { vertex: EARTH_SHADER_NAME, fragment: EARTH_SHADER_NAME },
        {
          attributes: ["position", "normal", "uv"],
          uniforms: ["world", "worldViewProjection", "cameraPosition", "uCloudDrift"],
          samplers: ["uDayTex", "uNightTex", "uSpecTex", "uCloudTex"],
        }
      );
      earthMat.setTexture("uDayTex", dayTex);
      earthMat.setTexture("uNightTex", nightTex);
      earthMat.setTexture("uSpecTex", specTex);
      earthMat.setTexture("uCloudTex", cloudTex);
      earthMat.setFloat("uCloudDrift", 0);
      mesh.material = earthMat;

      let drift = 0;
      updateFn = (deltaDays: number) => {
        // Gentle atmospheric super-rotation drift proportional to simulated time
        drift = (drift + Math.min(deltaDays, 1.5) * 0.015) % 1;
        earthMat.setFloat("uCloudDrift", drift);
      };

      // Earth's Moon positioned each frame via real geocentric lunar ephemeris (`computeMoonEclipticDirection`)
      moonOrbitRadius = planet.visualRadius * 2.55;
      moonMesh = MeshBuilder.CreateSphere(
        "earthMoon",
        { diameter: planet.visualRadius * 0.52, segments: 32 },
        scene
      );
      moonMesh.parent = orbitNode;
      moonMesh.position = new Vector3(moonOrbitRadius, 0, 0);
      moonMesh.isPickable = false;

      const moonMat = new StandardMaterial("mat_earth_moon", scene);
      moonMat.diffuseColor = Color3.White();
      moonMat.specularColor = new Color3(0.04, 0.04, 0.04);
      const moonTex = new Texture(
        "/textures/planets/hd/moon.webp",
        scene,
        false,
        false,
        Texture.TRILINEAR_SAMPLINGMODE
      );
      moonTex.uScale = -1;
      moonTex.anisotropicFilteringLevel = 8;
      moonMat.diffuseTexture = moonTex;
      moonMesh.material = moonMat;
    } else {
      // Standard Photorealistic Planet Material with un-tinted HD 2K/4K WebP textures
      const mat = new StandardMaterial(`mat_${planet.id}`, scene);
      // Pure white diffuseColor so real NASA/SSS planetary colors are NEVER darkened or muddied
      mat.diffuseColor = Color3.White();
      mat.specularColor =
        planet.id === "mercury" || planet.id === "mars"
          ? new Color3(0.05, 0.05, 0.05)
          : new Color3(0.12, 0.13, 0.15);
      mat.specularPower = 24;

      const hdPath = `/textures/planets/hd/${planet.id}.webp`;
      const legacyPath = `/textures/planets/${planet.id}.jpg`;

      const texture = new Texture(
        hdPath,
        scene,
        false,
        false, // invertY = false -> North Pole at +Y on Babylon CreateSphere
        Texture.TRILINEAR_SAMPLINGMODE,
        undefined,
        () => {
          const fb = new Texture(legacyPath, scene, false, false);
          fb.uScale = -1;
          mat.diffuseTexture = fb;
        }
      );
      texture.uScale = -1; // West-left, East-right on outside of sphere
      texture.anisotropicFilteringLevel = 8;
      mat.diffuseTexture = texture;
      mesh.material = mat;
    }

    mesh.metadata = {
      type: "planet",
      planetId: planet.id,
      name: planet.name,
    };

    // 4. Sun-aware Fresnel Atmospheric Rim Shell (for planets with atmospheres)
    if (astro.atmoColor && astro.atmoStrength) {
      addAtmosphereRim(
        tiltNode,
        planet.id,
        planet.visualRadius * 1.032,
        new Color3(astro.atmoColor[0], astro.atmoColor[1], astro.atmoColor[2]),
        astro.atmoStrength,
        scene
      );
    }

    // 5. Saturn & Uranus Ring Systems (parented to `tiltNode` so they NEVER wobble!)
    if (planet.hasRing) {
      addSaturnRings(tiltNode, planet.visualRadius, scene);
    } else if (planet.id === "uranus") {
      addUranusRings(tiltNode, planet.visualRadius, scene);
    }

    meshes.set(planet.id, mesh);
    rigs.set(planet.id, {
      orbitNode,
      tiltNode,
      mesh,
      moonMesh,
      moonOrbitRadius,
      update: updateFn,
    });
  }

  return { meshes, rigs };
}

function addAtmosphereRim(
  parent: TransformNode,
  id: string,
  radius: number,
  color: Color3,
  strength: number,
  scene: Scene
): void {
  const atmo = MeshBuilder.CreateSphere(
    `atmo_${id}`,
    { diameter: radius * 2, segments: 48 },
    scene
  );
  atmo.parent = parent;
  atmo.isPickable = false;

  const mat = new ShaderMaterial(
    `atmoMat_${id}`,
    scene,
    { vertex: ATMO_SHADER_NAME, fragment: ATMO_SHADER_NAME },
    {
      attributes: ["position", "normal"],
      uniforms: ["world", "worldViewProjection", "cameraPosition", "uColor", "uStrength"],
      needAlphaBlending: true,
    }
  );
  mat.setColor3("uColor", color);
  mat.setFloat("uStrength", strength);
  mat.alphaMode = 1; // ALPHA_ADD
  mat.disableDepthWrite = true;
  atmo.material = mat;
}

function addSaturnRings(
  tiltNode: TransformNode,
  saturnRadius: number,
  scene: Scene
): void {
  const innerRadius = saturnRadius * 1.24;
  const outerRadius = saturnRadius * 2.48;
  const segments = 160;

  const ringMesh = new Mesh("saturnRingAnnulus", scene);
  const vertexData = new VertexData();

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    positions.push(cos * innerRadius, 0, sin * innerRadius);
    normals.push(0, 1, 0);
    uvs.push(0, i / segments);

    positions.push(cos * outerRadius, 0, sin * outerRadius);
    normals.push(0, 1, 0);
    uvs.push(1, i / segments);
  }

  for (let i = 0; i < segments; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = (i + 1) * 2;
    const i3 = (i + 1) * 2 + 1;

    indices.push(i0, i1, i2);
    indices.push(i1, i3, i2);
    indices.push(i2, i1, i0);
    indices.push(i2, i3, i1);
  }

  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;
  vertexData.applyToMesh(ringMesh);

  // Sits cleanly in Saturn's equatorial plane inside `tiltNode` (26.73° steady axial tilt)
  ringMesh.parent = tiltNode;

  const ringMat = new StandardMaterial("saturnRingPhotorealisticMat", scene);
  const ringTexture = new Texture(
    "/textures/planets/saturn_ring.png",
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE
  );
  ringTexture.anisotropicFilteringLevel = 8;
  ringMat.diffuseTexture = ringTexture;
  ringMat.opacityTexture = ringTexture;
  ringMat.diffuseColor = new Color3(1.0, 0.96, 0.88);
  ringMat.emissiveColor = new Color3(0.22, 0.19, 0.15);
  ringMat.specularColor = new Color3(0.06, 0.06, 0.06);
  ringMat.backFaceCulling = false;
  ringMat.useAlphaFromDiffuseTexture = true;
  ringMat.alpha = 0.92;
  ringMesh.material = ringMat;
  ringMesh.isPickable = false;
}

function addUranusRings(
  tiltNode: TransformNode,
  uranusRadius: number,
  scene: Scene
): void {
  const innerRadius = uranusRadius * 1.55;
  const outerRadius = uranusRadius * 1.98;
  const segments = 128;

  const ringMesh = new Mesh("uranusRingAnnulus", scene);
  const vertexData = new VertexData();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * innerRadius, 0, sin * innerRadius);
    normals.push(0, 1, 0);
    uvs.push(0, i / segments);
    positions.push(cos * outerRadius, 0, sin * outerRadius);
    normals.push(0, 1, 0);
    uvs.push(1, i / segments);
  }
  for (let i = 0; i < segments; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = (i + 1) * 2;
    const i3 = (i + 1) * 2 + 1;
    indices.push(i0, i1, i2, i1, i3, i2, i2, i1, i0, i2, i3, i1);
  }

  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;
  vertexData.applyToMesh(ringMesh);

  ringMesh.parent = tiltNode;

  const ringMat = new StandardMaterial("uranusRingMat", scene);
  ringMat.diffuseColor = new Color3(0.65, 0.85, 0.95);
  ringMat.emissiveColor = new Color3(0.18, 0.30, 0.38);
  ringMat.specularColor = Color3.Black();
  ringMat.backFaceCulling = false;
  ringMat.alpha = 0.16;
  ringMesh.material = ringMat;
  ringMesh.isPickable = false;
}
