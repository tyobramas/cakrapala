'use client';
// components/osint/layers/SeaLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Sea Layer: AIS Vessel Tracking (Cesium 3D visualizer).
//
// Features:
//   - Teal (#2dd4bf) boat hull icons rotating by true heading (0..359°).
//   - Neutral circle icon without rotation if heading is sentinel (511) or missing.
//   - Distinct markers for emergency SART/MOB (red pulse) and degraded position (amber).
//   - Hollow circle for "last known position" (1h..12h age).
//   - Frame-by-frame dead reckoning in scene.preRender along COG (not heading) up to 60s max.
//   - Stationary ships (at anchor/moored/aground) or stale (> 5m) do NOT dead-reckon.
//   - 5-minute historical trails in 'detail' mode (< 500 km), stored only in client memory.
//   - Zero persistent storage, zero per-vessel tracking across sessions (privacy).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, memo } from 'react';
import type { DisplayMode } from '@/lib/osint/registry';
import type { OsintEntity } from '@/lib/osint/types';
import { extrapolateVessel } from '@/lib/osint/layers/sea/deadReckon';

const getCesium = () => import('cesium');

export interface SeaFilterSettings {
  category?: string; // 'all' | 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'other'
  hideAnchoredMoored?: boolean; // navStat 1 & 5
  hideOlderThan1Hour?: boolean; // age > 3600 s
  showTrails?: boolean;
}

export interface SeaLayerProps {
  viewer: any;
  entities: OsintEntity[];
  displayMode: DisplayMode;
  onSelectEntity?: (entity: OsintEntity | null) => void;
  selectedEntityId?: string | null;
  filters?: SeaFilterSettings;
}

// ── SVG Icon Generators ──────────────────────────────────────────────────────

