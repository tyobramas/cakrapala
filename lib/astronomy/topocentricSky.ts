/**
 * Topocentric Horizontal Astronomy Engine for Ground Sky Observatory.
 *
 * Uses `astronomy-engine` (VSOP87/ELP) for precise Sun, Moon, and Planet ephemeris.
 * Computes topocentric horizontal coordinates (Altitude, Azimuth) for:
 * - Yale BSC5 Bright Stars with Johnson B-V Color Index Spectral Mapping
 * - Full IAU Constellations with Authentic Stellarium-grade Stick Figures
 * - The Moon with Real Topocentric Ephemeris + Phase Rendering
 * - 5 Visible Naked-Eye Planets (Mercury, Venus, Mars, Jupiter, Saturn)
 * - The Sun and Twilight Solar Elevation
 * - Photorealistic Galactic Plane / Milky Way Coordinate Mapping (J2000)
 */

import starCatalogData from "@/public/data/stars-bsc5.json";
import * as Astronomy from "astronomy-engine";

export interface ObserverLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
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
  altitudeDeg: number;
  azimuthDeg: number;
  isVisibleAboveHorizon: boolean;
  pos3D: { x: number; y: number; z: number };
  /** Moon phase angle in degrees (0 = new, 90 = first quarter, 180 = full, 270 = last quarter) */
  phaseDeg?: number;
  /** Illuminated fraction of the Moon's disk (0.0 = new moon, 1.0 = full moon) */
  illuminationFraction?: number;
}

export interface Constellation3D {
  name: string;
  abbreviation: string;
  centerPos3D: { x: number; y: number; z: number };
  isVisible: boolean;
  segments: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][];
}

export interface MilkyWayStreamPoint {
  azimuthDeg: number;
  altitudeDeg: number;
  isCore: boolean;
}

export const PRESET_CITIES: ObserverLocation[] = [
  { name: "Bogor", country: "Indonesia (Default)", latitude: -6.595, longitude: 106.8166, timezoneOffsetHours: 7 },
  { name: "Special Capital Region of Jakarta", country: "Indonesia", latitude: -6.2088, longitude: 106.8456, timezoneOffsetHours: 7 },
  { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.006, timezoneOffsetHours: -4 },
  { name: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278, timezoneOffsetHours: 1 },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezoneOffsetHours: 9 },
  { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093, timezoneOffsetHours: 10 },
  { name: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357, timezoneOffsetHours: 3 },
  { name: "Reykjavik", country: "Iceland (Aurora Hub)", latitude: 64.1466, longitude: -21.9426, timezoneOffsetHours: 0 },
  { name: "Rio de Janeiro", country: "Brazil", latitude: -22.9068, longitude: -43.1729, timezoneOffsetHours: -3 },
  { name: "Mauna Kea Observatory", country: "Hawaii, USA", latitude: 19.8206, longitude: -155.4681, timezoneOffsetHours: -10 },
];

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
  const jd = getJulianDate(date);
  const n = jd - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) * (Math.PI / 180);
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (Math.PI / 180);
  const epsilon = (23.439 - 0.0000004 * n) * (Math.PI / 180);
  const decRad = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  const gmst = getGMST(date);
  const y = Math.cos(epsilon) * Math.sin(lambda);
  const x = Math.cos(lambda);
  let raDeg = Math.atan2(y, x) * (180 / Math.PI);
  if (raDeg < 0) raDeg += 360;

  const sunLng = (-(gmst - raDeg) % 360 + 540) % 360 - 180;

  const points: { lng: number; lat: number }[] = [];
  const steps = 90;

  for (let i = 0; i <= steps; i++) {
    const lng = -180 + (i / steps) * 360;
    const haRad = (lng - sunLng) * (Math.PI / 180);
    const tanSunLat = Math.tan(decRad);
    let termLatDeg = 0;
    if (Math.abs(tanSunLat) > 0.0001) {
      const termLatRad = Math.atan(-Math.cos(haRad) / tanSunLat);
      termLatDeg = termLatRad * (180 / Math.PI);
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
  domeRadius: number = 500
): TopocentricStar[] {
  const gmst = getGMST(date);
  const lstDeg = ((gmst + lngDeg) % 360 + 360) % 360;
  const latRad = latDeg * (Math.PI / 180);

  const result: TopocentricStar[] = [];
  const rawStars = (starCatalogData as any).stars || [];

  for (const star of rawStars) {
    const raDeg = star.rightAscensionDegrees;
    const decDeg = star.declinationDegrees;
    const decRad = decDeg * (Math.PI / 180);

    const H = ((lstDeg - raDeg) % 360 + 360) % 360;
    const HRad = H * (Math.PI / 180);

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = altRad * (180 / Math.PI);

    const cosAlt = Math.cos(altRad);
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
    let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(HRad) > 0) {
      azRad = 2 * Math.PI - azRad;
    }
    const azDeg = azRad * (180 / Math.PI);

    const x = domeRadius * Math.cos(altRad) * Math.sin(azRad);
    const y = domeRadius * Math.sin(altRad);
    const z = domeRadius * Math.cos(altRad) * Math.cos(azRad);

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
      altitudeDeg: altDeg,
      azimuthDeg: azDeg,
      isVisibleAboveHorizon: altDeg >= 0,
      colorHex,
      pos3D: { x, y, z },
    });
  }

  return result;
}

