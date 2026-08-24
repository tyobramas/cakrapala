/**
 * Core astronomy/scene type definitions for Cakrapala.
 *
 * Milestone 1 types: visual rendering parameters for the Babylon.js solar system.
 * Milestone 2 types: real ephemeris types for the CesiumJS globe view.
 * Milestone 3 types: star catalog, constellation, sky dome, horizon events, lunar.
 *
 * Unit conventions:
 *   - All angles: degrees (°) unless explicitly noted as radians.
 *   - All distances: metres unless noted as AU.
 *   - All times: UTC Date objects unless noted.
 *   - Azimuth: degrees clockwise from North (0°–360°).
 *   - Altitude: degrees above horizon (–90° to +90°).
 *   - RA: hours (0 h to 24 h).
 *   - Declination: degrees (–90° to +90°).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE 1 — Babylon.js visual types (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanetId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

/**
 * Static definition of a planet for visual rendering purposes only.
 * `visualRadius` and `visualOrbitRadius` are dimensionless scene units
 * chosen for aesthetics, not physical accuracy.
 */
export type PlanetDefinition = {
  id: PlanetId;
  name: string;
  description: string;
  color: string;
  /** Visual radius in scene units — not physically accurate. */
  visualRadius: number;
  /** Visual orbit radius in scene units — not physically accurate. */
  visualOrbitRadius: number;
  /** Base orbit speed coefficient (rad/s at 1× speed) — not astronomically precise. */
  orbitSpeed: number;
  hasRing: boolean;
};

/** Simulation runtime state managed by React (Milestone 1). */
export type SimulationState = {
  isPaused: boolean;
  simulationSpeed: number;
  showOrbits: boolean;
  showLabels: boolean;
};

export type SelectedPlanetId = PlanetId | null;

