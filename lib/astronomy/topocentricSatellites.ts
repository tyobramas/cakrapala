import * as satellite from "satellite.js";
import rawCatalog from "@/public/data/active-satellites-1000.json";

export interface TopocentricSatellite {
  id: string;
  noradId: number;
  name: string;
  category: "station" | "telescope" | "starlink" | "weather" | "science" | "navigation" | "comms" | "other";
  categoryLabel: string;
  azimuthDeg: number;
  altitudeDeg: number;
  rangeKm: number;
  altitudeKm: number;
  speedKmS: number;
  speedKmH: number;
  isSunlit: boolean;
  isVisibleAboveHorizon: boolean;
  pos3D: { x: number; y: number; z: number };
  colorHex: string;
  intlDesig: string;
  trail?: { x: number; y: number; z: number; az: number; alt: number }[];
}

interface PreparedSat {
  noradId: number;
  name: string;
  intlDesig: string;
  category: TopocentricSatellite["category"];
  categoryLabel: string;
  colorHex: string;
  satrec: satellite.SatRec;
}

function categorizeSatellite(name: string, noradId: number): {
  category: TopocentricSatellite["category"];
  categoryLabel: string;
  colorHex: string;
} {
  const n = name.toUpperCase();
  if (n.includes("ISS") || n.includes("ZARYA") || n.includes("TIANHE") || n.includes("CSS") || n.includes("TIANGONG") || noradId === 25544) {
    return { category: "station", categoryLabel: "Space Station", colorHex: "#10b981" }; // Emerald
  }
  if (n.includes("HST") || n.includes("HUBBLE") || n.includes("JWST") || n.includes("SPITZER") || n.includes("CHANDRA") || n.includes("FERMI") || n.includes("SWIFT")) {
    return { category: "telescope", categoryLabel: "Space Telescope", colorHex: "#38bdf8" }; // Cyan
  }
  if (n.includes("STARLINK")) {
    return { category: "starlink", categoryLabel: "Starlink Megaconstellation", colorHex: "#c084fc" }; // Purple
  }
  if (n.includes("NOAA") || n.includes("METEOSAT") || n.includes("GOES") || n.includes("HIMAWARI") || n.includes("FENGYUN") || n.includes("ELEKTRO") || n.includes("EWS")) {
    return { category: "weather", categoryLabel: "Meteorological / Weather", colorHex: "#fb923c" }; // Amber
  }
  if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("TERRA") || n.includes("AQUA") || n.includes("ENVISAT") || n.includes("ALOS") || n.includes("CRYOSAT")) {
    return { category: "science", categoryLabel: "Earth Observation & Science", colorHex: "#34d399" }; // Mint
  }
  if (n.includes("NAVSTAR") || n.includes("GPS") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU") || n.includes("QZSS") || n.includes("IRNSS")) {
    return { category: "navigation", categoryLabel: "GNSS / Navigation", colorHex: "#60a5fa" }; // Blue
  }
  if (n.includes("IRIDIUM") || n.includes("ONEWEB") || n.includes("INTELSAT") || n.includes("SES") || n.includes("EUTELSAT") || n.includes("TELKOM") || n.includes("INMARSAT")) {
    return { category: "comms", categoryLabel: "Communications", colorHex: "#f472b6" }; // Pink
  }
  return { category: "other", categoryLabel: "Orbital Satellite", colorHex: "#94a3b8" }; // Slate
}

// Prepare satrec records once in memory
let preparedSatellitesCache: PreparedSat[] | null = null;

export function getPreparedSatellites(): PreparedSat[] {
  if (preparedSatellitesCache) return preparedSatellitesCache;

  const result: PreparedSat[] = [];
  for (const s of rawCatalog as Array<{ NORAD_CAT_ID: number; OBJECT_NAME?: string; INTLDES?: string }>) {
    try {
      const satrec = satellite.json2satrec(s as unknown as satellite.OMMJsonObject);
      if (satrec && satrec.error === 0) {
        const name = s.OBJECT_NAME || `SAT-${s.NORAD_CAT_ID}`;
        const noradId = s.NORAD_CAT_ID;
        const meta = categorizeSatellite(name, noradId);
        result.push({
          noradId,
          name,
          intlDesig: s.INTLDES || "",
          category: meta.category,
          categoryLabel: meta.categoryLabel,
          colorHex: meta.colorHex,
          satrec,
        });
      }
    } catch {
      // Ignore corrupted TLE record
    }
  }

  preparedSatellitesCache = result;
  return result;
}

function azAltToVec3(azDeg: number, altDeg: number, r: number): { x: number; y: number; z: number } {
  const az = (azDeg * Math.PI) / 180;
  const alt = (altDeg * Math.PI) / 180;
  const ca = Math.cos(alt);
  return {
    x: -r * ca * Math.sin(az), // East = -X
    y: r * Math.sin(alt),
    z: r * ca * Math.cos(az),
  };
}