export function computeTopocentricBodies(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 500
): { moon: TopocentricBody; planets: TopocentricBody[] } {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lngDeg, 0);

  // Helper: astronomy-engine body -> topocentric (Az, Alt, pos3D)
  function bodyToHorizontal(body: Astronomy.Body): { altDeg: number; azDeg: number; altRad: number; azRad: number } {
    const eq = Astronomy.Equator(body, time, obs, true, true);
    const hor = Astronomy.Horizon(time, obs, eq.ra, eq.dec, 'normal');
    return {
      altDeg: hor.altitude,
      azDeg: hor.azimuth,
      altRad: hor.altitude * (Math.PI / 180),
      azRad: hor.azimuth * (Math.PI / 180),
    };
  }

  function makePos3D(altRad: number, azRad: number): { x: number; y: number; z: number } {
    return {
      x: domeRadius * Math.cos(altRad) * Math.sin(azRad),
      y: domeRadius * Math.sin(altRad),
      z: domeRadius * Math.cos(altRad) * Math.cos(azRad),
    };
  }

  // 1. Moon — Precise ELP Ephemeris + Phase & Illumination
  const moonPos = bodyToHorizontal(Astronomy.Body.Moon);
  const moonPhaseDeg = Astronomy.MoonPhase(time); // 0=new, 90=Q1, 180=full, 270=Q3
  const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, time);

  const moonBody: TopocentricBody = {
    id: "moon",
    name: "Moon",
    mag: -12.5,
    colorHex: "#f8fafc",
    altitudeDeg: moonPos.altDeg,
    azimuthDeg: moonPos.azDeg,
    isVisibleAboveHorizon: moonPos.altDeg >= 0,
    pos3D: makePos3D(moonPos.altRad, moonPos.azRad),
    phaseDeg: moonPhaseDeg,
    illuminationFraction: moonIllum.phase_fraction,
  };

  // 2. Visible Planets — Precise VSOP87 Ephemeris
  const planetDefs = [
    { id: "mercury", name: "Mercury", body: Astronomy.Body.Mercury, color: "#cbd5e1" },
    { id: "venus",   name: "Venus",   body: Astronomy.Body.Venus,   color: "#fef08a" },
    { id: "mars",    name: "Mars",    body: Astronomy.Body.Mars,    color: "#f87171" },
    { id: "jupiter", name: "Jupiter", body: Astronomy.Body.Jupiter, color: "#fcd34d" },
    { id: "saturn",  name: "Saturn",  body: Astronomy.Body.Saturn,  color: "#fed7aa" },
  ];

  const planets: TopocentricBody[] = [];
  for (const p of planetDefs) {
    const pos = bodyToHorizontal(p.body);
    // Get visual magnitude from astronomy-engine
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
      altitudeDeg: pos.altDeg,
      azimuthDeg: pos.azDeg,
      isVisibleAboveHorizon: pos.altDeg >= 0,
      pos3D: makePos3D(pos.altRad, pos.azRad),
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
  try {
    // Dynamic import for constellation data
    const data = require("@/public/data/constellations.json");
    cachedConstellationData = data.constellations || [];
    return cachedConstellationData!;
  } catch {
    return [];
  }
}

