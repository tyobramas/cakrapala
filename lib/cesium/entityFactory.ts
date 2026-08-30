/**
 * Cesium entity factory helpers for Cakrapala Milestone 2/3.
 *
 * Creates and updates billboard/label entities for:
 *   - Observer marker (fixed geographic position)
 *   - Celestial body direction indicators with realistic circular planet images
 *
 * DESIGN RULE: No Cesium objects are stored in React state.
 *   All entities are attached directly to viewer.entities and manipulated
 *   imperatively via the update functions.
 *
 * VISUAL BODY PLACEMENT:
 *   Celestial bodies are placed at VISUAL_BODY_DISTANCE_M from the observer
 *   in the direction given by their Az/Alt.  This is a VISUAL APPROXIMATION —
 *   see lib/astronomy/coordinateTransforms.ts for the derivation.
 *
 * PLANET BILLBOARDS:
 *   Each body gets a canvas-generated circular billboard that composites the
 *   real planet texture (/textures/planets/<id>.jpg) clipped to a circle, with
 *   a color-matched glow ring.  No external sprite files needed.
 *
 * This module imports from "cesium" — it must only be used inside components
 * loaded with `dynamic(..., { ssr: false })`.
 */

import {
  Viewer,
  Entity,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  NearFarScalar,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  Cartographic,
  Math as CesiumMath,
} from "cesium";

import { horizontalToEcef } from "@/lib/astronomy/coordinateTransforms";
import type { CelestialBodyPosition, ObserverLocation } from "@/lib/astronomy/types";

// ── Planet visual config ───────────────────────────────────────────────────────

interface PlanetConfig {
  /** Pixel radius of the billboard circle (before Cesium scaling). */
  radius: number;
  /** CSS color of the outer glow ring. */
  glowColor: string;
  /** Path to the texture file under /public. null = no texture (draw solid). */
  texturePath: string | null;
  /** Fallback solid CSS color when texture is unavailable. */
  fallbackColor: string;
  /** Whether to draw Saturn-style rings. */
  hasRings?: boolean;
  /** Whether this is the Sun (special bright halo). */
  isSun?: boolean;
  /** Cesium Color for label / entity. */
  cesiumColor: string;
}

const PLANET_CONFIG: Record<string, PlanetConfig> = {
  sun:     { radius: 28, glowColor: "#FFF4B8", texturePath: "/textures/planets/sun.jpg",     fallbackColor: "#FDB813", cesiumColor: "#FDB813", isSun: true },
  moon:    { radius: 26, glowColor: "#D8D8CC", texturePath: "/textures/planets/moon.jpg",    fallbackColor: "#C8C8C8", cesiumColor: "#C8C8C8" },
  mercury: { radius: 10, glowColor: "#B5B5B5", texturePath: "/textures/planets/mercury.jpg", fallbackColor: "#B5B5B5", cesiumColor: "#B5B5B5" },
  venus:   { radius: 14, glowColor: "#E8D085", texturePath: "/textures/planets/venus.jpg",   fallbackColor: "#E8C56C", cesiumColor: "#E8C56C" },
  mars:    { radius: 13, glowColor: "#E06040", texturePath: "/textures/planets/mars.jpg",    fallbackColor: "#C1440E", cesiumColor: "#C1440E" },
  jupiter: { radius: 20, glowColor: "#C8A060", texturePath: "/textures/planets/jupiter.jpg", fallbackColor: "#C88B3A", cesiumColor: "#C88B3A" },
  saturn:  { radius: 18, glowColor: "#E4D080", texturePath: "/textures/planets/saturn.jpg",  fallbackColor: "#E4D191", cesiumColor: "#E4D191", hasRings: true },
  uranus:  { radius: 14, glowColor: "#7DE8E8", texturePath: "/textures/planets/uranus.jpg",  fallbackColor: "#7DE8E8", cesiumColor: "#7DE8E8" },
  neptune: { radius: 13, glowColor: "#6080FF", texturePath: "/textures/planets/neptune.jpg", fallbackColor: "#3F54BA", cesiumColor: "#3F54BA" },
};

function defaultConfig(id: string): PlanetConfig {
  return { radius: 9, glowColor: "#ffffff", texturePath: null, fallbackColor: "#ffffff", cesiumColor: "#ffffff" };
}

