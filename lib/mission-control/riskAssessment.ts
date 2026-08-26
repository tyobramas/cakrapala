/**
 * AI Mission Control — Deterministic Risk Assessment.
 *
 * Produces risk levels and reason codes based on mission feasibility,
 * delta-v margins, and trajectory quality. No LLM involvement.
 */

import type { FeasibilityStatus, RiskLevel } from "./types";
import type { RiskReason } from "./types";
import { FEASIBILITY_MARGIN_FEASIBLE_MPS } from "./constants";

interface RiskAssessmentResult {
  level: RiskLevel;
  reasons: RiskReason[];
}

/**
 * Assess mission risk based on deterministic rules.
 */
export function assessRisk(
  feasibility: FeasibilityStatus,
  marginMps: number,
  warnings: string[],
  returnCorridorValid?: boolean,
  periluneAltitudeKm?: number,
  targetPeriluneKm?: number
): RiskAssessmentResult {
  const reasons: RiskReason[] = [];

  // ── HIGH risk conditions ────────────────────────────────────────────────
  if (feasibility === "infeasible" || feasibility === "no_solution") {
    reasons.push({
      code: "DELTA_V_DEFICIT",
      level: "high",
      message: "Required delta-v exceeds available vehicle capability.",
    });
  }

  if (returnCorridorValid === false) {
    reasons.push({
      code: "NO_RETURN_CORRIDOR",
      level: "high",
      message: "No valid Earth return corridor found within simplified model.",
    });
  }

  if (Number.isFinite(marginMps) && marginMps < 0) {
    reasons.push({
      code: "NEGATIVE_MARGIN",
      level: "high",
      message: `Delta-v margin is ${Math.round(marginMps)} m/s (negative). Mission not achievable.`,
    });
  }

  // ── MEDIUM risk conditions ──────────────────────────────────────────────
  if (
    Number.isFinite(marginMps) &&
    marginMps >= 0 &&
    marginMps < FEASIBILITY_MARGIN_FEASIBLE_MPS
  ) {
    reasons.push({
      code: "LOW_MARGIN",
      level: "medium",
      message: `Delta-v margin is only ${Math.round(marginMps)} m/s. Recommend ≥${FEASIBILITY_MARGIN_FEASIBLE_MPS} m/s.`,
    });
  }

  if (
    periluneAltitudeKm !== undefined &&
    targetPeriluneKm !== undefined &&
    Math.abs(periluneAltitudeKm - targetPeriluneKm) > 2000
  ) {
    reasons.push({
      code: "PERILUNE_DEVIATION",
      level: "medium",
      message: `Perilune altitude ${Math.round(periluneAltitudeKm)} km deviates significantly from target ${targetPeriluneKm} km.`,
    });
  }

  if (warnings.some((w) => w.toLowerCase().includes("correction"))) {
    reasons.push({
      code: "HIGH_CORRECTION",
      level: "medium",
      message: "Estimated mid-course or return correction is significant.",
    });
  }

  // ── Determine overall level ─────────────────────────────────────────────
  const hasHigh = reasons.some((r) => r.level === "high");
  const hasMedium = reasons.some((r) => r.level === "medium");

  let level: RiskLevel;
  if (hasHigh) {
    level = "high";
  } else if (hasMedium) {
    level = "medium";
  } else {
    level = "low";
  }

  return { level, reasons };
}
