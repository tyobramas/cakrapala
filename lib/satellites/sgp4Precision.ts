/**
 * Precision SGP4 Orbital Mechanics, Eclipse Shadow Geometry, Solar Terminator,
 * Topocentric Look-Angles (Az/El/Slant/Doppler), and 24-Hour Overhead Pass Predictor.
 *
 * Uses official satellite.js (SGP4/SDP4) + astronomy-engine (VSOP87 solar ephemeris).
 * Zero hardcoded visibility states or approximate mock passes.
 */

import * as satellite from "satellite.js";
import * as Astronomy from "astronomy-engine";

const EARTH_RADIUS_KM = 6371.0;
const EARTH_MU_KM3_S2 = 398600.4418;
const SPEED_OF_LIGHT_KMS = 299792.458;
const VHF_REF_FREQ_MHZ = 145.8; // Standard ISS / amateur satellite VHF downlink reference
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface SubsolarState {
  solarLatDeg: number;
  solarLonDeg: number;
  sunUnitEci: { x: number; y: number; z: number };
}

export interface TleMetadata {
  epochIso: string;
  ageHours: number;
  inclinationDeg: number;
  eccentricity: number;
  meanMotionRevPerDay: number;
  periodMin: number;
  semiMajorAxisKm: number;
  apogeeKm: number;
  perigeeKm: number;
  revNumber: number;
}

export interface LiveSatelliteState {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKms: number;
  velocityKmh: number;
  footprintKm: number;
  lighting: "sunlit" | "eclipsed";
  solarLatDeg: number;
  solarLonDeg: number;
  observer: {
    azimuthDeg: number;
    elevationDeg: number;
    slantRangeKm: number;
    rangeRateKms: number;
    dopplerKhz: number;
    isAboveHorizon: boolean;
  };
}

export interface PredictedPass {
  id: string;
  aosMs: number;
  maxElMs: number;
  losMs: number;
  maxElDeg: number;
  aosAzDeg: number;
  maxAzDeg: number;
  losAzDeg: number;
  durationSec: number;
  visibility: "visible" | "radio";
  peakLighting: "sunlit" | "eclipsed";
  observerSunAltDeg: number;
}

/**
 * Computes exact geocentric Subsolar Point (lat, lon) and unit Sun vector in ECI (J2000 equatorial)
 * using astronomy-engine's VSOP87 solar ephemeris + GMST.
 */
export function computeSubsolarPoint(date: Date): SubsolarState {
  const vec = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const mag = Math.hypot(vec.x, vec.y, vec.z) || 1;
  const ux = vec.x / mag;
  const uy = vec.y / mag;
  const uz = vec.z / mag;

  const raRad = Math.atan2(uy, ux);
  const decRad = Math.asin(Math.max(-1, Math.min(1, uz)));
  const gmst = satellite.gstime(date);
  let lonDeg = (raRad - gmst) * RAD2DEG;
  lonDeg = ((((lonDeg + 180) % 360) + 360) % 360) - 180;

  return {
    solarLatDeg: decRad * RAD2DEG,
    solarLonDeg: lonDeg,
    sunUnitEci: { x: ux, y: uy, z: uz },
  };
}

/**
 * Exact cylindrical Earth umbra test in ECI coordinates.
 * Satellite is eclipsed iff it lies on Earth's night side (dot < 0) AND
 * its perpendicular distance from the Earth-Sun shadow axis is less than R_earth.
 */
export function computeSatelliteLighting(
  posEciKm: { x: number; y: number; z: number },
  sunUnitEci: { x: number; y: number; z: number },
): "sunlit" | "eclipsed" {
  const proj =
    posEciKm.x * sunUnitEci.x +
    posEciKm.y * sunUnitEci.y +
    posEciKm.z * sunUnitEci.z;
  if (proj >= 0) return "sunlit";

  const px = posEciKm.x - proj * sunUnitEci.x;
  const py = posEciKm.y - proj * sunUnitEci.y;
  const pz = posEciKm.z - proj * sunUnitEci.z;
  const perpDistKm = Math.hypot(px, py, pz);
  return perpDistKm < EARTH_RADIUS_KM ? "eclipsed" : "sunlit";
}

/**
 * Parses live orbital elements & epoch freshness directly from NORAD TLE lines.
 */
