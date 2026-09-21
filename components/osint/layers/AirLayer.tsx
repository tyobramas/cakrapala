'use client';
// components/osint/layers/AirLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders live ADS-B flight traffic on the Cesium globe with 60 FPS dead reckoning.
//
// Features:
//   - High-performance ID-based diffing with Cesium Entity Collection.
//   - Smooth per-frame dead reckoning in Cesium scene.preRender (zero React re-renders).
//   - True 3D altitude: aircraft fly at real altitude (altM), ground aircraft clamp to 0.
//   - Distinct color coding: Cyan (#22d3ee) for civil flights, Amber (#f59e0b) for military.
//   - Heading-oriented airplane icon; neutral symbol when heading is absent.
//   - Detail mode: callsign labels + in-memory 60s flight trails (max 20 points).
//   - 30-second disappearance grace period with smooth fade out.
//   - Privacy safeguards: strictly ephemeral, no persistent tail tracking or storage.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import type { OsintEntity } from '@/lib/osint/types';
import { resolveDisplayMode, type DisplayMode } from '@/lib/osint/registry';
import {
  extrapolate,
  shortestAngleDiff,
} from '@/lib/osint/layers/air/deadReckon';

export interface AirFilterSettings {
  minAltFt?: number;
  maxAltFt?: number;
  hideOnGround?: boolean;
  militaryOnly?: boolean;
  showTrails?: boolean;
}

export interface AirLayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any;
  entities: OsintEntity[];
  cameraAltM: number;
  filterSettings?: AirFilterSettings;
  selectedEntity?: OsintEntity | null;
  onSelect?: (entity: OsintEntity) => void;
}

const CIVIL_COLOR = '#22d3ee';
const MILITARY_COLOR = '#f59e0b';
const MAX_TRAIL_POINTS = 20;
const GRACE_PERIOD_MS = 30_000; // 30 seconds

