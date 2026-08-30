/**
 * AI Mission Control — Planner A: Satellite Launch Orbit.
 *
 * Simulates a SIMPLIFIED ascent from an Earth launch site to a target
 * circular orbit. Evaluates whether vehicle delta-v capability is sufficient.
 *
 * DISCLAIMER: Simplified gravity-turn and delta-v feasibility model.
 * Visualized simplified ascent — not 6-DOF launch guidance.
 *
 * Formulas implemented:
 *   A. Circular orbital speed:  v = √(μ/r)
 *   B. Tsiolkovsky equation:    Δv = Isp · g₀ · ln(m₀/mf)
 *   C. Launch azimuth:          sin(A) = cos(i) / cos(φ)
 *   D. Rotation assist:         v_rot = ω · R · cos(φ) · sin(A)
 *   E. Hohmann orbit raising:   Δv₁ = v_p − v₁ , Δv₂ = v₂ − v_a
 *   F. Plane change:            Δv = 2 · v · sin(Δi/2)
 *   G. Delta-v budget:          Δv_req = v_park + Δv_hohmann + losses
 *                                        + Δv_plane − v_rot
 *   H. Parametric 3D gravity-turn ascent path, ECI-placed via GMST
 */

import type {
  SatelliteLaunchInput,
  MissionCandidate,
  MissionAnalysisResult,
  TrajectoryPoint,
  MissionEvent,
  DeltaVBudget,
  Vec3,
} from "./types";
import {
  G0_MPS2,
  EARTH_MU_M3_S2,
  EARTH_RADIUS_M,
  EARTH_ROTATION_RATE_RAD_S,
  FEASIBILITY_MARGIN_FEASIBLE_MPS,
  MODEL_VERSION,
} from "./constants";
import { kmToM, mToKm, degToRad, validatePositiveFinite, validateRange } from "./units";
import { vec3, normalize, scale, add, sub, rotateAroundAxis, cross, magnitude } from "./vector3";
import { assessRisk } from "./riskAssessment";
import { enforceTrajectoryValidation } from "./trajectoryValidation";
import {
  REFERENCE_PARKING_ALTITUDE_KM,
  hohmannTransfer,
  solveLaunchAzimuth,
  rotationAssistMps,
  planeChangeDeltaVMps,
  gravityLossMps,
  dragLossMps,
  steeringLossMps,
  launchSiteEciM,
} from "./ascentModel";

import { vehicleDeltaVMps } from "./stagingModel";

// ── Core Physics ──────────────────────────────────────────────────────────────

/**
 * Circular orbital speed at radius r (m) around Earth.
 * v = √(μ/r)
 */
export function circularOrbitalSpeedMps(radiusM: number): number {
  validatePositiveFinite(radiusM, "orbital radius");
  return Math.sqrt(EARTH_MU_M3_S2 / radiusM);
}

/**
 * Vehicle delta-v capability via Tsiolkovsky rocket equation.
 * Δv = Isp · g₀ · ln(m₀ / mf)
 *
 * m₀ = wet mass (total vehicle mass incl. propellant + payload)
 * mf = dry mass + payload (everything except propellant)
 */
export function tsiolkovskyDeltaVMps(
  ispS: number,
  wetMassKg: number,
  dryMassKg: number,
  payloadMassKg: number
): number {
  validatePositiveFinite(ispS, "Isp");
  validatePositiveFinite(wetMassKg, "wet mass");
  validatePositiveFinite(dryMassKg, "dry mass");
  if (payloadMassKg < 0) {
    throw new RangeError(`Payload mass must be >= 0, got ${payloadMassKg}`);
  }

  const m0 = wetMassKg;
  const mf = dryMassKg + payloadMassKg;

  if (mf >= m0) {
    return 0; // No propellant available
  }

  return ispS * G0_MPS2 * Math.log(m0 / mf);
}

