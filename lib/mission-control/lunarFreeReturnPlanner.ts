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
  TrajectoryPoint,
  MissionEvent,
  Vec3,
  FeasibilityStatus,
} from "./types";
import {
  EARTH_MU_M3_S2,
  EARTH_RADIUS_M,
  MOON_RADIUS_M,
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
  vec3,
  magnitude,
  sub,
  scale,
  add,
  normalize,
  cross,
  dot,
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
} from "./ascentModel";
import {
  solveFreeReturnFlyby,
  transferPlaneNormal,
  moonDeclinationRad,
  type FlybySolution,
} from "./lunarTargeting";

import { vehicleDeltaVMps } from "./stagingModel";

// ── Local constants ───────────────────────────────────────────────────────────

/** Moon sphere-of-influence radius (m). Used to size the flyby coast time. */
const MOON_SOI_RADIUS_M = 66_100_000;

/** Transfer sweep angle from departure to Moon arrival (rad). ~162°. */
const TRANSFER_ANGLE_RAD = Math.PI * 0.90;

/** Minimum and maximum modelled SOI transit duration (s). */
const FLYBY_DURATION_MIN_S = 6 * 3600;
const FLYBY_DURATION_MAX_S = 48 * 3600;

/** Rendering-only perilune clearance so the flyby loop stays visible (m). */
const RENDER_PERILUNE_MIN_M = 1_500_000;

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

// ── Trajectory Generation (Apollo-style figure-8, rendering geometry) ─────────

