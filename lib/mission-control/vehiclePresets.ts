/**
 * AI Mission Control — Vehicle & Launch Site Presets.
 *
 * Stage masses are taken from published figures for real launch vehicles so
 * that delta-v is DERIVED, not tuned. Aggregate wetMassKg / dryMassKg /
 * propellantMassKg are the sums of the stage stack and exist only for display
 * and for the single-stage fallback path.
 *
 * Sources: manufacturer press kits and NASA Saturn V flight manuals. Values
 * are rounded and treated as representative of a CLASS of launcher, not as
 * flight-certified data for any specific vehicle.
 */

import type { LaunchSite, StagePreset, VehiclePreset, OptimizationObjective } from "./types";

// ── Launch Sites ──────────────────────────────────────────────────────────────

export const LAUNCH_SITES: LaunchSite[] = [
  {
    id: "equatorial",
    name: "Equatorial Demonstration Site",
    latitudeDeg: 0,
    longitudeDeg: 0,
    elevationM: 0,
  },
  {
    id: "kennedy",
    name: "Kennedy-like Site (Florida)",
    latitudeDeg: 28.6,
    longitudeDeg: -80.6,
    elevationM: 3,
  },
  {
    id: "tanegashima",
    name: "Tanegashima-like Site (Japan)",
    latitudeDeg: 30.4,
    longitudeDeg: 131.0,
    elevationM: 20,
  },
  {
    id: "custom",
    name: "Custom Location",
    latitudeDeg: 0,
    longitudeDeg: 0,
    elevationM: 0,
  },
];

// ── Stage stacks ──────────────────────────────────────────────────────────────

/** Electron-class three-stage small launcher. */
const SMALL_STAGES: StagePreset[] = [
  {
    name: "Stage 1 — 9 × Rutherford",
    grossMassKg: 10_200,
    dryMassKg: 950,
    ispVacuumS: 311,
    ispSeaLevelS: 303,
    thrustVacuumN: 224_000,
  },
  {
    name: "Stage 2 — Rutherford Vacuum",
    grossMassKg: 2_300,
    dryMassKg: 250,
    ispVacuumS: 343,
    thrustVacuumN: 25_800,
  },
  {
    name: "Kick Stage — Curie",
    grossMassKg: 240,
    dryMassKg: 40,
    ispVacuumS: 315,
    thrustVacuumN: 120,
  },
];

/** Falcon 9-class two-stage medium launcher, expendable configuration. */
const MEDIUM_STAGES: StagePreset[] = [
  {
    name: "Stage 1 — 9 × Merlin 1D",
    grossMassKg: 433_100,
    dryMassKg: 22_100,
    ispVacuumS: 312,
    ispSeaLevelS: 283,
    thrustVacuumN: 8_227_000,
  },
  {
    name: "Stage 2 — Merlin Vacuum",
    grossMassKg: 111_500,
    dryMassKg: 4_000,
    ispVacuumS: 348,
    thrustVacuumN: 981_000,
  },
];

/** Saturn V-class three-stage heavy launcher, TLI configuration. */
const HEAVY_STAGES: StagePreset[] = [
  {
    name: "S-IC — 5 × F-1",
    grossMassKg: 2_290_000,
    dryMassKg: 130_000,
    ispVacuumS: 304,
    ispSeaLevelS: 263,
    thrustVacuumN: 38_700_000,
  },
  {
    name: "S-II — 5 × J-2",
    grossMassKg: 480_000,
    dryMassKg: 36_000,
    ispVacuumS: 421,
    thrustVacuumN: 5_141_000,
  },
  {
    name: "S-IVB — 1 × J-2",
    grossMassKg: 120_800,
    dryMassKg: 13_500,
    ispVacuumS: 421,
    thrustVacuumN: 1_033_000,
  },
];

// ── Aggregate helpers ─────────────────────────────────────────────────────────

function sumGross(stages: StagePreset[]): number {
  return stages.reduce((a, s) => a + s.grossMassKg, 0);
}

function sumDry(stages: StagePreset[]): number {
  return stages.reduce((a, s) => a + s.dryMassKg, 0);
}

function sumPropellant(stages: StagePreset[]): number {
  return stages.reduce((a, s) => a + (s.grossMassKg - s.dryMassKg), 0);
}