/**
 * Maximum Earth rotation assist at a given latitude (due-east launch).
 * v_rot = ω · R · cos(φ)
 *
 * NOTE: retained for backward compatibility and reference. The delta-v budget
 * uses the azimuth-aware `rotationAssistMps()` from ascentModel instead, which
 * correctly reduces the assist for polar and retrograde launches.
 */
export function earthRotationAssistMps(latitudeDeg: number): number {
  const latRad = degToRad(latitudeDeg);
  return EARTH_ROTATION_RATE_RAD_S * EARTH_RADIUS_M * Math.cos(latRad);
}

// ── Delta-V Budget ────────────────────────────────────────────────────────────

interface DeltaVBreakdown {
  parkingAltitudeKm: number;
  vCircularMps: number;
  hohmannMps: number;
  hohmannBurn1Mps: number;
  hohmannBurn2Mps: number;
  gravityLossMps: number;
  dragLossMps: number;
  steeringLossMps: number;
  inclinationPenaltyMps: number;
  rotationAssistMps: number;
  azimuthDeg: number;
  totalRequiredMps: number;
  availableMps: number;
  marginMps: number;
  notes: string[];
}

function computeDeltaVBudget(input: SatelliteLaunchInput): DeltaVBreakdown {
  const notes: string[] = [];
  const lat = input.launchSite.latitudeDeg;

  // Ascent delivers to a low parking orbit; anything higher is reached by a
  // Hohmann transfer rather than by an (incorrectly cheaper) direct insertion.
  const parkingAltKm = Math.min(
    input.targetAltitudeKm,
    REFERENCE_PARKING_ALTITUDE_KM
  );
  const parkingRadiusM = EARTH_RADIUS_M + kmToM(parkingAltKm);
  const targetRadiusM = EARTH_RADIUS_M + kmToM(input.targetAltitudeKm);

  const vCirc = circularOrbitalSpeedMps(parkingRadiusM);
  const vCircTarget = circularOrbitalSpeedMps(targetRadiusM);

  // ── Orbit raising ───────────────────────────────────────────────────────
  const hohmann = hohmannTransfer(parkingRadiusM, targetRadiusM);
  if (hohmann.totalMps > 0) {
    notes.push(
      `Orbit raising ${Math.round(parkingAltKm)} → ${Math.round(
        input.targetAltitudeKm
      )} km via Hohmann transfer (${Math.round(
        hohmann.burn1Mps
      )} + ${Math.round(hohmann.burn2Mps)} m/s).`
    );
  }

  // ── Azimuth, rotation assist, plane change ──────────────────────────────
  const az = solveLaunchAzimuth(input.targetInclinationDeg, lat);
  const vRotAssist = rotationAssistMps(lat, az.azimuthRad);

  let incPenalty = 0;
  if (!az.achievable) {
    // Plane change is cheapest at the largest radius — perform it at target.
    incPenalty = planeChangeDeltaVMps(vCircTarget, az.residualPlaneChangeDeg);
    notes.push(
      `Target inclination ${input.targetInclinationDeg}° is below site latitude ` +
      `${Math.abs(lat).toFixed(1)}°. Plane change of ` +
      `${az.residualPlaneChangeDeg.toFixed(1)}° required at target altitude.`
    );
  }

  if (vRotAssist < 0) {
    notes.push(
      "Retrograde/near-polar azimuth: Earth rotation acts as a penalty, not an assist."
    );
  }

  // ── Vehicle-dependent losses ────────────────────────────────────────────
  const gLoss = gravityLossMps(input.vehicle.wetMassKg, input.vehicle.thrustN);
  const dLoss = dragLossMps(input.vehicle.wetMassKg);
  const sLoss = steeringLossMps(az.azimuthRad);

  const totalRequired =
    vCirc + hohmann.totalMps + gLoss + dLoss + sLoss + incPenalty - vRotAssist;

  const available = vehicleDeltaVMps(input.vehicle, input.payloadMassKg);

  return {
    parkingAltitudeKm: parkingAltKm,
    vCircularMps: vCirc,
    hohmannMps: hohmann.totalMps,
    hohmannBurn1Mps: hohmann.burn1Mps,
    hohmannBurn2Mps: hohmann.burn2Mps,
    gravityLossMps: gLoss,
    dragLossMps: dLoss,
    steeringLossMps: sLoss,
    inclinationPenaltyMps: incPenalty,
    rotationAssistMps: vRotAssist,
    azimuthDeg: (az.azimuthRad * 180) / Math.PI,
    totalRequiredMps: totalRequired,
    availableMps: available,
    marginMps: available - totalRequired,
    notes,
  };
}

