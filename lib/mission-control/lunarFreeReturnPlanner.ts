/**
 * AI Mission Control — Planner B: Lunar Free-Return Explorer.
 *
 * Searches for Earth–Moon free-return candidates accounting for
 * the Moon's time-dependent position via astronomy-engine.
 *
 * Level 1: Lambert solver grid search over departure × flight-time.
 * Level 2: Patched-conic return screening — hyperbolic flyby turn angle,
 *          outgoing velocity transformation, Earth-return perigee check.
 *
 * If Level 2 fails to find return candidates, results are labeled
 * "Lunar Transfer Explorer (Experimental)" instead of "Free Return."
 */

import type {
  LunarFreeReturnInput,
  MissionAnalysisResult,
  MissionCandidate,
  TrajectoryPoint,
  MissionEvent,
  DeltaVBudget,
  Vec3,
  FeasibilityStatus,
} from "./types";
import {
  EARTH_MU_M3_S2,
  EARTH_RADIUS_M,
  MOON_MU_M3_S2,
  MOON_RADIUS_M,
  MODEL_VERSION,
  MIDCOURSE_CORRECTION_ESTIMATE_MPS,
  RETURN_CORRECTION_ESTIMATE_MPS,
  REENTRY_CORRIDOR_MIN_M,
  REENTRY_CORRIDOR_MAX_M,
} from "./constants";
import { kmToM, mToKm, hoursToSeconds, secondsToHours, degToRad } from "./units";
import { vec3, magnitude, sub, scale, add, normalize, cross, dot, rotateAroundAxis } from "./vector3";
import { getMoonPositionEciM, getMoonVelocityEciMps } from "./ephemeris";
import { solveLambert } from "./lambertSolver";
import { assessRisk } from "./riskAssessment";
import { rankCandidates, selectRecommended } from "./candidateRanking";
import { tsiolkovskyDeltaVMps, circularOrbitalSpeedMps } from "./satelliteLaunchPlanner";
import { enforceTrajectoryValidation } from "./trajectoryValidation";

// ── Internal Types ────────────────────────────────────────────────────────────

interface TransferCandidate {
  departureUtc: string;
  arrivalUtc: string;
  flightTimeHours: number;
  deltaVTliMps: number;
  arrivalVInfMps: number;
  depPosM: Vec3;
  moonPosM: Vec3;
  moonVelMps: Vec3;
  departureVelMps: Vec3;
  arrivalVelMps: Vec3;
  periluneAltitudeKm: number;
  returnPerigeeM: number;
  returnValid: boolean;
  totalDeltaVMps: number;
}

// ── Level 1: Lambert Transfer Geometry ────────────────────────────────────────

/**
 * Generate departure position in parking orbit.
 * Computes the optimal TLI departure true anomaly in the Earth-Moon orbital plane
 * (approximately 155°-170° true anomaly before Moon arrival position).
 */
function computeDeparturePosition(
  parkingAltKm: number,
  moonPosM: Vec3,
  moonVelMps: Vec3,
  departureSite?: LaunchSite,
  transferAngleRad: number = Math.PI * 0.90 // ~162°
): Vec3 {
  const rPark = EARTH_RADIUS_M + kmToM(parkingAltKm);
  if (departureSite && departureSite.id !== "equatorial") {
    const latRad = degToRad(departureSite.latitudeDeg);
    const lonRad = degToRad(departureSite.longitudeDeg);
    return vec3(
      rPark * Math.cos(latRad) * Math.cos(lonRad),
      rPark * Math.cos(latRad) * Math.sin(lonRad),
      rPark * Math.sin(latRad)
    );
  }
  const moonDir = normalize(moonPosM);
  // Normal to Moon's orbital plane
  let moonNormal = normalize(cross(moonPosM, moonVelMps));
  if (magnitude(moonNormal) < 1e-6) {
    moonNormal = vec3(0, 0, 1);
  }

  // Rotate opposite to Moon arrival direction in orbital plane
  const depDir = rotateAroundAxis(moonDir, moonNormal, -transferAngleRad);
  return scale(depDir, rPark);
}

