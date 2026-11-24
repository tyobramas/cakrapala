/**
 * Scene-level constants for the Cakrapala 3D Solar System Orrery.
 * All values are in dimensionless scene units unless noted.
 */

// ── Camera ────────────────────────────────────────────────────────────────────

/** Starting radial distance from heliocentric origin (frames inner + outer planets cleanly). */
export const CAMERA_INITIAL_RADIUS = 108;
/** Smallest allowed camera radius in overview mode (prevents clipping into the Sun). */
export const CAMERA_MIN_RADIUS = 7.5;
/** Largest allowed camera radius (wide galactic view of the full Solar System). */
export const CAMERA_MAX_RADIUS = 380;
/** Initial camera alpha angle (radians) — looks across the ecliptic toward the Galactic Core. */
export const CAMERA_INITIAL_ALPHA = -Math.PI * 0.42;
/** Initial camera beta angle (radians, from North Ecliptic Pole +Y). */
export const CAMERA_INITIAL_BETA = Math.PI * 0.34;

// ── Scene ─────────────────────────────────────────────────────────────────────

/** Background clear colour — deep obsidian space. */
export const SCENE_CLEAR_COLOR_HEX = "#01030a";

// ── Lighting ──────────────────────────────────────────────────────────────────

/** Subtle deep-space ambient fill so dark planetary hemispheres stay dramatic & realistic. */
export const AMBIENT_LIGHT_INTENSITY = 0.1;
/** Primary solar PointLight intensity illuminating all 8 planets. */
export const SUN_POINT_LIGHT_INTENSITY = 3.2;
/** Range of the Sun point light in scene units (reaches well past Neptune). */
export const SUN_POINT_LIGHT_RANGE = 1200;

// ── Starfield ─────────────────────────────────────────────────────────────────

/** Total number of crisp procedural star points layered over the HD Milky Way CubeMap. */
export const STAR_COUNT = 4500;
/** Radius of the procedural star sphere. */
export const STARFIELD_RADIUS = 1400;

// ── Orbits ────────────────────────────────────────────────────────────────────

/** Number of segments used to approximate each smooth orbital path. */
export const ORBIT_SEGMENTS = 192;
/** Default subtle orbit line colour in RGBA. */
export const ORBIT_COLOR = { r: 0.65, g: 0.78, b: 0.96, a: 0.2 };

// ── Labels ────────────────────────────────────────────────────────────────────

/** Vertical offset above planet centre in scene units. */
export const LABEL_VERTICAL_OFFSET = 0.55;
/** Label font size in pixels. */
export const LABEL_FONT_SIZE = 14;

// ── Highlight ─────────────────────────────────────────────────────────────────

/** HighlightLayer outer glow intensity (subtle accent). */
export const HIGHLIGHT_INTENSITY = 0.4;
/** Highlight glow colour. */
export const HIGHLIGHT_COLOR = { r: 0.55, g: 0.82, b: 1.0 };

// ── Saturn Ring ───────────────────────────────────────────────────────────────

/** Ring diameter relative to Saturn's visual radius. */
export const RING_DIAMETER_MULTIPLIER = 2.45;
/** Saturn axial obliquity (26.73 degrees in radians). */
export const RING_TILT = (26.73 * Math.PI) / 180;