// ── 3D Ascent Path Generation ─────────────────────────────────────────────────

/**
 * Generate parametric 3D gravity-turn ascent path.
 *
 * Phases:
 * 1. Vertical ascent (0–5% of path)
 * 2. Pitch-over (5–15%)
 * 3. Gravity turn ascent (15–85%)
 * 4. Orbit insertion (85–100%)
 *
 * The launch site is placed in ECI using GMST, so the launch DATE rotates
 * the whole trajectory — previously the site was effectively fixed in ECEF.
 */
function generateAscentTrajectory(
  input: SatelliteLaunchInput,
  estimatedTimeToOrbitS: number
): { points: TrajectoryPoint[]; events: MissionEvent[] } {
  const N = 200; // number of points
  const points: TrajectoryPoint[] = [];
  const events: MissionEvent[] = [];

  const targetAltM = kmToM(input.targetAltitudeKm);
  const launchDate = new Date(input.launchDateUtc);

  // Launch position in ECI — rotated by GMST so launch date matters.
  const sitePos = launchSiteEciM(
    input.launchSite.latitudeDeg,
    input.launchSite.longitudeDeg,
    launchDate,
    input.launchSite.elevationM ?? 0
  );
  const launchPos = vec3(sitePos.x, sitePos.y, sitePos.z);

  // Radial direction (up from surface)
  const radialDir = normalize(launchPos);

  // East direction (for gravity turn)
  const northPole = vec3(0, 0, 1);
  let eastDir = normalize(cross(northPole, radialDir));
  if (magnitude(eastDir) < 0.001) {
    eastDir = vec3(0, 1, 0); // fallback at poles
  }

  // Launch azimuth from the shared ascent model (handles i < latitude).
  const azimuthRad = solveLaunchAzimuth(
    input.targetInclinationDeg,
    input.launchSite.latitudeDeg
  ).azimuthRad;

  // Downrange direction (rotated from north by azimuth)
  const northDir = normalize(cross(radialDir, eastDir));
  const downrangeDir = normalize(
    add(
      scale(northDir, Math.cos(azimuthRad)),
      scale(eastDir, Math.sin(azimuthRad))
    )
  );

  // Liftoff event
  events.push({
    type: "liftoff",
    timestampUtc: launchDate.toISOString(),
    label: "Liftoff",
    positionEciKm: {
      x: mToKm(launchPos.x),
      y: mToKm(launchPos.y),
      z: mToKm(launchPos.z),
    },
  });

  for (let i = 0; i <= N; i++) {
    const t = i / N; // normalized time [0, 1]
    const timeS = t * estimatedTimeToOrbitS;
    const timestamp = new Date(launchDate.getTime() + timeS * 1000);

    // Altitude profile — smooth S-curve
    let altFraction: number;
    let pitchFromVertical: number; // 0 = vertical, π/2 = horizontal
    let phase: TrajectoryPoint["phase"];

    if (t < 0.15) {
      // Phase 1: Vertical ascent & initial pitch-over
      const pt = t / 0.15;
      altFraction = pt * 0.10;
      pitchFromVertical = pt * 0.4; // gradual tilt
      phase = "launch";

      if (i === Math.floor(0.10 * N)) {
        const pitchPos = add(launchPos, scale(radialDir, targetAltM * altFraction));
        events.push({
          type: "pitch_over",
          timestampUtc: timestamp.toISOString(),
          label: "Pitch-Over Maneuver",
          positionEciKm: {
            x: mToKm(pitchPos.x),
            y: mToKm(pitchPos.y),
            z: mToKm(pitchPos.z),
          },
        });
      }
    } else if (t < 0.85) {
      // Phase 3: Gravity turn — smooth acceleration to horizontal
      const gt = (t - 0.15) / 0.70;
      // Smooth easing for altitude
      altFraction = 0.10 + gt * gt * 0.80;
      pitchFromVertical = 0.4 + gt * (Math.PI / 2 - 0.4);
      phase = "ascent";
    } else {
      // Phase 4: Orbit insertion — nearly horizontal
      const ot = (t - 0.85) / 0.15;
      altFraction = 0.90 + ot * 0.10;
      pitchFromVertical = Math.PI / 2;
      phase = "parking_orbit";
    }

    const altitude = targetAltM * altFraction;
    const r = EARTH_RADIUS_M + altitude;

    // Position: blend from radial (vertical) to downrange (horizontal)
    const verticalComponent = scale(radialDir, r);
    const downrangeAngle = pitchFromVertical * t * 0.5; // angular displacement
    const pos = rotateAroundAxis(verticalComponent, cross(radialDir, downrangeDir), downrangeAngle);

    points.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: {
        x: mToKm(pos.x),
        y: mToKm(pos.y),
        z: mToKm(pos.z),
      },
      altitudeKm: mToKm(altitude),
      phase,
    });
  }

  // Orbit insertion event
  const lastPoint = points[points.length - 1];
  events.push({
    type: "orbit_insertion",
    timestampUtc: lastPoint.timestampUtc,
    label: "Orbit Insertion",
    positionEciKm: lastPoint.positionEciKm,
  });

  return { points, events };
}

