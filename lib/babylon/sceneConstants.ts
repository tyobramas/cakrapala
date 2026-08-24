/**
 * Scene-level constants for the Cakrapala 3D solar system.
 * All values are in dimensionless scene units unless noted.
 */

// ── Camera ────────────────────────────────────────────────────────────────────

/** Starting horizontal distance of the camera from the origin. */
export const CAMERA_INITIAL_RADIUS = 95;
/** Smallest allowed camera radius (prevent clipping through the Sun). */
export const CAMERA_MIN_RADIUS = 6;
/** Largest allowed camera radius. */
export const CAMERA_MAX_RADIUS = 350;
/** Initial camera alpha angle (radians). */
export const CAMERA_INITIAL_ALPHA = -Math.PI / 2.2;
/** Initial camera beta angle (radians, from vertical). */
export const CAMERA_INITIAL_BETA = Math.PI / 3.2;

// ── Scene ─────────────────────────────────────────────────────────────────────

/** Background clear colour — deep space dark navy. */
export const SCENE_CLEAR_COLOR_HEX = "#020617";

// ── Lighting ──────────────────────────────────────────────────────────────────

/** Intensity of the ambient hemispheric light (0–1). */
export const AMBIENT_LIGHT_INTENSITY = 0.55;
/** Intensity of the Sun point light (0–1). */
export const SUN_POINT_LIGHT_INTENSITY = 2.2;
/** Range of the Sun point light in scene units. */
export const SUN_POINT_LIGHT_RANGE = 600;

// ── Starfield ─────────────────────────────────────────────────────────────────

/** Total number of star points rendered. */
export const STAR_COUNT = 3000;
/**
 * Radius of the starfield sphere — should be larger than CAMERA_MAX_RADIUS
 * so stars are always behind all scene objects.
 */
export const STARFIELD_RADIUS = 600;

// ── Orbits ────────────────────────────────────────────────────────────────────

/** Number of segments used to approximate each circular orbit line. */
export const ORBIT_SEGMENTS = 128;
/** Orbit line colour in RGBA (A expressed as 0–1). */
export const ORBIT_COLOR = { r: 0.35, g: 0.55, b: 0.85, a: 0.28 };

// ── Labels ────────────────────────────────────────────────────────────────────

/** Vertical offset above planet centre in scene units. */
export const LABEL_VERTICAL_OFFSET = 0.5;
/** Label font size in pixels. */
export const LABEL_FONT_SIZE = 14;

// ── Highlight ─────────────────────────────────────────────────────────────────

/** HighlightLayer outer glow intensity. */
export const HIGHLIGHT_INTENSITY = 0.8;
/** Highlight glow colour (white-ish blue). */
export const HIGHLIGHT_COLOR = { r: 0.5, g: 0.8, b: 1.0 };

// ── Saturn Ring ───────────────────────────────────────────────────────────────

/** Ring diameter relative to Saturn's visual radius. */
export const RING_DIAMETER_MULTIPLIER = 2.3;
/** Saturn ring tilt. */
export const RING_TILT = 0.45;