function parkingOrbitSpeedMps(altKm: number): number {
  const r = EARTH_RADIUS_M + kmToM(altKm);
  return circularOrbitalSpeedMps(r);
}

// ── Level 2: Patched-Conic Return Screening ───────────────────────────────────

/**
 * Hyperbolic flyby turn angle:
 * δ = 2 · arcsin(1 / (1 + rp·v∞² / μM))
 */
function hyperbolicTurnAngle(
  periluneRadiusM: number,
  vInfMps: number
): number {
  const e = 1 + (periluneRadiusM * vInfMps * vInfMps) / MOON_MU_M3_S2;
  if (e <= 1) return Math.PI; // parabolic or captured
  return 2 * Math.asin(1 / e);
}

/**
 * Screen for Earth return after lunar flyby using patched-conic model.
 */
function screenReturn(
  arrivalVelTransferMps: Vec3,
  moonPosM: Vec3,
  moonVelMps: Vec3,
  targetPeriluneM: number
): { returnPerigeeM: number; valid: boolean; periluneAltM: number } {
  // v∞ incoming (Moon-relative)
  const vInfIn = sub(arrivalVelTransferMps, moonVelMps);
  const vInfMag = magnitude(vInfIn);

  if (vInfMag < 10) {
    return { returnPerigeeM: 0, valid: false, periluneAltM: targetPeriluneM };
  }

  // Turn angle
  const periluneR = MOON_RADIUS_M + targetPeriluneM;
  const delta = hyperbolicTurnAngle(periluneR, vInfMag);

  const moonDir = normalize(moonPosM);
  const vInfDir = normalize(vInfIn);

  let flybyAxis = normalize(cross(moonDir, vInfDir));
  if (magnitude(flybyAxis) < 1e-6) {
    flybyAxis = vec3(0, 0, 1);
  }

  // Rotate v∞ around flyby axis by turn angle
  const vInfOut = rotateAroundAxis(vInfIn, flybyAxis, delta);
  const vOutEarth = add(vInfOut, moonVelMps);

  // Earth-centered return orbit
  const r = magnitude(moonPosM);
  const v = magnitude(vOutEarth);
  const energy = (v * v) / 2 - EARTH_MU_M3_S2 / r;

  if (energy >= 0) {
    return { returnPerigeeM: Infinity, valid: false, periluneAltM: targetPeriluneM };
  }

  const a = -EARTH_MU_M3_S2 / (2 * energy);
  const hVec = cross(moonPosM, vOutEarth);
  const h = magnitude(hVec);
  const p = (h * h) / EARTH_MU_M3_S2;
  const eSq = Math.max(0, 1 - p / a);
  const e = Math.sqrt(eSq);
  const perigeeM = a * (1 - e);

  const perigeeAltM = perigeeM - EARTH_RADIUS_M;
  // Earth-bound return screening: checks if spacecraft remains gravitationally bound (energy < 0)
  // and returns to Earth vicinity (perigee < 60,000 km, where midcourse correction trims to 120 km entry)
  const valid = perigeeAltM >= 0 && perigeeAltM <= 60_000_000;

  return { returnPerigeeM: perigeeM, valid, periluneAltM: targetPeriluneM };
}

// ── Trajectory Generation (Apollo-Style Figure-8 Free-Return Geometry) ───────

