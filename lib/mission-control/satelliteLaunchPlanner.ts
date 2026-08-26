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
 *   B. Tsiolkovsky equation:   Δv = Isp · g₀ · ln(m₀/mf)
 *   C. Earth rotation assist:  v_rot = ω · R · cos(φ)
 *   D. Delta-v budget:         Δv_req = v_circ + losses - v_rot
 *   E. Parametric 3D gravity-turn ascent path
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
  DEFAULT_GRAVITY_LOSS_MPS,
  DEFAULT_DRAG_LOSS_MPS,
  DEFAULT_STEERING_LOSS_MPS,
  FEASIBILITY_MARGIN_FEASIBLE_MPS,
  MODEL_VERSION,
} from "./constants";
import { kmToM, mToKm, degToRad, validatePositiveFinite, validateRange } from "./units";
import { vec3, normalize, scale, add, sub, rotateAroundAxis, cross, magnitude } from "./vector3";
import { assessRisk } from "./riskAssessment";
import { formatDurationHours } from "./formatters";
import { enforceTrajectoryValidation } from "./trajectoryValidation";

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
 * Earth rotation assist at a given latitude.
 * v_rot = ω · R · cos(φ)
 *
 * For eastward launch, this is subtracted from required delta-v.
 */
export function earthRotationAssistMps(latitudeDeg: number): number {
  const latRad = degToRad(latitudeDeg);
  return EARTH_ROTATION_RATE_RAD_S * EARTH_RADIUS_M * Math.cos(latRad);
}

/**
 * Estimate inclination penalty delta-v.
 * Simplified: if target inclination < launch latitude, a plane change is needed.
 * Uses approximation: Δv_plane ≈ 2 · v_circ · sin(Δi/2) but capped conservatively.
 */
function inclinationPenaltyMps(
  targetIncDeg: number,
  launchLatDeg: number,
  vCircMps: number
): number {
  const minInclination = Math.abs(launchLatDeg);

  if (targetIncDeg >= minInclination) {
    return 0; // No penalty: inclination is achievable directly
  }

  // Plane change needed — expensive
  const deltaIDeg = minInclination - targetIncDeg;
  const deltaIRad = degToRad(deltaIDeg);
  return 2 * vCircMps * Math.sin(deltaIRad / 2);
}

// ── Delta-V Budget ────────────────────────────────────────────────────────────

interface DeltaVBreakdown {
  vCircularMps: number;
  gravityLossMps: number;
  dragLossMps: number;
  steeringLossMps: number;
  inclinationPenaltyMps: number;
  rotationAssistMps: number;
  totalRequiredMps: number;
  availableMps: number;
  marginMps: number;
}