/**
 * Generate target circular orbit ring (120 points) smoothly starting from insertion point.
 */
function generateOrbitRing(
  input: SatelliteLaunchInput,
  insertionPosEciM: Vec3,
  insertionDir: Vec3,
  startTime: Date
): TrajectoryPoint[] {
  const N = 120;
  const targetR = EARTH_RADIUS_M + kmToM(input.targetAltitudeKm);
  const points: TrajectoryPoint[] = [];

  // Orbital period: T = 2π √(r³ / μ)
  const period = 2 * Math.PI * Math.sqrt(Math.pow(targetR, 3) / EARTH_MU_M3_S2);

  // Normal to orbit plane = cross(r, v_tangent)
  let orbitNormal = normalize(cross(insertionPosEciM, insertionDir));
  if (magnitude(orbitNormal) < 0.001) {
    orbitNormal = vec3(0, 0, 1);
  }

  // Base insertion vector at target radius
  const r0 = scale(normalize(insertionPosEciM), targetR);

  for (let i = 0; i <= N; i++) {
    const angle = (i / N) * 2 * Math.PI;
    const timeS = (i / N) * period;
    const timestamp = new Date(startTime.getTime() + timeS * 1000);

    const pos = rotateAroundAxis(r0, orbitNormal, angle);

    points.push({
      timestampUtc: timestamp.toISOString(),
      positionEciKm: {
        x: mToKm(pos.x),
        y: mToKm(pos.y),
        z: mToKm(pos.z),
      },
      altitudeKm: input.targetAltitudeKm,
      phase: "parking_orbit",
    });
  }

  return points;
}

// ── Main Planner ──────────────────────────────────────────────────────────────

/**
 * Run Satellite Launch Orbit analysis.
 *
 * Validates inputs, computes delta-v budget, generates 3D trajectory,
 * assesses feasibility and risk.
 */