/**
 * Computes all topocentric visible satellites over the observer's horizon for a specific timestamp.
 */
export function computeTopocentricSatellites(
  date: Date,
  latDeg: number,
  lngDeg: number,
  elevationMeters: number = 260,
  domeRadius: number = 475,
  selectedSatId?: string | number | null
): {
  satellites: TopocentricSatellite[];
  totalAboveHorizon: number;
  spaceStationsCount: number;
} {
  const catalog = getPreparedSatellites();
  const gmst = satellite.gstime(date);
  const observerGd: satellite.GeodeticLocation = {
    latitude: latDeg * (Math.PI / 180),
    longitude: lngDeg * (Math.PI / 180),
    height: elevationMeters / 1000,
  };

  const results: TopocentricSatellite[] = [];
  let spaceStationsCount = 0;

  for (let i = 0; i < catalog.length; i++) {
    const sat = catalog[i];
    const pv = satellite.propagate(sat.satrec, date);
    if (!pv || !pv.position || !pv.velocity) continue;
    if (typeof pv.position === "boolean") continue;

    const posEci = pv.position as satellite.EciVec3<number>;
    const velEci = pv.velocity as satellite.EciVec3<number>;

    const ecf = satellite.eciToEcf(posEci, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    const altDeg = look.elevation * (180 / Math.PI);
    const azDeg = ((look.azimuth * (180 / Math.PI)) % 360 + 360) % 360;

    // Filter for satellites above horizon (or just rising/setting within -1 deg)
    if (altDeg >= -1.0) {
      const rKm = Math.sqrt(posEci.x * posEci.x + posEci.y * posEci.y + posEci.z * posEci.z);
      const speedKmS = Math.sqrt(velEci.x * velEci.x + velEci.y * velEci.y + velEci.z * velEci.z);
      const altitudeKm = Math.max(100, rKm - 6371);
      const speedKmH = Math.round(speedKmS * 3600);

      if (sat.category === "station") {
        spaceStationsCount++;
      }

      // Check if this satellite should have an orbital pass trajectory rendered
      let trail: TopocentricSatellite["trail"] = undefined;
      const isSelected = selectedSatId && (selectedSatId === sat.noradId || selectedSatId === `sat_${sat.noradId}`);
      if (sat.category === "station" || sat.category === "telescope" || isSelected || (altDeg > 20 && results.length < 12)) {
        trail = [];
        // Sample -6 min to +6 min in 1-min increments
        for (let dt = -6; dt <= 6; dt += 1) {
          const tSample = new Date(date.getTime() + dt * 60000);
          const pvSample = satellite.propagate(sat.satrec, tSample);
          if (pvSample && pvSample.position && typeof pvSample.position !== "boolean") {
            const gmstSample = satellite.gstime(tSample);
            const ecfSample = satellite.eciToEcf(pvSample.position as satellite.EciVec3<number>, gmstSample);
            const lookSample = satellite.ecfToLookAngles(observerGd, ecfSample);
            const aDeg = lookSample.elevation * (180 / Math.PI);
            const zDeg = ((lookSample.azimuth * (180 / Math.PI)) % 360 + 360) % 360;
            if (aDeg >= -2.0) {
              const p3d = azAltToVec3(zDeg, aDeg, domeRadius - 2);
              trail.push({ x: p3d.x, y: p3d.y, z: p3d.z, az: zDeg, alt: aDeg });
            }
          }
        }
      }

      results.push({
        id: `sat_${sat.noradId}`,
        noradId: sat.noradId,
        name: sat.name,
        category: sat.category,
        categoryLabel: sat.categoryLabel,
        azimuthDeg: azDeg,
        altitudeDeg: altDeg,
        rangeKm: Math.round(look.rangeSat),
        altitudeKm: Math.round(altitudeKm),
        speedKmS: Number(speedKmS.toFixed(2)),
        speedKmH,
        isSunlit: true, // LEO satellites in twilight/night are sunlit
        isVisibleAboveHorizon: altDeg > 0,
        pos3D: azAltToVec3(azDeg, altDeg, domeRadius - 4),
        colorHex: sat.colorHex,
        intlDesig: sat.intlDesig,
        trail: trail && trail.length >= 2 ? trail : undefined,
      });
    }
  }

  // Sort: Space stations and telescopes first, then highest altitude in the sky
  results.sort((a, b) => {
    if (a.category === "station" && b.category !== "station") return -1;
    if (b.category === "station" && a.category !== "station") return 1;
    if (a.category === "telescope" && b.category !== "telescope") return -1;
    if (b.category === "telescope" && a.category !== "telescope") return 1;
    return b.altitudeDeg - a.altitudeDeg;
  });

  return {
    satellites: results,
    totalAboveHorizon: results.length,
    spaceStationsCount,
  };
}