function generateLunarTrajectory(
  departurePos: Vec3,
  moonPos: Vec3,
  moonVelMps: Vec3,
  targetPeriluneAltM: number,
  flightTimeS: number,
  departureDate: Date,
  returnValid: boolean
): { trajectory: TrajectoryPoint[]; perilunePosM: Vec3 } {
  const trajectory: TrajectoryPoint[] = [];
  const N_OUTBOUND = 90;
  const N_FLYBY = 50;
  const N_RETURN = 90;

  const moonDistM = magnitude(moonPos);
  const uRad = normalize(moonPos);
  let uTan = normalize(moonVelMps);
  // Ensure uTan is strictly orthogonal to uRad in orbital plane
  const radTanDot = dot(uRad, uTan);
  uTan = normalize(sub(uTan, scale(uRad, radTanDot)));

  // Safe visual clearance: at least 1500 km or user specified
  const effectivePeriluneAltM = Math.max(targetPeriluneAltM, 1_500_000);
  const periluneR = MOON_RADIUS_M + effectivePeriluneAltM; // ~3,237 km

  // Key flyby waypoints in Moon local frame
  // Entry: leading edge + inside orbit
  const flybyEntry = add(
    moonPos,
    add(scale(uRad, -periluneR * 2.5), scale(uTan, periluneR * 4.0))
  );

  // Perilune: directly behind the far side (+uRad)
  const perilunePos = add(moonPos, scale(uRad, periluneR * 1.35));

  // Exit: trailing edge + inside orbit directed towards Earth
  const flybyExit = add(
    moonPos,
    add(scale(uRad, -periluneR * 2.5), scale(uTan, -periluneR * 4.0))
  );

  // Earth atmospheric reentry interface (120 km) on return side
  const reentryR = EARTH_RADIUS_M + 120_000;
  const depNorm = normalize(departurePos);
  const reentryPos = scale(
    normalize(
      vec3(
        -depNorm.x * 0.85 + uTan.x * 0.25,
        -depNorm.y * 0.85 + uTan.y * 0.25,
        -depNorm.z * 0.5
      )
    ),
    reentryR
  );

  // ── 1. Outbound TLI Arc (Earth Parking Orbit -> Flyby Entry) ───────────
  const midOutR = (magnitude(departurePos) + moonDistM) * 0.52;
  const midOutDir = normalize(add(depNorm, uRad));
  const outCtrl = scale(midOutDir, midOutR * 1.12);

  for (let i = 0; i <= N_OUTBOUND; i++) {
    const t = i / N_OUTBOUND;
    const timeS = t * (flightTimeS * 0.90);
    const timestamp = new Date(departureDate.getTime() + timeS * 1000);

    const mt = 1 - t;
    const pos: Vec3 = {
      x: mt * mt * departurePos.x + 2 * mt * t * outCtrl.x + t * t * flybyEntry.x,
      y: mt * mt * departurePos.y + 2 * mt * t * outCtrl.y + t * t * flybyEntry.y,
      z: mt * mt * departurePos.z + 2 * mt * t * outCtrl.z + t * t * flybyEntry.z,
    };

    let phase: TrajectoryPoint["phase"];
    if (t < 0.06) phase = "tli";
    else phase = "outbound";

    trajectory.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(magnitude(pos) - EARTH_RADIUS_M),
      phase,
    });
  }

  // ── 2. Smooth Lunar Flyby Loop (Continuous Hyperbolic Retrograde Arc) ──
  for (let i = 1; i <= N_FLYBY; i++) {
    const t = i / N_FLYBY;
    // Parameter theta from -PI/2 (entry) through 0 (far-side perilune) to +PI/2 (exit)
    const theta = (t - 0.5) * Math.PI; // -pi/2 to +pi/2
    const cosTh = Math.cos(theta); // 0 at ends, 1 at perilune
    const sinTh = Math.sin(theta); // -1 at entry, +1 at exit

    // Radial distance from Moon center along the hyperbolic turn
    const rM = periluneR * (1.35 - 0.15 * cosTh + 1.2 * sinTh * sinTh);

    const dirX = cosTh;
    const dirY = -sinTh;

    const pos = add(moonPos, add(scale(uRad, rM * dirX), scale(uTan, rM * dirY)));
    const timeS = flightTimeS * (0.90 + t * 0.20);
    const timestamp = new Date(departureDate.getTime() + timeS * 1000);

    trajectory.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(magnitude(pos) - EARTH_RADIUS_M),
      phase: "lunar_flyby",
    });
  }

  // ── 3. Earth Free-Return Arc (Flyby Exit -> Atmospheric Entry) ─────────
  const midRetR = (magnitude(reentryPos) + moonDistM) * 0.50;
  const midRetDir = normalize(add(normalize(reentryPos), uRad));
  const retCtrl = scale(midRetDir, midRetR * 0.95);

  const retFlightTimeS = flightTimeS * 0.95;
  for (let i = 1; i <= N_RETURN; i++) {
    const t = i / N_RETURN;
    const timeS = flightTimeS * 1.10 + t * retFlightTimeS;
    const timestamp = new Date(departureDate.getTime() + timeS * 1000);

    const mt = 1 - t;
    const pos: Vec3 = {
      x: mt * mt * flybyExit.x + 2 * mt * t * retCtrl.x + t * t * reentryPos.x,
      y: mt * mt * flybyExit.y + 2 * mt * t * retCtrl.y + t * t * reentryPos.y,
      z: mt * mt * flybyExit.z + 2 * mt * t * retCtrl.z + t * t * reentryPos.z,
    };

    let phase: TrajectoryPoint["phase"];
    if (t > 0.94) phase = "reentry_interface";
    else phase = "return";

    trajectory.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(magnitude(pos) - EARTH_RADIUS_M),
      phase,
    });
  }

  return { trajectory, perilunePosM: perilunePos };
}