// ── Canvas-based circular planet billboard generator ───────────────────────────

/** Cache of generated data-URLs so we only render each texture once. */
const _spriteCache = new Map<string, string>();

/**
 * Generates a circular planet billboard as a canvas data-URL.
 * The image is composited from the real texture + glow ring.
 * Async because Image loading is async.
 */
function generatePlanetSprite(id: string, conf: PlanetConfig): Promise<string> {
  const cacheKey = id;
  const cached = _spriteCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const r = conf.radius;
    const padding = conf.hasRings ? r * 1.6 : r * 0.55;
    const size = Math.round((r + padding) * 2);
    const cx = size / 2;
    const cy = size / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    function finish(img?: HTMLImageElement) {
      ctx.clearRect(0, 0, size, size);

      // ── Outer glow halo ──────────────────────────────────────────────────────
      if (conf.isSun) {
        // Multi-stop sun radial glow
        const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2);
        grad.addColorStop(0, "rgba(255,244,180,0.95)");
        grad.addColorStop(0.35, "rgba(253,184,19,0.60)");
        grad.addColorStop(0.7, "rgba(255,140,0,0.20)");
        grad.addColorStop(1, "rgba(255,100,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Planet soft glow ring
        const grad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.5);
        grad.addColorStop(0, `${conf.glowColor}30`);
        grad.addColorStop(0.6, `${conf.glowColor}20`);
        grad.addColorStop(1, `${conf.glowColor}00`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Saturn rings (behind planet) ─────────────────────────────────────────
      if (conf.hasRings) {
        const ringRx = r * 1.55;
        const ringRy = r * 0.44;
        ctx.save();
        ctx.globalAlpha = 0.75;
        // Outer ring
        const rg = ctx.createLinearGradient(cx - ringRx, cy, cx + ringRx, cy);
        rg.addColorStop(0,    "rgba(210,190,130,0)");
        rg.addColorStop(0.15, "rgba(210,190,130,0.7)");
        rg.addColorStop(0.38, "rgba(240,220,160,0.85)");
        rg.addColorStop(0.50, "rgba(200,170,110,0.4)"); // gap
        rg.addColorStop(0.62, "rgba(240,220,160,0.85)");
        rg.addColorStop(0.85, "rgba(210,190,130,0.7)");
        rg.addColorStop(1,    "rgba(210,190,130,0)");
        ctx.strokeStyle = rg;
        ctx.lineWidth = r * 0.32;
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.14, ringRx, ringRy, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // ── Planet disc (clipped circle) ─────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      if (img) {
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      } else {
        // Fallback gradient disc
        const fg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
        fg.addColorStop(0, conf.glowColor);
        fg.addColorStop(1, conf.fallbackColor);
        ctx.fillStyle = fg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }

      // Slight dark vignette on disc edge
      const edge = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      edge.addColorStop(0, "rgba(0,0,0,0)");
      edge.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = edge;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      // ── Thin bright rim highlight ────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `${conf.glowColor}80`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const dataUrl = canvas.toDataURL("image/png");
      _spriteCache.set(cacheKey, dataUrl);
      resolve(dataUrl);
    }

    if (!conf.texturePath) {
      finish();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => finish(img);
    img.onerror = () => finish(); // fallback
    img.src = conf.texturePath;
  });
}

// ── Colour palette (for legacy/fallback reference) ────────────────────────────

const BODY_COLORS: Record<string, Color> = {
  sun:     Color.fromCssColorString("#FDB813"),
  moon:    Color.fromCssColorString("#C8C8C8"),
  mercury: Color.fromCssColorString("#B5B5B5"),
  venus:   Color.fromCssColorString("#E8C56C"),
  mars:    Color.fromCssColorString("#C1440E"),
  jupiter: Color.fromCssColorString("#C88B3A"),
  saturn:  Color.fromCssColorString("#E4D191"),
  uranus:  Color.fromCssColorString("#7DE8E8"),
  neptune: Color.fromCssColorString("#3F54BA"),
};

function bodyColor(name: string): Color {
  return BODY_COLORS[name] ?? Color.WHITE;
}

// ── Observer marker ───────────────────────────────────────────────────────────

