// lib/osint/layers/eyes/sources/windy.ts
// ─────────────────────────────────────────────────────────────────────────────
// Windy Webcams API v3 Adapter
//
// Base URL: https://api.windy.com/webcams/api/v3/
// Auth: Header 'x-windy-api-key'
//
// Strict license compliance (L1):
//   - Metadata Cache: TTL 6 hours (21,600,000 ms)
//   - Image URLs Cache: TTL 8 minutes (480,000 ms, 2-minute safety margin from 10-minute token expiry)
//   - On token expiration (HTTP 401), getFreshWebcamImage() fetches a new image token on-demand.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, OsintEntity } from '@/lib/osint/types';

const WINDY_BASE_URL = 'https://api.windy.com/webcams/api/v3/webcams';
const METADATA_TTL_MS = 21_600_000; // 6 hours
const IMAGE_TTL_MS = 480_000;       // 8 minutes

export interface WindyImagePart {
  current?: {
    icon?: string;
    thumbnail?: string;
    preview?: string;
  };
  daylight?: {
    icon?: string;
    thumbnail?: string;
    preview?: string;
  };
  sizes?: {
    icon?: { width: number; height: number };
    thumbnail?: { width: number; height: number };
    preview?: { width: number; height: number };
  };
}

export interface WindyWebcamRaw {
  webcamId: number;
  title: string;
  status?: string; // 'active' | 'inactive'
  lastUpdatedOn?: string;
  location?: {
    city?: string;
    country?: string;
    region?: string;
    latitude: number;
    longitude: number;
    viewDirectionDeg?: number;
  };
  images?: WindyImagePart;
  categories?: Array<{ id: string; name?: string }>;
  player?: {
    day?: { embed?: string; link?: string };
    lifetime?: { embed?: string; link?: string };
  };
  urls?: {
    detail?: string;
    edit?: string;
  };
}

// ── In-Memory Caches ─────────────────────────────────────────────────────────

interface MetadataCacheEntry {
  webcams: WindyWebcamRaw[];
  expiresAt: number;
}

interface ImageCacheEntry {
  images?: WindyImagePart;
  player?: { day?: { embed?: string; link?: string } };
  expiresAt: number;
}

const metadataCache = new Map<string, MetadataCacheEntry>();
const imageCache = new Map<number, ImageCacheEntry>();
const inFlightMetadata = new Map<string, Promise<WindyWebcamRaw[]>>();
const inFlightImages = new Map<number, Promise<ImageCacheEntry | null>>();

export function _resetWindyCacheForTesting(): void {
  metadataCache.clear();
  imageCache.clear();
  inFlightMetadata.clear();
  inFlightImages.clear();
}

/**
 * Normalizes a raw Windy API v3 webcam into OsintEntity.
 */
export function normalizeWindyWebcam(w: WindyWebcamRaw): OsintEntity {
  const previewSize = w.images?.sizes?.preview;
  const imageWidth = previewSize?.width ?? 800;
  const imageHeight = previewSize?.height ?? 450;
  const isWebcamActive = w.status === 'active';

  return {
    id: `eyes:windy:${w.webcamId}`,
    layer: 'eyes',
    kind: 'static',
    label: w.title || `Webcam #${w.webcamId}`,
    position: {
      lat: w.location?.latitude ?? 0,
      lon: w.location?.longitude ?? 0,
      altM: 0,
    },
    headingDeg: w.location?.viewDirectionDeg,
    severity: 0,
    observedAt: w.lastUpdatedOn || new Date().toISOString(),
    source: 'Windy.com',
    raw: {
      provider: 'windy',
      webcamId: w.webcamId,
      city: w.location?.city,
      country: w.location?.country,
      region: w.location?.region,
      categories: w.categories?.map((c) => c.name || c.id) ?? [],
      isActive: isWebcamActive,
      imageWidth,
      imageHeight,
      thumbnailUrl: w.images?.current?.thumbnail,
      previewUrl: w.images?.current?.preview,
      playerEmbedUrl: w.player?.day?.embed,
      playerLinkUrl: w.player?.day?.link,
      webcamDetailUrl: w.urls?.detail,
      lastUpdated: w.lastUpdatedOn,
    },
  };
}

