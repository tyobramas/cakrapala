'use client';
// components/osint/layers/EyesLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Eyes Layer: Public Webcams & Official Traffic Cameras (Cesium 3D visualizer).
//
// Features:
//   - Lime (#a3e635) camera icons for public webcams.
//   - View cone (semi-transparent lime polygon) if headingDeg is available.
//   - Mode 'icons': icon only, no thumbnails (L2 quota & rate-limit compliance).
//   - Mode 'detail': icon + title.
//   - Inactive webcams (>24h since last updated) displayed dimmed with "(Tidak aktif)".
//   - Diffing based on entity id with clean primitive unmount.
//   - Zero continuous polling (refreshMs = 0).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, memo } from 'react';
import type { DisplayMode } from '@/lib/osint/registry';
import type { OsintEntity } from '@/lib/osint/types';

const getCesium = () => import('cesium');

export interface EyesFilterSettings {
  provider?: 'all' | 'windy' | 'official';
  hideInactive?: boolean;
  category?: string;
}

export interface EyesLayerProps {
  viewer: any;
  entities: OsintEntity[];
  displayMode: DisplayMode;
  onSelectEntity?: (entity: OsintEntity | null) => void;
  selectedEntityId?: string | null;
  filters?: EyesFilterSettings;
}

// ── SVG Camera Icon Generator ────────────────────────────────────────────────

function createCameraSvg(fillColor: string, strokeColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <rect x="3" y="7" width="22" height="16" rx="3.5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />
    <path d="M10 7 L12 4 L16 4 L18 7 Z" fill="${strokeColor}" />
    <circle cx="14" cy="15" r="4.5" fill="#1e293b" stroke="${strokeColor}" stroke-width="1.8" />
    <circle cx="14" cy="15" r="2" fill="#ffffff" />
    <circle cx="21" cy="10" r="1.2" fill="#ffffff" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ICONS = {
  activeCamera: createCameraSvg('#65a30d', '#a3e635'),
  selectedCamera: createCameraSvg('#84cc16', '#bef264'),
  inactiveCamera: createCameraSvg('#3f3f46', '#71717a'),
  officialCamera: createCameraSvg('#0284c7', '#38bdf8'),
};

interface RuntimeWebcamState {
  entity: OsintEntity;
  cesiumEntity: any;
  coneEntity?: any;
  isActive: boolean;
}

/** Computes points for a field-of-view cone starting from camera position */
function computeConePositions(
  lat: number,
  lon: number,
  headingDeg: number,
  coneLengthMeters = 400,
  halfFovDeg = 25,
): Array<{ lat: number; lon: number }> {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const earthRadius = 6378137; // meters

  function destinationPoint(startLat: number, startLon: number, bearingDeg: number, distM: number) {
    const b = bearingDeg * toRad;
    const lat1 = startLat * toRad;
    const lon1 = startLon * toRad;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distM / earthRadius) +
      Math.cos(lat1) * Math.sin(distM / earthRadius) * Math.cos(b),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(b) * Math.sin(distM / earthRadius) * Math.cos(lat1),
        Math.cos(distM / earthRadius) - Math.sin(lat1) * Math.sin(lat2),
      );
    return { lat: lat2 * toDeg, lon: lon2 * toDeg };
  }

  const pLeft = destinationPoint(lat, lon, headingDeg - halfFovDeg, coneLengthMeters);
  const pCenter = destinationPoint(lat, lon, headingDeg, coneLengthMeters * 1.15);
  const pRight = destinationPoint(lat, lon, headingDeg + halfFovDeg, coneLengthMeters);

  return [
    { lat, lon },
    pLeft,
    pCenter,
    pRight,
  ];
}

