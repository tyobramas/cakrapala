/**
 * AI Mission Control — Planner B: Lunar Free-Return Explorer.
 *
 * Level 1: Lambert grid search over departure × flight-time, with the
 *          transfer plane built to match an ACHIEVABLE parking orbit
 *          inclination rather than being forced into the Moon's orbit plane.
 * Level 2: Two-parameter patched-conic free-return targeting — B-plane angle
 *          swept, perilune radius bisected to place the return perigee inside
 *          the [80, 300] km reentry corridor.
 *
 * Delta-v accounting is double-entry: the pad-to-parking ascent and the
 * in-space burns are both charged against the same vehicle capability, so a
 * stack can no longer "reach the Moon for free" after ignoring the climb.
 */

import type {
  LaunchSite,
  VehiclePreset,
  LunarFreeReturnInput,
  MissionAnalysisResult,
  MissionCandidate,
  MissionEvent,
  TrajectoryPoint,
  Vec3,
  FeasibilityStatus,
} from "./types";
import {
  EARTH_MU_M3_S2,
  EARTH_RADIUS_M,
  MODEL_VERSION,
  MIDCOURSE_CORRECTION_ESTIMATE_MPS,
  RETURN_CORRECTION_ESTIMATE_MPS,
  REENTRY_CORRIDOR_MIN_M,
  REENTRY_CORRIDOR_MAX_M,
} from "./constants";
import {
  kmToM,
  mToKm,
  hoursToSeconds,
  secondsToHours,
  radToDeg,
  degToRad,
} from "./units";
import {
  magnitude,
  sub,
  add,
  dot,
  scale,
  normalize,
  cross,
  rotateAroundAxis,
} from "./vector3";
import { getMoonPositionEciM, getMoonVelocityEciMps } from "./ephemeris";
import { solveLambert } from "./lambertSolver";
import { assessRisk } from "./riskAssessment";
import { selectRecommended } from "./candidateRanking";
import { tsiolkovskyDeltaVMps, circularOrbitalSpeedMps } from "./satelliteLaunchPlanner";
import { enforceTrajectoryValidation } from "./trajectoryValidation";
import {
  solveLaunchAzimuth,
  rotationAssistMps,
  planeChangeDeltaVMps,
  gravityLossMps,
  dragLossMps,
  steeringLossMps,
  launchSiteEciM,
} from "./ascentModel";
import {
  solveFreeReturnFlyby,
  transferPlaneNormal,
  moonDeclinationRad,
  type FlybySolution,
} from "./lunarTargeting";

import { vehicleDeltaVMps } from "./stagingModel";
import { correctFreeReturn, type LunarPropagationResult } from "./lunarPropagator";

// ── Local constants ───────────────────────────────────────────────────────────

/** Moon sphere-of-influence radius (m). Used to size the flyby coast time. */
const MOON_SOI_RADIUS_M = 66_100_000;

/** Transfer sweep angle from departure to Moon arrival (rad). ~162°. */
const TRANSFER_ANGLE_RAD = Math.PI * 0.90;

/** Minimum and maximum modelled SOI transit duration (s). */
const FLYBY_DURATION_MIN_S = 6 * 3600;
const FLYBY_DURATION_MAX_S = 48 * 3600;



// ── Internal Types ────────────────────────────────────────────────────────────

interface AscentBudget {
  totalMps: number;
  vCircularMps: number;
  gravityLossMps: number;
  dragLossMps: number;
  steeringLossMps: number;
  planeChangeMps: number;
  rotationAssistMps: number;
  azimuthDeg: number;
  inclinationDeg: number;
}

