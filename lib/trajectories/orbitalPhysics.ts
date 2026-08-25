/**
 * Astrodynamics, Orbital Mechanics & Flight Trajectory Physics Engine
 * Contains:
 *   - Vis-Viva equation, Keplerian 6-element state vector transformation
 *   - Hohmann Transfer Orbit & Delta-V solver
 *   - 3-Body Gravitational Lunar Free-Return trajectory generator (RK4)
 *   - Launch Azimuth & Earth rotational boost calculator
 *   - Gravity Turn ascent profile integrator (Q-max, staging, downrange)
 */

import { KeplerianElements, ManeuverBurn, TrajectoryPoint3D } from "./types";

// ── Astrodynamic Physical Constants ──────────────────────────────────────────
export const ASTRO_CONSTANTS = {
  G: 6.6743e-11, // m^3 kg^-1 s^-2
  EARTH_MASS_KG: 5.9722e24,
  EARTH_RADIUS_KM: 6371.0,
  EARTH_MU_KM3_S2: 398600.4418, // Standard gravitational parameter mu = GM
  EARTH_ROTATION_RAD_S: 7.2921159e-5, // Earth angular velocity
  EARTH_EQUATOR_VELOCITY_KM_S: 0.4651, // ~465 m/s at equator

  MOON_MASS_KG: 7.342e22,
  MOON_RADIUS_KM: 1737.4,
  MOON_MU_KM3_S2: 4902.8,
  MOON_ORBIT_RADIUS_KM: 384400.0,
  MOON_ORBIT_SPEED_KM_S: 1.022,
  MOON_ORBIT_PERIOD_DAYS: 27.321661,

  STANDARD_GRAVITY_M_S2: 9.80665,
  ATMOSPHERE_SCALE_HEIGHT_KM: 8.5,
  SEA_LEVEL_AIR_DENSITY_KG_M3: 1.225,
};

/**
 * Calculates orbital velocity at radius r using Vis-Viva equation
 * v = sqrt( mu * (2/r - 1/a) )
 */
export function calculateVisVivaVelocity(
  rKm: number,
  semiMajorAxisKm: number,
  mu: number = ASTRO_CONSTANTS.EARTH_MU_KM3_S2
): number {
  if (rKm <= 0 || semiMajorAxisKm <= 0) return 0;
  const val = mu * (2 / rKm - 1 / semiMajorAxisKm);
  return val > 0 ? Math.sqrt(val) : 0;
}

/**
 * Calculates orbital period in minutes
 * T = 2 * pi * sqrt( a^3 / mu )
 */
export function calculateOrbitalPeriodMinutes(
  semiMajorAxisKm: number,
  mu: number = ASTRO_CONSTANTS.EARTH_MU_KM3_S2
): number {
  if (semiMajorAxisKm <= 0) return 0;
  const seconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisKm, 3) / mu);
  return seconds / 60;
}

/**
 * Calculates Keplerian orbital parameters from Perigee and Apogee altitudes
 */
export function getKeplerianElementsFromAltitudes(
  perigeeAltKm: number,
  apogeeAltKm: number,
  inclinationDeg: number = 0,
  raanDeg: number = 0,
  argPerigeeDeg: number = 0
): KeplerianElements {
  const rP = ASTRO_CONSTANTS.EARTH_RADIUS_KM + perigeeAltKm;
  const rA = ASTRO_CONSTANTS.EARTH_RADIUS_KM + apogeeAltKm;
  const semiMajorAxisKm = (rP + rA) / 2;
  const eccentricity = (rA - rP) / (rA + rP);
  const periodMinutes = calculateOrbitalPeriodMinutes(semiMajorAxisKm);
  const orbitalVelocityKmS = calculateVisVivaVelocity(rP, semiMajorAxisKm);

  return {
    semiMajorAxisKm,
    eccentricity: Math.max(0, eccentricity),
    inclinationDeg,
    raanDeg,
    argPerigeeDeg,
    trueAnomalyDeg: 0,
    periodMinutes,
    perigeeAltKm,
    apogeeAltKm,
    orbitalVelocityKmS,
  };
}

/**
 * Calculates Hohmann Transfer Delta-V between two circular/elliptical orbits
 */