function generateLunarTrajectory(
  departurePos: Vec3,
  moonPos: Vec3,
  moonVelMps: Vec3,
  truePeriluneAltM: number,
  outboundS: number,
  flybyS: number,
  returnS: number,
  departureDate: Date
): { trajectory: TrajectoryPoint[]; perilunePosM: Vec3 } {
  const trajectory: TrajectoryPoint[] = [];
  const N_OUTBOUND = 90;
  const N_FLYBY = 50;
  const N_RETURN = 90;

  const moonDistM = magnitude(moonPos);
  const uRad = normalize(moonPos);
  let uTan = normalize(moonVelMps);
  const radTanDot = dot(uRad, uTan);
  uTan = normalize(sub(uTan, scale(uRad, radTanDot)));

  // RENDERING ONLY: a true 200 km perilune is sub-pixel at Earth-Moon scale,
  // so the drawn loop is exaggerated. The reported periluneAltitudeKm remains
  // the solved physical value.
  const renderPeriluneAltM = Math.max(truePeriluneAltM, RENDER_PERILUNE_MIN_M);
  const periluneR = MOON_RADIUS_M + renderPeriluneAltM;

  const flybyEntry = add(
    moonPos,
    add(scale(uRad, -periluneR * 2.5), scale(uTan, periluneR * 4.0))
  );
  const perilunePos = add(moonPos, scale(uRad, periluneR * 1.35));
  const flybyExit = add(
    moonPos,
    add(scale(uRad, -periluneR * 2.5), scale(uTan, -periluneR * 4.0))
  );

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

  // ── 1. Outbound TLI arc ────────────────────────────────────────────────
  const midOutR = (magnitude(departurePos) + moonDistM) * 0.52;
  const midOutDir = normalize(add(depNorm, uRad));
  const outCtrl = scale(midOutDir, midOutR * 1.12);

  for (let i = 0; i <= N_OUTBOUND; i++) {
    const t = i / N_OUTBOUND;
    const timeS = t * outboundS;
    const timestamp = new Date(departureDate.getTime() + timeS * 1000);

    const mt = 1 - t;
    const pos: Vec3 = {
      x: mt * mt * departurePos.x + 2 * mt * t * outCtrl.x + t * t * flybyEntry.x,
      y: mt * mt * departurePos.y + 2 * mt * t * outCtrl.y + t * t * flybyEntry.y,
      z: mt * mt * departurePos.z + 2 * mt * t * outCtrl.z + t * t * flybyEntry.z,
    };

    trajectory.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(magnitude(pos) - EARTH_RADIUS_M),
      phase: t < 0.06 ? "tli" : "outbound",
    });
  }

  // ── 2. Lunar flyby loop ────────────────────────────────────────────────
  for (let i = 1; i <= N_FLYBY; i++) {
    const t = i / N_FLYBY;
    const theta = (t - 0.5) * Math.PI;
    const cosTh = Math.cos(theta);
    const sinTh = Math.sin(theta);

    const rM = periluneR * (1.35 - 0.15 * cosTh + 1.2 * sinTh * sinTh);
    const pos = add(
      moonPos,
      add(scale(uRad, rM * cosTh), scale(uTan, rM * -sinTh))
    );

    const timeS = outboundS + t * flybyS;
    const timestamp = new Date(departureDate.getTime() + timeS * 1000);

    trajectory.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(magnitude(pos) - EARTH_RADIUS_M),
      phase: "lunar_flyby",
    });
  }

  // ── 3. Earth return arc ────────────────────────────────────────────────
  const midRetR = (magnitude(reentryPos) + moonDistM) * 0.50;
  const midRetDir = normalize(add(normalize(reentryPos), uRad));
  const retCtrl = scale(midRetDir, midRetR * 0.95);

  for (let i = 1; i <= N_RETURN; i++) {
    const t = i / N_RETURN;
    const timeS = outboundS + flybyS + t * returnS;
    const timestamp = new Date(departureDate.getTime() + timeS * 1000);

    const mt = 1 - t;
    const pos: Vec3 = {
      x: mt * mt * flybyExit.x + 2 * mt * t * retCtrl.x + t * t * reentryPos.x,
      y: mt * mt * flybyExit.y + 2 * mt * t * retCtrl.y + t * t * reentryPos.y,
      z: mt * mt * flybyExit.z + 2 * mt * t * retCtrl.z + t * t * reentryPos.z,
    };

    trajectory.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: { x: mToKm(pos.x), y: mToKm(pos.y), z: mToKm(pos.z) },
      altitudeKm: mToKm(magnitude(pos) - EARTH_RADIUS_M),
      phase: t > 0.94 ? "reentry_interface" : "return",
    });
  }

  return { trajectory, perilunePosM: perilunePos };
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
    const flybyS = hoursToSeconds(tc.flybyDurationHours);
    const returnS = hoursToSeconds(tc.returnTimeHours);

    const { trajectory, perilunePosM } = generateLunarTrajectory(
      tc.depPosM,
      tc.moonPosM,
      tc.moonVelMps,
      tc.flyby.periluneAltitudeM,
      outboundS,
      flybyS,
      returnS,
      new Date(tc.departureUtc)
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
        `Return perigee solved to ${Math.round(tc.returnPerigeeAltitudeKm)} km, outside the ` +
        `${mToKm(REENTRY_CORRIDOR_MIN_M)}–${mToKm(REENTRY_CORRIDOR_MAX_M)} km reentry corridor. ` +
        `An estimated ${Math.round(tc.corridorTrimMps)} m/s trim burn is budgeted.`
      );
    }

    const periluneDeltaKm = tc.periluneAltitudeKm - input.targetPeriluneAltitudeKm;
    if (Math.abs(periluneDeltaKm) > 50) {
      warnings.push(
        `Solved perilune is ${Math.round(tc.periluneAltitudeKm)} km, not the requested ` +
        `${Math.round(input.targetPeriluneAltitudeKm)} km. Perilune is an OUTPUT of ` +
        `free-return targeting, not a free parameter.`
      );
    }

    const departureDate = new Date(tc.departureUtc);
    const flybyMidUtc = new Date(
      departureDate.getTime() + (outboundS + flybyS / 2) * 1000
    ).toISOString();

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
        timestampUtc: flybyMidUtc,
        label: `Perilune — ${Math.round(tc.periluneAltitudeKm)} km`,
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

    const totalDurationHours =
      tc.flightTimeHours + tc.flybyDurationHours + tc.returnTimeHours;

    const candidateRaw: MissionCandidate = {
      id: `lunar-${idx + 1}`,
      label: tc.returnValid ? label : `${label} (Explorer)`,
      objectiveScore:
        feasibility === "feasible" ? 1 : feasibility === "marginal" ? 0.5 : 0,
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
          {
            label: `Ascent to ${input.parkingOrbitAltitudeKm} km parking (i=${tc.parkingInclinationDeg.toFixed(1)}°)`,
            valueMps: Math.round(tc.ascent.totalMps),
          },
          { label: "TLI burn (vector)", valueMps: Math.round(tc.deltaVTliMps) },
          {
            label: "Mid-course correction (est.)",
            valueMps: MIDCOURSE_CORRECTION_ESTIMATE_MPS,
          },
          {
            label: tc.returnValid
              ? "Return correction (est.)"
              : "Corridor trim burn (est.)",
            valueMps: Math.round(tc.corridorTrimMps),
          },
        ],
      },
      departureUtc: tc.departureUtc,
      closestMoonApproachUtc: flybyMidUtc,
      returnEarthUtc: lastPoint ? lastPoint.timestampUtc : undefined,
      durationHours: totalDurationHours,
      periluneAltitudeKm: tc.periluneAltitudeKm,
      arrivalVInfinityMps: Math.round(tc.arrivalVInfMps),
      assumptions: [
        "Universal-variables Lambert transfer solver (Level 1).",
        "Two-parameter patched-conic free-return targeting: B-plane angle swept, " +
        "perilune radius bisected against the reentry corridor (Level 2).",
        `Perilune SOLVED at ${Math.round(tc.periluneAltitudeKm)} km; return perigee ` +
        `${Math.round(tc.returnPerigeeAltitudeKm)} km ` +
        `(corridor ${mToKm(REENTRY_CORRIDOR_MIN_M)}–${mToKm(REENTRY_CORRIDOR_MAX_M)} km).`,
        `Parking orbit inclination ${tc.parkingInclinationDeg.toFixed(1)}° = ` +
        `max(site latitude ${siteLatDeg.toFixed(1)}°, Moon declination ${tc.moonDeclinationDeg.toFixed(1)}°). ` +
        "Transfer plane built to contain the Moon, so no plane change is owed.",
        `Launch azimuth ${tc.ascent.azimuthDeg.toFixed(1)}°, rotation assist ` +
        `${Math.round(tc.ascent.rotationAssistMps)} m/s.`,
        "Delta-v is double-entry: pad-to-parking ascent AND in-space burns are both " +
        "charged against the same vehicle capability.",
        `Return coast ${tc.returnTimeHours.toFixed(1)} h from Kepler time-to-perigee; ` +
        `SOI transit ${tc.flybyDurationHours.toFixed(1)} h.`,
        `Moon distance at arrival ${Math.round(tc.moonDistanceKm).toLocaleString()} km ` +
        "from astronomy-engine (JPL-calibrated ephemeris).",
        "RENDERING NOTE: the drawn flyby loop exaggerates perilune clearance for " +
        "visibility. Reported perilune is the solved physical value.",
        "Bézier rendering geometry — the drawn path is not yet the propagated conic.",
        "Simplified physics model — requires high-fidelity verification for operational use.",
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
