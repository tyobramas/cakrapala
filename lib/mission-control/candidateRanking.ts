/**
 * AI Mission Control — Candidate Ranking.
 *
 * Ranks and labels mission candidates by optimization objective.
 */

import type { MissionCandidate, OptimizationObjective } from "./types";

/**
 * Rank candidates by objective and assign labels.
 * Returns up to 3 candidates, sorted by relevance.
 */
export function rankCandidates(
  candidates: MissionCandidate[],
  objective: OptimizationObjective
): MissionCandidate[] {
  if (candidates.length === 0) return [];

  // Filter out no_solution candidates for ranking
  const viable = candidates.filter(
    (c) => c.feasibility !== "no_solution" && c.feasibility !== "infeasible"
  );

  if (viable.length === 0) {
    // Return all with original labels
    return candidates.slice(0, 3);
  }

  // Sort by objective
  const sorted = [...viable];

  switch (objective) {
    case "minimum_delta_v":
      sorted.sort((a, b) => a.deltaV.requiredMps - b.deltaV.requiredMps);
      break;

    case "fastest_feasible":
      sorted.sort((a, b) => a.durationHours - b.durationHours);
      break;

    case "maximum_return_margin":
      sorted.sort((a, b) => b.deltaV.marginMps - a.deltaV.marginMps);
      break;
  }

  // Assign labels to top 3
  const labels = ["Fuel Saver", "Fastest Feasible", "Return Margin"];
  const result: MissionCandidate[] = [];

  for (let i = 0; i < Math.min(sorted.length, 3); i++) {
    result.push({
      ...sorted[i],
      label: labels[i] || `Candidate ${i + 1}`,
    });
  }

  return result;
}

/**
 * Select recommended candidate based on objective.
 */
export function selectRecommended(
  candidates: MissionCandidate[],
  objective: OptimizationObjective
): string | undefined {
  const ranked = rankCandidates(candidates, objective);
  if (ranked.length === 0) return undefined;

  // Recommend the first feasible/marginal candidate
  const recommended = ranked.find(
    (c) => c.feasibility === "feasible" || c.feasibility === "marginal"
  );

  return recommended?.id;
}