export interface FetchWindyResult {
  entities: OsintEntity[];
  missingKey?: boolean;
  error?: string | null;
}

/**
 * Fetches webcams inside a bounding box from Windy API v3.
 * Uses a 6-hour cache for metadata.
 */
export async function fetchWindyWebcams(bbox?: BBox): Promise<FetchWindyResult> {
  const apiKey = process.env.WINDY_API_KEY?.trim();
  if (!apiKey) {
    return {
      entities: [],
      missingKey: true,
    };
  }

  // Format bbox parameter for Windy v3: {northLat},{eastLon},{southLat},{westLon}
  let queryParams = 'include=categories,images,location,player,urls&limit=60';
  let cacheKey = 'global';

  if (bbox) {
    const [west, south, east, north] = bbox;
    queryParams += `&bbox=${north.toFixed(4)},${east.toFixed(4)},${south.toFixed(4)},${west.toFixed(4)}`;
    cacheKey = `${north.toFixed(2)},${east.toFixed(2)},${south.toFixed(2)},${west.toFixed(2)}`;
  }

  // Check 6-hour metadata cache
  const now = Date.now();
  const cached = metadataCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return {
      entities: cached.webcams.map(normalizeWindyWebcam),
    };
  }

  // Check in-flight promise dedup
  if (inFlightMetadata.has(cacheKey)) {
    const webcams = await inFlightMetadata.get(cacheKey)!;
    return { entities: webcams.map(normalizeWindyWebcam) };
  }

  const fetchPromise = (async () => {
    try {
      const url = `${WINDY_BASE_URL}?${queryParams}`;
      const res = await fetch(url, {
        headers: {
          'x-windy-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('INVALID_API_KEY');
        }
        throw new Error(`Upstream HTTP error ${res.status}`);
      }

      const data = await res.json();
      const webcams: WindyWebcamRaw[] = Array.isArray(data?.webcams)
        ? data.webcams
        : Array.isArray(data?.result?.webcams)
          ? data.result.webcams
          : [];

      metadataCache.set(cacheKey, {
        webcams,
        expiresAt: now + METADATA_TTL_MS,
      });

      return webcams;
    } finally {
      inFlightMetadata.delete(cacheKey);
    }
  })();

  inFlightMetadata.set(cacheKey, fetchPromise);

  try {
    const webcams = await fetchPromise;
    return { entities: webcams.map(normalizeWindyWebcam) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      entities: [],
      error: msg,
    };
  }
}

/**
 * Fetches fresh image URLs on-demand for a single webcam (with 8-minute TTL).
 * Called when a webcam is opened or when the client receives an HTTP 401 expired token.
 */
export async function getFreshWebcamImage(webcamId: number): Promise<ImageCacheEntry | null> {
  const apiKey = process.env.WINDY_API_KEY?.trim();
  if (!apiKey) return null;

  const now = Date.now();
  const cached = imageCache.get(webcamId);
  if (cached && now < cached.expiresAt) {
    return cached;
  }

  if (inFlightImages.has(webcamId)) {
    return inFlightImages.get(webcamId)!;
  }

  const fetchPromise = (async () => {
    try {
      const url = `${WINDY_BASE_URL}/${webcamId}?include=images,player`;
      const res = await fetch(url, {
        headers: {
          'x-windy-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) return null;

      const data = await res.json();
      const webcam = (data?.webcam ?? data?.result?.webcam ?? data) as WindyWebcamRaw;

      const entry: ImageCacheEntry = {
        images: webcam.images,
        player: webcam.player,
        expiresAt: now + IMAGE_TTL_MS,
      };

      imageCache.set(webcamId, entry);
      return entry;
    } catch {
      return null;
    } finally {
      inFlightImages.delete(webcamId);
    }
  })();

  inFlightImages.set(webcamId, fetchPromise);
  return fetchPromise;
}
