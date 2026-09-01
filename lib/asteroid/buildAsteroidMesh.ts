import * as THREE from "three";
import { hashId, mulberry32, makeFbm } from "./shapeNoise";

export const ASTEROID_TAXONOMY = {
  C: { color: 0x635f59, roughness: 0.82 }, // Carbonaceous — rich stony-charcoal
  S: { color: 0x8e7e6e, roughness: 0.78 }, // Silicaceous — warm stony silicate
  M: { color: 0xa49e94, roughness: 0.65 }, // Metallic — nickel-iron bright luster
} as const;

export type TaxonomyKey = keyof typeof ASTEROID_TAXONOMY;

/** Heuristic only — NeoWs has no taxonomy field. Do not present as measured. */
export function inferTaxonomy(id: string): TaxonomyKey {
  const r = mulberry32(hashId(id) ^ 0x9e3779b9)();
  return r < 0.75 ? "C" : r < 0.94 ? "S" : "M";   // ~C-dominant, matches NEO population
}

export interface AsteroidMeshResult {
  mesh: THREE.Mesh;
  dispose: () => void;
  spinAxis: THREE.Vector3;
  spinRate: number;   // rad/s
}

export function buildAsteroidMesh(id: string, detail = 4): AsteroidMeshResult {
  const seed = hashId(id);
  const rand = mulberry32(seed);
  const fbm = makeFbm(rand);

  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lowFreq  = 0.30 * fbm(v.x * 1.3, v.y * 1.3, v.z * 1.3, 2);
    const midFreq  = 0.11 * fbm(v.x * 3.7, v.y * 3.7, v.z * 3.7, 3);
    const highFreq = 0.035 * fbm(v.x * 9.5, v.y * 9.5, v.z * 9.5, 2);
    v.multiplyScalar(1 + lowFreq + midFreq + highFreq - 0.16);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const tax = ASTEROID_TAXONOMY[inferTaxonomy(id)];
  const mat = new THREE.MeshStandardMaterial({
    color: tax.color,
    roughness: tax.roughness,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  // Elongation — asteroids are rarely equidimensional
  mesh.scale.set(1.0, 0.66 + rand() * 0.20, 0.80 + rand() * 0.18);

  const spinAxis = new THREE.Vector3(rand() - 0.5, 1, rand() - 0.5).normalize();
  const spinRate = 0.04 + rand() * 0.05;

  // Initial random rotation phase
  mesh.rotateOnAxis(spinAxis, rand() * Math.PI * 2);

  return {
    mesh,
    spinAxis,
    spinRate,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
