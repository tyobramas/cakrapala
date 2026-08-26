/**
 * AI Mission Control — Vehicle & Launch Site Presets.
 *
 * Multi-stage equivalent mass and performance values calibrated
 * for orbital and deep-space feasibility comparisons.
 *
 * Launch sites are approximate geographic locations for conceptual use.
 */

import type { LaunchSite, VehiclePreset, OptimizationObjective } from "./types";

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

// ── Vehicle Presets ───────────────────────────────────────────────────────────

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: "small",
    name: "Small Launch Vehicle",
    wetMassKg: 30_000,
    dryMassKg: 2_000,
    payloadCapacityKg: 500,
    propellantMassKg: 28_000,
    specificImpulseS: 335,
    thrustN: 400_000,
    notes:
      "2-stage small launcher equivalent (e.g. Electron class). " +
      "Delivers ~9,200 m/s delta-v for small payloads (100–300 kg).",
  },
  {
    id: "medium",
    name: "Medium Launch Vehicle",
    wetMassKg: 550_000,
    dryMassKg: 25_000,
    payloadCapacityKg: 8_000,
    propellantMassKg: 525_000,
    specificImpulseS: 345,
    thrustN: 7_600_000,
    notes:
      "2-stage medium-lift launcher equivalent (e.g. Falcon 9 class). " +
      "Delivers ~10,200 m/s delta-v for standard LEO orbital payloads (500–8,000 kg).",
  },
  {
    id: "heavy",
    name: "Heavy Launch Vehicle",
    wetMassKg: 2_900_000,
    dryMassKg: 120_000,
    payloadCapacityKg: 45_000,
    propellantMassKg: 2_780_000,
    specificImpulseS: 385,
    thrustN: 39_000_000,
    notes:
      "Multi-stage heavy-lift launcher equivalent (e.g. SLS / Saturn V class). " +
      "Delivers ~12,000 m/s delta-v, capable of Trans-Lunar Injection (TLI) missions.",
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

/** Generate a future ISO date string (+30 days from now) */
export function getFutureDemonstrationDate(daysAhead: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 19) + "Z";
}

/**
 * Scenario A — Satellite Launch Orbit (Equatorial Demo, Medium LV, 120 kg, 550 km, 20° inc)
 */
export function getDefaultSatelliteScenario(): DefaultSatelliteScenario {
  return {
    missionType: "satellite_launch",
    launchSite: LAUNCH_SITES[1], // Kennedy-like Site (Florida)
    vehicle: VEHICLE_PRESETS[1],   // Medium Launch Vehicle
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
    departureSite: LAUNCH_SITES[1], // Kennedy-like Site
    vehicle: VEHICLE_PRESETS[2],     // Heavy Launch Vehicle
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

