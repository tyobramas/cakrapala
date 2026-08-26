/**
 * AI Mission Control — Strict Trajectory Validation Layer.
 *
 * NON-NEGOTIABLE RULE: A candidate may only be classified as "feasible" or "marginal"
 * when it has a valid, non-empty, finite, strictly ordered, and renderable trajectory
 * with required aerospace mission events.
 *
 * If trajectory generation fails or is unrenderable, the candidate MUST be downgraded
 * to "infeasible" or "no_solution".
 */

import type {
  MissionCandidate,
  MissionType,
  TrajectoryPoint,
  MissionEvent,
  TrajectoryValidationResult,
} from "./types";
import { EARTH_RADIUS_M } from "./constants";
import { mToKm } from "./units";

/** Minimum required trajectory points per mission mode */
export const MIN_POINTS_SATELLITE = 100;
export const MIN_POINTS_LUNAR_OUTBOUND = 150;
export const MIN_POINTS_LUNAR_RETURN = 80;

/**
 * Checks if a single trajectory point has valid finite coordinates and a valid timestamp.
 */
export function isValidTrajectoryPoint(point: TrajectoryPoint): boolean {
  if (!point || typeof point !== "object") return false;
  if (!point.timestampUtc || typeof point.timestampUtc !== "string") return false;

  const date = new Date(point.timestampUtc);
  if (isNaN(date.getTime())) return false;

  const pos = point.positionEciKm;
  if (!pos || typeof pos !== "object") return false;

  if (
    !Number.isFinite(pos.x) ||
    !Number.isFinite(pos.y) ||
    !Number.isFinite(pos.z)
  ) {
    return false;
  }

  // Reject absurd positions (> 2,000,000 km, beyond Earth-Moon system)
  const rSq = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;
  if (rSq < 1.0 || rSq > 4e12) {
    return false;
  }

  if (point.altitudeKm !== undefined && !Number.isFinite(point.altitudeKm)) {
    return false;
  }

  return true;
}

/**
 * Checks if trajectory points are strictly ordered in time (chronological).
 */
export function hasOrderedTimestamps(points: TrajectoryPoint[]): boolean {
  if (points.length < 2) return true;

  for (let i = 1; i < points.length; i++) {
    const tPrev = new Date(points[i - 1].timestampUtc).getTime();
    const tCurr = new Date(points[i].timestampUtc).getTime();
    if (isNaN(tPrev) || isNaN(tCurr) || tCurr < tPrev) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if the candidate has the required aerospace event markers for its mission type.
 */
export function hasRequiredEvents(
  missionType: MissionType,
  events: MissionEvent[],
  isFreeReturn: boolean = false
): boolean {
  if (!events || events.length === 0) return false;

  const eventTypes = new Set(events.map((e) => e.type));

  if (missionType === "satellite_launch") {
    return (
      eventTypes.has("liftoff") &&
      eventTypes.has("pitch_over") &&
      eventTypes.has("orbit_insertion")
    );
  }

  if (missionType === "lunar_free_return") {
    const hasTli = eventTypes.has("tli_burn");
    const hasFlyby = eventTypes.has("lunar_closest_approach");
    if (isFreeReturn) {
      return hasTli && hasFlyby && eventTypes.has("earth_return_interface");
    }
    return hasTli && hasFlyby;
  }

  return true;
}

/**
 * Validates the complete mission candidate trajectory and generates diagnostic report.
 */
export function validateTrajectory(
  candidate: MissionCandidate,
  missionType: MissionType
): TrajectoryValidationResult {
  const warnings: string[] = [];
  const reasonCodes: string[] = [];
  const points = candidate.trajectory || [];

  const pointCount = points.length;
  let invalidPointCount = 0;
  let maxRadiusKm = 0;

  // 1. Check point count
  const minRequired =
    missionType === "satellite_launch"
      ? MIN_POINTS_SATELLITE
      : MIN_POINTS_LUNAR_OUTBOUND;

  if (pointCount < minRequired) {
    reasonCodes.push("INSUFFICIENT_POINTS");
    warnings.push(
      `Trajectory contains only ${pointCount} points (minimum required: ${minRequired}).`
    );
  }

  // 2. Validate points and count orbit ring
  let orbitRingPointCount = 0;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.phase === "parking_orbit") {
      orbitRingPointCount++;
    }
    if (!isValidTrajectoryPoint(pt)) {
      invalidPointCount++;
    } else {
      const r = Math.sqrt(
        pt.positionEciKm.x ** 2 +
        pt.positionEciKm.y ** 2 +
        pt.positionEciKm.z ** 2
      );
      if (r > maxRadiusKm) maxRadiusKm = r;
    }
  }

  if (missionType === "satellite_launch" && orbitRingPointCount < 64) {
    reasonCodes.push("INSUFFICIENT_ORBIT_RING_POINTS");
    warnings.push(`Target orbit ring has only ${orbitRingPointCount} points (minimum required: 64).`);
  }

  if (invalidPointCount > 0) {
    reasonCodes.push("INVALID_COORDINATES");
    warnings.push(
      `Found ${invalidPointCount} invalid/NaN/non-finite points in trajectory.`
    );
  }

  // 3. Check chronological order
  if (!hasOrderedTimestamps(points)) {
    reasonCodes.push("UNORDERED_TIMESTAMPS");
    warnings.push("Trajectory timestamps are not strictly chronological.");
  }

  // 4. Check required event markers
  const isFreeReturn = candidate.returnEarthUtc !== undefined;
  if (!hasRequiredEvents(missionType, candidate.events, isFreeReturn)) {
    reasonCodes.push("MISSING_REQUIRED_EVENTS");
    warnings.push("Missing required aerospace event markers (liftoff, insertion, or TLI/flyby).");
  }

  const valid = reasonCodes.length === 0;
  const renderable = pointCount >= 2 && invalidPointCount === 0;

  return {
    valid,
    renderable,
    pointCount,
    orbitRingPointCount,
    invalidPointCount,
    reasonCodes,
    warnings,
    boundingRadiusKm: maxRadiusKm > 0 ? Math.round(maxRadiusKm) : undefined,
  };
}

