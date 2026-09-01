/**
 * Cakrapala — Asteroid Telemetry & Astrophysics Calculations
 * Accurate mathematical models for Near-Earth Object orbits, size scaling, and kinetic energy.
 */

import { AsteroidNeoObject, RealWorldSizeComparison, AsteroidFeedSummary } from "./types";

/** 1 Lunar Distance (LD) in kilometers */
export const LUNAR_DISTANCE_KM = 384400;

/** Real-world architectural and vehicle landmarks for human-intuitive size comparison */
export const SIZE_COMPARISON_REFERENCES: RealWorldSizeComparison[] = [
  {
    id: "bus",
    name: "City Transit Bus",
    category: "vehicle",
    heightMeters: 3.5,
    widthMeters: 12,
    silhouetteType: "bus",
    description: "Standard 12-meter city passenger bus (~15 tonnes).",
  },
  {
    id: "boeing747",
    name: "Boeing 747-400 Jumbo Jet",
    category: "vehicle",
    heightMeters: 19.4,
    widthMeters: 70.6,
    silhouetteType: "plane",
    description: "Wide-body commercial airliner with 64m wingspan.",
  },
  {
    id: "stadium",
    name: "GBK National Stadium",
    category: "architecture",
    heightMeters: 38,
    widthMeters: 105,
    silhouetteType: "stadium",
    description: "Gelora Bung Karno Olympic-size stadium field diameter.",
  },
  {
    id: "monas",
    name: "Monas (National Monument Jakarta)",
    category: "landmark",
    heightMeters: 132,
    widthMeters: 45,
    silhouetteType: "monas",
    description: "Iconic 132-meter flame-topped obelisk in Jakarta.",
  },
  {
    id: "eiffel",
    name: "Eiffel Tower (Paris)",
    category: "architecture",
    heightMeters: 330,
    widthMeters: 125,
    silhouetteType: "eiffel",
    description: "Iconic 330-meter wrought-iron lattice tower.",
  },
  {
    id: "burjkhalifa",
    name: "Burj Khalifa (Dubai)",
    category: "architecture",
    heightMeters: 828,
    widthMeters: 175,
    silhouetteType: "burjkhalifa",
    description: "The tallest skyscraper in human history at 828 meters.",
  },
];

/**
 * Finds the most intuitive reference landmark for an asteroid of given diameter
 */
export function getClosestSizeReference(diameterMeters: number): RealWorldSizeComparison {
  let closest = SIZE_COMPARISON_REFERENCES[0];
  let minDiff = Infinity;

  for (const ref of SIZE_COMPARISON_REFERENCES) {
    const refScale = Math.max(ref.heightMeters, ref.widthMeters);
    const diff = Math.abs(refScale - diameterMeters);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ref;
    }
  }

  return closest;
}

/**
 * Calculates estimated kinetic energy upon atmospheric entry in Megatons of TNT
 * Mass assuming spherical chondrite asteroid density: ~2500 kg/m^3
 * 1 Megaton TNT = 4.184 x 10^15 Joules
 */
export function calculateImpactKineticEnergy(
  diameterMeters: number,
  velocityKms: number
): number {
  if (!diameterMeters || !velocityKms) return 0;

  const radiusMeters = diameterMeters / 2;
  const volumeM3 = (4 / 3) * Math.PI * Math.pow(radiusMeters, 3);
  const densityKgM3 = 2500; // standard stony chondrite
  const massKg = volumeM3 * densityKgM3;
  const velocityMs = velocityKms * 1000;

  const kineticJoules = 0.5 * massKg * Math.pow(velocityMs, 2);
  const megatonsTNT = kineticJoules / 4.184e15;

  return Math.round(megatonsTNT * 100) / 100;
}

/**
 * Computes deterministic 3D radar coordinates for an asteroid relative to Earth
 * Converts Lunar Distance, Approach Angle (derived from approach time & velocity), and Inclination
 */
/** 1 Lunar Distance (LD) in 3D Scene Units */
export const LD_TO_WORLD = 6.0;