/**
 * Creates a labelled point entity marking the observer's geographic location.
 * Returns the entity so the caller can hold a ref and remove/update it.
 */
export function createObserverMarker(
  viewer: Viewer,
  observer: ObserverLocation
): Entity {
  const cart = Cartesian3.fromDegrees(
    observer.longitude,
    observer.latitude,
    observer.elevationMeters
  );

  const entity = viewer.entities.add({
    id: "observer-marker",
    name: observer.displayName,
    position: new ConstantPositionProperty(cart),
    point: {
      pixelSize: 10,
      color: Color.fromCssColorString("#22d3ee"),
      outlineColor: Color.fromCssColorString("#0e7490"),
      outlineWidth: 2,
      scaleByDistance: new NearFarScalar(1e3, 2.0, 1e7, 0.5),
    },
    label: {
      text: observer.displayName,
      font: "11px sans-serif",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Color.BLACK,
      fillColor: Color.fromCssColorString("#e2e8f0"),
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -14),
      scaleByDistance: new NearFarScalar(1e3, 1.2, 1e7, 0.6),
    },
  });

  return entity;
}

/**
 * Updates the observer marker's position when the observer location changes.
 */
export function updateObserverMarker(
  entity: Entity,
  observer: ObserverLocation
): void {
  const cart = Cartesian3.fromDegrees(
    observer.longitude,
    observer.latitude,
    observer.elevationMeters
  );
  if (entity.position instanceof ConstantPositionProperty) {
    entity.position.setValue(cart);
  } else {
    entity.position = new ConstantPositionProperty(cart);
  }
  if (entity.label) {
    entity.label.text = new ConstantProperty(observer.displayName);
  }
}

// ── Celestial body entities ───────────────────────────────────────────────────

/**
 * Creates photorealistic billboard + label entities for a list of celestial bodies.
 * Returns a Map from body id → Entity for later updates.
 *
 * The billboard image is generated asynchronously (canvas → data-URL → Cesium billboard).
 * A placeholder point entity is created immediately and the billboard is swapped in
 * once the sprite is ready.
 */
