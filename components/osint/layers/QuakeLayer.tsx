'use client';
// components/osint/layers/QuakeLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders earthquake entities on the Cesium globe.
//
// Display modes (driven by camera altitude):
//   - aggregate (> 3M m): no individual entities rendered
//   - icons (500K–3M m): coloured points without labels
//   - detail (< 500K m): labels + size + decay opacity
//
// Rendering rules:
//   - Point radius scales with severity.
//   - Opacity decays with event age.
//   - Events < 15 minutes old get a pulse animation (via pixelSize oscillation).
//   - Click → onSelect callback.
//   - ID-based diffing: only add/remove changed entities (no full rebuild).
//   - Full cleanup on unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import type { OsintEntity } from '@/lib/osint/types';
import { resolveDisplayMode, type DisplayMode } from '@/lib/osint/registry';

export interface QuakeLayerProps {
  /** Cesium.Viewer instance (from OsintGlobe ref). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any;
  /** Current earthquake entities from useLayer. */
  entities: OsintEntity[];
  /** Camera altitude in meters for display mode. */
  cameraAltM: number;
  /** Called when a quake entity is clicked. */
  onSelect?: (entity: OsintEntity) => void;
}

/** 15 minutes in milliseconds. */
const PULSE_THRESHOLD_MS = 15 * 60 * 1000;

/** Minimum and maximum point pixel sizes. */
const MIN_POINT_SIZE = 4;
const MAX_POINT_SIZE = 24;

/**
 * Calculate point size based on severity (0–1).
 * severity 0 → MIN_POINT_SIZE, severity 1 → MAX_POINT_SIZE.
 */
function pointSize(severity: number): number {
  return MIN_POINT_SIZE + severity * (MAX_POINT_SIZE - MIN_POINT_SIZE);
}

/**
 * Calculate opacity based on event age.
 * Fresh events → 1.0, events 24h+ old → 0.3.
 */