export function computeAsteroidRadar3D(
  neo: AsteroidNeoObject,
  index: number,
  totalCount: number
): {
  x: number;
  y: number;
  z: number;
  distanceLd: number;
  inclinationDeg: number;
  approachAngleDeg: number;
} {
  const approach = neo.close_approach_data?.[0];
  const distanceLd = approach
    ? parseFloat(approach.miss_distance.lunar)
    : 15 + (index % 30);

  // Derive approach angle from epoch / hash or index evenly distributed in 360 space
  const epoch = approach?.epoch_date_close_approach || Date.now() + index * 86400000;
  const hash = Math.abs(Math.sin(epoch + index * 997));
  const approachAngleDeg = (hash * 360 + (index / Math.max(1, totalCount)) * 360) % 360;

  // Inclination from orbital data or calculated pseudo-inclination
  const inclinationDeg = neo.orbital_data?.inclination
    ? parseFloat(neo.orbital_data.inclination)
    : (hash * 40 - 20); // -20° to +20°

  const angleRad = (approachAngleDeg * Math.PI) / 180;
  const incRad = (inclinationDeg * Math.PI) / 180;

  // Strict linear spatial scaling: 1 LD = LD_TO_WORLD scene units
  const radarRadius = Math.max(2.5, distanceLd * LD_TO_WORLD);

  const x = Math.cos(angleRad) * Math.cos(incRad) * radarRadius;
  const y = Math.sin(incRad) * radarRadius * 0.35; // gentle vertical projection
  const z = Math.sin(angleRad) * Math.cos(incRad) * radarRadius;

  return {
    x,
    y,
    z,
    distanceLd,
    inclinationDeg,
    approachAngleDeg,
  };
}

/**
 * Enriches a raw NASA NeoWs object with computed astrophysics fields
 */
export function enrichAsteroidObject(
  neo: AsteroidNeoObject,
  index: number,
  totalCount: number
): AsteroidNeoObject {
  const minMeters = neo.estimated_diameter?.meters?.estimated_diameter_min || 20;
  const maxMeters = neo.estimated_diameter?.meters?.estimated_diameter_max || 50;
  const avgDiameter = Math.round((minMeters + maxMeters) / 2);

  const approach = neo.close_approach_data?.[0];
  const distanceLd = approach ? parseFloat(approach.miss_distance.lunar) : 25;
  const distanceKm = approach ? parseFloat(approach.miss_distance.kilometers) : distanceLd * LUNAR_DISTANCE_KM;
  const velocityKmh = approach ? parseFloat(approach.relative_velocity.kilometers_per_hour) : 45000;
  const velocityKms = approach ? parseFloat(approach.relative_velocity.kilometers_per_second) : velocityKmh / 3600;

  let threatLevel: "SAFE" | "MODERATE" | "CRITICAL" = "SAFE";
  if (neo.is_potentially_hazardous_asteroid) {
    threatLevel = distanceLd < 10 ? "CRITICAL" : "MODERATE";
  } else if (distanceLd < 3) {
    threatLevel = "MODERATE";
  }

  const radarCoord = computeAsteroidRadar3D(neo, index, totalCount);
  const sizeRef = getClosestSizeReference(avgDiameter);
  const energyMt = calculateImpactKineticEnergy(avgDiameter, velocityKms);

  return {
    ...neo,
    threat_level: threatLevel,
    avg_diameter_meters: avgDiameter,
    closest_miss_distance_ld: distanceLd,
    closest_miss_distance_km: distanceKm,
    velocity_kmh: velocityKmh,
    velocity_kms: velocityKms,
    radar_coord_3d: radarCoord,
    size_reference_name: sizeRef.name,
    kinetic_energy_megatons: energyMt,
  };
}

/**
 * Computes aggregated summary statistics for the top telemetry bar
 */
