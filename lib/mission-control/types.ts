/**
 * AI Mission Control — Core Type Definitions.
 *
 * All interfaces and types for the mission-control physics engine and UI.
 * Strict TypeScript — no `any` on primary state/result data.
 */

// ── Mission Classification ────────────────────────────────────────────────────

export type MissionType = "satellite_launch" | "lunar_free_return";

export type OptimizationObjective =
  | "minimum_delta_v"
  | "fastest_feasible"
  | "maximum_return_margin";

export type FeasibilityStatus =
  | "feasible"
  | "marginal"
  | "infeasible"
  | "no_solution";

export type RiskLevel = "low" | "medium" | "high";

// ── Launch Infrastructure ─────────────────────────────────────────────────────

export interface LaunchSite {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationM?: number;
}

export interface StagePreset {
  name: string;
  /** Fuelled mass of this stage alone, excluding stages above and payload (kg). */
  grossMassKg: number;
  /** Inert mass of this stage after propellant depletion (kg). */
  dryMassKg: number;
  /** Vacuum specific impulse (s). */
  ispVacuumS: number;
  /** Sea-level specific impulse (s). Define only for atmospheric first stages. */
  ispSeaLevelS?: number;
  /** Vacuum thrust (N). Display only. */
  thrustVacuumN?: number;
}

export interface VehiclePreset {
  id: string;
  name: string;
  wetMassKg: number;
  dryMassKg: number;
  payloadCapacityKg: number;
  propellantMassKg: number;
  specificImpulseS: number;
  thrustN?: number;
  notes?: string;
  /** Ordered first-fired to last-fired. When present, staged delta-v is used. */
  stages?: StagePreset[];
}


export interface VehiclePreset {
  id: string;
  name: string;
  wetMassKg: number;
  dryMassKg: number;
  payloadCapacityKg: number;
  propellantMassKg: number;
  specificImpulseS: number;
  thrustN?: number;
  notes?: string;
}

// ── Mission Inputs ────────────────────────────────────────────────────────────

export interface SatelliteLaunchInput {
  missionType: "satellite_launch";
  launchDateUtc: string;
  launchSite: LaunchSite;
  vehicle: VehiclePreset;
  payloadMassKg: number;
  targetAltitudeKm: number;
  targetInclinationDeg: number;
  objective: OptimizationObjective;
}

export interface LunarFreeReturnInput {
  missionType: "lunar_free_return";
  departureDateUtc: string;
  departureSite?: LaunchSite;
  searchWindowHours: number;
  departureStepHours: number;
  parkingOrbitAltitudeKm: number;
  vehicle: VehiclePreset;
  payloadMassKg: number;
  minFlightTimeHours: number;
  maxFlightTimeHours: number;
  flightTimeStepHours: number;
  targetPeriluneAltitudeKm: number;
  objective: OptimizationObjective;
}

export type MissionInput = SatelliteLaunchInput | LunarFreeReturnInput;

// ── Trajectory Data ───────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type TrajectoryPhase =
  | "launch"
  | "ascent"
  | "parking_orbit"
  | "tli"
  | "outbound"
  | "lunar_flyby"
  | "return"
  | "reentry_interface";

export interface TrajectoryPoint {
  timestampUtc: string;
  positionEciKm: Vec3;
  velocityEciKmS?: Vec3;
  latitudeDeg?: number;
  longitudeDeg?: number;
  altitudeKm?: number;
  phase: TrajectoryPhase;
}

export type MissionEventType =
  | "liftoff"
  | "pitch_over"
  | "orbit_insertion"
  | "tli_burn"
  | "lunar_closest_approach"
  | "earth_return_interface";

export interface MissionEvent {
  type: MissionEventType;
  timestampUtc: string;
  label: string;
  positionEciKm: Vec3;
}

// ── Delta-V Budget ────────────────────────────────────────────────────────────

export interface DeltaVComponent {
  label: string;
  valueMps: number;
}

export interface DeltaVBudget {
  availableMps: number;
  requiredMps: number;
  marginMps: number;
  components: DeltaVComponent[];
}

// ── Mission Candidate ─────────────────────────────────────────────────────────

export interface MissionCandidate {
  id: string;
  label: string;
  objectiveScore: number;
  feasibility: FeasibilityStatus;
  risk: RiskLevel;
  warnings: string[];
  trajectory: TrajectoryPoint[];
  events: MissionEvent[];
  deltaV: DeltaVBudget;
  departureUtc: string;
  closestMoonApproachUtc?: string;
  returnEarthUtc?: string;
  durationHours: number;
  periluneAltitudeKm?: number;
  arrivalVInfinityMps?: number;
  assumptions: string[];
  /** Moon ECI position (km) at the exact time of perilune — from lunar ephemeris. */
  moonPositionAtPeriluneKm?: Vec3;
}

// ── Analysis Result ───────────────────────────────────────────────────────────

export interface MissionAnalysisResult {
  missionType: MissionType;
  generatedAtUtc: string;
  modelVersion: string;
  candidates: MissionCandidate[];
  recommendedCandidateId?: string;
  globalWarnings: string[];
}

// ── Risk Assessment ───────────────────────────────────────────────────────────

export interface RiskReason {
  code: string;
  level: RiskLevel;
  message: string;
}

// ── AI Copilot Contracts ──────────────────────────────────────────────────────

export interface CopilotMissionDraft {
  missionType: MissionType;
  inputPatch: Partial<SatelliteLaunchInput | LunarFreeReturnInput>;
  assumptions: string[];
  missingRequiredFields: string[];
  clarificationQuestion?: string;
}

export interface CopilotWhatIf {
  label: string;
  patch: Record<string, unknown>;
}

export interface CopilotExplanation {
  summary: string;
  reasons: string[];
  risks: string[];
  suggestedWhatIfs: CopilotWhatIf[];
  disclaimer: string;
}

// ── Trajectory Validation ─────────────────────────────────────────────────────

export interface TrajectoryValidationResult {
  valid: boolean;
  renderable: boolean;
  pointCount: number;
  orbitRingPointCount: number;
  invalidPointCount: number;
  reasonCodes: string[];
  warnings: string[];
  boundingRadiusKm?: number;
}

// ── AI Mission Post-Analysis ──────────────────────────────────────────────────

export interface MissionPostAnalysis {
  headline: string;
  missionStatus: FeasibilityStatus;
  summary: string;
  routeExplanation: string[];
  keyEvents: Array<{
    label: string;
    timestampUtc: string;
    description: string;
  }>;
  feasibilityExplanation: string[];
  riskExplanation: string[];
  recommendedActions: string[];
  comparisonNotes: string[];
  modelLimitations: string[];
  generatedBy: "ai" | "deterministic";
}