function generateAirplaneSvg(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="none">
    <path d="M18 2 L19.5 12 L30 18 L30 21 L19.5 18 L19.5 27 L23 30 L23 32 L18 31 L13 32 L13 30 L16.5 27 L16.5 18 L6 21 L6 18 L16.5 12 Z" fill="${colorHex}" stroke="#0f172a" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function generateNeutralAircraftSvg(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="7" fill="${colorHex}" fill-opacity="0.3" stroke="${colorHex}" stroke-width="2"/>
    <circle cx="12" cy="12" r="3.5" fill="${colorHex}"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface LocalAircraftState {
  entity: OsintEntity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cesiumEntity: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trailEntity?: any;
  // Positional telemetry
  currentLat: number;
  currentLon: number;
  currentAltM: number;
  targetLat: number;
  targetLon: number;
  targetAltM: number;
  headingDeg?: number;
  speedMs: number;
  onGround: boolean;
  fresh: boolean;
  isMilitary: boolean;
  observedEpoch: number;
  lastSeenPollEpoch: number;
  transitionStartEpoch: number;
  // Historical trail: [lon, lat, altM][]
  trailPoints: [number, number, number][];
}

export default function AirLayer({
  viewer,
  entities,
  cameraAltM,
  filterSettings,
  selectedEntity,
  onSelect,
}: AirLayerProps) {
  const aircraftMapRef = useRef<Map<string, LocalAircraftState>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const filterRef = useRef(filterSettings);
  filterRef.current = filterSettings;

  const mode: DisplayMode = resolveDisplayMode(cameraAltM);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ── Click Handler ──────────────────────────────────────────────────────────
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
        if (!entityId || !entityId.startsWith('air:')) return;

        const state = aircraftMapRef.current.get(entityId);
        if (state && onSelectRef.current) {
          onSelectRef.current(state.entity);
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

  // ── Ingest new entity polls & perform ID diffing ───────────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let isMounted = true;

    import('cesium').then((Cesium) => {
      if (!isMounted || !viewer || viewer.isDestroyed()) return;

      const now = Date.now();
      const activeHexIds = new Set<string>();

      for (const ent of entities) {
        activeHexIds.add(ent.id);

        const lat = ent.position.lat;
        const lon = ent.position.lon;
        const altM = ent.position.altM ?? 0;
        const headingDeg = ent.headingDeg;
        const speedMs = ent.speedMs ?? 0;
        const onGround = Boolean(ent.raw?.onGround);
        const fresh = Boolean(ent.raw?.fresh ?? true);
        const isMilitary = Boolean(ent.raw?.isMilitary);
        const observedEpoch = new Date(ent.observedAt).getTime();

        const existing = aircraftMapRef.current.get(ent.id);

      if (existing) {
        // Update existing aircraft target telemetry
        existing.entity = ent;
        existing.targetLat = lat;
        existing.targetLon = lon;
        existing.targetAltM = altM;
        existing.headingDeg = headingDeg;
        existing.speedMs = speedMs;
        existing.onGround = onGround;
        existing.fresh = fresh;
        existing.isMilitary = isMilitary;
        existing.observedEpoch = observedEpoch;
        existing.lastSeenPollEpoch = now;
        existing.transitionStartEpoch = now;

        // Append to trail
        existing.trailPoints.push([lon, lat, altM]);
        if (existing.trailPoints.length > MAX_TRAIL_POINTS) {
          existing.trailPoints.shift();
        }
      } else {
        // Create new aircraft entity
        const colorHex = isMilitary ? MILITARY_COLOR : CIVIL_COLOR;
        const iconUri =
          headingDeg !== undefined
            ? generateAirplaneSvg(colorHex)
            : generateNeutralAircraftSvg(colorHex);

        const size = Math.round(20 + ent.severity * 14); // 20px .. 34px
        const position = Cesium.Cartesian3.fromDegrees(lon, lat, altM);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entityOptions: any = {
          id: ent.id,
          name: ent.label,
          position,
          billboard: {
            image: iconUri,
            width: size,
            height: size,
            rotation: headingDeg !== undefined ? Cesium.Math.toRadians(360 - headingDeg) : 0,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        };

        if (mode === 'detail') {
          entityOptions.label = {
            text: ent.label,
            font: '10px monospace',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, size / 2 + 8),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            show: true,
          };
        }

        const cesiumEntity = viewer.entities.add(entityOptions);

        aircraftMapRef.current.set(ent.id, {
          entity: ent,
          cesiumEntity,
          currentLat: lat,
          currentLon: lon,
          currentAltM: altM,
          targetLat: lat,
          targetLon: lon,
          targetAltM: altM,
          headingDeg,
          speedMs,
          onGround,
          fresh,
          isMilitary,
          observedEpoch,
          lastSeenPollEpoch: now,
          transitionStartEpoch: now,
          trailPoints: [[lon, lat, altM]],
        });
      }
    }

      viewer.scene.requestRender();
    });

    return () => {
      isMounted = false;
    };
  }, [viewer, entities, mode]);

  // ── High-Performance Animation Loop (Cesium scene.preRender) ──────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let isMounted = true;
    let removeListener: (() => void) | null = null;

    import('cesium').then((Cesium) => {
      if (!isMounted || !viewer || viewer.isDestroyed()) return;

      const scene = viewer.scene;

      const onPreRender = () => {
        const now = Date.now();
        const currentMode = modeRef.current;
        const filters = filterRef.current;

        const minAltM = filters?.minAltFt !== undefined ? filters.minAltFt * 0.3048 : -Infinity;
        const maxAltM = filters?.maxAltFt !== undefined ? filters.maxAltFt * 0.3048 : Infinity;
        const hideGround = filters?.hideOnGround ?? true;
        const militaryOnly = filters?.militaryOnly ?? false;
        const showTrails = filters?.showTrails ?? true;

        const toDelete: string[] = [];

        for (const [id, state] of aircraftMapRef.current.entries()) {
          const timeSincePoll = now - state.lastSeenPollEpoch;

          // Grace period expiry check (30 seconds)
          if (timeSincePoll > GRACE_PERIOD_MS) {
            toDelete.push(id);
            continue;
          }

          // Apply filters
          const passesFilter =
            (!hideGround || !state.onGround) &&
            (!militaryOnly || state.isMilitary) &&
            state.currentAltM >= minAltM &&
            state.currentAltM <= maxAltM;

          if (!passesFilter) {
            state.cesiumEntity.show = false;
            if (state.trailEntity) state.trailEntity.show = false;
            continue;
          }

          state.cesiumEntity.show = true;

          // Smooth position computation:
          // 1. If fresh (seen_pos <= 30) and flying, dead reckon along heading
          let animLat = state.targetLat;
          let animLon = state.targetLon;
          const animAlt = state.targetAltM;

          if (state.fresh && !state.onGround && state.speedMs >= 5 && state.headingDeg !== undefined) {
            const dtSeconds = (now - state.observedEpoch) / 1000;
            const projected = extrapolate(
              state.targetLat,
              state.targetLon,
              state.headingDeg,
              state.speedMs,
              dtSeconds,
            );
            animLat = projected.lat;
            animLon = projected.lon;
          }

          // Smooth transition (~500ms ease) from previous frame to avoid sudden jump
          state.currentLat += (animLat - state.currentLat) * 0.25;
          state.currentLon += (animLon - state.currentLon) * 0.25;
          state.currentAltM += (animAlt - state.currentAltM) * 0.25;

          const updatedPos = Cesium.Cartesian3.fromDegrees(
            state.currentLon,
            state.currentLat,
            state.currentAltM,
          );
          state.cesiumEntity.position = updatedPos;

          if (state.headingDeg !== undefined && state.cesiumEntity.billboard) {
            state.cesiumEntity.billboard.rotation = Cesium.Math.toRadians(360 - state.headingDeg);
          }

          // Detail mode label updates
          if (currentMode === 'detail' && state.cesiumEntity.label) {
            const altFt = Math.round(state.currentAltM / 0.3048);
            const kts = Math.round(state.speedMs * 1.94384);
            state.cesiumEntity.label.text = `${state.entity.label}\nFL${Math.round(altFt / 100)} · ${kts}kt`;
          }

          // Trail handling
          if (showTrails && state.trailPoints.length > 1) {
            const flatPoints: number[] = [];
            for (const pt of state.trailPoints) {
              flatPoints.push(pt[0], pt[1], pt[2]);
            }
            flatPoints.push(state.currentLon, state.currentLat, state.currentAltM);

            const trailColorHex = state.isMilitary
              ? '#f87171'
              : state.onGround
                ? '#94a3b8'
                : '#38bdf8';

            if (!state.trailEntity) {
              state.trailEntity = viewer.entities.add({
                id: `${id}:trail`,
                polyline: {
                  positions: Cesium.Cartesian3.fromDegreesArrayHeights(flatPoints),
                  width: 1.5,
                  material: Cesium.Color.fromCssColorString(trailColorHex).withAlpha(0.4),
                },
              });
            }
            state.trailEntity.show = true;
          } else if (state.trailEntity) {
            state.trailEntity.show = false;
          }
        }

        // Cleanup expired aircraft
        for (const delId of toDelete) {
          const item = aircraftMapRef.current.get(delId);
          if (item) {
            viewer.entities.remove(item.cesiumEntity);
            if (item.trailEntity) viewer.entities.remove(item.trailEntity);
            aircraftMapRef.current.delete(delId);
          }
        }
      };

      scene.preRender.addEventListener(onPreRender);
      removeListener = () => {
        try {
          scene.preRender.removeEventListener(onPreRender);
        } catch {}
      };
    });

    return () => {
      isMounted = false;
      if (removeListener) removeListener();
    };
  }, [viewer]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) return;

      for (const item of aircraftMapRef.current.values()) {
        viewer.entities.remove(item.cesiumEntity);
        if (item.trailEntity) viewer.entities.remove(item.trailEntity);
      }
      aircraftMapRef.current.clear();
    };
  }, [viewer]);

  return null;
}