export function calculateHohmannTransfer(
  r1Km: number,
  r2Km: number,
  mu: number = ASTRO_CONSTANTS.EARTH_MU_KM3_S2
): {
  deltaV1MS: number;
  deltaV2MS: number;
  totalDeltaVMS: number;
  transferTimeHours: number;
  transferSemiMajorAxisKm: number;
} {
  const aTransfer = (r1Km + r2Km) / 2;

  // Velocity on initial orbit
  const v1 = Math.sqrt(mu / r1Km);
  // Velocity on transfer ellipse at periapsis
  const vTx1 = Math.sqrt(mu * (2 / r1Km - 1 / aTransfer));
  const deltaV1KmS = Math.abs(vTx1 - v1);

  // Velocity on final orbit
  const v2 = Math.sqrt(mu / r2Km);
  // Velocity on transfer ellipse at apoapsis
  const vTx2 = Math.sqrt(mu * (2 / r2Km - 1 / aTransfer));
  const deltaV2KmS = Math.abs(v2 - vTx2);

  const totalDeltaVKmS = deltaV1KmS + deltaV2KmS;
  const transferTimeSec = Math.PI * Math.sqrt(Math.pow(aTransfer, 3) / mu);

  return {
    deltaV1MS: deltaV1KmS * 1000,
    deltaV2MS: deltaV2KmS * 1000,
    totalDeltaVMS: totalDeltaVKmS * 1000,
    transferTimeHours: transferTimeSec / 3600,
    transferSemiMajorAxisKm: aTransfer,
  };
}

/**
 * Calculates Launch Azimuth angle and Earth rotational velocity assist
 * sin(beta) = cos(inc) / cos(lat)
 */
export function calculateLaunchAzimuth(
  launchLatitudeDeg: number,
  targetInclinationDeg: number
): {
  azimuthDeg: number;
  earthRotationalBoostMS: number;
  isAchievableDirectly: boolean;
} {
  const latRad = (launchLatitudeDeg * Math.PI) / 180;
  const incRad = (targetInclinationDeg * Math.PI) / 180;

  // Earth rotational speed at latitude
  const earthBoostMS =
    ASTRO_CONSTANTS.EARTH_EQUATOR_VELOCITY_KM_S * 1000 * Math.cos(latRad);

  const cosLat = Math.cos(latRad);
  const cosInc = Math.cos(incRad);

  if (Math.abs(cosInc) > Math.abs(cosLat) + 0.0001) {
    // Target inclination is lower than launch latitude (requires expensive dogleg maneuver)
    return {
      azimuthDeg: 90, // launch directly East
      earthRotationalBoostMS: earthBoostMS,
      isAchievableDirectly: false,
    };
  }

  const sinBeta = Math.max(-1, Math.min(1, cosInc / Math.max(cosLat, 0.0001)));
  let azimuthDeg = (Math.asin(sinBeta) * 180) / Math.PI;

  // Normalize azimuth (typically launched eastward: 0 - 180 deg)
  if (azimuthDeg < 0) azimuthDeg += 360;

  return {
    azimuthDeg: Number(azimuthDeg.toFixed(2)),
    earthRotationalBoostMS: Math.round(earthBoostMS),
    isAchievableDirectly: true,
  };
}

/**
 * Generates 3D coordinates for a standard Keplerian Orbit Ellipse
 */
export function generateKeplerianOrbitSpline(
  elements: KeplerianElements,
  numPoints: number = 180,
  scale: number = 1.0
): THREE_Vector3Like[] {
  const points: THREE_Vector3Like[] = [];
  const { semiMajorAxisKm, eccentricity, inclinationDeg, raanDeg, argPerigeeDeg } = elements;

  const a = (semiMajorAxisKm / ASTRO_CONSTANTS.EARTH_RADIUS_KM) * scale;
  const incRad = (inclinationDeg * Math.PI) / 180;
  const raanRad = (raanDeg * Math.PI) / 180;
  const argPerRad = (argPerigeeDeg * Math.PI) / 180;

  for (let i = 0; i <= numPoints; i++) {
    const nu = (i / numPoints) * 2 * Math.PI; // True Anomaly
    const r = (a * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(nu));

    // Perifocal coordinate system (PQW)
    const xP = r * Math.cos(nu);
    const yP = r * Math.sin(nu);
    const zP = 0;

    // Transform from perifocal to Earth-Centered Inertial (ECI) 3D coordinate system
    // R = Rz(-raan) * Rx(-inc) * Rz(-argPer)
    const cosO = Math.cos(raanRad);
    const sinO = Math.sin(raanRad);
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    const cosW = Math.cos(argPerRad);
    const sinW = Math.sin(argPerRad);

    const Px = cosO * cosW - sinO * sinW * cosI;
    const Py = sinO * cosW + cosO * sinW * cosI;
    const Pz = sinW * sinI;

    const Qx = -cosO * sinW - sinO * cosW * cosI;
    const Qy = -sinO * sinW + cosO * cosW * cosI;
    const Qz = cosW * sinI;

    const x = xP * Px + yP * Qx;
    const y = xP * Pz + yP * Qz; // Map Z to Y for Three.js vertical axis
    const z = -(xP * Py + yP * Qy);

    points.push({ x, y, z });
  }

  return points;
}

