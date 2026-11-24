import { NextRequest, NextResponse } from "next/server";
import * as satellite from "satellite.js";
import { getSatelliteById } from "@/lib/satellites/satelliteCatalog";
import {
  computeSubsolarPoint,
  computeSatelliteLighting,
  parseTleMetadata,
  generateSgp4GroundTrack,
  type TleMetadata,
} from "@/lib/satellites/sgp4Precision";

export interface RealISSPayload {
  id: string;
  name: string;
  fullName: string;
  noradId: number;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/h
  visibility: "sunlit" | "eclipsed" | string;
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
  tle: {
    line1: string;
    line2: string;
    source: "celestrak_live" | "fallback_tle";
  };
  keplerian: TleMetadata;
}

const cachedTLEMap = new Map<
  number,
  { line1: string; line2: string; source: "celestrak_live" | "fallback_tle"; expiresAt: number }
>();

/**
 * Fetch live NORAD GP TLE from CelesTrak (1h cache) or fall back to verified bundled TLE
 */
async function getSatelliteTle(
  noradId: number,
  defaultLine1: string,
  defaultLine2: string,
): Promise<{ line1: string; line2: string; source: "celestrak_live" | "fallback_tle" }> {
  const now = Date.now();
  const existing = cachedTLEMap.get(noradId);
  if (existing && existing.expiresAt > now) {
    return { line1: existing.line1, line2: existing.line2, source: existing.source };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
      { signal: controller.signal, next: { revalidate: 3600 } },
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const lines = text
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length >= 2) {
        const l1 = lines[lines.length - 2];
        const l2 = lines[lines.length - 1];
        if (l1.startsWith("1 ") && l2.startsWith("2 ")) {
          cachedTLEMap.set(noradId, {
            line1: l1,
            line2: l2,
            source: "celestrak_live",
            expiresAt: now + 3600 * 1000,
          });
          return { line1: l1, line2: l2, source: "celestrak_live" };
        }
      }
    }
  } catch {
    // Fall back gracefully when offline or CelesTrak rate-limited
  }

  return { line1: defaultLine1, line2: defaultLine2, source: "fallback_tle" };
}

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

  const tleRecord = await getSatelliteTle(
    satInfo.noradId,
    satInfo.defaultTle.line1,
    satInfo.defaultTle.line2,
  );
  const satrec = satellite.twoline2satrec(tleRecord.line1, tleRecord.line2);
  const nowDate = new Date(now);
  const pv = satellite.propagate(satrec, nowDate);

  if (!pv || !pv.position || typeof pv.position === "boolean") {
    return NextResponse.json({ error: "SGP4 propagation failed" }, { status: 500 });
  }

  const posEci = pv.position as satellite.EciVec3<number>;
  const gmst = satellite.gstime(nowDate);
  const gd = satellite.eciToGeodetic(posEci, gmst);

  const latitude = parseFloat(satellite.degreesLat(gd.latitude).toFixed(6));
  const longitude = parseFloat(satellite.degreesLong(gd.longitude).toFixed(6));
  const altitude = parseFloat(gd.height.toFixed(2));

  let velocity = 27580;
  if (pv.velocity && typeof pv.velocity !== "boolean") {
    const v = pv.velocity as satellite.EciVec3<number>;
    velocity = parseFloat((Math.hypot(v.x, v.y, v.z) * 3600).toFixed(2));
  }

  // Exact solar subpoint & Earth umbra shadow geometry (zero hardcoding)
  const solar = computeSubsolarPoint(nowDate);
  const lighting = computeSatelliteLighting(posEci, solar.sunUnitEci);
  const keplerian = parseTleMetadata(tleRecord.line1, tleRecord.line2, now);
  const { pastTrail, futureOrbit } = generateSgp4GroundTrack(satrec, now, 45, 95, 60);

  const Re = 6371;
  const alpha = Math.acos(Math.min(1, Re / (Re + Math.max(1, altitude))));
  const footprintKm = Math.round(alpha * Re * 2);

  // Julian Date
  const daynum = now / 86400000 + 2440587.5;

  const payload: RealISSPayload = {
    id: satInfo.id,
    name: satInfo.name,
    fullName: satInfo.fullName,
    noradId: satInfo.noradId,
    latitude,
    longitude,
    altitude,
    velocity,
    visibility: lighting,
    footprint: footprintKm,
    timestamp: now,
    daynum,
    solar_lat: parseFloat(solar.solarLatDeg.toFixed(4)),
    solar_lon: parseFloat(solar.solarLonDeg.toFixed(4)),
    units: "kilometers",
    categoryLabel: satInfo.categoryLabel,
    agency: satInfo.agency,
    iconSvg: satInfo.iconSvg,
    themeColor: satInfo.themeColor,
    orbitTrail: pastTrail,
    futureOrbit,
    tle: {
      line1: tleRecord.line1,
      line2: tleRecord.line2,
      source: tleRecord.source,
    },
    keplerian,
  };

  payloadCache.set(satInfo.id, { data: payload, expiresAt: now + 1500 });
  return NextResponse.json(payload);
}