// ── Vehicle Presets ───────────────────────────────────────────────────────────

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: "small",
    name: "Small Launch Vehicle",
    wetMassKg: sumGross(SMALL_STAGES),
    dryMassKg: sumDry(SMALL_STAGES),
    propellantMassKg: sumPropellant(SMALL_STAGES),
    payloadCapacityKg: 300,
    specificImpulseS: 311,
    thrustN: 192_000,
    stages: SMALL_STAGES,
    notes:
      "3-stage small launcher (Electron class). Staged delta-v is derived from " +
      "published stage masses — roughly 9,450 m/s at 300 kg payload.",
  },
  {
    id: "medium",
    name: "Medium Launch Vehicle",
    wetMassKg: sumGross(MEDIUM_STAGES),
    dryMassKg: sumDry(MEDIUM_STAGES),
    propellantMassKg: sumPropellant(MEDIUM_STAGES),
    payloadCapacityKg: 22_800,
    specificImpulseS: 348,
    thrustN: 7_607_000,
    stages: MEDIUM_STAGES,
    notes:
      "2-stage medium-lift launcher (Falcon 9 expendable class). Delta-v scales " +
      "strongly with payload: ~15,400 m/s at 120 kg, ~9,300 m/s at 22.8 t.",
  },
  {
    id: "heavy",
    name: "Heavy Launch Vehicle",
    wetMassKg: sumGross(HEAVY_STAGES),
    dryMassKg: sumDry(HEAVY_STAGES),
    propellantMassKg: sumPropellant(HEAVY_STAGES),
    payloadCapacityKg: 48_600,
    specificImpulseS: 421,
    thrustN: 35_100_000,
    stages: HEAVY_STAGES,
    notes:
      "3-stage heavy-lift launcher (Saturn V class). Staged model reproduces the " +
      "historical ~48.6 t trans-lunar injection capability without calibration.",
  },
];

// ── Default Demonstration Scenarios ───────────────────────────────────────────

export interface DefaultSatelliteScenario {
  missionType: "satellite_launch";
  launchSite: LaunchSite;
  vehicle: VehiclePreset;
  payloadMassKg: number;
  targetAltitudeKm: number;
  targetInclinationDeg: number;
  objective: OptimizationObjective;
  launchDateUtc: string;
}

export interface DefaultLunarScenario {
  missionType: "lunar_free_return";
  departureSite: LaunchSite;
  vehicle: VehiclePreset;
  payloadMassKg: number;
  parkingOrbitAltitudeKm: number;
  searchWindowHours: number;
  departureStepHours: number;
  minFlightTimeHours: number;
  maxFlightTimeHours: number;
  flightTimeStepHours: number;
  targetPeriluneAltitudeKm: number;
  objective: OptimizationObjective;
  departureDateUtc: string;
}

/** Generate a future ISO date string (+N days from now), midnight UTC. */
export function getFutureDemonstrationDate(daysAhead: number = 30): string {
  const d = new Date();
  // Use UTC methods so the result is always a clean UTC midnight/hour regardless
  // of the browser's local timezone (fixes the WIB +7 offset issue).
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(3, 0, 0, 0); // 03:00 UTC — a typical early-morning TLI window
  return d.toISOString().slice(0, 19) + "Z";
}

/**
 * Scenario A — Satellite Launch Orbit (Kennedy-like Site, Medium LV, 120 kg, 550 km, 28.6° inc)
 */
export function getDefaultSatelliteScenario(): DefaultSatelliteScenario {
  return {
    missionType: "satellite_launch",
    launchSite: LAUNCH_SITES[1],
    vehicle: VEHICLE_PRESETS[1],
    payloadMassKg: 120,
    targetAltitudeKm: 550,
    targetInclinationDeg: 28.6,
    objective: "fastest_feasible",
    launchDateUtc: getFutureDemonstrationDate(30),
  };
}

/**
 * Scenario B — Lunar Free Return (Kennedy-like Site, Heavy LV, 5000 kg, 200 km LEO, 72-168h flight)
 */
export function getDefaultLunarScenario(): DefaultLunarScenario {
  return {
    missionType: "lunar_free_return",
    departureSite: LAUNCH_SITES[1],
    vehicle: VEHICLE_PRESETS[2],
    payloadMassKg: 5000,
    parkingOrbitAltitudeKm: 200,
    searchWindowHours: 72,
    departureStepHours: 6,
    minFlightTimeHours: 72,
    maxFlightTimeHours: 168,
    flightTimeStepHours: 12,
    targetPeriluneAltitudeKm: 200,
    objective: "fastest_feasible",
    departureDateUtc: getFutureDemonstrationDate(30),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getLaunchSiteById(id: string): LaunchSite | undefined {
  return LAUNCH_SITES.find((s) => s.id === id);
}

export function getVehicleById(id: string): VehiclePreset | undefined {
  return VEHICLE_PRESETS.find((v) => v.id === id);
}