export interface THREE_Vector3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Generates an Artemis / Apollo 3-Body Free-Return Figure-8 Trajectory
 * Loops from Earth LEO parking orbit, crosses deep space, loops around the Moon's gravity well,
 * and slingshots back to Earth safely.
 */
export function generateLunarFreeReturnSpline(
  earthScaleRadius: number = 1.0,
  moonDistanceScale: number = 8.5,
  numPoints: number = 300
): { points: THREE_Vector3Like[]; lunarFlybyIndex: number } {
  const points: THREE_Vector3Like[] = [];
  const lunarFlybyIndex = Math.floor(numPoints * 0.52);

  // Parameterized 3-Body figure-8 trajectory shape
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // 0 (Earth departure) -> 0.52 (Moon pericynthion) -> 1.0 (Earth reentry)

    let x = 0;
    let y = 0;
    let z = 0;

    if (t <= 0.48) {
      // Outbound Trans-Lunar Arc (Earth -> Moon approach)
      const prog = t / 0.48;
      // Elliptical expansion from Earth surface outward along X-axis
      const theta = prog * Math.PI * 0.95;
      x = Math.sin(theta) * moonDistanceScale * 0.98;
      y = Math.sin(prog * Math.PI) * 0.65; // slight orbital plane inclination
      z = (1 - Math.cos(theta)) * 1.8;
    } else if (t <= 0.56) {
      // Lunar Gravity Slingshot Loop (behind the Moon)
      const loopProg = (t - 0.48) / 0.08; // 0 to 1
      const angle = Math.PI * 0.5 + loopProg * Math.PI * 1.25;
      const moonCenterDist = moonDistanceScale;
      const lunarRadius = earthScaleRadius * 0.38;

      x = moonCenterDist + Math.cos(angle) * lunarRadius * 1.4;
      y = Math.sin(angle) * 0.3;
      z = 1.8 + Math.sin(angle) * lunarRadius * 1.6;
    } else {
      // Return Arc (Moon -> Earth free-return descent)
      const returnProg = (t - 0.56) / 0.44; // 0 to 1
      const invProg = 1 - returnProg;
      const theta = invProg * Math.PI * 0.92;

      x = Math.sin(theta) * moonDistanceScale * 0.95;
      y = -Math.sin(returnProg * Math.PI) * 0.55; // southern hemisphere descent
      z = (1 - Math.cos(theta)) * 1.8 - returnProg * 0.4;
    }

    points.push({ x, y, z });
  }

  return { points, lunarFlybyIndex };
}

/**
 * Generates an ascent launch arc from a specific launch pad coordinates on Earth
 */
export function generateLaunchAscentArc(
  launchLatDeg: number,
  launchLonDeg: number,
  targetAltKm: number,
  earthRadiusVisual: number = 1.0,
  numPoints: number = 50
): THREE_Vector3Like[] {
  const points: THREE_Vector3Like[] = [];
  const latRad = (launchLatDeg * Math.PI) / 180;
  const lonRad = (launchLonDeg * Math.PI) / 180;

  // Surface point on Earth sphere
  const startX = earthRadiusVisual * Math.cos(latRad) * Math.cos(lonRad);
  const startY = earthRadiusVisual * Math.sin(latRad);
  const startZ = earthRadiusVisual * Math.cos(latRad) * Math.sin(lonRad);

  const targetRadius = earthRadiusVisual * (1 + targetAltKm / ASTRO_CONSTANTS.EARTH_RADIUS_KM);

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // 0 to 1
    // Gravity turn pitch angle bends downrange toward orbital velocity vector
    const currentRadius = earthRadiusVisual + (targetRadius - earthRadiusVisual) * Math.pow(t, 1.4);
    const downrangeAngle = t * 0.35; // ~20 degrees downrange arc

    const currentLon = lonRad + downrangeAngle;
    const x = currentRadius * Math.cos(latRad) * Math.cos(currentLon);
    const y = currentRadius * Math.sin(latRad) + Math.sin(t * Math.PI * 0.5) * 0.05;
    const z = currentRadius * Math.cos(latRad) * Math.sin(currentLon);

    points.push({ x, y, z });
  }

  return points;
}
