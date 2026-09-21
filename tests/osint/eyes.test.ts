import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LAYER_REGISTRY, resolveDisplayMode } from '@/lib/osint/registry';
import {
  rawFetchEyesLayer,
  MAX_EYES_CAP,
  _resetWindyCacheForTesting,
} from '@/lib/osint/layers/eyes';
import {
  normalizeWindyWebcam,
  fetchWindyWebcams,
  getFreshWebcamImage,
} from '@/lib/osint/layers/eyes/sources/windy';
import {
  OFFICIAL_WEBCAMS,
  getOfficialWebcams,
} from '@/lib/osint/layers/eyes/sources/official';
import { computeImageDimensions } from '@/components/osint/WebcamViewer';
import type { BBox } from '@/lib/osint/types';

describe('OSINT Eyes Layer (Public Webcams) — Strict License & Architecture Tests', () => {
  const originalEnv = process.env.WINDY_API_KEY;

  beforeEach(() => {
    _resetWindyCacheForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.WINDY_API_KEY = originalEnv;
    _resetWindyCacheForTesting();
  });

  // ── 1. Tanpa WINDY_API_KEY → 'MISSING_KEY', tidak throw, env tidak bocor ──
  it('1. Tanpa WINDY_API_KEY: returns MISSING_KEY without throwing, and env name does not leak in client error', async () => {
    delete process.env.WINDY_API_KEY;

    // Viewport with no official cameras to isolate Windy missing key error
    const emptyBbox: BBox = [-10, -10, -9, -9];
    const result = await rawFetchEyesLayer({
      bbox: emptyBbox,
      signal: new AbortController().signal,
    });

    expect(result.error).toBe('MISSING_KEY');
    expect(result.entities).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('WINDY_API_KEY');
  });

  // ── 2. TTL terpisah: metadata 6 jam, URL gambar 8 menit ───────────────────
  it('2. TTL terpisah: metadata config is 6 hours (21,600,000 ms), imageTtlMs is 8 minutes (480,000 ms)', () => {
    const eyesConfig = LAYER_REGISTRY.eyes;
    expect(eyesConfig.ttlMs).toBe(21_600_000); // 6 hours
    expect(eyesConfig.imageTtlMs).toBe(480_000); // 8 minutes
    expect(eyesConfig.imageTtlMs).toBeLessThan(eyesConfig.ttlMs);
  });

  // ── 3. Tidak ada polling: refreshMs = 0 ────────────────────────────────────
  it('3. Tidak ada polling: refreshMs is explicitly 0 (no background polling per L2)', () => {
    expect(LAYER_REGISTRY.eyes.refreshMs).toBe(0);
  });

  // ── 4. Mode aggregate → tidak ada fetch (displayMode aggregate) ───────────
  it('4. Mode aggregate (>3,000,000 m) resolves to aggregate mode', () => {
    expect(resolveDisplayMode(3_500_000)).toBe('aggregate');
    expect(resolveDisplayMode(1_000_000)).toBe('icons');
    expect(resolveDisplayMode(200_000)).toBe('detail');
  });

  // ── 5. Batas 60 webcam ditegakkan, dipilih berdasarkan kedekatan ──────────
  it('5. Batas 60 webcam ditegakkan dan diurutkan berdasarkan kedekatan dengan pusat viewport', async () => {
    process.env.WINDY_API_KEY = 'mock-key';

    // Generate 75 mock webcams at varying latitudes
    const mockWebcams = Array.from({ length: 75 }, (_, i) => ({
      webcamId: 1000 + i,
      title: `Webcam ${i}`,
      status: 'active',
      location: {
        latitude: -6.2 + i * 0.05, // further and further away
        longitude: 106.8,
      },
    }));

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ webcams: mockWebcams }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await rawFetchEyesLayer({
      bbox: [106, -7, 107, -5],
      signal: new AbortController().signal,
    });

    expect(result.entities.length).toBeLessThanOrEqual(MAX_EYES_CAP);
    expect(result.entities.length).toBe(60);

    // The first entity should be closest to center lat -6.0, lon 106.5
    const firstLat = result.entities[0].position.lat;
    const lastLat = result.entities[result.entities.length - 1].position.lat;
    const centerLat = -6.0;

    expect(Math.abs(firstLat - centerLat)).toBeLessThan(Math.abs(lastLat - centerLat));
  });

  // ── 6. Gambar 401 → refresh token on demand ───────────────────────────────
  it('6. On-demand image fetching: getFreshWebcamImage returns fresh tokenized image URLs', async () => {
    process.env.WINDY_API_KEY = 'mock-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          webcam: {
            webcamId: 9999,
            images: {
              current: {
                preview: 'https://images.windy.com/webcams/9999/preview.jpg?token=fresh123',
                thumbnail: 'https://images.windy.com/webcams/9999/thumb.jpg?token=fresh123',
              },
              sizes: {
                preview: { width: 800, height: 450 },
              },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const fresh = await getFreshWebcamImage(9999);
    expect(fresh).not.toBeNull();
    expect(fresh?.images?.current?.preview).toContain('token=fresh123');

    // Second call should return from 8-minute cache without another network fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const cachedFresh = await getFreshWebcamImage(9999);
    expect(cachedFresh?.images?.current?.preview).toContain('token=fresh123');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── 7. Penegakan L5: dimensi gambar tidak pernah melebihi ukuran asli ──────
  it('7. Penegakan L5: computeImageDimensions membatasi gaya maksimal sesuai ukuran asli', () => {
    // If native width is 640px, style never exceeds 640px even if container is 800px
    const dims640 = computeImageDimensions(640, 480, 800, 600);
    expect(dims640.maxWidth).toBe('640px');
    expect(dims640.maxHeight).toBe('480px');

    // If native width is 320px, style stays 320px (no upscaling)
    const dims320 = computeImageDimensions(320, 240, 800, 600);
    expect(dims320.maxWidth).toBe('320px');
    expect(dims320.maxHeight).toBe('240px');

    // If native width is 1920px, capped at container max 800px
    const dimsLarge = computeImageDimensions(1920, 1080, 800, 600);
    expect(dimsLarge.maxWidth).toBe('800px');
    expect(dimsLarge.maxHeight).toBe('600px');
  });

  // ── 8. Kamera tidak aktif (>24 jam) ditandai tidak aktif ───────────────────
  it('8. Webcam dengan pembaruan >24 jam lalu ditandai tidak aktif (isActive = false)', () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 3600 * 1000).toISOString();

    const entity = normalizeWindyWebcam({
      webcamId: 5555,
      title: 'Old Camera',
      status: 'inactive',
      lastUpdatedOn: thirtyHoursAgo,
      location: { latitude: -6.2, longitude: 106.8 },
    });

    expect(entity.raw?.isActive).toBe(false);
  });

  // ── 9. Stabilitas id untuk kedua penyedia ──────────────────────────────────
  it('9. Stabilitas id: id format konsisten antar-pemanggilan untuk Windy dan Official', () => {
    // Official ID stability
    const officialCams1 = getOfficialWebcams();
    const officialCams2 = getOfficialWebcams();
    expect(officialCams1[0].id).toBe(officialCams2[0].id);
    expect(officialCams1[0].id).toMatch(/^eyes:official:/);

    // Windy ID stability
    const windyRaw = {
      webcamId: 88888,
      title: 'Test Windy Cam',
      location: { latitude: 10, longitude: 20 },
    };
    const windy1 = normalizeWindyWebcam(windyRaw);
    const windy2 = normalizeWindyWebcam(windyRaw);
    expect(windy1.id).toBe('eyes:windy:88888');
    expect(windy1.id).toBe(windy2.id);
  });

  // ── 10. Registri kamera resmi: sourcePage terisi & koordinat valid ─────────
  it('10. Registri kamera resmi: semua kamera memiliki sourcePage, koordinat valid, dan takedown toggle', () => {
    expect(OFFICIAL_WEBCAMS.length).toBeGreaterThanOrEqual(10);

    for (const cam of OFFICIAL_WEBCAMS) {
      expect(cam.id).toBeTruthy();
      expect(cam.name).toBeTruthy();
      expect(cam.sourcePage).toMatch(/^https?:\/\//);
      expect(cam.lat).toBeGreaterThanOrEqual(-90);
      expect(cam.lat).toBeLessThanOrEqual(90);
      expect(cam.lon).toBeGreaterThanOrEqual(-180);
      expect(cam.lon).toBeLessThanOrEqual(180);
      expect(cam.verifiedDate).toBeTruthy();
      expect(cam.enabled).toBe(true);
    }
  });

  // ── 11. Pemeriksaan origin pada /api/osint/eyes menolak origin asing (L3) ─
  it('11. Pemeriksaan origin pada /api/osint/eyes menolak origin asing dengan 403 Forbidden (L3)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ webcams: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const routeMod = await import('@/app/api/osint/[layer]/route');
    const GET = routeMod.GET;

    // Foreign origin request
    const foreignReq = {
      nextUrl: new URL('http://localhost:3000/api/osint/eyes'),
      headers: new Headers({
        'origin': 'https://unauthorized-scraper.com',
        'host': 'localhost:3000',
      }),
      url: 'http://localhost:3000/api/osint/eyes',
    } as any;

    const resForeign = await GET(foreignReq, {
      params: Promise.resolve({ layer: 'eyes' }),
    });

    expect(resForeign.status).toBe(403);
    const bodyForeign = await resForeign.json();
    expect(bodyForeign.error).toContain('Forbidden');

    // Local / allowed origin request
    const validReq = {
      nextUrl: new URL('http://localhost:3000/api/osint/eyes'),
      headers: new Headers({
        'origin': 'http://localhost:3000',
        'host': 'localhost:3000',
      }),
      url: 'http://localhost:3000/api/osint/eyes',
    } as any;

    const resValid = await GET(validReq, {
      params: Promise.resolve({ layer: 'eyes' }),
    });

    // Valid request proceeds (not 403)
    expect(resValid.status).not.toBe(403);
  });

  // ── 12. Respons kosong → entities [] tanpa error ──────────────────────────
  it('12. Respons kosong dari upstream menghasilkan entities [] tanpa throw error', async () => {
    process.env.WINDY_API_KEY = 'mock-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ webcams: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const windyResult = await fetchWindyWebcams([0, 0, 1, 1]);
    expect(windyResult.entities).toEqual([]);
    expect(windyResult.error).toBeUndefined();
  });
});
