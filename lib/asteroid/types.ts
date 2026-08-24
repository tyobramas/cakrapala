/**
 * Cakrapala — Asteroid Defense & Near-Earth Object (NEO) Telemetry Types
 * Matches NASA JPL NeoWs API specification & astronomical coordinate systems.
 */

export interface EstimatedDiameterUnit {
  estimated_diameter_min: number;
  estimated_diameter_max: number;
}

export interface EstimatedDiameter {
  kilometers: EstimatedDiameterUnit;
  meters: EstimatedDiameterUnit;
  miles: EstimatedDiameterUnit;
  feet: EstimatedDiameterUnit;
}

export interface RelativeVelocity {
  kilometers_per_second: string;
  kilometers_per_hour: string;
  miles_per_hour: string;
}

export interface MissDistance {
  astronomical: string;
  lunar: string;
  kilometers: string;
  miles: string;
}

export interface CloseApproachData {
  close_approach_date: string;
  close_approach_date_full: string;
  epoch_date_close_approach: number;
  relative_velocity: RelativeVelocity;
  miss_distance: MissDistance;
  orbiting_body: string;
}

export interface OrbitClass {
  orbit_class_type: string; // e.g. "APO", "AMO", "ATE", "IEO"
  orbit_class_description: string;
  orbit_class_range: string;
}

export interface OrbitalData {
  orbit_id?: string;
  orbit_determination_date?: string;
  first_observation_date?: string;
  last_observation_date?: string;
  data_arc_in_days?: number;
  observations_used?: number;
  orbit_uncertainty?: string;
  minimum_orbit_intersection?: string; // MOID in AU
  jupiter_tisserand_invariant?: string;
  epoch_osculation?: string;
  eccentricity: string;
  semi_major_axis: string;
  inclination: string;
  ascending_node_longitude: string;
  orbital_period: string; // in days
  perihelion_distance: string;
  perihelion_argument: string;
  aphelion_distance: string;
  perihelion_time?: string;
  mean_anomaly?: string;
  mean_motion?: string;
  equinox?: string;
  orbit_class?: OrbitClass;
}

export interface AsteroidNeoObject {
  id: string;
  neo_reference_id: string;
  name: string;
  nasa_jpl_url: string;
  absolute_magnitude_h: number;
  estimated_diameter: EstimatedDiameter;
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: CloseApproachData[];
  orbital_data?: OrbitalData;
  is_sentry_object?: boolean;
  // Computed client-side / enriched fields
  threat_level?: "SAFE" | "MODERATE" | "CRITICAL";
  avg_diameter_meters?: number;
  closest_miss_distance_ld?: number;
  closest_miss_distance_km?: number;
  velocity_kmh?: number;
  velocity_kms?: number;
  radar_coord_3d?: {
    x: number;
    y: number;
    z: number;
    distanceLd: number;
    inclinationDeg: number;
    approachAngleDeg: number;
  };
  size_reference_name?: string;
  kinetic_energy_megatons?: number;
}

export interface NeoFeedResponse {
  links: {
    next?: string;
    prev?: string;
    self?: string;
  };
  element_count: number;
  near_earth_objects: Record<string, AsteroidNeoObject[]>;
}

export interface AsteroidFeedSummary {
  date: string;
  totalTracked: number;
  hazardousCount: number;
  closestObject: {
    name: string;
    distanceLd: number;
    distanceKm: number;
    date: string;
  } | null;
  fastestObject: {
    name: string;
    velocityKmh: number;
    velocityKms: number;
  } | null;
  largestObject: {
    name: string;
    diameterMeters: number;
  } | null;
  defconLevel: 5 | 4 | 3 | 2 | 1;
  defconTitle: string;
}

export type AsteroidSortOption = "distance" | "velocity" | "diameter" | "time" | "name";

export interface AsteroidFilterState {
  searchQuery: string;
  hazardousOnly: boolean;
  maxDistanceLd: number; // e.g. 5, 20, 100
  minDiameterMeters: number;
  sortBy: AsteroidSortOption;
  sortOrder: "asc" | "desc";
  selectedDate: string;
}

export interface RealWorldSizeComparison {
  id: string;
  name: string;
  category: "vehicle" | "architecture" | "mountain" | "landmark";
  heightMeters: number;
  widthMeters: number;
  silhouetteType: "bus" | "plane" | "monas" | "eiffel" | "burjkhalifa" | "stadium";
  description: string;
}
