/**
 * AI Mission Control — AI Mission Post-Analysis.
 *
 * Provides structured, engineering-grade mission explanations strictly
 * grounded in deterministic physical calculations.
 *
 * Rules:
 *   - AI never invents or overrides physics numbers, dates, delta-v, or feasibility.
 *   - All numerical values are formatted from the verified calculation result.
 *   - If external LLM is unavailable, falls back cleanly to Deterministic Mission Analysis.
 */

import type {
  MissionCandidate,
  MissionAnalysisResult,
  SatelliteLaunchInput,
  LunarFreeReturnInput,
  TrajectoryValidationResult,
  MissionPostAnalysis,
} from "./types";
import { formatDurationHours, formatDeltaV, formatDistanceKm } from "./formatters";

/**
 * Generates a deterministic, strictly grounded mission post-analysis.
 */
export function generateDeterministicMissionAnalysis(
  input: SatelliteLaunchInput | LunarFreeReturnInput,
  result: MissionAnalysisResult,
  candidate: MissionCandidate,
  validation: TrajectoryValidationResult
): MissionPostAnalysis {
  const isSatellite = result.missionType === "satellite_launch";
  const satInput = isSatellite ? (input as SatelliteLaunchInput) : null;
  const lunarInput = !isSatellite ? (input as LunarFreeReturnInput) : null;

  // 1. Headline
  let headline: string;
  if (!validation.renderable || candidate.feasibility === "infeasible" || candidate.feasibility === "no_solution") {
    headline = isSatellite
      ? "Mission Analysis: Target Orbit Insertion Infeasible"
      : "Mission Analysis: Lunar Trajectory Constraints Exceeded";
  } else if (candidate.feasibility === "marginal") {
    headline = isSatellite
      ? `Marginal Mission Feasibility: ${candidate.label}`
      : `Marginal Lunar Transfer: ${candidate.label}`;
  } else {
    headline = isSatellite
      ? `Recommended Orbital Profile: ${candidate.label} (${satInput?.vehicle.name})`
      : `Recommended Lunar Trajectory: ${candidate.label} (${candidate.durationHours ? (candidate.durationHours / 24).toFixed(1) + " days" : ""})`;
  }

  // 2. Summary
  let summary: string;
  if (!validation.renderable) {
    summary =
      "No verified trajectory visualization is available. The mission cannot be presented as feasible until a valid renderable path is generated under the current simplified model.";
  } else if (isSatellite) {
    summary = `The selected profile achieves a ${satInput?.targetAltitudeKm} km circular LEO orbit at ${satInput?.targetInclinationDeg}° inclination from ${satInput?.launchSite.name}. Total required delta-v is ${formatDeltaV(candidate.deltaV.requiredMps)} with an available budget of ${formatDeltaV(candidate.deltaV.availableMps)} (${formatDeltaV(candidate.deltaV.marginMps)} margin).`;
  } else {
    const returnType = candidate.returnEarthUtc ? "Free-Return Roundtrip" : "Lunar Transfer Explorer";
    summary = `Recommended route '${candidate.label}' offers an optimal balance of propellant requirement and flight geometry. The 3D Mission Theater displays the outbound injection in orange, lunar perilune flyby in violet, and Earth-bound return corridor in blue-indigo.`;
  }

  // 3. Route Explanation
  const routeExplanation: string[] = [];
  if (isSatellite) {
    routeExplanation.push(
      "Pad Liftoff & Ascent (Red): Initial vertical launch from pad climbing through dense lower atmosphere."
    );
    routeExplanation.push(
      "Gravity Turn Pitch (Amber): Gravity-turn pitch maneuver transitioning to horizontal velocity through upper atmosphere."
    );
    routeExplanation.push(
      `Circular Insertion Orbit (Cyan): Target circular orbit ring at ${satInput?.targetAltitudeKm} km altitude maintaining continuous orbital speed.`
    );
  } else {
    routeExplanation.push(
      "Outbound TLI Transfer (Orange): Trans-Lunar Injection burn departing low Earth parking orbit on a prograde transfer ellipse toward the Moon."
    );
    routeExplanation.push(
      `Lunar Perilune Flyby (Violet): Passive gravity-assist hyperbola swinging behind the Moon at ${candidate.periluneAltitudeKm || 200} km altitude.`
    );
    if (candidate.returnEarthUtc) {
      routeExplanation.push(
        "Earth Free-Return Leg (Blue): Deflected trajectory returning ballistically toward Earth's atmospheric entry interface."
      );
    }
  }

  // 4. Key Events
  const keyEvents = candidate.events.map((e) => {
    let desc = "";
    if (e.type === "liftoff") desc = "Main engine ignition and pad departure.";
    else if (e.type === "pitch_over") desc = "Initiation of gravity-turn pitch maneuver.";
    else if (e.type === "orbit_insertion") desc = "Second-stage cutoff into circular target orbit.";
    else if (e.type === "tli_burn") desc = "Trans-Lunar Injection burn from circular parking orbit.";
    else if (e.type === "lunar_closest_approach") desc = "Closest approach to lunar surface (perilune).";
    else if (e.type === "earth_return_interface") desc = "Atmospheric reentry interface encounter.";
    return {
      label: e.label,
      timestampUtc: e.timestampUtc,
      description: desc,
    };
  });

  // 5. Feasibility Explanation
  const feasibilityExplanation: string[] = [];
  if (candidate.deltaV.marginMps >= 500) {
    feasibilityExplanation.push(
      `Available delta-v (${formatDeltaV(candidate.deltaV.availableMps)}) comfortably exceeds total required mission delta-v (${formatDeltaV(candidate.deltaV.requiredMps)}) with a positive safety margin of ${formatDeltaV(candidate.deltaV.marginMps)}.`
    );
  } else if (candidate.deltaV.marginMps >= 0) {
    feasibilityExplanation.push(
      `Marginal margin of ${formatDeltaV(candidate.deltaV.marginMps)}. Feasible under nominal conditions but sensitive to trajectory dispersion.`
    );
  } else {
    feasibilityExplanation.push(
      `Vehicle capability deficit of ${formatDeltaV(Math.abs(candidate.deltaV.marginMps))}. Delta-v budget is insufficient for this mission profile.`
    );
  }

  // 6. Risk Explanation
  const riskExplanation: string[] = [];
  if (candidate.risk === "low") {
    riskExplanation.push("All physical constraints, margins, and trajectory stability criteria are within nominal limits.");
  } else if (candidate.risk === "medium") {
    riskExplanation.push("Moderate risk due to narrow delta-v margins or significant steering/inclination penalties.");
  } else {
    riskExplanation.push("High risk: Negative margin, payload overweight, or return corridor dispersion beyond acceptable bounds.");
  }

  // 7. Recommended Actions
  const recommendedActions: string[] = [];
  if (candidate.feasibility !== "feasible") {
    recommendedActions.push("Select a higher-capacity launch vehicle (e.g. Heavy Launch Vehicle).");
    recommendedActions.push("Reduce payload mass to increase available delta-v margin.");
    if (isSatellite) {
      recommendedActions.push("Align target inclination closer to launch site latitude to eliminate plane change penalty.");
    } else {
      recommendedActions.push("Widen search window or adjust flight time bounds (72–168 hrs).");
    }
  } else {
    recommendedActions.push("Proceed with high-fidelity numerical perturbation modeling (J2, 3rd-body, solar radiation).");
    recommendedActions.push("Perform Monte Carlo dispersion analysis on engine burn execution errors.");
  }

  // 8. Comparison Notes
  const comparisonNotes: string[] = [];
  if (result.candidates.length > 1) {
    result.candidates.forEach((c) => {
      comparisonNotes.push(
        `${c.label}: Required Δv ${formatDeltaV(c.deltaV.requiredMps)}, Margin ${formatDeltaV(c.deltaV.marginMps)}, Duration ${formatDurationHours(c.durationHours)}.`
      );
    });
  }

  // 9. Model Limitations
  const modelLimitations = [
    "Two-body Keplerian / patched-conic approximation without atmospheric weather perturbations.",
    "Planar impulsive burn assumption (finite-duration gravity losses modeled via empirical factors).",
    "Requires high-fidelity numerical integration (N-body / Cowell's method) prior to operational flight planning.",
  ];

  return {
    headline,
    missionStatus: candidate.feasibility,
    summary,
    routeExplanation,
    keyEvents,
    feasibilityExplanation,
    riskExplanation,
    recommendedActions,
    comparisonNotes,
    modelLimitations,
    generatedBy: "deterministic",
  };
}