interface TransferCandidate {
  departureUtc: string;
  arrivalUtc: string;
  flightTimeHours: number;
  parkingInclinationDeg: number;
  moonDeclinationDeg: number;
  moonDistanceKm: number;
  ascent: AscentBudget;
  deltaVTliMps: number;
  arrivalVInfMps: number;
  depPosM: Vec3;
  moonPosM: Vec3;
  moonVelMps: Vec3;
  departureVelMps: Vec3;
  parkingVelMps: Vec3;
  arrivalVelMps: Vec3;
  flyby: FlybySolution;
  periluneAltitudeKm: number;
  returnPerigeeAltitudeKm: number;
  returnTimeHours: number;
  flybyDurationHours: number;
  returnValid: boolean;
  corridorTrimMps: number;
  totalDeltaVMps: number;
}

// ── Ascent budget (shares the Milestone 1 ascent model) ───────────────────────

/**
 * Pad-to-parking-orbit delta-v, charged against the same vehicle budget as
 * the in-space burns. Previously omitted entirely, which let every lunar
 * mission report a false ~8,700 m/s surplus.
 */
function computeAscentToParking(
  site: LaunchSite | undefined,
  vehicle: VehiclePreset,
  parkingAltKm: number,
  desiredInclinationDeg: number
): AscentBudget {
  const lat = site?.latitudeDeg ?? 0;
  const vCirc = circularOrbitalSpeedMps(EARTH_RADIUS_M + kmToM(parkingAltKm));

  const az = solveLaunchAzimuth(desiredInclinationDeg, lat);
  const vRot = rotationAssistMps(lat, az.azimuthRad);
  const gLoss = gravityLossMps(vehicle.wetMassKg, vehicle.thrustN);
  const dLoss = dragLossMps(vehicle.wetMassKg);
  const sLoss = steeringLossMps(az.azimuthRad);

  // i_park is chosen as max(|lat|, |dec|), so this is normally zero. Retained
  // as a guard for custom sites where the caller overrides the inclination.
  const planeChange = az.achievable
    ? 0
    : planeChangeDeltaVMps(vCirc, az.residualPlaneChangeDeg);

  return {
    totalMps: vCirc + gLoss + dLoss + sLoss + planeChange - vRot,
    vCircularMps: vCirc,
    gravityLossMps: gLoss,
    dragLossMps: dLoss,
    steeringLossMps: sLoss,
    planeChangeMps: planeChange,
    rotationAssistMps: vRot,
    azimuthDeg: radToDeg(az.azimuthRad),
    inclinationDeg: desiredInclinationDeg,
  };
}

// ── Departure geometry ────────────────────────────────────────────────────────

/**
 * Departure point in the parking orbit, placed TRANSFER_ANGLE_RAD before the
 * Moon within a transfer plane of the given inclination.
 *
 * The launch site no longer supplies the position directly — it supplies the
 * minimum achievable inclination. This is the Apollo approach: the parking
 * orbit plane is chosen via launch azimuth so that it already contains the
 * Moon at arrival, so no plane change is owed.
 */
function computeDeparturePosition(
  parkingAltKm: number,
  moonPosM: Vec3,
  planeNormal: Vec3
): Vec3 {
  const rPark = EARTH_RADIUS_M + kmToM(parkingAltKm);
  const moonDir = normalize(moonPosM);
  const depDir = rotateAroundAxis(moonDir, planeNormal, -TRANSFER_ANGLE_RAD);
  return scale(depDir, rPark);
}

/**
 * Circular parking orbit velocity vector at the departure point, in the
 * transfer plane and prograde. Used for a VECTOR delta-v difference instead
 * of the previous scalar |v1| − v_park, which ignored flight path angle.
 */
function parkingVelocityVector(
  depPosM: Vec3,
  planeNormal: Vec3
): Vec3 {
  const speed = circularOrbitalSpeedMps(magnitude(depPosM));
  const dir = normalize(cross(planeNormal, depPosM));
  return scale(dir, speed);
}

/**
 * Assembles a continuous 3D mission trajectory:
 * 1. Launch pad on Earth's surface at selected site & date
 * 2. Ascent & Gravity Turn pitch-over into the transfer parking plane
 * 3. Forward prograde circular parking orbit coast to TLI injection
 * 4. TLI burn -> Translunar transfer -> Moon Perilune Flyby
 * 5. Inbound Earth free-return leg -> Atmospheric entry corridor -> Touchdown on Earth
 */