function raDecToPos3D(
  raDeg: number,
  decDeg: number,
  lstDeg: number,
  latRad: number,
  radius: number
): { x: number; y: number; z: number; altDeg: number } {
  const decRad = decDeg * (Math.PI / 180);

  const H = ((lstDeg - raDeg) % 360 + 360) % 360;
  const HRad = H * (Math.PI / 180);

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altDeg = altRad * (180 / Math.PI);

  const cosAlt = Math.cos(altRad);
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
  let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(HRad) > 0) azRad = 2 * Math.PI - azRad;

  return {
    x: radius * cosAlt * Math.sin(azRad),
    y: radius * Math.sin(altRad),
    z: radius * cosAlt * Math.cos(azRad),
    altDeg,
  };
}

export function computeIAUConstellations(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 500
): Constellation3D[] {
  const gmst = getGMST(date);
  const lstDeg = ((gmst + lngDeg) % 360 + 360) % 360;
  const latRad = latDeg * (Math.PI / 180);

  const constData = getConstellationData();
  const result: Constellation3D[] = [];

  for (const c of constData) {
    const segments: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][] = [];
    const points: { x: number; y: number; z: number }[] = [];
    let totalAlt = 0;
    let count = 0;

    for (const seg of c.segments) {
      const p1 = raDecToPos3D(seg.ra1, seg.dec1, lstDeg, latRad, domeRadius);
      const p2 = raDecToPos3D(seg.ra2, seg.dec2, lstDeg, latRad, domeRadius);

      segments.push([
        { x: p1.x, y: p1.y, z: p1.z },
        { x: p2.x, y: p2.y, z: p2.z },
      ]);
      points.push({ x: p1.x, y: p1.y, z: p1.z }, { x: p2.x, y: p2.y, z: p2.z });
      totalAlt += p1.altDeg + p2.altDeg;
      count += 2;
    }

    if (segments.length === 0) continue;

    let avgX = 0, avgY = 0, avgZ = 0;
    for (const p of points) {
      avgX += p.x;
      avgY += p.y;
      avgZ += p.z;
    }
    const len = points.length || 1;
    avgX /= len;
    avgY /= len;
    avgZ /= len;

    const avgAlt = totalAlt / (count || 1);
    const isVisible = avgAlt > -15;

    result.push({
      name: c.name,
      abbreviation: c.abbreviation,
      centerPos3D: { x: avgX, y: avgY, z: avgZ },
      isVisible,
      segments,
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

export function computeTopocentricNebulae(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 480
): TopocentricNebula[] {
  const gmst = getGMST(date);
  const lstDeg = ((gmst + lngDeg) % 360 + 360) % 360;
  const latRad = latDeg * (Math.PI / 180);

  const result: TopocentricNebula[] = [];

  for (const neb of FAMOUS_NEBULAE) {
    const raDeg = neb.raDeg;
    const decDeg = neb.decDeg;
    const decRad = decDeg * (Math.PI / 180);

    const H = ((lstDeg - raDeg) % 360 + 360) % 360;
    const HRad = H * (Math.PI / 180);

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = altRad * (180 / Math.PI);

    const cosAlt = Math.cos(altRad);
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
    let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(HRad) > 0) {
      azRad = 2 * Math.PI - azRad;
    }
    const azDeg = azRad * (180 / Math.PI);

    const x = domeRadius * Math.cos(altRad) * Math.sin(azRad);
    const y = domeRadius * Math.sin(altRad);
    const z = domeRadius * Math.cos(altRad) * Math.cos(azRad);

    result.push({
      ...neb,
      altitudeDeg: altDeg,
      azimuthDeg: azDeg,
      isVisibleAboveHorizon: altDeg >= 0,
      pos3D: { x, y, z },
    });
  }

  return result;
}
