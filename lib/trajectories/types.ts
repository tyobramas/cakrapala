/**
 * Types & Constants for Cakrapala Orbital Trajectory & Flight Path Planner
 */

export type MissionProfileId =
  | "leo_iss"
  | "gto_geo"
  | "trans_lunar"
  | "polar_sso"
  | "molniya"
  | "mars_transfer";

export interface LaunchSite {
  id: string;
  name: string;
  country: string;
  latitude: number; // degrees
  longitude: number; // degrees
  elevationM: number;
  description: string;
}

export interface LaunchVehicle {
  id: string;
  name: string;
  agency: string;
  stages: number;
  maxPayloadLeoKg: number;
  maxPayloadGtoKg: number;
  maxPayloadTliKg: number;
  stage1Isp: number; // seconds
  stage2Isp: number; // seconds
  thrustKn: number;
  dryMassKg: number;
  fuelMassKg: number;
  costMillionUsd: number;
}

export interface KeplerianElements {
  semiMajorAxisKm: number; // a
  eccentricity: number; // e (0 = circular, 0 < e < 1 = elliptical, e >= 1 = hyperbolic)
  inclinationDeg: number; // i
  raanDeg: number; // Right Ascension of Ascending Node (Omega)
  argPerigeeDeg: number; // Argument of Perigee (omega)
  trueAnomalyDeg: number; // True Anomaly (nu)
  periodMinutes: number; // T
  perigeeAltKm: number;
  apogeeAltKm: number;
  orbitalVelocityKmS: number;
}

export interface ManeuverBurn {
  id: string;
  name: string;
  phase: string;
  timeFromLiftoffSec: number;
  deltaVMS: number;
  durationSec: number;
  fuelConsumedKg: number;
  description: string;
  direction: "PROGRADE" | "RETROGRADE" | "NORMAL" | "RADIAL";
}

export interface TrajectoryPoint3D {
  x: number;
  y: number;
  z: number;
  timeSec: number;
  altitudeKm: number;
  velocityKmS: number;
  phase: "LAUNCH_ASCENT" | "PARKING_ORBIT" | "TRANSFER_BURN" | "COAST" | "TARGET_INSERTION" | "LUNAR_FLYBY" | "CIRCULARIZATION";
}

export interface FlightTelemetryState {
  missionTimeSec: number;
  formattedTime: string; // T+00:00:00
  phase: string;
  phaseCode: string;
  altitudeKm: number;
  velocityKmS: number;
  machNumber: number;
  dynamicPressureKPa: number; // Max-Q metric
  gForce: number;
  downrangeKm: number;
  propellantRemainingPercent: number;
  deltaVExpendedMS: number;
  deltaVRemainingMS: number;
  orbitProgressPercent: number;
  spacecraftPosition: [number, number, number];
}

export interface AiOptimizationResult {
  missionId: MissionProfileId;
  feasible: boolean;
  successProbabilityPercent: number;
  totalDeltaVRequiredMS: number;
  deltaVBreakdown: {
    ascentOrbitalMS: number;
    atmosphericDragLossMS: number;
    gravityLossMS: number;
    steeringLossMS: number;
    transferBurn1MS: number;
    transferBurn2MS: number;
    marginMS: number;
  };
  launchAzimuthDeg: number;
  launchWindowUtc: string;
  optimalPayloadKg: number;
  payloadCapacityMarginPercent: number;
  timeOfFlightFormatted: string;
  timeOfFlightHours: number;
  propellantUtilizationPercent: number;
  aiFlightDirectorAnalysis: string;
  recommendations: string[];
  riskFactors: { name: string; level: "LOW" | "MODERATE" | "HIGH"; description: string }[];
}

export interface MissionPreset {
  id: MissionProfileId;
  name: string;
  code: string;
  badge: string;
  badgeColor: string;
  summary: string;
  targetOrbitType: string;
  defaultVehicleId: string;
  defaultLaunchSiteId: string;
  targetPerigeeKm: number;
  targetApogeeKm: number;
  targetInclinationDeg: number;
  defaultPayloadKg: number;
  transferType: "DIRECT" | "HOHMANN" | "BI_ELLIPTIC" | "FREE_RETURN_3BODY" | "HELIOCENTRIC";
}