export function createCelestialEntities(
  viewer: Viewer,
  positions: CelestialBodyPosition[],
  observer: ObserverLocation
): Map<string, Entity> {
  const entityMap = new Map<string, Entity>();

  for (const pos of positions) {
    const ecef = horizontalToEcef(pos.horizontal, observer);
    const cart = new Cartesian3(ecef.x, ecef.y, ecef.z);
    const color = bodyColor(pos.id);
    const conf = PLANET_CONFIG[pos.id] ?? defaultConfig(pos.id);

    const alphaColor = pos.isAboveHorizon ? color : color.withAlpha(0.35);

    // Label text: just the name
    const labelText = pos.name;

    // Create entity with placeholder point (will be swapped for billboard)
    const entity = viewer.entities.add({
      id: `celestial-${pos.id}`,
      name: pos.name,
      position: new ConstantPositionProperty(cart),
      point: {
        pixelSize: conf.radius * 1.6,
        color: alphaColor,
        outlineColor: Color.BLACK.withAlpha(0.5),
        outlineWidth: 1,
        scaleByDistance: new NearFarScalar(1e6, 1.5, 1e9, 1.0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: new ConstantProperty(true),
      },
      label: {
        text: labelText,
        font: `bold 11px 'Inter', 'Roboto', sans-serif`,
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 3,
        outlineColor: Color.fromCssColorString("#00000090"),
        fillColor: pos.isAboveHorizon
          ? Color.fromCssColorString(conf.cesiumColor)
          : Color.fromCssColorString("#64748b"),
        verticalOrigin: VerticalOrigin.TOP,
        horizontalOrigin: HorizontalOrigin.LEFT,
        pixelOffset: new Cartesian2(conf.radius + 6, 0),
        scaleByDistance: new NearFarScalar(1e6, 1.0, 1e9, 0.7),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: new ConstantProperty(false),
      },
    });

    entityMap.set(pos.id, entity);

    // Async: generate sprite and swap point → billboard
    const alpha = pos.isAboveHorizon ? 1.0 : 0.35;
    generatePlanetSprite(pos.id, conf).then((dataUrl) => {
      if (!viewer || viewer.isDestroyed()) return;
      const ent = entityMap.get(pos.id);
      if (!ent) return;

      // Hide placeholder point and add billboard
      if (ent.point) {
        ent.point.show = new ConstantProperty(false);
      }
      ent.billboard = {
        image: new ConstantProperty(dataUrl),
        width: new ConstantProperty(conf.radius * 2 + (conf.hasRings ? conf.radius * 3 : conf.radius * 1.1)),
        height: new ConstantProperty(conf.radius * 2 + (conf.hasRings ? conf.radius * 3 : conf.radius * 1.1)),
        color: new ConstantProperty(Color.WHITE.withAlpha(alpha)),
        verticalOrigin: new ConstantProperty(VerticalOrigin.CENTER),
        horizontalOrigin: new ConstantProperty(HorizontalOrigin.CENTER),
        scaleByDistance: new ConstantProperty(new NearFarScalar(1e6, 1.5, 1e9, 1.0)),
        disableDepthTestDistance: new ConstantProperty(Number.POSITIVE_INFINITY),
        pixelOffset: new ConstantProperty(new Cartesian2(0, 0)),
        eyeOffset: new ConstantProperty(new Cartesian3(0, 0, -100)),
      } as unknown as Entity["billboard"];

      viewer.scene.requestRender();
    }).catch(() => {/* sprite generation failed — keep placeholder point */});
  }

  return entityMap;
}

/**
 * Updates existing celestial body entities with new positions.
 * Mutates entity positions in-place — no entity add/remove overhead.
 */
export function updateCelestialEntities(
  entityMap: Map<string, Entity>,
  positions: CelestialBodyPosition[],
  observer: ObserverLocation
): void {
  for (const pos of positions) {
    const entity = entityMap.get(pos.id);
    if (!entity) continue;

    const ecef = horizontalToEcef(pos.horizontal, observer);
    const cart = new Cartesian3(ecef.x, ecef.y, ecef.z);

    if (entity.position instanceof ConstantPositionProperty) {
      entity.position.setValue(cart);
    } else {
      entity.position = new ConstantPositionProperty(cart);
    }

    const conf = PLANET_CONFIG[pos.id] ?? defaultConfig(pos.id);
    const alpha = pos.isAboveHorizon ? 1.0 : 0.35;

    // Update billboard alpha
    if (entity.billboard) {
      entity.billboard.color = new ConstantProperty(Color.WHITE.withAlpha(alpha));
    }

    // Update fallback point color
    if (entity.point) {
      const color = bodyColor(pos.id);
      entity.point.color = new ConstantProperty(
        pos.isAboveHorizon ? color : color.withAlpha(0.35)
      );
    }

    // Update label color
    if (entity.label) {
      entity.label.fillColor = new ConstantProperty(
        pos.isAboveHorizon
          ? Color.fromCssColorString(conf.cesiumColor)
          : Color.fromCssColorString("#64748b")
      );
    }
  }
}

// ── Camera helper ─────────────────────────────────────────────────────────────

/**
 * Returns Cesium Cartographic for the observer position.
 */
export function observerCartographic(observer: ObserverLocation): Cartographic {
  return Cartographic.fromDegrees(
    observer.longitude,
    observer.latitude,
    observer.elevationMeters
  );
}

/**
 * Formats an altitude value for display in a label.
 */
export function formatAltLabel(altDeg: number): string {
  const sign = altDeg >= 0 ? "+" : "";
  return `${sign}${altDeg.toFixed(1)}°`;
}

/**
 * Converts degrees to a DMS string.
 */
export function degToDms(deg: number): string {
  const d = Math.floor(Math.abs(deg));
  const m = Math.floor((Math.abs(deg) - d) * 60);
  const s = ((Math.abs(deg) - d) * 60 - m) * 60;
  const sign = deg < 0 ? "−" : "";
  return `${sign}${d}° ${m}′ ${s.toFixed(0)}″`;
}

/**
 * Formats a Right Ascension value (hours) as HH h MM m SS s.
 */
export function formatRa(raHours: number): string {
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const s = ((raHours - h) * 60 - m) * 60;
  return `${h}h ${m}m ${s.toFixed(0)}s`;
}

// Re-export for convenience
export { CesiumMath };