export function computeAsteroidSummary(asteroids: AsteroidNeoObject[], date: string): AsteroidFeedSummary {
  if (!asteroids || asteroids.length === 0) {
    return {
      date,
      totalTracked: 0,
      hazardousCount: 0,
      closestObject: null,
      fastestObject: null,
      largestObject: null,
      defconLevel: 5,
      defconTitle: "DEFCON 5 — NO IMMEDIATE IMPACT THREAT",
    };
  }

  let hazardousCount = 0;
  let closestObj: AsteroidNeoObject = asteroids[0];
  let fastestObj: AsteroidNeoObject = asteroids[0];
  let largestObj: AsteroidNeoObject = asteroids[0];

  for (const obj of asteroids) {
    if (obj.is_potentially_hazardous_asteroid) {
      hazardousCount++;
    }
    if ((obj.closest_miss_distance_ld || 999) < (closestObj.closest_miss_distance_ld || 999)) {
      closestObj = obj;
    }
    if ((obj.velocity_kmh || 0) > (fastestObj.velocity_kmh || 0)) {
      fastestObj = obj;
    }
    if ((obj.avg_diameter_meters || 0) > (largestObj.avg_diameter_meters || 0)) {
      largestObj = obj;
    }
  }

  let defconLevel: 5 | 4 | 3 | 2 | 1 = 5;
  let defconTitle = "DEFCON 5 — ALL PASSERS IN CLEAR ZONE";

  if (hazardousCount > 0) {
    const closestHazardLd = closestObj.closest_miss_distance_ld || 99;
    if (closestHazardLd < 1) {
      defconLevel = 1;
      defconTitle = "DEFCON 1 — SUB-LUNAR HAZARD TRAJECTORY";
    } else if (closestHazardLd < 5) {
      defconLevel = 2;
      defconTitle = "DEFCON 2 — CLOSE APPROACH HAZARD DETECTED";
    } else {
      defconLevel = 3;
      defconTitle = "DEFCON 3 — POTENTIALLY HAZARDOUS OBJECTS TRACKED";
    }
  } else if ((closestObj.closest_miss_distance_ld || 99) < 3) {
    defconLevel = 4;
    defconTitle = "DEFCON 4 — ELEVATED RADAR MONITORING";
  }

  return {
    date,
    totalTracked: asteroids.length,
    hazardousCount,
    closestObject: {
      name: closestObj.name,
      distanceLd: closestObj.closest_miss_distance_ld || 0,
      distanceKm: closestObj.closest_miss_distance_km || 0,
      date: closestObj.close_approach_data?.[0]?.close_approach_date_full || date,
    },
    fastestObject: {
      name: fastestObj.name,
      velocityKmh: fastestObj.velocity_kmh || 0,
      velocityKms: fastestObj.velocity_kms || 0,
    },
    largestObject: {
      name: largestObj.name,
      diameterMeters: largestObj.avg_diameter_meters || 0,
    },
    defconLevel,
    defconTitle,
  };
}

/**
 * Fallback verified asteroid dataset for high availability
 */