export const SIMULATION_SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export type SunDefinition = {
  name: string;
  description: string;
  visualRadius: number;
  color: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE 2 — Real-astronomy types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Geographic observer location.
 *
 * Backward-compatible with Milestone 2 (all existing required fields retained).
 * Milestone 3 adds optional fields.
 *
 * latitude/longitude in decimal degrees; elevation in metres.
 */
export type ObserverLocation = {
  /** Degrees, –90 to +90 (positive = North). */
  latitude: number;
  /** Degrees, –180 to +180 (positive = East). */
  longitude: number;
  /** Metres above WGS-84 ellipsoid. */
  elevationMeters: number;
  /** IANA timezone string (e.g. "Asia/Jakarta"). Required. */
  timezone: string;
  /** Human-readable display name. Required. */
  displayName: string;
  // ── Milestone 3 optional extensions ──────────────────────────────────────
  /** Optional short name (e.g. "Bogor"). Alias for displayName in UI. */
  name?: string;
  /** Optional IANA timezone; alias for timezone for forward-compat. */
  timeZone?: string;
  /** Optional localized timezone label (e.g. "WIB"). */
  timeZoneDisplay?: string;
  /** How to display coordinates in the UI. */
  coordinateDisplay?: "decimal" | "dms";
};

/**
 * Topocentric horizontal coordinates.
 * azimuthDegrees: 0–360, clockwise from North.
 * altitudeDegrees: –90 to +90, above/below horizon.
 */
export type HorizontalPosition = {
  /** Degrees clockwise from North, 0–360. */
  azimuthDeg: number;
  /** Degrees above horizon, –90 to +90. */
  altitudeDeg: number;
};

/**
 * Named horizontal coordinate alias used in Milestone 3 sky dome.
 * Semantically identical to HorizontalPosition; separated for clarity at
 * call sites that deal with star/sky-dome rendering.
 */
export type HorizontalCoordinate = {
  /** Azimuth in degrees clockwise from North, 0–360. */
  azimuthDegrees: number;
  /** Altitude in degrees above horizon, –90 to +90. */
  altitudeDegrees: number;
};

/**
 * Topocentric equatorial coordinates.
 * raHours: 0–24 h; decDeg: –90 to +90.
 */
export type EquatorialPosition = {
  raHours: number;
  decDeg: number;
};

/**
 * Canonical celestial body identifiers.
 *
 * IMPORTANT: IDs are lowercase strings.
 * Use CELESTIAL_BODY_LABELS for display names.
 * Do NOT add localised aliases (e.g. "matahari") to this union.
 */
export type CelestialBodyId =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

/**
 * Localised display labels for a celestial body.
 * Kept separate from CelestialBodyId.
 */
export type CelestialBodyLabels = {
  /** English display name. */
  en: string;
  /** Indonesian display name. */
  id: string;
};

/** Label map for all tracked bodies. */
export const CELESTIAL_BODY_LABELS: Record<CelestialBodyId, CelestialBodyLabels> = {
  sun:     { en: "Sun",     id: "Matahari" },
  moon:    { en: "Moon",    id: "Bulan"    },
  mercury: { en: "Mercury", id: "Merkurius"},
  venus:   { en: "Venus",   id: "Venus"    },
  mars:    { en: "Mars",    id: "Mars"     },
  jupiter: { en: "Jupiter", id: "Jupiter"  },
  saturn:  { en: "Saturn",  id: "Saturnus" },
  uranus:  { en: "Uranus",  id: "Uranus"   },
  neptune: { en: "Neptune", id: "Neptunus" },
};

/** Full set of computed positions for a single celestial body. */
export type CelestialBodyPosition = {
  id: CelestialBodyId;
  /** English display name. */
  name: string;
  horizontal: HorizontalPosition;
  equatorial: EquatorialPosition;
  isAboveHorizon: boolean;
  /** Approximate distance in AU, if available. */
  distanceAu?: number;
};

/** Time multiplier options for the Cesium simulation clock. */
export const CESIUM_SPEED_MULTIPLIERS = [1, 10, 100, 1000, 10000] as const;
export type CesiumSpeedMultiplier = (typeof CESIUM_SPEED_MULTIPLIERS)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE 3 — Star catalog, constellation, sky dome, horizon events, lunar
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single star record from the Yale Bright Star Catalogue (BSC5).
 *
 * Coordinates: J2000.0 equatorial, FK5 frame.
 * Magnitudes: Johnson V-band visual magnitudes.
 * All numeric fields are in the units stated.
 */
export type StarRecord = {
  /** Stable identifier, e.g. "HR1234" (Harvard Revised number). */
  id: string;
  /** Common name if available (e.g. "Sirius"), otherwise undefined. */
  name?: string;
  /** Right ascension in DEGREES (0–360). Converted from hours for convenience. */
  rightAscensionDegrees: number;
  /** Declination in degrees (–90 to +90). */
  declinationDegrees: number;
  /** Johnson V-band visual magnitude. Lower = brighter. */
  magnitude: number;
  /** Epoch of coordinates (2000 for J2000.0). */
  epoch?: number;
  /** Proper motion in RA, arcsec/year (multiply by cos(dec) for true motion). */
  properMotionRa?: number;
  /** Proper motion in Dec, arcsec/year. */
  properMotionDec?: number;
  /** Johnson B–V color index; positive = red, negative = blue. */
  colorIndex?: number;
};

/**
 * A single constellation line segment, connecting two star HR numbers.
 * Used to draw IAU-style constellation stick figures.
 */
export type ConstellationSegment = {
  /** IAU 3-letter abbreviation, e.g. "ORI" for Orion. */
  constellation: string;
  /** HR number of the first star in the segment. */
  starA: number;
  /** HR number of the second star in the segment. */
  starB: number;
};

/** Constellation metadata (name + abbreviation). */
export type ConstellationInfo = {
  /** IAU 3-letter abbreviation. */
  abbreviation: string;
  /** Full Latin name. */
  name: string;
  /** English genitive. */
  genitive?: string;
};

/**
 * Context passed to StarFieldRenderer.update() each frame/tick.
 */
export type StarFieldContext = {
  /** Current simulation UTC date (for proper-motion corrections — optional). */
  utcDate: Date;
  /** Observer location. */
  observer: ObserverLocation;
  /** Sky render mode: globe | sky-dome. */
  renderMode: SkyRenderMode;
};

/**
 * Abstract interface for the star-field rendering layer.
 * Default implementation uses CesiumJS PointPrimitiveCollection.
 * Future implementations may use WebGPU or custom WebGL.
 */
export interface StarFieldRenderer {
  create(stars: StarRecord[]): void;
  update(context: StarFieldContext): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/**
 * Sky rendering mode.
 * globe     — Cesium 3-D Earth globe; celestial entities at ECEF positions.
 * sky-dome  — Observer-centred local ENU sphere; stars projected around the observer.
 */
export type SkyRenderMode = "globe" | "sky-dome";

/**
 * Horizon event result.
 * null means the event does not occur on the requested date
 * (e.g. polar day / polar night, circumpolar body).
 */
export type HorizonEventResult = {
  /** UTC Date of the event, or null if it does not occur. */
  date: Date | null;
  /** Human-readable reason if date is null. */
  unavailableReason?: string;
};

/**
 * Rise/set pair for a single body on a single date.
 */
export type RiseSetPair = {
  rise: HorizonEventResult;
  set: HorizonEventResult;
};

/**
 * Lunar phase and illumination data.
 */
export type LunarData = {
  /**
   * Moon phase angle in degrees (0–360).
   * 0 = new moon, 90 = first quarter, 180 = full moon, 270 = last quarter.
   */
  phaseDegrees: number;
  /**
   * Fraction of the Moon's disc illuminated (0–1).
   * 0 = new moon (dark), 1 = full moon.
   */
  illuminationFraction: number;
  /** Human-readable phase name. */
  phaseName: string;
  /** UTC Date of the next new moon after the given date. null if none found. */
  nextNewMoonDate: Date | null;
};

/**
 * Angular data for a planet.
 * Physical values come from astronomy-engine; visual marker size is exaggerated.
 */
export type PlanetAngularData = {
  /** Distance to the body in AU (astronomical units). */
  physicalDistanceAu?: number;
  /** Angular diameter in arcseconds (2 * atan(radius/distance) in arcsec). */
  angularDiameterArcSeconds?: number;
  /**
   * Visual marker size in pixels used by the renderer.
   * This is exaggerated for usability and MUST NOT be presented as physical scale.
   */
  visualMarkerSizePixels: number;
};

/**
 * Sky dome controller interface.
 * Manages the observer-centred local-frame rendering.
 *
 * FRAME DOCUMENTATION:
 *   The sky dome uses a visualization-only local ENU frame, NOT a full
 *   astronomical ICRS/ECEF transform chain.
 *   - Origin: observer geographic position (lat/lon/elev on WGS-84).
 *   - x-axis: East.
 *   - y-axis: Up (local vertical).
 *   - z-axis: North.
 *   Stars and planets are positioned at an arbitrary fixed visual radius
 *   (e.g. 1e8 m from the origin) in the direction given by their
 *   topocentric Az/Alt coordinates.
 *   This is a VISUALIZATION APPROXIMATION, not an astronomy-grade renderer.
 */
export interface SkyDomeController {
  setObserver(observer: ObserverLocation): void;
  setSimulationTime(date: Date): void;
  updateStars(): void;
  setConstellationsVisible(visible: boolean): void;
  setHorizonVisible(visible: boolean): void;
  destroy(): void;
}

/**
 * Explicit coordinate render adapter separating globe and sky-dome transforms.
 *
 * Globe mode: Az/Alt → ECEF (WGS-84 anchored, 3-D Earth globe).
 * Sky-dome mode: Az/Alt → local ENU Cartesian (observer-centred sphere).
 *
 * Both modes use the horizontal-to-ENU-to-ECEF chain defined in
 * lib/astronomy/coordinateTransforms.ts; they differ only in the origin
 * and the scale used.
 */
export type CoordinateRenderAdapter = {
  /** Converts Az/Alt to a Cesium-compatible ECEF position for globe mode. */
  toGlobePosition(
    horizontal: HorizontalCoordinate,
    observer: ObserverLocation,
    distanceM?: number
  ): { x: number; y: number; z: number };
  /** Converts Az/Alt to a local ENU Cartesian position for sky-dome mode. */
  toSkyDomePosition(
    horizontal: HorizontalCoordinate,
    observer: ObserverLocation,
    distanceM?: number
  ): { x: number; y: number; z: number };
};
