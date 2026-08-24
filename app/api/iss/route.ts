import { NextRequest, NextResponse } from "next/server";
import * as satellite from "satellite.js";
import { SATELLITE_CATALOG, getSatelliteById } from "@/lib/satellites/satelliteCatalog";

export interface RealISSPayload {
  id: string;
  name: string;
  fullName: string;
  noradId: number;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/h
  visibility: string;
  footprint: number;
  timestamp: number;
  daynum: number;
  solar_lat: number;
  solar_lon: number;
  units: string;
  categoryLabel: string;
  agency: string;
  iconSvg: string;
  themeColor: string;
  orbitTrail: { lat: number; lon: number }[];
  futureOrbit: { lat: number; lon: number }[];
}

// In-memory cache for TLEs keyed by NORAD ID
const cachedTLEMap = new Map<number, { line1: string; line2: string; expiresAt: number }>();

/**
 * Fetch live NORAD TLE from CelesTrak or fall back to default
 */
async function getSatelliteTLERecord(noradId: number, defaultLine1: string, defaultLine2: string) {
  const now = Date.now();
  const existing = cachedTLEMap.get(noradId);
  if (existing && existing.expiresAt > now) {
    return satellite.twoline2satrec(existing.line1, existing.line2);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
      { signal: controller.signal, next: { revalidate: 3600 } }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split("\n").map((l) => l.trim());
      if (lines.length >= 2) {
        const l1 = lines[lines.length - 2];
        const l2 = lines[lines.length - 1];
        if (l1.startsWith("1 ") && l2.startsWith("2 ")) {
          cachedTLEMap.set(noradId, { line1: l1, line2: l2, expiresAt: now + 3600 * 1000 });
          return satellite.twoline2satrec(l1, l2);
        }
      }
    }
  } catch {
    // ignore, fall back to default
  }

  return satellite.twoline2satrec(defaultLine1, defaultLine2);
}

/**
 * Propagate SGP4 satellite position at a specific Date
 */
function getSGP4Position(satrec: satellite.SatRec, date: Date) {
  const positionAndVelocity = satellite.propagate(satrec, date);
  if (!positionAndVelocity || !positionAndVelocity.position || typeof positionAndVelocity.position === "boolean") {
    return null;
  }

  const gmst = satellite.gstime(date);
  const positionGd = satellite.eciToGeodetic(
    positionAndVelocity.position as satellite.EciVec3<number>,
    gmst
  );

  const lat = satellite.degreesLat(positionGd.latitude);
  const lon = satellite.degreesLong(positionGd.longitude);
  const alt = positionGd.height; // km

  let velKmH = 27580;
  if (positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== "boolean") {
    const v = positionAndVelocity.velocity as satellite.EciVec3<number>;
    const speedKmS = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    velKmH = parseFloat((speedKmS * 3600).toFixed(2));
  }

  return {
    lat: parseFloat(lat.toFixed(6)),
    lon: parseFloat(lon.toFixed(6)),
    alt: parseFloat(alt.toFixed(2)),
    velocity: velKmH,
  };
}

/**
 * Generate mathematically exact SGP4 orbital tracks that connect seamlessly
 * at dt = 0 with current satellite coordinates.
 */
function generateSGP4Tracks(satrec: satellite.SatRec, nowMs: number) {
  const pastTrail: { lat: number; lon: number }[] = [];
  const futureTrail: { lat: number; lon: number }[] = [];

  // Past 45 minutes (step 1 min) up to dt = 0 (now)
  for (let dtMin = -45; dtMin <= 0; dtMin += 1) {
    const t = new Date(nowMs + dtMin * 60 * 1000);
    const pos = getSGP4Position(satrec, t);
    if (pos) {
      pastTrail.push({ lat: pos.lat, lon: pos.lon });
    }
  }

  // Future 92 minutes (step 1 min) starting from dt = 0 (now)
  for (let dtMin = 0; dtMin <= 92; dtMin += 1) {
    const t = new Date(nowMs + dtMin * 60 * 1000);
    const pos = getSGP4Position(satrec, t);
    if (pos) {
      futureTrail.push({ lat: pos.lat, lon: pos.lon });
    }
  }

  return { pastTrail, futureTrail };
}

// In-memory cache for API responses keyed by satellite ID
const payloadCache = new Map<string, { data: RealISSPayload; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const satId = searchParams.get("id") || searchParams.get("norad") || "iss";
  const now = Date.now();

  const satInfo = getSatelliteById(satId);

  const cached = payloadCache.get(satInfo.id);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  const satrec = await getSatelliteTLERecord(
    satInfo.noradId,
    satInfo.defaultTle.line1,
    satInfo.defaultTle.line2
  );
  const currentPos = getSGP4Position(satrec, new Date(now));

  if (!currentPos) {
    return NextResponse.json({ error: "SGP4 calculation failed" }, { status: 500 });
  }

  const { pastTrail, futureTrail } = generateSGP4Tracks(satrec, now);

  // Compute visibility footprint (km) on Earth's surface
  const Re = 6371;
  const alpha = Math.acos(Re / (Re + currentPos.alt));
  const footprintKm = Math.round(alpha * Re * 2);

  const payload: RealISSPayload = {
    id: satInfo.id,
    name: satInfo.name,
    fullName: satInfo.fullName,
    noradId: satInfo.noradId,
    latitude: currentPos.lat,
    longitude: currentPos.lon,
    altitude: currentPos.alt,
    velocity: currentPos.velocity,
    visibility: "daylight",
    footprint: footprintKm,
    timestamp: now,
    daynum: 0,
    solar_lat: 0,
    solar_lon: 0,
    units: "kilometers",
    categoryLabel: satInfo.categoryLabel,
    agency: satInfo.agency,
    iconSvg: satInfo.iconSvg,
    themeColor: satInfo.themeColor,
    orbitTrail: pastTrail,
    futureOrbit: futureTrail,
  };

  payloadCache.set(satInfo.id, { data: payload, expiresAt: now + 1500 });
  return NextResponse.json(payload);
}
