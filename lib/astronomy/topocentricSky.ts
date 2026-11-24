/**
 * Topocentric Horizontal Astronomy Engine for Ground Sky Observatory.
 *
 * Uses `astronomy-engine` (VSOP87/ELP) for precise Sun, Moon, and Planet ephemeris.
 * Computes topocentric horizontal coordinates (Altitude, Azimuth) for:
 * - Yale BSC5 Bright Stars with Johnson B-V Color Index Spectral Mapping
 * - Full IAU Constellations with Authentic Stellarium-grade Stick Figures
 * - The Moon with Real Topocentric Ephemeris + Phase Rendering
 * - 7 Planets: Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune (VSOP87)
 * - The Sun and Twilight Solar Elevation
 * - Photorealistic Galactic Plane / Milky Way Coordinate Mapping (J2000)
 */

import starCatalogData from "@/public/data/stars-bsc5.json";
import constellationCatalogData from "@/public/data/constellations.json";
import * as Astronomy from "astronomy-engine";

export interface ObserverLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  /** Real IANA timezone identifier (e.g. "Asia/Jakarta", "Europe/London") for exact DST-aware local time */
  timeZone?: string;
  /** Observer altitude above sea level in meters */
  elevationMeters?: number;
}

export interface SolarState {
  altitudeDeg: number;
  azimuthDeg: number;
  isDaylight: boolean;
  isTwilight: boolean;
  isCivilTwilight: boolean;
  isNauticalTwilight: boolean;
  isAstronomicalTwilight: boolean;
  isNight: boolean;
  skyBrightness: number;
  solarSubpoint: { lat: number; lng: number };
}

export interface TopocentricStar {
  id: string;
  hrNumber: number;
  name: string;
  bayer: string;
  constellation: string;
  mag: number;
  colorIndex: number; // Johnson B-V
  raDeg: number;      // J2000 Right Ascension (degrees)
  decDeg: number;     // J2000 Declination (degrees)
  altitudeDeg: number;
  azimuthDeg: number;
  isVisibleAboveHorizon: boolean;
  colorHex: string;
  pos3D: { x: number; y: number; z: number };
}

export interface TopocentricBody {
  id: string;
  name: string;
  mag: number;
  colorHex: string;
  raDeg?: number;
  decDeg?: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isVisibleAboveHorizon: boolean;
  pos3D: { x: number; y: number; z: number };
  /** Moon phase angle in degrees (0 = new, 90 = first quarter, 180 = full, 270 = last quarter) */
  phaseDeg?: number;
  /** Illuminated fraction of the Moon's disk (0.0 = new moon, 1.0 = full moon) */
  illuminationFraction?: number;
}

export interface ConstellationSegmentHorizontal {
  az1: number;
  alt1: number;
  az2: number;
  alt2: number;
}

export interface Constellation3D {
  name: string;
  abbreviation: string;
  centerRaDeg: number;
  centerDecDeg: number;
  centerAzDeg: number;
  centerAltDeg: number;
  centerPos3D: { x: number; y: number; z: number };
  isVisible: boolean;
  segments: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][];
  horizontalSegments: ConstellationSegmentHorizontal[];
}

export interface MilkyWayStreamPoint {
  azimuthDeg: number;
  altitudeDeg: number;
  isCore: boolean;
}