function assembleCompleteLunarTrajectory(
  input: LunarFreeReturnInput,
  tc: TransferCandidate,
  prop: LunarPropagationResult
): { trajectory: TrajectoryPoint[]; events: MissionEvent[] } {
  const points: TrajectoryPoint[] = [];
  const events: MissionEvent[] = [];

  const parkAltM = kmToM(input.parkingOrbitAltitudeKm);
  const rParkM = EARTH_RADIUS_M + parkAltM;
  const launchDate = new Date(tc.departureUtc);

  // 1. Launch site placement on Earth's surface in ECI from user inputs
  const site: LaunchSite = input.departureSite ?? {
    id: "kennedy",
    name: "Kennedy Space Center (Florida)",
    latitudeDeg: 28.6,
    longitudeDeg: -80.6,
    elevationM: 3,
  };
  const padM = launchSiteEciM(
    site.latitudeDeg,
    site.longitudeDeg,
    launchDate,
    site.elevationM ?? 0
  );
  const padPos = { x: padM.x, y: padM.y, z: padM.z };

  // Transfer orbit plane normal vector
  const planeNormal = transferPlaneNormal(
    tc.moonPosM,
    degToRad(tc.parkingInclinationDeg)
  ) ?? { x: 0, y: 0, z: 1 };

  // In-plane reference axes (u0 pointing towards launch site meridian, v0 prograde)
  const padDotNorm = dot(padPos, planeNormal);
  const inPlanePad = sub(padPos, scale(planeNormal, padDotNorm));
  const u0 = normalize(inPlanePad);
  const v0 = normalize(cross(planeNormal, u0));

  // TLI injection position in parking orbit
  const tliPosM = tc.depPosM;
  const tliDir = normalize(tliPosM);

  // Forward prograde angle from launch meridian to TLI around planeNormal
  const cosTheta = dot(u0, tliDir);
  const sinTheta = dot(cross(u0, tliDir), planeNormal);
  let totalAngleRad = Math.atan2(sinTheta, cosTheta);
  if (totalAngleRad < 0.30) totalAngleRad += 2 * Math.PI;

  // Ascent phase spans first ~18° downrange
  const ascentAngleRad = Math.min(degToRad(18), totalAngleRad * 0.25);
  const insertDir = normalize(
    add(scale(u0, Math.cos(ascentAngleRad)), scale(v0, Math.sin(ascentAngleRad)))
  );
  const insertPosM = scale(insertDir, rParkM);

  // Liftoff Event at Launch Pad
  events.push({
    type: "liftoff",
    timestampUtc: launchDate.toISOString(),
    label: `Liftoff (${site.name})`,
    positionEciKm: { x: mToKm(padPos.x), y: mToKm(padPos.y), z: mToKm(padPos.z) },
  });

  // 2. Ascent Arc (Smooth gravity turn climbing into transfer parking orbit)
  const ASCENT_STEPS = 40;
  const ascentDurationS = 540; // 9 minutes to orbit insertion

  for (let i = 0; i <= ASCENT_STEPS; i++) {
    const f = i / ASCENT_STEPS;
    const timeS = f * ascentDurationS;
    const timestamp = new Date(launchDate.getTime() + timeS * 1000).toISOString();

    const curAng = f * ascentAngleRad;
    const altM = parkAltM * (f < 0.15 ? (f / 0.15) * 0.08 : 0.08 + Math.pow((f - 0.15) / 0.85, 1.6) * 0.92);
    const curR = EARTH_RADIUS_M + altM;

    // Hermite smoothstep blending (ds/df = 0 at f=1 guarantees zero velocity kink at insertion)
    const s = f * f * (3 - 2 * f);
    const inPlaneDir = add(scale(u0, Math.cos(curAng)), scale(v0, Math.sin(curAng)));
    const curDir = normalize(add(scale(normalize(padPos), 1 - s), scale(inPlaneDir, s)));
    const pos = scale(curDir, curR);

    let phase: TrajectoryPoint["phase"] = "launch";
    if (f >= 0.15 && f < 0.85) phase = "ascent";
    else if (f >= 0.85) phase = "parking_orbit";

    if (i === Math.floor(0.15 * ASCENT_STEPS)) {
      events.push({
        type: "pitch_over",
        timestampUtc: timestamp,
        label: "Gravity Turn Pitch-Over",
        positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      });
    }

    points.push({
      timestampUtc: timestamp,
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(altM),
      phase,
    });
  }

  // Parking Orbit Insertion Event
  const insertTime = new Date(launchDate.getTime() + ascentDurationS * 1000).toISOString();
  events.push({
    type: "orbit_insertion",
    timestampUtc: insertTime,
    label: `Parking Orbit Insertion (${Math.round(input.parkingOrbitAltitudeKm)} km)`,
    positionEciKm: { x: mToKm(insertPosM.x), y: mToKm(insertPosM.y), z: mToKm(insertPosM.z) },
  });

  // 3. Prograde Circular Parking Orbit Coast from Insertion to TLI Injection
  const coastAngleRad = totalAngleRad - ascentAngleRad;
  const COAST_STEPS = 50;
  const vCirc = circularOrbitalSpeedMps(rParkM);
  const coastDurationS = (rParkM * coastAngleRad) / (vCirc || 7800);

  for (let j = 1; j <= COAST_STEPS; j++) {
    const f = j / COAST_STEPS;
    const curAngle = f * coastAngleRad;
    const pos = rotateAroundAxis(insertPosM, planeNormal, curAngle);
    const tStamp = new Date(
      launchDate.getTime() + (ascentDurationS + f * coastDurationS) * 1000
    ).toISOString();

    points.push({
      timestampUtc: tStamp,
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: input.parkingOrbitAltitudeKm,
      phase: "parking_orbit",
    });
  }

  // Append translunar, flyby, and return events from propagator
  for (const ev of prop.events) {
    events.push(ev);
  }

  // Append translunar, flyby, and return trajectory points
  for (const pt of prop.points) {
    points.push(pt);
  }

  // 4. Atmospheric Entry Descent & Landing Touchdown
  if (prop.points.length > 0) {
    const lastPt = prop.points[prop.points.length - 1];
    const lastPosM = {
      x: kmToM(lastPt.positionEciKm.x),
      y: kmToM(lastPt.positionEciKm.y),
      z: kmToM(lastPt.positionEciKm.z),
    };
    const lastVelMps = lastPt.velocityEciKmS
      ? {
        x: kmToM(lastPt.velocityEciKmS.x),
        y: kmToM(lastPt.velocityEciKmS.y),
        z: kmToM(lastPt.velocityEciKmS.z),
      }
      : scale(normalize(lastPosM), -11000);

    const entryAltM = Math.max(0, magnitude(lastPosM) - EARTH_RADIUS_M);
    const entryDir = normalize(lastVelMps);
    const DESCENT_STEPS = 20;
    const descentTimeS = 900; // ~15 minutes atmospheric descent
    const t0 = new Date(lastPt.timestampUtc).getTime();
    const descentAngleRad = degToRad(8); // smooth ~8° atmospheric glide

    const rDir = normalize(lastPosM);
    const descentNormal = normalize(cross(rDir, entryDir));

    for (let k = 1; k <= DESCENT_STEPS; k++) {
      const f = k / DESCENT_STEPS;
      const curAltM = entryAltM * (1 - Math.sin(f * (Math.PI / 2)));
      const curR = EARTH_RADIUS_M + curAltM;
      const curDir = rotateAroundAxis(rDir, descentNormal, f * descentAngleRad);
      const curPos = scale(curDir, curR);
      const timestamp = new Date(t0 + f * descentTimeS * 1000).toISOString();

      points.push({
        timestampUtc: timestamp,
        positionEciKm: { x: mToKm(curPos.x), y: mToKm(curPos.y), z: mToKm(curPos.z) },
        altitudeKm: mToKm(curAltM),
        phase: "reentry_interface",
      });
    }
  }

  return { trajectory: points, events };
}