export const VERIFIED_FALLBACK_ASTEROIDS: AsteroidNeoObject[] = [
  {
    id: "2099942",
    neo_reference_id: "2099942",
    name: "99942 Apophis (2004 MN4)",
    nasa_jpl_url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2099942",
    absolute_magnitude_h: 19.7,
    estimated_diameter: {
      kilometers: { estimated_diameter_min: 0.31, estimated_diameter_max: 0.37 },
      meters: { estimated_diameter_min: 310, estimated_diameter_max: 370 },
      miles: { estimated_diameter_min: 0.19, estimated_diameter_max: 0.23 },
      feet: { estimated_diameter_min: 1017, estimated_diameter_max: 1213 },
    },
    is_potentially_hazardous_asteroid: true,
    close_approach_data: [
      {
        close_approach_date: "2029-04-13",
        close_approach_date_full: "2029-Apr-13 21:46",
        epoch_date_close_approach: 1870811160000,
        relative_velocity: {
          kilometers_per_second: "7.42",
          kilometers_per_hour: "26712",
          miles_per_hour: "16598",
        },
        miss_distance: {
          astronomical: "0.00025",
          lunar: "0.082",
          kilometers: "31600",
          miles: "19635",
        },
        orbiting_body: "Earth",
      },
    ],
    orbital_data: {
      semi_major_axis: "0.922",
      eccentricity: "0.191",
      inclination: "3.33",
      ascending_node_longitude: "204.4",
      orbital_period: "323.6",
      perihelion_distance: "0.746",
      aphelion_distance: "1.099",
      perihelion_argument: "126.4",
      minimum_orbit_intersection: "0.00021",
      orbit_class: {
        orbit_class_type: "ATE",
        orbit_class_description: "Near-Earth asteroid orbits which cross Earth's orbit with semi-major axes < 1.0 AU",
        orbit_class_range: "a < 1.0 AU, Q > 0.983 AU",
      },
    },
    is_sentry_object: true,
  },
  {
    id: "2523609",
    neo_reference_id: "2523609",
    name: "523609 (2005 PJ2)",
    nasa_jpl_url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2523609",
    absolute_magnitude_h: 19.53,
    estimated_diameter: {
      kilometers: { estimated_diameter_min: 0.33, estimated_diameter_max: 0.74 },
      meters: { estimated_diameter_min: 330, estimated_diameter_max: 738 },
      miles: { estimated_diameter_min: 0.21, estimated_diameter_max: 0.46 },
      feet: { estimated_diameter_min: 1082, estimated_diameter_max: 2421 },
    },
    is_potentially_hazardous_asteroid: true,
    close_approach_data: [
      {
        close_approach_date: "2026-08-27",
        close_approach_date_full: "2026-Aug-27 02:01",
        epoch_date_close_approach: 1787796060000,
        relative_velocity: {
          kilometers_per_second: "22.75",
          kilometers_per_hour: "81898",
          miles_per_hour: "50888",
        },
        miss_distance: {
          astronomical: "0.0473",
          lunar: "18.40",
          kilometers: "7077381",
          miles: "4397680",
        },
        orbiting_body: "Earth",
      },
    ],
    orbital_data: {
      semi_major_axis: "1.198",
      eccentricity: "0.659",
      inclination: "17.43",
      ascending_node_longitude: "326.4",
      orbital_period: "479.0",
      perihelion_distance: "0.408",
      aphelion_distance: "1.988",
      perihelion_argument: "128.9",
      minimum_orbit_intersection: "0.0444",
      orbit_class: {
        orbit_class_type: "APO",
        orbit_class_description: "Near-Earth asteroid orbits which cross the Earth's orbit (Apollo-class)",
        orbit_class_range: "a > 1.0 AU; q < 1.017 AU",
      },
    },
  },
  {
    id: "3893945",
    neo_reference_id: "3893945",
    name: "2024 BX1 (Berlin Impactor)",
    nasa_jpl_url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3893945",
    absolute_magnitude_h: 32.4,
    estimated_diameter: {
      kilometers: { estimated_diameter_min: 0.001, estimated_diameter_max: 0.002 },
      meters: { estimated_diameter_min: 1.2, estimated_diameter_max: 2.1 },
      miles: { estimated_diameter_min: 0.0007, estimated_diameter_max: 0.0013 },
      feet: { estimated_diameter_min: 4, estimated_diameter_max: 7 },
    },
    is_potentially_hazardous_asteroid: false,
    close_approach_data: [
      {
        close_approach_date: "2026-08-24",
        close_approach_date_full: "2026-Aug-24 01:37",
        epoch_date_close_approach: 1787535420000,
        relative_velocity: {
          kilometers_per_second: "13.92",
          kilometers_per_hour: "50111",
          miles_per_hour: "31137",
        },
        miss_distance: {
          astronomical: "0.0084",
          lunar: "3.27",
          kilometers: "1256780",
          miles: "780927",
        },
        orbiting_body: "Earth",
      },
    ],
    orbital_data: {
      semi_major_axis: "1.334",
      eccentricity: "0.276",
      inclination: "7.28",
      ascending_node_longitude: "120.5",
      orbital_period: "562.9",
      perihelion_distance: "0.965",
      aphelion_distance: "1.703",
      perihelion_argument: "85.2",
      minimum_orbit_intersection: "0.0012",
      orbit_class: {
        orbit_class_type: "APO",
        orbit_class_description: "Apollo-class Earth-crosser",
        orbit_class_range: "a > 1.0 AU; q < 1.017 AU",
      },
    },
  },
  {
    id: "2101955",
    neo_reference_id: "2101955",
    name: "101955 Bennu (OSIRIS-REx Target)",
    nasa_jpl_url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2101955",
    absolute_magnitude_h: 20.9,
    estimated_diameter: {
      kilometers: { estimated_diameter_min: 0.49, estimated_diameter_max: 0.52 },
      meters: { estimated_diameter_min: 490, estimated_diameter_max: 520 },
      miles: { estimated_diameter_min: 0.30, estimated_diameter_max: 0.32 },
      feet: { estimated_diameter_min: 1607, estimated_diameter_max: 1706 },
    },
    is_potentially_hazardous_asteroid: true,
    close_approach_data: [
      {
        close_approach_date: "2026-09-22",
        close_approach_date_full: "2026-Sep-22 14:30",
        epoch_date_close_approach: 1790087400000,
        relative_velocity: {
          kilometers_per_second: "6.12",
          kilometers_per_hour: "22032",
          miles_per_hour: "13690",
        },
        miss_distance: {
          astronomical: "0.0321",
          lunar: "12.48",
          kilometers: "4802110",
          miles: "2983893",
        },
        orbiting_body: "Earth",
      },
    ],
    orbital_data: {
      semi_major_axis: "1.126",
      eccentricity: "0.204",
      inclination: "6.03",
      ascending_node_longitude: "2.06",
      orbital_period: "436.6",
      perihelion_distance: "0.897",
      aphelion_distance: "1.356",
      perihelion_argument: "66.2",
      minimum_orbit_intersection: "0.0033",
      orbit_class: {
        orbit_class_type: "APO",
        orbit_class_description: "Apollo-type Carbonaceous B-type asteroid",
        orbit_class_range: "a > 1.0 AU; q < 1.017 AU",
      },
    },
    is_sentry_object: true,
  },
  {
    id: "2065803",
    neo_reference_id: "2065803",
    name: "65803 Didymos (DART Target)",
    nasa_jpl_url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2065803",
    absolute_magnitude_h: 18.1,
    estimated_diameter: {
      kilometers: { estimated_diameter_min: 0.78, estimated_diameter_max: 0.85 },
      meters: { estimated_diameter_min: 780, estimated_diameter_max: 850 },
      miles: { estimated_diameter_min: 0.48, estimated_diameter_max: 0.53 },
      feet: { estimated_diameter_min: 2559, estimated_diameter_max: 2788 },
    },
    is_potentially_hazardous_asteroid: true,
    close_approach_data: [
      {
        close_approach_date: "2026-10-04",
        close_approach_date_full: "2026-Oct-04 08:12",
        epoch_date_close_approach: 1791101520000,
        relative_velocity: {
          kilometers_per_second: "18.34",
          kilometers_per_hour: "66024",
          miles_per_hour: "41025",
        },
        miss_distance: {
          astronomical: "0.0712",
          lunar: "27.69",
          kilometers: "10651400",
          miles: "6618473",
        },
        orbiting_body: "Earth",
      },
    ],
    orbital_data: {
      semi_major_axis: "1.644",
      eccentricity: "0.384",
      inclination: "3.41",
      ascending_node_longitude: "73.2",
      orbital_period: "770.8",
      perihelion_distance: "1.013",
      aphelion_distance: "2.275",
      perihelion_argument: "319.3",
      minimum_orbit_intersection: "0.038",
      orbit_class: {
        orbit_class_type: "AMO",
        orbit_class_description: "Amor-class asteroid (approaching outside Earth orbit)",
        orbit_class_range: "a > 1.0 AU; 1.017 < q < 1.3 AU",
      },
    },
  },
  {
    id: "3374389",
    neo_reference_id: "3374389",
    name: "(2007 HL4)",
    nasa_jpl_url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3374389",
    absolute_magnitude_h: 24.1,
    estimated_diameter: {
      kilometers: { estimated_diameter_min: 0.04, estimated_diameter_max: 0.09 },
      meters: { estimated_diameter_min: 40, estimated_diameter_max: 90 },
      miles: { estimated_diameter_min: 0.025, estimated_diameter_max: 0.056 },
      feet: { estimated_diameter_min: 132, estimated_diameter_max: 295 },
    },
    is_potentially_hazardous_asteroid: false,
    close_approach_data: [
      {
        close_approach_date: "2026-08-24",
        close_approach_date_full: "2026-Aug-24 09:09",
        epoch_date_close_approach: 1787562540000,
        relative_velocity: {
          kilometers_per_second: "4.05",
          kilometers_per_hour: "14585",
          miles_per_hour: "9063",
        },
        miss_distance: {
          astronomical: "0.231",
          lunar: "90.03",
          kilometers: "34623113",
          miles: "21513805",
        },
        orbiting_body: "Earth",
      },
    ],
    orbital_data: {
      semi_major_axis: "1.452",
      eccentricity: "0.332",
      inclination: "11.2",
      ascending_node_longitude: "198.4",
      orbital_period: "639.2",
      perihelion_distance: "0.970",
      aphelion_distance: "1.934",
      perihelion_argument: "241.1",
      minimum_orbit_intersection: "0.012",
      orbit_class: {
        orbit_class_type: "APO",
        orbit_class_description: "Apollo-class Earth-crosser",
        orbit_class_range: "a > 1.0 AU; q < 1.017 AU",
      },
    },
  },
];