export const PRESET_CITIES: ObserverLocation[] = [
  { name: "Jakarta", country: "Indonesia", latitude: -6.2088, longitude: 106.8456, timezoneOffsetHours: 7, timeZone: "Asia/Jakarta", elevationMeters: 10 },
  { name: "Bogor (Bosscha Sector)", country: "Indonesia", latitude: -6.595, longitude: 106.8166, timezoneOffsetHours: 7, timeZone: "Asia/Jakarta", elevationMeters: 265 },
  { name: "Bandung (Bosscha Lembang)", country: "Indonesia", latitude: -6.8246, longitude: 107.6159, timezoneOffsetHours: 7, timeZone: "Asia/Jakarta", elevationMeters: 1310 },
  { name: "Bali (Denpasar)", country: "Indonesia", latitude: -8.6705, longitude: 115.2126, timezoneOffsetHours: 8, timeZone: "Asia/Makassar", elevationMeters: 20 },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezoneOffsetHours: 9, timeZone: "Asia/Tokyo", elevationMeters: 40 },
  { name: "Mauna Kea Observatory", country: "Hawaii, USA", latitude: 19.8206, longitude: -155.4681, timezoneOffsetHours: -10, timeZone: "Pacific/Honolulu", elevationMeters: 4205 },
  { name: "Paranal Observatory (VLT)", country: "Atacama, Chile", latitude: -24.6272, longitude: -70.4042, timezoneOffsetHours: -4, timeZone: "America/Santiago", elevationMeters: 2635 },
  { name: "Roque de los Muchachos", country: "La Palma, Spain", latitude: 28.7567, longitude: -17.8819, timezoneOffsetHours: 0, timeZone: "Atlantic/Canary", elevationMeters: 2396 },
  { name: "London (Greenwich)", country: "United Kingdom", latitude: 51.4769, longitude: -0.0005, timezoneOffsetHours: 0, timeZone: "Europe/London", elevationMeters: 45 },
  { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.006, timezoneOffsetHours: -5, timeZone: "America/New_York", elevationMeters: 10 },
  { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093, timezoneOffsetHours: 10, timeZone: "Australia/Sydney", elevationMeters: 40 },
  { name: "Reykjavik", country: "Iceland", latitude: 64.1466, longitude: -21.9426, timezoneOffsetHours: 0, timeZone: "Atlantic/Reykjavik", elevationMeters: 15 },
  { name: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357, timezoneOffsetHours: 2, timeZone: "Africa/Cairo", elevationMeters: 23 },
  { name: "Rio de Janeiro", country: "Brazil", latitude: -22.9068, longitude: -43.1729, timezoneOffsetHours: -3, timeZone: "America/Sao_Paulo", elevationMeters: 15 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// EXACT IANA TIMEZONE & OBSERVER LOCAL TIME UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formats an instant `date` in the selected observer's true IANA timezone
 * (falling back to numeric UTC offset if no IANA timeZone is provided).
 */
export function formatObserverClock(
  date: Date,
  loc: ObserverLocation,
  includeSeconds: boolean = true,
): { time: string; dateStr: string; tzLabel: string; isoLocalInput: string } {
  if (loc.timeZone) {
    try {
      const timeFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: loc.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        ...(includeSeconds ? { second: "2-digit" } : {}),
        hour12: false,
      });
      const dateFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: loc.timeZone,
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: loc.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
      const hourRaw = get("hour") === "24" ? "00" : get("hour");
      const isoLocalInput = `${get("year")}-${get("month")}-${get("day")}T${hourRaw}:${get("minute")}`;

      const tzParts = new Intl.DateTimeFormat("en-US", {
        timeZone: loc.timeZone,
        timeZoneName: "shortOffset",
      }).formatToParts(date);
      const tzLabel = tzParts.find((p) => p.type === "timeZoneName")?.value ?? loc.timeZone;

      return {
        time: timeFmt.format(date).replace(/^24:/, "00:"),
        dateStr: dateFmt.format(date),
        tzLabel,
        isoLocalInput,
      };
    } catch {
      // Fall through to fixed-offset formatting
    }
  }

  const offsetMs = loc.timezoneOffsetHours * 3600000;
  const shifted = new Date(date.getTime() + offsetMs);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  const yyyy = shifted.getUTCFullYear();
  const mon = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const tzSign = loc.timezoneOffsetHours >= 0 ? "+" : "";
  return {
    time: includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`,
    dateStr: `${dd} ${months[shifted.getUTCMonth()]} ${yyyy}`,
    tzLabel: `GMT${tzSign}${loc.timezoneOffsetHours}`,
    isoLocalInput: `${yyyy}-${mon}-${dd}T${hh}:${mm}`,
  };
}

/**
 * Parses a `YYYY-MM-DDTHH:MM` wall-clock string interpreted in the selected observer's
 * timezone (IANA or fixed UTC offset) into a true UTC `Date`.
 */
export function parseObserverLocalInput(value: string, loc: ObserverLocation): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, ys, ms, ds, hs, mins] = m;
  const targetUtcGuess = Date.UTC(Number(ys), Number(ms) - 1, Number(ds), Number(hs), Number(mins), 0);

  if (loc.timeZone) {
    try {
      // Iterative 2-pass exact offset inversion (handles DST transitions accurately)
      let guess = targetUtcGuess;
      for (let i = 0; i < 2; i++) {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: loc.timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(new Date(guess));
        const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
        const hVal = get("hour") === 24 ? 0 : get("hour");
        const renderedAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hVal, get("minute"), 0);
        guess += targetUtcGuess - renderedAsUtc;
      }
      return new Date(guess);
    } catch {
      // Fallback below
    }
  }
  return new Date(targetUtcGuess - loc.timezoneOffsetHours * 3600000);
}

/**
 * Returns the exact UTC instant for local evening (e.g., 21:00) on the observer's current date.
 */
export function getObserverLocalHourDate(baseDate: Date, loc: ObserverLocation, targetHour: number): Date {
  const clock = formatObserverClock(baseDate, loc, false);
  const datePrefix = clock.isoLocalInput.slice(0, 10);
  const hh = String(Math.max(0, Math.min(23, Math.floor(targetHour)))).padStart(2, "0");
  return parseObserverLocalInput(`${datePrefix}T${hh}:00`, loc) ?? baseDate;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXACT IAU J2000 -> TOPOCENTRIC HORIZONTAL ENGINE (PRECESSION + NUTATION + REFRACTION)
// ═══════════════════════════════════════════════════════════════════════════════

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Computes the exact 3x3 IAU J2000 -> Topocentric Horizontal rotation matrix
 * (including IAU precession, nutation, GAST, and observer lat/lon) via astronomy-engine.
 */
export function createEqjToHorMatrix(
  date: Date,
  latDeg: number,
  lngDeg: number,
  elevationMeters: number = 0,
): number[][] {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lngDeg, elevationMeters);
  return Astronomy.Rotation_EQJ_HOR(time, obs).rot;
}

/**
 * Computes the exact 3x3 Topocentric Horizontal -> IAU J2000 Galactic rotation matrix
 * for zero-error Milky Way shader alignment at any observer location & epoch.
 */
export function createHorToGalMatrix(
  date: Date,
  latDeg: number,
  lngDeg: number,
  elevationMeters: number = 0,
): number[][] {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lngDeg, elevationMeters);
  const horToEqj = Astronomy.Rotation_HOR_EQJ(time, obs);
  const eqjToGal = Astronomy.Rotation_EQJ_GAL();
  return Astronomy.CombineRotation(horToEqj, eqjToGal).rot;
}

/**
 * Transforms J2000 Equatorial (RA°, Dec°) to apparent Topocentric Horizontal (Az°, Alt°)
 * using the precomputed `Rotation_EQJ_HOR` matrix + standard atmospheric refraction.
 *
 * Also returns right-handed Three.js interior dome coordinates:
 *   North (Az=0°) = +Z, East (Az=90°) = -X (right of viewer facing North), Zenith = +Y.
 */
export function projectJ2000ToHorizontal(
  raDeg: number,
  decDeg: number,
  rot: number[][],
  domeRadius: number = 500,
  applyRefraction: boolean = true,
): { azDeg: number; altDeg: number; x: number; y: number; z: number } {
  const raRad = raDeg * DEG2RAD;
  const decRad = decDeg * DEG2RAD;
  const cosDec = Math.cos(decRad);
  const vx = cosDec * Math.cos(raRad);
  const vy = cosDec * Math.sin(raRad);
  const vz = Math.sin(decRad);

  // astronomy-engine RotationMatrix applies rot^T * v (see Astronomy.RotateVector):
  // hx = North, hy = West, hz = Up (Zenith)
  const r0 = rot[0];
  const r1 = rot[1];
  const r2 = rot[2];
  const hx = r0[0] * vx + r1[0] * vy + r2[0] * vz;
  const hy = r0[1] * vx + r1[1] * vy + r2[1] * vz;
  const hz = r0[2] * vx + r1[2] * vy + r2[2] * vz;

  const altGeomDeg = Math.asin(Math.max(-1, Math.min(1, hz))) * RAD2DEG;
  let altDeg = altGeomDeg;
  if (applyRefraction && altGeomDeg > -2.0) {
    const refDeg = Astronomy.Refraction("normal", Math.max(-1.0, altGeomDeg));
    const fade = altGeomDeg >= -1.0 ? 1.0 : Math.max(0, altGeomDeg + 2.0);
    altDeg = Math.min(90, altGeomDeg + refDeg * fade);
  }

  let azDeg = Math.atan2(-hy, hx) * RAD2DEG;
  if (azDeg < 0) azDeg += 360;

  const altRad = altDeg * DEG2RAD;
  const azRad = azDeg * DEG2RAD;
  const cosAlt = Math.cos(altRad);

  return {
    azDeg,
    altDeg,
    x: -domeRadius * cosAlt * Math.sin(azRad),
    y: domeRadius * Math.sin(altRad),
    z: domeRadius * cosAlt * Math.cos(azRad),
  };
}

/**
 * Formats Right Ascension (degrees) as `HHh MMm SSs` and Declination as `±DD° MM'`.
 */
export function formatRaDec(raDeg: number, decDeg: number): { raStr: string; decStr: string } {
  const normRa = ((raDeg % 360) + 360) % 360;
  const totalSec = Math.round((normRa / 15) * 3600);
  const h = Math.floor(totalSec / 3600) % 24;
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const sign = decDeg >= 0 ? "+" : "−";
  const absDec = Math.abs(decDeg);
  const d = Math.floor(absDec);
  const dm = Math.round((absDec - d) * 60);
  const adjD = dm === 60 ? d + 1 : d;
  const adjM = dm === 60 ? 0 : dm;

  return {
    raStr: `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
    decStr: `${sign}${String(adjD).padStart(2, "0")}° ${String(adjM).padStart(2, "0")}′`,
  };
}

/**
 * Maps Johnson B-V color index to accurate RGB hex color.
 */
export function bvToColorHex(bv: number): string {
  if (bv < -0.1) return "#9bb0ff"; // O/B-type hot blue
  if (bv < 0.2) return "#bbccff";  // A-type blue-white
  if (bv < 0.5) return "#f8f9ff";  // F-type white
  if (bv < 0.8) return "#ffffed";  // G-type yellow-white (Sun-like)
  if (bv < 1.3) return "#ffd2a1";  // K-type orange
  return "#ffcc6f";                // M-type red/deep orange
}

export function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function getGMST(date: Date): number {
  const time = Astronomy.MakeTime(date);
  return Astronomy.SiderealTime(time) * 15;
}

export function computeSunPosition(date: Date, latDeg: number, lngDeg: number): SolarState {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lngDeg, 0);

  // Precise Sun equatorial coordinates via VSOP87
  const sunEq = Astronomy.Equator(Astronomy.Body.Sun, time, obs, true, true);
  const sunHor = Astronomy.Horizon(time, obs, sunEq.ra, sunEq.dec, 'normal');

  const altDeg = sunHor.altitude;
  const azDeg = sunHor.azimuth;

  // Solar sub-point for day/night terminator
  const decDeg = sunEq.dec;
  const raDeg = sunEq.ra * 15; // RA hours -> degrees
  const gmst = getGMST(date);
  let subLng = -(gmst - raDeg);
  subLng = (((subLng + 180) % 360) + 360) % 360 - 180;

  const isDaylight = altDeg > 0;
  const isTwilight = altDeg <= 0 && altDeg > -18;
  const isCivilTwilight = altDeg <= 0 && altDeg > -6;
  const isNauticalTwilight = altDeg <= -6 && altDeg > -12;
  const isAstronomicalTwilight = altDeg <= -12 && altDeg > -18;
  const isNight = altDeg <= -18;

  let skyBrightness = 0;
  if (altDeg > 0) {
    skyBrightness = Math.min(1, 0.4 + (altDeg / 45) * 0.6);
  } else if (altDeg > -18) {
    skyBrightness = (altDeg + 18) / 18 * 0.4;
  }

  return {
    altitudeDeg: altDeg,
    azimuthDeg: azDeg,
    isDaylight,
    isTwilight,
    isCivilTwilight,
    isNauticalTwilight,
    isAstronomicalTwilight,
    isNight,
    skyBrightness,
    solarSubpoint: { lat: decDeg, lng: subLng },
  };
}

export function computeTerminatorCurve(date: Date): { lng: number; lat: number }[] {
  const time = Astronomy.MakeTime(date);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, new Astronomy.Observer(0, 0, 0), true, true);
  const decRad = eq.dec * DEG2RAD;
  const raDeg = eq.ra * 15;
  const gmst = getGMST(date);
  const sunLng = (((-(gmst - raDeg) + 180) % 360) + 360) % 360 - 180;

  const points: { lng: number; lat: number }[] = [];
  const steps = 120;

  for (let i = 0; i <= steps; i++) {
    const lng = -180 + (i / steps) * 360;
    const haRad = (lng - sunLng) * DEG2RAD;
    const tanSunLat = Math.tan(decRad);
    let termLatDeg = 0;
    if (Math.abs(tanSunLat) > 0.0001) {
      const termLatRad = Math.atan(-Math.cos(haRad) / tanSunLat);
      termLatDeg = termLatRad * RAD2DEG;
    }
    points.push({ lng, lat: termLatDeg });
  }

  return points;
}

const COMMON_STAR_NAMES: Record<number, { name: string; constellation: string }> = {
  2491: { name: "Sirius", constellation: "Canis Major" },
  2326: { name: "Canopus", constellation: "Carina" },
  5340: { name: "Arcturus", constellation: "Boötes" },
  5459: { name: "Rigil Kentaurus (Alpha Centauri)", constellation: "Centaurus" },
  5460: { name: "Toliman", constellation: "Centaurus" },
  7001: { name: "Vega", constellation: "Lyra" },
  1708: { name: "Capella", constellation: "Auriga" },
  1713: { name: "Rigel", constellation: "Orion" },
  2943: { name: "Procyon", constellation: "Canis Minor" },
  472: { name: "Achernar", constellation: "Eridanus" },
  2061: { name: "Betelgeuse", constellation: "Orion" },
  5267: { name: "Hadar", constellation: "Centaurus" },
  7557: { name: "Altair", constellation: "Aquila" },
  4730: { name: "Acrux", constellation: "Crux" },
  1457: { name: "Aldebaran", constellation: "Taurus" },
  6134: { name: "Antares", constellation: "Scorpius" },
  5056: { name: "Spica", constellation: "Virgo" },
  2891: { name: "Pollux", constellation: "Gemini" },
  8728: { name: "Fomalhaut", constellation: "Piscis Austrinus" },
  7924: { name: "Deneb", constellation: "Cygnus" },
  4853: { name: "Mimosa", constellation: "Crux" },
  3982: { name: "Regulus", constellation: "Leo" },
  3748: { name: "Alphard", constellation: "Hydra" },
  2421: { name: "Adhara", constellation: "Canis Major" },
  2890: { name: "Castor", constellation: "Gemini" },
  4621: { name: "Gacrux", constellation: "Crux" },
  6527: { name: "Shaula", constellation: "Scorpius" },
  1543: { name: "Bellatrix", constellation: "Orion" },
  1903: { name: "Elnath", constellation: "Taurus" },
  3419: { name: "Miaplacidus", constellation: "Carina" },
  1641: { name: "Alnilam", constellation: "Orion" },
  1672: { name: "Alnitak", constellation: "Orion" },
  1552: { name: "Mintaka", constellation: "Orion" },
  1790: { name: "Saiph", constellation: "Orion" },
  6879: { name: "Nunki", constellation: "Sagittarius" },
  6556: { name: "Rasalhague", constellation: "Ophiuchus" },
  5054: { name: "Alioth", constellation: "Ursa Major" },
  4301: { name: "Dubhe", constellation: "Ursa Major" },
  5191: { name: "Mizar", constellation: "Ursa Major" },
  4295: { name: "Merak", constellation: "Ursa Major" },
  5563: { name: "Alkaid", constellation: "Ursa Major" },
  4660: { name: "Phecda", constellation: "Ursa Major" },
  4554: { name: "Megrez", constellation: "Ursa Major" },
  424: { name: "Polaris (North Star)", constellation: "Ursa Minor" },
  168: { name: "Schedar", constellation: "Cassiopeia" },
  21: { name: "Caph", constellation: "Cassiopeia" },
  403: { name: "Ruchbah", constellation: "Cassiopeia" },
  542: { name: "Segin", constellation: "Cassiopeia" },
  677: { name: "Algol (Demon Star)", constellation: "Perseus" },
  1017: { name: "Mirfak", constellation: "Perseus" },
  1122: { name: "Alcyone (Pleiades)", constellation: "Taurus" },
  1412: { name: "Menkar", constellation: "Cetus" },
  6859: { name: "Kaus Australis", constellation: "Sagittarius" },
  7796: { name: "Sadr", constellation: "Cygnus" },
  7417: { name: "Albireo", constellation: "Cygnus" },
  8425: { name: "Alnair", constellation: "Grus" },
  7590: { name: "Peacock", constellation: "Pavo" },
  897: { name: "Mirach", constellation: "Andromeda" },
  15: { name: "Alpheratz", constellation: "Andromeda" },
  603: { name: "Almach", constellation: "Andromeda" },
  8781: { name: "Markab", constellation: "Pegasus" },
  8880: { name: "Scheat", constellation: "Pegasus" },
  8684: { name: "Algenib", constellation: "Pegasus" },
  8634: { name: "Enif", constellation: "Pegasus" },
  6705: { name: "Deneb Kaitos", constellation: "Cetus" },
  7121: { name: "Ascella", constellation: "Sagittarius" },
  6913: { name: "Kaus Borealis", constellation: "Sagittarius" },
  6084: { name: "Acrab", constellation: "Scorpius" },
  5944: { name: "Dschubba", constellation: "Scorpius" },
  6247: { name: "Sargas", constellation: "Scorpius" },
  6508: { name: "Lesath", constellation: "Scorpius" },
};

export function computeTopocentricStars(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 500,
  elevationMeters: number = 0,
): TopocentricStar[] {
  const rot = createEqjToHorMatrix(date, latDeg, lngDeg, elevationMeters);
  const result: TopocentricStar[] = [];
  const rawStars = (starCatalogData as { stars?: Array<{
    id: string;
    rightAscensionDegrees: number;
    declinationDegrees: number;
    magnitude: number;
    colorIndex?: number;
    name?: string;
  }> }).stars || [];

  for (const star of rawStars) {
    const raDeg = star.rightAscensionDegrees;
    const decDeg = star.declinationDegrees;
    const proj = projectJ2000ToHorizontal(raDeg, decDeg, rot, domeRadius, true);

    const hrNum = parseInt(star.id.replace("HR", ""), 10) || 0;
    const commonInfo = COMMON_STAR_NAMES[hrNum];
    const colorIndex = typeof star.colorIndex === "number" ? star.colorIndex : 0.4;
    const colorHex = bvToColorHex(colorIndex);

    result.push({
      id: star.id,
      hrNumber: hrNum,
      name: commonInfo?.name || star.name || star.id,
      bayer: star.name || star.id,
      constellation: commonInfo?.constellation || "",
      mag: star.magnitude,
      colorIndex,
      raDeg,
      decDeg,
      altitudeDeg: proj.altDeg,
      azimuthDeg: proj.azDeg,
      isVisibleAboveHorizon: proj.altDeg >= 0,
      colorHex,
      pos3D: { x: proj.x, y: proj.y, z: proj.z },
    });
  }

  return result;
}

export function computeTopocentricBodies(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 500,
  elevationMeters: number = 0,
): { moon: TopocentricBody; planets: TopocentricBody[] } {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lngDeg, elevationMeters);

  // Helper: astronomy-engine body -> topocentric (Az, Alt, RA, Dec, pos3D)
  function bodyToHorizontal(body: Astronomy.Body) {
    const eq = Astronomy.Equator(body, time, obs, true, true);
    const hor = Astronomy.Horizon(time, obs, eq.ra, eq.dec, "normal");
    const altRad = hor.altitude * DEG2RAD;
    const azRad = hor.azimuth * DEG2RAD;
    return {
      raDeg: eq.ra * 15,
      decDeg: eq.dec,
      altDeg: hor.altitude,
      azDeg: hor.azimuth,
      pos3D: {
        x: -domeRadius * Math.cos(altRad) * Math.sin(azRad),
        y: domeRadius * Math.sin(altRad),
        z: domeRadius * Math.cos(altRad) * Math.cos(azRad),
      },
    };
  }

  // 1. Moon — Precise ELP Ephemeris + Phase & Illumination
  const moonPos = bodyToHorizontal(Astronomy.Body.Moon);
  const moonPhaseDeg = Astronomy.MoonPhase(time); // 0=new, 90=Q1, 180=full, 270=Q3
  const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, time);

  const moonBody: TopocentricBody = {
    id: "moon",
    name: "Moon",
    mag: moonIllum.mag,
    colorHex: "#f8fafc",
    raDeg: moonPos.raDeg,
    decDeg: moonPos.decDeg,
    altitudeDeg: moonPos.altDeg,
    azimuthDeg: moonPos.azDeg,
    isVisibleAboveHorizon: moonPos.altDeg >= 0,
    pos3D: moonPos.pos3D,
    phaseDeg: moonPhaseDeg,
    illuminationFraction: moonIllum.phase_fraction,
  };

  // 2. Visible Planets — Precise VSOP87 Ephemeris (all 7 classical + ice giants)
  const planetDefs = [
    { id: "mercury", name: "Mercury", body: Astronomy.Body.Mercury, color: "#cbd5e1" },
    { id: "venus",   name: "Venus",   body: Astronomy.Body.Venus,   color: "#fef08a" },
    { id: "mars",    name: "Mars",    body: Astronomy.Body.Mars,    color: "#f87171" },
    { id: "jupiter", name: "Jupiter", body: Astronomy.Body.Jupiter, color: "#fcd34d" },
    { id: "saturn",  name: "Saturn",  body: Astronomy.Body.Saturn,  color: "#fed7aa" },
    { id: "uranus",  name: "Uranus",  body: Astronomy.Body.Uranus,  color: "#7dd3fc" },
    { id: "neptune", name: "Neptune", body: Astronomy.Body.Neptune, color: "#818cf8" },
  ];

  const planets: TopocentricBody[] = [];
  for (const p of planetDefs) {
    const pos = bodyToHorizontal(p.body);
    let mag = 0;
    try {
      const illum = Astronomy.Illumination(p.body, time);
      mag = illum.mag;
    } catch {
      mag = 0;
    }

    planets.push({
      id: p.id,
      name: p.name,
      mag,
      colorHex: p.color,
      raDeg: pos.raDeg,
      decDeg: pos.decDeg,
      altitudeDeg: pos.altDeg,
      azimuthDeg: pos.azDeg,
      isVisibleAboveHorizon: pos.altDeg >= 0,
      pos3D: pos.pos3D,
    });
  }

  return { moon: moonBody, planets };
}

/**
 * Authentic Stellarium-grade IAU Constellations using RA/Dec line segments.
 * Uses d3-celestial constellation line data (89 IAU constellations, 743 segments).
 * Each segment endpoint is converted from J2000 RA/Dec → Topocentric (Az, Alt) → 3D position.
 */

interface ConstellationData {
  abbreviation: string;
  name: string;
  segments: { ra1: number; dec1: number; ra2: number; dec2: number }[];
}

let cachedConstellationData: ConstellationData[] | null = null;

function getConstellationData(): ConstellationData[] {
  if (cachedConstellationData) return cachedConstellationData;
  const raw = constellationCatalogData as { constellations?: ConstellationData[] };
  cachedConstellationData = raw.constellations || [];
  return cachedConstellationData;
}

export function computeIAUConstellations(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 500,
  elevationMeters: number = 0,
): Constellation3D[] {
  const rot = createEqjToHorMatrix(date, latDeg, lngDeg, elevationMeters);
  const constData = getConstellationData();
  const result: Constellation3D[] = [];

  for (const c of constData) {
    const segments: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][] = [];
    const horizontalSegments: ConstellationSegmentHorizontal[] = [];

    // Deduplicated unit-vector spherical centroid in J2000 for exact label anchoring
    const seenVerts = new Set<string>();
    let sumEqX = 0;
    let sumEqY = 0;
    let sumEqZ = 0;
    let maxAlt = -90;

    const addCentroidVert = (raDeg: number, decDeg: number) => {
      const key = `${raDeg.toFixed(2)},${decDeg.toFixed(2)}`;
      if (seenVerts.has(key)) return;
      seenVerts.add(key);
      const r = raDeg * DEG2RAD;
      const d = decDeg * DEG2RAD;
      sumEqX += Math.cos(d) * Math.cos(r);
      sumEqY += Math.cos(d) * Math.sin(r);
      sumEqZ += Math.sin(d);
    };

    for (const seg of c.segments) {
      const p1 = projectJ2000ToHorizontal(seg.ra1, seg.dec1, rot, domeRadius, true);
      const p2 = projectJ2000ToHorizontal(seg.ra2, seg.dec2, rot, domeRadius, true);

      segments.push([
        { x: p1.x, y: p1.y, z: p1.z },
        { x: p2.x, y: p2.y, z: p2.z },
      ]);
      horizontalSegments.push({
        az1: p1.azDeg,
        alt1: p1.altDeg,
        az2: p2.azDeg,
        alt2: p2.altDeg,
      });

      addCentroidVert(seg.ra1, seg.dec1);
      addCentroidVert(seg.ra2, seg.dec2);
      if (p1.altDeg > maxAlt) maxAlt = p1.altDeg;
      if (p2.altDeg > maxAlt) maxAlt = p2.altDeg;
    }

    if (segments.length === 0) continue;

    const norm = Math.hypot(sumEqX, sumEqY, sumEqZ) || 1;
    const centerRaDeg = (((Math.atan2(sumEqY / norm, sumEqX / norm) * RAD2DEG) % 360) + 360) % 360;
    const centerDecDeg = Math.asin(Math.max(-1, Math.min(1, sumEqZ / norm))) * RAD2DEG;
    const centerProj = projectJ2000ToHorizontal(centerRaDeg, centerDecDeg, rot, domeRadius, true);

    result.push({
      name: c.name,
      abbreviation: c.abbreviation,
      centerRaDeg,
      centerDecDeg,
      centerAzDeg: centerProj.azDeg,
      centerAltDeg: centerProj.altDeg,
      centerPos3D: { x: centerProj.x, y: centerProj.y, z: centerProj.z },
      isVisible: maxAlt > -10,
      segments,
      horizontalSegments,
    });
  }

  return result;
}

/**
 * Computes smooth continuous spline stream points for the Milky Way Galactic Equator.
 * Follows J2000 Galactic Plane System (North Galactic Pole at RA 192.85948°, Dec +27.12825°).
 */
export function computeMilkyWaySpline(date: Date, latDeg: number, lngDeg: number): MilkyWayStreamPoint[] {
  const gmst = getGMST(date);
  const lstDeg = ((gmst + lngDeg) % 360 + 360) % 360;
  const latRad = latDeg * (Math.PI / 180);

  const raNGP = 192.85948 * (Math.PI / 180);
  const decNGP = 27.12825 * (Math.PI / 180);
  const l0 = 32.93192 * (Math.PI / 180);

  const stream: MilkyWayStreamPoint[] = [];
  const steps = 120;

  for (let i = 0; i <= steps; i++) {
    const lDeg = (i / steps) * 360;
    const lRad = (lDeg * Math.PI) / 180;

    // Galactic Equator b = 0
    const sinDec = Math.cos(decNGP) * Math.cos(lRad - l0);
    const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));

    const y = Math.sin(lRad - l0);
    const x = -Math.sin(decNGP) * Math.cos(lRad - l0);
    let raRad = Math.atan2(y, x) + raNGP;
    if (raRad < 0) raRad += 2 * Math.PI;
    const raDeg = (raRad * 180) / Math.PI;

    const H = ((lstDeg - raDeg) % 360 + 360) % 360;
    const HRad = (H * Math.PI) / 180;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = (altRad * 180) / Math.PI;

    const cosAlt = Math.cos(altRad);
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
    let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(HRad) > 0) azRad = 2 * Math.PI - azRad;
    const azDeg = (azRad * 180) / Math.PI;

    const isCore = lDeg < 45 || lDeg > 315; // Galactic Center in Sagittarius/Scorpius

    stream.push({
      azimuthDeg: azDeg,
      altitudeDeg: altDeg,
      isCore,
    });
  }

  return stream;
}

export interface RawNebula {
  id: string;
  name: string;
  commonName: string;
  messierNgc: string;
  type: "emission_nebula" | "planetary_nebula" | "galaxy" | "reflection_nebula" | "supernova_remnant";
  typeLabel: string;
  constellation: string;
  raDeg: number;
  decDeg: number;
  mag: number;
  distanceLy: string;
  colorHex: string;
  secondaryColorHex: string;
  description: string;
  funFact: string;
}

export interface TopocentricNebula extends RawNebula {
  altitudeDeg: number;
  azimuthDeg: number;
  isVisibleAboveHorizon: boolean;
  pos3D: { x: number; y: number; z: number };
}

export const FAMOUS_NEBULAE: RawNebula[] = [
  {
    id: "m42",
    name: "Orion Nebula",
    commonName: "Great Orion Nebula",
    messierNgc: "M42 / NGC 1976",
    type: "emission_nebula",
    typeLabel: "Diffuse Emission & Reflection Nebula",
    constellation: "Orion",
    raDeg: 83.822,
    decDeg: -5.391,
    mag: 4.0,
    distanceLy: "1,344 Light Years",
    colorHex: "#ec4899",
    secondaryColorHex: "#06b6d4",
    description: "The Orion Nebula (M42) is one of the brightest and most studied star-forming nurseries in the Milky Way, visible to the naked eye below Orion's Belt.",
    funFact: "It hosts the Trapezium cluster—a tight quartet of massive newborn O and B-type stars whose stellar winds sculpt the glowing gas cavity.",
  },
  {
    id: "ngc3372",
    name: "Carina Nebula",
    commonName: "Eta Carinae Nebula",
    messierNgc: "NGC 3372",
    type: "emission_nebula",
    typeLabel: "Giant Star-Forming Emission Nebula",
    constellation: "Carina",
    raDeg: 161.28,
    decDeg: -59.87,
    mag: 1.0,
    distanceLy: "8,500 Light Years",
    colorHex: "#f43f5e",
    secondaryColorHex: "#a855f7",
    description: "One of the largest and most luminous diffuse nebulae in the southern sky, more than four times larger and brighter than the Orion Nebula.",
    funFact: "It contains Eta Carinae, a hypermassive unstable luminous blue variable star with over 100 solar masses on the verge of going supernova.",
  },
  {
    id: "m8",
    name: "Lagoon Nebula",
    commonName: "Lagoon Nebula",
    messierNgc: "M8 / NGC 6523",
    type: "emission_nebula",
    typeLabel: "Giant Interstellar Cloud (H II Region)",
    constellation: "Sagittarius",
    raDeg: 270.92,
    decDeg: -24.39,
    mag: 6.0,
    distanceLy: "4,100 Light Years",
    colorHex: "#fb7185",
    secondaryColorHex: "#38bdf8",
    description: "A colossal interstellar cloud classified as an emission nebula and H II region located in the rich heart of the Sagittarius Milky Way.",
    funFact: "It features prominent dark Bok globules—collapsing protostellar clouds that represent the earliest stages of stellar birth.",
  },
  {
    id: "m20",
    name: "Trifid Nebula",
    commonName: "Trifid Nebula",
    messierNgc: "M20 / NGC 6514",
    type: "emission_nebula",
    typeLabel: "Trifid Three-Lobed Emission & Reflection Nebula",
    constellation: "Sagittarius",
    raDeg: 270.63,
    decDeg: -23.03,
    mag: 6.3,
    distanceLy: "5,200 Light Years",
    colorHex: "#f472b6",
    secondaryColorHex: "#60a5fa",
    description: "A stunning cosmic combination of an emission nebula (red), a reflection nebula (blue), and dark dust lanes dividing it into three lobes.",
    funFact: "The word 'Trifid' means 'divided into three lobes', shaped by thick interstellar dust lanes blocking the background light.",
  },
  {
    id: "m16",
    name: "Eagle Nebula",
    commonName: "Pillars of Creation",
    messierNgc: "M16 / NGC 6611",
    type: "emission_nebula",
    typeLabel: "Active Star-Forming Emission Nebula",
    constellation: "Serpens",
    raDeg: 274.70,
    decDeg: -13.79,
    mag: 6.0,
    distanceLy: "7,000 Light Years",
    colorHex: "#fb923c",
    secondaryColorHex: "#e11d48",
    description: "The Eagle Nebula is famous for the 'Pillars of Creation', monumental towers of interstellar gas and dust where new stars are being born.",
    funFact: "The largest pillar is roughly four light-years tall—stretching across almost the entire distance between our Sun and Alpha Centauri.",
  },
  {
    id: "m17",
    name: "Omega Nebula",
    commonName: "Swan / Horseshoe Nebula",
    messierNgc: "M17 / NGC 6618",
    type: "emission_nebula",
    typeLabel: "H II Emission Nebula",
    constellation: "Sagittarius",
    raDeg: 275.11,
    decDeg: -16.18,
    mag: 6.0,
    distanceLy: "5,500 Light Years",
    colorHex: "#f87171",
    secondaryColorHex: "#fbbf24",
    description: "Also known as the Swan or Horseshoe Nebula, this glowing H II region is one of the brightest and most massive star nurseries in our galaxy.",
    funFact: "It shines brightly due to ultraviolet radiation emitted by a young cluster of 35 hot massive stars embedded in its central gas.",
  },
  {
    id: "ic434",
    name: "Horsehead Nebula",
    commonName: "Horsehead & Flame Nebula",
    messierNgc: "IC 434 / Barnard 33",
    type: "emission_nebula",
    typeLabel: "Dark Nebula on H-alpha Emission",
    constellation: "Orion",
    raDeg: 85.25,
    decDeg: -2.46,
    mag: 7.3,
    distanceLy: "1,375 Light Years",
    colorHex: "#be123c",
    secondaryColorHex: "#fbbf24",
    description: "A dark silhouette of swirling cosmic dust resembling a horse's head, set against the luminous red ionized hydrogen gas of IC 434 near Alnitak.",
    funFact: "First recorded in 1888 by Scottish astronomer Williamina Fleming at the Harvard College Observatory on a photographic plate.",
  },
  {
    id: "m57",
    name: "Ring Nebula",
    commonName: "Ring Planetary Nebula",
    messierNgc: "M57 / NGC 6720",
    type: "planetary_nebula",
    typeLabel: "Planetary Nebula (Dying Star Shroud)",
    constellation: "Lyra",
    raDeg: 283.40,
    decDeg: 33.03,
    mag: 8.8,
    distanceLy: "2,570 Light Years",
    colorHex: "#2dd4bf",
    secondaryColorHex: "#f59e0b",
    description: "The prototype planetary nebula consisting of an expanding glowing shell of ionized gas expelled by a dying red giant star.",
    funFact: "At its exact center lies a faint white dwarf star with a scorching surface temperature exceeding 120,000 Kelvin.",
  },
  {
    id: "m27",
    name: "Dumbbell Nebula",
    commonName: "Apple Core Nebula",
    messierNgc: "M27 / NGC 6853",
    type: "planetary_nebula",
    typeLabel: "Bipolar Planetary Nebula",
    constellation: "Vulpecula",
    raDeg: 299.90,
    decDeg: 22.72,
    mag: 7.5,
    distanceLy: "1,360 Light Years",
    colorHex: "#38bdf8",
    secondaryColorHex: "#f43f5e",
    description: "The first planetary nebula ever discovered by Charles Messier in 1764, showcasing a distinct double-lobed hourglass shape.",
    funFact: "Its central white dwarf is one of the largest and most luminous known white dwarfs in our sector of the galaxy.",
  },
  {
    id: "m1",
    name: "Crab Nebula",
    commonName: "Supernova 1054 Remnant",
    messierNgc: "M1 / NGC 1952",
    type: "supernova_remnant",
    typeLabel: "Supernova Remnant & Pulsar Wind Nebula",
    constellation: "Taurus",
    raDeg: 83.63,
    decDeg: 22.01,
    mag: 8.4,
    distanceLy: "6,500 Light Years",
    colorHex: "#f59e0b",
    secondaryColorHex: "#f43f5e",
    description: "The expanding wreckage of a titanic supernova explosion recorded by Chinese, Japanese, and Arab astronomers in the year 1054 AD.",
    funFact: "At its core beats the Crab Pulsar—a rapidly spinning neutron star rotating 30 times every second, emitting lighthouse beams of radiation.",
  },
  {
    id: "m45",
    name: "Pleiades Nebula",
    commonName: "Seven Sisters Reflection Cloud",
    messierNgc: "M45",
    type: "reflection_nebula",
    typeLabel: "Stardust Reflection Nebula",
    constellation: "Taurus",
    raDeg: 56.85,
    decDeg: 24.12,
    mag: 1.6,
    distanceLy: "444 Light Years",
    colorHex: "#67e8f9",
    secondaryColorHex: "#818cf8",
    description: "A luminous blue reflection nebula enveloping the open star cluster of the Pleiades (Seven Sisters), scattering intense blue light from hot B-type stars.",
    funFact: "The gas cloud is not leftover from the stars' birth, but an unrelated interstellar dust cloud that the cluster is currently passing through at high speed.",
  },
  {
    id: "ngc7000",
    name: "North America Nebula",
    commonName: "North America Nebula",
    messierNgc: "NGC 7000 / Caldwell 20",
    type: "emission_nebula",
    typeLabel: "Giant Emission Nebula",
    constellation: "Cygnus",
    raDeg: 314.70,
    decDeg: 44.33,
    mag: 4.0,
    distanceLy: "2,590 Light Years",
    colorHex: "#e11d48",
    secondaryColorHex: "#f472b6",
    description: "A grand emission nebula in Cygnus near the star Deneb whose shape remarkably resembles the continent of North America, complete with a Gulf of Mexico.",
    funFact: "Separated from the Pelican Nebula by a dense foreground dark dust lane called the Cygnus Molecular Cloud.",
  },
  {
    id: "m31",
    name: "Andromeda Galaxy",
    commonName: "Great Andromeda Spiral",
    messierNgc: "M31 / NGC 224",
    type: "galaxy",
    typeLabel: "Major Spiral Galaxy (Local Group)",
    constellation: "Andromeda",
    raDeg: 10.68,
    decDeg: 41.27,
    mag: 3.44,
    distanceLy: "2,537,000 Light Years",
    colorHex: "#fef08a",
    secondaryColorHex: "#93c5fd",
    description: "The nearest major galaxy to the Milky Way, containing approximately one trillion stars spanning across 220,000 light-years in diameter.",
    funFact: "The Andromeda Galaxy is currently hurtling toward the Milky Way at 110 km/s and will merge with our galaxy in about 4.5 billion years to form 'Milkomeda'.",
  },
  {
    id: "lmc",
    name: "Large Magellanic Cloud",
    commonName: "LMC (Nubecula Major)",
    messierNgc: "ESO 56-115",
    type: "galaxy",
    typeLabel: "Satellite Dwarf Spiral Galaxy",
    constellation: "Dorado / Mensa",
    raDeg: 80.89,
    decDeg: -69.76,
    mag: 0.9,
    distanceLy: "163,000 Light Years",
    colorHex: "#e0e7ff",
    secondaryColorHex: "#ec4899",
    description: "A prominent satellite galaxy of the Milky Way visible to the naked eye in the southern hemisphere, home to the ferocious 30 Doradus (Tarantula) Nebula.",
    funFact: "It hosted Supernova 1987A, the closest observed supernova explosion since the invention of the telescope.",
  },
  {
    id: "smc",
    name: "Small Magellanic Cloud",
    commonName: "SMC (Nubecula Minor)",
    messierNgc: "NGC 292",
    type: "galaxy",
    typeLabel: "Dwarf Irregular Satellite Galaxy",
    constellation: "Tucana",
    raDeg: 13.19,
    decDeg: -72.83,
    mag: 2.7,
    distanceLy: "204,000 Light Years",
    colorHex: "#ddd6fe",
    secondaryColorHex: "#38bdf8",
    description: "A dwarf irregular galaxy containing several hundred million stars that orbits our Milky Way galaxy alongside the Large Magellanic Cloud.",
    funFact: "Henrietta Swan Leavitt discovered the fundamental Period-Luminosity relationship of Cepheid variable stars by observing stars in the SMC in 1908.",
  },
];

export interface RiseTransitSetResult {
  riseTime: string;
  transitTime: string;
  setTime: string;
  maxAltitudeDeg: number | null;
  hoursUntilRise: number | null;
  status: "normal" | "circumpolar" | "never_rises";
}

/**
 * Computes exact Rise, Upper Transit (Culmination), and Set times in the
 * selected observer location's true IANA timezone (never browser timezone).
 */
export function computeRiseTransitSet(
  target: {
    type: "sun" | "moon" | "planet" | "star" | "constellation" | "nebula" | "satellite";
    id: string;
    raDeg?: number;
    decDeg?: number;
    azimuthDeg: number;
    altitudeDeg: number;
  },
  location: ObserverLocation,
  date: Date,
): RiseTransitSetResult {
  const fmt = (d: Date | null) =>
    d ? formatObserverClock(d, location, false).time : "--:--";

  try {
    const obs = new Astronomy.Observer(
      location.latitude,
      location.longitude,
      location.elevationMeters ?? 0,
    );
    const time = Astronomy.MakeTime(date);

    // 1. Solar System Bodies (exact VSOP87 / ELP + refraction via astronomy-engine)
    const bodyMap: Record<string, Astronomy.Body> = {
      sun: Astronomy.Body.Sun,
      moon: Astronomy.Body.Moon,
      mercury: Astronomy.Body.Mercury,
      venus: Astronomy.Body.Venus,
      mars: Astronomy.Body.Mars,
      jupiter: Astronomy.Body.Jupiter,
      saturn: Astronomy.Body.Saturn,
      uranus: Astronomy.Body.Uranus,
      neptune: Astronomy.Body.Neptune,
    };
    const astroBody =
      target.type === "sun"
        ? Astronomy.Body.Sun
        : target.type === "moon"
          ? Astronomy.Body.Moon
          : target.type === "planet"
            ? bodyMap[target.id.toLowerCase()]
            : undefined;

    if (astroBody) {
      const rise = Astronomy.SearchRiseSet(astroBody, obs, +1, time, 1);
      const set = Astronomy.SearchRiseSet(astroBody, obs, -1, time, 1);
      const transit = Astronomy.SearchHourAngle(astroBody, obs, 0, time, +1);
      const hoursUntilRise = rise
        ? Math.max(0.05, (rise.date.getTime() - date.getTime()) / 3600000)
        : null;
      return {
        riseTime: fmt(rise?.date ?? null),
        transitTime: fmt(transit?.time.date ?? null),
        setTime: fmt(set?.date ?? null),
        maxAltitudeDeg: transit ? transit.hor.altitude : null,
        hoursUntilRise,
        status: !rise && !set ? (target.altitudeDeg >= 0 ? "circumpolar" : "never_rises") : "normal",
      };
    }

    // 2. Fixed Deep Sky Objects, Stars & Constellations — exact precessed RA/Dec of date
    const latRad = location.latitude * DEG2RAD;
    let raOfDateDeg: number;
    let decOfDateDeg: number;

    if (typeof target.raDeg === "number" && typeof target.decDeg === "number") {
      // Precess J2000 -> Equatorial of Date (EQD) for exact rise/transit/set
      const rotEqd = Astronomy.Rotation_EQJ_EQD(time);
      const r0 = target.raDeg * DEG2RAD;
      const d0 = target.decDeg * DEG2RAD;
      const vEqd = Astronomy.RotateVector(
        rotEqd,
        new Astronomy.Vector(Math.cos(d0) * Math.cos(r0), Math.cos(d0) * Math.sin(r0), Math.sin(d0), time),
      );
      const sph = Astronomy.SphereFromVector(vEqd);
      raOfDateDeg = sph.lon;
      decOfDateDeg = sph.lat;
    } else {
      // Fallback inverse from Az/Alt
      const altRad = target.altitudeDeg * DEG2RAD;
      const azRad = target.azimuthDeg * DEG2RAD;
      const sinDec = Math.sin(latRad) * Math.sin(altRad) + Math.cos(latRad) * Math.cos(altRad) * Math.cos(azRad);
      const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));
      const sinH = -Math.cos(altRad) * Math.sin(azRad);
      const cosH = Math.cos(latRad) * Math.sin(altRad) - Math.sin(latRad) * Math.cos(altRad) * Math.cos(azRad);
      const hDeg = (((Math.atan2(sinH, cosH) * RAD2DEG) % 360) + 360) % 360;
      const lstDeg = (((getGMST(date) + location.longitude) % 360) + 360) % 360;
      raOfDateDeg = (((lstDeg - hDeg) % 360) + 360) % 360;
      decOfDateDeg = decRad * RAD2DEG;
    }

    const decRad = decOfDateDeg * DEG2RAD;
    const maxAltitudeDeg = 90 - Math.abs(location.latitude - decOfDateDeg);

    // Current local hour angle H (0..360°, 0=transit, 0..180=setting West, 180..360=rising East)
    const lstDeg = (((getGMST(date) + location.longitude) % 360) + 360) % 360;
    const currentH = (((lstDeg - raOfDateDeg) % 360) + 360) % 360;

    // Sidereal rate: 15.04106864 deg / solar hour
    const SIDEREAL_DEG_PER_HR = 15.04106864;
    const hoursToTransit = ((360 - currentH) % 360) / SIDEREAL_DEG_PER_HR;
    const transitDate = new Date(date.getTime() + hoursToTransit * 3600000);

    // Standard astronomical horizon refraction h0 = -0.5667° (-34 arcmin)
    const h0Rad = -0.5667 * DEG2RAD;
    const cosH0 =
      (Math.sin(h0Rad) - Math.sin(latRad) * Math.sin(decRad)) /
      (Math.cos(latRad) * Math.cos(decRad) || 1e-9);

    if (cosH0 > 1) {
      return {
        riseTime: "Never Rises",
        transitTime: fmt(transitDate),
        setTime: "Never Rises",
        maxAltitudeDeg,
        hoursUntilRise: null,
        status: "never_rises",
      };
    }
    if (cosH0 < -1) {
      return {
        riseTime: "Circumpolar",
        transitTime: fmt(transitDate),
        setTime: "Circumpolar",
        maxAltitudeDeg,
        hoursUntilRise: 0,
        status: "circumpolar",
      };
    }

    const H0Deg = Math.acos(cosH0) * RAD2DEG;
    const riseH = (360 - H0Deg) % 360;
    const setH = H0Deg;

    const hoursToRise = (((riseH - currentH) % 360) + 360) % 360 / SIDEREAL_DEG_PER_HR;
    const hoursToSet = (((setH - currentH) % 360) + 360) % 360 / SIDEREAL_DEG_PER_HR;

    return {
      riseTime: fmt(new Date(date.getTime() + hoursToRise * 3600000)),
      transitTime: fmt(transitDate),
      setTime: fmt(new Date(date.getTime() + hoursToSet * 3600000)),
      maxAltitudeDeg,
      hoursUntilRise: Math.max(0.05, Math.round(hoursToRise * 10) / 10),
      status: "normal",
    };
  } catch {
    return {
      riseTime: "--:--",
      transitTime: "--:--",
      setTime: "--:--",
      maxAltitudeDeg: null,
      hoursUntilRise: null,
      status: "normal",
    };
  }
}

export function computeTopocentricNebulae(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 480,
  elevationMeters: number = 0,
): TopocentricNebula[] {
  const rot = createEqjToHorMatrix(date, latDeg, lngDeg, elevationMeters);
  const result: TopocentricNebula[] = [];

  for (const neb of FAMOUS_NEBULAE) {
    const proj = projectJ2000ToHorizontal(neb.raDeg, neb.decDeg, rot, domeRadius, true);

    result.push({
      ...neb,
      altitudeDeg: proj.altDeg,
      azimuthDeg: proj.azDeg,
      isVisibleAboveHorizon: proj.altDeg >= 0,
      pos3D: { x: proj.x, y: proj.y, z: proj.z },
    });
  }

  return result;
}
