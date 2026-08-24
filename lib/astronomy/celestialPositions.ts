/**
 * Celestial body position calculations for Cakrapala.
 *
 * Wraps astronomy-engine (MIT, Don Cross) to compute topocentric
 * equatorial (RA/Dec) and horizontal (Az/Alt) coordinates for the Sun, Moon,
 * and visible planets.
 *
 * ACCURACY NOTE:
 *   astronomy-engine is verified against JPL Horizons to sub-arcsecond accuracy
 *   for most bodies. Results include atmospheric refraction ("normal" model).
 *   Do NOT claim sub-arcminute accuracy without cross-checking for the specific
 *   date/location.
 *
 * COORDINATE CONVENTIONS (all public functions):
 *   - Input:  latitude/longitude in decimal degrees.
 *             elevation in metres.
 *             time as a UTC `Date` object.
 *   - Output: azimuth in degrees clockwise from North (0–360°).
 *             altitude in degrees above (+) / below (–) horizon (–90° to +90°).
 *             RA in hours (0–24 h).
 *             declination in degrees (–90° to +90°).
 *
 * CUSTOM ALGORITHMS: None. All calculations delegate to astronomy-engine.
 */

import * as Astronomy from "astronomy-engine";
import { clampToAstronomyRange } from "./time";
import type {
  ObserverLocation,
  CelestialBodyPosition,
  CelestialBodyId,
  HorizontalPosition,
  EquatorialPosition,
} from "./types";

// ── Body registry ─────────────────────────────────────────────────────────────

/**
 * Maps our canonical (lowercase) CelestialBodyId to the astronomy-engine Body enum.
 * CelestialBodyId MUST be lowercase; display names come from CELESTIAL_BODY_LABELS.
 */
const TRACKED_BODIES: Array<{
  id: CelestialBodyId;
  name: string;
  body: Astronomy.Body;
}> = [
  { id: "sun",     name: "Sun",     body: Astronomy.Body.Sun     },
  { id: "moon",    name: "Moon",    body: Astronomy.Body.Moon    },
  { id: "mercury", name: "Mercury", body: Astronomy.Body.Mercury },
  { id: "venus",   name: "Venus",   body: Astronomy.Body.Venus   },
  { id: "mars",    name: "Mars",    body: Astronomy.Body.Mars    },
  { id: "jupiter", name: "Jupiter", body: Astronomy.Body.Jupiter },
  { id: "saturn",  name: "Saturn",  body: Astronomy.Body.Saturn  },
  { id: "uranus",  name: "Uranus",  body: Astronomy.Body.Uranus  },
  { id: "neptune", name: "Neptune", body: Astronomy.Body.Neptune },
];

// ── Internal helpers ──────────────────────────────────────────────────────────

function toAstroObserver(loc: ObserverLocation): Astronomy.Observer {
  return new Astronomy.Observer(loc.latitude, loc.longitude, loc.elevationMeters);
}

/**
 * Compute topocentric equatorial coordinates (RA/Dec).
 * ofdate=true (apparent position for the current epoch).
 * aberration=true (corrects for stellar aberration).
 */
function computeEquatorial(
  body: Astronomy.Body,
  date: Date,
  astroObs: Astronomy.Observer
): EquatorialPosition {
  const eq = Astronomy.Equator(body, date, astroObs, true, true);
  return {
    raHours: eq.ra,  // astronomy-engine returns RA in hours
    decDeg: eq.dec,  // astronomy-engine returns Dec in degrees
  };
}

/**
 * Compute topocentric horizontal coordinates (Az/Alt).
 * Atmospheric refraction model: "normal" (standard sea-level correction).
 * Azimuth: clockwise from North (0–360°).
 */
function computeHorizontal(
  date: Date,
  astroObs: Astronomy.Observer,
  eq: EquatorialPosition
): HorizontalPosition {
  const hor = Astronomy.Horizon(date, astroObs, eq.raHours, eq.decDeg, "normal");
  return {
    azimuthDeg: hor.azimuth,   // degrees clockwise from North
    altitudeDeg: hor.altitude, // degrees above horizon (with refraction)
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Computes positions for ALL tracked celestial bodies at the given UTC time
 * and observer location.
 */
export function computeAllBodyPositions(
  utcDate: Date,
  observer: ObserverLocation
): CelestialBodyPosition[] {
  const safeDate = clampToAstronomyRange(utcDate);
  const astroObs = toAstroObserver(observer);

  return TRACKED_BODIES.map(({ id, name, body }) => {
    const eq = computeEquatorial(body, safeDate, astroObs);
    const hor = computeHorizontal(safeDate, astroObs, eq);
    return {
      id,
      name,
      horizontal: hor,
      equatorial: eq,
      isAboveHorizon: hor.altitudeDeg > 0,
    };
  });
}

/**
 * Computes the position of a single celestial body.
 * Returns null if bodyId is not recognised.
 */
export function computeBodyPosition(
  bodyId: CelestialBodyId,
  utcDate: Date,
  observer: ObserverLocation
): CelestialBodyPosition | null {
  const entry = TRACKED_BODIES.find((b) => b.id === bodyId);
  if (!entry) return null;

  const safeDate = clampToAstronomyRange(utcDate);
  const astroObs = toAstroObserver(observer);

  const eq = computeEquatorial(entry.body, safeDate, astroObs);
  const hor = computeHorizontal(safeDate, astroObs, eq);

  return {
    id: entry.id,
    name: entry.name,
    horizontal: hor,
    equatorial: eq,
    isAboveHorizon: hor.altitudeDeg > 0,
  };
}

/** Exported list of tracked body IDs, useful for UI rendering. */
export const TRACKED_BODY_IDS: CelestialBodyId[] = TRACKED_BODIES.map((b) => b.id);