/**
 * Applies strict validation and downgrades candidate if trajectory fails.
 */
export function enforceTrajectoryValidation(
  candidate: MissionCandidate,
  missionType: MissionType
): MissionCandidate {
  const validation = validateTrajectory(candidate, missionType);

  if (!validation.valid || !validation.renderable) {
    const combinedWarnings = [
      ...candidate.warnings,
      ...validation.warnings,
      "Trajectory generation failed. The delta-v estimate may be feasible, but no valid renderable mission path was produced under the selected simplified model.",
    ];

    return {
      ...candidate,
      feasibility: "infeasible",
      risk: "high",
      warnings: combinedWarnings,
      objectiveScore: 0,
    };
  }

  return candidate;
}

export interface TrajectorySummary {
  candidateId: string;
  feasibility: string;
  pointCount: number;
  orbitRingPointCount: number;
  eventCount: number;
  firstPoint?: { x: number; y: number; z: number; timestamp: string };
  lastPoint?: { x: number; y: number; z: number; timestamp: string };
  minCoordKm: { x: number; y: number; z: number };
  maxCoordKm: { x: number; y: number; z: number };
  minTimestampUtc?: string;
  maxTimestampUtc?: string;
  coordinateFrame: string;
  coordinateUnit: string;
  boundingRadiusKm: number;
  allFinite: boolean;
}

/**
 * Diagnostic helper: summarizes complete trajectory stats and ranges.
 */
export function summarizeTrajectory(
  candidate: MissionCandidate,
  missionType: MissionType = "satellite_launch"
): TrajectorySummary {
  const points = candidate.trajectory || [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let allFinite = true;
  let orbitRingPoints = 0;
  let maxR = 0;

  for (const pt of points) {
    if (pt.phase === "parking_orbit") orbitRingPoints++;
    const pos = pt.positionEciKm;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
      allFinite = false;
      continue;
    }
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.z < minZ) minZ = pos.z;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y > maxY) maxY = pos.y;
    if (pos.z > maxZ) maxZ = pos.z;

    const r = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    if (r > maxR) maxR = r;
  }

  return {
    candidateId: candidate.id,
    feasibility: candidate.feasibility,
    pointCount: points.length,
    orbitRingPointCount: orbitRingPoints,
    eventCount: candidate.events?.length || 0,
    firstPoint: points[0]
      ? {
          x: points[0].positionEciKm.x,
          y: points[0].positionEciKm.y,
          z: points[0].positionEciKm.z,
          timestamp: points[0].timestampUtc,
        }
      : undefined,
    lastPoint: points[points.length - 1]
      ? {
          x: points[points.length - 1].positionEciKm.x,
          y: points[points.length - 1].positionEciKm.y,
          z: points[points.length - 1].positionEciKm.z,
          timestamp: points[points.length - 1].timestampUtc,
        }
      : undefined,
    minCoordKm: { x: minX === Infinity ? 0 : minX, y: minY === Infinity ? 0 : minY, z: minZ === Infinity ? 0 : minZ },
    maxCoordKm: { x: maxX === -Infinity ? 0 : maxX, y: maxY === -Infinity ? 0 : maxY, z: maxZ === -Infinity ? 0 : maxZ },
    minTimestampUtc: points[0]?.timestampUtc,
    maxTimestampUtc: points[points.length - 1]?.timestampUtc,
    coordinateFrame: "ECI J2000",
    coordinateUnit: "kilometers (km)",
    boundingRadiusKm: Math.round(maxR),
    allFinite,
  };
}