function computeDeltaVBudget(input: SatelliteLaunchInput): DeltaVBreakdown {
  const targetRadiusM = EARTH_RADIUS_M + kmToM(input.targetAltitudeKm);
  const vCirc = circularOrbitalSpeedMps(targetRadiusM);
  const vRotAssist = earthRotationAssistMps(input.launchSite.latitudeDeg);
  const incPenalty = inclinationPenaltyMps(
    input.targetInclinationDeg,
    input.launchSite.latitudeDeg,
    vCirc
  );

  const totalRequired =
    vCirc +
    DEFAULT_GRAVITY_LOSS_MPS +
    DEFAULT_DRAG_LOSS_MPS +
    DEFAULT_STEERING_LOSS_MPS +
    incPenalty -
    vRotAssist;

  const available = tsiolkovskyDeltaVMps(
    input.vehicle.specificImpulseS,
    input.vehicle.wetMassKg,
    input.vehicle.dryMassKg,
    input.payloadMassKg
  );

  return {
    vCircularMps: vCirc,
    gravityLossMps: DEFAULT_GRAVITY_LOSS_MPS,
    dragLossMps: DEFAULT_DRAG_LOSS_MPS,
    steeringLossMps: DEFAULT_STEERING_LOSS_MPS,
    inclinationPenaltyMps: incPenalty,
    rotationAssistMps: vRotAssist,
    totalRequiredMps: totalRequired,
    availableMps: available,
    marginMps: available - totalRequired,
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
 * Uses smooth easing and realistic altitude profile.
 */
function generateAscentTrajectory(
  input: SatelliteLaunchInput,
  estimatedTimeToOrbitS: number
): { points: TrajectoryPoint[]; events: MissionEvent[] } {
  const N = 200; // number of points
  const points: TrajectoryPoint[] = [];
  const events: MissionEvent[] = [];

  const launchLatRad = degToRad(input.launchSite.latitudeDeg);
  const launchLonRad = degToRad(input.launchSite.longitudeDeg);
  const targetAltM = kmToM(input.targetAltitudeKm);
  const incRad = degToRad(input.targetInclinationDeg);

  // Launch position on Earth surface (ECI at launch time)
  const launchR = EARTH_RADIUS_M;
  const launchPos = vec3(
    launchR * Math.cos(launchLatRad) * Math.cos(launchLonRad),
    launchR * Math.cos(launchLatRad) * Math.sin(launchLonRad),
    launchR * Math.sin(launchLatRad)
  );

  // Radial direction (up from surface)
  const radialDir = normalize(launchPos);

  // East direction (for gravity turn)
  const northPole = vec3(0, 0, 1);
  let eastDir = normalize(cross(northPole, radialDir));
  if (magnitude(eastDir) < 0.001) {
    eastDir = vec3(0, 1, 0); // fallback at poles
  }

  // Launch azimuth direction (accounting for inclination)
  // sin(azimuth) = cos(i) / cos(lat)
  const cosLat = Math.cos(launchLatRad);
  let azimuthRad = Math.PI / 2; // default due east
  if (cosLat > 0.001) {
    const sinAz = Math.min(1, Math.max(-1, Math.cos(incRad) / cosLat));
    azimuthRad = Math.asin(sinAz);
  }

  // Downrange direction (rotated from north by azimuth)
  const northDir = normalize(cross(radialDir, eastDir));
  const downrangeDir = normalize(
    add(
      scale(northDir, Math.cos(azimuthRad)),
      scale(eastDir, Math.sin(azimuthRad))
    )
  );

  const launchDate = new Date(input.launchDateUtc);

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

    if (t < 0.05) {
      // Phase 1: Vertical ascent
      altFraction = t / 0.05 * 0.02; // slow altitude gain
      pitchFromVertical = 0;
      phase = "launch";
    } else if (t < 0.15) {
      // Phase 2: Pitch-over
      const pt = (t - 0.05) / 0.10;
      altFraction = 0.02 + pt * 0.08;
      pitchFromVertical = pt * 0.4; // gradual tilt
      phase = "ascent";

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
  // Simplified: ~8–10 min for LEO
  const estimatedTimeToOrbitS = 480 + (input.targetAltitudeKm / 2000) * 120;
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
      { label: "Circular orbit speed", valueMps: Math.round(budget.vCircularMps) },
      { label: "Gravity loss (est.)", valueMps: budget.gravityLossMps },
      { label: "Drag loss (est.)", valueMps: budget.dragLossMps },
      { label: "Steering loss (est.)", valueMps: budget.steeringLossMps },
      ...(budget.inclinationPenaltyMps > 0
        ? [{ label: "Inclination penalty (est.)", valueMps: Math.round(budget.inclinationPenaltyMps) }]
        : []),
      { label: "Earth rotation assist", valueMps: -Math.round(budget.rotationAssistMps) },
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
      `Gravity loss: ${DEFAULT_GRAVITY_LOSS_MPS} m/s (range 1,200–1,800 m/s).`,
      `Drag loss: ${DEFAULT_DRAG_LOSS_MPS} m/s (range 100–300 m/s).`,
      `Steering loss: ${DEFAULT_STEERING_LOSS_MPS} m/s.`,
      "Single-body Earth gravity model (no J2 perturbation).",
      "Simplified physics model — requires high-fidelity verification for operational use.",
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
