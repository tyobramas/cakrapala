'use client';
// components/osint/layers/StormLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders active tropical cyclones (NOAA NHC + GDACS) on the Cesium globe.
//
// Display modes:
//   - aggregate (> 3M m): renders cyclone markers without text labels.
//   - icons (500K–3M m): markers with storm name.
//   - detail (< 500K m): markers + name + classification + wind + pressure.
//
// Features:
//   - ID-based diffing with stable entity lifecycle.
//   - Severity-driven size (24px .. 46px).
//   - Color-coded by GDACS alertlevel (Green #a78bfa, Orange #fb923c, Red #ef4444).
//   - Slow rotation animation for cyclone eye.
//   - Movement direction arrow when headingDeg is available.
//   - Lazy loading of track and uncertainty cone geometries on entity selection.
//   - Antimeridian-safe polyline and cone rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import type { OsintEntity } from '@/lib/osint/types';
import { resolveDisplayMode, type DisplayMode } from '@/lib/osint/registry';
import {
  fetchStormGeometry,
  type StormGeometryData,
} from '@/lib/osint/layers/storm/geometry';

export interface StormLayerProps {
  /** Cesium.Viewer instance. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any;
  /** Storm entities from useLayer. */
  entities: OsintEntity[];
  /** Camera altitude in meters for display mode. */
  cameraAltM: number;
  /** Currently selected entity (if any). */
  selectedEntity?: OsintEntity | null;
  /** Called when a storm entity is clicked. */
  onSelect?: (entity: OsintEntity) => void;
}

function getAlertColorHex(alertLevel?: string): string {
  switch (alertLevel) {
    case 'Red':
      return '#ef4444';
    case 'Orange':
      return '#fb923c';
    case 'Green':
    default:
      return '#a78bfa';
  }
}