// ── Main Planner ──────────────────────────────────────────────────────────────

export function planLunarFreeReturn(
  input: LunarFreeReturnInput
): MissionAnalysisResult {
  const candidates: TransferCandidate[] = [];

  const availableDeltaV = vehicleDeltaVMps(input.vehicle, input.payloadMassKg);


  const departureBase = new Date(input.departureDateUtc);
  const searchWindowS = hoursToSeconds(input.searchWindowHours);
  const stepS = hoursToSeconds(Math.max(6, input.departureStepHours));
  const minTofS = hoursToSeconds(input.minFlightTimeHours);
  const maxTofS = hoursToSeconds(input.maxFlightTimeHours);
  const tofStepS = hoursToSeconds(Math.max(6, input.flightTimeStepHours));

  const siteLatDeg = Math.abs(input.departureSite?.latitudeDeg ?? 0);

  // ── Grid search ─────────────────────────────────────────────────────────
  for (let depOffsetS = 0; depOffsetS <= searchWindowS; depOffsetS += stepS) {
    const depDate = new Date(departureBase.getTime() + depOffsetS * 1000);

    for (let tofS = minTofS; tofS <= maxTofS; tofS += tofStepS) {
      const arrDate = new Date(depDate.getTime() + tofS * 1000);

      const moonPosM = getMoonPositionEciM(arrDate);
      const moonVelMps = getMoonVelocityEciMps(arrDate);

      // Parking orbit inclination achievable from this site that still
      // contains the Moon: i_park = max(|latitude|, |declination|).
      const decDeg = Math.abs(radToDeg(moonDeclinationRad(moonPosM)));
      const iParkDeg = Math.max(siteLatDeg, decDeg);

      const planeNormal = transferPlaneNormal(moonPosM, degToRad(iParkDeg));
      if (!planeNormal) continue; // degenerate geometry — skip this epoch

      const depPosM = computeDeparturePosition(
        input.parkingOrbitAltitudeKm,
        moonPosM,
        planeNormal
      );

      const lambert = solveLambert(depPosM, moonPosM, tofS, EARTH_MU_M3_S2, true);
      if (!lambert.converged) continue;

      // Vector TLI delta-v — captures flight path angle, not just speed.
      const vPark = parkingVelocityVector(depPosM, planeNormal);
      const deltaVTli = magnitude(sub(lambert.v1, vPark));
      if (!Number.isFinite(deltaVTli)) continue;

      // Level 2 — solve perilune and B-plane for a corridor return.
      const flyby = solveFreeReturnFlyby(lambert.v2, moonPosM, moonVelMps);
      if (!flyby) continue;

      const ascent = computeAscentToParking(
        input.departureSite,
        input.vehicle,
        input.parkingOrbitAltitudeKm,
        iParkDeg
      );

      const corridorTrim = flyby.inCorridor
        ? RETURN_CORRECTION_ESTIMATE_MPS
        : Math.max(RETURN_CORRECTION_ESTIMATE_MPS, flyby.corridorTrimDeltaVMps);

      const totalDeltaV =
        ascent.totalMps +
        deltaVTli +
        MIDCOURSE_CORRECTION_ESTIMATE_MPS +
        corridorTrim;

      const flybyDurationS = Math.min(
        FLYBY_DURATION_MAX_S,
        Math.max(FLYBY_DURATION_MIN_S, (2 * MOON_SOI_RADIUS_M) / flyby.vInfinityMps)
      );

      const returnS = Number.isFinite(flyby.returnTimeS)
        ? flyby.returnTimeS
        : tofS; // fall back to a symmetric leg when unbound

      candidates.push({
        departureUtc: depDate.toISOString(),
        arrivalUtc: arrDate.toISOString(),
        flightTimeHours: secondsToHours(tofS),
        parkingInclinationDeg: iParkDeg,
        moonDeclinationDeg: decDeg,
        moonDistanceKm: mToKm(magnitude(moonPosM)),
        ascent,
        deltaVTliMps: deltaVTli,
        arrivalVInfMps: flyby.vInfinityMps,
        depPosM,
        moonPosM,
        moonVelMps,
        departureVelMps: lambert.v1,
        parkingVelMps: vPark,
        arrivalVelMps: lambert.v2,
        flyby,
        periluneAltitudeKm: mToKm(flyby.periluneAltitudeM),
        returnPerigeeAltitudeKm: mToKm(flyby.returnOrbit.perigeeAltitudeM),
        returnTimeHours: secondsToHours(returnS),
        flybyDurationHours: secondsToHours(flybyDurationS),
        returnValid: flyby.inCorridor,
        corridorTrimMps: corridorTrim,
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

  // ── Candidate selection ─────────────────────────────────────────────────
  const validCandidates = candidates.filter((c) => c.returnValid);
  const pool = validCandidates.length > 0 ? validCandidates : candidates;

  const sortedByDv = [...pool].sort((a, b) => a.totalDeltaVMps - b.totalDeltaVMps);
  const sortedByTime = [...pool].sort(
    (a, b) =>
      a.flightTimeHours + a.returnTimeHours - (b.flightTimeHours + b.returnTimeHours)
  );
  const sortedByCorridor = [...pool].sort(
    (a, b) => Math.abs(a.flyby.corridorMissM) - Math.abs(b.flyby.corridorMissM)
  );

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
  pickBest(sortedByCorridor, "Return Margin");

  if (picks.length < 3) {
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
    const outboundS = hoursToSeconds(tc.flightTimeHours);

    // Integration horizon. A free return is roughly symmetric, so three
    // outbound legs plus the SOI transit always contains the return perigee.
    // Derived from the flight-time grid the user asked for, never a fixed
    // calendar length.
    const maxDurationS = Math.min(
      20 * 86_400,
      outboundS * 3 + hoursToSeconds(tc.flybyDurationHours)
    );

    // Entry target is the centre of the corridor declared in constants.ts.
    const targetEntryAltM =
      (REENTRY_CORRIDOR_MIN_M + REENTRY_CORRIDOR_MAX_M) / 2;

    // Level 2: two-variable shooting on the departure velocity, closed by
    // direct integration. Perilune and return perigee are OUTPUTS.
    const correction = correctFreeReturn(
      tc.depPosM,
      tc.departureVelMps,
      tc.departureUtc,
      kmToM(input.targetPeriluneAltitudeKm),
      targetEntryAltM,
      maxDurationS
    );

    const prop = correction.propagation;
    const { trajectory, events } = assembleCompleteLunarTrajectory(input, tc, prop);


    // TLI is re-priced against the CORRECTED departure velocity, so the
    // aim-point correction is paid for inside the burn rather than bolted on
    // as a separate scalar (which would double-count).
    const tliMps = magnitude(sub(correction.departureVelMps, tc.parkingVelMps));

    const perigeeKm = prop.returnPerigeeAltitudeKm;
    const inCorridor =
      prop.returnFound &&
      perigeeKm >= mToKm(REENTRY_CORRIDOR_MIN_M) &&
      perigeeKm <= mToKm(REENTRY_CORRIDOR_MAX_M);

    const corridorTrimMps = inCorridor
      ? RETURN_CORRECTION_ESTIMATE_MPS
      : Math.max(RETURN_CORRECTION_ESTIMATE_MPS, tc.flyby.corridorTrimDeltaVMps);

    const requiredMps =
      tc.ascent.totalMps +
      tliMps +
      MIDCOURSE_CORRECTION_ESTIMATE_MPS +
      corridorTrimMps;

    const margin = availableDeltaV - requiredMps;
    let feasibility: FeasibilityStatus;
    if (margin >= 500) feasibility = "feasible";
    else if (margin >= 0) feasibility = "marginal";
    else feasibility = "infeasible";

    const warnings: string[] = [];

    if (prop.impactedMoon) {
      warnings.push(
        "Integrated path intersects the lunar surface — the corrector could not " +
        "reach a flyby from this departure state. This is not a free return."
      );
      feasibility = "infeasible";
    }

    if (!prop.returnFound) {
      warnings.push(
        `No Earth return perigee occurred within ` +
        `${(maxDurationS / 86_400).toFixed(1)} days of integration. The outbound ` +
        "arc is physical, the return leg is unresolved."
      );
    } else if (!inCorridor) {
      warnings.push(
        `Integrated return perigee ${Math.round(perigeeKm)} km lies outside the ` +
        `${mToKm(REENTRY_CORRIDOR_MIN_M)}–${mToKm(REENTRY_CORRIDOR_MAX_M)} km ` +
        `corridor (residual ${correction.perigeeResidualKm.toFixed(0)} km). ` +
        `A ${Math.round(corridorTrimMps)} m/s trim burn is budgeted.`
      );
    }

    if (!correction.converged) {
      warnings.push(
        `Free-return corrector stopped after ${correction.iterations} iterations ` +
        `without meeting both targets (perilune residual ` +
        `${correction.periluneResidualKm.toFixed(0)} km).`
      );
    }

    const periluneDeltaKm =
      prop.periluneAltitudeKm - input.targetPeriluneAltitudeKm;
    if (prop.returnFound && Math.abs(periluneDeltaKm) > 50) {
      warnings.push(
        `Integrated perilune is ${Math.round(prop.periluneAltitudeKm)} km against ` +
        `the requested ${Math.round(input.targetPeriluneAltitudeKm)} km ` +
        `(${periluneDeltaKm > 0 ? "+" : ""}${Math.round(periluneDeltaKm)} km).`
      );
    }

    const { level: risk } = assessRisk(
      feasibility,
      margin,
      [],
      inCorridor,
      prop.periluneAltitudeKm,
      input.targetPeriluneAltitudeKm
    );

    const candidateRaw: MissionCandidate = {
      id: `lunar-${idx + 1}`,
      label: inCorridor ? label : `${label} (Explorer)`,
      objectiveScore:
        feasibility === "feasible" ? 1 : feasibility === "marginal" ? 0.5 : 0,
      feasibility,
      risk,
      warnings,
      trajectory,
      events,
      deltaV: {
        availableMps: Math.round(availableDeltaV),
        requiredMps: Math.round(requiredMps),
        marginMps: Math.round(margin),
        components: [
          {
            label: `Ascent to ${input.parkingOrbitAltitudeKm} km parking (i=${tc.parkingInclinationDeg.toFixed(1)}°)`,
            valueMps: Math.round(tc.ascent.totalMps),
          },
          {
            label: "TLI burn (integrated, free-return corrected)",
            valueMps: Math.round(tliMps),
          },
          {
            label: "Mid-course navigation allowance (est.)",
            valueMps: MIDCOURSE_CORRECTION_ESTIMATE_MPS,
          },
          {
            label: inCorridor
              ? "Entry corridor control (est.)"
              : "Corridor trim burn (est.)",
            valueMps: Math.round(corridorTrimMps),
          },
        ],
      },
      departureUtc: tc.departureUtc,
      closestMoonApproachUtc: prop.periluneUtc,
      moonPositionAtPeriluneKm: (() => {
        const flybyTime = prop.periluneUtc ? new Date(prop.periluneUtc) : new Date(tc.arrivalUtc);
        const mM = getMoonPositionEciM(flybyTime);
        return { x: mM.x / 1000, y: mM.y / 1000, z: mM.z / 1000 };
      })(),
      returnEarthUtc: prop.returnFound ? prop.returnPerigeeUtc : undefined,
      durationHours: prop.durationHours,
      periluneAltitudeKm: prop.periluneAltitudeKm,
      arrivalVInfinityMps: Math.round(tc.arrivalVInfMps),
      assumptions: [
        "Universal-variables Lambert solver seeds the departure state (Level 1).",
        "Level 2 free-return targeting is a two-variable shooting method on the " +
        "departure velocity, closed by direct integration — perilune and return " +
        "perigee are integration outputs, not chosen parameters.",
        "Dynamics: Earth point mass plus the direct AND indirect lunar terms, " +
        "RK4 with step = 0.2% of the shortest local orbital period.",
        `Integrated ${prop.durationHours.toFixed(1)} h in ` +
        `${prop.steps.toLocaleString()} steps; apogee ` +
        `${Math.round(prop.maxGeocentricDistanceKm).toLocaleString()} km.`,
        `Corrector ${correction.converged ? "converged" : "did not converge"} in ` +
        `${correction.iterations} iterations; ` +
        `${Math.round(correction.correctionDeltaVMps)} m/s of aim-point correction ` +
        "is folded into the TLI vector.",
        `Perilune ${Math.round(prop.periluneAltitudeKm)} km (residual ` +
        `${correction.periluneResidualKm.toFixed(0)} km against the ` +
        `${Math.round(input.targetPeriluneAltitudeKm)} km request); return perigee ` +
        `${prop.returnFound ? Math.round(perigeeKm) + " km" : "not reached"} ` +
        `(corridor ${mToKm(REENTRY_CORRIDOR_MIN_M)}–${mToKm(REENTRY_CORRIDOR_MAX_M)} km).`,
        `Parking orbit inclination ${tc.parkingInclinationDeg.toFixed(1)}° = ` +
        `max(site latitude ${siteLatDeg.toFixed(1)}°, Moon declination ` +
        `${tc.moonDeclinationDeg.toFixed(1)}°); the transfer plane contains the ` +
        "Moon, so no plane change is owed.",
        `Launch azimuth ${tc.ascent.azimuthDeg.toFixed(1)}°, rotation assist ` +
        `${Math.round(tc.ascent.rotationAssistMps)} m/s.`,
        "Delta-v is double-entry: pad-to-parking ascent AND in-space burns are " +
        "charged against the same vehicle capability.",
        `Moon distance at nominal arrival ` +
        `${Math.round(tc.moonDistanceKm).toLocaleString()} km from astronomy-engine ` +
        "(JPL-calibrated), Hermite-interpolated on 1800 s nodes.",
        "The drawn path IS the integrated trajectory — no Bézier control points " +
        "and no exaggerated perilune clearance.",
        "Earth + Moon only: no solar gravity, no SRP, no non-spherical gravity. " +
        "Requires high-fidelity verification for operational use.",
      ],
    };

    return enforceTrajectoryValidation(candidateRaw, "lunar_free_return");
  });

  const nonInfeasible = missionCandidates.filter((c) => c.feasibility !== "infeasible");
  const corridorHits = candidates.filter((c) => c.returnValid).length;

  const globalWarnings: string[] = [];
  if (nonInfeasible.length === 0) {
    globalWarnings.push(
      "No candidate has sufficient delta-v once the pad-to-parking ascent is charged. " +
      "Reduce payload mass or select a vehicle with a higher effective mass ratio."
    );
  }
  if (corridorHits === 0) {
    globalWarnings.push(
      `No true free-return corridor found across ${candidates.length} transfers. ` +
      "Candidates are labelled Explorer and include an estimated trim burn."
    );
  }

  return {
    missionType: "lunar_free_return",
    generatedAtUtc: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    candidates: missionCandidates,
    recommendedCandidateId: selectRecommended(missionCandidates, input.objective),
    globalWarnings,
  };
}