const EyesLayer = memo(function EyesLayer({
  viewer,
  entities,
  displayMode,
  onSelectEntity,
  selectedEntityId,
  filters,
}: EyesLayerProps) {
  const entitiesRef = useRef<Map<string, RuntimeWebcamState>>(new Map());
  const selectedIdRef = useRef<string | null>(selectedEntityId ?? null);
  const onSelectRef = useRef(onSelectEntity);
  const clickHandlerRef = useRef<any>(null);
  const dsRef = useRef<any>(null);

  selectedIdRef.current = selectedEntityId ?? null;
  onSelectRef.current = onSelectEntity;

  // ── Sync Entities & Render in Cesium ───────────────────────────────────────

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let cancelled = false;

    getCesium().then((Cesium) => {
      if (cancelled || !viewer || viewer.isDestroyed()) return;

      // Obtain or create dedicated CustomDataSource for eyes
      let ds = viewer.dataSources.getByName('osint:eyes')[0];
      if (!ds) {
        ds = new Cesium.CustomDataSource('osint:eyes');
        viewer.dataSources.add(ds);
      }
      dsRef.current = ds;

      const currentIds = new Set<string>();
      const states = entitiesRef.current;
      const f = filters ?? {};
      const hideInactive = f.hideInactive !== false; // default true
      const now = Date.now();

      for (const entity of entities) {
        const id = entity.id;
        const raw = (entity.raw ?? {}) as Record<string, unknown>;
        const provider = (raw.provider as string) || (id.startsWith('eyes:official:') ? 'official' : 'windy');

        // Provider filter
        if (f.provider && f.provider !== 'all' && f.provider !== provider) {
          continue;
        }

        // Active status: explicit isActive, or checked within last 24h
        const observedAtMs = new Date(entity.observedAt).getTime() || now;
        const isFresh = now - observedAtMs <= 24 * 3600 * 1000;
        const isActive = raw.isActive !== undefined ? Boolean(raw.isActive) : isFresh;

        if (hideInactive && !isActive) {
          continue;
        }

        // Category filter if specified
        if (f.category && Array.isArray(raw.categories)) {
          if (!raw.categories.some((c) => String(c).toLowerCase().includes(f.category!.toLowerCase()))) {
            continue;
          }
        }

        currentIds.add(id);

        const isSelected = selectedIdRef.current === id;
        const isOfficial = provider === 'official';
        let iconUri = isActive ? ICONS.activeCamera : ICONS.inactiveCamera;
        if (isSelected) iconUri = ICONS.selectedCamera;
        else if (isOfficial && isActive) iconUri = ICONS.officialCamera;

        const opacity = isActive ? 1.0 : 0.45;
        const labelText = isActive ? entity.label : `${entity.label} (Tidak aktif)`;

        let state = states.get(id);

        if (!state) {
          // ── Create New Cesium Entity ──
          const cesiumEntity = ds.entities.add({
            id,
            position: Cesium.Cartesian3.fromDegrees(entity.position.lon, entity.position.lat, 0),
            billboard: {
              image: iconUri,
              width: isSelected ? 34 : 26,
              height: isSelected ? 34 : 26,
              color: new Cesium.Color(1.0, 1.0, 1.0, opacity),
              scaleByDistance: new Cesium.NearFarScalar(5e3, 1.2, 5e6, 0.5),
            },
            label: displayMode === 'detail'
              ? {
                  text: labelText,
                  font: '11px sans-serif',
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  outlineWidth: 2,
                  outlineColor: Cesium.Color.BLACK,
                  fillColor: isActive ? Cesium.Color.fromCssColorString('#bef264') : Cesium.Color.fromCssColorString('#a1a1aa'),
                  pixelOffset: new Cesium.Cartesian2(0, 18),
                  distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500_000),
                }
              : undefined,
          });

          // Create view cone polygon if headingDeg is present
          let coneEntity: any = null;
          if (entity.headingDeg !== undefined) {
            const conePoints = computeConePositions(entity.position.lat, entity.position.lon, entity.headingDeg);
            const hierarchy = conePoints.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0));

            coneEntity = ds.entities.add({
              id: `${id}:cone`,
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(hierarchy),
                material: Cesium.Color.fromCssColorString('#a3e635').withAlpha(0.2),
                height: 0,
              },
            });
          }

          state = {
            entity,
            cesiumEntity,
            coneEntity,
            isActive,
          };
          states.set(id, state);
        } else {
          // ── Update Existing Entity ──
          state.entity = entity;
          state.isActive = isActive;

          const b = state.cesiumEntity.billboard;
          if (b) {
            b.image = iconUri;
            b.color = new Cesium.Color(1.0, 1.0, 1.0, opacity);
            b.width = isSelected ? 34 : 26;
            b.height = isSelected ? 34 : 26;
          }

          if (displayMode === 'detail') {
            if (!state.cesiumEntity.label) {
              state.cesiumEntity.label = {
                text: labelText,
                font: '11px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                fillColor: isActive ? Cesium.Color.fromCssColorString('#bef264') : Cesium.Color.fromCssColorString('#a1a1aa'),
                pixelOffset: new Cesium.Cartesian2(0, 18),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500_000),
              };
            } else {
              state.cesiumEntity.label.text = labelText;
              state.cesiumEntity.label.fillColor = isActive ? Cesium.Color.fromCssColorString('#bef264') : Cesium.Color.fromCssColorString('#a1a1aa');
            }
          } else if (state.cesiumEntity.label) {
            state.cesiumEntity.label = undefined;
          }
        }
      }

      // Remove entities that are no longer in viewport / filtered out
      for (const [id, s] of states.entries()) {
        if (!currentIds.has(id)) {
          ds.entities.remove(s.cesiumEntity);
          if (s.coneEntity) {
            ds.entities.remove(s.coneEntity);
          }
          states.delete(id);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [viewer, entities, displayMode, filters, selectedEntityId]);

  // ── ScreenSpaceEventHandler for Picking ─────────────────────────────────────

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let cancelled = false;

    getCesium().then((Cesium) => {
      if (cancelled || !viewer || viewer.isDestroyed()) return;

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      clickHandlerRef.current = handler;

      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id) {
          const pickedId = picked.id.id;
          if (typeof pickedId === 'string' && pickedId.startsWith('eyes:')) {
            const cleanId = pickedId.replace(':cone', '');
            const foundState = entitiesRef.current.get(cleanId);
            if (foundState) {
              onSelectRef.current?.(foundState.entity);
              return;
            }
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    });

    return () => {
      cancelled = true;
      if (clickHandlerRef.current && !clickHandlerRef.current.isDestroyed()) {
        clickHandlerRef.current.destroy();
        clickHandlerRef.current = null;
      }
    };
  }, [viewer]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        const ds = dsRef.current || viewer.dataSources.getByName('osint:eyes')[0];
        if (ds) {
          viewer.dataSources.remove(ds, true);
        }
      }
      entitiesRef.current.clear();
    };
  }, [viewer]);

  return null;
});

export default EyesLayer;