// ── Main Planner ──────────────────────────────────────────────────────────────

export function planLunarFreeReturn(
  input: LunarFreeReturnInput
): MissionAnalysisResult {
  const candidates: TransferCandidate[] = [];

  // Vehicle total delta-v budget
  const availableDeltaV = tsiolkovskyDeltaVMps(
    input.vehicle.specificImpulseS,
    input.vehicle.wetMassKg,
    input.vehicle.dryMassKg,
    input.payloadMassKg
  );

  const vParkOrbit = parkingOrbitSpeedMps(input.parkingOrbitAltitudeKm);
  const departureBase = new Date(input.departureDateUtc);
  const searchWindowS = hoursToSeconds(input.searchWindowHours);
  const stepS = hoursToSeconds(Math.max(6, input.departureStepHours));
  const minTofS = hoursToSeconds(input.minFlightTimeHours);
  const maxTofS = hoursToSeconds(input.maxFlightTimeHours);
  const tofStepS = hoursToSeconds(Math.max(6, input.flightTimeStepHours));
  const targetPeriluneM = kmToM(input.targetPeriluneAltitudeKm);

  // ── Grid search ─────────────────────────────────────────────────────────
  for (let depOffsetS = 0; depOffsetS <= searchWindowS; depOffsetS += stepS) {
    const depDate = new Date(departureBase.getTime() + depOffsetS * 1000);

    for (let tofS = minTofS; tofS <= maxTofS; tofS += tofStepS) {
      const arrDate = new Date(depDate.getTime() + tofS * 1000);

      // Moon ephemeris position & velocity at arrival
      const moonPosM = getMoonPositionEciM(arrDate);
      const moonVelMps = getMoonVelocityEciMps(arrDate);

      // Compute optimal departure position in orbital transfer plane
      const depPosM = computeDeparturePosition(
        input.parkingOrbitAltitudeKm,
        moonPosM,
        moonVelMps,
        input.departureSite
      );

      // Solve Lambert boundary value problem
      const lambert = solveLambert(depPosM, moonPosM, tofS, EARTH_MU_M3_S2, true);

      if (!lambert.converged) continue;

      // Tangential TLI burn delta-V from circular parking orbit
      const v1Mag = magnitude(lambert.v1);
      const deltaVTli = Math.max(0, v1Mag - vParkOrbit);

      // Total mission delta-v budget requirement
      const totalDeltaV =
        deltaVTli +
        MIDCOURSE_CORRECTION_ESTIMATE_MPS +
        RETURN_CORRECTION_ESTIMATE_MPS;

      // Arrival v∞ relative to Moon
      const vInfArr = magnitude(sub(lambert.v2, moonVelMps));

      // Level 2: Patched-conic return screening
      const returnResult = screenReturn(
        lambert.v2,
        moonPosM,
        moonVelMps,
        targetPeriluneM
      );

      candidates.push({
        departureUtc: depDate.toISOString(),
        arrivalUtc: arrDate.toISOString(),
        flightTimeHours: secondsToHours(tofS),
        deltaVTliMps: deltaVTli,
        arrivalVInfMps: vInfArr,
        depPosM,
        moonPosM,
        moonVelMps,
        departureVelMps: lambert.v1,
        arrivalVelMps: lambert.v2,
        periluneAltitudeKm: input.targetPeriluneAltitudeKm,
        returnPerigeeM: returnResult.returnPerigeeM,
        returnValid: returnResult.valid,
        totalDeltaVMps: totalDeltaV,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      missionType: "lunar_free_return",
      generatedAtUtc: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      candidates: [],
      globalWarnings: [
        "No feasible candidate found under the selected simplified model.",
        "Try adjusting the flight time range (e.g. 60–120 hrs) or widening the search window.",
      ],
    };
  }

  // ── Build Candidates (Fuel Saver, Fastest, Return Margin) ──────────────
  const validCandidates = candidates.filter((c) => c.returnValid);
  const pool = validCandidates.length > 0 ? validCandidates : candidates;

  const sortedByDv = [...pool].sort((a, b) => a.totalDeltaVMps - b.totalDeltaVMps);
  const sortedByTime = [...pool].sort((a, b) => a.flightTimeHours - b.flightTimeHours);
  const sortedByMargin = [...pool].sort(
    (a, b) => (availableDeltaV - a.totalDeltaVMps) - (availableDeltaV - b.totalDeltaVMps)
  ).reverse();

  const seen = new Set<string>();
  const picks: { tc: TransferCandidate; label: string }[] = [];

  function pickBest(sorted: TransferCandidate[], label: string) {
    for (const tc of sorted) {
      const key = `${tc.departureUtc}_${tc.flightTimeHours}`;
      if (!seen.has(key)) {
        seen.add(key);
        picks.push({ tc, label });
        return;
      }
    }
  }

  pickBest(sortedByDv, "Fuel Saver");
  pickBest(sortedByTime, "Fastest Feasible");
  pickBest(sortedByMargin, "Return Margin");

  // Fallback if picks is less than 3
  if (picks.length < 3 && candidates.length > picks.length) {
    for (const tc of candidates) {
      const key = `${tc.departureUtc}_${tc.flightTimeHours}`;
      if (!seen.has(key)) {
        seen.add(key);
        picks.push({ tc, label: `Candidate ${picks.length + 1}` });
        if (picks.length >= 3) break;
      }
    }
  }

  const missionCandidates: MissionCandidate[] = picks.map(({ tc, label }, idx) => {
    const { trajectory, perilunePosM } = generateLunarTrajectory(
      tc.depPosM,
      tc.moonPosM,
      tc.moonVelMps,
      targetPeriluneM,
      hoursToSeconds(tc.flightTimeHours),
      new Date(tc.departureUtc),
      tc.returnValid
    );

    const margin = availableDeltaV - tc.totalDeltaVMps;
    let feasibility: FeasibilityStatus;
    if (margin >= 500) feasibility = "feasible";
    else if (margin >= 0) feasibility = "marginal";
    else feasibility = "infeasible";

    const { level: risk } = assessRisk(
      feasibility,
      margin,
      [],
      tc.returnValid,
      tc.periluneAltitudeKm,
      input.targetPeriluneAltitudeKm
    );

    const warnings: string[] = [];
    if (!tc.returnValid) {
      warnings.push(
        "Direct free-return corridor not achieved in simplified model. Labeled as Lunar Transfer Explorer."
      );
    }

    const events: MissionEvent[] = [
      {
        type: "tli_burn",
        timestampUtc: tc.departureUtc,
        label: "TLI Injection Burn",
        positionEciKm: {
          x: mToKm(tc.depPosM.x),
          y: mToKm(tc.depPosM.y),
          z: mToKm(tc.depPosM.z),
        },
      },
      {
        type: "lunar_closest_approach",
        timestampUtc: tc.arrivalUtc,
        label: "Lunar Flyby (Perilune)",
        positionEciKm: {
          x: mToKm(perilunePosM.x),
          y: mToKm(perilunePosM.y),
          z: mToKm(perilunePosM.z),
        },
      },
    ];

    const lastPoint = trajectory[trajectory.length - 1];
    if (lastPoint) {
      events.push({
        type: "earth_return_interface",
        timestampUtc: lastPoint.timestampUtc,
        label: "Earth Return Interface",
        positionEciKm: lastPoint.positionEciKm,
      });
    }

    const totalDurationHours = tc.flightTimeHours * 1.95; // Full figure-8 roundtrip

    const candidateRaw: MissionCandidate = {
      id: `lunar-${idx + 1}`,
      label: tc.returnValid ? label : `${label} (Explorer)`,
      objectiveScore: feasibility === "feasible" ? 1 : feasibility === "marginal" ? 0.5 : 0,
      feasibility,
      risk,
      warnings,
      trajectory,
      events,
      deltaV: {
        availableMps: Math.round(availableDeltaV),
        requiredMps: Math.round(tc.totalDeltaVMps),
        marginMps: Math.round(margin),
        components: [
          { label: "TLI Burn (from 200 km LEO)", valueMps: Math.round(tc.deltaVTliMps) },
          { label: "Mid-course correction (est.)", valueMps: MIDCOURSE_CORRECTION_ESTIMATE_MPS },
          { label: "Return correction (est.)", valueMps: RETURN_CORRECTION_ESTIMATE_MPS },
        ],
      },
      departureUtc: tc.departureUtc,
      closestMoonApproachUtc: tc.arrivalUtc,
      returnEarthUtc: lastPoint ? lastPoint.timestampUtc : undefined,
      durationHours: totalDurationHours,
      periluneAltitudeKm: tc.periluneAltitudeKm,
      arrivalVInfinityMps: Math.round(tc.arrivalVInfMps),
      assumptions: [
        "Universal-variables Lambert problem transfer solver (Level 1).",
        "Patched-conic hyperbolic flyby return screening (Level 2).",
        `TLI burn calculated tangentially from circular parking orbit at ${input.parkingOrbitAltitudeKm} km.`,
        `Mid-course correction: ${MIDCOURSE_CORRECTION_ESTIMATE_MPS} m/s, Return correction: ${RETURN_CORRECTION_ESTIMATE_MPS} m/s.`,
        "Time-dependent Moon position from astronomy-engine (JPL-calibrated).",
        "Simplified physics model — requires high-fidelity verification for operational use.",
      ],
    };

    return enforceTrajectoryValidation(candidateRaw, "lunar_free_return");
  });

  const nonInfeasibleCandidates = missionCandidates.filter((c) => c.feasibility !== "infeasible");

  return {
    missionType: "lunar_free_return",
    generatedAtUtc: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    candidates: missionCandidates,
    recommendedCandidateId: selectRecommended(missionCandidates, input.objective),
    globalWarnings: nonInfeasibleCandidates.length === 0 ? ["No valid renderable candidate found under the selected simplified model."] : [],
  };
}
