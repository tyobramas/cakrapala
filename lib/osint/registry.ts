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
  /** Server-side cache TTL in milliseconds. */
  ttlMs: number;
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
    ttlMs: 480_000,
    refreshMs: 600_000,
    enabled: false,
    requiresKey: false,
    attribution: '',
  },
  storm: {
    id: 'storm',
    nameId: 'Badai',
    nameEn: 'Storm',
    color: '#a78bfa',
    kind: 'event',
    ttlMs: 600_000,
    refreshMs: 900_000,
    enabled: false,
    requiresKey: false,
    attribution: '',
  },
  air: {
    id: 'air',
    nameId: 'Lalu Lintas Udara',
    nameEn: 'Air Traffic',
    color: '#22d3ee',
    kind: 'moving',
    ttlMs: 8_000,
    refreshMs: 10_000,
    enabled: false,
    requiresKey: true,
    attribution: '',
  },
  sea: {
    id: 'sea',
    nameId: 'Lalu Lintas Laut',
    nameEn: 'Sea Traffic',
    color: '#2dd4bf',
    kind: 'moving',
    ttlMs: 20_000,
    refreshMs: 30_000,
    enabled: false,
    requiresKey: true,
    attribution: '',
  },
  eyes: {
    id: 'eyes',
    nameId: 'Mata Pengawas',
    nameEn: 'Surveillance Eyes',
    color: '#a3e635',
    kind: 'static',
    ttlMs: 21_600_000,
    refreshMs: 0,
    enabled: false,
    requiresKey: false,
    attribution: '',
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