function ageOpacity(observedAt: string): number {
  const ageMs = Date.now() - new Date(observedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  // Linear decay from 1.0 to 0.3 over 24 hours.
  return Math.max(0.3, 1.0 - (ageHours / 24) * 0.7);
}

/**
 * Check whether an event is recent enough for a pulse animation.
 */
function isRecent(observedAt: string): boolean {
  return Date.now() - new Date(observedAt).getTime() < PULSE_THRESHOLD_MS;
}

export default function QuakeLayer({
  viewer,
  entities,
  cameraAltM,
  onSelect,
}: QuakeLayerProps) {
  // Map of entity id → Cesium.Entity for diffing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityMapRef = useRef<Map<string, any>>(new Map());
  // Store current OsintEntities keyed by id for click lookup.
  const osintMapRef = useRef<Map<string, OsintEntity>>(new Map());
  // Pulse animation interval handle.
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const mode: DisplayMode = resolveDisplayMode(cameraAltM);

  // ── Click handler ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const handler = new (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).Cesium?.ScreenSpaceEventHandler ??
        // Fallback: lazy import if Cesium not yet on globalThis.
        class { destroy() {} setInputAction() {} }
    )(viewer.scene.canvas);

    let cesiumModule: typeof import('cesium') | null = null;

    import('cesium').then((Cesium) => {
      cesiumModule = Cesium;

      const realHandler = new Cesium.ScreenSpaceEventHandler(
        viewer.scene.canvas,
      );

      realHandler.setInputAction(
        (click: { position: import('cesium').Cartesian2 }) => {
          const picked = viewer.scene.pick(click.position);
          if (picked?.id?.id) {
            const rawId = picked.id.id.startsWith('quake:') ? picked.id.id.slice(6) : picked.id.id;
            const osintEntity = osintMapRef.current.get(rawId) || osintMapRef.current.get(picked.id.id);
            if (osintEntity) {
              onSelectRef.current?.(osintEntity);
            }
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );

      // Swap handler reference for cleanup.
      (handler as { _real?: typeof realHandler })._real = realHandler;
    });

    return () => {
      handler.destroy?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any)._real?.destroy?.();
      void cesiumModule;
    };
  }, [viewer]);

  // ── Diff-based entity sync ──────────────────────────────────────────────

  const syncEntities = useCallback(
    async (ents: OsintEntity[], displayMode: DisplayMode) => {
      if (!viewer || viewer.isDestroyed()) return;

      const Cesium = await import('cesium');
      const currentMap = entityMapRef.current;
      const newOsintMap = new Map<string, OsintEntity>();

      // In aggregate mode (>3,000 km altitude), show significant quakes (M >= 4.5)
      const activeEnts =
        displayMode === 'aggregate'
          ? ents.filter((e) => {
              const rawMag = (e.raw as Record<string, unknown>)?.mag;
              const mag = typeof rawMag === 'number' ? rawMag : e.severity * 9;
              return mag >= 4.5;
            })
          : ents;

      const showLabels = displayMode === 'detail';

      // Build set of incoming entity IDs.
      const incomingIds = new Set(activeEnts.map((e) => e.id));

      // Remove entities that are no longer in the data or not qualified.
      for (const [id, cesiumEntity] of currentMap) {
        if (!incomingIds.has(id)) {
          viewer.entities.remove(cesiumEntity);
          currentMap.delete(id);
        }
      }

      // Add or update entities.
      for (const ent of activeEnts) {
        newOsintMap.set(ent.id, ent);

        const existing = currentMap.get(ent.id);
        const opacity = ageOpacity(ent.observedAt);
        const rawSize = pointSize(ent.severity);
        const size = displayMode === 'aggregate' ? Math.max(10, rawSize) : rawSize;
        const color = Cesium.Color.fromCssColorString('#e879f9').withAlpha(
          opacity,
        );

        if (existing) {
          // Update position and visual properties.
          existing.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(
              ent.position.lon,
              ent.position.lat,
              0, // render on surface
            ),
          );
          if (existing.point) {
            existing.point.pixelSize = new Cesium.ConstantProperty(size);
            existing.point.color = new Cesium.ConstantProperty(color);
          }
          if (existing.label) {
            existing.label.show = new Cesium.ConstantProperty(showLabels);
            existing.label.text = new Cesium.ConstantProperty(ent.label);
          }
        } else {
          // Create new entity.
          const cesiumEntity = viewer.entities.add({
            id: ent.id.startsWith('quake:') ? ent.id : `quake:${ent.id}`,
            position: Cesium.Cartesian3.fromDegrees(
              ent.position.lon,
              ent.position.lat,
              0,
            ),
            point: {
              pixelSize: size,
              color,
              outlineColor: Cesium.Color.fromCssColorString('#e879f9'),
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: ent.label,
              font: '12px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              show: showLabels,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });

          currentMap.set(ent.id, cesiumEntity);
        }
      }

      osintMapRef.current = newOsintMap;
      viewer.scene.requestRender();
    },
    [viewer],
  );

  // Run sync when entities or display mode changes.
  useEffect(() => {
    syncEntities(entities, mode);
  }, [entities, mode, syncEntities]);

  // ── Pulse animation for recent events ───────────────────────────────────

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Oscillate pixel size for recent events.
    let phase = 0;

    const tick = async () => {
      const Cesium = await import('cesium');
      phase += 0.1;
      const scale = 1 + Math.sin(phase) * 0.3; // ±30% size oscillation

      for (const ent of entities) {
        if (!isRecent(ent.observedAt)) continue;
        const cesiumEntity = entityMapRef.current.get(ent.id);
        if (!cesiumEntity?.point) continue;

        const baseSize = pointSize(ent.severity);
        cesiumEntity.point.pixelSize = new Cesium.ConstantProperty(
          baseSize * scale,
        );
      }

      if (entityMapRef.current.size > 0) {
        viewer.scene.requestRender();
      }
    };

    pulseIntervalRef.current = setInterval(tick, 100);

    return () => {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
    };
  }, [viewer, entities]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
      }

      const currentMap = entityMapRef.current;
      if (viewer && !viewer.isDestroyed()) {
        for (const cesiumEntity of currentMap.values()) {
          viewer.entities.remove(cesiumEntity);
        }
      }
      currentMap.clear();
      osintMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This component renders nothing — it imperatively manages Cesium entities.
  return null;
}
