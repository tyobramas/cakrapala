import { describe, it, expect } from "vitest";
import { planSatelliteLaunch } from "../../lib/mission-control/satelliteLaunchPlanner";
import { planLunarFreeReturn } from "../../lib/mission-control/lunarFreeReturnPlanner";
import {
  getDefaultSatelliteScenario,
  getDefaultLunarScenario,
  VEHICLE_PRESETS,
  LAUNCH_SITES,
} from "../../lib/mission-control/vehiclePresets";
import { validateTrajectory } from "../../lib/mission-control/trajectoryValidation";

describe("Mission Planners & Default Scenarios", () => {
  it("Scenario A (Satellite Launch): generates valid, feasible, renderable trajectory", () => {
    const defaultScenario = getDefaultSatelliteScenario();
    const result = planSatelliteLaunch(defaultScenario);

    expect(result.missionType).toBe("satellite_launch");
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);

    const topCandidate = result.candidates[0];
    expect(topCandidate.feasibility).toBe("feasible");
    expect(topCandidate.risk).toBe("low");
    expect(topCandidate.deltaV.marginMps).toBeGreaterThan(0);

    // Trajectory requirements
    expect(topCandidate.trajectory.length).toBeGreaterThanOrEqual(100);
    expect(topCandidate.events.some((e) => e.type === "liftoff")).toBe(true);
    expect(topCandidate.events.some((e) => e.type === "pitch_over")).toBe(true);
    expect(topCandidate.events.some((e) => e.type === "orbit_insertion")).toBe(true);

    const validation = validateTrajectory(topCandidate, "satellite_launch");
    expect(validation.valid).toBe(true);
    expect(validation.renderable).toBe(true);
    expect(validation.invalidPointCount).toBe(0);
  });

  it("Scenario B (Lunar Transfer / Free Return): generates valid candidates and renderable path", () => {
    const defaultScenario = getDefaultLunarScenario();
    const result = planLunarFreeReturn(defaultScenario);

    expect(result.missionType).toBe("lunar_free_return");
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);

    const topCandidate =
      result.candidates.find((c) => c.id === result.recommendedCandidateId) ||
      result.candidates[0];

    expect(topCandidate.trajectory.length).toBeGreaterThanOrEqual(150);
    expect(topCandidate.events.some((e) => e.type === "tli_burn")).toBe(true);
    expect(topCandidate.events.some((e) => e.type === "lunar_closest_approach")).toBe(true);

    const validation = validateTrajectory(topCandidate, "lunar_free_return");
    expect(validation.renderable).toBe(true);
    expect(validation.invalidPointCount).toBe(0);
  });

  it("downgrades satellite launch when payload exceeds vehicle capacity", () => {
    const overweightScenario = {
      ...getDefaultSatelliteScenario(),
      payloadMassKg: 100_000, // 100 metric tons on a Medium LV
    };
    const result = planSatelliteLaunch(overweightScenario);
    expect(result.candidates[0].feasibility).toBe("infeasible");
    expect(result.recommendedCandidateId).toBeUndefined();
  });
});
