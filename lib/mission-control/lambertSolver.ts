/**
 * AI Mission Control — Lambert Problem Solver.
 *
 * Solves the two-body Lambert boundary-value problem using
 * universal variables and Stumpff functions.
 *
 * Given: r₁, r₂ (position vectors), Δt (time of flight), μ (grav. parameter)
 * Find:  v₁, v₂ (velocity vectors at departure and arrival)
 *
 * Algorithm: Bate, Mueller & White "Fundamentals of Astrodynamics" (1971),
 * universal variable Stumpff iteration with robust finite-difference Newton step.
 *
 * This is a deterministic numerical solver — not an AI approximation.
 */

import type { Vec3 } from "./types";
import { magnitude, sub, scale, dot } from "./vector3";

// ── Stumpff Functions ─────────────────────────────────────────────────────────

/** Stumpff function c₂(z) = (1 - cos(√z)) / z */
export function stumpffC2(z: number): number {
  if (Math.abs(z) < 1e-10) return 1 / 2;
  if (z > 0) {
    const sqrtZ = Math.sqrt(z);
    return (1 - Math.cos(sqrtZ)) / z;
  } else {
    const sqrtNZ = Math.sqrt(-z);
    return (1 - Math.cosh(sqrtNZ)) / z;
  }
}

/** Stumpff function c₃(z) = (√z - sin(√z)) / (√z)³ */
export function stumpffC3(z: number): number {
  if (Math.abs(z) < 1e-10) return 1 / 6;
  if (z > 0) {
    const sqrtZ = Math.sqrt(z);
    return (sqrtZ - Math.sin(sqrtZ)) / (sqrtZ * sqrtZ * sqrtZ);
  } else {
    const sqrtNZ = Math.sqrt(-z);
    return (Math.sinh(sqrtNZ) - sqrtNZ) / (sqrtNZ * sqrtNZ * sqrtNZ);
  }
}

// ── Lambert Solver ────────────────────────────────────────────────────────────

export interface LambertSolution {
  v1: Vec3; // departure velocity vector
  v2: Vec3; // arrival velocity vector
  converged: boolean;
  iterations: number;
}

/**
 * Solve Lambert's problem (short-way transfer, prograde).
 *
 * @param r1 — departure position vector (m or km, must match mu)
 * @param r2 — arrival position vector (same units)
 * @param dt — time of flight (seconds)
 * @param mu — gravitational parameter (m³/s² or km³/s², consistent with r)
 * @param shortWay — if true, use short transfer (< 180°); if false, long way
 * @param maxIter — maximum Newton iterations
 * @param tolRel — relative convergence tolerance (default 1e-4)
 */
export function solveLambert(
  r1: Vec3,
  r2: Vec3,
  dt: number,
  mu: number,
  shortWay: boolean = true,
  maxIter: number = 40,
  tolRel: number = 1e-4
): LambertSolution {
  const r1Mag = magnitude(r1);
  const r2Mag = magnitude(r2);

  if (r1Mag < 1e-10 || r2Mag < 1e-10 || dt <= 0 || mu <= 0) {
    return { v1: { x: 0, y: 0, z: 0 }, v2: { x: 0, y: 0, z: 0 }, converged: false, iterations: 0 };
  }

  // Transfer angle
  const cosNu = Math.max(-1, Math.min(1, dot(r1, r2) / (r1Mag * r2Mag)));
  const sign = shortWay ? 1 : -1;
  const A = sign * Math.sqrt(r1Mag * r2Mag * (1 + cosNu));

  if (Math.abs(A) < 1e-12) {
    // Degenerate collinear 180° transfer
    return { v1: { x: 0, y: 0, z: 0 }, v2: { x: 0, y: 0, z: 0 }, converged: false, iterations: 0 };
  }

  let z = 0.0;
  let iterations = 0;

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;

    const c2 = stumpffC2(z);
    const c3 = stumpffC3(z);
    const sqrtC2 = Math.sqrt(Math.max(1e-14, c2));

    let y = r1Mag + r2Mag + A * (z * c3 - 1) / sqrtC2;
    if (y < 0) {
      z += 0.2;
      continue;
    }

    const x = Math.sqrt(Math.max(0, y / c2));
    const tZ = (x * x * x * c3 + A * Math.sqrt(Math.max(0, y))) / Math.sqrt(mu);

    // Check convergence
    if (Math.abs(tZ - dt) < tolRel * Math.max(1, dt)) {
      const f = 1 - y / r1Mag;
      const gDot = 1 - y / r2Mag;
      const g = A * Math.sqrt(Math.max(0, y / mu));

      if (Math.abs(g) < 1e-14) {
        return { v1: { x: 0, y: 0, z: 0 }, v2: { x: 0, y: 0, z: 0 }, converged: false, iterations };
      }

      const v1 = scale(sub(r2, scale(r1, f)), 1 / g);
      const v2 = scale(sub(scale(r2, gDot), r1), 1 / g);

      if (!Number.isFinite(magnitude(v1)) || !Number.isFinite(magnitude(v2))) {
        return { v1: { x: 0, y: 0, z: 0 }, v2: { x: 0, y: 0, z: 0 }, converged: false, iterations };
      }

      return { v1, v2, converged: true, iterations };
    }

    // Robust finite-difference derivative
    const eps = 1e-5;
    const c2p = stumpffC2(z + eps);
    const c3p = stumpffC3(z + eps);
    const sqrtC2p = Math.sqrt(Math.max(1e-14, c2p));
    const yp = r1Mag + r2Mag + A * ((z + eps) * c3p - 1) / sqrtC2p;
    const xp = Math.sqrt(Math.max(0, yp / c2p));
    const tZp = (xp * xp * xp * c3p + A * Math.sqrt(Math.max(0, yp))) / Math.sqrt(mu);
    const dTdz = (tZp - tZ) / eps;

    if (Math.abs(dTdz) < 1e-14) {
      z += 0.1;
      continue;
    }

    const step = (dt - tZ) / dTdz;
    // Damp step to avoid overshoot
    z += Math.max(-5, Math.min(5, step));
  }

  return { v1: { x: 0, y: 0, z: 0 }, v2: { x: 0, y: 0, z: 0 }, converged: false, iterations };
}