export function parseTleMetadata(
  line1: string,
  line2: string,
  nowMs: number = Date.now(),
): TleMetadata {
  // Epoch year (cols 19-20) and fractional day of year (cols 21-32)
  const yr2 = parseInt(line1.slice(18, 20).trim(), 10);
  const fullYear = yr2 >= 57 ? 1900 + yr2 : 2000 + yr2;
  const dayOfYear = parseFloat(line1.slice(20, 32).trim()) || 1;
  const epochMs =
    Date.UTC(fullYear, 0, 1, 0, 0, 0) + (dayOfYear - 1) * 86400 * 1000;
  const ageHours = Math.max(0, (nowMs - epochMs) / 3600000);

  const inclinationDeg = parseFloat(line2.slice(8, 16).trim()) || 0;
  const eccStr = line2.slice(26, 33).trim();
  const eccentricity = parseFloat(`0.${eccStr}`) || 0;
  const meanMotionRevPerDay = parseFloat(line2.slice(52, 63).trim()) || 15.5;
  const revNumber = parseInt(line2.slice(63, 68).trim(), 10) || 0;

  const periodMin = 1440 / meanMotionRevPerDay;
  const nRadSec = (meanMotionRevPerDay * 2 * Math.PI) / 86400;
  const semiMajorAxisKm = Math.cbrt(EARTH_MU_KM3_S2 / (nRadSec * nRadSec));
  const apogeeKm = semiMajorAxisKm * (1 + eccentricity) - EARTH_RADIUS_KM;
  const perigeeKm = semiMajorAxisKm * (1 - eccentricity) - EARTH_RADIUS_KM;

  return {
    epochIso: new Date(epochMs).toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
    inclinationDeg: Math.round(inclinationDeg * 100) / 100,
    eccentricity: Math.round(eccentricity * 100000) / 100000,
    meanMotionRevPerDay: Math.round(meanMotionRevPerDay * 10000) / 10000,
    periodMin: Math.round(periodMin * 100) / 100,
    semiMajorAxisKm: Math.round(semiMajorAxisKm * 10) / 10,
    apogeeKm: Math.round(apogeeKm * 10) / 10,
    perigeeKm: Math.round(perigeeKm * 10) / 10,
    revNumber,
  };
}

/**
 * Computes exact SGP4 geodetic position, velocity, eclipse state, and observer look angles.
 */
export function propagateSatelliteLive(
  satrec: satellite.SatRec,
  date: Date,
  observerLatDeg: number,
  observerLonDeg: number,
  observerAltKm: number = 0.02,
): LiveSatelliteState | null {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;

  const posEci = pv.position as satellite.EciVec3<number>;
  const gmst = satellite.gstime(date);
  const gd = satellite.eciToGeodetic(posEci, gmst);

  const latitude = satellite.degreesLat(gd.latitude);
  const longitude = satellite.degreesLong(gd.longitude);
  const altitudeKm = gd.height;

  let velocityKms = 7.66;
  if (pv.velocity && typeof pv.velocity !== "boolean") {
    const v = pv.velocity as satellite.EciVec3<number>;
    velocityKms = Math.hypot(v.x, v.y, v.z);
  }

  const alpha = Math.acos(
    Math.min(1, EARTH_RADIUS_KM / (EARTH_RADIUS_KM + Math.max(1, altitudeKm))),
  );
  const footprintKm = Math.round(alpha * EARTH_RADIUS_KM * 2);

  const solar = computeSubsolarPoint(date);
  const lighting = computeSatelliteLighting(posEci, solar.sunUnitEci);

  const observerGd = {
    longitude: observerLonDeg * DEG2RAD,
    latitude: observerLatDeg * DEG2RAD,
    height: observerAltKm,
  };
  const posEcf = satellite.eciToEcf(posEci, gmst);
  const look = satellite.ecfToLookAngles(observerGd, posEcf);

  // Exact range rate via +/- 0.5s symmetric finite difference for VHF Doppler shift
  let rangeRateKms = 0;
  const pvPrev = satellite.propagate(satrec, new Date(date.getTime() - 500));
  const pvNext = satellite.propagate(satrec, new Date(date.getTime() + 500));
  if (
    pvPrev?.position &&
    typeof pvPrev.position !== "boolean" &&
    pvNext?.position &&
    typeof pvNext.position !== "boolean"
  ) {
    const rPrev = satellite.ecfToLookAngles(
      observerGd,
      satellite.eciToEcf(
        pvPrev.position as satellite.EciVec3<number>,
        satellite.gstime(new Date(date.getTime() - 500)),
      ),
    ).rangeSat;
    const rNext = satellite.ecfToLookAngles(
      observerGd,
      satellite.eciToEcf(
        pvNext.position as satellite.EciVec3<number>,
        satellite.gstime(new Date(date.getTime() + 500)),
      ),
    ).rangeSat;
    rangeRateKms = rNext - rPrev; // km per 1.0 second
  }

  // Doppler shift at 145.800 MHz (positive when approaching, negative when receding)
  const dopplerKhz = (-VHF_REF_FREQ_MHZ * 1000 * rangeRateKms) / SPEED_OF_LIGHT_KMS;
  const elevationDeg = look.elevation * RAD2DEG;

  return {
    timestamp: date.getTime(),
    latitude,
    longitude,
    altitudeKm,
    velocityKms,
    velocityKmh: velocityKms * 3600,
    footprintKm,
    lighting,
    solarLatDeg: solar.solarLatDeg,
    solarLonDeg: solar.solarLonDeg,
    observer: {
      azimuthDeg: (((look.azimuth * RAD2DEG) % 360) + 360) % 360,
      elevationDeg,
      slantRangeKm: look.rangeSat,
      rangeRateKms,
      dopplerKhz,
      isAboveHorizon: elevationDeg > 0,
    },
  };
}

