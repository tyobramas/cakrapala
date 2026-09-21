'use client';
// components/osint/layers/FireLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders active fire hotspots (NASA FIRMS) on the Cesium globe.
//
// Display modes:
//   - aggregate (> 3M m): no individual entities rendered
//   - icons (500K–3M m): coloured points without labels
//   - detail (< 500K m): labels with FRP (MW) + confidence ring
//
// Features:
//   - ID-based diffing: stable entity updates without flickering.
//   - Severity-driven size and color gradient (amber #f59e0b → red #ef4444).
//   - Age decay: opacity dims relative to requested day range.
//   - Pulse animation for fresh detections (< 1 hour).
//   - Full cleanup on unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import type { OsintEntity } from '@/lib/osint/types';
import { resolveDisplayMode, type DisplayMode } from '@/lib/osint/registry';

export interface FireLayerProps {
  /** Cesium.Viewer instance (from OsintGlobe ref). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any;
  /** Current fire entities from useLayer. */
  entities: OsintEntity[];
  /** Camera altitude in meters for display mode. */
  cameraAltM: number;
  /** Requested day range (1..3) for calculating decay. */
  dayRange?: number;
  /** Called when a fire entity is clicked. */
  onSelect?: (entity: OsintEntity) => void;
}

const FRESH_FIRE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Interpolasi warna antara amber (#f59e0b) dan merah (#ef4444) berdasarkan severity (0..1).
 */
function interpolateFireColor(
  severity: number,
  opacity: number,
  Cesium: typeof import('cesium'),
): import('cesium').Color {
  const s = Math.min(1, Math.max(0, severity));
  // Amber: rgb(245, 158, 11) | Red: rgb(239, 68, 68)
  const r = (245 + (239 - 245) * s) / 255;
  const g = (158 + (68 - 158) * s) / 255;
  const b = (11 + (68 - 11) * s) / 255;
  return new Cesium.Color(r, g, b, opacity);
}

/**
 * Hitung ukuran titik (pixelSize) berdasarkan severity (0..1).
 */
function calculatePointSize(severity: number): number {
  return Math.round(6 + severity * 10); // 6px .. 16px
}

/**
 * Hitung opasitas berdasarkan umur deteksi relatif terhadap rentang hari.
 */
function calculateAgeOpacity(observedAt: string, dayRange: number = 1): number {
  const ageMs = Math.max(0, Date.now() - new Date(observedAt).getTime());
  const maxSpanMs = dayRange * 24 * 60 * 60 * 1000;
  const ratio = Math.min(1, ageMs / maxSpanMs);
  return Math.max(0.3, 1.0 - ratio * 0.65);
}

/**
 * Cek apakah deteksi berumur kurang dari 1 jam.
 */
function isFreshDetection(observedAt: string): boolean {
  return Date.now() - new Date(observedAt).getTime() < FRESH_FIRE_THRESHOLD_MS;
}

export default function FireLayer({
  viewer,
  entities,
  cameraAltM,
  dayRange = 1,
  onSelect,
}: FireLayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityMapRef = useRef<Map<string, any>>(new Map());
  const osintMapRef = useRef<Map<string, OsintEntity>>(new Map());
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const mode: DisplayMode = resolveDisplayMode(cameraAltM);

  // ── Click Handler ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = new ((globalThis as any).Cesium?.ScreenSpaceEventHandler ?? class {
      destroy() {}
      setInputAction() {}
    })(viewer.scene.canvas);

    let cesiumModule: typeof import('cesium') | null = null;

    import('cesium').then((Cesium) => {
      cesiumModule = Cesium;
      handler.setInputAction(
        (click: { position: import('cesium').Cartesian2 }) => {
          if (!cesiumModule) return;
          const picked = viewer.scene.pick(click.position);
          if (
            Cesium.defined(picked) &&
            picked.id &&
            typeof picked.id.id === 'string'
          ) {
            const entity = osintMapRef.current.get(picked.id.id);
            if (entity && onSelectRef.current) {
              onSelectRef.current(entity);
            }
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );
    });

    return () => {
      handler.destroy();
    };
  }, [viewer]);

  // ── Synchronize Entities (Diffing) ─────────────────────────────────────────

  const syncEntities = useCallback(
    async (ents: OsintEntity[], displayMode: DisplayMode) => {
      if (!viewer || viewer.isDestroyed()) return;

      const Cesium = await import('cesium');
      if (viewer.isDestroyed()) return;

      const currentMap = entityMapRef.current;
      const newOsintMap = new Map<string, OsintEntity>();

      // Mode aggregate: hapus seluruh entitas individual
      if (displayMode === 'aggregate') {
        for (const [id, cesiumEntity] of currentMap) {
          viewer.entities.remove(cesiumEntity);
          currentMap.delete(id);
        }
        osintMapRef.current = newOsintMap;
        viewer.scene.requestRender();
        return;
      }

      const showLabels = displayMode === 'detail';
      const incomingIds = new Set(ents.map((e) => e.id));

      // Hapus entitas yang sudah tidak ada
      for (const [id, cesiumEntity] of currentMap) {
        if (!incomingIds.has(id)) {
          viewer.entities.remove(cesiumEntity);
          currentMap.delete(id);
        }
      }

      // Tambah atau perbarui entitas
      for (const ent of ents) {
        newOsintMap.set(ent.id, ent);

        const existing = currentMap.get(ent.id);
        const opacity = calculateAgeOpacity(ent.observedAt, dayRange);
        const size = calculatePointSize(ent.severity);
        const color = interpolateFireColor(ent.severity, opacity, Cesium);

        const confidence = (ent.raw as { confidence?: string })?.confidence;
        const outlineColor =
          confidence === 'high'
            ? Cesium.Color.WHITE.withAlpha(opacity)
            : confidence === 'nominal'
              ? Cesium.Color.fromCssColorString('#fcd34d').withAlpha(opacity * 0.8)
              : Cesium.Color.fromCssColorString('#78716c').withAlpha(opacity * 0.5);
        const outlineWidth = confidence === 'high' ? 2 : 1;

        if (existing) {
          existing.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(ent.position.lon, ent.position.lat, 0),
          );
          if (existing.point) {
            existing.point.pixelSize = new Cesium.ConstantProperty(size);
            existing.point.color = new Cesium.ConstantProperty(color);
            existing.point.outlineColor = new Cesium.ConstantProperty(outlineColor);
            existing.point.outlineWidth = new Cesium.ConstantProperty(outlineWidth);
          }
          if (existing.label) {
            existing.label.show = new Cesium.ConstantProperty(showLabels);
            existing.label.text = new Cesium.ConstantProperty(ent.label);
          }
        } else {
          const cesiumEntity = viewer.entities.add({
            id: ent.id,
            position: Cesium.Cartesian3.fromDegrees(
              ent.position.lon,
              ent.position.lat,
              0,
            ),
            point: {
              pixelSize: size,
              color,
              outlineColor,
              outlineWidth,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: ent.label,
              show: showLabels,
              font: '10px monospace',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -14),
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          currentMap.set(ent.id, cesiumEntity);
        }
      }

      osintMapRef.current = newOsintMap;
      viewer.scene.requestRender();
    },
    [viewer, dayRange],
  );

  useEffect(() => {
    syncEntities(entities, mode);
  }, [entities, mode, syncEntities]);

  // ── Pulse Animation untuk Deteksi Baru (< 1 jam) ───────────────────────────

  useEffect(() => {
    if (mode === 'aggregate') return;

    let phase = 0;
    pulseIntervalRef.current = setInterval(() => {
      const viewer_ = viewer;
      if (!viewer_ || viewer_.isDestroyed()) return;

      phase = (phase + 1) % 4;
      const scale = [1.0, 1.25, 1.4, 1.15][phase];

      let anyPulse = false;
      for (const [id, ent] of osintMapRef.current) {
        if (isFreshDetection(ent.observedAt)) {
          const cesiumEntity = entityMapRef.current.get(id);
          if (cesiumEntity?.point) {
            const baseSize = calculatePointSize(ent.severity);
            cesiumEntity.point.pixelSize = Math.round(baseSize * scale);
            anyPulse = true;
          }
        }
      }

      if (anyPulse) {
        viewer_.scene.requestRender();
      }
    }, 500);

    return () => {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
    };
  }, [viewer, mode]);

  // ── Cleanup on Unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    const currentMap = entityMapRef.current;
    return () => {
      if (!viewer || viewer.isDestroyed()) return;
      for (const [, cesiumEntity] of currentMap) {
        viewer.entities.remove(cesiumEntity);
      }
      currentMap.clear();
      osintMapRef.current.clear();
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
      viewer.scene.requestRender();
    };
  }, [viewer]);

  return null;
}
