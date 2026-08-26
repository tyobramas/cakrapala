import { describe, it, expect } from "vitest";
import {
  validateTrajectory,
  isValidTrajectoryPoint,
  hasOrderedTimestamps,
  hasRequiredEvents,
  enforceTrajectoryValidation,
} from "../../lib/mission-control/trajectoryValidation";
import type {
  MissionCandidate,
  TrajectoryPoint,
  MissionEvent,
} from "../../lib/mission-control/types";

describe("Trajectory Validation Layer", () => {
  const validPoint: TrajectoryPoint = {
    timestampUtc: "2026-10-01T00:00:00.000Z",
    positionEciKm: { x: 7000, y: 0, z: 0 },
    altitudeKm: 622,
    phase: "parking_orbit",
  };

  const validEvents: MissionEvent[] = [
    {
      type: "liftoff",
      timestampUtc: "2026-10-01T00:00:00.000Z",
      label: "Liftoff",
      positionEciKm: { x: 7000, y: 0, z: 0 },
    },
    {
      type: "pitch_over",
      timestampUtc: "2026-10-01T00:01:00.000Z",
      label: "Pitch-Over Maneuver",
      positionEciKm: { x: 7020, y: 20, z: 0 },
    },
    {
      type: "orbit_insertion",
      timestampUtc: "2026-10-01T00:08:00.000Z",
      label: "Orbit Insertion",
      positionEciKm: { x: 7100, y: 500, z: 0 },
    },
  ];

  it("identifies valid and invalid trajectory points", () => {
    expect(isValidTrajectoryPoint(validPoint)).toBe(true);

    // Missing / non-finite coordinates
    expect(
      isValidTrajectoryPoint({
        ...validPoint,
        positionEciKm: { x: NaN, y: 0, z: 0 },
      })
    ).toBe(false);

    expect(
      isValidTrajectoryPoint({
        ...validPoint,
        positionEciKm: { x: Infinity, y: 0, z: 0 },
      })
    ).toBe(false);

    // Invalid timestamp
    expect(
      isValidTrajectoryPoint({
        ...validPoint,
        timestampUtc: "invalid-date",
      })
    ).toBe(false);
  });

  it("checks strictly chronological timestamps", () => {
    const p1: TrajectoryPoint = { ...validPoint, timestampUtc: "2026-10-01T00:00:00Z" };
    const p2: TrajectoryPoint = { ...validPoint, timestampUtc: "2026-10-01T00:05:00Z" };
    const p3: TrajectoryPoint = { ...validPoint, timestampUtc: "2026-10-01T00:10:00Z" };

    expect(hasOrderedTimestamps([p1, p2, p3])).toBe(true);
    expect(hasOrderedTimestamps([p1, p3, p2])).toBe(false); // Out of order
  });

  it("enforces required events for satellite launch", () => {
    expect(hasRequiredEvents("satellite_launch", validEvents)).toBe(true);

    // Missing liftoff
    const missingLiftoff = validEvents.filter((e) => e.type !== "liftoff");
    expect(hasRequiredEvents("satellite_launch", missingLiftoff)).toBe(false);
  });

  it("downgrades candidate with empty trajectory from feasible to infeasible", () => {
    const candidateWithEmptyTrajectory: MissionCandidate = {
      id: "sat-empty",
      label: "Empty Path Candidate",
      objectiveScore: 1,
      feasibility: "feasible",
      risk: "low",
      warnings: [],
      trajectory: [], // EMPTY
      events: validEvents,
      deltaV: {
        availableMps: 10000,
        requiredMps: 9000,
        marginMps: 1000,
        components: [],
      },
      departureUtc: "2026-10-01T00:00:00Z",
      durationHours: 1,
      assumptions: [],
    };

    const validated = enforceTrajectoryValidation(
      candidateWithEmptyTrajectory,
      "satellite_launch"
    );

    expect(validated.feasibility).toBe("infeasible");
    expect(validated.risk).toBe("high");
    expect(validated.warnings.some((w) => w.includes("Trajectory generation failed"))).toBe(true);
  });

  it("downgrades candidate with NaN coordinates to infeasible", () => {
    const badPoints = Array(120).fill(validPoint).map((pt, i) => ({
      ...pt,
      positionEciKm: i === 50 ? { x: NaN, y: 0, z: 0 } : pt.positionEciKm,
      timestampUtc: new Date(Date.now() + i * 1000).toISOString(),
    }));

    const candidateWithBadPoint: MissionCandidate = {
      id: "sat-nan",
      label: "NaN Path Candidate",
      objectiveScore: 1,
      feasibility: "feasible",
      risk: "low",
      warnings: [],
      trajectory: badPoints,
      events: validEvents,
      deltaV: {
        availableMps: 10000,
        requiredMps: 9000,
        marginMps: 1000,
        components: [],
      },
      departureUtc: "2026-10-01T00:00:00Z",
      durationHours: 1,
      assumptions: [],
    };

    const validated = enforceTrajectoryValidation(
      candidateWithBadPoint,
      "satellite_launch"
    );

    expect(validated.feasibility).toBe("infeasible");
    expect(validated.risk).toBe("high");
  });
});