function createHullSvg(fillColor: string, strokeColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M16 3 C20 10 23 18 22 27 C20 29 12 29 10 27 C9 18 12 10 16 3 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="round" />
    <circle cx="16" cy="14" r="2.2" fill="#ffffff" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createCircleSvg(fillColor: string, strokeColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="7" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />
    <circle cx="12" cy="12" r="2.5" fill="#ffffff" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createHollowCircleSvg(strokeColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="7.5" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-dasharray="3,2" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ICONS = {
  normalHull: createHullSvg('#0d9488', '#2dd4bf'),
  unreliableHull: createHullSvg('#b45309', '#fbbf24'),
  emergencyHull: createHullSvg('#b91c1c', '#ef4444'),
  normalCircle: createCircleSvg('#0d9488', '#2dd4bf'),
  unreliableCircle: createCircleSvg('#b45309', '#fbbf24'),
  emergencyCircle: createCircleSvg('#b91c1c', '#ef4444'),
  hollowCircle: createHollowCircleSvg('#5eead4'),
};

interface RuntimeVesselState {
  entity: OsintEntity;
  cesiumEntity: any;
  observedAtMs: number;
  lastKnownLat: number;
  lastKnownLon: number;
  currentLat: number;
  currentLon: number;
  targetLat: number;
  targetLon: number;
  headingDeg?: number;
  cogDeg?: number;
  speedMs?: number;
  navStat?: number;
  positionReliable: boolean;
  isEmergency: boolean;
  freshness: string;
  trailPositions: Array<{ lat: number; lon: number }>;
  trailPolylineEntity?: any;
}

const SeaLayer = memo(function SeaLayer({
  viewer,
  entities,
  displayMode,
  onSelectEntity,
  selectedEntityId,
  filters,
}: SeaLayerProps) {
  const dataSourceRef = useRef<any>(null);
  const vesselStatesRef = useRef<Map<string, RuntimeVesselState>>(new Map());
  const selectedIdRef = useRef<string | null>(selectedEntityId ?? null);
  const displayModeRef = useRef<DisplayMode>(displayMode);
  const filtersRef = useRef<SeaFilterSettings>(filters ?? {});

  selectedIdRef.current = selectedEntityId ?? null;
  displayModeRef.current = displayMode;
  filtersRef.current = filters ?? {};

  // ── Initialize DataSource & Animation Loop ──────────────────────────────────

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let isMounted = true;
    let ds: any = null;
    let removeListener: (() => void) | null = null;

    getCesium().then((Cesium) => {
      if (!isMounted) return;

      ds = new Cesium.CustomDataSource('osint-sea-layer');
      viewer.dataSources.add(ds);
      dataSourceRef.current = ds;

      // Click handler
      const screenHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      screenHandler.setInputAction((movement: any) => {
        const picked = viewer.scene.pick(movement.position);
        if (picked && picked.id && typeof picked.id.id === 'string' && picked.id.id.startsWith('sea:')) {
          const state = vesselStatesRef.current.get(picked.id.id);
          if (state && onSelectEntity) {
            onSelectEntity(state.entity);
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Frame-by-frame dead reckoning animation loop
      const onPreRender = () => {
        if (!isMounted || !ds) return;
        const now = Date.now();
        const mode = displayModeRef.current;

        vesselStatesRef.current.forEach((state) => {
          const dtSec = Math.max(0, (now - state.observedAtMs) / 1000);

          // Smooth interpolation from current extrapolated to new target
          const lerpFactor = 0.05;
          state.currentLat += (state.targetLat - state.currentLat) * lerpFactor;
          state.currentLon += (state.targetLon - state.currentLon) * lerpFactor;

          // Dead reckoning extrapolation if eligible
          const projected = extrapolateVessel(
            state.targetLat,
            state.targetLon,
            state.cogDeg,
            state.speedMs,
            dtSec,
            {
              navStat: state.navStat,
              ageSeconds: Number(state.entity.raw?.ageS) || 0,
            },
          );

          state.currentLat = projected.lat;
          state.currentLon = projected.lon;

          // Update Cesium entity position directly
          if (state.cesiumEntity) {
            state.cesiumEntity.position = Cesium.Cartesian3.fromDegrees(
              state.currentLon,
              state.currentLat,
              0, // Vessels are at sea level
            );

            // Update trail if in detail mode
            if (mode === 'detail' && filtersRef.current.showTrails !== false && state.trailPolylineEntity) {
              const pts = [
                ...state.trailPositions.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0)),
                Cesium.Cartesian3.fromDegrees(state.currentLon, state.currentLat, 0),
              ];
              if (pts.length >= 2) {
                state.trailPolylineEntity.polyline.positions = pts;
              }
            }
          }
        });
      };

      viewer.scene.preRender.addEventListener(onPreRender);
      removeListener = () => {
        try {
          viewer.scene.preRender.removeEventListener(onPreRender);
        } catch {}
      };

      (ds as any)._screenHandler = screenHandler;
    });

    return () => {
      isMounted = false;
      if (removeListener) removeListener();
      if (ds && viewer && !viewer.isDestroyed()) {
        if ((ds as any)._screenHandler) {
          (ds as any)._screenHandler.destroy();
        }
        viewer.dataSources.remove(ds, true);
      }
      dataSourceRef.current = null;
      vesselStatesRef.current.clear();
    };
  }, [viewer, onSelectEntity]);

  // ── Sync Entities & Diffing ─────────────────────────────────────────────────

  useEffect(() => {
    const ds = dataSourceRef.current;
    if (!viewer || viewer.isDestroyed() || !ds) return;

    getCesium().then((Cesium) => {
      const currentIds = new Set<string>();
      const states = vesselStatesRef.current;
      const now = Date.now();
      const mode = displayMode;
      const f = filters ?? {};

      for (const entity of entities) {
        if (entity.layer !== 'sea') continue;
        const id = entity.id;
        currentIds.add(id);

        const raw = entity.raw || {};
        const isEmergency = Boolean(raw.isEmergency);
        const positionReliable = raw.positionReliable !== false;
        const freshness = String(raw.freshness || 'fresh');
        const navStat = Number(raw.navStat);
        const ageS = Number(raw.ageS) || 0;
        const category = String(raw.shipTypeCategory || 'other');

        // Filter checks: Emergency vessels (SART/MOB) ALWAYS bypass filters!
        if (!isEmergency) {
          if (f.category && f.category !== 'all' && f.category !== category) {
            continue;
          }
          if (f.hideAnchoredMoored && (navStat === 1 || navStat === 5)) {
            continue;
          }
          if (f.hideOlderThan1Hour && ageS > 3600) {
            continue;
          }
        }

        const headingDeg = entity.headingDeg;
        const cogDeg = typeof raw.cogRaw === 'number' && raw.cogRaw < 360 ? raw.cogRaw : undefined;
        const speedMs = entity.speedMs;

        // Choose appropriate icon & rotation
        const isSelected = selectedIdRef.current === id;
        const isLastKnown = freshness === 'last_known';
        const hasHeading = headingDeg !== undefined;

        let iconUri: string;
        if (isLastKnown) {
          iconUri = ICONS.hollowCircle;
        } else if (isEmergency) {
          iconUri = hasHeading ? ICONS.emergencyHull : ICONS.emergencyCircle;
        } else if (!positionReliable) {
          iconUri = hasHeading ? ICONS.unreliableHull : ICONS.unreliableCircle;
        } else {
          iconUri = hasHeading ? ICONS.normalHull : ICONS.normalCircle;
        }

        // Heading rotation in radians (Cesium billboard rotation is clockwise from +y/North)
        const rotationRad = hasHeading ? Cesium.Math.toRadians(headingDeg) : 0;
        const opacity = isLastKnown ? 0.6 : (freshness === 'stale' ? 0.45 : 1.0);

        let state = states.get(id);

        if (!state) {
          // ── Create New Vessel Entity ──
          const cesiumEntity = ds.entities.add({
            id,
            position: Cesium.Cartesian3.fromDegrees(entity.position.lon, entity.position.lat, 0),
            billboard: {
              image: iconUri,
              rotation: rotationRad,
              alignedAxis: Cesium.Cartesian3.UNIT_Z,
              width: isSelected ? 36 : (isEmergency ? 32 : 26),
              height: isSelected ? 36 : (isEmergency ? 32 : 26),
              color: new Cesium.Color(1.0, 1.0, 1.0, opacity),
              scaleByDistance: new Cesium.NearFarScalar(5e3, 1.2, 5e6, 0.5),
            },
            label: mode === 'detail'
              ? {
                  text: entity.label,
                  font: '11px sans-serif',
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  outlineWidth: 2,
                  outlineColor: Cesium.Color.BLACK,
                  fillColor: isEmergency ? Cesium.Color.fromCssColorString('#fca5a5') : Cesium.Color.fromCssColorString('#ccfbf1'),
                  pixelOffset: new Cesium.Cartesian2(0, 20),
                  distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500_000),
                }
              : undefined,
          });

          // Create trail polyline if in detail mode
          let trailPolylineEntity: any = null;
          if (mode === 'detail' && f.showTrails !== false) {
            trailPolylineEntity = ds.entities.add({
              id: `${id}:trail`,
              polyline: {
                positions: [Cesium.Cartesian3.fromDegrees(entity.position.lon, entity.position.lat, 0)],
                width: 1.5,
                material: new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.fromCssColorString('#2dd4bf').withAlpha(0.5),
                  dashLength: 8,
                }),
              },
            });
          }

          state = {
            entity,
            cesiumEntity,
            observedAtMs: new Date(entity.observedAt).getTime() || now,
            lastKnownLat: entity.position.lat,
            lastKnownLon: entity.position.lon,
            currentLat: entity.position.lat,
            currentLon: entity.position.lon,
            targetLat: entity.position.lat,
            targetLon: entity.position.lon,
            headingDeg,
            cogDeg,
            speedMs,
            navStat,
            positionReliable,
            isEmergency,
            freshness,
            trailPositions: [{ lat: entity.position.lat, lon: entity.position.lon }],
            trailPolylineEntity,
          };
          states.set(id, state);
        } else {
          // ── Update Existing Vessel Entity ──
          state.entity = entity;
          state.observedAtMs = new Date(entity.observedAt).getTime() || now;
          state.targetLat = entity.position.lat;
          state.targetLon = entity.position.lon;
          state.headingDeg = headingDeg;
          state.cogDeg = cogDeg;
          state.speedMs = speedMs;
          state.navStat = navStat;
          state.positionReliable = positionReliable;
          state.isEmergency = isEmergency;
          state.freshness = freshness;

          // Record trail point (max 20 points)
          state.trailPositions.push({ lat: entity.position.lat, lon: entity.position.lon });
          if (state.trailPositions.length > 20) {
            state.trailPositions.shift();
          }

          // Update billboard properties
          const b = state.cesiumEntity.billboard;
          if (b) {
            b.image = iconUri;
            b.rotation = rotationRad;
            b.color = new Cesium.Color(1.0, 1.0, 1.0, opacity);
            b.width = isSelected ? 36 : (isEmergency ? 32 : 26);
            b.height = isSelected ? 36 : (isEmergency ? 32 : 26);
          }

          // Update or toggle label based on mode
          if (mode === 'detail') {
            if (!state.cesiumEntity.label) {
              state.cesiumEntity.label = new Cesium.LabelGraphics({
                text: entity.label,
                font: '11px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                fillColor: isEmergency ? Cesium.Color.fromCssColorString('#fca5a5') : Cesium.Color.fromCssColorString('#ccfbf1'),
                pixelOffset: new Cesium.Cartesian2(0, 20),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500_000),
              });
            } else {
              state.cesiumEntity.label.text = entity.label;
            }
          } else if (state.cesiumEntity.label) {
            state.cesiumEntity.label = undefined;
          }
        }
      }

      // Remove vessels that disappeared
      states.forEach((state, id) => {
        if (!currentIds.has(id)) {
          if (state.trailPolylineEntity) {
            ds.entities.remove(state.trailPolylineEntity);
          }
          if (state.cesiumEntity) {
            ds.entities.remove(state.cesiumEntity);
          }
          states.delete(id);
        }
      });
    });
  }, [viewer, entities, displayMode, filters]);

  return null;
});

export default SeaLayer;
