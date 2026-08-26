import { describe, it, expect } from "vitest";
import { generateDeterministicMissionAnalysis } from "../../lib/mission-control/aiMissionAnalysis";
import { planSatelliteLaunch } from "../../lib/mission-control/satelliteLaunchPlanner";
import { getDefaultSatelliteScenario } from "../../lib/mission-control/vehiclePresets";
import { validateTrajectory } from "../../lib/mission-control/trajectoryValidation";

describe("AI Mission Post-Analysis Layer", () => {
  it("generates grounded post-analysis strictly matching calculated values", () => {
    const input = getDefaultSatelliteScenario();
    const result = planSatelliteLaunch(input);
    const candidate = result.candidates[0];
    const validation = validateTrajectory(candidate, "satellite_launch");

    const analysis = generateDeterministicMissionAnalysis(
      input,
      result,
      candidate,
      validation
    );

    expect(analysis.missionStatus).toBe(candidate.feasibility);
    expect(analysis.headline).toContain(candidate.label);
    expect(analysis.generatedBy).toBe("deterministic");
    expect(analysis.keyEvents.length).toBe(candidate.events.length);
    expect(analysis.modelLimitations.length).toBeGreaterThan(0);
    expect(analysis.summary).toContain(input.targetAltitudeKm.toString());
  });

  it("handles unrenderable / invalid trajectories with clear warning in AI analysis", () => {
    const input = getDefaultSatelliteScenario();
    const result = planSatelliteLaunch(input);
    const badCandidate = {
      ...result.candidates[0],
      feasibility: "infeasible" as const,
      trajectory: [],
    };
    const validation = validateTrajectory(badCandidate, "satellite_launch");

    const analysis = generateDeterministicMissionAnalysis(
      input,
      result,
      badCandidate,
      validation
    );

    expect(analysis.summary).toContain("No verified trajectory visualization is available");
    expect(analysis.missionStatus).toBe("infeasible");
  });
});
