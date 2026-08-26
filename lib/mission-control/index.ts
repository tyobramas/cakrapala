/**
 * AI Mission Control — Module Barrel Exports.
 */

// Types
export * from "./types";

// Constants
export * from "./constants";

// Utilities & Transforms
export * from "./units";
export * from "./vector3";
export * from "./formatters";
export * from "./coordinateTransforms";
export * from "./trajectoryValidation";

// Presets & Default Scenarios
export {
  LAUNCH_SITES,
  VEHICLE_PRESETS,
  getLaunchSiteById,
  getVehicleById,
  getDefaultSatelliteScenario,
  getDefaultLunarScenario,
  getFutureDemonstrationDate,
} from "./vehiclePresets";

// Ephemeris
export {
  getMoonPositionEciM,
  getMoonPositionEciKm,
  getMoonVelocityEciMps,
  getMoonDistanceM,
  getSunPositionEciM,
} from "./ephemeris";

// Physics & Solvers
export {
  circularOrbitalSpeedMps,
  tsiolkovskyDeltaVMps,
  earthRotationAssistMps,
} from "./satelliteLaunchPlanner";
export { solveLambert } from "./lambertSolver";

// Planners
export { planSatelliteLaunch } from "./satelliteLaunchPlanner";
export { planLunarFreeReturn } from "./lunarFreeReturnPlanner";

// Analysis & AI Copilot
export { rankCandidates, selectRecommended } from "./candidateRanking";
export { assessRisk } from "./riskAssessment";
export { generateDeterministicMissionAnalysis } from "./aiMissionAnalysis";