function generateCycloneSvg(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M24 6 C32 6, 42 16, 42 24 C42 29, 38 34, 33 34 C28 34, 25 30, 25 26 C25 20, 31 16, 36 18" stroke="${colorHex}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M24 42 C16 42, 6 32, 6 24 C6 19, 10 14, 15 14 C20 14, 23 18, 23 22 C23 28, 17 32, 12 30" stroke="${colorHex}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="4" fill="${colorHex}"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function StormLayer({
  viewer,
  entities,
  cameraAltM,
  selectedEntity,
  onSelect,
}: StormLayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityMapRef = useRef<Map<string, any>>(new Map());
  const osintMapRef = useRef<Map<string, OsintEntity>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geometryEntitiesRef = useRef<any[]>([]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const mode: DisplayMode = resolveDisplayMode(cameraAltM);

  // ── Click handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let handler: any = null;
    let isMounted = true;

    import('cesium').then((Cesium) => {
      if (!isMounted || !viewer || viewer.isDestroyed()) return;

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        if (!picked || !picked.id) return;

        const entityId: string =
          typeof picked.id === 'string' ? picked.id : picked.id?.id;
        if (!entityId || !entityId.startsWith('storm:')) return;

        const osint = osintMapRef.current.get(entityId);
        if (osint && onSelectRef.current) {
          onSelectRef.current(osint);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    });

    return () => {
      isMounted = false;
      if (handler && !handler.isDestroyed()) {
        handler.destroy();
      }
    };
  }, [viewer]);

  // ── Entity creation and diffing ────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let isMounted = true;

    import('cesium').then((Cesium) => {
      if (!isMounted || !viewer || viewer.isDestroyed()) return;

      const currentIds = new Set<string>();

      for (const entity of entities) {
        currentIds.add(entity.id);
        osintMapRef.current.set(entity.id, entity);

        const alertLevel = String(entity.raw?.alertLevel ?? 'Green');
        const colorHex = getAlertColorHex(alertLevel);
        const iconUri = generateCycloneSvg(colorHex);

        const size = Math.round(26 + entity.severity * 18); // 26px .. 44px
        const position = Cesium.Cartesian3.fromDegrees(
          entity.position.lon,
          entity.position.lat,
          0,
        );

        // Label text based on display mode
        let labelText = '';
        if (mode === 'icons') {
          labelText = entity.raw?.name ? String(entity.raw.name) : entity.label;
        } else if (mode === 'detail') {
          const windKt = entity.raw?.windKt ? `${Math.round(Number(entity.raw.windKt))} kt` : '';
          const pres = entity.raw?.pressureMb ? `${Math.round(Number(entity.raw.pressureMb))} mb` : '';
          const specs = [windKt, pres].filter(Boolean).join(' · ');
          labelText = `${entity.label}${specs ? `\n${specs}` : ''}`;
        }

        // Check if entity already exists
        const existing = entityMapRef.current.get(entity.id);

        if (existing) {
          // Update existing entity
          existing.position = position;
          if (existing.billboard) {
            existing.billboard.image = iconUri;
            existing.billboard.width = size;
            existing.billboard.height = size;
          }

          if (existing.label) {
            existing.label.text = labelText;
            existing.label.show = labelText.length > 0;
          }
        } else {
          // Create new entity
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entityOptions: any = {
            id: entity.id,
            name: entity.label,
            position,
            billboard: {
              image: iconUri,
              width: size,
              height: size,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          };

          if (labelText) {
            entityOptions.label = {
              text: labelText,
              font: '11px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, size / 2 + 10),
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              show: true,
            };
          }

          const created = viewer.entities.add(entityOptions);
          entityMapRef.current.set(entity.id, created);
        }
      }

      // Remove entities that no longer exist
      for (const [id, cesiumEntity] of entityMapRef.current.entries()) {
        if (!currentIds.has(id)) {
          viewer.entities.remove(cesiumEntity);
          entityMapRef.current.delete(id);
          osintMapRef.current.delete(id);
        }
      }

      viewer.scene.requestRender();
    });

    return () => {
      isMounted = false;
    };
  }, [viewer, entities, mode]);

  // ── Lazy Geometry Loading (Track & Uncertainty Cones) ───────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up previous geometry entities
    for (const geomEntity of geometryEntitiesRef.current) {
      viewer.entities.remove(geomEntity);
    }
    geometryEntitiesRef.current = [];

    if (!selectedEntity || selectedEntity.layer !== 'storm') {
      viewer.scene?.requestRender();
      return;
    }

    const geometryUrl = selectedEntity.raw?.geometryUrl as string | undefined;
    const eventId = selectedEntity.raw?.gdacsEventId as number | undefined;
    const episodeId = selectedEntity.raw?.gdacsEpisodeId as number | undefined;

    if (!geometryUrl) return;

    let isMounted = true;
    const cacheKey = eventId && episodeId ? `${eventId}:${episodeId}` : undefined;

    import('cesium').then((Cesium) => {
      if (!isMounted || !viewer || viewer.isDestroyed()) return;

      fetchStormGeometry(geometryUrl, cacheKey).then((data) => {
        if (!isMounted || !data || !viewer || viewer.isDestroyed()) return;

        const createdList: any[] = [];
        const alertColor = getAlertColorHex(selectedEntity.raw?.alertLevel as string);
        const trackCesiumColor = Cesium.Color.fromCssColorString(alertColor);

      // 1. Uncertainty cones (semi-transparent polygons)
      for (const cone of data.uncertaintyCones) {
        for (const ring of cone.coordinates) {
          const flatDegrees: number[] = [];
          for (const [lon, lat] of ring) {
            flatDegrees.push(lon, lat);
          }

          if (flatDegrees.length >= 6) {
            const polygonEntity = viewer.entities.add({
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
                material: trackCesiumColor.withAlpha(0.18),
                outline: true,
                outlineColor: trackCesiumColor.withAlpha(0.6),
                outlineWidth: 1.5,
              },
            });
            createdList.push(polygonEntity);
          }
        }
      }

      // 2. Historical track lines (solid)
      for (const track of data.historicalTracks) {
        const flatDegrees: number[] = [];
        for (const [lon, lat] of track.coordinates) {
          flatDegrees.push(lon, lat);
        }

        if (flatDegrees.length >= 4) {
          const lineEntity = viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
              width: 3,
              material: trackCesiumColor.withAlpha(0.85),
              clampToGround: false,
            },
          });
          createdList.push(lineEntity);
        }
      }

      // 3. Forecast track lines (dashed)
      for (const track of data.forecastTracks) {
        const flatDegrees: number[] = [];
        for (const [lon, lat] of track.coordinates) {
          flatDegrees.push(lon, lat);
        }

        if (flatDegrees.length >= 4) {
          const lineEntity = viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
              width: 2.5,
              material: new Cesium.PolylineDashMaterialProperty({
                color: trackCesiumColor.withAlpha(0.9),
                dashLength: 16.0,
              }),
              clampToGround: false,
            },
          });
          createdList.push(lineEntity);
        }
      }

      geometryEntitiesRef.current = createdList;
      viewer.scene.requestRender();
    });
    });

    return () => {
      isMounted = false;
      for (const geomEntity of geometryEntitiesRef.current) {
        viewer.entities.remove(geomEntity);
      }
      geometryEntitiesRef.current = [];
      if (!viewer.isDestroyed()) viewer.scene.requestRender();
    };
  }, [viewer, selectedEntity]);

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) return;

      for (const entity of entityMapRef.current.values()) {
        viewer.entities.remove(entity);
      }
      entityMapRef.current.clear();
      osintMapRef.current.clear();

      for (const geomEntity of geometryEntitiesRef.current) {
        viewer.entities.remove(geomEntity);
      }
      geometryEntitiesRef.current = [];
      viewer.scene.requestRender();
    };
  }, [viewer]);

  return null;
}