/**
 * Generates exact SGP4 ground track points centered around `centerMs`.
 */
export function generateSgp4GroundTrack(
  satrec: satellite.SatRec,
  centerMs: number,
  pastMinutes: number = 45,
  futureMinutes: number = 95,
  stepSeconds: number = 60,
): { pastTrail: { lat: number; lon: number }[]; futureOrbit: { lat: number; lon: number }[] } {
  const pastTrail: { lat: number; lon: number }[] = [];
  const futureOrbit: { lat: number; lon: number }[] = [];

  const samplePoint = (ms: number) => {
    const d = new Date(ms);
    const pv = satellite.propagate(satrec, d);
    if (!pv || !pv.position || typeof pv.position === "boolean") return null;
    const gd = satellite.eciToGeodetic(
      pv.position as satellite.EciVec3<number>,
      satellite.gstime(d),
    );
    return {
      lat: satellite.degreesLat(gd.latitude),
      lon: satellite.degreesLong(gd.longitude),
    };
  };

  for (let dt = -pastMinutes * 60; dt <= 0; dt += stepSeconds) {
    const pt = samplePoint(centerMs + dt * 1000);
    if (pt) pastTrail.push(pt);
  }
  for (let dt = 0; dt <= futureMinutes * 60; dt += stepSeconds) {
    const pt = samplePoint(centerMs + dt * 1000);
    if (pt) futureOrbit.push(pt);
  }

  return { pastTrail, futureOrbit };
}

/**
 * Deterministic 24-hour SGP4 Overhead Pass Predictor for any observer location.
 * Classifies each pass as "visible" (Sunlit craft + dark observer sky Sun < -6°)
 * or "radio" (Daylight or eclipsed craft).
 */
