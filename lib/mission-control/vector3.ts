/**
 * AI Mission Control — 3D Vector Operations.
 *
 * Immutable Vec3 math for orbital mechanics calculations.
 * All operations return new objects; inputs are never mutated.
 */

import type { Vec3 } from "./types";

// ── Factory ───────────────────────────────────────────────────────────────────

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export const VEC3_ZERO: Vec3 = { x: 0, y: 0, z: 0 };

// ── Arithmetic ────────────────────────────────────────────────────────────────

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function negate(v: Vec3): Vec3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// ── Products ──────────────────────────────────────────────────────────────────

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// ── Magnitude ─────────────────────────────────────────────────────────────────

export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function magnitudeSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function normalize(v: Vec3): Vec3 {
  const m = magnitude(v);
  if (m === 0) return VEC3_ZERO;
  return scale(v, 1 / m);
}

export function distance(a: Vec3, b: Vec3): number {
  return magnitude(sub(a, b));
}

// ── Rotation ──────────────────────────────────────────────────────────────────

/**
 * Rotate vector v around axis by angle (radians) using Rodrigues' formula.
 * axis must be a unit vector.
 */
export function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const k = axis;

  // Rodrigues: v_rot = v*cos(θ) + (k × v)*sin(θ) + k*(k·v)*(1-cos(θ))
  const kCrossV = cross(k, v);
  const kDotV = dot(k, v);

  return {
    x: v.x * cosA + kCrossV.x * sinA + k.x * kDotV * (1 - cosA),
    y: v.y * cosA + kCrossV.y * sinA + k.y * kDotV * (1 - cosA),
    z: v.z * cosA + kCrossV.z * sinA + k.z * kDotV * (1 - cosA),
  };
}

/**
 * Linearly interpolate between two vectors.
 */
export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Convert spherical coordinates (r, θ, φ) to Cartesian.
 * θ = polar angle from +Z (colatitude), φ = azimuth in XY plane from +X.
 */
export function sphericalToCartesian(
  r: number,
  theta: number,
  phi: number
): Vec3 {
  return {
    x: r * Math.sin(theta) * Math.cos(phi),
    y: r * Math.sin(theta) * Math.sin(phi),
    z: r * Math.cos(theta),
  };
}