export function planSatelliteLaunch(
  input: SatelliteLaunchInput
): MissionAnalysisResult {
  // ── Input validation ────────────────────────────────────────────────────
  validateRange(input.targetAltitudeKm, 160, 2000, "Target altitude (km)");
  validateRange(input.targetInclinationDeg, 0, 98, "Target inclination (deg)");
  validatePositiveFinite(input.payloadMassKg, "Payload mass (kg)");

  const warnings: string[] = [];

  // Check payload capacity
  if (input.payloadMassKg > input.vehicle.payloadCapacityKg) {
    return {
      missionType: "satellite_launch",
      generatedAtUtc: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      candidates: [
        {
          id: "sat-overweight",
          label: "Overweight Payload",
          objectiveScore: 0,
          feasibility: "infeasible",
          risk: "high",
          warnings: [
            `Payload ${input.payloadMassKg} kg exceeds vehicle capacity ${input.vehicle.payloadCapacityKg} kg.`,
          ],
          trajectory: [],
          events: [],
          deltaV: {
            availableMps: 0,
            requiredMps: 0,
            marginMps: 0,
            components: [],
          },
          departureUtc: input.launchDateUtc,
          durationHours: 0,
          assumptions: [
            "Payload exceeds vehicle payload capacity. Mission cannot proceed.",
          ],
        },
      ],
      recommendedCandidateId: undefined,
      globalWarnings: [
        "Payload mass exceeds vehicle capacity. Select a larger vehicle or reduce payload.",
      ],
    };
  }

  // ── Compute delta-v budget ──────────────────────────────────────────────
  const budget = computeDeltaVBudget(input);

  // ── Determine feasibility ───────────────────────────────────────────────
  let feasibility: "feasible" | "marginal" | "infeasible";
  if (budget.marginMps >= FEASIBILITY_MARGIN_FEASIBLE_MPS) {
    feasibility = "feasible";
  } else if (budget.marginMps >= 0) {
    feasibility = "marginal";
    warnings.push(
      `Delta-v margin is only ${Math.round(budget.marginMps)} m/s. ` +
      `Less than ${FEASIBILITY_MARGIN_FEASIBLE_MPS} m/s recommended minimum.`
    );
  } else {
    feasibility = "infeasible";
    warnings.push(
      `Delta-v deficit of ${Math.round(Math.abs(budget.marginMps))} m/s. ` +
      `Vehicle lacks sufficient capability for this mission.`
    );
  }

  // ── Estimate time to orbit ──────────────────────────────────────────────
  // Ascent to parking orbit (~8–10 min) plus the Hohmann coast to target.
  const ascentS = 480 + (budget.parkingAltitudeKm / 2000) * 120;
  const coastS =
    budget.hohmannMps > 0
      ? hohmannTransfer(
        EARTH_RADIUS_M + kmToM(budget.parkingAltitudeKm),
        EARTH_RADIUS_M + kmToM(input.targetAltitudeKm)
      ).transferTimeS
      : 0;
  const estimatedTimeToOrbitS = ascentS + coastS;
  const durationHours = estimatedTimeToOrbitS / 3600;

  // ── Generate 3D trajectory ──────────────────────────────────────────────
  const { points: ascentPoints, events } = generateAscentTrajectory(
    input,
    estimatedTimeToOrbitS
  );

  // Orbit ring smoothly extending from insertion point
  const lastAscent = ascentPoints[ascentPoints.length - 1];
  const insertionPosM = vec3(
    kmToM(lastAscent.positionEciKm.x),
    kmToM(lastAscent.positionEciKm.y),
    kmToM(lastAscent.positionEciKm.z)
  );
  // Tangential insertion direction = difference between last two ascent points
  const prevAscent = ascentPoints[ascentPoints.length - 2] || lastAscent;
  const insertionDir = normalize(
    sub(
      vec3(kmToM(lastAscent.positionEciKm.x), kmToM(lastAscent.positionEciKm.y), kmToM(lastAscent.positionEciKm.z)),
      vec3(kmToM(prevAscent.positionEciKm.x), kmToM(prevAscent.positionEciKm.y), kmToM(prevAscent.positionEciKm.z))
    )
  );

  const orbitRing = generateOrbitRing(
    input,
    insertionPosM,
    insertionDir,
    new Date(
      new Date(input.launchDateUtc).getTime() + estimatedTimeToOrbitS * 1000
    )
  );

  // Combined trajectory
  const trajectory = [...ascentPoints, ...orbitRing];

  // ── Build delta-v budget for display ────────────────────────────────────
  const deltaV: DeltaVBudget = {
    availableMps: Math.round(budget.availableMps),
    requiredMps: Math.round(budget.totalRequiredMps),
    marginMps: Math.round(budget.marginMps),
    components: [
      {
        label: `Circular speed @ ${Math.round(budget.parkingAltitudeKm)} km parking`,
        valueMps: Math.round(budget.vCircularMps),
      },
      ...(budget.hohmannMps > 0
        ? [
          {
            label: `Hohmann raise to ${Math.round(input.targetAltitudeKm)} km`,
            valueMps: Math.round(budget.hohmannMps),
          },
        ]
        : []),
      { label: "Gravity loss (TWR-scaled)", valueMps: Math.round(budget.gravityLossMps) },
      { label: "Drag loss (mass-scaled)", valueMps: Math.round(budget.dragLossMps) },
      { label: "Steering loss (dogleg)", valueMps: Math.round(budget.steeringLossMps) },
      ...(budget.inclinationPenaltyMps > 0
        ? [
          {
            label: "Plane change penalty",
            valueMps: Math.round(budget.inclinationPenaltyMps),
          },
        ]
        : []),
      {
        label:
          budget.rotationAssistMps >= 0
            ? `Earth rotation assist (az ${budget.azimuthDeg.toFixed(0)}°)`
            : `Earth rotation penalty (az ${budget.azimuthDeg.toFixed(0)}°)`,
        valueMps: -Math.round(budget.rotationAssistMps),
      },
    ],
  };

  // ── Risk assessment ─────────────────────────────────────────────────────
  const { level: riskLevel, reasons } = assessRisk(
    feasibility,
    budget.marginMps,
    warnings
  );
  if (reasons.length > 0) {
    warnings.push(...reasons.map((r) => r.message));
  }

  // ── Build candidate ─────────────────────────────────────────────────────
  const candidate: MissionCandidate = {
    id: "sat-primary",
    label: "Satellite Launch Orbit",
    objectiveScore: feasibility === "feasible" ? 1 : feasibility === "marginal" ? 0.5 : 0,
    feasibility,
    risk: riskLevel,
    warnings,
    trajectory,
    events,
    deltaV,
    departureUtc: input.launchDateUtc,
    durationHours,
    assumptions: [
      "Simplified gravity-turn and delta-v feasibility model.",
      "Visualized simplified ascent — not 6-DOF launch guidance.",
      `Ascent targets a ${Math.round(budget.parkingAltitudeKm)} km parking orbit; ` +
      "higher targets add a two-impulse Hohmann transfer.",
      `Gravity loss ${Math.round(budget.gravityLossMps)} m/s, scaled by liftoff ` +
      "thrust-to-weight ratio (bounded 1,000–2,400 m/s).",
      `Drag loss ${Math.round(budget.dragLossMps)} m/s, scaled by vehicle wet mass ` +
      "as a ballistic-coefficient proxy (bounded 120–320 m/s).",
      `Launch azimuth ${budget.azimuthDeg.toFixed(1)}° from sin(A) = cos(i)/cos(φ); ` +
      "rotation assist scaled by sin(A).",
      "Launch site placed in ECI via GMST — launch date rotates the trajectory.",
      "Single-body Earth gravity model (no J2 perturbation).",
      "Simplified physics model — requires high-fidelity verification for operational use.",
      ...budget.notes,
    ],
  };

  // ── Strict Trajectory Validation Layer ──────────────────────────────────
  const validatedCandidate = enforceTrajectoryValidation(candidate, "satellite_launch");

  return {
    missionType: "satellite_launch",
    generatedAtUtc: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    candidates: [validatedCandidate],
    recommendedCandidateId: validatedCandidate.feasibility !== "infeasible" ? validatedCandidate.id : undefined,
    globalWarnings: validatedCandidate.feasibility === "infeasible" && validatedCandidate.warnings.length > 0 ? [validatedCandidate.warnings[0]] : [],
  };
}