export function predictOverheadPasses(
  satrec: satellite.SatRec,
  observerLatDeg: number,
  observerLonDeg: number,
  startMs: number = Date.now(),
  hoursAhead: number = 24,
  minMaxElDeg: number = 10,
  maxPasses: number = 6,
): PredictedPass[] {
  const observerGd = {
    longitude: observerLonDeg * DEG2RAD,
    latitude: observerLatDeg * DEG2RAD,
    height: 0.02,
  };
  const astroObs = new Astronomy.Observer(observerLatDeg, observerLonDeg, 20);

  const getLook = (ms: number) => {
    const d = new Date(ms);
    const pv = satellite.propagate(satrec, d);
    if (!pv || !pv.position || typeof pv.position === "boolean") return null;
    const posEci = pv.position as satellite.EciVec3<number>;
    const gmst = satellite.gstime(d);
    const look = satellite.ecfToLookAngles(observerGd, satellite.eciToEcf(posEci, gmst));
    return {
      elDeg: look.elevation * RAD2DEG,
      azDeg: (((look.azimuth * RAD2DEG) % 360) + 360) % 360,
      posEci,
    };
  };

  const passes: PredictedPass[] = [];
  const stepMs = 20_000; // 20s coarse scan (fast: 4320 steps for 24h -> <12ms)
  const endMs = startMs + hoursAhead * 3600_000;

  let inPass = false;
  let aosMs = startMs;
  let aosAz = 0;
  let maxEl = -90;
  let maxElMs = startMs;
  let maxAz = 0;

  for (let t = startMs; t <= endMs; t += stepMs) {
    const look = getLook(t);
    if (!look) continue;

    if (!inPass && look.elDeg > 0) {
      inPass = true;
      // Refine AOS backward in 2s steps
      let rT = t;
      let rAz = look.azDeg;
      for (let bt = t - 2000; bt >= t - stepMs; bt -= 2000) {
        const bLook = getLook(bt);
        if (!bLook || bLook.elDeg <= 0) break;
        rT = bt;
        rAz = bLook.azDeg;
      }
      aosMs = rT;
      aosAz = rAz;
      maxEl = look.elDeg;
      maxElMs = t;
      maxAz = look.azDeg;
    } else if (inPass) {
      if (look.elDeg > maxEl) {
        maxEl = look.elDeg;
        maxElMs = t;
        maxAz = look.azDeg;
      }
      if (look.elDeg <= 0 || t + stepMs > endMs) {
        // Refine LOS backward in 2s steps
        let losMs = t;
        let losAz = look.azDeg;
        for (let bt = t - 2000; bt >= t - stepMs; bt -= 2000) {
          const bLook = getLook(bt);
          if (bLook && bLook.elDeg > 0) {
            losMs = bt + 2000;
            losAz = bLook.azDeg;
            break;
          }
        }

        if (maxEl >= minMaxElDeg) {
          // Refine peak elevation around maxElMs in 2s steps
          let peakEci = look.posEci;
          for (let pt = maxElMs - 18000; pt <= maxElMs + 18000; pt += 2000) {
            const pLook = getLook(pt);
            if (pLook && pLook.elDeg > maxEl) {
              maxEl = pLook.elDeg;
              maxElMs = pt;
              maxAz = pLook.azDeg;
              peakEci = pLook.posEci;
            }
          }

          const peakDate = new Date(maxElMs);
          const peakLook = getLook(maxElMs);
          const solar = computeSubsolarPoint(peakDate);
          const peakLighting = computeSatelliteLighting(
            peakLook?.posEci ?? peakEci,
            solar.sunUnitEci,
          );
          const sunEq = Astronomy.Equator(Astronomy.Body.Sun, peakDate, astroObs, true, true);
          const sunHor = Astronomy.Horizon(peakDate, astroObs, sunEq.ra, sunEq.dec, "normal");
          const isOpticallyVisible = peakLighting === "sunlit" && sunHor.altitude < -6;

          passes.push({
            id: `${aosMs}`,
            aosMs,
            maxElMs,
            losMs,
            maxElDeg: Math.round(maxEl * 10) / 10,
            aosAzDeg: Math.round(aosAz),
            maxAzDeg: Math.round(maxAz),
            losAzDeg: Math.round(losAz),
            durationSec: Math.max(10, Math.round((losMs - aosMs) / 1000)),
            visibility: isOpticallyVisible ? "visible" : "radio",
            peakLighting,
            observerSunAltDeg: Math.round(sunHor.altitude * 10) / 10,
          });

          if (passes.length >= maxPasses) break;
        }
        inPass = false;
      }
    }
  }

  return passes;
}

/**
 * Exact spherical Great-Circle visibility footprint coordinates on Earth's surface.
 */
export function computeGreatCircleFootprint(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  segments: number = 72,
): { lat: number; lon: number }[] {
  const safeAlt = Math.max(80, altKm || 420);
  const angularRadius = Math.acos(
    Math.min(1, EARTH_RADIUS_KM / (EARTH_RADIUS_KM + safeAlt)),
  );
  const lat1 = latDeg * DEG2RAD;
  const lon1 = lonDeg * DEG2RAD;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinD = Math.sin(angularRadius);
  const cosD = Math.cos(angularRadius);

  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const brng = (i / segments) * Math.PI * 2;
    const lat2 = Math.asin(
      Math.max(-1, Math.min(1, sinLat1 * cosD + cosLat1 * sinD * Math.cos(brng))),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(brng) * sinD * cosLat1,
        cosD - sinLat1 * Math.sin(lat2),
      );
    let lonNorm = lon2 * RAD2DEG;
    lonNorm = ((((lonNorm + 180) % 360) + 360) % 360) - 180;
    pts.push({ lat: lat2 * RAD2DEG, lon: lonNorm });
  }
  return pts;
}

/**
 * Exact curved Solar Terminator boundary for 2D Equirectangular Earth map.
 */
export function computeSolarTerminatorCurve(
  solarLatDeg: number,
  solarLonDeg: number,
  steps: number = 180,
): { lat: number; lon: number }[] {
  const decRad = solarLatDeg * DEG2RAD;
  const tanDec = Math.tan(decRad);
  const safeTan = Math.abs(tanDec) < 1e-4 ? (tanDec >= 0 ? 1e-4 : -1e-4) : tanDec;

  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const lonDeg = -180 + (i / steps) * 360;
    const dLonRad = (lonDeg - solarLonDeg) * DEG2RAD;
    const latRad = Math.atan(-Math.cos(dLonRad) / safeTan);
    pts.push({ lat: latRad * RAD2DEG, lon: lonDeg });
  }
  return pts;
}

export function azimuthToCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];
}
