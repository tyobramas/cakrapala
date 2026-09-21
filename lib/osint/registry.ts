// lib/osint/registry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all OSINT layers.
// Every layer — including disabled ones — is registered here.
// ─────────────────────────────────────────────────────────────────────────────

import type { LayerId, EntityKind } from './types';

/** Display mode driven by camera altitude. */
export type DisplayMode = 'aggregate' | 'icons' | 'detail';

/** Configuration for one OSINT layer. */
export interface LayerConfig {
  id: LayerId;
  /** Human-readable name (Indonesian). */
  nameId: string;
  /** Human-readable name (English). */
  nameEn: string;
  /** Accent colour (hex). */
  color: string;
  /** Default entity kind for this layer. */
  kind: EntityKind;
  /** Category: 'entity' (polled via API) or 'basemap' (client-side WMTS) */
  category?: 'entity' | 'basemap';
  /**
   * Whether this layer fetches globally and does not require viewport bbox gating.
   * Also active in aggregate zoom mode (> 3,000 km).
   */
  globalScope?: boolean;
  /** Server-side cache TTL in milliseconds. */
  ttlMs: number;
  /** Server-side cache TTL for image tokens/URLs in milliseconds (e.g. 480,000 for eyes). */
  imageTtlMs?: number;
  /**
   * Client polling interval in milliseconds.
   * 0 means no automatic refresh (e.g. static data).
   */
  refreshMs: number;
  /** Whether this layer is currently enabled. */
  enabled: boolean;
  /** Whether this layer requires an API key to function. */
  requiresKey: boolean;
  /** Attribution string (license obligation — must be displayed). */
  attribution: string;
  /** Regional coverage bounding boxes (if restricted, e.g. Baltic Sea for phase 1 sea). */
  coverageBBoxes?: import('./types').BBox[];
  /** Explanatory notice shown when viewport is outside coverage area. */
  coverageNotice?: string;
}

// ── Registry ────────────────────────────────────────────────────────────────

export const LAYER_REGISTRY: Record<LayerId, LayerConfig> = {
  quake: {
    id: 'quake',
    nameId: 'Gempa',
    nameEn: 'Earthquake',
    color: '#e879f9',
    kind: 'event',
    category: 'entity',
    ttlMs: 45_000,
    refreshMs: 60_000,
    enabled: true,
    requiresKey: false,
    attribution: 'Earthquake data: U.S. Geological Survey (public domain)',
  },
  imagery: {
    id: 'imagery',
    nameId: 'Citra Satelit',
    nameEn: 'Satellite Imagery',
    color: '#38bdf8',
    kind: 'static',
    category: 'basemap',
    ttlMs: 86_400_000,
    refreshMs: 0,
    enabled: true,
    requiresKey: false,
    attribution: 'NASA EOSDIS GIBS',
  },
  fire: {
    id: 'fire',
    nameId: 'Kebakaran',
    nameEn: 'Wildfire',
    color: '#f59e0b',
    kind: 'event',
    category: 'entity',
    ttlMs: 480_000,
    refreshMs: 600_000,
    enabled: true,
    requiresKey: true,
    attribution: 'Active fire data: NASA FIRMS (LANCE/EOSDIS)',
  },
  storm: {
    id: 'storm',
    nameId: 'Badai',
    nameEn: 'Storm',
    color: '#a78bfa',
    kind: 'moving',
    category: 'entity',
    globalScope: true,
    ttlMs: 600_000,
    refreshMs: 900_000,
    enabled: true,
    requiresKey: false,
    attribution: 'Tropical cyclone data: NOAA NHC (public domain) & GDACS (JRC, European Commission)',
  },
  air: {
    id: 'air',
    nameId: 'Lalu Lintas Udara',
    nameEn: 'Air Traffic',
    color: '#22d3ee',
    kind: 'moving',
    category: 'entity',
    globalScope: false,
    ttlMs: 8_000,
    refreshMs: 10_000,
    enabled: true,
    requiresKey: false,
    attribution: 'Flight data: adsb.lol contributors (ODbL)',
  },
  sea: {
    id: 'sea',
    nameId: 'Lalu Lintas Laut',
    nameEn: 'Sea Traffic',
    color: '#2dd4bf',
    kind: 'moving',
    category: 'entity',
    globalScope: false,
    ttlMs: 20_000,
    refreshMs: 20_000,
    enabled: true,
    requiresKey: false,
    attribution: 'Vessel data: Fintraffic Digitraffic (CC BY 4.0)',
    coverageBBoxes: [[9.0, 53.0, 33.0, 67.0]],
    coverageNotice: 'Cakupan AIS saat ini terbatas pada Laut Baltik dan Norwegia. Cakupan global menyusul.',
  },
  eyes: {
    id: 'eyes',
    nameId: 'Kamera Publik',
    nameEn: 'Public Webcams',
    color: '#a3e635',
    kind: 'static',
    category: 'entity',
    globalScope: false,
    ttlMs: 21_600_000,
    imageTtlMs: 480_000,
    refreshMs: 0,
    enabled: true,
    requiresKey: true,
    attribution: 'Webcams provided by windy.com - add new webcam | Kamera Resmi Pemerintah',
  },
} as const;

// ── Zoom-gating helper ──────────────────────────────────────────────────────

/**
 * Resolves the display mode based on camera altitude above the globe.
 *
 * Thresholds (global — same for every layer):
 *   > 3 000 000 m  → 'aggregate'  (no individual entities)
 *   500 000 … 3 000 000 m → 'icons'  (icons without labels)
 *   < 500 000 m    → 'detail'    (labels + trail + thumbnail)
 */
export function resolveDisplayMode(cameraAltM: number): DisplayMode {
  if (cameraAltM > 3_000_000) return 'aggregate';
  if (cameraAltM >= 500_000) return 'icons';
  return 'detail';
}

/** Type guard: is the given string a valid LayerId? */
export function isValidLayerId(id: string): id is LayerId {
  return id in LAYER_REGISTRY;
}

/** Check if a layer is a basemap layer (client-side WMTS) rather than an entity layer. */
export function isBasemapLayer(id: LayerId): boolean {
  return LAYER_REGISTRY[id]?.category === 'basemap';
}

/** Returns all enabled layers. */
export function getEnabledLayers(): LayerConfig[] {
  return Object.values(LAYER_REGISTRY).filter((l) => l.enabled);
}
